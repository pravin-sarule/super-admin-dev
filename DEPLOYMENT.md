# Deploy Backend + Template Analyzer Agent to Google Cloud Run

This guide covers deploying both services as separate Cloud Run services.

---

## Prerequisites

1. **Google Cloud SDK (gcloud)** installed and configured
2. **Docker** installed (for local build) or use Cloud Build
3. **GCP Project** with:
   - Cloud Run API enabled
   - Artifact Registry API enabled (or Container Registry)
   - Cloud SQL (or external PostgreSQL) for databases

---

## 1. Initial GCP Setup

```bash
# Login
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

---

## 2. Create Artifact Registry Repository

```bash
gcloud artifacts repositories create super-admin \
  --repository-format=docker \
  --location=REGION \
  --description="Super Admin Backend & Analyzer Agent"
```

Replace `REGION` with e.g. `us-central1`, `asia-south1`, etc.

---

## 3. Configure Docker for Artifact Registry

```bash
gcloud auth configure-docker REGION-docker.pkg.dev
```

---

## 4. Deploy Backend

### 4a. Build and push image

```bash
cd Backend
docker build -t REGION-docker.pkg.dev/YOUR_PROJECT_ID/super-admin/backend:latest .
docker push REGION-docker.pkg.dev/YOUR_PROJECT_ID/super-admin/backend:latest
```

### 4b. Deploy to Cloud Run

```bash
gcloud run deploy backend \
  --image REGION-docker.pkg.dev/YOUR_PROJECT_ID/super-admin/backend:latest \
  --region REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "DATABASE_URL=postgresql://user:pass@host:5432/db" \
  --set-env-vars "DOCDB_URL=postgresql://user:pass@host:5432/docdb" \
  --set-env-vars "DRAFT_DB_URL=postgresql://user:pass@host:5432/draft" \
  --set-env-vars "PAYMENT_DB_URL=postgresql://user:pass@host:5432/payment" \
  --set-env-vars "JWT_SECRET=your_jwt_secret" \
  --set-env-vars "GCS_KEY_BASE64=base64_encoded_service_account_json" \
  --set-env-vars "GCS_PROJECT_ID=YOUR_PROJECT_ID" \
  --set-env-vars "LEGAL_TEMPLATES_BUCKET_NAME=legal-templates-bucket"
```

**Backend environment variables (from your config):**

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Main Auth DB PostgreSQL URL |
| `DOCDB_URL` | Yes | Document/Secrets DB PostgreSQL URL |
| `DRAFT_DB_URL` | Yes | Draft templates DB PostgreSQL URL |
| `PAYMENT_DB_URL` | Yes | Payment/Templates DB PostgreSQL URL |
| `JWT_SECRET` | Yes | Same secret used for auth |
| `GCS_KEY_BASE64` | Yes | Base64 of GCP service account JSON |
| `GCS_PROJECT_ID` | Yes | GCP project ID |
| `LEGAL_TEMPLATES_BUCKET_NAME` | No | Default: `legal-templates-bucket` |

**Optional:** Use Secret Manager instead of `--set-env-vars` for sensitive values:

```bash
--set-secrets="DATABASE_URL=db-url:latest,JWT_SECRET=jwt-secret:latest"
```

---

## 5. Deploy Template Analyzer Agent

### 5a. Build and push image

```bash
cd "Template Analyzer Agent"
docker build -t REGION-docker.pkg.dev/YOUR_PROJECT_ID/super-admin/analyzer:latest .
docker push REGION-docker.pkg.dev/YOUR_PROJECT_ID/super-admin/analyzer:latest
```

### 5b. Deploy to Cloud Run

```bash
gcloud run deploy analyzer \
  --image REGION-docker.pkg.dev/YOUR_PROJECT_ID/super-admin/analyzer:latest \
  --region REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --timeout 600 \
  --set-env-vars "DATABASE_URL=postgresql://user:pass@host:5432/draft" \
  --set-env-vars "JWT_SECRET=your_jwt_secret" \
  --set-env-vars "GEMINI_API_KEY=your_gemini_key" \
  --set-env-vars "GEMINI_MODEL=gemini-2.5-pro" \
  --set-env-vars "GCS_KEY_BASE64=base64_encoded_service_account_json" \
  --set-env-vars "GCLOUD_PROJECT_ID=YOUR_PROJECT_ID" \
  --set-env-vars "DOCUMENT_AI_LOCATION=us" \
  --set-env-vars "DOCUMENT_AI_PROCESSOR_ID=your_processor_id" \
  --set-env-vars "GCS_BUCKET_NAME=draft_templates"
```

**Analyzer environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Draft DB PostgreSQL URL (same DB as templates) |
| `JWT_SECRET` | Yes | Same as Backend (for token verification) |
| `GEMINI_API_KEY` | Yes | Gemini API key |
| `GEMINI_MODEL` | No | Default: `gemini-2.5-pro` |
| `GCS_KEY_BASE64` | Yes | Base64 of GCP service account JSON |
| `GCLOUD_PROJECT_ID` | Yes | GCP project ID |
| `DOCUMENT_AI_LOCATION` | Yes | e.g. `us`, `eu` |
| `DOCUMENT_AI_PROCESSOR_ID` | Yes | Document AI processor ID |
| `AUTH_DATABASE_URL` | No | Auth DB for role checks |
| `GCS_BUCKET_NAME` | No | Default: `draft_templates` |

---

## 6. Update CORS (Backend)

Add your Cloud Run URLs and Frontend URL to CORS in `Backend/server.js`:

```javascript
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:4000',
  'https://nexintel-super-admin.netlify.app',
  'https://YOUR_BACKEND_URL.run.app',
  'https://YOUR_FRONTEND_DOMAIN.com'
];
```

Redeploy Backend after this change.

---

## 7. Update Frontend for Production

Build the Frontend with production API URLs:

```bash
cd Frontend
VITE_API_BASE_URL=https://YOUR_BACKEND_URL.run.app/api \
VITE_ANALYSIS_API_URL=https://YOUR_ANALYZER_URL.run.app/analysis \
  npm run build
```

**Template Management** currently hardcodes `ANALYSIS_API_URL`. Update `Frontend/src/pages/dashboard/TemplateManagement/index.jsx` to use the env variable:

```javascript
const ANALYSIS_API_URL = import.meta.env?.VITE_ANALYSIS_API_URL || 'http://127.0.0.1:8000/analysis';
```

Then deploy the built `dist/` folder to your static host (Netlify, Firebase Hosting, etc.).

---

## 8. One-Command Deploy (Cloud Build)

Create `cloudbuild.yaml` in the project root for automated deploys:

```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'REGION-docker.pkg.dev/$PROJECT_ID/super-admin/backend:$SHORT_SHA', 'Backend']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'REGION-docker.pkg.dev/$PROJECT_ID/super-admin/backend:$SHORT_SHA']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - run
      - deploy
      - backend
      - --image=REGION-docker.pkg.dev/$PROJECT_ID/super-admin/backend:$SHORT_SHA
      - --region=REGION
      - --platform=managed
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'REGION-docker.pkg.dev/$PROJECT_ID/super-admin/analyzer:$SHORT_SHA', 'Template Analyzer Agent']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'REGION-docker.pkg.dev/$PROJECT_ID/super-admin/analyzer:$SHORT_SHA']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - run
      - deploy
      - analyzer
      - --image=REGION-docker.pkg.dev/$PROJECT_ID/super-admin/analyzer:$SHORT_SHA
      - --region=REGION
      - --platform=managed
```

Trigger:

```bash
gcloud builds submit --config cloudbuild.yaml
```

---

## 9. Quick Reference

| Service | Default Port | Cloud Run Port | URL after deploy |
|---------|--------------|----------------|------------------|
| Backend | 4000 | 8080 | `https://backend-xxx-REGION.run.app` |
| Analyzer Agent | 8000 | 8080 | `https://analyzer-xxx-REGION.run.app` |

---

## 10. Troubleshooting

- **503 / Timeout**: Increase `--timeout` (max 3600) and `--memory` for the Analyzer; template analysis can be slow.
- **Database connection refused**: Ensure Cloud SQL has authorized networks (or use Private IP / VPC connector).
- **CORS errors**: Add Frontend and Backend URLs to `allowedOrigins`.
- **Secret values**: Prefer Secret Manager over plain `--set-env-vars` for sensitive data.
