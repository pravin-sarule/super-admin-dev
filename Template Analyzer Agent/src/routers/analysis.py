from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from ..database import get_db, AsyncSessionLocal
from ..config import settings
from ..models.db_models import Template, TemplateField, TemplateSection
from ..services.agent_service import AntigravityAgent
from ..services.document_ai_service import DocumentAIService
from ..services.field_extractor import HybridFieldExtractor
from pydantic import BaseModel
import uuid, re
from typing import List, Optional, Dict, Any


def _distribute_fields_to_sections(analysis_result: dict, template_text: str, hybrid_fields: list):
    """
    When AI extraction leaves all sections with empty fields, split the template text
    by section headings and assign each hybrid field to the section whose text contains
    its placeholder token (__key__ or {{key}}). Rebuilds all_fields afterward.
    """
    sections = analysis_result.get("sections", [])
    if not sections:
        return

    # Build section text slices: find where each section heading appears in the template
    section_slices: List[Dict] = []
    text_lower = template_text.lower()
    for sec in sections:
        name = sec.get("section_name", "")
        # Try to find the section heading position in the text
        pos = text_lower.find(name.lower())
        section_slices.append({"section": sec, "start": pos if pos >= 0 else -1})

    # Sort by position (sections found in text first, in order)
    section_slices.sort(key=lambda x: x["start"] if x["start"] >= 0 else 999999)

    # Build boundaries: each section spans from its start to the next section's start
    boundaries = []
    for i, sl in enumerate(section_slices):
        start = sl["start"] if sl["start"] >= 0 else 0
        end = section_slices[i + 1]["start"] if i + 1 < len(section_slices) and section_slices[i + 1]["start"] >= 0 else len(template_text)
        boundaries.append((sl["section"], template_text[start:end]))

    # If no positions found, split text evenly
    if all(s["start"] < 0 for s in section_slices):
        chunk_size = max(1, len(template_text) // len(sections))
        boundaries = [
            (sections[i], template_text[i * chunk_size:(i + 1) * chunk_size])
            for i in range(len(sections))
        ]

    # Assign each hybrid field to the section containing its token
    field_assigned = {f.get("field_id"): False for f in hybrid_fields}
    for sec, sec_text in boundaries:
        if not isinstance(sec.get("fields"), list):
            sec["fields"] = []
        for hf in hybrid_fields:
            key = hf.get("field_id") or hf.get("key", "")
            if not key:
                continue
            # Check if this field's placeholder appears in the section's text slice
            if f"__{key}__" in sec_text or f"{{{{{key}}}}}" in sec_text or key in sec_text:
                if not any(f.get("key") == key for f in sec["fields"]):
                    sec["fields"].append({
                        "key": key,
                        "type": hf.get("field_type", "string"),
                        "label": hf.get("field_name", key.replace("_", " ").title()),
                        "required": hf.get("is_required", True),
                        "description": hf.get("surrounding_text", "")[:100],
                        "default_value": "",
                        "validation_rules": hf.get("validation", "") or "",
                    })
                    field_assigned[key] = True

    # Any unassigned fields go to the last section
    unassigned = [hf for hf in hybrid_fields if not field_assigned.get(hf.get("field_id", ""), False)]
    if unassigned and sections:
        last_sec = sections[-1]
        if not isinstance(last_sec.get("fields"), list):
            last_sec["fields"] = []
        for hf in unassigned:
            key = hf.get("field_id") or hf.get("key", "")
            if key and not any(f.get("key") == key for f in last_sec["fields"]):
                last_sec["fields"].append({
                    "key": key,
                    "type": hf.get("field_type", "string"),
                    "label": hf.get("field_name", key.replace("_", " ").title()),
                    "required": hf.get("is_required", True),
                    "description": hf.get("surrounding_text", "")[:100],
                    "default_value": "",
                    "validation_rules": hf.get("validation", "") or "",
                })

    # Merge newly-assigned fields into all_fields (preserving any existing AI-produced entries)
    existing_all_fields = analysis_result.get("all_fields", [])
    seen = {f.get("key") for f in existing_all_fields if f.get("key")}
    new_entries = []
    for sec in sections:
        sid = sec.get("section_id", "")
        for f in sec.get("fields", []):
            k = f.get("key")
            if k and k not in seen:
                seen.add(k)
                new_entries.append({**f, "section_id": sid})
    analysis_result["all_fields"] = existing_all_fields + new_entries

router = APIRouter(prefix="/analysis", tags=["Analysis"])

agent = None
doc_ai = None
field_extractor = HybridFieldExtractor()


def get_agent() -> AntigravityAgent:
    global agent
    if agent is None:
        if not settings.GEMINI_API_KEY and not settings.ANTHROPIC_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="No LLM API key is configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY."
            )
        agent = AntigravityAgent()
    return agent


def get_doc_ai() -> DocumentAIService:
    global doc_ai
    if doc_ai is None:
        doc_ai = DocumentAIService()
    return doc_ai

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
    current_doc_ai = get_doc_ai()
    for t in templates:
        if t.image_url and t.image_url.startswith("gs://"):
            t.image_url = current_doc_ai.generate_signed_url(t.image_url)
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

async def _run_analysis_background(
    template_id: uuid.UUID,
    template_text: str,
    signed_file_url: Optional[str],
    image_url: Optional[str],
):
    """Background task: runs AI analysis and saves sections/fields. Updates template status when done."""
    print(f"DEBUG: [BG] Starting AI analysis for template {template_id}...")
    current_agent = get_agent()

    try:
        async with AsyncSessionLocal() as db:
            # Phase 1: AI analysis
            analysis_result = await current_agent.analyze_template(template_text, template_file_signed_url=signed_file_url)
            if not isinstance(analysis_result, dict):
                analysis_result = {}

            # Hybrid field extraction
            hybrid_schema = field_extractor.extract_from_text(template_text)
            if not isinstance(hybrid_schema, dict):
                hybrid_schema = {}
            analysis_result["hybrid_fields"] = hybrid_schema
            hybrid_fields_list = hybrid_schema.get("fields", [])
            print(f"DEBUG: [BG] HybridFieldExtractor: {hybrid_schema.get('total_fields', 0)} fields.")

            # Consider fields "present" if either section.fields[] OR top-level all_fields
            # is non-empty — both are produced by the AI and should not be overwritten by
            # the smaller hybrid extractor output.
            if hybrid_fields_list:
                print("DEBUG: [BG] Backfilling hybrid fields into sections...")
                _distribute_fields_to_sections(analysis_result, template_text, hybrid_fields_list)
                print(f"DEBUG: [BG] all_fields={len(analysis_result.get('all_fields', []))}")

            # Sync sections' fields arrays from all_fields (LLM may populate all_fields more
            # completely than each section's individual fields list)
            all_fields_list = analysis_result.get("all_fields", [])
            if all_fields_list:
                fields_by_section = {}
                for f in all_fields_list:
                    sid = f.get("section_id", "")
                    if sid:
                        fields_by_section.setdefault(sid, []).append(f)
                for sec in analysis_result.get("sections", []):
                    sid = sec.get("section_id", "")
                    if not isinstance(sec.get("fields"), list):
                        sec["fields"] = []
                    if sid and sid in fields_by_section:
                        existing_keys = {f.get("key") for f in sec["fields"]}
                        for f in fields_by_section[sid]:
                            if f.get("key") and f.get("key") not in existing_keys:
                                sec["fields"].append(f)
                print(f"DEBUG: [BG] After sync: sections have "
                      f"{sum(len(s.get('fields',[])) for s in analysis_result.get('sections',[]))} total fields.")

            new_field_entry = TemplateField(template_id=template_id, template_fields=analysis_result)
            db.add(new_field_entry)

            raw_sections = analysis_result.get("sections", [])
            sections = []
            for i, item in enumerate(raw_sections):
                if isinstance(item, dict):
                    sections.append(item)
                elif isinstance(item, str):
                    sections.append({
                        "section_id": f"section_{i+1}", "section_name": item,
                        "section_purpose": "", "order": i + 1,
                        "fields": [], "format_blueprint": [],
                        "drafting_prompt": f"Generate the {item} section.",
                    })
                else:
                    sections.append({"section_name": "Untitled Section", "section_purpose": "", "fields": [], "order": i + 1})

            print(f"DEBUG: [BG] Processing {len(sections)} sections...")
            for index, section in enumerate(sections):
                section_name = section.get("section_name", "Untitled Section")
                print(f"DEBUG: [BG] Section {index+1}/{len(sections)}: {section_name}")
                try:
                    prompt_data = await current_agent.generate_section_prompts(section)
                    if not isinstance(prompt_data, dict):
                        prompt_data = {}
                except Exception as sec_err:
                    print(f"DEBUG: [BG] Section {index+1} fallback ({sec_err})")
                    prompt_data = {}
                fallback_prompt = section.get("drafting_prompt", "") or f"Generate the '{section_name}' section exactly as it appears in the template."
                section_entry = TemplateSection(
                    template_id=template_id,
                    section_name=section_name,
                    section_purpose=section.get("section_purpose", ""),
                    section_intro=prompt_data.get("section_intro", ""),
                    section_prompts=prompt_data.get("field_prompts", [
                        {"field_id": "master_instruction", "prompt": fallback_prompt}
                    ]),
                    order_index=index
                )
                db.add(section_entry)
                if index % 3 == 0:
                    await db.flush()
                print(f"DEBUG: [BG] Completed section {index+1}")

            # Mark template as active (processing complete)
            await db.execute(
                update(Template).where(Template.id == template_id).values(status="active")
            )
            await db.commit()
            print(f"DEBUG: [BG] Template {template_id} analysis complete — status=active.")

    except Exception as e:
        print(f"ERROR: [BG] Analysis failed for template {template_id}: {e}")
        try:
            async with AsyncSessionLocal() as db:
                await db.execute(
                    update(Template).where(Template.id == template_id).values(status="error")
                )
                await db.commit()
        except Exception:
            pass


@router.post("/upload-template")
async def upload_template(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    category: str = Form(...),
    subcategory: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    image: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    """Admin only: upload template, OCR it, save to GCS, then run AI analysis in background."""
    print(f"DEBUG: >>> RECEIVED UPLOAD REQUEST for {name}")

    try:
        current_doc_ai = get_doc_ai()
        template_id = uuid.uuid4()
        file_content = await file.read()
        template_text = ""

        if file.content_type == "application/pdf":
            print(f"DEBUG: Starting Document AI OCR for {file.filename}...")
            template_text = await current_doc_ai.parallel_process_pdf(file_content)
            print(f"DEBUG: OCR complete. {len(template_text)} chars extracted.")
            template_text = re.sub(r'\{\s*\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\s*\}', r'{{\1}}', template_text)

            # Fix __field_name__ tokens split across lines by PDF table cell text wrapping
            # e.g. __payment_1_am\nount__ → __payment_1_amount__
            # e.g. __token_amount_\n_ → __token_amount__
            # Iterate until stable (handles multiple consecutive splits in one token)
            prev_text = None
            while prev_text != template_text:
                prev_text = template_text
                # Case 1: field name split mid-word, closing __ on second part
                template_text = re.sub(
                    r'(__[a-zA-Z][a-zA-Z0-9_]*)\s*\n\s*([a-zA-Z0-9_]+__)',
                    lambda m: m.group(1) + m.group(2),
                    template_text
                )
                # Case 2: closing __ itself split across lines: __field_name_\n_
                template_text = re.sub(
                    r'(__[a-zA-Z][a-zA-Z0-9_]+)_\s*\n\s*_(?![a-zA-Z0-9_])',
                    lambda m: m.group(1) + '__',
                    template_text
                )
            field_token_count = len(re.findall(r'__[a-zA-Z][a-zA-Z0-9_]*__', template_text))
            print(f"DEBUG: OCR post-process: {field_token_count} __field__ tokens after fixing line wraps.")
        else:
            template_text = file_content.decode('utf-8', errors='ignore')

        image_url = None
        if image:
            image_content = await image.read()
            image_url = await current_doc_ai.upload_to_gcs(
                image_content, f"images/{template_id}_{image.filename}", image.content_type
            )

        file_url = None
        if file.content_type == "application/pdf":
            file_url = await current_doc_ai.upload_to_gcs(
                file_content, f"pdfs/{template_id}_{file.filename}", "application/pdf"
            )

        # Save template stub with status="processing" — return immediately
        new_template = Template(
            id=template_id,
            name=name,
            category=category,
            subcategory=subcategory,
            description=description,
            language="en",
            status="processing",
            file_url=file_url,
            image_url=image_url,
            user_id=None
        )
        db.add(new_template)
        await db.commit()
        print(f"DEBUG: Template {template_id} saved with status=processing. Starting background analysis.")

        signed_file_url = current_doc_ai.generate_signed_url(file_url) if file_url else None
        background_tasks.add_task(
            _run_analysis_background,
            template_id, template_text, signed_file_url, image_url
        )

        return {
            "status": "processing",
            "template_id": str(template_id),
            "image_url": current_doc_ai.generate_signed_url(image_url) if image_url else None,
            "message": "Template uploaded. AI analysis is running in the background."
        }
    except Exception as e:
        await db.rollback()
        print(f"Error in upload_template: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/template/{template_id}/status")
async def get_template_status(template_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Poll this endpoint to check if background analysis is complete."""
    result = await db.execute(select(Template).where(Template.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    # Count sections to show progress
    sec_result = await db.execute(
        select(TemplateSection).where(TemplateSection.template_id == template_id)
    )
    section_count = len(sec_result.scalars().all())
    return {
        "status": template.status,
        "template_id": str(template_id),
        "sections_ready": section_count,
    }

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
    if not isinstance(fields, dict):
        fields = {}
    analysis_sections = fields.get("sections") or []
    merged_sections = []
    for i, db_sec in enumerate(db_sections):
        sec_dict = _section_row_to_dict(db_sec)
        anal = analysis_sections[i] if i < len(analysis_sections) else {}
        if not isinstance(anal, dict):
            anal = {}
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
    current_doc_ai = get_doc_ai()
    if template.image_url and template.image_url.startswith("gs://"):
        template.image_url = current_doc_ai.generate_signed_url(template.image_url)
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
    current_agent = get_agent()
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
    max_tokens = request.max_output_tokens or 65536
    content = await current_agent.generate_section_content(
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
    template, merged_sections, fields = await _get_template_merged_sections(template_id, db)
    if not merged_sections:
        raise HTTPException(status_code=400, detail="Template has no sections")
    current_agent = get_agent()
    indexes = request.section_indexes if request.section_indexes is not None else list(range(len(merged_sections)))
    max_tokens = request.max_output_tokens_per_section or 65536
    parts = []
    section_results = []
    for i in indexes:
        if i < 0 or i >= len(merged_sections):
            continue
        section_data = merged_sections[i]
        content = await current_agent.generate_section_content(
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
