from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from ..database import get_db
from ..models.db_models import Template, TemplateField, TemplateSection
from ..services.agent_service import AntigravityAgent
from ..services.document_ai_service import DocumentAIService
from ..config import settings
from pydantic import BaseModel
import uuid
from typing import List, Optional, Dict, Any

router = APIRouter(prefix="/analysis", tags=["Analysis"])

_agent: Optional[AntigravityAgent] = None
doc_ai = DocumentAIService()


def get_agent() -> Optional[AntigravityAgent]:
    """Lazy-init agent only when GEMINI_API_KEY is set."""
    global _agent
    if _agent is None and getattr(settings, "GEMINI_API_KEY", None) and (settings.GEMINI_API_KEY or "").strip():
        _agent = AntigravityAgent()
    return _agent

@router.get("/")
async def analysis_root():
    return {"status": "active", "service": "Analysis API", "endpoints": ["/templates", "/upload-template"]}

class AdminUploadRequest(BaseModel):
    template_id: str
    template_text: str
    template_name: str = "Untitled Template"
    template_category: str = "General"

@router.get("/templates")
async def get_templates(db: AsyncSession = Depends(get_db)):
    """Get all admin-added templates (templates table only)."""
    result = await db.execute(select(Template).where(Template.user_id.is_(None)))
    templates = list(result.scalars().all())
    for t in templates:
        if t.image_url and t.image_url.startswith("gs://"):
            t.image_url = doc_ai.generate_signed_url(t.image_url)
    return templates

@router.delete("/template/{template_id}")
async def delete_template(template_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete an admin-added template (templates table only)."""
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.execute(delete(TemplateSection).where(TemplateSection.template_id == template_id))
    await db.execute(delete(TemplateField).where(TemplateField.template_id == template_id))
    await db.execute(delete(Template).where(Template.id == template_id))
    await db.commit()
    return {"status": "success", "message": "Template deleted"}

@router.get("/test")
async def test_endpoint():
    return {"status": "ok", "message": "Analysis API is responding"}

@router.post("/test-upload")
async def test_upload(file: UploadFile = File(...)):
    content = await file.read()
    return {"filename": file.filename, "size": len(content)}

@router.post("/upload-template")
async def upload_template(
    name: str = Form(...),
    category: str = Form(...),
    subcategory: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    image: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    """Admin only: add template to templates table (no user_templates)."""
    print(f"DEBUG: >>> RECEIVED UPLOAD REQUEST for {name} (admin template)")

    try:
        template_id = uuid.uuid4()
        file_content = await file.read()
        template_text = ""

        if file.content_type == "application/pdf":
            print(f"DEBUG: Starting Parallel Document AI processing for {file.filename}...")
            template_text = await doc_ai.parallel_process_pdf(file_content)
            print(f"DEBUG: Document AI processing complete. Extracted {len(template_text)} characters.")
        else:
            template_text = file_content.decode('utf-8', errors='ignore')

        image_url = None
        if image:
            print(f"DEBUG: Uploading cover image {image.filename}...")
            image_content = await image.read()
            image_url = await doc_ai.upload_to_gcs(image_content, f"images/{template_id}_{image.filename}", image.content_type)

        file_url = None
        if file.content_type == "application/pdf":
            print(f"DEBUG: Uploading PDF {file.filename} to storage...")
            file_url = await doc_ai.upload_to_gcs(file_content, f"pdfs/{template_id}_{file.filename}", "application/pdf")

        new_template = Template(
            id=template_id,
            name=name,
            category=category,
            subcategory=subcategory,
            description=description,
            language="en",
            status="active",
            file_url=file_url,
            image_url=image_url,
            user_id=None
        )
        db.add(new_template)
        await db.flush()

        signed_file_url = doc_ai.generate_signed_url(file_url) if file_url else None
        agent = get_agent()
        if not agent:
            raise HTTPException(503, "Analysis unavailable: GEMINI_API_KEY not set in .env")
        print(f"DEBUG: Starting Phase 1 (AI Analysis)...")
        analysis_result = await agent.analyze_template(template_text, template_file_signed_url=signed_file_url)
        print(f"DEBUG: Phase 1 complete. Extracted fields/sections.")

        new_field_entry = TemplateField(template_id=template_id, template_fields=analysis_result)
        db.add(new_field_entry)

        sections = analysis_result.get("sections", [])
        print(f"DEBUG: Processing {len(sections)} sections sequentially to avoid rate limits...")
        for index, section in enumerate(sections):
            print(f"DEBUG: Starting section {index+1}/{len(sections)}: {section.get('section_name')}")
            prompt_data = await agent.generate_section_prompts(section)
            section_entry = TemplateSection(
                template_id=template_id,
                section_name=section.get("section_name", "Untitled Section"),
                section_purpose=section.get("section_purpose", ""),
                section_intro=prompt_data.get("section_intro", ""),
                section_prompts=prompt_data.get("field_prompts", []),
                order_index=index
            )
            db.add(section_entry)
            if index % 2 == 0:
                await db.flush()
            print(f"DEBUG: Completed section {index+1}")

        print(f"DEBUG: All {len(sections)} sections processed. Final commit...")
        try:
            await db.commit()
            print(f"DEBUG: Database commit successful. Template {template_id} saved.")
        except Exception as commit_error:
            print(f"CRITICAL ERROR during commit: {commit_error}")
            await db.rollback()
            raise commit_error

        return {
            "status": "success",
            "template_id": str(template_id),
            "image_url": doc_ai.generate_signed_url(image_url) if image_url else None,
            "message": "Template uploaded and processed successfully"
        }
    except Exception as e:
        await db.rollback()
        print(f"Error in upload_template: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def _section_row_to_dict(row) -> dict:
    """Convert TemplateSection ORM row to dict (serializable)."""
    return {k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in row.__dict__.items() if not k.startswith("_")}


async def _get_template_merged_sections(template_id: uuid.UUID, db: AsyncSession):
    """Load template, merged sections (same format as analyzer output), and fields. Raises 404 if not found."""
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    sections_result = await db.execute(
        select(TemplateSection).where(TemplateSection.template_id == template_id).order_by(TemplateSection.order_index)
    )
    db_sections = sections_result.scalars().all()
    fields_result = await db.execute(select(TemplateField).where(TemplateField.template_id == template_id))
    fields_entry = fields_result.scalar_one_or_none()
    fields = fields_entry.template_fields if fields_entry else {}
    analysis_sections = fields.get("sections") or []
    merged_sections = []
    for i, db_sec in enumerate(db_sections):
        sec_dict = _section_row_to_dict(db_sec)
        anal = analysis_sections[i] if i < len(analysis_sections) else {}
        sec_dict["section_id"] = anal.get("section_id") or sec_dict.get("id")
        sec_dict["fields"] = anal.get("fields", [])
        sec_dict["section_category"] = anal.get("section_category")
        sec_dict["estimated_words"] = anal.get("estimated_words")
        sec_dict["depends_on"] = anal.get("depends_on", [])
        merged_sections.append(sec_dict)
    return template, merged_sections, fields


@router.get("/template/{template_id}")
async def get_template_details(template_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Fetch template by id. Returns template, sections (unified format matching analyzer output), and fields.
    Sections are merged from DB (section_name, section_purpose, section_intro, section_prompts) and
    from analysis (section_id, fields, section_category, estimated_words) so user side gets one consistent format."""
    template, merged_sections, fields = await _get_template_merged_sections(template_id, db)
    if template.image_url and template.image_url.startswith("gs://"):
        template.image_url = doc_ai.generate_signed_url(template.image_url)
    return {
        "template": template,
        "sections": merged_sections,
        "fields": fields
    }

class UpdateFieldsRequest(BaseModel):
    template_fields: dict

@router.put("/template/{template_id}/fields")
async def update_template_fields(template_id: uuid.UUID, request: UpdateFieldsRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TemplateField).where(TemplateField.template_id == template_id))
    field_entry = result.scalar_one_or_none()
    
    if not field_entry:
        raise HTTPException(status_code=404, detail="Template fields not found")
        
    field_entry.template_fields = request.template_fields
    await db.commit()
    return {"status": "success", "message": "Fields updated"}

class SectionUpdateItem(BaseModel):
    id: Optional[str] = None
    section_name: str
    section_purpose: Optional[str] = None
    section_intro: Optional[str] = None
    section_prompts: List[dict] = []

class UpdateSectionsRequest(BaseModel):
    sections: List[SectionUpdateItem]

@router.put("/template/{template_id}/sections")
async def update_template_sections(template_id: uuid.UUID, request: UpdateSectionsRequest, db: AsyncSession = Depends(get_db)):
    # Verify template exists
    result = await db.execute(select(Template).where(Template.id == template_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Template not found")

    # Get existing sections
    existing_sections_result = await db.execute(select(TemplateSection).where(TemplateSection.template_id == template_id))
    existing_sections = {str(s.id): s for s in existing_sections_result.scalars().all()}
    
    # Process updates
    for sec_data in request.sections:
        if sec_data.id and sec_data.id in existing_sections:
            # Update existing
            section = existing_sections[sec_data.id]
            section.section_name = sec_data.section_name
            section.section_purpose = sec_data.section_purpose
            section.section_intro = sec_data.section_intro
            section.section_prompts = sec_data.section_prompts
        else:
            # Create new (if ID is missing or not found)
            # Only create if it looks valid
            new_section = TemplateSection(
                template_id=template_id,
                section_name=sec_data.section_name,
                section_purpose=sec_data.section_purpose,
                section_intro=sec_data.section_intro,
                section_prompts=sec_data.section_prompts,
                order_index=0 # You might want to handle ordering logic here
            )
            db.add(new_section)
    
    await db.commit()
    return {"status": "success", "message": "Sections updated"}
@router.delete("/template/{template_id}/section/{section_id}")
async def delete_template_section(template_id: uuid.UUID, section_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    # Verify template exists
    result = await db.execute(select(Template).where(Template.id == template_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Template not found")

    # Delete section
    await db.execute(delete(TemplateSection).where(
        (TemplateSection.template_id == template_id) & 
        (TemplateSection.id == section_id)
    ))
    await db.commit()
    return {"status": "success", "message": "Section deleted"}


# --- Draft generation (user side: generate section or full draft, supports 500+ pages) ---

class GenerateSectionRequest(BaseModel):
    """Generate content for a single section."""
    section_index: Optional[int] = None  # 0-based index in template sections
    section_id: Optional[str] = None     # or section UUID
    field_values: Dict[str, Any] = {}    # key-value for template fields
    max_output_tokens: Optional[int] = 65536  # allow long section for 500-page drafts


class GenerateDraftRequest(BaseModel):
    """Generate full draft by concatenating all sections in order."""
    field_values: Dict[str, Any] = {}
    max_output_tokens_per_section: Optional[int] = 65536
    section_indexes: Optional[List[int]] = None  # if set, only generate these sections (0-based); else all


@router.post("/template/{template_id}/generate-section")
async def generate_section(
    template_id: uuid.UUID,
    request: GenerateSectionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate draft content for one section. User side can call this per section to build a 500+ page document.
    Returns plain-text section content. Use same section format as GET /template/{id} (no format mismatch)."""
    template, merged_sections, fields = await _get_template_merged_sections(template_id, db)
    if not merged_sections:
        raise HTTPException(status_code=400, detail="Template has no sections")
    section_data = None
    resolved_index = None
    if request.section_index is not None and 0 <= request.section_index < len(merged_sections):
        section_data = merged_sections[request.section_index]
        resolved_index = request.section_index
    elif request.section_id:
        for idx, s in enumerate(merged_sections):
            if str(s.get("id")) == str(request.section_id) or str(s.get("section_id")) == str(request.section_id):
                section_data = s
                resolved_index = idx
                break
    if not section_data:
        raise HTTPException(
            status_code=400,
            detail="Specify section_index (0-based) or section_id to identify the section",
        )
    agent = get_agent()
    if not agent:
        raise HTTPException(503, "Analysis unavailable: GEMINI_API_KEY not set in .env")
    max_tokens = request.max_output_tokens or 65536
    content = await agent.generate_section_content(
        section_data,
        request.field_values,
        max_output_tokens=max_tokens,
    )
    return {"content": content, "section_name": section_data.get("section_name"), "section_index": resolved_index}


@router.post("/template/{template_id}/generate-draft")
async def generate_draft(
    template_id: uuid.UUID,
    request: GenerateDraftRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate full draft by generating each section in order and concatenating. Supports 500+ page documents
    (each section can be up to max_output_tokens_per_section). Returns full text and per-section content."""
    agent = get_agent()
    if not agent:
        raise HTTPException(503, "Analysis unavailable: GEMINI_API_KEY not set in .env")
    template, merged_sections, fields = await _get_template_merged_sections(template_id, db)
    if not merged_sections:
        raise HTTPException(status_code=400, detail="Template has no sections")
    indexes = request.section_indexes if request.section_indexes is not None else list(range(len(merged_sections)))
    max_tokens = request.max_output_tokens_per_section or 65536
    parts = []
    section_results = []
    for i in indexes:
        if i < 0 or i >= len(merged_sections):
            continue
        section_data = merged_sections[i]
        content = await agent.generate_section_content(
            section_data,
            request.field_values,
            max_output_tokens=max_tokens,
        )
        parts.append(content)
        section_results.append({"section_index": i, "section_name": section_data.get("section_name"), "content": content})
    full_content = "\n\n".join(parts)
    return {
        "content": full_content,
        "section_count": len(section_results),
        "sections": section_results,
    }
