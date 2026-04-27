// services/adminDocumentService.js
import { API_BASE_URL, getToken } from '../config';

const BASE = `${API_BASE_URL}/admin`;

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

class AdminDocumentService {
  /**
   * Step 1 – Ask the backend for a signed GCS upload URL.
   * Returns { signed_url, gcs_input_path, document_id }
   */
  async generateSignedUrl(filename, contentType = 'application/pdf') {
    const res = await fetch(`${BASE}/generate-signed-url`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content_type: contentType }),
    });
    return handleResponse(res);
  }

  /**
   * Step 2 – Upload the file directly to GCS via the signed URL.
   * This is a direct PUT to Google Cloud Storage — no backend involved.
   * @param {string} signedUrl  - The v4 signed URL from generateSignedUrl()
   * @param {File}   file       - The File object from the input element
   * @param {Function} onProgress - Optional progress callback (0–100)
   */
  async uploadToGCS(signedUrl, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/pdf');

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`GCS upload failed with status ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error during GCS upload'));
      xhr.send(file);
    });
  }

  /**
   * Step 3 – Tell the backend to start OCR + embedding pipeline.
   * Returns { success, document_id, status }
   */
  async processDocument(gcsInputPath, documentId, documentType = 'general') {
    const res = await fetch(`${BASE}/process-document`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gcs_input_path: gcsInputPath,
        document_id: documentId,
        document_type: documentType,
      }),
    });
    return handleResponse(res);
  }

  /**
   * Combined upload helper: signed URL → GCS PUT → trigger processing.
   * @param {File}     file          - File to upload
   * @param {Function} onProgress    - Optional (0–100) upload progress callback
   * @param {string}   documentType  - Category tag (e.g. 'general', 'legal', 'hr')
   */
  async upload(file, onProgress, documentType = 'general') {
    const { signed_url, gcs_input_path, document_id } = await this.generateSignedUrl(
      file.name,
      file.type || 'application/pdf'
    );
    await this.uploadToGCS(signed_url, file, onProgress);
    return this.processDocument(gcs_input_path, document_id, documentType);
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  async getAll() {
    const res = await fetch(`${BASE}/documents`, { headers: authHeaders() });
    const data = await handleResponse(res);
    // Normalise field names for the existing DocumentManagement table
    data.documents = (data.documents || []).map(normalizeDoc);
    return data;
  }

  async getOne(id) {
    const res = await fetch(`${BASE}/documents/${id}`, { headers: authHeaders() });
    const data = await handleResponse(res);
    if (data.document) data.document = normalizeDoc(data.document);
    return data;
  }

  async delete(id) {
    const res = await fetch(`${BASE}/documents/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return handleResponse(res);
  }
}

/** Map AI-document fields to the shape DocumentManagement.jsx expects */
const normalizeDoc = (doc) => ({
  ...doc,
  originalname: doc.file_name,
  status: doc.processing_status,
  chunks_count: doc.total_chunks,
  size: null,
  mimetype: 'application/pdf',
  ready_for_chat: doc.processing_status === 'active',
  summary: doc.error_message || null,
});

export default AdminDocumentService;
