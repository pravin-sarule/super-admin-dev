from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func
import uuid
from ..database import Base

class Template(Base):
    """Stores basic template metadata - EXACT mapping to user's templates table.
    In the existing Draft_DB, the primary key column is named 'template_id'."""
    __tablename__ = "templates"

    # Database column is template_id; mapped attribute is id
    id = Column("template_id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column("template_name", String(255), nullable=False)
    category = Column(String(100), nullable=True)
    subcategory = Column("sub_category", String(100), nullable=True) # Matches existing sub_category
    language = Column(String(50), default="en")
    status = Column(String(50), default="active")
    description = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)  # For admin tracking
    user_id = Column(Integer, nullable=True)  # For user tracking (when users upload templates)
    
    # AI-specific extra columns (Verify if they need to be added or mapped)
    # Existing columns in your DB also include matches for these if added previously
    image_url = Column(Text, nullable=True)
    file_url = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class TemplateField(Base):
    """Stores all extracted field definitions for a template"""
    __tablename__ = "template_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey('templates.template_id'), index=True, nullable=False)
    template_fields = Column(JSONB, nullable=False) # Full JSON inventory from Phase 1
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

class TemplateSection(Base):
    """Stores logical sections and their specific prompts - Mapped to template_analysis_sections"""
    __tablename__ = "template_analysis_sections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey('templates.template_id'), index=True, nullable=False)

    section_name = Column(String(255), nullable=False)
    section_purpose = Column(Text, nullable=True) 
    section_intro = Column(Text, nullable=True)   
    
    # Stores field IDs and their contextual prompts
    section_prompts = Column(JSONB, nullable=False) 
    
    order_index = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

class TemplateUserFieldValue(Base):
    """Stores the actual values provided by a user for a template"""
    __tablename__ = "template_user_field_values"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey('templates.template_id'), index=True, nullable=False)
    user_id = Column(Integer, index=True, nullable=False)
    
    field_values = Column(JSONB, nullable=False) # Key-Value pairs: {"first_name": "John"}
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
