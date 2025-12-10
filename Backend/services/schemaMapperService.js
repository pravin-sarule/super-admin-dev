/**
 * Schema Mapper Service
 * Maps Document AI raw response to structured legal summary schema
 */

/**
 * Map Document AI raw response to input_form_data schema
 * @param {Object} rawResponse - Raw Document AI response
 * @param {String} fileType - 'input' or 'output'
 * @returns {Object} Structured data according to schema
 */
const mapToLegalSummarySchema = (rawResponse, fileType = 'input') => {
  // Handle both text string and object formats
  let text = '';
  if (typeof rawResponse === 'string') {
    text = rawResponse;
  } else if (rawResponse && typeof rawResponse === 'object') {
    // Extract text from object structure
    text = rawResponse.document?.text || rawResponse.text || '';
  }

  if (!text) {
    return {
      error: 'No text found in raw response',
      schema: fileType === 'input' ? 'input_form_data' : 'output_summary_template',
    };
  }

  try {
    // Create a document object with just the text
    const documentObject = {
      document: {
        text: text
      }
    };

    if (fileType === 'input') {
      return mapToInputFormDataSchema(documentObject);
    } else {
      return mapToOutputSummaryTemplateSchema(documentObject);
    }
  } catch (error) {
    console.error('Error mapping to schema:', error);
    return {
      error: error.message,
      schema: fileType === 'input' ? 'input_form_data' : 'output_summary_template',
    };
  }
};

/**
 * Map Document AI response to input_form_data schema
 */
const mapToInputFormDataSchema = (rawResponse) => {
  const document = rawResponse.document || rawResponse;
  const text = document.text || '';
  
  // Extract metadata section
  const metadata = extractMetadata(text, document);
  
  // Extract analytical sections
  const analyticalSections = extractAnalyticalSections(text, document);
  
  // Extract attachment checklist
  const attachmentChecklist = extractAttachmentChecklist(text, document);
  
  return {
    description: "Schema for Legal Summary Generation based on Input Form v2 and Output Template v2",
    instructions: "The LLM must accept data matching the 'input_form_data' schema and generate a response strictly adhering to the 'output_summary_template' schema. All text fields should be extracted and structured for optimal LLM processing.",
    format: "json",
    version: "2.0",
    schemas: {
      input_form_data: {
        metadata: metadata,
        analytical_sections: analyticalSections,
        attachment_checklist: attachmentChecklist,
      },
    },
    extraction_metadata: {
      extracted_at: new Date().toISOString(),
      file_type: "input",
      extraction_method: "document_ai",
    },
  };
};

/**
 * Map Document AI response to output_summary_template schema
 */
const mapToOutputSummaryTemplateSchema = (rawResponse) => {
  const document = rawResponse.document || rawResponse;
  const text = document.text || '';
  
  // Extract metadata
  const metadata = extractOutputMetadata(text, document);
  
  // Extract generated sections
  const generatedSections = extractGeneratedSections(text, document);
  
  return {
    description: "Schema for Legal Summary Generation based on Input Form v2 and Output Template v2",
    instructions: "The LLM must accept data matching the 'input_form_data' schema and generate a response strictly adhering to the 'output_summary_template' schema. All text fields should be extracted and structured for optimal LLM processing.",
    format: "json",
    version: "2.0",
    schemas: {
      output_summary_template: {
        metadata: metadata,
        generated_sections: generatedSections,
      },
    },
    extraction_metadata: {
      extracted_at: new Date().toISOString(),
      file_type: "output",
      extraction_method: "document_ai",
    },
  };
};

/**
 * Extract metadata from input form
 */
const extractMetadata = (text, document) => {
  const metadata = {
    document_title: "GPT-Compatible Lawyer Summary Input Form (v2)",
    case_title: extractField(text, ['case title', 'case_title', 'case name']),
    court_bench_jurisdiction: extractField(text, ['court', 'bench', 'jurisdiction', 'court_bench_jurisdiction']),
    case_docket_number: extractField(text, ['docket', 'docket number', 'case_docket_number', 'case number']),
    stage_of_litigation: extractField(text, ['stage', 'stage of litigation', 'stage_of_litigation', 'litigation stage']),
    upcoming_hearing_date_urgency: extractField(text, ['hearing date', 'upcoming hearing', 'urgency', 'upcoming_hearing_date_urgency']),
    prepared_by_contact: extractField(text, ['prepared by', 'contact', 'prepared_by', 'prepared_by_contact']),
    date: extractField(text, ['date', 'prepared date'], true),
    primary_statutes_sections: extractField(text, ['statutes', 'sections', 'primary statutes', 'primary_statutes_sections']),
    reliefs_sought_brief: extractField(text, ['relief', 'reliefs sought', 'reliefs_sought', 'reliefs_sought_brief']),
    language_preference: extractEnumField(text, ['language', 'language preference', 'language_preference'], ['EN', 'HI', 'MR']),
    confidentiality_tag: extractEnumField(text, ['confidentiality', 'confidentiality tag', 'confidentiality_tag'], ['Public', 'Confidential', 'Privileged']),
  };
  
  return metadata;
};

/**
 * Extract metadata from output template
 */
const extractOutputMetadata = (text, document) => {
  return {
    document_title: "Lawyer Summary Output Template (v2)",
    case_title: extractField(text, ['case title', 'case_title', 'case name']),
    prepared_by: extractField(text, ['prepared by', 'prepared_by', 'author']),
    date: extractField(text, ['date', 'prepared date'], true),
  };
};

/**
 * Extract analytical sections from input form
 */
const extractAnalyticalSections = (text, document) => {
  return {
    section_2_1_ground_wise_summary: extractSection(text, '2.1', 'ground', 'ground-wise', 'ground_wise_summary'),
    section_2_2_annexure_summary: extractSection(text, '2.2', 'annexure', 'annexure summary'),
    section_2_3_risk_and_weak_points: extractSection(text, '2.3', 'risk', 'weak points', 'risk and weak'),
    section_2_4_expected_counter_arguments: extractSection(text, '2.4', 'counter', 'counter arguments', 'expected counter'),
    section_2_5_evidence_matrix: extractSection(text, '2.5', 'evidence', 'evidence matrix'),
    section_2_6_opponent_submissions_summary: extractSection(text, '2.6', 'opponent', 'opponent submissions'),
    section_2_7_procedural_timeline: extractSection(text, '2.7', 'procedural', 'timeline', 'procedural timeline'),
    section_2_8_legal_strategy_note: extractSection(text, '2.8', 'strategy', 'legal strategy'),
    section_2_9_compliance_deficiency: extractSection(text, '2.9', 'compliance', 'deficiency'),
    section_2_10_court_history: extractSection(text, '2.10', 'court history', 'history'),
    guidance_to_gpt: extractField(text, ['guidance', 'guidance to gpt', 'guidance_to_gpt', 'instructions']),
  };
};

/**
 * Extract generated sections from output template
 */
const extractGeneratedSections = (text, document) => {
  return {
    '2_1_ground_wise_summary': extractGeneratedSection(text, '2.1', 'ground', 'Extractive'),
    '2_2_annexure_summary': extractGeneratedSection(text, '2.2', 'annexure', 'Extractive'),
    '2_3_risk_and_weak_points': extractGeneratedSection(text, '2.3', 'risk', 'Abstractive'),
    '2_4_expected_counter_arguments': extractGeneratedSection(text, '2.4', 'counter', 'Abstractive'),
    '2_5_evidence_matrix': extractGeneratedSection(text, '2.5', 'evidence', 'Extractive + Abstractive'),
    '2_6_opponent_submissions_summary': extractGeneratedSection(text, '2.6', 'opponent', 'Extractive'),
    '2_7_procedural_timeline_summary': extractGeneratedSection(text, '2.7', 'procedural', 'Abstractive'),
    '2_8_legal_strategy_note': extractGeneratedSection(text, '2.8', 'strategy', 'Abstractive'),
    '2_9_compliance_and_deficiency_summary': extractGeneratedSection(text, '2.9', 'compliance', 'Extractive'),
    '2_10_court_history_summary': extractGeneratedSection(text, '2.10', 'court history', 'Extractive'),
  };
};

/**
 * Extract a section with content, citations, and uncertainties
 */
const extractSection = (text, sectionNumber, ...keywords) => {
  const sectionText = findSection(text, sectionNumber, keywords);
  
  return {
    content: extractContent(sectionText),
    pinpoint_citations: extractCitations(sectionText),
    uncertainties_open_questions: extractUncertainties(sectionText),
  };
};

/**
 * Extract a generated section with summary type and text
 */
const extractGeneratedSection = (text, sectionNumber, keyword, summaryType) => {
  const sectionText = findSection(text, sectionNumber, [keyword]);
  
  return {
    required_summary_type: summaryType,
    generated_text: extractContent(sectionText),
  };
};

/**
 * Find section text by number and keywords
 */
const findSection = (text, sectionNumber, keywords) => {
  if (!text) return '';
  
  // Try to find section by number pattern (2.1, 2.2, etc.)
  const sectionPattern = new RegExp(
    `(?:^|\\n)\\s*${sectionNumber.replace('.', '\\.')}[.\\s]+[^\\n]*(?:\\n(?!\\s*(?:2\\.|3\\.|\\d+\\.|$))[^\\n]*)*`,
    'im'
  );
  
  let match = text.match(sectionPattern);
  if (match) {
    return match[0];
  }
  
  // Fallback: search by keywords
  for (const keyword of keywords) {
    const keywordPattern = new RegExp(
      `(?:^|\\n)[^\\n]*${keyword}[^\\n]*(?:\\n(?!\\s*(?:2\\.|3\\.|\\d+\\.|$))[^\\n]*)*`,
      'im'
    );
    match = text.match(keywordPattern);
    if (match) {
      return match[0];
    }
  }
  
  return '';
};

/**
 * Extract content from section text
 */
const extractContent = (sectionText) => {
  if (!sectionText) return '';
  
  // Remove section headers and labels
  let content = sectionText
    .replace(/^\s*\d+\.\d+\s*[^\n]*\n?/i, '')
    .replace(/^(?:content|summary|text):\s*/i, '')
    .trim();
  
  // Remove citation markers if they're on separate lines
  content = content.replace(/\n\s*\[cite:\s*\d+\]\s*/g, '\n');
  
  return content || '';
};

/**
 * Extract citations from section text
 */
const extractCitations = (sectionText) => {
  if (!sectionText) return '';
  
  // Look for citation patterns like "Doc/Page", "cite:", etc.
  const citationPatterns = [
    /(?:pinpoint\s+)?citations?[:\s]+([^\n]+)/i,
    /(?:doc|document|page)[\s/]+([^\n]+)/i,
    /\[cite:\s*\d+\][\s:]+([^\n]+)/i,
  ];
  
  for (const pattern of citationPatterns) {
    const match = sectionText.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return '';
};

/**
 * Extract uncertainties/open questions
 */
const extractUncertainties = (sectionText) => {
  if (!sectionText) return '';
  
  const uncertaintyPatterns = [
    /uncertainties?[:\s]+([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:pinpoint|uncertainties|$))/i,
    /open\s+questions?[:\s]+([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:pinpoint|uncertainties|$))/i,
  ];
  
  for (const pattern of uncertaintyPatterns) {
    const match = sectionText.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return '';
};

/**
 * Extract field value by keywords
 */
const extractField = (text, keywords, isDate = false) => {
  if (!text) return '';
  
  for (const keyword of keywords) {
    const pattern = isDate
      ? new RegExp(`${keyword}[:\s]+(\\d{4}-\\d{2}-\\d{2}|\\d{2}/\\d{2}/\\d{4}|\\d{2}-\\d{2}-\\d{4})`, 'i')
      : new RegExp(`${keyword}[:\s]+([^\\n]+)`, 'i');
    
    const match = text.match(pattern);
    if (match && match[1]) {
      let value = match[1].trim();
      if (isDate && !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Try to convert date format
        const dateMatch = value.match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/);
        if (dateMatch) {
          value = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
        }
      }
      return value;
    }
  }
  
  return '';
};

/**
 * Extract enum field value
 */
const extractEnumField = (text, keywords, enumValues) => {
  const fieldValue = extractField(text, keywords);
  if (!fieldValue) return '';
  
  // Check if value matches enum
  for (const enumValue of enumValues) {
    if (fieldValue.toUpperCase().includes(enumValue.toUpperCase())) {
      return enumValue;
    }
  }
  
  return fieldValue;
};

/**
 * Extract attachment checklist
 */
const extractAttachmentChecklist = (text, document) => {
  const checklist = [];
  
  // Look for exhibit patterns
  const exhibitPattern = /(?:exhibit|attachment|annexure)[\s:]+([A-Z0-9]+)/gi;
  let match;
  
  while ((match = exhibitPattern.exec(text)) !== null) {
    checklist.push({
      exhibit_id: match[1],
      is_scanned: text.toLowerCase().includes('scanned'),
      is_ocred: text.toLowerCase().includes('ocr') || text.toLowerCase().includes('ocred'),
      has_bookmark_notes: text.toLowerCase().includes('bookmark'),
    });
  }
  
  // If no exhibits found, return empty array
  return checklist.length > 0 ? checklist : [];
};

module.exports = {
  mapToLegalSummarySchema,
  mapToInputFormDataSchema,
  mapToOutputSummaryTemplateSchema,
};

