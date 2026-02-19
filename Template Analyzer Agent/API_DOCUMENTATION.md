# Template Analyzer Agent – API Documentation

**Base URL:** `http://localhost:8000/analysis`  
*(Use your agent URL in production.)*

**Model:** The agent uses **Gemini 2.5 Pro** by default. Set `GEMINI_MODEL=gemini-3-pro-preview` in the agent `.env` to use the latest Gemini 3 Pro.

---

## How it works (flow)

1. **Authentication**  
   The agent uses the same JWT as your app (from login). Send it as `Authorization: Bearer <token>` (e.g. from `localStorage`). Set `JWT_SECRET` in the agent `.env` to match your backend.

2. **Templates**  
   - **Admin-added:** `user_id` is null.  
   - **User-added:** `user_id` is the uploading user’s id from the token.

3. **Who sees what (enforced by the agent)**  
   - **Admin/Super-admin:** list = only admin-added templates. Can delete only admin-added.  
   - **User:** list = admin-added + their own templates. Can open only admin or own. Can delete only their own.  
   - **Upload:** User id from the token is stored on the template.

4. **Upload flow**  
   Client sends PDF/text + metadata to `POST /upload-template`. Agent extracts text, runs AI analysis, stores template + sections + fields, and returns `template_id`.

---

## Authentication

Send the login JWT on every request:

```
Authorization: Bearer <your-jwt>
```

Use the same token you store after login (e.g. `localStorage.getItem('token')`). The agent decodes it to get `id` and `role` and applies the rules above.

---

## API Reference (all endpoints)

### 1. Get All Templates

| | |
|---|---|
| **Endpoint** | `GET /templates` |
| **Headers** | `Authorization: Bearer <token>` (recommended) |
| **Query (optional)** | `is_admin` (bool), `user_id` (int) to override token |

**Behavior:**  
- Admin role in token → only admin-added templates (`user_id` IS NULL).  
- User → admin-added + that user’s templates.  
- No token and no params → all templates.

**Response:** `200 OK` – array of template objects (with `id`, `name`, `category`, `user_id`, `image_url`, etc.).

---

### 2. Upload Template

| | |
|---|---|
| **Endpoint** | `POST /upload-template` |
| **Content-Type** | `multipart/form-data` |
| **Headers** | `Authorization: Bearer <token>` (or form field `token` in Postman) |

**Form fields:** `name` (required), `category` (required), `subcategory`, `description`, `file` (required, PDF/text), `image`, `user_id` (fallback if no token), `token` (JWT in form for Postman).

**Response:** `200 OK`

```json
{
  "status": "success",
  "template_id": "uuid",
  "image_url": "https://...",
  "message": "Template uploaded and processed successfully"
}
```

---

### 3. Get Template Details

| | |
|---|---|
| **Endpoint** | `GET /template/{template_id}` |
| **Headers** | `Authorization: Bearer <token>` (recommended) |

**Access:** User can open only admin templates or templates they added; others get 404.

**Response:** `200 OK` – `{ "template": {...}, "sections": [...], "fields": {...} }`

**Section format (no mismatch):** Each item in `sections` has the same structure everywhere: `id`, `section_id`, `section_name`, `section_purpose`, `section_intro`, `section_prompts`, `order_index`, `fields` (array of field definitions for that section), `section_category`, `estimated_words`, `depends_on`. This matches the analyzer output so user side and admin see one consistent format.

---

### 4. Update Template Fields

| | |
|---|---|
| **Endpoint** | `PUT /template/{template_id}/fields` |
| **Body** | `{ "template_fields": { ... } }` |

---

### 5. Update Template Sections

| | |
|---|---|
| **Endpoint** | `PUT /template/{template_id}/sections` |
| **Body** | `{ "sections": [ { "id?", "section_name", "section_purpose", "section_intro", "section_prompts": [...] } ] }` |

---

### 6. Delete Template

| | |
|---|---|
| **Endpoint** | `DELETE /template/{template_id}` |

**Access:** Admin can delete only admin-added templates. User can delete only their own; otherwise 403.

---

### 7. Delete Section

| | |
|---|---|
| **Endpoint** | `DELETE /template/{template_id}/section/{section_id}` |

---

### 8. Generate Section (draft one section)

| | |
|---|---|
| **Endpoint** | `POST /template/{template_id}/generate-section` |
| **Body** | `{ "section_index": 0, "field_values": { "key": "value", ... }, "max_output_tokens": 65536 }` |

**Optional:** `section_id` (UUID) instead of `section_index`; `max_output_tokens` (default 65536) for long sections. Returns `{ "content": "...", "section_name": "...", "section_index": 0 }`. Use this from the user app to generate one section at a time (e.g. for 500+ page drafts).

---

### 9. Generate Full Draft

| | |
|---|---|
| **Endpoint** | `POST /template/{template_id}/generate-draft` |
| **Body** | `{ "field_values": { ... }, "max_output_tokens_per_section": 65536, "section_indexes": [0,1,2,...] }` |

Generates all sections in order (or only `section_indexes` if provided), concatenates with double newlines. Returns `{ "content": "full text", "section_count": N, "sections": [ { "section_index", "section_name", "content" } ] }`. Supports 500+ page documents by generating each section with high token limit (up to 65536 per section).

---

## User-Side API (frontend)

Use these from your **user-facing frontend** with the token from localStorage.

### Fetch templates (list)

**GET** `/templates` with `Authorization: Bearer <token>`.

- **Admin:** only admin-added templates.  
- **User:** admin-added + their own templates.

**Fetch example:**

```javascript
const ANALYSIS_BASE = 'http://localhost:8000/analysis';

function getAuthHeaders() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchTemplates() {
  const res = await fetch(`${ANALYSIS_BASE}/templates`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch templates');
  return res.json();
}
```

**Axios example:**

```javascript
const { data } = await axios.get(`${ANALYSIS_BASE}/templates`, {
  headers: getAuthHeaders(),
});
```

---

### Upload template

**POST** `/upload-template` with `Authorization: Bearer <token>`, body: `multipart/form-data`.

**Form fields:** `name`, `category`, `subcategory`, `description`, `file`, `image` (optional).

**Fetch example:**

```javascript
async function uploadTemplate({ name, category, subcategory, description, file, image }) {
  const form = new FormData();
  form.append('name', name);
  form.append('category', category);
  if (subcategory) form.append('subcategory', subcategory);
  if (description) form.append('description', description);
  form.append('file', file);
  if (image) form.append('image', image);

  const res = await fetch(`${ANALYSIS_BASE}/upload-template`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: form,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Upload failed');
  return res.json();
}
```

**Axios example:**

```javascript
const form = new FormData();
form.append('name', name);
form.append('category', category);
if (subcategory) form.append('subcategory', subcategory);
if (description) form.append('description', description);
form.append('file', file);
if (image) form.append('image', image);

const { data } = await axios.post(`${ANALYSIS_BASE}/upload-template`, form, {
  headers: getAuthHeaders(),
  timeout: 300000,
});
```

---

### Get one template (details)

**GET** `/template/{template_id}` with `Authorization: Bearer <token>`.

**Axios example:**

```javascript
async function getTemplateDetails(templateId) {
  const { data } = await axios.get(`${ANALYSIS_BASE}/template/${templateId}`, {
    headers: getAuthHeaders(),
  });
  return data;
}
```

---

### Quick reference (user-side)

| Action | Method | URL | Auth |
|--------|--------|-----|------|
| List templates | GET | `/analysis/templates` | Bearer token |
| Upload template | POST | `/analysis/upload-template` | Bearer token |
| Get template details | GET | `/analysis/template/{id}` | Bearer token |

**Access (enforced by agent):**  
- List: Admin = admin-only; User = admin + own.  
- Get one: User can open only admin or own templates.  
- Delete: Admin = admin-only; User = own only.  
- Upload: User id from token is stored on the template.
