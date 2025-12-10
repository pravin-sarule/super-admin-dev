# Document AI Integration Setup

## Overview
The system automatically extracts text from uploaded PDF files (input and output templates) using Google Cloud Document AI and stores the extracted text in the `document_ai_extractions` table.

## Environment Variables

Add these to your `.env` file:

```env
# Required - Already set
GCS_PROJECT_ID=your-project-id
GCS_KEY_BASE64=your-base64-encoded-service-account-key

# Optional - Document AI Configuration
DOCUMENT_AI_LOCATION=us  # Default: 'us' (can be 'us', 'eu', etc.)
DOCUMENT_AI_PROCESSOR_ID=your-processor-id  # Optional: specific processor ID
DOCUMENT_AI_OCR_PROCESSOR_VERSION_ID=pretrained-ocr-v2.1-2024-08-07  # Optional: specific processor version
```

## Setting Up Document AI

### 1. Enable Document AI API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Library**
3. Search for "Document AI API"
4. Click **Enable**

### 2. Create a Processor (Optional but Recommended)

#### Option A: Use General OCR Processor (Default)
- The system will try to use `general-ocr` processor if `DOCUMENT_AI_PROCESSOR_ID` is not set
- This works for basic text extraction

#### Option B: Create a Custom Processor
1. Go to **Document AI** > **Processors**
2. Click **Create Processor**
3. Choose processor type:
   - **Form Parser** - For forms with key-value pairs
   - **OCR Processor** - For general text extraction
   - **Invoice Parser** - For invoices
   - **Custom** - For custom document types
4. Copy the **Processor ID**
5. Set `DOCUMENT_AI_PROCESSOR_ID` in your `.env` file

### 3. Grant Permissions
Ensure your service account has these roles:
- **Document AI API User** (`roles/documentai.apiUser`)
- **Storage Object Viewer** (to read files from GCS if needed)

## How It Works

1. **File Upload**: User uploads input and output PDF files
2. **GCS Upload**: Files are uploaded to Google Cloud Storage
3. **Document AI Processing**: 
   - Both PDFs are processed with Document AI
   - Text is extracted from each PDF
4. **Database Storage**: 
   - Extracted text is saved to `document_ai_extractions` table
   - Linked to the `template_files` record via `template_file_id`
5. **Response**: API returns success with extraction status

## Database Schema

The extracted text is stored in `document_ai_extractions` table with:
- `extracted_text` - Full text content
- `file_type` - 'input' or 'output'
- `page_count`, `total_characters`, `total_words` - Statistics
- `entities`, `form_fields`, `tables` - Structured data (JSONB)
- `confidence_score` - Extraction confidence
- `raw_response` - Complete Document AI response

## Querying Extracted Text

```sql
-- Get extracted text for a template
SELECT 
  e.extracted_text,
  e.page_count,
  e.total_characters,
  e.confidence_score,
  tf.original_filename,
  tf.file_type
FROM document_ai_extractions e
JOIN template_files tf ON e.template_file_id = tf.id
WHERE tf.secret_manager_id = 'your-secret-id'
  AND e.file_type = 'input';
```

## Error Handling

- If Document AI processing fails, the file upload still succeeds
- Extraction errors are logged but don't block the upload
- Check logs for extraction status
- Extraction status is included in API response (`textExtracted: true/false`)

## Troubleshooting

### Error: "Processor not found"
- Create a processor in GCP Console
- Set `DOCUMENT_AI_PROCESSOR_ID` in `.env`
- Or ensure `general-ocr` processor exists in your project

### Error: "Permission denied"
- Grant **Document AI API User** role to service account
- Ensure Document AI API is enabled

### No text extracted
- Check Document AI API is enabled
- Verify processor exists and is accessible
- Check service account permissions
- Review server logs for detailed error messages

