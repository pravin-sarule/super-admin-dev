// services/adminDocumentService.js
class AdminDocumentService {
  constructor(gatewayUrl = 'https://gateway-service-120280829617.asia-south1.run.app') {
    this.baseUrl = `${gatewayUrl}/ai-agent/documents`;
  }

  // 1. Upload Document
  async upload(file) {
    const formData = new FormData();
    formData.append('document', file);
    const res = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to upload document');
    }
    return res.json();
  }

  // 2. Get All Documents (ALL statuses)
  async getAll() {
    const res = await fetch(`${this.baseUrl}/documents`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to fetch documents');
    }
    return res.json();
  }

  // 3. Get Single Document
  async getOne(fileId) {
    const res = await fetch(`${this.baseUrl}/${fileId}`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to fetch document');
    }
    return res.json();
  }

  // 4. Get Status
  async getStatus(fileId) {
    const res = await fetch(`${this.baseUrl}/status/${fileId}`);
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to fetch status');
    }
    return res.json();
  }

  // 5. Delete Document
  async delete(fileId) {
    const res = await fetch(`${this.baseUrl}/${fileId}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to delete document');
    }
    return res.json();
  }

  // 6. Retry Processing
  async retry(fileId) {
    const res = await fetch(`${this.baseUrl}/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId })
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to retry processing');
    }
    return res.json();
  }
}

export default AdminDocumentService;
