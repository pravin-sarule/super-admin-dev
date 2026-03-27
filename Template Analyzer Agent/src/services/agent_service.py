# # # # from google import genai
# # # # try:
# # # #     import google.adk as adk
# # # # except ImportError:
# # # #     adk = None
# # # # import json
# # # # import re
# # # # import asyncio
# # # # from typing import Optional
# # # # from ..config import settings

# # # # class AntigravityAgent:
# # # #     def __init__(self):
# # # #         # Configure Gemini using the official Google Gen AI SDK
# # # #         self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
# # # #         # Use Gemini 2.5 Pro by default; set GEMINI_MODEL=gemini-3-pro-preview for latest Pro
# # # #         self.model_name = settings.GEMINI_MODEL
        
# # # #         # Initialize Google ADK Agent for orchestration (Optional/Unused for now)
# # # #         # self.adk_agent = adk.Agent(
# # # #         #     name="master_template_analyser_agent",
# # # #         #     description="Expert legal template analyzer using Gemini for document analysis, section identification, and prompt generation."
# # # #         # )

# # # #     async def _call_gemini(self, prompt: str):
# # # #         """Helper to call Gemini and parse JSON safely"""
# # # #         print(f"DEBUG: Calling Gemini model {self.model_name} (Async)...")
# # # #         try:
# # # #             # Use the async interface of the genai SDK with a timeout
# # # #             response = await asyncio.wait_for(
# # # #                 self.client.aio.models.generate_content(
# # # #                     model=self.model_name,
# # # #                     contents=prompt,
# # # #                     config={
# # # #                         "response_mime_type": "application/json",
# # # #                         "max_output_tokens": 8192, # Maximize output length
# # # #                         "temperature": 0.1 # Reduce randomness for clearer JSON
# # # #                     }
# # # #                 ),
# # # #                 timeout=120.0 # Increased timeout for large generation
# # # #             )
# # # #             print(f"DEBUG: Gemini response received.")
# # # #         except asyncio.TimeoutError:
# # # #             print(f"DEBUG: Gemini call timed out after 120s.")
# # # #             raise ValueError("Gemini AI analysis timed out. Please try again.")
# # # #         except Exception as e:
# # # #             print(f"DEBUG: Gemini call failed: {e}")
# # # #             raise e
        
# # # #         # Extract JSON from response - handle multiple markdown formats
# # # #         text = response.text.strip()
        
# # # #         # Try to extract JSON from markdown code blocks
# # # #         json_match = re.search(r'```(?:json)?\s*\n?({[\s\S]*?})\s*\n?```', text)
# # # #         if json_match:
# # # #             clean_text = json_match.group(1)
# # # #         else:
# # # #             # If no code block, try to find JSON object directly
# # # #             json_match = re.search(r'({[\s\S]*})', text)
# # # #             if json_match:
# # # #                 clean_text = json_match.group(1)
# # # #             else:
# # # #                 clean_text = text
        
# # # #         # --- Robust JSON Cleaning ---
# # # #         # 1. Remove trailing commas before closing braces/brackets
# # # #         clean_text = re.sub(r',\s*([\]}])', r'\1', clean_text)
# # # #         # 2. Handle potential non-standard control characters
# # # #         clean_text = re.sub(r'[\x00-\x1F\x7F]', '', clean_text)
# # # #         # 3. Fix invalid backslash escapes (JSON only allows \ " \ / b f n r t and \uXXXX)
# # # #         #    Escape any \ not followed by a valid escape so json.loads won't raise Invalid \escape
# # # #         clean_text = re.sub(r'\\(?!["\\/bfnrt])(?!u[0-9a-fA-F]{4})', r'\\\\', clean_text)
        
# # # #         try:
# # # #             return json.loads(clean_text)
# # # #         except json.JSONDecodeError as e:
# # # #             # Provide detailed error for debugging
# # # #             print(f"JSON Parse Error: {str(e)}")
# # # #             # Log a snippet of the problematic area if possible
# # # #             line_no = getattr(e, 'lineno', 0)
# # # #             col_no = getattr(e, 'colno', 0)
# # # #             print(f"Error near Line {line_no}, Col {col_no}")
            
# # # #             # Print a bit more of the text for the user to troubleshoot
# # # #             print(f"Attempted to parse clean text (length {len(clean_text)}):")
# # # #             print(f"{clean_text[:1000]}...") 
# # # #             raise ValueError(f"Failed to parse Gemini response as JSON: {str(e)}")

# # # #     async def _call_gemini_plain_text(self, prompt: str, max_output_tokens: int = 65536, timeout_sec: float = 300.0):
# # # #         """Call Gemini and return raw plain text (no JSON). Used for section/draft generation.
# # # #         Supports long output (e.g. 65536 tokens) for 500+ page drafts when generating section by section."""
# # # #         print(f"DEBUG: Calling Gemini (plain text, max_output_tokens={max_output_tokens})...")
# # # #         try:
# # # #             response = await asyncio.wait_for(
# # # #                 self.client.aio.models.generate_content(
# # # #                     model=self.model_name,
# # # #                     contents=prompt,
# # # #                     config={
# # # #                         "max_output_tokens": min(max_output_tokens, 65536),
# # # #                         "temperature": 0.2,
# # # #                     }
# # # #                 ),
# # # #                 timeout=timeout_sec
# # # #             )
# # # #             print(f"DEBUG: Gemini plain-text response received.")
# # # #             return (response.text or "").strip()
# # # #         except asyncio.TimeoutError:
# # # #             print(f"DEBUG: Gemini call timed out after {timeout_sec}s.")
# # # #             raise ValueError(f"Generation timed out. Try again or use a shorter section.")
# # # #         except Exception as e:
# # # #             print(f"DEBUG: Gemini call failed: {e}")
# # # #             raise e

# # # #     async def analyze_template(self, template_text: str, template_file_signed_url: Optional[str] = None):
# # # #         """Phase 1: Analysis & Field Extraction. Extracts EVERY distinct section (e.g. Case Title, Index,
# # # #         Annexure, Synopsis, Facts, Affidavit, Prayers, etc.) as separate sections so the drafter can
# # # #         generate content in the exact template format. Optionally pass template_file_signed_url for context."""
# # # #         char_count = len(template_text)
# # # #         word_count = len(template_text.split())

# # # #         url_context = ""
# # # #         if template_file_signed_url:
# # # #             url_context = f"""
# # # # TEMPLATE DOCUMENT URL (uploaded template for reference; use the extracted text below as the primary source):
# # # # {template_file_signed_url}
# # # # When extracting fields, consider that the template PDF may contain visual blanks, form fields, or empty lines—capture every such fillable spot as a field.
# # # # """

# # # #         prompt = f"""
# # # # You are analyzing a document template for a legal/court draft generator. Extract EVERY DISTINCT SECTION as a separate section so the drafter can generate content in the exact format of the template.

# # # # Document stats: {word_count} words, {char_count} characters

# # # # TEMPLATE CONTENT (extracted from the document):
# # # # \"\"\"{template_text}\"\"\"

# # # # SECTIONING RULES (STRICTLY FOLLOW):

# # # # 1. **ONE SECTION PER MAJOR CONTENT BLOCK**: Create a SEPARATE section for EACH distinct part of the document. Do NOT merge different parts into one section. Every heading, title block, or content area in the template must become its own section so the user-side drafter can generate the exact format (e.g. Case Title, Index, Annexure, Synopsis, Facts, Affidavit each as separate sections).

# # # # 2. **Legal / Court document examples – each of these should typically be its OWN section when present in the template**:
# # # #    - **Case/ matter**: Case Title, Court Name, Case Number, Cause Title, Index, List of Parties, List of Dates, Annexure/Annexures, Synopsis, Statement of Facts, Facts, Grounds, Submissions, Arguments, Prayer/Prayers, Affidavit, Verification, Signature block, Date/Place, etc.
# # # #    - **Contracts**: Title, Parties, Recitals, Definitions, Terms and Conditions, Payment Terms, Termination, Signatures, Schedules/Annexures (each schedule can be a section if substantial).
# # # #    - **Applications/Forms**: Form Title, Applicant Details, Subject, Body/Content, Declaration, Attachments, Signature, Date.

# # # # 3. **You MUST**:
# # # #    - Create as many sections as there are distinct headings or content blocks in the template (often 8–25+ for legal drafts). If the template has "Case Title", "Index", "Annexure", "Synopsis", "Facts", "Affidavit" — that is at least 6 separate sections.
# # # #    - Use the EXACT heading or title from the template as "section_name" (e.g. "Case Title", "Index", "Annexure", "Synopsis", "Statement of Facts", "Affidavit", "Prayers").
# # # #    - Only group items that are clearly a single block in the template (e.g. "Parties" with sub-fields stays one section; but "Synopsis" and "Facts" must be two sections).

# # # # 4. **Do NOT**:
# # # #    - Collapse multiple distinct parts (e.g. Synopsis + Facts + Affidavit) into one "Content" or "Main body" section.
# # # #    - Invent sections not present in the template.
# # # #    - Use vague names like "Section 1" or "Other" — use the actual heading from the template.

# # # # 5. **Field Extraction (CRITICAL)**:
# # # #    - Extract ALL variable/empty/fillable fields and assign each to the section where it appears.
# # # #    - Include: blank lines, [placeholders], {{variables}}, ________, "Insert X here", form fields, dates/amounts/names as placeholders, signature lines.
# # # #    - Give each field a unique "key" (snake_case). Each section's "fields" array must list every variable in that section.

# # # # 6. **Output Format**: Return ONLY valid JSON. No markdown blocks. No explanatory text.

# # # # REQUIRED JSON STRUCTURE:
# # # # {{
# # # #     "template_name": "Inferred Document Title",
# # # #     "total_sections": <number of sections — must match length of "sections" array>,
# # # #     "document_type": "Legal Draft|Contract|Petition|Application|Affidavit|etc",
# # # #     "estimated_draft_length": "Brief estimate when fully drafted",
# # # #     "all_fields": [
# # # #         {{
# # # #             "key": "unique_variable_snake_case_name",
# # # #             "type": "string|date|number|currency|address|boolean|email|phone|text_long|percentage",
# # # #             "label": "Human readable label",
# # # #             "required": true,
# # # #             "default_value": "Optional default",
# # # #             "validation_rules": "e.g., min length, max length, pattern",
# # # #             "description": "Detailed helper text",
# # # #             "section_id": "section_id where this field belongs"
# # # #         }}
# # # #     ],
# # # #     "sections": [
# # # #         {{
# # # #             "section_id": "unique_section_id_001",
# # # #             "section_name": "Exact heading from template (e.g. Case Title, Index, Annexure, Synopsis, Facts, Affidavit)",
# # # #             "section_purpose": "What this section is for and what content it will hold",
# # # #             "section_category": "case_title|index|annexure|synopsis|facts|grounds|affidavit|prayers|signatures|party_details|definitions|terms|other",
# # # #             "estimated_words": estimated word count when drafted,
# # # #             "depends_on": ["section_ids this depends on, if any"],
# # # #             "fields": [
# # # #                 {{
# # # #                     "key": "unique_variable_snake_case_name",
# # # #                     "type": "string|date|number|currency|address|boolean|email|phone|text_long|percentage",
# # # #                     "label": "Human readable label",
# # # #                     "required": true,
# # # #                     "default_value": "Optional default",
# # # #                     "validation_rules": "e.g., min length, max length, pattern",
# # # #                     "description": "Detailed helper text"
# # # #                 }}
# # # #             ]
# # # #         }}
# # # #     ]
# # # # }}

# # # # - "all_fields" = consolidated list of every field, each with "section_id" linking to its section.
# # # # - "sections" = ONE section per distinct part of the template. More sections (8–25+) is correct for legal drafts with Case Title, Index, Annexure, Synopsis, Facts, Affidavit, etc. Use exact names from the template.
# # # # """
        
# # # #         result = await self._call_gemini(prompt)
        
# # # #         # Post-processing: ensure all_fields exists (build from sections if missing)
# # # #         if 'sections' in result and 'all_fields' not in result:
# # # #             all_fields = []
# # # #             seen_keys = set()
# # # #             for sec in result['sections']:
# # # #                 sid = sec.get('section_id', '')
# # # #                 for f in sec.get('fields', []):
# # # #                     key = f.get('key')
# # # #                     if key and key not in seen_keys:
# # # #                         seen_keys.add(key)
# # # #                         all_fields.append({**f, 'section_id': sid})
# # # #             result['all_fields'] = all_fields
# # # #             print(f"DEBUG: Built all_fields from sections: {len(all_fields)} fields")
# # # #         elif result.get('all_fields'):
# # # #             print(f"DEBUG: all_fields present: {len(result['all_fields'])} fields")
        
# # # #         if 'sections' in result:
# # # #             actual_sections = len(result['sections'])
# # # #             print(f"DEBUG: Extracted {actual_sections} logical sections from {word_count} word document")
# # # #         return result

# # # #     async def generate_section_prompts(self, section_data: dict):
# # # #         """Phase 2 & 3: Section Processing & Prompt Generation. Master prompt must specify EXACT format and heading so drafter output matches template."""
# # # #         section_name = section_data.get("section_name", "Section")
# # # #         prompt = f"""
# # # # Analyze this section of a legal document template and generate a SINGLE, COMPREHENSIVE set of instructions (Master Prompt) so an AI can later generate this section in the EXACT format of the template.

# # # # SECTION DATA:
# # # # {json.dumps(section_data, indent=2)}

# # # # TASK:
# # # # 1. Create a "Master Prompt" that instructs the AI to draft ONLY this section, in the EXACT format and structure of the original template.
# # # # 2. The output must use the section's EXACT heading/title: "{section_name}". The generated content must start with or clearly reflect this heading (e.g. "SYNOPSIS", "FACTS", "AFFIDAVIT", "Case Title", "Index", "Annexure") so the final document matches the template structure.
# # # # 3. Specify: required layout (e.g. numbered list for Index, paragraphs for Facts, formal wording for Affidavit), legal tone, and how to plug in the variable fields: {json.dumps([f.get('key') for f in section_data.get('fields', [])])}.
# # # # 4. Target 200-1000+ words depending on section type (Index may be shorter; Facts/Affidavit can be longer).
# # # # 5. Return a strict JSON object with no markdown.

# # # # REQUIRED JSON STRUCTURE:
# # # # {{
# # # #     "section_intro": "Brief context: what this section is (e.g. 'This is the Synopsis section; it must appear under the heading SYNOPSIS and summarize the case in one block').",
# # # #     "drafting_complexity": "simple|moderate|complex",
# # # #     "estimated_output_words": Integer estimate when drafted,
# # # #     "field_prompts": [
# # # #         {{
# # # #             "field_id": "master_instruction",
# # # #             "prompt": "Step-by-step instructions so the drafter outputs in the EXACT format of this section:
# # # # - HEADING/FORMAT: Output must use the section title exactly as in the template: '{section_name}'. Do not invent a different heading.
# # # # - STRUCTURE: Describe the required structure (e.g. for Index: numbered list; for Synopsis: one or more paragraphs; for Affidavit: 'I, ... do hereby state...').
# # # # - LEGAL STYLE: Tone, terminology, and any mandatory phrases (e.g. 'Most Respectfully Submitted', verification language for affidavits).
# # # # - FIELDS TO INSERT: Integrate these variables naturally: {json.dumps([f.get('key') for f in section_data.get('fields', [])])}.
# # # # - LENGTH AND BOILERPLATE: Word range and standard clauses if any. The final output must be plain text only, no JSON, ready to be placed under the section heading '{section_name}' in the document."
# # # #         }}
# # # #     ],
# # # #     "dependencies": ["Section IDs this section references, if any"],
# # # #     "legal_references": ["Relevant laws or practices for this section type"]
# # # # }}
# # # # """
# # # #         return await self._call_gemini(prompt)

# # # #     async def validate_input(self, field_info: dict, user_input: str):
# # # #         """Phase 4 & 5: Validation & Error Recovery using Gemini"""
# # # #         prompt = f"""
# # # # Act as Antigravity validation system. Execute Phase 4 (Validation) and Phase 5 (Error Recovery) Protocol.

# # # # FIELD RULES: {json.dumps(field_info)}
# # # # USER INPUT: "{user_input}"

# # # # REQUIREMENTS:
# # # # - Check if input is valid according to field type and validation rules.
# # # # - Verify required fields are not empty.
# # # # - Check format constraints (e.g., email format, date format, number ranges).
# # # # - If invalid, generate a helpful, specific error prompt explaining the requirement.

# # # # OUTPUT: Strictly return JSON in one of these formats:
# # # # {{"valid": true}}
# # # # OR
# # # # {{"valid": false, "error_prompt": "Clear explanation of what's wrong and what's expected", "suggestion": "Optional helpful suggestion"}}
# # # # """
# # # #         return await self._call_gemini(prompt)
    
# # # #     async def generate_section_content(
# # # #         self,
# # # #         section_data: dict,
# # # #         field_values: dict,
# # # #         max_output_tokens: int = 65536,
# # # #         target_words_min: int = 200,
# # # #         target_words_max: int = 10000,
# # # #     ) -> str:
# # # #         """
# # # #         Generate actual section content based on master prompt and user inputs.
# # # #         Called when user generates draft (section-by-section). Supports long output for 500+ page drafts.
# # # #         Returns plain text only (no JSON).
# # # #         """
# # # #         section_name = section_data.get("section_name", "Section")
# # # #         section_intro = section_data.get("section_intro", "")
# # # #         section_prompts = section_data.get("section_prompts") or []
# # # #         master_instruction = ""
# # # #         for p in section_prompts:
# # # #             if isinstance(p, dict) and p.get("prompt"):
# # # #                 master_instruction = p.get("prompt", "")
# # # #                 break
# # # #             if isinstance(p, dict) and p.get("field_id") == "master_instruction":
# # # #                 master_instruction = p.get("prompt", "")
# # # #                 break

# # # #         prompt = f"""You are a legal document drafting AI. Generate content for this section in the EXACT format expected by the template.

# # # # SECTION NAME (use this exact heading/format in your output): {section_name}
# # # # SECTION PURPOSE: {section_data.get("section_purpose", "")}
# # # # SECTION INTRO / CONTEXT: {section_intro}

# # # # MASTER DRAFTING INSTRUCTIONS (follow exactly):
# # # # {master_instruction or "Generate professional legal content for this section, using the section name as the heading and the structure typical for this section type."}

# # # # USER PROVIDED VALUES (incorporate these naturally):
# # # # {json.dumps(field_values, indent=2)}

# # # # CRITICAL INSTRUCTIONS:
# # # # 1. OUTPUT FORMAT: Your output must match the exact format of the "{section_name}" section. If the template has sections like Case Title, Index, Annexure, Synopsis, Facts, Affidavit — each has a specific format; produce only the content for THIS section in that format (e.g. for "Synopsis" write synopsis text; for "Affidavit" use affidavit language and structure; for "Index" use a numbered list).
# # # # 2. HEADING: Start with or clearly reflect the section heading "{section_name}" where appropriate (e.g. "SYNOPSIS", "FACTS", "AFFIDAVIT", "Case Title") so the final document structure matches the template.
# # # # 3. Length: {target_words_min}-{target_words_max} words (or more for complex sections). Follow the master instructions for structure and tone.
# # # # 4. Incorporate ALL provided field values naturally. Use proper legal formatting, numbering, and boilerplate as in the master instructions.
# # # # 5. Output MUST be plain text only: no JSON, no markdown, no extra "Section:" or meta labels — just the drafted content for this section, ready to be placed in the document under "{section_name}".

# # # # Return ONLY the drafted section content as plain text."""

# # # #         return await self._call_gemini_plain_text(
# # # #             prompt,
# # # #             max_output_tokens=max_output_tokens,
# # # #             timeout_sec=600.0,
# # # #         )


# # # from google import genai

# # # try:
# # #     import google.adk as adk
# # # except ImportError:
# # #     adk = None

# # # import json
# # # import re
# # # import asyncio
# # # from typing import Optional, List, Dict, Any
# # # from ..config import settings


# # # # ---------------------------------------------------------------------------
# # # # Known legal template structures – used as hints so the LLM correctly
# # # # splits templates into the right number of sections even when headings
# # # # are implicit or abbreviated.
# # # # ---------------------------------------------------------------------------
# # # TEMPLATE_STRUCTURES: Dict[str, List[Dict[str, str]]] = {
# # #     "writ_petition": [
# # #         {
# # #             "section_id": "cover_page",
# # #             "section_name": "Cover Page / Paper Book",
# # #             "section_category": "cover_page",
# # #             "description": "Cover page with court name, case number, parties, and filing details.",
# # #         },
# # #         {
# # #             "section_id": "index",
# # #             "section_name": "Index",
# # #             "section_category": "index",
# # #             "description": "Table listing serial numbers, particulars (Synopsis, Petition, Annexures, Applications), and page numbers.",
# # #         },
# # #         {
# # #             "section_id": "synopsis_and_list_of_dates",
# # #             "section_name": "Synopsis and List of Dates",
# # #             "section_category": "synopsis",
# # #             "description": "Brief synopsis of the case followed by a chronological list of material dates and events.",
# # #         },
# # #         {
# # #             "section_id": "cause_title",
# # #             "section_name": "Cause Title",
# # #             "section_category": "case_title",
# # #             "description": "Full cause title: court name, jurisdiction, petition number, petitioner(s) vs respondent(s), article under which petition is filed, and the nature of writ sought.",
# # #         },
# # #         {
# # #             "section_id": "facts_of_the_case",
# # #             "section_name": "Facts of the Case",
# # #             "section_category": "facts",
# # #             "description": "Detailed numbered paragraphs setting out the factual background. Begins after 'MOST RESPECTFULLY SHEWETH'.",
# # #         },
# # #         {
# # #             "section_id": "questions_of_law",
# # #             "section_name": "Question(s) of Law",
# # #             "section_category": "grounds",
# # #             "description": "The specific legal questions / issues raised for determination.",
# # #         },
# # #         {
# # #             "section_id": "grounds",
# # #             "section_name": "Grounds",
# # #             "section_category": "grounds",
# # #             "description": "Numbered grounds on which the writ is sought, citing constitutional provisions, statutes, and case law.",
# # #         },
# # #         {
# # #             "section_id": "averment",
# # #             "section_name": "Averment",
# # #             "section_category": "averment",
# # #             "description": "Standard averment that no other petition has been filed on the same subject matter in any High Court or the Supreme Court.",
# # #         },
# # #         {
# # #             "section_id": "prayer",
# # #             "section_name": "Prayer",
# # #             "section_category": "prayers",
# # #             "description": "Numbered prayer clauses requesting specific reliefs, ending with the standard 'FOR WHICH ACT OF KINDNESS…' clause.",
# # #         },
# # #         {
# # #             "section_id": "filing_details",
# # #             "section_name": "Filing Details",
# # #             "section_category": "signatures",
# # #             "description": "Filed By, Drawn by, Filed On, Advocate / Petitioner-in-Person details.",
# # #         },
# # #         {
# # #             "section_id": "affidavit",
# # #             "section_name": "Affidavit in Support",
# # #             "section_category": "affidavit",
# # #             "description": "Affidavit of the petitioner duly sworn in support of the writ petition, with verification.",
# # #         },
# # #         {
# # #             "section_id": "annexures",
# # #             "section_name": "Annexures",
# # #             "section_category": "annexure",
# # #             "description": "Supporting documents annexed to the petition, each labelled (Annexure P-1, P-2, …).",
# # #         },
# # #     ],
# # # }


# # # class AntigravityAgent:
# # #     """Gemini-powered agent for analysing legal templates and generating
# # #     section-by-section drafts that faithfully reproduce the template format."""

# # #     def __init__(self):
# # #         self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
# # #         self.model_name = settings.GEMINI_MODEL  # e.g. gemini-2.5-pro

# # #     # ------------------------------------------------------------------
# # #     # Internal helpers
# # #     # ------------------------------------------------------------------

# # #     async def _call_gemini(self, prompt: str, max_output_tokens: int = 8192) -> dict:
# # #         """Call Gemini expecting a JSON response. Handles markdown fences,
# # #         trailing commas, invalid escapes, and other common LLM JSON issues."""
# # #         print(f"DEBUG: Calling Gemini model {self.model_name} (JSON mode)…")
# # #         try:
# # #             response = await asyncio.wait_for(
# # #                 self.client.aio.models.generate_content(
# # #                     model=self.model_name,
# # #                     contents=prompt,
# # #                     config={
# # #                         "response_mime_type": "application/json",
# # #                         "max_output_tokens": max_output_tokens,
# # #                         "temperature": 0.1,
# # #                     },
# # #                 ),
# # #                 timeout=180.0,
# # #             )
# # #             print("DEBUG: Gemini JSON response received.")
# # #         except asyncio.TimeoutError:
# # #             raise ValueError("Gemini AI analysis timed out (180 s). Please try again.")
# # #         except Exception as e:
# # #             print(f"DEBUG: Gemini call failed: {e}")
# # #             raise

# # #         text = (response.text or "").strip()
# # #         clean = self._extract_json(text)

# # #         try:
# # #             return json.loads(clean)
# # #         except json.JSONDecodeError as exc:
# # #             # One retry: ask Gemini to fix its own output
# # #             print(f"JSON parse error: {exc}. Attempting auto-fix…")
# # #             return await self._auto_fix_json(clean)

# # #     async def _call_gemini_plain_text(
# # #         self,
# # #         prompt: str,
# # #         max_output_tokens: int = 65536,
# # #         timeout_sec: float = 300.0,
# # #     ) -> str:
# # #         """Call Gemini for plain-text generation (no JSON)."""
# # #         print(f"DEBUG: Calling Gemini (plain text, max_tokens={max_output_tokens})…")
# # #         try:
# # #             response = await asyncio.wait_for(
# # #                 self.client.aio.models.generate_content(
# # #                     model=self.model_name,
# # #                     contents=prompt,
# # #                     config={
# # #                         "max_output_tokens": min(max_output_tokens, 65536),
# # #                         "temperature": 0.2,
# # #                     },
# # #                 ),
# # #                 timeout=timeout_sec,
# # #             )
# # #             return (response.text or "").strip()
# # #         except asyncio.TimeoutError:
# # #             raise ValueError(f"Generation timed out after {timeout_sec}s.")
# # #         except Exception as e:
# # #             print(f"DEBUG: Gemini call failed: {e}")
# # #             raise

# # #     # ------------------------------------------------------------------
# # #     # JSON cleaning / extraction
# # #     # ------------------------------------------------------------------

# # #     @staticmethod
# # #     def _extract_json(text: str) -> str:
# # #         """Extract and clean JSON from Gemini output."""
# # #         # Try markdown code block first
# # #         m = re.search(r"```(?:json)?\s*\n?(\{[\s\S]*?\})\s*\n?```", text)
# # #         if m:
# # #             raw = m.group(1)
# # #         else:
# # #             # Find outermost { … }
# # #             m = re.search(r"(\{[\s\S]*\})", text)
# # #             raw = m.group(1) if m else text

# # #         # Trailing commas before } or ]
# # #         raw = re.sub(r",\s*([\]}])", r"\1", raw)
# # #         # Control characters
# # #         raw = re.sub(r"[\x00-\x1F\x7F]", "", raw)
# # #         # Invalid backslash escapes
# # #         raw = re.sub(r'\\(?!["\\/bfnrt])(?!u[0-9a-fA-F]{4})', r"\\\\", raw)
# # #         return raw

# # #     async def _auto_fix_json(self, broken: str) -> dict:
# # #         """Ask Gemini to repair broken JSON once."""
# # #         fix_prompt = (
# # #             "The following text was supposed to be valid JSON but has syntax errors. "
# # #             "Return ONLY the corrected JSON with no explanation or markdown.\n\n"
# # #             f"{broken[:12000]}"
# # #         )
# # #         response = await asyncio.wait_for(
# # #             self.client.aio.models.generate_content(
# # #                 model=self.model_name,
# # #                 contents=fix_prompt,
# # #                 config={"response_mime_type": "application/json", "max_output_tokens": 8192, "temperature": 0.0},
# # #             ),
# # #             timeout=60.0,
# # #         )
# # #         fixed = self._extract_json((response.text or "").strip())
# # #         return json.loads(fixed)  # let it raise if still broken

# # #     # ------------------------------------------------------------------
# # #     # Phase 1 – Template analysis & field extraction
# # #     # ------------------------------------------------------------------

# # #     async def analyze_template(
# # #         self,
# # #         template_text: str,
# # #         template_file_signed_url: Optional[str] = None,
# # #     ) -> dict:
# # #         """Analyse a legal template and extract every distinct section with
# # #         its fields. Returns a structured JSON ready for the frontend."""

# # #         char_count = len(template_text)
# # #         word_count = len(template_text.split())

# # #         # Detect template type heuristically so we can inject structure hints
# # #         template_type_hint = self._detect_template_type(template_text)
# # #         structure_hint = ""
# # #         if template_type_hint and template_type_hint in TEMPLATE_STRUCTURES:
# # #             hint_sections = TEMPLATE_STRUCTURES[template_type_hint]
# # #             structure_hint = (
# # #                 "\n\nTEMPLATE TYPE DETECTED: "
# # #                 + template_type_hint.replace("_", " ").title()
# # #                 + "\nExpected sections (use these as a guide — include ALL that are present "
# # #                 "in the template text, and add any additional sections found in the text):\n"
# # #                 + json.dumps(hint_sections, indent=2)
# # #                 + "\n"
# # #             )

# # #         url_context = ""
# # #         if template_file_signed_url:
# # #             url_context = (
# # #                 f"\nTEMPLATE DOCUMENT URL (for reference): {template_file_signed_url}\n"
# # #                 "When extracting fields, consider that the template PDF may contain "
# # #                 "visual blanks, form fields, or empty lines — capture every such "
# # #                 "fillable spot as a field.\n"
# # #             )

# # #         prompt = f"""You are analysing a legal/court document template to extract EVERY DISTINCT SECTION so a drafter can later generate content section-by-section in the EXACT format of the template.

# # # Document stats: {word_count} words, {char_count} characters
# # # {url_context}{structure_hint}

# # # TEMPLATE CONTENT (extracted from document):
# # # \"\"\"{template_text}\"\"\"

# # # ─────────────────────────────────────────────────
# # # STRICT SECTIONING RULES
# # # ─────────────────────────────────────────────────

# # # 1. **ONE SECTION PER DISTINCT CONTENT BLOCK.** Never merge different parts (e.g. Synopsis + Facts + Affidavit) into one catch-all section.

# # # 2. **Use the EXACT heading / title from the template as "section_name".**
# # #    Examples: "Cover Page / Paper Book", "Index", "Synopsis and List of Dates",
# # #    "Cause Title", "Facts of the Case", "Question(s) of Law", "Grounds",
# # #    "Averment", "Prayer", "Filing Details", "Affidavit in Support", "Annexures".

# # # 3. **Preserve template ordering.** The "order" field must reflect the order
# # #    the section appears in the template (1-based).

# # # 4. **Field extraction (CRITICAL):**
# # #    • Every blank (________), placeholder ([…], {{{{…}}}}), date/amount/name slot,
# # #      and form field becomes a field.
# # #    • Give each field a unique snake_case "key".
# # #    • Assign each field to the section where it appears ("section_id").

# # # 5. Do NOT invent sections that are not present in the template.

# # # 6. Return ONLY valid JSON. No markdown code fences. No explanation text.

# # # ─────────────────────────────────────────────────
# # # REQUIRED JSON STRUCTURE
# # # ─────────────────────────────────────────────────
# # # {{
# # #   "template_name": "Inferred Document Title",
# # #   "document_type": "Writ Petition|Contract|Application|Affidavit|…",
# # #   "total_sections": <int>,
# # #   "estimated_draft_length": "e.g. 15-30 pages when fully drafted",
# # #   "all_fields": [
# # #     {{
# # #       "key": "snake_case_name",
# # #       "type": "string|date|number|currency|address|boolean|email|phone|text_long|percentage",
# # #       "label": "Human-readable label",
# # #       "required": true,
# # #       "default_value": "",
# # #       "validation_rules": "",
# # #       "description": "Helper text for the user",
# # #       "section_id": "matching section_id"
# # #     }}
# # #   ],
# # #   "sections": [
# # #     {{
# # #       "section_id": "unique_snake_case_id",
# # #       "section_name": "Exact heading from template",
# # #       "section_purpose": "What this section covers",
# # #       "section_category": "cover_page|index|synopsis|case_title|facts|grounds|averment|prayers|signatures|affidavit|annexure|other",
# # #       "order": 1,
# # #       "estimated_words": 200,
# # #       "depends_on": [],
# # #       "format_instructions": "Describe the required layout: numbered list, paragraphs, table, etc.",
# # #       "boilerplate_text": "Any fixed/standard wording that MUST appear verbatim in this section",
# # #       "fields": [
# # #         {{
# # #           "key": "snake_case_name",
# # #           "type": "string",
# # #           "label": "Label",
# # #           "required": true,
# # #           "default_value": "",
# # #           "validation_rules": "",
# # #           "description": ""
# # #         }}
# # #       ]
# # #     }}
# # #   ]
# # # }}
# # # """

# # #         result = await self._call_gemini(prompt, max_output_tokens=16384)

# # #         # ---------- post-processing ----------
# # #         # Build all_fields from sections if missing
# # #         if "sections" in result and "all_fields" not in result:
# # #             result["all_fields"] = self._build_all_fields(result["sections"])

# # #         # Ensure every section has an "order" key
# # #         for idx, sec in enumerate(result.get("sections", []), start=1):
# # #             sec.setdefault("order", idx)

# # #         # Sort sections by order
# # #         result["sections"] = sorted(result.get("sections", []), key=lambda s: s.get("order", 0))
# # #         result["total_sections"] = len(result.get("sections", []))

# # #         print(
# # #             f"DEBUG: Extracted {result['total_sections']} sections from "
# # #             f"{word_count}-word template ({result.get('document_type', 'Unknown')})"
# # #         )
# # #         return result

# # #     # ------------------------------------------------------------------
# # #     # Phase 2 / 3 – Prompt generation per section
# # #     # ------------------------------------------------------------------

# # #     async def generate_section_prompts(self, section_data: dict) -> dict:
# # #         """Generate a master drafting prompt for one section so the drafter
# # #         can later produce content in the exact format of the template."""

# # #         section_name = section_data.get("section_name", "Section")
# # #         field_keys = [f.get("key") for f in section_data.get("fields", [])]
# # #         format_instructions = section_data.get("format_instructions", "")
# # #         boilerplate = section_data.get("boilerplate_text", "")

# # #         prompt = f"""Analyse this section of a legal document template and produce a SINGLE comprehensive "Master Prompt" — a set of instructions so an AI drafter can later generate this section in the EXACT format of the original template.

# # # SECTION DATA:
# # # {json.dumps(section_data, indent=2)}

# # # RULES:
# # # 1. The Master Prompt must instruct the drafter to output ONLY this section, starting with the exact heading "{section_name}".
# # # 2. Describe the required FORMAT precisely:
# # #    {"- " + format_instructions if format_instructions else "- Infer the format from the section category (e.g. numbered list for Index, paragraphs for Facts, formal affidavit language, etc.)"}
# # # 3. If the template contains BOILERPLATE (fixed wording), the Master Prompt must tell the drafter to reproduce it verbatim:
# # #    {boilerplate or "(none detected)"}
# # # 4. List every field ({json.dumps(field_keys)}) and explain how to weave them into the text naturally.
# # # 5. Specify legal tone, mandatory phrases, and any closing lines (e.g. "FOR WHICH ACT OF KINDNESS…", verification clause, etc.).

# # # Return ONLY a valid JSON object (no markdown):
# # # {{
# # #   "section_intro": "Brief context about this section",
# # #   "drafting_complexity": "simple|moderate|complex",
# # #   "estimated_output_words": <int>,
# # #   "field_prompts": [
# # #     {{
# # #       "field_id": "master_instruction",
# # #       "prompt": "<full multi-line drafting instructions>"
# # #     }}
# # #   ],
# # #   "dependencies": ["section_ids this references"],
# # #   "legal_references": ["Relevant laws/provisions"]
# # # }}
# # # """
# # #         return await self._call_gemini(prompt)

# # #     # ------------------------------------------------------------------
# # #     # Phase 4 / 5 – Validation
# # #     # ------------------------------------------------------------------

# # #     async def validate_input(self, field_info: dict, user_input: str) -> dict:
# # #         prompt = f"""You are a legal-document validation system.

# # # FIELD RULES: {json.dumps(field_info)}
# # # USER INPUT: \"{user_input}\"

# # # Check validity against type, format, and validation rules.
# # # Return ONLY one of:
# # # {{"valid": true}}
# # # OR
# # # {{"valid": false, "error_prompt": "What is wrong", "suggestion": "How to fix"}}
# # # """
# # #         return await self._call_gemini(prompt)

# # #     # ------------------------------------------------------------------
# # #     # Phase 6 – Section content generation
# # #     # ------------------------------------------------------------------

# # #     async def generate_section_content(
# # #         self,
# # #         section_data: dict,
# # #         field_values: dict,
# # #         max_output_tokens: int = 65536,
# # #         target_words_min: int = 200,
# # #         target_words_max: int = 10000,
# # #     ) -> str:
# # #         """Generate the actual drafted text for one section.

# # #         The output is plain text (no JSON) formatted exactly as the section
# # #         should appear in the final document."""

# # #         section_name = section_data.get("section_name", "Section")
# # #         section_category = section_data.get("section_category", "other")
# # #         format_instructions = section_data.get("format_instructions", "")
# # #         boilerplate = section_data.get("boilerplate_text", "")

# # #         # Extract master instruction from prompts
# # #         master_instruction = ""
# # #         for p in section_data.get("section_prompts") or section_data.get("field_prompts") or []:
# # #             if isinstance(p, dict):
# # #                 master_instruction = p.get("prompt", "")
# # #                 if master_instruction:
# # #                     break

# # #         # Build category-specific formatting guidance
# # #         category_guidance = self._get_category_guidance(section_category, section_name)

# # #         prompt = f"""You are a legal document drafting AI. Generate content for the section described below.
# # # The output must be in the EXACT format expected by the template — it will be placed directly into the final document.

# # # ═══════════════════════════════════════════════
# # # SECTION: {section_name}
# # # CATEGORY: {section_category}
# # # PURPOSE: {section_data.get("section_purpose", "")}
# # # ═══════════════════════════════════════════════

# # # FORMAT INSTRUCTIONS (follow precisely):
# # # {format_instructions or category_guidance}

# # # BOILERPLATE (reproduce verbatim where indicated):
# # # {boilerplate or "(none)"}

# # # MASTER DRAFTING INSTRUCTIONS:
# # # {master_instruction or category_guidance}

# # # USER-PROVIDED VALUES (incorporate naturally):
# # # {json.dumps(field_values, indent=2)}

# # # ═══════════════════════════════════════════════
# # # CRITICAL RULES
# # # ═══════════════════════════════════════════════
# # # 1. Start with the heading "{section_name}" (or the conventional heading for this section type, e.g. "PRAYER", "SYNOPSIS AND LIST OF DATES", "I N D E X").
# # # 2. Match the exact layout:
# # #    - Index → numbered table with Sl. No., Particulars, Pages columns.
# # #    - Synopsis → narrative paragraph(s) followed by a date-event table.
# # #    - Cause Title → centred court name, jurisdiction line, case no., parties block, article/writ line, and "To … The Humble petition …" opening.
# # #    - Facts → numbered paragraphs after "MOST RESPECTFULLY SHEWETH :".
# # #    - Questions of Law → numbered legal questions.
# # #    - Grounds → numbered grounds with sub-paragraphs.
# # #    - Averment → standard non-filing averment paragraph.
# # #    - Prayer → numbered prayer clauses ending with "FOR WHICH ACT OF KINDNESS …".
# # #    - Filing Details → "FILED BY:", "DRAWN:", "FILED ON:" block.
# # #    - Affidavit → formal affidavit with verification clause.
# # #    - Cover Page → centred court info, case number, parties, "PAPER - BOOK", filing line.
# # #    - Annexures → labelled supporting documents (Annexure P-1, P-2, …).
# # # 3. Use ALL provided field values. If a value is missing, leave a placeholder like "[________]".
# # # 4. Legal tone: formal, third-person (except affidavit which is first-person).
# # # 5. Length: {target_words_min}–{target_words_max} words (adjust to section type).
# # # 6. Output MUST be plain text ONLY — no JSON, no markdown fences, no meta labels.

# # # Return ONLY the drafted section content as plain text."""

# # #         return await self._call_gemini_plain_text(
# # #             prompt,
# # #             max_output_tokens=max_output_tokens,
# # #             timeout_sec=600.0,
# # #         )

# # #     # ------------------------------------------------------------------
# # #     # Assemble full draft from individually generated sections
# # #     # ------------------------------------------------------------------

# # #     async def assemble_full_draft(
# # #         self,
# # #         analysis_result: dict,
# # #         section_prompts: Dict[str, dict],
# # #         field_values: dict,
# # #     ) -> str:
# # #         """Generate all sections in order and concatenate them into a single
# # #         draft document. `field_values` is a flat dict of all user-provided
# # #         values keyed by field key."""

# # #         sections = sorted(
# # #             analysis_result.get("sections", []),
# # #             key=lambda s: s.get("order", 0),
# # #         )

# # #         draft_parts: List[str] = []

# # #         for sec in sections:
# # #             sid = sec.get("section_id", "")
# # #             # Merge section analysis data with its generated prompts
# # #             merged = {**sec}
# # #             if sid in section_prompts:
# # #                 merged.update(section_prompts[sid])

# # #             # Filter field_values to only those relevant to this section
# # #             section_field_keys = {f.get("key") for f in sec.get("fields", [])}
# # #             section_values = {
# # #                 k: v for k, v in field_values.items() if k in section_field_keys
# # #             }
# # #             # Also pass ALL values so cross-section references work
# # #             section_values_full = {**field_values}

# # #             print(f"DEBUG: Generating section '{sec.get('section_name')}'…")
# # #             content = await self.generate_section_content(
# # #                 section_data=merged,
# # #                 field_values=section_values_full,
# # #             )
# # #             draft_parts.append(content)

# # #         # Join with page-break markers
# # #         separator = "\n\n" + "=" * 72 + "\n\n"
# # #         full_draft = separator.join(draft_parts)
# # #         print(f"DEBUG: Full draft assembled — {len(full_draft)} chars, {len(full_draft.split())} words.")
# # #         return full_draft

# # #     # ------------------------------------------------------------------
# # #     # Private helpers
# # #     # ------------------------------------------------------------------

# # #     @staticmethod
# # #     def _detect_template_type(text: str) -> Optional[str]:
# # #         """Heuristically detect the template type from its content."""
# # #         lower = text.lower()
# # #         if "writ petition" in lower:
# # #             return "writ_petition"
# # #         if "special leave petition" in lower or "slp" in lower:
# # #             return "writ_petition"  # similar structure
# # #         # Add more detections as needed
# # #         if "agreement" in lower and ("party" in lower or "parties" in lower):
# # #             return "contract"
# # #         return None

# # #     @staticmethod
# # #     def _build_all_fields(sections: list) -> list:
# # #         all_fields = []
# # #         seen = set()
# # #         for sec in sections:
# # #             sid = sec.get("section_id", "")
# # #             for f in sec.get("fields", []):
# # #                 key = f.get("key")
# # #                 if key and key not in seen:
# # #                     seen.add(key)
# # #                     all_fields.append({**f, "section_id": sid})
# # #         return all_fields

# # #     @staticmethod
# # #     def _get_category_guidance(category: str, section_name: str) -> str:
# # #         """Return format guidance for known section categories."""
# # #         guidance = {
# # #             "cover_page": (
# # #                 "Centred layout. Court name in capitals, jurisdiction line, case number "
# # #                 "with blank, parties block (Petitioner vs Respondent), 'PAPER - BOOK', "
# # #                 "'FOR INDEX KINDLY SEE INSIDE', Filed By / Filed On at bottom."
# # #             ),
# # #             "index": (
# # #                 "Table with three columns: Sl. No., PARTICULARS, PAGES. "
# # #                 "Rows: 1. Synopsis and List of Dates, 2. Writ Petition with Affidavit, "
# # #                 "3. Annexures, 4. Application if any. Use a ruled/bordered table."
# # #             ),
# # #             "synopsis": (
# # #                 "Start with heading 'SYNOPSIS AND LIST OF DATES'. Write a concise "
# # #                 "narrative synopsis of the case (2-5 paragraphs). Then a chronological "
# # #                 "table: DATE | EVENT. Cover all material dates."
# # #             ),
# # #             "case_title": (
# # #                 "Centred court name ('IN THE SUPREME COURT OF INDIA'), 'ORIGINAL "
# # #                 "JURISDICTION', 'CIVIL WRIT PETITION NO. ___ OF ___', parties block "
# # #                 "with '…..Petitioner' and '….Respondents', 'PETITION UNDER ARTICLE ___ "
# # #                 "OF THE CONSTITUTION OF INDIA FOR ISSUANCE OF A WRIT IN THE NATURE OF "
# # #                 "___ UNDER ARTICLE ___ OF THE CONSTITUTION OF INDIA.', followed by "
# # #                 "'To\\nHon'ble The Chief Justice of India …\\nThe Humble petition of "
# # #                 "the Petitioner abovenamed.'"
# # #             ),
# # #             "facts": (
# # #                 "Start with 'MOST RESPECTFULLY SHEWETH :\\n'. Then numbered paragraphs "
# # #                 "(1., 2., 3., …) setting out the facts in formal legal language."
# # #             ),
# # #             "grounds": (
# # #                 "Heading 'GROUNDS'. Numbered grounds (a), (b), (c)… or I, II, III… "
# # #                 "Each ground is a paragraph citing constitutional/legal provisions."
# # #             ),
# # #             "averment": (
# # #                 "Standard averment paragraph: 'That the present petitioner has not "
# # #                 "filed any other petition in any High Court or the Supreme Court of "
# # #                 "India on the subject matter of the present petition.'"
# # #             ),
# # #             "prayers": (
# # #                 "Heading 'PRAYER'. Opening line: 'In the above premises, it is prayed "
# # #                 "that this Hon\\'ble Court may be pleased:'. Numbered prayer clauses "
# # #                 "(i), (ii), … ending with '…to pass such other orders and further "
# # #                 "orders as may be deemed necessary on the facts and in the "
# # #                 "circumstances of the case.' Close with: 'FOR WHICH ACT OF KINDNESS, "
# # #                 "THE PETITIONER SHALL AS IN DUTY BOUND, EVER PRAY.'"
# # #             ),
# # #             "signatures": (
# # #                 "'FILED BY:\\n[Advocate name / PETITIONER-IN-PERSON]\\n"
# # #                 "DRAWN:\\n[date or blank]\\nFILED ON:\\n[date]'"
# # #             ),
# # #             "affidavit": (
# # #                 "Heading 'AFFIDAVIT'. 'I, [name], [s/o / d/o / w/o] [parent/spouse], "
# # #                 "aged [age], residing at [address], do hereby solemnly affirm and "
# # #                 "state as under:' Numbered paragraphs. Close with VERIFICATION clause: "
# # #                 "'Verified at [place] on this [date] that the contents of the above "
# # #                 "affidavit are true and correct to my knowledge…' DEPONENT signature."
# # #             ),
# # #             "annexure": (
# # #                 "Each annexure labelled 'ANNEXURE P-1', 'ANNEXURE P-2', etc. "
# # #                 "with a brief description of the document and a placeholder for "
# # #                 "the actual document content."
# # #             ),
# # #         }
# # #         return guidance.get(category, f"Generate professional legal content for '{section_name}' using standard legal formatting.")


# # from google import genai

# # try:
# #     import google.adk as adk
# # except ImportError:
# #     adk = None

# # import json
# # import re
# # import asyncio
# # import math
# # from typing import Optional, List, Dict, Any, Tuple
# # from ..config import settings


# # # ═══════════════════════════════════════════════════════════════════════════════
# # # ALIGNMENT TYPES — every line in a template is classified into one of these.
# # # These are NEVER hardcoded per template — they are computed dynamically from
# # # the indent / position data extracted from the uploaded PDF.
# # # ═══════════════════════════════════════════════════════════════════════════════

# # class Align:
# #     CENTER = "CENTER"
# #     LEFT = "LEFT"
# #     LEFT_INDENT = "LEFT_INDENT"
# #     LEFT_INDENT_MORE = "LEFT_INDENT_MORE"
# #     RIGHT = "RIGHT"
# #     TABLE_ROW = "TABLE_ROW"
# #     SEPARATOR = "SEPARATOR"
# #     BLANK = "BLANK"


# # class AntigravityAgent:
# #     """Gemini-powered agent for analysing **any** legal template and generating
# #     section-by-section drafts that faithfully reproduce the template's exact
# #     layout, alignment, and formatting.

# #     NOTHING is hardcoded for a specific template type. All structure, sections,
# #     fields, alignment patterns, and boilerplate are extracted dynamically from
# #     the uploaded template via layout analysis + LLM."""

# #     def __init__(self):
# #         self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
# #         self.model_name = settings.GEMINI_MODEL

# #     # ══════════════════════════════════════════════════════════════════════
# #     #  GEMINI COMMUNICATION
# #     # ══════════════════════════════════════════════════════════════════════

# #     async def _call_gemini(self, prompt: str, max_output_tokens: int = 8192) -> dict:
# #         """Call Gemini expecting JSON. Cleans and parses the response."""
# #         print(f"DEBUG: Calling Gemini ({self.model_name}, JSON, max_tokens={max_output_tokens})…")
# #         try:
# #             response = await asyncio.wait_for(
# #                 self.client.aio.models.generate_content(
# #                     model=self.model_name,
# #                     contents=prompt,
# #                     config={
# #                         "response_mime_type": "application/json",
# #                         "max_output_tokens": max_output_tokens,
# #                         "temperature": 0.1,
# #                     },
# #                 ),
# #                 timeout=180.0,
# #             )
# #         except asyncio.TimeoutError:
# #             raise ValueError("Gemini timed out (180s). Please retry.")
# #         except Exception as e:
# #             print(f"DEBUG: Gemini call failed: {e}")
# #             raise

# #         text = (response.text or "").strip()
# #         clean = self._extract_json(text)
# #         try:
# #             return json.loads(clean)
# #         except json.JSONDecodeError:
# #             return await self._auto_fix_json(clean)

# #     async def _call_gemini_plain_text(
# #         self, prompt: str, max_output_tokens: int = 65536, timeout_sec: float = 300.0,
# #     ) -> str:
# #         """Call Gemini for plain-text output (no JSON)."""
# #         print(f"DEBUG: Calling Gemini (plain text, max_tokens={max_output_tokens})…")
# #         try:
# #             response = await asyncio.wait_for(
# #                 self.client.aio.models.generate_content(
# #                     model=self.model_name,
# #                     contents=prompt,
# #                     config={
# #                         "max_output_tokens": min(max_output_tokens, 65536),
# #                         "temperature": 0.2,
# #                     },
# #                 ),
# #                 timeout=timeout_sec,
# #             )
# #             return (response.text or "").strip()
# #         except asyncio.TimeoutError:
# #             raise ValueError(f"Generation timed out ({timeout_sec}s).")
# #         except Exception as e:
# #             print(f"DEBUG: Gemini call failed: {e}")
# #             raise

# #     # ──────────────────────────────────────────────────────────────────────
# #     #  JSON helpers
# #     # ──────────────────────────────────────────────────────────────────────

# #     @staticmethod
# #     def _extract_json(text: str) -> str:
# #         m = re.search(r"```(?:json)?\s*\n?(\{[\s\S]*?\})\s*\n?```", text)
# #         raw = m.group(1) if m else (re.search(r"(\{[\s\S]*\})", text) or type("X", (), {"group": lambda s, i: text})()).group(1)
# #         raw = re.sub(r",\s*([\]}])", r"\1", raw)
# #         raw = re.sub(r"[\x00-\x1F\x7F]", "", raw)
# #         raw = re.sub(r'\\(?!["\\/bfnrt])(?!u[0-9a-fA-F]{4})', r"\\\\", raw)
# #         return raw

# #     async def _auto_fix_json(self, broken: str) -> dict:
# #         fix_prompt = (
# #             "Fix the JSON syntax errors below. Return ONLY valid JSON, "
# #             "no markdown, no explanation.\n\n" + broken[:12000]
# #         )
# #         resp = await asyncio.wait_for(
# #             self.client.aio.models.generate_content(
# #                 model=self.model_name,
# #                 contents=fix_prompt,
# #                 config={"response_mime_type": "application/json", "max_output_tokens": 8192, "temperature": 0.0},
# #             ),
# #             timeout=60.0,
# #         )
# #         return json.loads(self._extract_json((resp.text or "").strip()))

# #     # ══════════════════════════════════════════════════════════════════════
# #     #  DYNAMIC LAYOUT ANALYSIS — works on ANY template
# #     # ══════════════════════════════════════════════════════════════════════

# #     @staticmethod
# #     def _compute_page_metrics(template_text: str) -> Dict[str, Any]:
# #         """Scan every line of the extracted text and compute dynamic thresholds
# #         for alignment classification. Returns metrics dict used by the
# #         classifier — no hardcoded numbers for any specific template."""

# #         all_indents: List[int] = []
# #         all_ends: List[int] = []
# #         all_lengths: List[int] = []

# #         for line in template_text.split("\n"):
# #             if not line.strip():
# #                 continue
# #             rstripped = line.rstrip()
# #             leading = len(rstripped) - len(rstripped.lstrip())
# #             text_len = len(rstripped.strip())
# #             end_pos = leading + text_len

# #             all_indents.append(leading)
# #             all_ends.append(end_pos)
# #             all_lengths.append(text_len)

# #         if not all_indents:
# #             return {"page_width": 80, "std_indent": 0, "deep_indent": 10, "right_zone_start": 50}

# #         page_width = max(all_ends) if all_ends else 80

# #         # Find the most common non-zero indent — this is the "standard body indent"
# #         from collections import Counter
# #         indent_counts = Counter(i for i in all_indents if i > 0)
# #         std_indent = indent_counts.most_common(1)[0][0] if indent_counts else 0

# #         # Deep indent = next cluster of indents significantly above std_indent.
# #         # We require at least std_indent + 5 gap so that off-by-one lines
# #         # (e.g. indent=16 when std=15) don't get treated as "deep".
# #         min_deep = std_indent + max(5, int(std_indent * 0.4))
# #         deeper_indents = {i: c for i, c in indent_counts.items() if i >= min_deep}
# #         if deeper_indents:
# #             # Pick the most common deep indent
# #             deep_indent = max(deeper_indents, key=deeper_indents.get)
# #         else:
# #             deep_indent = std_indent + 10

# #         # Right zone: lines that start past the midpoint of the page
# #         right_zone_start = page_width * 0.50

# #         return {
# #             "page_width": page_width,
# #             "std_indent": std_indent,
# #             "deep_indent": deep_indent,
# #             "right_zone_start": right_zone_start,
# #         }

# #     @staticmethod
# #     def _classify_line(
# #         line: str, metrics: Dict[str, Any]
# #     ) -> Tuple[str, str, int]:
# #         """Classify a single line's alignment using the dynamically computed
# #         metrics. Returns (alignment, stripped_text, indent)."""

# #         stripped_text = line.strip()
# #         if not stripped_text:
# #             return (Align.BLANK, "", 0)

# #         # Separator: only underscores/dashes/equals + whitespace
# #         if re.match(r"^[_\-=\s*]{8,}$", stripped_text):
# #             return (Align.SEPARATOR, stripped_text, 0)

# #         rstripped = line.rstrip()
# #         leading = len(rstripped) - len(rstripped.lstrip())
# #         text_len = len(stripped_text)
# #         end_pos = leading + text_len

# #         pw = metrics["page_width"]
# #         std_indent = metrics["std_indent"]
# #         deep_indent = metrics["deep_indent"]
# #         right_zone = metrics["right_zone_start"]

# #         # ── RIGHT: starts past the right zone AND ends near the right edge ──
# #         # Must end within the rightmost 30% of the page to be "right-aligned"
# #         if leading >= right_zone and end_pos > pw * 0.70 and text_len < pw * 0.45:
# #             return (Align.RIGHT, stripped_text, leading)

# #         # ── LEFT_INDENT_MORE (early check): long text at deep indent is body, not centre ──
# #         if leading >= deep_indent and leading > std_indent and text_len > pw * 0.35:
# #             return (Align.LEFT_INDENT_MORE, stripped_text, leading)

# #         # ── CENTER: text center is near page center ──
# #         text_center = leading + text_len / 2
# #         page_center = pw / 2

# #         # Short uppercase text (headings like PRAYER, INDEX) — more lenient
# #         # centre detection even at high indents
# #         is_short_heading = (text_len < 20 and stripped_text == stripped_text.upper()
# #                             and stripped_text.replace(" ", "").isalpha())
# #         if is_short_heading and abs(text_center - page_center) < pw * 0.20:
# #             return (Align.CENTER, stripped_text, leading)

# #         # General centre detection — indented more than body, shortish text
# #         if (leading > std_indent + 5
# #                 and abs(text_center - page_center) < pw * 0.15
# #                 and text_len < pw * 0.6):
# #             return (Align.CENTER, stripped_text, leading)

# #         # ── LEFT_INDENT_MORE (remaining short-text cases at deep indent) ──
# #         if leading >= deep_indent and leading > std_indent:
# #             return (Align.LEFT_INDENT_MORE, stripped_text, leading)

# #         # ── LEFT_INDENT: at the standard body indent ──
# #         if leading >= std_indent and std_indent > 0:
# #             return (Align.LEFT_INDENT, stripped_text, leading)

# #         # ── LEFT (no indent) ──
# #         return (Align.LEFT, stripped_text, leading)

# #     @staticmethod
# #     def _extract_layout_blueprint(template_text: str) -> List[Dict[str, Any]]:
# #         """Parse the full template text into a list of alignment-classified
# #         lines with page numbers. This is the raw layout fingerprint."""

# #         metrics = AntigravityAgent._compute_page_metrics(template_text)
# #         blueprint: List[Dict[str, Any]] = []

# #         pages = template_text.split("\f")
# #         for page_idx, page in enumerate(pages, start=1):
# #             for line_no, line in enumerate(page.split("\n"), start=1):
# #                 align, text, indent = AntigravityAgent._classify_line(line, metrics)
# #                 blueprint.append({
# #                     "page": page_idx,
# #                     "line_no": line_no,
# #                     "align": align,
# #                     "text": text,
# #                     "indent": indent,
# #                 })

# #         return blueprint

# #     @staticmethod
# #     def _blueprint_to_display(blueprint: List[Dict[str, Any]], max_lines: int = 300) -> str:
# #         """Convert the raw layout blueprint into a readable display format
# #         that can be embedded in an LLM prompt."""

# #         lines_out = []
# #         current_page = 0
# #         count = 0
# #         for entry in blueprint:
# #             if count >= max_lines:
# #                 lines_out.append(f"  … (truncated at {max_lines} lines)")
# #                 break
# #             pg = entry["page"]
# #             if pg != current_page:
# #                 lines_out.append(f"\n── PAGE {pg} ──")
# #                 current_page = pg
# #             align = entry["align"]
# #             text = entry["text"]
# #             if align == Align.BLANK:
# #                 lines_out.append("  [BLANK]")
# #             else:
# #                 lines_out.append(f"  [{align}] {text}")
# #             count += 1

# #         return "\n".join(lines_out)

# #     # ══════════════════════════════════════════════════════════════════════
# #     #  PHASE 1 — Template Analysis (fully dynamic, works on ANY template)
# #     # ══════════════════════════════════════════════════════════════════════

# #     async def analyze_template(
# #         self,
# #         template_text: str,
# #         template_file_signed_url: Optional[str] = None,
# #     ) -> dict:
# #         """Analyse ANY uploaded legal template. Dynamically extracts:
# #         - The layout blueprint (line-by-line alignment from the PDF)
# #         - All sections with exact names from the template
# #         - All fillable fields with type inference
# #         - Per-section format blueprints so the drafter can reproduce the layout

# #         Returns a structured JSON consumed by the frontend and the drafter."""

# #         char_count = len(template_text)
# #         word_count = len(template_text.split())

# #         # Step 1: Dynamic layout analysis (no hardcoding)
# #         raw_blueprint = self._extract_layout_blueprint(template_text)
# #         layout_display = self._blueprint_to_display(raw_blueprint)
# #         metrics = self._compute_page_metrics(template_text)

# #         url_context = ""
# #         if template_file_signed_url:
# #             url_context = (
# #                 f"\nTEMPLATE DOCUMENT URL (for reference): {template_file_signed_url}\n"
# #             )

# #         prompt = f"""You are analysing an uploaded legal/court document template. Your job is to extract EVERY distinct section, its fields, and — critically — the EXACT LINE-BY-LINE ALIGNMENT PATTERN so a drafter can later reproduce the format precisely.

# # DOCUMENT STATS: {word_count} words, {char_count} characters
# # PAGE METRICS (computed from PDF): page_width={metrics['page_width']}, standard_indent={metrics['std_indent']}, deep_indent={metrics['deep_indent']}
# # {url_context}

# # ══════════════════════════════════════════════
# # COMPUTED LAYOUT BLUEPRINT (every non-blank line classified as CENTER / LEFT_INDENT / RIGHT / etc.)
# # ══════════════════════════════════════════════
# # {layout_display}

# # ══════════════════════════════════════════════
# # RAW TEMPLATE CONTENT
# # ══════════════════════════════════════════════
# # \"\"\"{template_text}\"\"\"

# # ══════════════════════════════════════════════
# # YOUR TASK — EXTRACT SECTIONS + FORMAT BLUEPRINTS
# # ══════════════════════════════════════════════

# # 1. **IDENTIFY EVERY DISTINCT SECTION** in the template. Each major heading, content block, or page that serves a different purpose is a section. Use the EXACT heading/title from the template as "section_name".

# # 2. **For EACH section, produce a "format_blueprint"** — an array describing EVERY line in that section:
# #    ```
# #    {{"align": "CENTER|LEFT_INDENT|LEFT_INDENT_MORE|RIGHT|TABLE_ROW|SEPARATOR|BLANK",
# #      "text": "exact text or pattern with {{field_key}} for blanks/variables",
# #      "style": "UPPERCASE|normal|SPACED",
# #      "is_field": true/false,
# #      "is_boilerplate": true/false,
# #      "is_numbered": true/false,
# #      "is_multiline": true/false,
# #      "note": "optional guidance for the drafter"}}
# #    ```
# #    Use the alignment tags from the COMPUTED LAYOUT BLUEPRINT above — they show the actual positions from the PDF.

# # 3. **Extract ALL fillable fields**: blanks (________), placeholders ([…], {{{{…}}}}), variable slots (dates, names, amounts, case numbers), empty lines after labels. Each field gets a unique snake_case "key".

# # 4. **Mark boilerplate**: Fixed/standard text that MUST be reproduced verbatim (e.g. "MOST RESPECTFULLY SHEWETH", "FOR WHICH ACT OF KINDNESS…", court names, standard legal clauses). Set "is_boilerplate": true.

# # 5. **Detect section dependencies**: If a section references values from another section (e.g. the Affidavit references Facts), note it in "depends_on".

# # 6. **Preserve the exact ORDER** the sections appear in the template (set "order": 1, 2, 3, …).

# # 7. **Detect page breaks**: If a section starts on a new page in the template, set "page_break_before": true.

# # ══════════════════════════════════════════════
# # REQUIRED JSON (return ONLY valid JSON, no markdown fences, no explanation)
# # ══════════════════════════════════════════════
# # {{
# #   "template_name": "Inferred name of this document type",
# #   "document_type": "Writ Petition|Contract|Application|Agreement|Affidavit|Lease Deed|Power of Attorney|…",
# #   "total_sections": <int>,
# #   "estimated_draft_length": "e.g. 15-30 pages",
# #   "page_metrics": {{
# #     "page_width": {metrics['page_width']},
# #     "standard_indent": {metrics['std_indent']},
# #     "deep_indent": {metrics['deep_indent']}
# #   }},
# #   "all_fields": [
# #     {{
# #       "key": "snake_case_name",
# #       "type": "string|date|number|currency|address|boolean|email|phone|text_long|percentage",
# #       "label": "Human-readable label",
# #       "required": true,
# #       "default_value": "",
# #       "validation_rules": "",
# #       "description": "Helper text for the user filling this in",
# #       "section_id": "section_id where this field belongs"
# #     }}
# #   ],
# #   "sections": [
# #     {{
# #       "section_id": "unique_snake_case_id",
# #       "section_name": "Exact heading from the template",
# #       "section_purpose": "What this section covers — for the user",
# #       "section_category": "descriptive category (e.g. cause_title, index, facts, prayer, affidavit, signatures, terms, recitals, …)",
# #       "order": 1,
# #       "page_break_before": true|false,
# #       "estimated_words": <int>,
# #       "depends_on": ["other_section_ids"],
# #       "format_blueprint": [
# #         {{
# #           "align": "CENTER",
# #           "text": "IN THE SUPREME COURT OF INDIA",
# #           "style": "UPPERCASE",
# #           "is_boilerplate": true,
# #           "is_field": false,
# #           "is_numbered": false,
# #           "is_multiline": false,
# #           "note": ""
# #         }},
# #         {{
# #           "align": "BLANK",
# #           "text": "",
# #           "style": "normal",
# #           "is_boilerplate": false,
# #           "is_field": false,
# #           "is_numbered": false,
# #           "is_multiline": false,
# #           "note": ""
# #         }},
# #         {{
# #           "align": "RIGHT",
# #           "text": "{{petitioner_name}}…..Petitioner",
# #           "style": "normal",
# #           "is_boilerplate": false,
# #           "is_field": true,
# #           "is_numbered": false,
# #           "is_multiline": false,
# #           "note": "Party name placeholder"
# #         }},
# #         {{
# #           "align": "LEFT_INDENT",
# #           "text": "1. {{fact_paragraph}}",
# #           "style": "normal",
# #           "is_boilerplate": false,
# #           "is_field": true,
# #           "is_numbered": true,
# #           "is_multiline": true,
# #           "note": "Generate numbered paragraphs for each fact"
# #         }}
# #       ],
# #       "fields": [
# #         {{
# #           "key": "petitioner_name",
# #           "type": "string",
# #           "label": "Petitioner Name",
# #           "required": true,
# #           "default_value": "",
# #           "validation_rules": "",
# #           "description": "Full name of the petitioner"
# #         }}
# #       ]
# #     }}
# #   ]
# # }}

# # CRITICAL REMINDERS:
# # - The "format_blueprint" is the heart of this system. It must capture EVERY line of the section with the correct alignment tag (CENTER, LEFT_INDENT, RIGHT, LEFT_INDENT_MORE, TABLE_ROW, SEPARATOR, BLANK).
# # - Use the alignment classifications from the COMPUTED LAYOUT BLUEPRINT — don't guess; they were calculated from the PDF positions.
# # - Boilerplate text (fixed legal phrasing) MUST be preserved exactly in the blueprint — the drafter will reproduce it verbatim.
# # - Fields go in curly braces: {{field_key}} in the blueprint text.
# # - This must work for ANY legal template — writ petitions, contracts, lease deeds, affidavits, bail applications, company forms, etc. Adapt the section names and structure to whatever the template actually contains.
# # """

# #         result = await self._call_gemini(prompt, max_output_tokens=16384)
# #         result = self._post_process_analysis(result)

# #         # Attach the raw metrics so the formatter can use them later
# #         result["page_metrics"] = metrics
# #         return result

# #     # ══════════════════════════════════════════════════════════════════════
# #     #  PHASE 2 / 3 — Section prompt generation
# #     # ══════════════════════════════════════════════════════════════════════

# #     async def generate_section_prompts(self, section_data: dict) -> dict:
# #         """Generate a master drafting prompt for ONE section. The prompt
# #         encodes the exact format_blueprint so the drafter reproduces the
# #         template layout precisely."""

# #         section_name = section_data.get("section_name", "Section")
# #         blueprint = section_data.get("format_blueprint", [])
# #         field_keys = [f.get("key") for f in section_data.get("fields", [])]
# #         format_spec = self._blueprint_to_prompt_spec(blueprint, section_name)

# #         # Separate boilerplate lines for emphasis
# #         boilerplate_lines = [
# #             entry.get("text", "")
# #             for entry in blueprint
# #             if entry.get("is_boilerplate") and entry.get("text")
# #         ]
# #         boilerplate_display = "\n".join(f"  • {bl}" for bl in boilerplate_lines) if boilerplate_lines else "(none)"

# #         prompt = f"""Create a comprehensive "Master Prompt" — step-by-step instructions so an AI drafter can later generate the "{section_name}" section of a legal document in the EXACT format of the original template.

# # SECTION DATA:
# # {json.dumps(section_data, indent=2)}

# # LINE-BY-LINE FORMAT SPECIFICATION (from the template):
# # {format_spec}

# # BOILERPLATE TEXT (must be reproduced VERBATIM by the drafter):
# # {boilerplate_display}

# # FIELDS TO INCORPORATE: {json.dumps(field_keys)}

# # YOUR TASK:
# # 1. Write a "master_instruction" prompt that tells the drafter EXACTLY how to produce this section:
# #    - Which lines are CENTER / LEFT_INDENT / RIGHT / LEFT_INDENT_MORE
# #    - What boilerplate text must appear verbatim
# #    - Where fields go and how to weave them in naturally
# #    - Legal tone, mandatory phrases, numbering style
# #    - Length guidance
# # 2. The drafter will output each line prefixed with an alignment marker like [CENTER], [RIGHT], [LEFT_INDENT], etc.

# # Return ONLY valid JSON:
# # {{
# #   "section_intro": "Brief context about what this section is",
# #   "drafting_complexity": "simple|moderate|complex",
# #   "estimated_output_words": <int>,
# #   "field_prompts": [
# #     {{
# #       "field_id": "master_instruction",
# #       "prompt": "<detailed instructions referencing the exact format spec>"
# #     }}
# #   ],
# #   "dependencies": ["section_ids this references, if any"],
# #   "legal_references": ["relevant laws/provisions, if any"]
# # }}
# # """
# #         return await self._call_gemini(prompt, max_output_tokens=8192)

# #     # ══════════════════════════════════════════════════════════════════════
# #     #  PHASE 4 / 5 — Validation
# #     # ══════════════════════════════════════════════════════════════════════

# #     async def validate_input(self, field_info: dict, user_input: str) -> dict:
# #         prompt = f"""You are a legal-document validation system.
# # FIELD RULES: {json.dumps(field_info)}
# # USER INPUT: \"{user_input}\"
# # Check validity against type, format, and validation rules.
# # Return ONLY: {{"valid": true}} OR {{"valid": false, "error_prompt": "…", "suggestion": "…"}}"""
# #         return await self._call_gemini(prompt)

# #     # ══════════════════════════════════════════════════════════════════════
# #     #  PHASE 6 — Section content generation (format-faithful)
# #     # ══════════════════════════════════════════════════════════════════════

# #     async def generate_section_content(
# #         self,
# #         section_data: dict,
# #         field_values: dict,
# #         max_output_tokens: int = 65536,
# #         target_words_min: int = 200,
# #         target_words_max: int = 10000,
# #     ) -> str:
# #         """Generate the actual drafted text for one section, with every line
# #         tagged with its alignment marker so the formatter can position it
# #         correctly. Works for ANY template type."""

# #         section_name = section_data.get("section_name", "Section")
# #         section_id = section_data.get("section_id", "")
# #         blueprint = section_data.get("format_blueprint", [])

# #         # Build the detailed format spec from the blueprint
# #         format_spec = self._blueprint_to_prompt_spec(blueprint, section_name)

# #         # Extract master instruction
# #         master_instruction = ""
# #         for p in (section_data.get("section_prompts") or section_data.get("field_prompts") or []):
# #             if isinstance(p, dict):
# #                 master_instruction = p.get("prompt", "")
# #                 if master_instruction:
# #                     break

# #         # Collect boilerplate
# #         boilerplate_lines = [
# #             entry.get("text", "")
# #             for entry in blueprint
# #             if entry.get("is_boilerplate") and entry.get("text")
# #         ]
# #         boilerplate_display = "\n".join(boilerplate_lines) if boilerplate_lines else "(none)"

# #         prompt = f"""You are a legal document drafting AI. Generate the "{section_name}" section with EXACT alignment matching the template.

# # ═══════════════════════════════════════════════
# # SECTION: {section_name}
# # SECTION ID: {section_id}
# # PURPOSE: {section_data.get("section_purpose", "")}
# # ═══════════════════════════════════════════════

# # ALIGNMENT LEGEND — prefix EVERY output line with one of these markers:
# #   [CENTER]           → centred text (court names, major headings)
# #   [LEFT_INDENT]      → standard body indent (paragraphs, numbered items)
# #   [LEFT_INDENT_MORE] → deeper indent (sub-content, boilerplate clauses)
# #   [RIGHT]            → right-aligned (party names, FILED BY)
# #   [TABLE_ROW]        → table row (use | to separate columns)
# #   [SEPARATOR]        → ruled line (_____)
# #   [BLANK]            → empty line for spacing

# # ═══════════════════════════════════════════════
# # LINE-BY-LINE FORMAT SPECIFICATION (follow this EXACTLY):
# # ═══════════════════════════════════════════════
# # {format_spec}

# # ═══════════════════════════════════════════════
# # BOILERPLATE (reproduce VERBATIM — do NOT rephrase):
# # ═══════════════════════════════════════════════
# # {boilerplate_display}

# # ═══════════════════════════════════════════════
# # MASTER DRAFTING INSTRUCTIONS:
# # ═══════════════════════════════════════════════
# # {master_instruction or "Follow the format specification above precisely. Generate professional legal content matching the section purpose."}

# # ═══════════════════════════════════════════════
# # USER-PROVIDED VALUES (incorporate naturally):
# # ═══════════════════════════════════════════════
# # {json.dumps(field_values, indent=2)}

# # ═══════════════════════════════════════════════
# # CRITICAL RULES
# # ═══════════════════════════════════════════════
# # 1. Start EVERY output line with an alignment marker: [CENTER], [LEFT_INDENT], [RIGHT], etc.
# # 2. Follow the EXACT sequence and alignment from the format spec above.
# # 3. For lines marked "is_numbered" / "is_multiline" — generate the appropriate number of items/paragraphs.
# # 4. For lines marked "is_boilerplate" — reproduce the text EXACTLY as shown, do NOT rephrase.
# # 5. For lines with field placeholders ({{field_key}}) — insert the user-provided value. If missing, use "[________]".
# # 6. Use appropriate legal tone and language.
# # 7. Length: {target_words_min}–{target_words_max} words (adjust to section type).
# # 8. Output plain text ONLY with alignment markers. No JSON, no markdown fences.

# # Generate the drafted section now:"""

# #         return await self._call_gemini_plain_text(
# #             prompt, max_output_tokens=max_output_tokens, timeout_sec=600.0
# #         )

# #     # ══════════════════════════════════════════════════════════════════════
# #     #  OUTPUT FORMATTERS — convert alignment-marked text to final output
# #     # ══════════════════════════════════════════════════════════════════════

# #     @staticmethod
# #     def format_to_plain_text(
# #         raw_section: str, page_width: int = 80, std_indent: int = 15, deep_indent: int = 25
# #     ) -> str:
# #         """Convert alignment-marked output → properly indented plain text."""

# #         out: List[str] = []
# #         for line in raw_section.split("\n"):
# #             stripped = line.strip()
# #             m = re.match(
# #                 r"\[(CENTER|LEFT_INDENT_MORE|LEFT_INDENT|LEFT|RIGHT|TABLE_ROW|SEPARATOR|BLANK)\]\s*(.*)",
# #                 stripped,
# #             )
# #             if m:
# #                 align, text = m.group(1), m.group(2).strip()
# #             else:
# #                 align, text = Align.LEFT_INDENT, stripped

# #             if align == Align.BLANK or not text:
# #                 out.append("")
# #             elif align == Align.CENTER:
# #                 out.append(text.center(page_width))
# #             elif align == Align.RIGHT:
# #                 out.append(text.rjust(page_width))
# #             elif align == Align.LEFT_INDENT_MORE:
# #                 out.append(" " * deep_indent + text)
# #             elif align in (Align.LEFT_INDENT, Align.LEFT):
# #                 out.append(" " * std_indent + text)
# #             elif align == Align.SEPARATOR:
# #                 out.append(" " * std_indent + "_" * (page_width - std_indent))
# #             elif align == Align.TABLE_ROW:
# #                 parts = [p.strip() for p in text.split("|")]
# #                 if len(parts) >= 3:
# #                     col_width = (page_width - std_indent) // len(parts)
# #                     row = " " * std_indent + "".join(p.ljust(col_width) for p in parts)
# #                     out.append(row)
# #                 else:
# #                     out.append(" " * std_indent + text)
# #             else:
# #                 out.append(" " * std_indent + text)

# #         return "\n".join(out)

# #     @staticmethod
# #     def format_to_html(raw_section: str) -> str:
# #         """Convert alignment-marked output → HTML with CSS alignment."""

# #         style_map = {
# #             Align.CENTER: "text-align: center;",
# #             Align.RIGHT: "text-align: right; padding-right: 0.5in;",
# #             Align.LEFT_INDENT: "text-align: left; margin-left: 1.5in;",
# #             Align.LEFT_INDENT_MORE: "text-align: left; margin-left: 2.5in;",
# #             Align.LEFT: "text-align: left;",
# #             Align.TABLE_ROW: "text-align: left; margin-left: 1.5in; font-family: monospace; white-space: pre;",
# #             Align.SEPARATOR: "text-align: left; margin-left: 1.5in;",
# #         }

# #         html = ['<div class="legal-section" style="font-family: \'Times New Roman\', serif; font-size: 14px; line-height: 1.8; max-width: 8.5in; margin: auto;">']

# #         for line in raw_section.split("\n"):
# #             stripped = line.strip()
# #             m = re.match(
# #                 r"\[(CENTER|LEFT_INDENT_MORE|LEFT_INDENT|LEFT|RIGHT|TABLE_ROW|SEPARATOR|BLANK)\]\s*(.*)",
# #                 stripped,
# #             )
# #             if m:
# #                 align, text = m.group(1), m.group(2).strip()
# #             else:
# #                 align, text = Align.LEFT_INDENT, stripped

# #             if align == Align.BLANK or not text:
# #                 html.append('<p style="margin: 0; min-height: 1em;">&nbsp;</p>')
# #             elif align == Align.SEPARATOR:
# #                 html.append('<hr style="margin-left: 1.5in; border: none; border-top: 1px solid black;" />')
# #             else:
# #                 style = style_map.get(align, "text-align: left;")
# #                 if text == text.upper() and len(text) > 3 and not text.startswith("("):
# #                     style += " font-weight: bold;"
# #                 escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
# #                 html.append(f'<p style="margin: 2px 0; {style}">{escaped}</p>')

# #         html.append("</div>")
# #         return "\n".join(html)

# #     # ══════════════════════════════════════════════════════════════════════
# #     #  FULL DRAFT ASSEMBLY
# #     # ══════════════════════════════════════════════════════════════════════

# #     async def assemble_full_draft(
# #         self,
# #         analysis_result: dict,
# #         section_prompts: Dict[str, dict],
# #         field_values: dict,
# #         output_format: str = "plain",
# #     ) -> str:
# #         """Generate all sections in template order and assemble into a full draft.

# #         Args:
# #             analysis_result: Output from analyze_template()
# #             section_prompts: {section_id: output from generate_section_prompts()}
# #             field_values: Flat dict of all user-provided values
# #             output_format: "plain" | "html" | "raw" (with alignment markers)
# #         """

# #         sections = sorted(
# #             analysis_result.get("sections", []),
# #             key=lambda s: s.get("order", 0),
# #         )

# #         metrics = analysis_result.get("page_metrics", {})
# #         pw = metrics.get("page_width", 80)
# #         si = metrics.get("standard_indent", 15) if metrics.get("standard_indent", 0) > 0 else 15
# #         di = metrics.get("deep_indent", 25)

# #         draft_parts: List[str] = []

# #         for sec in sections:
# #             sid = sec.get("section_id", "")
# #             merged = {**sec}
# #             if sid in section_prompts:
# #                 sp = section_prompts[sid]
# #                 merged["section_prompts"] = sp.get("field_prompts", [])
# #                 merged["section_intro"] = sp.get("section_intro", "")

# #             print(f"DEBUG: Generating '{sec.get('section_name')}' (order={sec.get('order')})…")
# #             raw = await self.generate_section_content(
# #                 section_data=merged, field_values=field_values,
# #             )

# #             if output_format == "html":
# #                 formatted = self.format_to_html(raw)
# #                 if sec.get("page_break_before"):
# #                     formatted = '<div style="page-break-before: always;"></div>\n' + formatted
# #             elif output_format == "plain":
# #                 formatted = self.format_to_plain_text(raw, page_width=pw, std_indent=si, deep_indent=di)
# #                 if sec.get("page_break_before"):
# #                     formatted = "\f" + formatted
# #             else:
# #                 formatted = raw

# #             draft_parts.append(formatted)

# #         sep = "\n\n" if output_format != "html" else "\n"
# #         full_draft = sep.join(draft_parts)
# #         print(f"DEBUG: Full draft — {len(full_draft)} chars, {len(full_draft.split())} words.")
# #         return full_draft

# #     # ══════════════════════════════════════════════════════════════════════
# #     #  PRIVATE HELPERS
# #     # ══════════════════════════════════════════════════════════════════════

# #     @staticmethod
# #     def _post_process_analysis(result: dict) -> dict:
# #         """Normalize and fix the analysis result."""

# #         # Build all_fields from sections if missing
# #         if "sections" in result and "all_fields" not in result:
# #             all_fields: List[dict] = []
# #             seen: set = set()
# #             for sec in result["sections"]:
# #                 sid = sec.get("section_id", "")
# #                 for f in sec.get("fields", []):
# #                     key = f.get("key")
# #                     if key and key not in seen:
# #                         seen.add(key)
# #                         all_fields.append({**f, "section_id": sid})
# #             result["all_fields"] = all_fields

# #         # Ensure ordering
# #         for idx, sec in enumerate(result.get("sections", []), start=1):
# #             sec.setdefault("order", idx)
# #             sec.setdefault("page_break_before", False)
# #             sec.setdefault("format_blueprint", [])
# #             sec.setdefault("depends_on", [])

# #         result["sections"] = sorted(result.get("sections", []), key=lambda s: s.get("order", 0))
# #         result["total_sections"] = len(result.get("sections", []))

# #         n_fields = len(result.get("all_fields", []))
# #         n_sections = result["total_sections"]
# #         print(f"DEBUG: Post-processed: {n_sections} sections, {n_fields} fields.")
# #         return result

# #     @staticmethod
# #     def _blueprint_to_prompt_spec(blueprint: list, section_name: str) -> str:
# #         """Convert a format_blueprint array into a human-readable spec
# #         for embedding in LLM prompts."""

# #         if not blueprint:
# #             return f"(No format blueprint — use standard legal formatting for '{section_name}')"

# #         lines = [f"FORMAT SPEC FOR: {section_name}", "─" * 55]
# #         for i, entry in enumerate(blueprint, start=1):
# #             align = entry.get("align", "LEFT_INDENT")
# #             text = entry.get("text", "")
# #             style = entry.get("style", "normal")
# #             is_bp = entry.get("is_boilerplate", False)
# #             is_fld = entry.get("is_field", False)
# #             is_num = entry.get("is_numbered", False)
# #             is_ml = entry.get("is_multiline", False)
# #             note = entry.get("note", "")

# #             parts = [f"  Line {i:2d}: [{align}]"]
# #             if text:
# #                 parts.append(f' "{text}"')
# #             if style and style != "normal":
# #                 parts.append(f" (style: {style})")
# #             tags = []
# #             if is_bp:
# #                 tags.append("BOILERPLATE")
# #             if is_fld:
# #                 tags.append("FIELD")
# #             if is_num:
# #                 tags.append("NUMBERED")
# #             if is_ml:
# #                 tags.append("MULTILINE")
# #             if tags:
# #                 parts.append(f" [{', '.join(tags)}]")
# #             if note:
# #                 parts.append(f"\n           ↳ {note}")

# #             lines.append("".join(parts))

# #         return "\n".join(lines)

# from google import genai

# try:
#     import google.adk as adk
# except ImportError:
#     adk = None

# import json
# import re
# import asyncio
# import math
# from typing import Optional, List, Dict, Any, Tuple
# from ..config import settings


# # ═══════════════════════════════════════════════════════════════════════════════
# # ALIGNMENT TYPES
# # ═══════════════════════════════════════════════════════════════════════════════

# class Align:
#     CENTER = "CENTER"
#     LEFT = "LEFT"
#     LEFT_INDENT = "LEFT_INDENT"
#     LEFT_INDENT_MORE = "LEFT_INDENT_MORE"
#     RIGHT = "RIGHT"
#     TABLE_ROW = "TABLE_ROW"
#     SEPARATOR = "SEPARATOR"
#     BLANK = "BLANK"


# # ═══════════════════════════════════════════════════════════════════════════════
# # MAIN AGENT CLASS
# # ═══════════════════════════════════════════════════════════════════════════════

# class AntigravityAgent:
#     """Gemini-powered agent for analysing ANY legal template and generating
#     granular section-by-section drafts supporting 500+ page documents.

#     KEY IMPROVEMENTS OVER PREVIOUS VERSION:
#     - Deep/recursive section detection: sub-sections inside Prayer, Facts,
#       Grounds, Annexures etc. are ALL extracted as separate sections.
#     - Two-pass analysis: first pass identifies top-level sections; second
#       pass deep-dives each section for sub-sections and granular blueprints.
#     - Chunked generation: each section is generated independently; large
#       sections (Facts, Grounds) are auto-chunked so output is never truncated.
#     - Full 500+ page support: generates as many tokens as needed per section
#       and assembles the complete document at the end.
#     - Nothing is hardcoded — section names/structure come entirely from the
#       uploaded template.
#     """

#     # Maximum tokens per Gemini call — stay safe under API limit
#     MAX_TOKENS_JSON = 16384
#     MAX_TOKENS_TEXT = 65536
#     # If a section's estimated_words exceeds this, we chunk it
#     CHUNK_THRESHOLD_WORDS = 1500

#     def __init__(self):
#         self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
#         self.model_name = settings.GEMINI_MODEL

#     # ══════════════════════════════════════════════════════════════════════
#     #  GEMINI COMMUNICATION
#     # ══════════════════════════════════════════════════════════════════════

#     async def _call_gemini(
#         self, prompt: str, max_output_tokens: int = None, timeout: float = 240.0
#     ) -> dict:
#         """Call Gemini expecting a JSON response."""
#         max_tokens = max_output_tokens or self.MAX_TOKENS_JSON
#         print(f"DEBUG: Calling Gemini JSON (max_tokens={max_tokens})…")
#         try:
#             response = await asyncio.wait_for(
#                 self.client.aio.models.generate_content(
#                     model=self.model_name,
#                     contents=prompt,
#                     config={
#                         "response_mime_type": "application/json",
#                         "max_output_tokens": max_tokens,
#                         "temperature": 0.1,
#                     },
#                 ),
#                 timeout=timeout,
#             )
#         except asyncio.TimeoutError:
#             raise ValueError(f"Gemini timed out ({timeout}s). Please retry.")
#         except Exception as e:
#             print(f"DEBUG: Gemini call failed: {e}")
#             raise

#         text = (response.text or "").strip()
#         clean = self._extract_json(text)
#         try:
#             return json.loads(clean)
#         except json.JSONDecodeError:
#             return await self._auto_fix_json(clean)

#     async def _call_gemini_text(
#         self, prompt: str, max_output_tokens: int = None, timeout: float = 600.0
#     ) -> str:
#         """Call Gemini for plain-text output (no JSON)."""
#         max_tokens = min(max_output_tokens or self.MAX_TOKENS_TEXT, self.MAX_TOKENS_TEXT)
#         print(f"DEBUG: Calling Gemini plain-text (max_tokens={max_tokens})…")
#         try:
#             response = await asyncio.wait_for(
#                 self.client.aio.models.generate_content(
#                     model=self.model_name,
#                     contents=prompt,
#                     config={
#                         "max_output_tokens": max_tokens,
#                         "temperature": 0.2,
#                     },
#                 ),
#                 timeout=timeout,
#             )
#             return (response.text or "").strip()
#         except asyncio.TimeoutError:
#             raise ValueError(f"Generation timed out ({timeout}s).")
#         except Exception as e:
#             print(f"DEBUG: Gemini plain-text failed: {e}")
#             raise

#     # ──────────────────────────────────────────────────────────────────────
#     #  JSON helpers
#     # ──────────────────────────────────────────────────────────────────────

#     @staticmethod
#     def _extract_json(text: str) -> str:
#         m = re.search(r"```(?:json)?\s*\n?(\{[\s\S]*?\})\s*\n?```", text)
#         raw = m.group(1) if m else (re.search(r"(\{[\s\S]*\})", text) or type("X", (), {"group": lambda s, i: text})()).group(1)
#         raw = re.sub(r",\s*([\]}])", r"\1", raw)
#         raw = re.sub(r"[\x00-\x1F\x7F]", "", raw)
#         raw = re.sub(r'\\(?!["\\/bfnrt])(?!u[0-9a-fA-F]{4})', r"\\\\", raw)
#         return raw

#     async def _auto_fix_json(self, broken: str) -> dict:
#         fix_prompt = (
#             "Fix the JSON syntax errors below. Return ONLY valid JSON, "
#             "no markdown, no explanation.\n\n" + broken[:12000]
#         )
#         resp = await asyncio.wait_for(
#             self.client.aio.models.generate_content(
#                 model=self.model_name,
#                 contents=fix_prompt,
#                 config={"response_mime_type": "application/json", "max_output_tokens": 8192, "temperature": 0.0},
#             ),
#             timeout=60.0,
#         )
#         return json.loads(self._extract_json((resp.text or "").strip()))

#     # ══════════════════════════════════════════════════════════════════════
#     #  DYNAMIC LAYOUT ANALYSIS
#     # ══════════════════════════════════════════════════════════════════════

#     @staticmethod
#     def _compute_page_metrics(template_text: str) -> Dict[str, Any]:
#         from collections import Counter
#         all_indents, all_ends, all_lengths = [], [], []
#         for line in template_text.split("\n"):
#             if not line.strip():
#                 continue
#             rstripped = line.rstrip()
#             leading = len(rstripped) - len(rstripped.lstrip())
#             text_len = len(rstripped.strip())
#             end_pos = leading + text_len
#             all_indents.append(leading)
#             all_ends.append(end_pos)
#             all_lengths.append(text_len)
#         if not all_indents:
#             return {"page_width": 80, "std_indent": 0, "deep_indent": 10, "right_zone_start": 50}
#         page_width = max(all_ends) if all_ends else 80
#         indent_counts = Counter(i for i in all_indents if i > 0)
#         std_indent = indent_counts.most_common(1)[0][0] if indent_counts else 0
#         min_deep = std_indent + max(5, int(std_indent * 0.4))
#         deeper_indents = {i: c for i, c in indent_counts.items() if i >= min_deep}
#         deep_indent = max(deeper_indents, key=deeper_indents.get) if deeper_indents else std_indent + 10
#         right_zone_start = page_width * 0.50
#         return {
#             "page_width": page_width,
#             "std_indent": std_indent,
#             "deep_indent": deep_indent,
#             "right_zone_start": right_zone_start,
#         }

#     @staticmethod
#     def _classify_line(line: str, metrics: Dict[str, Any]) -> Tuple[str, str, int]:
#         stripped_text = line.strip()
#         if not stripped_text:
#             return (Align.BLANK, "", 0)
#         if re.match(r"^[_\-=\s*]{8,}$", stripped_text):
#             return (Align.SEPARATOR, stripped_text, 0)
#         rstripped = line.rstrip()
#         leading = len(rstripped) - len(rstripped.lstrip())
#         text_len = len(stripped_text)
#         end_pos = leading + text_len
#         pw = metrics["page_width"]
#         std_indent = metrics["std_indent"]
#         deep_indent = metrics["deep_indent"]
#         right_zone = metrics["right_zone_start"]
#         if leading >= right_zone and end_pos > pw * 0.70 and text_len < pw * 0.45:
#             return (Align.RIGHT, stripped_text, leading)
#         if leading >= deep_indent and leading > std_indent and text_len > pw * 0.35:
#             return (Align.LEFT_INDENT_MORE, stripped_text, leading)
#         text_center = leading + text_len / 2
#         page_center = pw / 2
#         is_short_heading = (text_len < 20 and stripped_text == stripped_text.upper()
#                             and stripped_text.replace(" ", "").isalpha())
#         if is_short_heading and abs(text_center - page_center) < pw * 0.20:
#             return (Align.CENTER, stripped_text, leading)
#         if (leading > std_indent + 5
#                 and abs(text_center - page_center) < pw * 0.15
#                 and text_len < pw * 0.6):
#             return (Align.CENTER, stripped_text, leading)
#         if leading >= deep_indent and leading > std_indent:
#             return (Align.LEFT_INDENT_MORE, stripped_text, leading)
#         if leading >= std_indent and std_indent > 0:
#             return (Align.LEFT_INDENT, stripped_text, leading)
#         return (Align.LEFT, stripped_text, leading)

#     @staticmethod
#     def _extract_layout_blueprint(template_text: str) -> List[Dict[str, Any]]:
#         metrics = AntigravityAgent._compute_page_metrics(template_text)
#         blueprint = []
#         pages = template_text.split("\f")
#         for page_idx, page in enumerate(pages, start=1):
#             for line_no, line in enumerate(page.split("\n"), start=1):
#                 align, text, indent = AntigravityAgent._classify_line(line, metrics)
#                 blueprint.append({
#                     "page": page_idx,
#                     "line_no": line_no,
#                     "align": align,
#                     "text": text,
#                     "indent": indent,
#                 })
#         return blueprint

#     @staticmethod
#     def _blueprint_to_display(blueprint: List[Dict[str, Any]], max_lines: int = 400) -> str:
#         lines_out = []
#         current_page = 0
#         count = 0
#         for entry in blueprint:
#             if count >= max_lines:
#                 lines_out.append(f"  … (truncated at {max_lines} lines)")
#                 break
#             pg = entry["page"]
#             if pg != current_page:
#                 lines_out.append(f"\n── PAGE {pg} ──")
#                 current_page = pg
#             align = entry["align"]
#             text = entry["text"]
#             if align == Align.BLANK:
#                 lines_out.append("  [BLANK]")
#             else:
#                 lines_out.append(f"  [{align}] {text}")
#             count += 1
#         return "\n".join(lines_out)

#     # ══════════════════════════════════════════════════════════════════════
#     #  PHASE 1A — COARSE SECTION SCAN
#     #  First pass: detect ALL top-level AND sub-sections in one shot by
#     #  instructing the LLM to be maximally granular.
#     # ══════════════════════════════════════════════════════════════════════

#     async def _coarse_section_scan(
#         self, template_text: str, layout_display: str, metrics: Dict[str, Any]
#     ) -> List[Dict[str, Any]]:
#         """Ask the LLM to list EVERY section and sub-section it can find,
#         no matter how small. Returns a flat list of section stubs."""

#         word_count = len(template_text.split())

#         prompt = f"""You are scanning a legal/court document template to produce an EXHAUSTIVE list of EVERY section and sub-section it contains.

# DOCUMENT: {word_count} words
# PAGE METRICS: page_width={metrics['page_width']}, std_indent={metrics['std_indent']}, deep_indent={metrics['deep_indent']}

# LAYOUT BLUEPRINT (alignment-classified lines from the PDF):
# {layout_display}

# RAW TEMPLATE TEXT:
# \"\"\"{template_text[:8000]}\"\"\"
# {"(... document continues ...)" if len(template_text) > 8000 else ""}

# ══════════════════════════════════════════════
# TASK: LIST EVERY SECTION — BE MAXIMALLY GRANULAR
# ══════════════════════════════════════════════

# RULES:
# 1. Identify EVERY distinct section AND sub-section in the document.
#    - Top-level sections: Cover Page, Index, Synopsis, Cause Title, Facts, Grounds, Prayer, Affidavit, Annexures, etc.
#    - Sub-sections that MUST be their own section:
#      * Each numbered prayer clause (Prayer Clause 1, Prayer Clause 2, etc.)
#      * Each ground (Ground I, Ground II, etc.)
#      * Each annexure (Annexure P-1, Annexure P-2, etc.)
#      * Each fact block if distinctly labeled
#      * Any separate application (Stay Application, Exemption Application, etc.)
#      * Verification/Deponent block of Affidavit
#      * Any schedule or schedule item
#      * Cover page and inner title page if both present
#      * Filing details / advocate block

# 2. Use the EXACT text from the template as "section_name" — do NOT invent names.

# 3. Assign a "section_category" — use descriptive names like:
#    cover_page, index, synopsis, list_of_dates, cause_title, party_details,
#    facts, questions_of_law, grounds, ground_item, averment, prayer,
#    prayer_clause, filing_details, affidavit, affidavit_verification,
#    annexure, annexure_item, application, schedule, signatures, other

# 4. "is_subsection": true if this is a sub-item of another section.
#    "parent_section_id": the section_id of the parent (if is_subsection is true).

# 5. "order": sequential position in the template (1-based, continuous across parent/child).

# 6. "estimated_words": realistic word count when fully drafted (be generous — legal docs are verbose).
#    - Entire Facts section: 500-2000 words
#    - Each Ground: 200-500 words
#    - Each Prayer clause: 50-150 words
#    - Each Annexure: 100-300 words
#    - Synopsis: 300-800 words
#    - Affidavit body: 400-1000 words

# 7. Include at least as many sections as there are visible headings + all repeated blocks
#    (e.g. if the template shows "Annexure P-__" repeated, list 3-5 annexure items).

# Return ONLY valid JSON:
# {{
#   "total_sections": <int — must match sections array length>,
#   "sections": [
#     {{
#       "section_id": "unique_snake_case_id",
#       "section_name": "Exact name from template",
#       "section_category": "category",
#       "order": 1,
#       "is_subsection": false,
#       "parent_section_id": null,
#       "page_break_before": true,
#       "estimated_words": 300,
#       "short_description": "One sentence: what content goes here"
#     }}
#   ]
# }}
# """
#         result = await self._call_gemini(prompt, max_output_tokens=8192, timeout=180.0)
#         sections = result.get("sections", [])
#         print(f"DEBUG: Coarse scan found {len(sections)} sections.")
#         return sections

#     # ══════════════════════════════════════════════════════════════════════
#     #  PHASE 1B — DEEP SECTION ANALYSIS
#     #  Second pass: for each section stub, extract fields + format_blueprint
#     # ══════════════════════════════════════════════════════════════════════

#     async def _deep_analyze_section(
#         self,
#         section_stub: Dict[str, Any],
#         template_text: str,
#         layout_display: str,
#         metrics: Dict[str, Any],
#     ) -> Dict[str, Any]:
#         """Deep-dive one section to extract its format_blueprint and fields."""

#         section_name = section_stub.get("section_name", "Section")
#         section_category = section_stub.get("section_category", "other")
#         estimated_words = section_stub.get("estimated_words", 300)

#         # Extract the relevant portion of the template text for this section
#         # Find the section in the template text
#         section_snippet = self._extract_section_snippet(template_text, section_name)

#         prompt = f"""You are performing a DEEP ANALYSIS of one section of a legal document template.

# SECTION TO ANALYSE: "{section_name}" (category: {section_category})
# ESTIMATED WORDS WHEN DRAFTED: {estimated_words}

# RELEVANT TEMPLATE TEXT FOR THIS SECTION:
# \"\"\"{section_snippet}\"\"\"

# LAYOUT BLUEPRINT (alignment tags from PDF, filtered to this section's area):
# {layout_display}

# PAGE METRICS: page_width={metrics['page_width']}, std_indent={metrics['std_indent']}, deep_indent={metrics['deep_indent']}

# ══════════════════════════════════════════════
# TASK: EXTRACT FORMAT BLUEPRINT + FIELDS
# ══════════════════════════════════════════════

# 1. PRODUCE a "format_blueprint" — an ordered array where EACH ELEMENT represents one line or line-type in this section.
#    - For REPEATING lines (e.g. 10 numbered fact paragraphs), create ONE entry with is_multiline=true and a note like "generate N numbered paragraphs".
#    - For TABLE sections (Index, List of Dates), use align="TABLE_ROW" with | separating columns.
#    - Mark every fixed/standard phrase as is_boilerplate=true.
#    - Mark every blank/variable slot as is_field=true with {{field_key}} in the text.

# 2. EXTRACT all FIELDS — every variable, blank, placeholder, or user-provided value needed for this section.
#    - Give each field a UNIQUE snake_case key (prefix with section_id to avoid collisions).
#    - Infer type: string, date, number, currency, address, boolean, text_long, percentage.

# 3. "section_purpose": clear explanation for the user of what this section is for.

# 4. "format_instructions": precise instructions for the drafter (layout, tone, numbering, boilerplate phrases).

# 5. "boilerplate_text": any text that MUST appear verbatim (copy it exactly from the template snippet above).

# Return ONLY valid JSON:
# {{
#   "section_id": "{section_stub.get('section_id', 'unknown')}",
#   "section_name": "{section_name}",
#   "section_category": "{section_category}",
#   "section_purpose": "...",
#   "order": {section_stub.get('order', 1)},
#   "is_subsection": {str(section_stub.get('is_subsection', False)).lower()},
#   "parent_section_id": {json.dumps(section_stub.get('parent_section_id'))},
#   "page_break_before": {str(section_stub.get('page_break_before', False)).lower()},
#   "estimated_words": {estimated_words},
#   "depends_on": [],
#   "format_instructions": "...",
#   "boilerplate_text": "...",
#   "format_blueprint": [
#     {{
#       "align": "CENTER|LEFT_INDENT|LEFT_INDENT_MORE|RIGHT|TABLE_ROW|SEPARATOR|BLANK",
#       "text": "exact text or {{field_key}} for variables",
#       "style": "UPPERCASE|normal|SPACED",
#       "is_boilerplate": false,
#       "is_field": false,
#       "is_numbered": false,
#       "is_multiline": false,
#       "note": "drafter guidance"
#     }}
#   ],
#   "fields": [
#     {{
#       "key": "unique_snake_case_key",
#       "type": "string",
#       "label": "Human-readable label",
#       "required": true,
#       "default_value": "",
#       "validation_rules": "",
#       "description": "Helper text"
#     }}
#   ]
# }}
# """
#         try:
#             result = await self._call_gemini(prompt, max_output_tokens=8192, timeout=180.0)
#             # Merge stub data with deep analysis
#             merged = {**section_stub, **result}
#             return merged
#         except Exception as e:
#             print(f"DEBUG: Deep analysis failed for '{section_name}': {e}")
#             # Return the stub with empty blueprint rather than crash
#             return {
#                 **section_stub,
#                 "section_purpose": section_stub.get("short_description", ""),
#                 "format_instructions": "",
#                 "boilerplate_text": "",
#                 "format_blueprint": [],
#                 "fields": [],
#             }

#     @staticmethod
#     def _extract_section_snippet(template_text: str, section_name: str, window: int = 3000) -> str:
#         """Extract a snippet of the template text around the section heading."""
#         # Try to find the section heading in the text (case-insensitive)
#         idx = template_text.lower().find(section_name.lower())
#         if idx == -1:
#             # Try partial match on key words
#             words = section_name.split()[:3]
#             for word in words:
#                 if len(word) > 4:
#                     idx = template_text.lower().find(word.lower())
#                     if idx != -1:
#                         break
#         if idx == -1:
#             return template_text[:window]
#         start = max(0, idx - 200)
#         end = min(len(template_text), idx + window)
#         return template_text[start:end]

#     # ══════════════════════════════════════════════════════════════════════
#     #  PHASE 1 — FULL TEMPLATE ANALYSIS (two-pass)
#     # ══════════════════════════════════════════════════════════════════════

#     async def analyze_template(
#         self,
#         template_text: str,
#         template_file_signed_url: Optional[str] = None,
#         deep_analyze: bool = True,
#     ) -> dict:
#         """Analyse ANY uploaded legal template using a two-pass approach:
#         Pass 1: Coarse scan — find ALL sections and sub-sections
#         Pass 2: Deep analysis — extract format_blueprint + fields per section

#         This ensures even nested sections (prayer clauses, grounds, annexures)
#         are individually captured, enabling 500-page document generation."""

#         char_count = len(template_text)
#         word_count = len(template_text.split())
#         print(f"DEBUG: Analyzing template — {word_count} words, {char_count} chars")

#         # Step 1: Dynamic layout analysis
#         raw_blueprint = self._extract_layout_blueprint(template_text)
#         layout_display = self._blueprint_to_display(raw_blueprint, max_lines=500)
#         metrics = self._compute_page_metrics(template_text)

#         # Step 2: Coarse section scan (gets ALL sections including sub-sections)
#         section_stubs = await self._coarse_section_scan(template_text, layout_display, metrics)

#         if not section_stubs:
#             # Fallback: single-pass analysis
#             print("DEBUG: Coarse scan returned no sections, falling back to single-pass.")
#             return await self._single_pass_analyze(template_text, layout_display, metrics, template_file_signed_url)

#         # Step 3: Deep analysis per section (parallel for speed)
#         if deep_analyze:
#             print(f"DEBUG: Deep analyzing {len(section_stubs)} sections in parallel…")
#             tasks = [
#                 self._deep_analyze_section(stub, template_text, layout_display, metrics)
#                 for stub in section_stubs
#             ]
#             # Run in batches of 5 to avoid overwhelming the API
#             batch_size = 5
#             sections = []
#             for i in range(0, len(tasks), batch_size):
#                 batch = tasks[i:i+batch_size]
#                 batch_results = await asyncio.gather(*batch, return_exceptions=True)
#                 for j, res in enumerate(batch_results):
#                     if isinstance(res, Exception):
#                         print(f"DEBUG: Section {i+j} analysis failed: {res}")
#                         sections.append(section_stubs[i+j])  # use stub
#                     else:
#                         sections.append(res)
#         else:
#             sections = section_stubs

#         # Step 4: Assemble final result
#         sections = sorted(sections, key=lambda s: s.get("order", 0))
#         all_fields = self._build_all_fields(sections)

#         result = {
#             "template_name": self._infer_template_name(template_text),
#             "document_type": self._infer_document_type(template_text),
#             "total_sections": len(sections),
#             "estimated_draft_length": self._estimate_draft_length(sections),
#             "page_metrics": metrics,
#             "all_fields": all_fields,
#             "sections": sections,
#         }

#         print(f"DEBUG: Analysis complete — {len(sections)} sections, {len(all_fields)} fields.")
#         return result

#     async def _single_pass_analyze(
#         self,
#         template_text: str,
#         layout_display: str,
#         metrics: Dict[str, Any],
#         template_file_signed_url: Optional[str],
#     ) -> dict:
#         """Fallback: single LLM call (original approach, maximally verbose)."""
#         word_count = len(template_text.split())
#         char_count = len(template_text)
#         url_context = f"\nTEMPLATE URL: {template_file_signed_url}\n" if template_file_signed_url else ""

#         prompt = f"""Analyse this legal template. Extract EVERY DISTINCT SECTION (including all sub-sections, prayer clauses, individual grounds, each annexure, etc.) with format blueprints and fields.

# {url_context}
# STATS: {word_count} words, {char_count} chars
# PAGE METRICS: {json.dumps(metrics)}

# LAYOUT BLUEPRINT:
# {layout_display}

# TEMPLATE:
# \"\"\"{template_text}\"\"\"

# BE MAXIMALLY GRANULAR — if Prayer has 5 clauses, that is 5 sections. If there are 8 Grounds, those are 8 sections. Each Annexure is its own section.

# Return JSON following this schema:
# {{
#   "template_name": "...",
#   "document_type": "...",
#   "total_sections": <int>,
#   "estimated_draft_length": "...",
#   "page_metrics": {json.dumps(metrics)},
#   "all_fields": [ /* all fields with section_id */ ],
#   "sections": [
#     {{
#       "section_id": "...",
#       "section_name": "...",
#       "section_category": "...",
#       "section_purpose": "...",
#       "order": 1,
#       "is_subsection": false,
#       "parent_section_id": null,
#       "page_break_before": false,
#       "estimated_words": 300,
#       "depends_on": [],
#       "format_instructions": "...",
#       "boilerplate_text": "...",
#       "format_blueprint": [
#         {{"align": "CENTER", "text": "...", "style": "UPPERCASE", "is_boilerplate": true, "is_field": false, "is_numbered": false, "is_multiline": false, "note": ""}}
#       ],
#       "fields": [
#         {{"key": "...", "type": "string", "label": "...", "required": true, "default_value": "", "validation_rules": "", "description": ""}}
#       ]
#     }}
#   ]
# }}
# """
#         result = await self._call_gemini(prompt, max_output_tokens=16384, timeout=300.0)
#         return self._post_process_analysis(result, metrics)

#     # ══════════════════════════════════════════════════════════════════════
#     #  PHASE 2 / 3 — Section prompt generation
#     # ══════════════════════════════════════════════════════════════════════

#     async def generate_section_prompts(self, section_data: dict) -> dict:
#         section_name = section_data.get("section_name", "Section")
#         blueprint = section_data.get("format_blueprint", [])
#         field_keys = [f.get("key") for f in section_data.get("fields", [])]
#         format_spec = self._blueprint_to_prompt_spec(blueprint, section_name)
#         boilerplate_lines = [
#             e.get("text", "") for e in blueprint
#             if e.get("is_boilerplate") and e.get("text")
#         ]
#         boilerplate_display = "\n".join(f"  • {bl}" for bl in boilerplate_lines) or "(none)"

#         prompt = f"""Create a comprehensive "Master Prompt" for drafting the "{section_name}" section in the EXACT format of the original template.

# SECTION DATA:
# {json.dumps(section_data, indent=2)}

# FORMAT SPEC:
# {format_spec}

# BOILERPLATE (must appear verbatim):
# {boilerplate_display}

# FIELDS: {json.dumps(field_keys)}

# Return ONLY valid JSON:
# {{
#   "section_intro": "...",
#   "drafting_complexity": "simple|moderate|complex",
#   "estimated_output_words": <int>,
#   "field_prompts": [
#     {{"field_id": "master_instruction", "prompt": "<full instructions>"}}
#   ],
#   "dependencies": [],
#   "legal_references": []
# }}
# """
#         return await self._call_gemini(prompt, max_output_tokens=8192)

#     # ══════════════════════════════════════════════════════════════════════
#     #  PHASE 4 / 5 — Validation
#     # ══════════════════════════════════════════════════════════════════════

#     async def validate_input(self, field_info: dict, user_input: str) -> dict:
#         prompt = f"""Validate this input for a legal document field.
# FIELD RULES: {json.dumps(field_info)}
# USER INPUT: \"{user_input}\"
# Return ONLY: {{"valid": true}} OR {{"valid": false, "error_prompt": "...", "suggestion": "..."}}"""
#         return await self._call_gemini(prompt)

#     # ══════════════════════════════════════════════════════════════════════
#     #  PHASE 6 — Section content generation (chunked for large sections)
#     # ══════════════════════════════════════════════════════════════════════

#     async def generate_section_content(
#         self,
#         section_data: dict,
#         field_values: dict,
#         max_output_tokens: int = None,
#         target_words_min: int = 200,
#         target_words_max: int = 10000,
#     ) -> str:
#         """Generate the drafted text for one section with alignment markers.
#         For large sections (estimated_words > CHUNK_THRESHOLD_WORDS),
#         automatically splits generation into chunks and concatenates."""

#         estimated_words = section_data.get("estimated_words", 500)
#         section_name = section_data.get("section_name", "Section")

#         # Determine if we need chunking
#         if estimated_words > self.CHUNK_THRESHOLD_WORDS and section_data.get("format_blueprint"):
#             print(f"DEBUG: Section '{section_name}' is large ({estimated_words} words) — chunking…")
#             return await self._generate_section_chunked(section_data, field_values, target_words_max)

#         return await self._generate_section_single(
#             section_data, field_values,
#             max_output_tokens or self.MAX_TOKENS_TEXT,
#             target_words_min, target_words_max
#         )

#     async def _generate_section_single(
#         self,
#         section_data: dict,
#         field_values: dict,
#         max_output_tokens: int,
#         target_words_min: int,
#         target_words_max: int,
#     ) -> str:
#         """Generate a section in a single LLM call."""

#         section_name = section_data.get("section_name", "Section")
#         section_id = section_data.get("section_id", "")
#         blueprint = section_data.get("format_blueprint", [])
#         format_spec = self._blueprint_to_prompt_spec(blueprint, section_name)

#         master_instruction = ""
#         for p in (section_data.get("section_prompts") or section_data.get("field_prompts") or []):
#             if isinstance(p, dict):
#                 master_instruction = p.get("prompt", "")
#                 if master_instruction:
#                     break

#         boilerplate_lines = [
#             e.get("text", "") for e in blueprint
#             if e.get("is_boilerplate") and e.get("text")
#         ]
#         boilerplate_display = "\n".join(boilerplate_lines) or "(none)"

#         is_subsection = section_data.get("is_subsection", False)
#         parent_id = section_data.get("parent_section_id", "")
#         subsection_note = (
#             f"\nNOTE: This is a sub-section of '{parent_id}'. Generate ONLY the content for '{section_name}', "
#             f"not the parent section.\n"
#             if is_subsection else ""
#         )

#         prompt = f"""Generate the "{section_name}" section of a legal document with EXACT alignment markers.
# {subsection_note}
# ═══ SECTION: {section_name} | ID: {section_id} ═══
# PURPOSE: {section_data.get("section_purpose", "")}
# CATEGORY: {section_data.get("section_category", "")}

# ALIGNMENT LEGEND (prefix EVERY line):
#   [CENTER]           → centred text
#   [LEFT_INDENT]      → standard body indent
#   [LEFT_INDENT_MORE] → deeper indent / sub-content
#   [RIGHT]            → right-aligned
#   [TABLE_ROW]        → table row (use | between columns)
#   [SEPARATOR]        → ruled line
#   [BLANK]            → empty spacing line

# FORMAT SPEC (follow line-by-line):
# {format_spec}

# BOILERPLATE (reproduce VERBATIM):
# {boilerplate_display}

# MASTER INSTRUCTIONS:
# {master_instruction or section_data.get("format_instructions", "Use standard legal formatting for this section type.")}

# USER-PROVIDED VALUES:
# {json.dumps(field_values, indent=2)}

# RULES:
# 1. Prefix EVERY output line with [ALIGNMENT_MARKER].
# 2. Follow the FORMAT SPEC sequence exactly.
# 3. Reproduce all BOILERPLATE verbatim.
# 4. Insert field values at {{field_key}} positions; use [________] if missing.
# 5. For NUMBERED / MULTILINE entries, generate as many items as needed for a complete document.
# 6. Legal tone; third-person except affidavits (first-person).
# 7. Length: {target_words_min}–{target_words_max} words.
# 8. Output plain text ONLY — no JSON, no markdown.

# Generate now:"""

#         return await self._call_gemini_text(prompt, max_output_tokens=max_output_tokens, timeout=600.0)

#     async def _generate_section_chunked(
#         self,
#         section_data: dict,
#         field_values: dict,
#         target_words_max: int,
#     ) -> str:
#         """Split a large section into logical chunks and generate each chunk
#         separately, then concatenate. Used for Facts, Grounds, Affidavit, etc."""

#         section_name = section_data.get("section_name", "Section")
#         blueprint = section_data.get("format_blueprint", [])
#         estimated_words = section_data.get("estimated_words", 1500)

#         # Split blueprint into chunks of ~20 lines each
#         chunk_size = 20
#         blueprint_chunks = [
#             blueprint[i:i+chunk_size]
#             for i in range(0, max(len(blueprint), 1), chunk_size)
#         ] or [[]]

#         # If blueprint is empty, just split by estimated word count
#         if not blueprint or len(blueprint_chunks) == 1:
#             num_chunks = max(2, math.ceil(estimated_words / self.CHUNK_THRESHOLD_WORDS))
#             # Generate with continuation prompts
#             return await self._generate_with_continuation(
#                 section_data, field_values, target_words_max, num_chunks
#             )

#         # Generate each blueprint chunk
#         parts = []
#         for chunk_idx, bp_chunk in enumerate(blueprint_chunks):
#             chunk_section = {
#                 **section_data,
#                 "format_blueprint": bp_chunk,
#                 "section_name": section_name,
#                 "section_purpose": (
#                     section_data.get("section_purpose", "") +
#                     f" [Part {chunk_idx + 1}/{len(blueprint_chunks)}]"
#                 ),
#             }
#             words_per_chunk = max(200, target_words_max // len(blueprint_chunks))
#             print(f"DEBUG: Generating chunk {chunk_idx+1}/{len(blueprint_chunks)} for '{section_name}'…")
#             chunk_text = await self._generate_section_single(
#                 chunk_section, field_values,
#                 self.MAX_TOKENS_TEXT, 100, words_per_chunk
#             )
#             parts.append(chunk_text)

#         return "\n".join(parts)

#     async def _generate_with_continuation(
#         self,
#         section_data: dict,
#         field_values: dict,
#         target_words_max: int,
#         num_chunks: int,
#     ) -> str:
#         """Generate a long section using continuation prompts. Each call
#         picks up where the previous one left off."""

#         section_name = section_data.get("section_name", "Section")
#         words_per_chunk = max(500, target_words_max // num_chunks)
#         parts = []
#         previous_ending = ""

#         for chunk_idx in range(num_chunks):
#             is_first = chunk_idx == 0
#             is_last = chunk_idx == num_chunks - 1

#             continuation_context = ""
#             if previous_ending:
#                 continuation_context = f"\nCONTINUATION — the previous chunk ended with:\n\"\"\"{previous_ending[-500:]}\"\"\"\nContinue SEAMLESSLY from where it left off.\n"

#             chunk_section = {
#                 **section_data,
#                 "section_purpose": (
#                     section_data.get("section_purpose", "") +
#                     f" (Part {chunk_idx+1}/{num_chunks})"
#                     + (" — START of section" if is_first else "")
#                     + (" — END of section, include closing clauses" if is_last else "")
#                 ),
#             }

#             if continuation_context:
#                 chunk_section["format_instructions"] = (
#                     (section_data.get("format_instructions", "") or "") +
#                     continuation_context
#                 )

#             print(f"DEBUG: Continuation chunk {chunk_idx+1}/{num_chunks} for '{section_name}'…")
#             chunk_text = await self._generate_section_single(
#                 chunk_section, field_values, self.MAX_TOKENS_TEXT,
#                 words_per_chunk - 100, words_per_chunk
#             )
#             parts.append(chunk_text)

#             # Extract the last ~500 chars for next continuation
#             previous_ending = chunk_text[-500:] if chunk_text else ""

#         return "\n".join(parts)

#     # ══════════════════════════════════════════════════════════════════════
#     #  FULL DRAFT ASSEMBLY — 500+ pages
#     # ══════════════════════════════════════════════════════════════════════

#     async def assemble_full_draft(
#         self,
#         analysis_result: dict,
#         section_prompts: Dict[str, dict],
#         field_values: dict,
#         output_format: str = "plain",
#         concurrency: int = 3,
#     ) -> str:
#         """Generate all sections in template order and assemble into a complete
#         document. Supports 500+ page output by chunking large sections.

#         Args:
#             analysis_result: Output from analyze_template()
#             section_prompts: {section_id: output from generate_section_prompts()}
#             field_values: Flat dict of all user-provided values
#             output_format: "plain" | "html" | "raw"
#             concurrency: Number of sections to generate in parallel (default 3)
#         """

#         sections = sorted(
#             analysis_result.get("sections", []),
#             key=lambda s: s.get("order", 0),
#         )

#         metrics = analysis_result.get("page_metrics", {})
#         pw = metrics.get("page_width", 80)
#         si = max(metrics.get("std_indent", 15), 5)
#         di = max(metrics.get("deep_indent", 25), si + 5)

#         print(f"DEBUG: Assembling full draft — {len(sections)} sections, format={output_format}…")

#         # Process sections in batches for concurrency
#         draft_parts: List[Tuple[int, str]] = []  # (order, text)

#         for i in range(0, len(sections), concurrency):
#             batch = sections[i:i+concurrency]
#             tasks = []
#             for sec in batch:
#                 sid = sec.get("section_id", "")
#                 merged = {**sec}
#                 if sid in section_prompts:
#                     sp = section_prompts[sid]
#                     merged["section_prompts"] = sp.get("field_prompts", [])
#                     merged["section_intro"] = sp.get("section_intro", "")
#                 tasks.append(self.generate_section_content(
#                     section_data=merged, field_values=field_values,
#                 ))

#             results = await asyncio.gather(*tasks, return_exceptions=True)

#             for sec, raw in zip(batch, results):
#                 if isinstance(raw, Exception):
#                     print(f"DEBUG: Section '{sec.get('section_name')}' failed: {raw}")
#                     raw = f"[SECTION GENERATION FAILED: {sec.get('section_name')}]"

#                 if output_format == "html":
#                     formatted = self.format_to_html(raw)
#                     if sec.get("page_break_before"):
#                         formatted = '<div style="page-break-before: always;"></div>\n' + formatted
#                 elif output_format == "plain":
#                     formatted = self.format_to_plain_text(raw, page_width=pw, std_indent=si, deep_indent=di)
#                     if sec.get("page_break_before"):
#                         formatted = "\f" + formatted
#                 else:
#                     formatted = raw

#                 draft_parts.append((sec.get("order", 0), formatted))
#                 print(f"DEBUG: ✓ Section '{sec.get('section_name')}' — {len(formatted.split())} words")

#         # Sort by order (in case async results came out of order)
#         draft_parts.sort(key=lambda x: x[0])
#         parts_text = [p[1] for p in draft_parts]

#         sep = "\n\n" if output_format != "html" else "\n"
#         full_draft = sep.join(parts_text)
#         total_words = len(full_draft.split())
#         print(f"DEBUG: ✓ Full draft assembled — {len(full_draft)} chars, {total_words} words.")
#         return full_draft

#     # ══════════════════════════════════════════════════════════════════════
#     #  OUTPUT FORMATTERS
#     # ══════════════════════════════════════════════════════════════════════

#     @staticmethod
#     def format_to_plain_text(
#         raw_section: str, page_width: int = 80, std_indent: int = 15, deep_indent: int = 25
#     ) -> str:
#         out: List[str] = []
#         for line in raw_section.split("\n"):
#             stripped = line.strip()
#             m = re.match(
#                 r"\[(CENTER|LEFT_INDENT_MORE|LEFT_INDENT|LEFT|RIGHT|TABLE_ROW|SEPARATOR|BLANK)\]\s*(.*)",
#                 stripped,
#             )
#             if m:
#                 align, text = m.group(1), m.group(2).strip()
#             else:
#                 align, text = Align.LEFT_INDENT, stripped
#             if align == Align.BLANK or not text:
#                 out.append("")
#             elif align == Align.CENTER:
#                 out.append(text.center(page_width))
#             elif align == Align.RIGHT:
#                 out.append(text.rjust(page_width))
#             elif align == Align.LEFT_INDENT_MORE:
#                 out.append(" " * deep_indent + text)
#             elif align in (Align.LEFT_INDENT, Align.LEFT):
#                 out.append(" " * std_indent + text)
#             elif align == Align.SEPARATOR:
#                 out.append(" " * std_indent + "_" * (page_width - std_indent))
#             elif align == Align.TABLE_ROW:
#                 parts = [p.strip() for p in text.split("|")]
#                 if len(parts) >= 2:
#                     col_width = (page_width - std_indent) // len(parts)
#                     row = " " * std_indent + "".join(p.ljust(col_width) for p in parts)
#                     out.append(row)
#                 else:
#                     out.append(" " * std_indent + text)
#             else:
#                 out.append(" " * std_indent + text)
#         return "\n".join(out)

#     @staticmethod
#     def format_to_html(raw_section: str) -> str:
#         style_map = {
#             Align.CENTER: "text-align: center;",
#             Align.RIGHT: "text-align: right; padding-right: 0.5in;",
#             Align.LEFT_INDENT: "text-align: left; margin-left: 1.5in;",
#             Align.LEFT_INDENT_MORE: "text-align: left; margin-left: 2.5in;",
#             Align.LEFT: "text-align: left;",
#             Align.TABLE_ROW: "text-align: left; margin-left: 1.5in; font-family: monospace; white-space: pre;",
#             Align.SEPARATOR: "text-align: left; margin-left: 1.5in;",
#         }
#         html = [
#             '<div class="legal-section" style="font-family: \'Times New Roman\', serif; '
#             'font-size: 14px; line-height: 1.8; max-width: 8.5in; margin: auto;">'
#         ]
#         for line in raw_section.split("\n"):
#             stripped = line.strip()
#             m = re.match(
#                 r"\[(CENTER|LEFT_INDENT_MORE|LEFT_INDENT|LEFT|RIGHT|TABLE_ROW|SEPARATOR|BLANK)\]\s*(.*)",
#                 stripped,
#             )
#             if m:
#                 align, text = m.group(1), m.group(2).strip()
#             else:
#                 align, text = Align.LEFT_INDENT, stripped
#             if align == Align.BLANK or not text:
#                 html.append('<p style="margin: 0; min-height: 1em;">&nbsp;</p>')
#             elif align == Align.SEPARATOR:
#                 html.append('<hr style="margin-left: 1.5in; border: none; border-top: 1px solid black;" />')
#             else:
#                 style = style_map.get(align, "text-align: left;")
#                 if text == text.upper() and len(text) > 3 and not text.startswith("("):
#                     style += " font-weight: bold;"
#                 escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
#                 html.append(f'<p style="margin: 2px 0; {style}">{escaped}</p>')
#         html.append("</div>")
#         return "\n".join(html)

#     # ══════════════════════════════════════════════════════════════════════
#     #  PRIVATE HELPERS
#     # ══════════════════════════════════════════════════════════════════════

#     @staticmethod
#     def _build_all_fields(sections: list) -> list:
#         all_fields = []
#         seen = set()
#         for sec in sections:
#             sid = sec.get("section_id", "")
#             for f in sec.get("fields", []):
#                 key = f.get("key")
#                 if key and key not in seen:
#                     seen.add(key)
#                     all_fields.append({**f, "section_id": sid})
#         return all_fields

#     @staticmethod
#     def _infer_template_name(template_text: str) -> str:
#         first_non_blank = next(
#             (line.strip() for line in template_text.split("\n") if line.strip()), ""
#         )
#         return first_non_blank[:100] or "Legal Document"

#     @staticmethod
#     def _infer_document_type(template_text: str) -> str:
#         lower = template_text.lower()
#         types = [
#             ("writ petition", "Writ Petition"),
#             ("special leave petition", "Special Leave Petition"),
#             ("bail application", "Bail Application"),
#             ("lease deed", "Lease Deed"),
#             ("power of attorney", "Power of Attorney"),
#             ("affidavit", "Affidavit"),
#             ("memorandum of understanding", "Memorandum of Understanding"),
#             ("agreement", "Agreement"),
#             ("application", "Application"),
#             ("petition", "Petition"),
#             ("contract", "Contract"),
#             ("notice", "Legal Notice"),
#         ]
#         for keyword, doc_type in types:
#             if keyword in lower:
#                 return doc_type
#         return "Legal Document"

#     @staticmethod
#     def _estimate_draft_length(sections: list) -> str:
#         total_words = sum(s.get("estimated_words", 300) for s in sections)
#         pages = max(1, total_words // 250)
#         return f"~{pages} pages ({total_words:,} words estimated)"

#     @staticmethod
#     def _post_process_analysis(result: dict, metrics: Dict[str, Any] = None) -> dict:
#         if "sections" in result and "all_fields" not in result:
#             result["all_fields"] = AntigravityAgent._build_all_fields(result["sections"])
#         for idx, sec in enumerate(result.get("sections", []), start=1):
#             sec.setdefault("order", idx)
#             sec.setdefault("page_break_before", False)
#             sec.setdefault("format_blueprint", [])
#             sec.setdefault("depends_on", [])
#             sec.setdefault("is_subsection", False)
#             sec.setdefault("parent_section_id", None)
#             sec.setdefault("fields", [])
#         result["sections"] = sorted(result.get("sections", []), key=lambda s: s.get("order", 0))
#         result["total_sections"] = len(result.get("sections", []))
#         if metrics:
#             result["page_metrics"] = metrics
#         return result

#     @staticmethod
#     def _blueprint_to_prompt_spec(blueprint: list, section_name: str) -> str:
#         if not blueprint:
#             return f"(No blueprint — use standard legal formatting for '{section_name}')"
#         lines = [f"FORMAT SPEC FOR: {section_name}", "─" * 55]
#         for i, entry in enumerate(blueprint, start=1):
#             align = entry.get("align", "LEFT_INDENT")
#             text = entry.get("text", "")
#             style = entry.get("style", "normal")
#             tags = []
#             if entry.get("is_boilerplate"):
#                 tags.append("BOILERPLATE")
#             if entry.get("is_field"):
#                 tags.append("FIELD")
#             if entry.get("is_numbered"):
#                 tags.append("NUMBERED")
#             if entry.get("is_multiline"):
#                 tags.append("MULTILINE")
#             note = entry.get("note", "")
#             tag_str = f" [{', '.join(tags)}]" if tags else ""
#             style_str = f" (style:{style})" if style and style != "normal" else ""
#             text_str = f' "{text}"' if text else ""
#             note_str = f"\n           ↳ {note}" if note else ""
#             lines.append(f"  Line {i:2d}: [{align}]{text_str}{style_str}{tag_str}{note_str}")
#         return "\n".join(lines)




"""
antigravity_agent.py
THE CORE CONCEPT:
  Sections = the STRUCTURAL HEADINGS of the uploaded template itself.
  Writ Petition  -> Case Title | Index | Synopsis | Facts | Grounds | Prayer | Affidavit
  Rent Deed      -> Deed Header | Parties | Recitals | Tenancy Terms | Covenants | Execution
  NOT individual sentences like "WHEREAS the House owner is the sole absolute owner of"
"""
from google import genai
try:
    import google.adk as adk
except ImportError:
    adk = None
import json, re, asyncio, math, time
from urllib import request as urllib_request, error as urllib_error
from typing import Optional, List, Dict, Any, Tuple
from ..config import settings

class Align:
    CENTER = "CENTER"; LEFT = "LEFT"; LEFT_INDENT = "LEFT_INDENT"
    LEFT_INDENT_MORE = "LEFT_INDENT_MORE"; RIGHT = "RIGHT"
    TABLE_ROW = "TABLE_ROW"; SEPARATOR = "SEPARATOR"; BLANK = "BLANK"

def _compute_page_metrics(template_text: str) -> Dict[str, Any]:
    from collections import Counter
    all_indents, all_ends = [], []
    for line in template_text.split("\n"):
        if not line.strip(): continue
        rstripped = line.rstrip()
        leading = len(rstripped) - len(rstripped.lstrip())
        text_len = len(rstripped.strip())
        all_indents.append(leading); all_ends.append(leading + text_len)
    if not all_indents:
        return {"page_width":80,"std_indent":0,"deep_indent":10,"right_zone_start":50}
    page_width = max(all_ends)
    indent_counts = Counter(i for i in all_indents if i > 0)
    std_indent = indent_counts.most_common(1)[0][0] if indent_counts else 0
    min_deep = std_indent + max(5, int(std_indent * 0.4))
    deeper = {i:c for i,c in indent_counts.items() if i >= min_deep}
    deep_indent = max(deeper, key=deeper.get) if deeper else std_indent + 10
    return {"page_width":page_width,"std_indent":std_indent,
            "deep_indent":deep_indent,"right_zone_start":page_width*0.50}

def _classify_line(line: str, metrics: Dict[str, Any]) -> Tuple[str, str, int]:
    stripped = line.strip()
    if not stripped: return (Align.BLANK, "", 0)
    if re.match(r"^[_\-=\s*]{8,}$", stripped): return (Align.SEPARATOR, stripped, 0)
    rstripped = line.rstrip()
    leading = len(rstripped) - len(rstripped.lstrip())
    text_len = len(stripped); end_pos = leading + text_len
    pw=metrics["page_width"]; std_indent=metrics["std_indent"]
    deep_indent=metrics["deep_indent"]; right_zone=metrics["right_zone_start"]
    if leading >= right_zone and end_pos > pw*0.70 and text_len < pw*0.45:
        return (Align.RIGHT, stripped, leading)
    if leading >= deep_indent and leading > std_indent and text_len > pw*0.35:
        return (Align.LEFT_INDENT_MORE, stripped, leading)
    text_center = leading + text_len/2; page_center = pw/2
    is_short_heading = (text_len < 20 and stripped == stripped.upper()
                        and stripped.replace(" ","").isalpha())
    if is_short_heading and abs(text_center - page_center) < pw*0.20:
        return (Align.CENTER, stripped, leading)
    if leading > std_indent+5 and abs(text_center-page_center) < pw*0.15 and text_len < pw*0.6:
        return (Align.CENTER, stripped, leading)
    if leading >= deep_indent and leading > std_indent:
        return (Align.LEFT_INDENT_MORE, stripped, leading)
    if leading >= std_indent and std_indent > 0:
        return (Align.LEFT_INDENT, stripped, leading)
    return (Align.LEFT, stripped, leading)

def _extract_layout_blueprint(template_text: str) -> List[Dict[str, Any]]:
    metrics = _compute_page_metrics(template_text)
    blueprint = []
    for page_idx, page in enumerate(template_text.split("\f"), start=1):
        for line_no, line in enumerate(page.split("\n"), start=1):
            align, text, indent = _classify_line(line, metrics)
            blueprint.append({"page":page_idx,"line_no":line_no,
                               "align":align,"text":text,"indent":indent})
    return blueprint

def _blueprint_to_display(blueprint: List[Dict[str, Any]], max_lines: int = 400) -> str:
    out, cur_page, count = [], 0, 0
    for entry in blueprint:
        if count >= max_lines:
            out.append(f"  ... (truncated at {max_lines} lines)"); break
        pg = entry["page"]
        if pg != cur_page:
            out.append(f"\n-- PAGE {pg} --"); cur_page = pg
        out.append(f"  [{entry['align']}] {entry['text']}"
                   if entry["align"] != Align.BLANK else "  [BLANK]")
        count += 1
    return "\n".join(out)

def _blueprint_to_prompt_spec(blueprint: list, section_name: str) -> str:
    if not blueprint:
        return f"(No blueprint - use standard legal formatting for '{section_name}')"
    lines = [f"FORMAT SPEC FOR: {section_name}", "-"*55]
    for i, e in enumerate(blueprint, 1):
        align = e.get("align","LEFT_INDENT"); text = e.get("text","")
        tags = [t for t,k in [("BOILERPLATE","is_boilerplate"),("FIELD","is_field"),
                               ("NUMBERED","is_numbered"),("MULTILINE","is_multiline")] if e.get(k)]
        tag_str = f" [{', '.join(tags)}]" if tags else ""
        note_str = f"\n           -> {e['note']}" if e.get("note") else ""
        lines.append(f"  Line {i:2d}: [{align}] \"{text}\"{tag_str}{note_str}")
    return "\n".join(lines)


def _clean_heading_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip(" -:\t")).strip()


def _heading_to_section_id(text: str, fallback_index: int) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "_", _clean_heading_text(text).lower()).strip("_")
    return cleaned or f"section_{fallback_index}"


def _extract_toc_heading_candidates(template_text: str) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    seen = set()
    lines = [_clean_heading_text(line) for line in template_text.splitlines()]
    collecting = False
    raw_entries: List[str] = []
    expect_title = False

    for raw_line in lines:
        line = re.sub(r"^[#*§\u25a0\u2605\-\s]+", "", raw_line).strip()
        if not line:
            continue

        upper = line.upper()
        if upper == "TABLE OF CONTENTS":
            collecting = True
            continue
        if not collecting:
            continue
        if upper.startswith("SECTION 1"):
            break
        if upper.startswith("JURINEX TEMPLATE |") or re.fullmatch(r"PAGE\s+\d+", upper):
            break
        if upper in {"SECTION", "TYPE", "GENERAL POWER OF ATTORNEY"}:
            continue
        if re.fullmatch(r"\d+", line) or re.fullmatch(r"[()\-\u2013\u2014]+", line):
            expect_title = True
            continue
        if not expect_title:
            continue
        if len(line) < 4 or len(line) > 120 or not re.search(r"[A-Za-z]", line):
            expect_title = False
            continue
        if (
            "<font" in line.lower()
            or "__" in line
            or re.search(r"\b(variable|standard|ai_injection)\b", line, re.IGNORECASE)
        ):
            expect_title = False
            continue
        raw_entries.append(line)
        expect_title = False

    numbered_idx = 1
    for entry in raw_entries:
        normalized = entry.lower()
        if normalized in seen:
            continue
        seen.add(normalized)

        if normalized.startswith("signature block") or normalized.startswith("notary /"):
            section_name = entry
        elif normalized.startswith("schedules"):
            section_name = f"SECTION {numbered_idx} - SCHEDULES"
            numbered_idx += 1
        else:
            section_name = f"SECTION {numbered_idx} - {entry}"
            numbered_idx += 1

        candidates.append({
            "section_name": section_name,
            "section_id": _heading_to_section_id(section_name, len(candidates) + 1),
            "order": len(candidates) + 1,
        })

    return candidates


def _extract_heading_candidates(template_text: str) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []
    seen = set()
    lines = [_clean_heading_text(line) for line in template_text.splitlines()]

    def _add_candidate(heading: str):
        cleaned = _clean_heading_text(re.sub(r"\s*\[[^\]]+\]\s*$", "", heading))
        if cleaned.lower().startswith("schedules ("):
            return
        normalized = re.sub(r"\s*[-:\u2013\u2014]+\s*", " ", cleaned).lower()
        if not cleaned or normalized in seen:
            return
        seen.add(normalized)
        candidates.append({
            "section_name": cleaned,
            "section_id": _heading_to_section_id(cleaned, len(candidates) + 1),
            "order": len(candidates) + 1,
        })

    for toc_candidate in _extract_toc_heading_candidates(template_text):
        _add_candidate(toc_candidate.get("section_name", ""))

    patterns = [
        re.compile(r"^(SECTION\s+\d+[A-Z]?(?:\s*[-.:\u2013\u2014]\s*|\s+)(.+))$", re.IGNORECASE),
        re.compile(r"^(SECTION\s+[A-Z](?:\s*[-.:\u2013\u2014]\s*|\s+)(.+))$", re.IGNORECASE),
        re.compile(r"^(SCHEDULE\s*[-\u2013\u2014]?\s*[A-Z](?:\s*[-.:\u2013\u2014]\s*|\s+)(.+))$", re.IGNORECASE),
        re.compile(r"^(EXECUTION(?:\s*&|\s+AND)?\s+SIGNATURE\s+BLOCK(?:\s*[-.:\u2013\u2014]\s*.*)?)$", re.IGNORECASE),
        re.compile(r"^(NOTARY\s*/\s*SUB-REGISTRAR\s+ACKNOWLEDGMENT)$", re.IGNORECASE),
    ]

    stitched_lines: List[str] = []
    idx = 0
    while idx < len(lines):
        line = re.sub(r"^[#*§\u25a0\u2605]+\s*", "", lines[idx]).strip()
        if not line:
            idx += 1
            continue

        stitched = line
        if re.match(r"^(SECTION|SCHEDULE)\b", line, re.IGNORECASE) and idx + 1 < len(lines):
            next_line = re.sub(r"^[#*§\u25a0\u2605]+\s*", "", lines[idx + 1]).strip()
            if (
                next_line
                and len(stitched) < 110
                and not re.match(r"^(SECTION|SCHEDULE|PAGE\s+\d+|JURINEX TEMPLATE \|)", next_line, re.IGNORECASE)
                and not re.match(r"^\d+(?:\.\d+)?\b", next_line)
                and not re.match(r"^SPECIAL CLAUSE$", next_line, re.IGNORECASE)
            ):
                stitched = f"{stitched} {next_line}"
                idx += 1

        stitched_lines.append(_clean_heading_text(stitched))
        idx += 1

    for line in stitched_lines:
        if not line:
            continue
        heading = None

        for pattern in patterns:
            match = pattern.match(line)
            if match:
                heading = _clean_heading_text(match.group(1))
                break

        if not heading and re.match(r"^\d{1,2}\s*[-.)]\s+[A-Z][A-Za-z0-9 ,&/'()\-]{4,}$", line):
            heading = _clean_heading_text(line)

        if not heading:
            continue

        if len(heading) > 140 or heading.endswith(" it shall be stamped at"):
            continue
        _add_candidate(heading)

    return candidates


def _heading_candidates_to_display(candidates: List[Dict[str, Any]], max_items: int = 40) -> str:
    if not candidates:
        return "(none detected)"
    lines = []
    for item in candidates[:max_items]:
        lines.append(f"  {item['order']}. {item['section_name']}")
    if len(candidates) > max_items:
        lines.append(f"  ... ({len(candidates) - max_items} more)")
    return "\n".join(lines)


class AntigravityAgent:
    MAX_TOKENS_JSON = 16384
    MAX_TOKENS_TEXT = 65536
    CHUNK_THRESHOLD_WORDS = 1500

    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY) if settings.GEMINI_API_KEY else None
        self.model_name = settings.GEMINI_MODEL
        self.anthropic_api_key = settings.ANTHROPIC_API_KEY
        self.anthropic_model = settings.ANTHROPIC_MODEL
        self.default_provider = (settings.DEFAULT_LLM_PROVIDER or "claude").strip().lower()
        self.section_extraction_provider = (settings.SECTION_EXTRACTION_PROVIDER or "claude").strip().lower()
        self.prompt_refinement_provider = (settings.PROMPT_REFINEMENT_PROVIDER or self.default_provider).strip().lower()
        self.text_generation_provider = (settings.TEXT_GENERATION_PROVIDER or self.default_provider).strip().lower()
        self.validation_provider = (settings.VALIDATION_PROVIDER or self.default_provider).strip().lower()

    async def _call_json(self, prompt: str, max_output_tokens: int = None, timeout: float = 300.0, provider: str = "auto") -> dict:
        selected_provider = (provider or "auto").strip().lower()
        if selected_provider == "auto":
            if self.default_provider == "gemini" and self.client:
                selected_provider = "gemini"
            elif self.default_provider == "claude" and self.anthropic_api_key:
                selected_provider = "claude"
            elif self.anthropic_api_key:
                selected_provider = "claude"
            elif self.client:
                selected_provider = "gemini"
            else:
                raise ValueError("No JSON-capable LLM is configured.")
        elif selected_provider == "claude" and not self.anthropic_api_key and self.client:
            print("DEBUG: Claude requested for JSON, but ANTHROPIC_API_KEY is missing. Falling back to Gemini.")
            selected_provider = "gemini"
        elif selected_provider == "gemini" and not self.client and self.anthropic_api_key:
            print("DEBUG: Gemini requested for JSON, but GEMINI_API_KEY is missing. Falling back to Claude.")
            selected_provider = "claude"

        if selected_provider == "claude":
            return await self._call_claude_json(prompt, max_output_tokens=max_output_tokens, timeout=timeout)
        if selected_provider == "gemini":
            return await self._call_gemini(prompt, max_output_tokens=max_output_tokens, timeout=timeout)
        raise ValueError(f"Unsupported JSON provider: {selected_provider}")

    async def _call_text(self, prompt: str, max_output_tokens: int = None, timeout: float = 600.0, provider: str = "auto") -> str:
        selected_provider = (provider or "auto").strip().lower()
        if selected_provider == "auto":
            if self.default_provider == "gemini" and self.client:
                selected_provider = "gemini"
            elif self.default_provider == "claude" and self.anthropic_api_key:
                selected_provider = "claude"
            elif self.anthropic_api_key:
                selected_provider = "claude"
            elif self.client:
                selected_provider = "gemini"
            else:
                raise ValueError("No text-capable LLM is configured.")
        elif selected_provider == "claude" and not self.anthropic_api_key and self.client:
            print("DEBUG: Claude requested for text, but ANTHROPIC_API_KEY is missing. Falling back to Gemini.")
            selected_provider = "gemini"
        elif selected_provider == "gemini" and not self.client and self.anthropic_api_key:
            print("DEBUG: Gemini requested for text, but GEMINI_API_KEY is missing. Falling back to Claude.")
            selected_provider = "claude"

        if selected_provider == "claude":
            return await self._call_claude_text(prompt, max_output_tokens=max_output_tokens, timeout=timeout)
        if selected_provider == "gemini":
            return await self._call_gemini_text(prompt, max_output_tokens=max_output_tokens, timeout=timeout)
        raise ValueError(f"Unsupported text provider: {selected_provider}")

    async def _call_gemini(self, prompt: str, max_output_tokens: int = None, timeout: float = 300.0) -> dict:
        if not self.client:
            raise ValueError("GEMINI_API_KEY is not configured.")
        max_tok = max_output_tokens or self.MAX_TOKENS_JSON
        print(f"DEBUG: Gemini JSON call (max_tokens={max_tok})...")
        try:
            response = await asyncio.wait_for(
                self.client.aio.models.generate_content(
                    model=self.model_name, contents=prompt,
                    config={"response_mime_type":"application/json",
                            "max_output_tokens":max_tok,"temperature":0.1}),
                timeout=timeout)
        except asyncio.TimeoutError:
            raise ValueError(f"Gemini timed out ({timeout}s). Retry.")
        except Exception as e:
            print(f"DEBUG: Gemini failed: {e}"); raise
        text = (response.text or "").strip()
        clean = self._extract_json(text)
        try:
            result = json.loads(clean)
        except json.JSONDecodeError:
            result = await self._auto_fix_json(clean)
        if not isinstance(result, dict):
            print(f"DEBUG: _call_gemini got non-dict result (type={type(result).__name__}), returning empty dict")
            return {}
        return result

    async def _call_claude_json(self, prompt: str, max_output_tokens: int = None, timeout: float = 300.0) -> dict:
        if not self.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is not configured.")

        max_tok = max_output_tokens or self.MAX_TOKENS_JSON
        print(f"DEBUG: Claude JSON call (model={self.anthropic_model}, max_tokens={max_tok})...")

        payload = json.dumps({
            "model": self.anthropic_model,
            "max_tokens": max_tok,
            "temperature": 0.1,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }).encode("utf-8")

        def _send_request() -> dict:
            req = urllib_request.Request(
                "https://api.anthropic.com/v1/messages",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": self.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                },
                method="POST",
            )
            with urllib_request.urlopen(req, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))

        last_err = None
        for attempt in range(3):
            if attempt > 0:
                wait = 15 * attempt
                print(f"DEBUG: Claude JSON retry {attempt}/2 after {wait}s (prev error: {last_err})...")
                await asyncio.sleep(wait)
            try:
                raw = await asyncio.wait_for(asyncio.to_thread(_send_request), timeout=timeout + 5)
                last_err = None
                break
            except asyncio.TimeoutError:
                last_err = f"timeout after {timeout}s"
                continue
            except urllib_error.HTTPError as e:
                last_err = f"HTTP {e.code}"
                if e.code in (429, 529, 503, 500):
                    continue  # retryable
                raise
            except Exception as e:
                last_err = str(e)
                print(f"DEBUG: Claude JSON failed: {e}")
                raise
        if last_err:
            raise ValueError(f"Claude JSON call failed after 3 attempts: {last_err}")

        content = raw.get("content", [])
        text = "".join(part.get("text", "") for part in content if isinstance(part, dict) and part.get("type") == "text").strip()
        clean = self._extract_json(text)
        try:
            result = json.loads(clean)
        except json.JSONDecodeError:
            result = await self._auto_fix_json(clean)
        if not isinstance(result, dict):
            print(f"DEBUG: _call_claude_json got non-dict result (type={type(result).__name__}), returning empty dict")
            return {}
        return result

    async def _call_gemini_text(self, prompt: str, max_output_tokens: int = None, timeout: float = 600.0) -> str:
        if not self.client:
            raise ValueError("GEMINI_API_KEY is not configured for text generation.")
        max_tok = min(max_output_tokens or self.MAX_TOKENS_TEXT, self.MAX_TOKENS_TEXT)
        print(f"DEBUG: Gemini plain-text call (max_tokens={max_tok})...")
        try:
            response = await asyncio.wait_for(
                self.client.aio.models.generate_content(
                    model=self.model_name, contents=prompt,
                    config={"max_output_tokens":max_tok,"temperature":0.2}),
                timeout=timeout)
            return (response.text or "").strip()
        except asyncio.TimeoutError:
            raise ValueError(f"Gemini timed out ({timeout}s).")
        except Exception as e:
            print(f"DEBUG: Gemini failed: {e}"); raise

    async def _call_claude_text(self, prompt: str, max_output_tokens: int = None, timeout: float = 600.0) -> str:
        if not self.anthropic_api_key:
            raise ValueError("ANTHROPIC_API_KEY is not configured for text generation.")

        max_tok = min(max_output_tokens or self.MAX_TOKENS_TEXT, self.MAX_TOKENS_TEXT)
        print(f"DEBUG: Claude plain-text call (model={self.anthropic_model}, max_tokens={max_tok})...")

        payload = json.dumps({
            "model": self.anthropic_model,
            "max_tokens": max_tok,
            "temperature": 0.2,
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        }).encode("utf-8")

        def _send_request() -> dict:
            req = urllib_request.Request(
                "https://api.anthropic.com/v1/messages",
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": self.anthropic_api_key,
                    "anthropic-version": "2023-06-01",
                },
                method="POST",
            )
            with urllib_request.urlopen(req, timeout=timeout) as response:
                return json.loads(response.read().decode("utf-8"))

        last_err = None
        raw = None
        for attempt in range(3):
            if attempt > 0:
                wait = 15 * attempt
                print(f"DEBUG: Claude text retry {attempt}/2 after {wait}s (prev error: {last_err})...")
                await asyncio.sleep(wait)
            try:
                raw = await asyncio.wait_for(asyncio.to_thread(_send_request), timeout=timeout + 5)
                last_err = None
                break
            except asyncio.TimeoutError:
                last_err = f"timeout after {timeout}s"
                continue
            except urllib_error.HTTPError as e:
                last_err = f"HTTP {e.code}"
                if e.code in (429, 529, 503, 500):
                    continue
                raise
            except Exception as e:
                last_err = str(e)
                print(f"DEBUG: Claude text failed: {e}")
                raise
        if last_err:
            raise ValueError(f"Claude text call failed after 3 attempts: {last_err}")
        return "".join(
            part.get("text", "")
            for part in raw.get("content", [])
            if isinstance(part, dict) and part.get("type") == "text"
        ).strip()

    @staticmethod
    def _extract_json(text: str) -> str:
        m = re.search(r"```(?:json)?\s*\n?(\{[\s\S]*?\})\s*\n?```", text)
        raw = m.group(1) if m else (re.search(r"(\{[\s\S]*\})", text) or
                                    type("X",(),{"group":lambda s,i:text})()).group(1)
        raw = re.sub(r",\s*([\]}])", r"\1", raw)
        raw = re.sub(r"[\x00-\x1F\x7F]", "", raw)
        raw = re.sub(r'\\(?!["\\/bfnrt])(?!u[0-9a-fA-F]{4})', r"\\\\", raw)
        return raw

    async def _auto_fix_json(self, broken: str) -> dict:
        use_claude_first = (self.default_provider == "claude" and self.anthropic_api_key) or (not self.client and self.anthropic_api_key)
        if use_claude_first:
            payload = json.dumps({
                "model": self.anthropic_model,
                "max_tokens": 8192,
                "temperature": 0.0,
                "messages": [
                    {
                        "role": "user",
                        "content": "Fix JSON syntax errors. Return ONLY valid JSON.\n\n" + broken[:12000]
                    }
                ]
            }).encode("utf-8")

            def _send_fix_request() -> dict:
                req = urllib_request.Request(
                    "https://api.anthropic.com/v1/messages",
                    data=payload,
                    headers={
                        "Content-Type": "application/json",
                        "x-api-key": self.anthropic_api_key,
                        "anthropic-version": "2023-06-01",
                    },
                    method="POST",
                )
                with urllib_request.urlopen(req, timeout=60) as response:
                    return json.loads(response.read().decode("utf-8"))

            raw = await asyncio.wait_for(asyncio.to_thread(_send_fix_request), timeout=65.0)
            fixed_text = "".join(
                part.get("text", "")
                for part in raw.get("content", [])
                if isinstance(part, dict) and part.get("type") == "text"
            ).strip()
        elif self.client:
            resp = await asyncio.wait_for(
                self.client.aio.models.generate_content(
                    model=self.model_name,
                    contents="Fix JSON syntax errors. Return ONLY valid JSON.\n\n" + broken[:12000],
                    config={"response_mime_type":"application/json",
                            "max_output_tokens":8192,"temperature":0.0}),
                timeout=60.0)
            fixed_text = (resp.text or "").strip()
        else:
            raise ValueError("No LLM API key is configured for JSON auto-fix.")

        result = json.loads(self._extract_json(fixed_text))
        if not isinstance(result, dict):
            print(f"DEBUG: _auto_fix_json got non-dict result (type={type(result).__name__}), returning empty dict")
            return {}
        return result

    # ======================================================================
    # PHASE 1 - TEMPLATE ANALYSIS
    # THE KEY FIX: sections = structural headings of the document, NOT clauses
    # ======================================================================

    async def analyze_template(self, template_text: str,
                                template_file_signed_url: Optional[str] = None) -> dict:
        word_count = len(template_text.split())
        char_count = len(template_text)
        metrics = _compute_page_metrics(template_text)
        blueprint = _extract_layout_blueprint(template_text)
        layout = _blueprint_to_display(blueprint, max_lines=500)
        heading_candidates = _extract_heading_candidates(template_text)
        heading_candidates_display = _heading_candidates_to_display(heading_candidates)
        url_ctx = f"\nTEMPLATE URL: {template_file_signed_url}\n" if template_file_signed_url else ""

        prompt = f"""
You are analysing a legal document template. Extract the STRUCTURAL SECTIONS
of the document — exactly like a resume has sections for "Personal Information",
"Education", "Work Experience", "Skills", etc.

DOCUMENT: {word_count} words | {char_count} chars
{url_ctx}
PAGE METRICS: page_width={metrics['page_width']}, std_indent={metrics['std_indent']}, deep_indent={metrics['deep_indent']}

LAYOUT BLUEPRINT (alignment-classified lines from PDF):
{layout}

PRE-DETECTED HEADING CANDIDATES FROM THE FULL DOCUMENT:
{heading_candidates_display}

RAW TEMPLATE TEXT:
\"\"\"{template_text}\"\"\"

=================================================================
RULE 1 - WHAT IS A SECTION?
=================================================================

A SECTION = one of the major structural blocks of the document.
It must correspond to a real HEADING or major chapter in the template.

Valid examples of section shapes:
  - title block
  - parties block
  - preamble / recitals
  - definitions
  - payment terms
  - scope / obligations / covenants
  - representations / warranties
  - schedules / annexures / appendices
  - compliance checklist
  - execution / signature / witness block

Use the actual structure of THIS uploaded template only.
Do not assume a fixed list of section names, fixed fields, fixed categories, or a fixed section count.

=================================================================
RULE 2 - WHAT IS NOT A SECTION?
=================================================================

WRONG - DO NOT create sections for individual template sentences:
  x a single recital sentence
  x a single boilerplate opening line
  x one ordinary numbered clause from inside a larger section
  x a fragment of body text that has no standalone heading

These are BOILERPLATE TEXT that belong INSIDE a section.
They are NOT sections themselves.

WRONG - Do NOT fragment one continuous section into many fake micro-sections.
  But if the uploaded template really contains 20+ genuine headings across later pages,
  you must return all of them.

IMPORTANT FOR ANY TEMPLATE:
  - If the document has many real headings across later pages, return all of them.
  - If the document has numbered sections, chapter headings, schedules, annexures,
    appendices, compliance tables, or execution blocks, each real structural block
    should become its own section.
  - Do NOT stop after the first 2-3 pages if the template continues with later headings.
  - Use the PRE-DETECTED HEADING CANDIDATES above as evidence, but keep only items
    that truly behave like headings in this uploaded template.
  - If the document contains a TABLE OF CONTENTS, treat it as a coverage checklist.
    Reconcile your final section list against it before returning JSON.
  - Missing later sections means your answer is incomplete.

FULL-DOCUMENT COVERAGE PROTOCOL:
  1. Scan the full document from first page to last page.
  2. Build the section list from actual headings and major structural blocks.
  3. Reconcile that list with the TABLE OF CONTENTS and PRE-DETECTED HEADING CANDIDATES.
  4. If the TOC or heading candidates show more sections than your draft answer, keep analysing until they are covered.
  5. Prefer complete coverage over an artificially small section count.

=================================================================
RULE 3 - FIELDS (variables the user fills in)
=================================================================

Fields = the VARIABLE SLOTS inside each section:
  - {{field_name}} Jinja/Handlebars placeholders — CRITICAL: extract EVERY {{...}} token as a field.
    The "key" for each field is the exact snake_case name inside the braces.
  - __field_name__ double-underscore placeholders (e.g. __total_consideration__, __stamp_duty_percentage__) — CRITICAL:
    extract EVERY __name__ token as a field. The "key" is the exact snake_case name between the underscores.
  - Blanks (____), placeholders [like this]
  - Names, dates, amounts, addresses, case numbers
  - Any contextually obvious variable

IMPORTANT: If the template uses {{field_name}} or __field_name__ placeholders extensively, extract EVERY UNIQUE placeholder
as a field in the section where it first appears. Do NOT skip any {{...}} or __...__ tokens.
If a section has visible blanks, labels, signature lines, property rows, witness rows, notary rows,
schedule tables, execution metadata, or registration details, convert those fillable items into fields.

Field requirements:
  - Unique snake_case "key" — for {{field_name}} use name inside braces; for __field_name__ use name between underscores
  - Human-readable "label" shown on the form to the user
  - "type": string | date | number | currency | address | text_long | boolean
  - "required": true/false
  - "description": helpful hint shown as placeholder text

=================================================================
RULE 4 - DRAFTING PROMPT (critical - this generates the draft)
=================================================================

Each section MUST have a "drafting_prompt" with COMPLETE instructions:
  a) The EXACT heading to output (copy from template)
  b) The EXACT layout: centred heading, numbered paragraphs, table, etc.
  c) All BOILERPLATE TEXT to reproduce VERBATIM
     where the template requires fixed text
  d) WHERE each field value goes
     based on this template's own wording and structure
  e) Legal tone, opening lines, closing phrases
  f) Every output line must be prefixed [CENTER], [LEFT_INDENT], [RIGHT], etc.

=================================================================
RETURN VALID JSON ONLY - no markdown fences, no explanation
=================================================================

{{
  "template_name": "Document title from first heading",
  "document_type": "Short description inferred from this uploaded template",
  "total_sections": 6,
  "estimated_draft_length": "~N pages",
  "page_metrics": {{
    "page_width": {metrics['page_width']},
    "std_indent": {metrics['std_indent']},
    "deep_indent": {metrics['deep_indent']}
  }},
  "all_fields": [
    {{
      "key": "unique_snake_case_key",
      "type": "string|date|number|currency|address|text_long|boolean",
      "label": "Label shown on the form",
      "required": true,
      "default_value": "",
      "validation_rules": "",
      "description": "Hint text for the user",
      "section_id": "section_id_this_field_belongs_to"
    }}
  ],
  "sections": [
    {{
      "section_id": "unique_snake_case_id",
      "section_name": "Exact structural heading from the template",
      "section_purpose": "One sentence: what belongs in this section",
      "section_category": "other",
      "order": 1,
      "page_break_before": true,
      "estimated_words": 300,
      "depends_on": [],
      "drafting_prompt": "COMPLETE instruction for the AI drafter. Must include exact heading, exact layout, all boilerplate verbatim, where each field goes, legal tone, opening/closing phrases, and [ALIGNMENT] markers for every line.",
      "format_blueprint": [
        {{
          "align": "CENTER",
          "text": "IN THE SUPREME COURT OF INDIA",
          "style": "UPPERCASE",
          "is_boilerplate": true,
          "is_field": false,
          "is_numbered": false,
          "is_multiline": false,
          "note": ""
        }}
      ],
      "fields": [
        {{
          "key": "unique_snake_case_key",
          "type": "string",
          "label": "Human-readable label",
          "required": true,
          "default_value": "",
          "validation_rules": "",
          "description": "Hint text"
        }}
      ]
    }}
  ]
}}

FINAL CHECK before returning:
1. Does every section_name match a real structural heading in the template?
2. Are there NO sections named after template boilerplate sentences?
3. For a long document, did you include all real numbered sections, schedules, and execution blocks?
4. Does every section have a complete drafting_prompt with boilerplate verbatim?
5. Does every field have a clear label and description?
"""

        result = await self._call_json(
            prompt,
            max_output_tokens=self.MAX_TOKENS_JSON,
            timeout=300.0,
            provider=self.section_extraction_provider,
        )
        result = self._post_process_analysis(result, metrics, heading_candidates)
        print(f"DEBUG: Analysis done - {result.get('total_sections')} sections, "
              f"{len(result.get('all_fields', []))} fields.")
        return result

    # ======================================================================
    # PHASE 2/3 - Section prompt generation
    # ======================================================================

    async def generate_section_prompts(self, section_data: dict) -> dict:
        section_name = section_data.get("section_name", "Section")
        blueprint = section_data.get("format_blueprint", [])
        field_keys = [f.get("key") for f in section_data.get("fields", [])]
        format_spec = _blueprint_to_prompt_spec(blueprint, section_name)
        existing_dp = section_data.get("drafting_prompt", "")
        boilerplate_lines = [e.get("text","") for e in blueprint
                             if e.get("is_boilerplate") and e.get("text")]
        boilerplate_display = "\n".join(f"  - {b}" for b in boilerplate_lines) or "(none)"

        prompt = f"""
Refine the drafting instructions for the "{section_name}" section.

EXISTING DRAFTING PROMPT:
{existing_dp}

FORMAT SPEC:
{format_spec}

BOILERPLATE (must appear verbatim):
{boilerplate_display}

FIELDS TO USE: {json.dumps(field_keys)}

Produce a final "master_instruction" covering:
1. Exact heading/title to output
2. Exact layout (centred lines, numbered paragraphs, tables)
3. All boilerplate verbatim
4. Where each field value is inserted
5. Legal tone, opening and closing phrases
6. Every line prefixed with [CENTER], [LEFT_INDENT], [RIGHT], etc.

Return ONLY valid JSON:
{{
  "section_intro": "Brief note about this section",
  "drafting_complexity": "simple|moderate|complex",
  "estimated_output_words": 300,
  "field_prompts": [
    {{"field_id": "master_instruction", "prompt": "<complete instructions>"}}
  ],
  "dependencies": [],
  "legal_references": []
}}
"""
        result = await self._call_json(
            prompt,
            max_output_tokens=8192,
            provider=self.prompt_refinement_provider,
        )
        if not isinstance(result, dict):
            print(f"DEBUG: generate_section_prompts got non-dict response (type={type(result).__name__}), using defaults")
            return {
                "section_intro": "",
                "drafting_complexity": "simple",
                "estimated_output_words": 300,
                "field_prompts": [{"field_id": "master_instruction", "prompt": existing_dp or f"Generate the {section_name} section."}],
                "dependencies": [],
                "legal_references": []
            }
        return result

    # ======================================================================
    # PHASE 4/5 - Validation
    # ======================================================================

    async def validate_input(self, field_info: dict, user_input: str) -> dict:
        prompt = f"""Validate this input for a legal document field.
FIELD RULES: {json.dumps(field_info)}
USER INPUT: "{user_input}"
Return ONLY: {{"valid": true}} OR {{"valid": false, "error_prompt": "...", "suggestion": "..."}}"""
        return await self._call_json(prompt, provider=self.validation_provider)

    # ======================================================================
    # PHASE 6 - Section content generation
    # ======================================================================

    async def generate_section_content(self, section_data: dict, field_values: dict,
                                       max_output_tokens: int = None,
                                       target_words_min: int = 200,
                                       target_words_max: int = 10000) -> str:
        estimated_words = section_data.get("estimated_words", 500)
        if estimated_words > self.CHUNK_THRESHOLD_WORDS:
            print(f"DEBUG: Large section ({estimated_words} words) - chunking...")
            return await self._generate_chunked(section_data, field_values, target_words_max)
        return await self._generate_single(section_data, field_values,
                                           max_output_tokens or self.MAX_TOKENS_TEXT,
                                           target_words_min, target_words_max)

    async def _generate_single(self, section_data: dict, field_values: dict,
                                max_output_tokens: int, target_words_min: int,
                                target_words_max: int) -> str:
        section_name = section_data.get("section_name", "Section")
        section_id = section_data.get("section_id", "")
        blueprint = section_data.get("format_blueprint", [])
        format_spec = _blueprint_to_prompt_spec(blueprint, section_name)

        drafting_prompt = section_data.get("drafting_prompt", "")
        for p in (section_data.get("section_prompts") or
                  section_data.get("field_prompts") or []):
            if isinstance(p, dict) and p.get("prompt"):
                drafting_prompt = p["prompt"]; break

        boilerplate_lines = [e.get("text","") for e in blueprint
                             if e.get("is_boilerplate") and e.get("text")]
        boilerplate_display = "\n".join(boilerplate_lines) or "(none)"

        subsection_note = (
            f"\nNOTE: Sub-section of '{section_data.get('parent_section_id')}'. "
            f"Generate ONLY '{section_name}'.\n"
        ) if section_data.get("is_subsection") else ""

        prompt = f"""
Generate the "{section_name}" section of a legal document with [ALIGNMENT] markers on every line.
{subsection_note}
SECTION: {section_name} | ID: {section_id}
PURPOSE: {section_data.get("section_purpose","")}
CATEGORY: {section_data.get("section_category","")}

ALIGNMENT LEGEND - prefix EVERY output line:
  [CENTER]           - centred text (court names, section headings)
  [LEFT_INDENT]      - standard body indent (paragraphs, numbered items)
  [LEFT_INDENT_MORE] - deeper indent (sub-clauses, long boilerplate)
  [RIGHT]            - right-aligned (party names, dates)
  [TABLE_ROW]        - table row (use | between columns)
  [SEPARATOR]        - ruled line
  [BLANK]            - empty spacing line

FORMAT SPEC (follow line-by-line):
{format_spec}

DRAFTING INSTRUCTIONS (follow exactly):
{drafting_prompt or section_data.get("format_instructions","Generate professional legal content.")}

BOILERPLATE - reproduce VERBATIM (do NOT rephrase):
{boilerplate_display}

USER-PROVIDED VALUES:
{json.dumps(field_values, indent=2)}

RULES:
1. EVERY output line starts with [ALIGNMENT_MARKER].
2. Follow the FORMAT SPEC sequence exactly.
3. All BOILERPLATE reproduced verbatim - never rephrase.
4. Insert field values at correct positions; missing values -> [________].
5. For numbered/multiline entries, generate as many items as needed.
6. Legal tone; third-person except affidavits (first-person).
7. Target length: {target_words_min}-{target_words_max} words.
8. Output plain text ONLY - no JSON, no markdown.

Generate now:"""

        return await self._call_text(
            prompt,
            max_output_tokens=max_output_tokens,
            timeout=600.0,
            provider=self.text_generation_provider,
        )

    async def _generate_chunked(self, section_data: dict, field_values: dict,
                                 target_words_max: int) -> str:
        section_name = section_data.get("section_name", "Section")
        estimated_words = section_data.get("estimated_words", 2000)
        num_chunks = max(2, math.ceil(estimated_words / self.CHUNK_THRESHOLD_WORDS))
        words_per_chunk = max(500, target_words_max // num_chunks)
        parts = []; prev_ending = ""
        for idx in range(num_chunks):
            is_first = idx == 0; is_last = idx == num_chunks - 1
            cont_ctx = (f"\nCONTINUATION: Previous chunk ended with:\n"
                        f"\"\"\"{prev_ending[-500:]}\"\"\"\nContinue SEAMLESSLY.\n"
                        ) if prev_ending else ""
            chunk_data = {
                **section_data,
                "section_purpose": (
                    section_data.get("section_purpose","") +
                    (" [START - include opening/heading]" if is_first else "") +
                    (" [END - include all closing clauses]" if is_last else "") +
                    (f" [PART {idx+1}/{num_chunks}]" if num_chunks > 1 else "")),
                "format_instructions": (
                    (section_data.get("format_instructions") or "") + cont_ctx),
            }
            print(f"DEBUG: Chunk {idx+1}/{num_chunks} for '{section_name}'...")
            chunk = await self._generate_single(chunk_data, field_values,
                                                self.MAX_TOKENS_TEXT,
                                                words_per_chunk-100, words_per_chunk)
            parts.append(chunk)
            prev_ending = chunk[-500:] if chunk else ""
        return "\n".join(parts)

    # ======================================================================
    # FULL DRAFT ASSEMBLY
    # ======================================================================

    async def assemble_full_draft(self, analysis_result: dict,
                                   section_prompts: Dict[str, dict],
                                   field_values: dict,
                                   output_format: str = "plain",
                                   concurrency: int = 3) -> str:
        sections = sorted(analysis_result.get("sections",[]), key=lambda s: s.get("order",0))
        metrics = analysis_result.get("page_metrics",{})
        pw = metrics.get("page_width",80)
        si = max(metrics.get("std_indent",15), 5)
        di = max(metrics.get("deep_indent",25), si+5)
        print(f"DEBUG: Assembling {len(sections)} sections | format={output_format}...")
        draft_parts: List[Tuple[int,str]] = []
        for i in range(0, len(sections), concurrency):
            batch = sections[i:i+concurrency]; tasks = []
            for sec in batch:
                sid = sec.get("section_id",""); merged = {**sec}
                if sid in section_prompts:
                    sp = section_prompts[sid]
                    merged["section_prompts"] = sp.get("field_prompts",[])
                    merged["section_intro"] = sp.get("section_intro","")
                tasks.append(self.generate_section_content(
                    section_data=merged, field_values=field_values))
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for sec, raw in zip(batch, results):
                if isinstance(raw, Exception):
                    print(f"DEBUG: '{sec.get('section_name')}' failed: {raw}")
                    raw = f"[GENERATION FAILED: {sec.get('section_name')}]"
                if output_format == "html":
                    formatted = self.format_to_html(raw)
                    if sec.get("page_break_before"):
                        formatted = '<div style="page-break-before:always;"></div>\n' + formatted
                elif output_format == "plain":
                    formatted = self.format_to_plain_text(raw, pw, si, di)
                    if sec.get("page_break_before"):
                        formatted = "\f" + formatted
                else:
                    formatted = raw
                draft_parts.append((sec.get("order",0), formatted))
                print(f"DEBUG: OK '{sec.get('section_name')}' - {len(formatted.split())} words")
        draft_parts.sort(key=lambda x: x[0])
        sep = "\n\n" if output_format != "html" else "\n"
        full_text = sep.join(p for _,p in draft_parts)
        print(f"DEBUG: Draft done - {len(full_text.split())} words total.")
        return full_text

    # ======================================================================
    # OUTPUT FORMATTERS
    # ======================================================================

    @staticmethod
    def format_to_plain_text(raw: str, page_width: int = 80,
                              std_indent: int = 15, deep_indent: int = 25) -> str:
        out = []
        for line in raw.split("\n"):
            s = line.strip()
            m = re.match(r"\[(CENTER|LEFT_INDENT_MORE|LEFT_INDENT|LEFT|RIGHT|TABLE_ROW|SEPARATOR|BLANK)\]\s*(.*)", s)
            align, text = (m.group(1), m.group(2).strip()) if m else (Align.LEFT_INDENT, s)
            if align == Align.BLANK or not text:
                out.append("")
            elif align == Align.CENTER:
                out.append(text.center(page_width))
            elif align == Align.RIGHT:
                out.append(text.rjust(page_width))
            elif align == Align.LEFT_INDENT_MORE:
                out.append(" "*deep_indent + text)
            elif align in (Align.LEFT_INDENT, Align.LEFT):
                out.append(" "*std_indent + text)
            elif align == Align.SEPARATOR:
                out.append(" "*std_indent + "_"*(page_width-std_indent))
            elif align == Align.TABLE_ROW:
                parts = [p.strip() for p in text.split("|")]
                col_w = (page_width-std_indent)//max(len(parts),1)
                out.append(" "*std_indent + "".join(p.ljust(col_w) for p in parts))
            else:
                out.append(" "*std_indent + text)
        return "\n".join(out)

    @staticmethod
    def format_to_html(raw: str) -> str:
        style_map = {
            Align.CENTER: "text-align:center;",
            Align.RIGHT: "text-align:right;padding-right:0.5in;",
            Align.LEFT_INDENT: "text-align:left;margin-left:1.5in;",
            Align.LEFT_INDENT_MORE: "text-align:left;margin-left:2.5in;",
            Align.LEFT: "text-align:left;",
            Align.TABLE_ROW: "text-align:left;margin-left:1.5in;font-family:monospace;white-space:pre;",
            Align.SEPARATOR: "text-align:left;margin-left:1.5in;",
        }
        html = ['<div class="legal-section" style="font-family:\'Times New Roman\',serif;'
                'font-size:14px;line-height:1.8;max-width:8.5in;margin:auto;">']
        for line in raw.split("\n"):
            s = line.strip()
            m = re.match(r"\[(CENTER|LEFT_INDENT_MORE|LEFT_INDENT|LEFT|RIGHT|TABLE_ROW|SEPARATOR|BLANK)\]\s*(.*)", s)
            align, text = (m.group(1), m.group(2).strip()) if m else (Align.LEFT_INDENT, s)
            if align == Align.BLANK or not text:
                html.append('<p style="margin:0;min-height:1em;">&nbsp;</p>')
            elif align == Align.SEPARATOR:
                html.append('<hr style="margin-left:1.5in;border:none;border-top:1px solid black;"/>')
            else:
                style = style_map.get(align, "text-align:left;")
                if text == text.upper() and len(text) > 3 and not text.startswith("("):
                    style += "font-weight:bold;"
                escaped = text.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
                html.append(f'<p style="margin:2px 0;{style}">{escaped}</p>')
        html.append("</div>")
        return "\n".join(html)

    # ======================================================================
    # PRIVATE HELPERS
    # ======================================================================

    @staticmethod
    def _post_process_analysis(
        result: dict,
        metrics: Dict[str, Any] = None,
        heading_candidates: List[Dict[str, Any]] = None
    ) -> dict:
        if not isinstance(result, dict):
            print(f"DEBUG: _post_process_analysis got non-dict (type={type(result).__name__}), resetting to empty dict")
            result = {}
        heading_candidates = heading_candidates or []
        existing_sections = result.get("sections", [])
        existing_names = {
            _clean_heading_text(sec.get("section_name", "")).lower()
            for sec in existing_sections
            if isinstance(sec, dict) and sec.get("section_name")
        }
        if heading_candidates and len(existing_sections) < len(heading_candidates):
            for candidate in heading_candidates:
                candidate_name = _clean_heading_text(candidate.get("section_name", ""))
                if not candidate_name or candidate_name.lower() in existing_names:
                    continue
                existing_sections.append({
                    "section_id": candidate.get("section_id") or _heading_to_section_id(candidate_name, len(existing_sections) + 1),
                    "section_name": candidate_name,
                    "section_purpose": f"Generate the '{candidate_name}' section exactly as it appears in the template.",
                    "section_category": "other",
                    "order": candidate.get("order", len(existing_sections) + 1),
                    "page_break_before": False,
                    "estimated_words": 400,
                    "depends_on": [],
                    "drafting_prompt": f"Generate the section '{candidate_name}' exactly as in the source template, preserving legal wording, layout, tables, schedules, and signature formatting where applicable.",
                    "format_blueprint": [],
                    "fields": [],
                })
                existing_names.add(candidate_name.lower())
            result["sections"] = existing_sections
        if "sections" in result and not result.get("all_fields"):
            all_fields, seen = [], set()
            for sec in result["sections"]:
                sid = sec.get("section_id","")
                for f in sec.get("fields",[]):
                    key = f.get("key")
                    if key and key not in seen:
                        seen.add(key)
                        all_fields.append({**f,"section_id":sid})
            result["all_fields"] = all_fields
        for idx, sec in enumerate(result.get("sections",[]), start=1):
            sec.setdefault("order", idx)
            sec.setdefault("page_break_before", False)
            sec.setdefault("format_blueprint", [])
            sec.setdefault("depends_on", [])
            sec.setdefault("is_subsection", False)
            sec.setdefault("parent_section_id", None)
            sec.setdefault("fields", [])
            sec.setdefault("drafting_prompt", sec.get("format_instructions",""))
        result["sections"] = sorted(result.get("sections",[]), key=lambda s: s.get("order",0))
        result["total_sections"] = len(result["sections"])
        if metrics:
            result.setdefault("page_metrics", metrics)
        print(f"DEBUG: Post-processed -> {result['total_sections']} sections, "
              f"{len(result.get('all_fields',[]))} fields.")
        return result

    @staticmethod
    def _build_all_fields(sections: list) -> list:
        all_fields, seen = [], set()
        for sec in sections:
            sid = sec.get("section_id","")
            for f in sec.get("fields",[]):
                key = f.get("key")
                if key and key not in seen:
                    seen.add(key)
                    all_fields.append({**f,"section_id":sid})
        return all_fields

        
