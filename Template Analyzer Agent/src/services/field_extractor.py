import re
from dataclasses import dataclass, asdict
from enum import Enum
from typing import List, Dict, Any, Optional


class FieldType(str, Enum):
    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    LONG_TEXT = "long_text"
    LIST = "list"


@dataclass
class Field:
    field_id: str
    field_name: str
    field_type: FieldType
    page_number: int
    location_marker: str
    surrounding_text: str
    example_value: Optional[str] = None
    is_required: bool = True
    extraction_methods: List[str] = None
    confidence: float = 0.8
    vector_db_keys: List[str] = None
    validation: Optional[str] = None
    fallback_strategy: Optional[str] = None
    formatting: Optional[str] = None
    min_length: Optional[int] = None

    def __post_init__(self):
        if self.extraction_methods is None:
            self.extraction_methods = []
        if self.vector_db_keys is None:
            self.vector_db_keys = []


class HybridFieldExtractor:
    """
    Hybrid field extractor for legal templates.
    Strategy:
    1) Pattern-based (underscores, dots, blanks, numbered headings)
    2) Structural (common legal sections like Facts, Grounds, Prayer)
    3) Hook point for LLM-powered recognition (can be added later)
    """

    # Regex patterns for explicit placeholders / structure
    PATTERNS: Dict[str, re.Pattern] = {
        # {{field_name}} — Jinja/Handlebars style (JuriNex, DocuSign, etc.)
        "curly_field": re.compile(r"\{\{([a-zA-Z][a-zA-Z0-9_]*)\}\}"),
        # __field_name__ — double-underscore style (JuriNex Sale Deed, etc.)
        "double_underscore_field": re.compile(r"__([a-zA-Z][a-zA-Z0-9_]*)__"),
        # ARTICLE________OF THE CONSTITUTION
        "underscore_field": re.compile(r"([A-Z\s]+)_{3,}([A-Z\s]+)"),
        # .....Petitioner
        "dot_field": re.compile(r"\.{3,}\s*([A-Za-z\s]+)"),
        # CIVIL WRIT PETITION NO. ___ OF ___
        "blank_field": re.compile(r"([A-Z][A-Za-z\s]+?)\s+_{3,}\s+([A-Z][A-Za-z\s]+)"),
        # FILED ON:
        "date_field": re.compile(r"(FILED ON|DATED|DATE):\s*$", re.IGNORECASE),
        # 1. Facts of the case
        "section_heading": re.compile(r"^(\d+)\.\s+([A-Za-z][A-Za-z\s]+)$"),
    }

    # Known body sections in writ-style petitions
    BODY_SECTIONS_HINT: Dict[str, str] = {
        "facts of the case": "facts_of_case",
        "facts of case": "facts_of_case",
        "question of law": "questions_of_law",
        "questions of law": "questions_of_law",
        "grounds": "grounds",
        "averment": "averment",
        "prayer": "prayer_reliefs",
    }

    def extract_from_text(self, template_text: str) -> Dict[str, Any]:
        """
        Main entrypoint used by the agent.
        Works on plain text that has already been OCR'd / extracted from PDF.
        """
        pattern_fields = self._extract_fields_by_pattern(template_text)
        structural_fields = self._extract_fields_by_structure(template_text)

        merged = self._merge_field_lists([pattern_fields, structural_fields])
        enriched = self._validate_and_enrich(merged)

        return {
            "total_fields": len(enriched),
            "fields": [self._field_to_dict(f) for f in enriched],
        }

    # ----------------- PATTERN-BASED EXTRACTION -----------------

    # Infer FieldType from a {{field_name}} key
    @staticmethod
    def _infer_type_from_key(key: str) -> FieldType:
        k = key.lower()
        if any(w in k for w in ("date", "dob", "born", "expiry", "commencement", "end_date", "agreement_date")):
            return FieldType.DATE
        if any(w in k for w in ("age", "fee", "deposit", "amount", "months", "sqft", "qty", "number", "no", "limit", "escalation", "days")):
            return FieldType.NUMBER
        if any(w in k for w in ("address", "purpose", "details", "text", "clause", "policy", "status", "inventory")):
            return FieldType.LONG_TEXT
        return FieldType.TEXT

    def _extract_fields_by_pattern(self, text: str) -> List[Field]:
        fields: List[Field] = []
        seen_keys: set = set()

        # --- Full-text scan for explicit placeholder styles ---
        # PDF OCR can split tokens across lines/cells; scanning the full text catches those.
        # Strategy:
        #   1. Scan raw text with a multiline-aware pattern (catches tokens split by a newline)
        #   2. Scan whitespace-collapsed text with the standard pattern (catches all single-line tokens)
        # Both scans share the same `seen_keys` set so there are no duplicates.

        # Multiline-aware variants: allow a single newline (+ optional indent) inside the token
        _double_underscore_multiline = re.compile(
            r"__([a-zA-Z][a-zA-Z0-9_]*(?:\n[ \t]*[a-zA-Z0-9_]*)*)__"
        )
        _curly_multiline = re.compile(
            r"\{\{([a-zA-Z][a-zA-Z0-9_]*(?:\n[ \t]*[a-zA-Z0-9_]*)*)\}\}"
        )

        # Whitespace-collapsed text catches tokens that are intact but on one line
        collapsed = re.sub(r"\s+", " ", text)

        def _add_placeholder_fields(matches, method: str, confidence: float):
            for m in matches:
                key = re.sub(r"\s+", "", m.group(1))   # normalise multiline keys
                if not key or key in seen_keys:
                    continue
                seen_keys.add(key)
                ftype = self._infer_type_from_key(key)
                marker = f"__{key}__" if "double_underscore" in method else f"{{{{{key}}}}}"
                fields.append(
                    Field(
                        field_id=key,
                        field_name=self._humanize(key),
                        field_type=ftype,
                        page_number=1,
                        location_marker=marker,
                        surrounding_text=m.group(0)[:120],
                        extraction_methods=[method],
                        confidence=confidence,
                    )
                )

        # __field__ — multiline scan on raw text, then standard scan on collapsed text
        _add_placeholder_fields(_double_underscore_multiline.finditer(text),
                                "pattern_double_underscore", 0.97)
        _add_placeholder_fields(self.PATTERNS["double_underscore_field"].finditer(collapsed),
                                "pattern_double_underscore", 0.97)

        # {{field}} — multiline scan on raw text, then standard scan on collapsed text
        _add_placeholder_fields(_curly_multiline.finditer(text),
                                "pattern_curly", 0.98)
        _add_placeholder_fields(self.PATTERNS["curly_field"].finditer(collapsed),
                                "pattern_curly", 0.98)

        lines = text.splitlines()

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Underscore style
            m = self.PATTERNS["underscore_field"].search(stripped)
            if m:
                before, after = m.group(1).strip(), m.group(2).strip()
                field_id = self._snake(self._clean_label(f"{before} {after}"))
                fields.append(
                    Field(
                        field_id=field_id,
                        field_name=self._humanize(field_id),
                        field_type=FieldType.TEXT,
                        page_number=1,
                        location_marker=before,
                        surrounding_text=stripped,
                        extraction_methods=["pattern_underscore"],
                        confidence=0.95,
                    )
                )

            # Dots style
            m = self.PATTERNS["dot_field"].search(stripped)
            if m:
                label = m.group(1).strip()
                field_id = self._snake(self._clean_label(label))
                fields.append(
                    Field(
                        field_id=field_id,
                        field_name=label,
                        field_type=FieldType.TEXT,
                        page_number=1,
                        location_marker="dots",
                        surrounding_text=stripped,
                        extraction_methods=["pattern_dots"],
                        confidence=0.95,
                    )
                )

            # Blanks with context
            m = self.PATTERNS["blank_field"].search(stripped)
            if m:
                left = m.group(1).strip()
                field_id = self._snake(self._clean_label(left))
                ftype = FieldType.NUMBER if "NO" in left.upper() else FieldType.TEXT
                fields.append(
                    Field(
                        field_id=field_id,
                        field_name=left,
                        field_type=ftype,
                        page_number=1,
                        location_marker=left,
                        surrounding_text=stripped,
                        extraction_methods=["pattern_blank"],
                        confidence=0.9,
                    )
                )

            # Date-ish labels: FILED ON:, DATED:, DATE:
            m = self.PATTERNS["date_field"].search(stripped)
            if m:
                label = m.group(1).strip().upper()
                field_id = self._snake(label)
                fields.append(
                    Field(
                        field_id=field_id,
                        field_name=label.title(),
                        field_type=FieldType.DATE,
                        page_number=1,
                        location_marker=label,
                        surrounding_text=stripped,
                        extraction_methods=["pattern_date"],
                        confidence=0.9,
                    )
                )

            # Numbered section headings (1. Facts of the case)
            m = self.PATTERNS["section_heading"].search(stripped)
            if m:
                _, title = m.groups()
                key = self.BODY_SECTIONS_HINT.get(title.lower().strip())
                field_id = key or self._snake(title)
                fields.append(
                    Field(
                        field_id=field_id,
                        field_name=title.strip(),
                        field_type=FieldType.LONG_TEXT,
                        page_number=1,
                        location_marker=stripped,
                        surrounding_text=stripped,
                        extraction_methods=["pattern_section"],
                        confidence=0.88,
                        min_length=100,
                    )
                )

        return fields

    # ----------------- STRUCTURAL EXTRACTION -----------------

    def _extract_fields_by_structure(self, text: str) -> List[Field]:
        fields: List[Field] = []
        lowered = text.lower()

        # Header-like constructs in writ petitions
        if "writ petition" in lowered and "no." in lowered:
            fields.append(
                Field(
                    field_id="petition_number",
                    field_name="Petition Number",
                    field_type=FieldType.NUMBER,
                    page_number=1,
                    location_marker="PETITION NO.",
                    surrounding_text="Writ Petition No. ___ of ___",
                    extraction_methods=["struct_header"],
                    confidence=0.9,
                )
            )
            fields.append(
                Field(
                    field_id="petition_year",
                    field_name="Petition Year",
                    field_type=FieldType.NUMBER,
                    page_number=1,
                    location_marker="OF ___",
                    surrounding_text="Writ Petition No. ___ of ___",
                    extraction_methods=["struct_header"],
                    confidence=0.9,
                )
            )

        # Petitioner / Respondent roles are very common
        if "petitioner" in lowered:
            fields.append(
                Field(
                    field_id="petitioner_name",
                    field_name="Petitioner Name",
                    field_type=FieldType.TEXT,
                    page_number=1,
                    location_marker="Petitioner",
                    surrounding_text="... Petitioner",
                    extraction_methods=["struct_role"],
                    confidence=0.9,
                )
            )
        if "respondent" in lowered:
            fields.append(
                Field(
                    field_id="respondent_names",
                    field_name="Respondent Names",
                    field_type=FieldType.LIST,
                    page_number=1,
                    location_marker="Respondent",
                    surrounding_text="... Respondent(s)",
                    extraction_methods=["struct_role"],
                    confidence=0.9,
                )
            )

        # Body sections based on canonical labels
        for label, fid in self.BODY_SECTIONS_HINT.items():
            if label in lowered:
                fields.append(
                    Field(
                        field_id=fid,
                        field_name=self._humanize(fid),
                        field_type=FieldType.LONG_TEXT,
                        page_number=1,
                        location_marker=label,
                        surrounding_text=label,
                        extraction_methods=["struct_body"],
                        confidence=0.92,
                        min_length=100,
                    )
                )

        # Administrative footer
        if "filed by" in lowered:
            fields.append(
                Field(
                    field_id="filed_by",
                    field_name="Filed By",
                    field_type=FieldType.TEXT,
                    page_number=1,
                    location_marker="FILED BY",
                    surrounding_text="FILED BY:",
                    extraction_methods=["struct_admin"],
                    confidence=0.9,
                )
            )
        if "drawn" in lowered:
            fields.append(
                Field(
                    field_id="drawn_by",
                    field_name="Drawn By",
                    field_type=FieldType.TEXT,
                    page_number=1,
                    location_marker="DRAWN BY",
                    surrounding_text="DRAWN BY:",
                    extraction_methods=["struct_admin"],
                    confidence=0.9,
                )
            )
        if "filed on" in lowered:
            fields.append(
                Field(
                    field_id="filing_date",
                    field_name="Filing Date",
                    field_type=FieldType.DATE,
                    page_number=1,
                    location_marker="FILED ON",
                    surrounding_text="FILED ON:",
                    extraction_methods=["struct_admin"],
                    confidence=0.9,
                )
            )

        return fields

    # ----------------- MERGE / ENRICH -----------------

    def _merge_field_lists(self, lists: List[List[Field]]) -> List[Field]:
        merged: Dict[str, Field] = {}
        for fields in lists:
            for f in fields:
                if f.field_id in merged:
                    existing = merged[f.field_id]
                    existing.extraction_methods = list(
                        sorted(set(existing.extraction_methods + f.extraction_methods))
                    )
                    existing.confidence = min(0.98, max(existing.confidence, f.confidence) + 0.02)
                else:
                    merged[f.field_id] = f
        return list(merged.values())

    def _validate_and_enrich(self, fields: List[Field]) -> List[Field]:
        for f in fields:
            f.vector_db_keys = self._generate_search_keys(f.field_id)
            f.validation = self._validation_for(f)
            f.fallback_strategy = self._fallback_for(f)
            if f.field_type == FieldType.LONG_TEXT and not f.formatting:
                f.formatting = self._formatting_for(f.field_id)
        return fields

    def _generate_search_keys(self, field_id: str) -> List[str]:
        mappings: Dict[str, List[str]] = {
            "petitioner_name": [
                "petitioner_name",
                "petitioner",
                "applicant_name",
                "plaintiff_name",
                "party_name",
            ],
            "respondent_names": [
                "respondent_names",
                "respondents",
                "defendants",
                "opposing_party",
            ],
            "facts_of_case": [
                "case_facts",
                "factual_background",
                "case_summary",
                "incident_details",
                "chronology_of_events",
            ],
            "questions_of_law": [
                "legal_questions",
                "questions_of_law",
                "legal_issues",
            ],
            "grounds": ["grounds", "legal_grounds", "arguments", "submissions"],
            "prayer_reliefs": ["relief_sought", "prayers", "remedies_requested", "orders_sought"],
            "petition_number": ["petition_number", "case_number", "writ_petition_no", "case_id"],
            "petition_year": ["petition_year", "year", "filing_year"],
            "filing_date": ["filing_date", "date_of_filing", "submission_date"],
        }
        if field_id in mappings:
            return mappings[field_id]
        return [
            field_id,
            field_id.replace("_", " "),
            field_id.split("_")[0],
        ]

    def _validation_for(self, f: Field) -> Optional[str]:
        if f.field_type == FieldType.NUMBER:
            if "year" in f.field_id:
                return r"^\d{4}$"
            return r"^\d+$"
        if f.field_type == FieldType.DATE:
            return r"^\d{2}/\d{2}/\d{4}$"
        if "article" in f.field_id:
            return r"^(32|226|136|142)$"
        return None

    def _fallback_for(self, f: Field) -> str:
        fid = f.field_id
        if fid in {"petitioner_name", "respondent_names", "facts_of_case"}:
            return "prompt_user"
        if "year" in fid:
            return "current_year"
        if f.field_type == FieldType.DATE:
            return "current_date"
        if "petition_number" in fid or "case_number" in fid:
            return "auto_generate"
        if fid == "drawn_by":
            return "copy_from_filed_by"
        if fid == "filing_date":
            return "current_date"
        return "extract_from_documents"

    def _formatting_for(self, field_id: str) -> str:
        if "facts" in field_id:
            return "numbered_paragraphs"
        if "questions" in field_id:
            return "lettered_list"
        if "grounds" in field_id:
            return "lettered_list"
        if "prayer" in field_id or "relief" in field_id:
            return "roman_numerals"
        return "paragraphs"

    # ----------------- SMALL HELPERS -----------------

    @staticmethod
    def _snake(label: str) -> str:
        cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", label)
        cleaned = re.sub(r"\s+", " ", cleaned)
        return cleaned.strip().lower().replace(" ", "_")

    @staticmethod
    def _clean_label(label: str) -> str:
        return label.replace("_", " ").strip()

    @staticmethod
    def _humanize(field_id: str) -> str:
        return field_id.replace("_", " ").title()

    @staticmethod
    def _field_to_dict(f: Field) -> Dict[str, Any]:
        data = asdict(f)
        data["field_type"] = f.field_type.value
        return data

