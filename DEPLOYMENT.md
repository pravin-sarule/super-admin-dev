# Deploy Super Admin Platform to Google Cloud Run

This guide covers deploying the platform's backend services as separate Cloud Run
services:

| Service | Folder | Default port | Purpose |
|---------|--------|--------------|---------|
| **Backend** | `Backend` | 4000 | Main API gateway (auth, users, billing, support workspace, voice) |
| **Template Analyzer Agent** | `Template Analyzer Agent` | 8000 | Template ingestion & AI analysis |
| **Judgement Service** | `judgement-service` | 8095 | Judgement/citation ingestion, OCR, embeddings & vector search |

The Backend proxies to the Analyzer and Judgement services, so all three are
typically deployed together. The Frontend is a static build (deploy to Netlify /
Firebase Hosting / any static host).

---

## Prerequisites

1. **Google Cloud SDK (gcloud)** installed and configured
2. **Docker** installed (for local build) or use Cloud Build
3. **GCP Project** with:
   - Cloud Run API enabled
   - Artifact Registry API enabled (or Container Registry)
   - Cloud SQL (or external PostgreSQL) for databases
   - Document AI API enabled (Analyzer & Judgement services)
4. **Qdrant** (managed or self-hosted) and **Elasticsearch** endpoints reachable
   from the Judgement Service

> **Note:** `Backend` and `Template Analyzer Agent` ship with a `Dockerfile`.
> `judgement-service` does **not** yet have one — add a Node 20 Dockerfile mirroring
> `Backend/Dockerfile` before building (see step 6a) or deploy it from source with
> `gcloud run deploy --source`.

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
gcloud services enable documentai.googleapis.com
```

---

## 2. Create Artifact Registry Repository

```bash
gcloud artifacts repositories create super-admin \
  --repository-format=docker \
  --location=REGION \
  --description="Super Admin Backend, Analyzer & Judgement services"
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
  --set-env-vars "SUPPORT_DATABASE_URL=postgresql://user:pass@host:5432/support" \
  --set-env-vars "JWT_SECRET=your_jwt_secret" \
  --set-env-vars "GCS_KEY_BASE64=base64_encoded_service_account_json" \
  --set-env-vars "GCS_PROJECT_ID=YOUR_PROJECT_ID" \
  --set-env-vars "LEGAL_TEMPLATES_BUCKET_NAME=legal-templates-bucket" \
  --set-env-vars "JUDGEMENT_SERVICE_URL=https://YOUR_JUDGEMENT_URL.run.app" \
  --set-env-vars "JUDGEMENT_INTERNAL_API_KEY=shared_internal_key"
```

**Backend environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Main Auth DB PostgreSQL URL |
| `DOCDB_URL` | Yes | Document/Secrets DB PostgreSQL URL |
| `DRAFT_DB_URL` | Yes | Draft templates DB PostgreSQL URL |
| `PAYMENT_DB_URL` | Yes | Payment/Templates DB PostgreSQL URL |
| `SUPPORT_DATABASE_URL` | Yes | Support workspace DB (tickets, team, assignments). Fallback: `SUPPORT_DB_URL` |
| `JWT_SECRET` | Yes | Same secret used for auth |
| `GCS_KEY_BASE64` | Yes | Base64 of GCP service account JSON |
| `GCS_PROJECT_ID` | Yes | GCP project ID |
| `LEGAL_TEMPLATES_BUCKET_NAME` | No | Default: `legal-templates-bucket` |
| `JUDGEMENT_SERVICE_URL` | No | Judgement service base URL. Default: `http://localhost:8095` |
| `JUDGEMENT_INTERNAL_API_KEY` | No | Shared key for Backend→Judgement calls. Fallback: `INTERNAL_SERVICE_KEY` |
| `JUDGEMENT_API_KEY` | No | Public API key forwarded to the Judgement service |
| `JURINEX_VOICE_DATABASE_URL` | No | Voice module DB (only if the voice feature is used) |
| `CLIENT_URL` / `FRONTEND_URL` | No | Frontend origin(s) for CORS/redirects |

> The Backend also reads several optional DB URLs used by individual modules
> (`CHATBOT_DATABASE_URL`, `CITATION_DB_URL`, `CALLING_AGENT_DATABASE_URL`,
> `TEMPLATE_DB_URL`) and email/SMTP settings (`EMAIL_HOST`, `EMAIL_USER`,
> `EMAIL_PASS`, `EMAIL_FROM`). Set only the ones your enabled modules need.

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

## 6. Deploy Judgement Service

The Judgement Service ingests judgement/citation documents, runs OCR (Document AI),
generates embeddings (Gemini) and stores them in **Qdrant** for vector search, with
**Elasticsearch** for keyword search. It listens on port **8095** by default and is
called by the Backend via `JUDGEMENT_SERVICE_URL`.

### 6a. Build and push image

`judgement-service` has no `Dockerfile` yet — add one (Node 20, `npm ci`,
`CMD ["node", "server.js"]`, `EXPOSE 8080`) modeled on `Backend/Dockerfile`, then:

```bash
cd judgement-service
docker build -t REGION-docker.pkg.dev/YOUR_PROJECT_ID/super-admin/judgement:latest .
docker push REGION-docker.pkg.dev/YOUR_PROJECT_ID/super-admin/judgement:latest
```

Alternatively, deploy straight from source (Cloud Build auto-detects Node):

```bash
cd judgement-service
gcloud run deploy judgement --source . --region REGION --port 8080 ...
```

### 6b. Deploy to Cloud Run

```bash
gcloud run deploy judgement \
  --image REGION-docker.pkg.dev/YOUR_PROJECT_ID/super-admin/judgement:latest \
  --region REGION \
  --platform managed \
  --no-allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --timeout 600 \
  --set-env-vars "CITATION_DB_URL=postgresql://user:pass@host:5432/citation" \
  --set-env-vars "JWT_SECRET=your_jwt_secret" \
  --set-env-vars "INTERNAL_SERVICE_KEY=shared_internal_key" \
  --set-env-vars "GOOGLE_API_KEY=your_gemini_key" \
  --set-env-vars "GCS_KEY_BASE64=base64_encoded_service_account_json" \
  --set-env-vars "GCS_BUCKET_NAME=judgement_docs" \
  --set-env-vars "GCLOUD_PROJECT_ID=YOUR_PROJECT_ID" \
  --set-env-vars "DOCUMENT_AI_LOCATION=us" \
  --set-env-vars "DOCUMENT_AI_PROCESSOR_ID=your_processor_id" \
  --set-env-vars "QDRANT_URL=https://your-qdrant-host:6333" \
  --set-env-vars "QDRANT_API_KEY=your_qdrant_key" \
  --set-env-vars "QDRANT_COLLECTION=legal_embeddings_v2" \
  --set-env-vars "ELASTICSEARCH_URL=https://your-es-host:9200" \
  --set-env-vars "ELASTICSEARCH_USERNAME=elastic" \
  --set-env-vars "ELASTICSEARCH_PASSWORD=your_es_password"
```

> Deploy with `--no-allow-unauthenticated` (internal-only) and let the Backend reach
> it via a shared key. If the Backend and Judgement service can't share a private
> network, keep it authenticated and pass a Cloud Run identity token, or gate access
> with `INTERNAL_SERVICE_KEY` / `JUDGEMENT_INTERNAL_API_KEY`.

**Judgement Service environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `CITATION_DB_URL` | Yes | Judgement/citation PostgreSQL URL. Fallback: `DATABASE_URL` |
| `JWT_SECRET` | Yes | Same as Backend (for token verification) |
| `INTERNAL_SERVICE_KEY` | Yes | Shared key the Backend uses for internal calls. Alias: `JUDGEMENT_INTERNAL_API_KEY` |
| `GOOGLE_API_KEY` | Yes | Gemini API key (embeddings & metadata) |
| `GCS_KEY_BASE64` | Yes | Base64 of GCP service account JSON |
| `GCS_BUCKET_NAME` | Yes | Bucket for uploaded judgement documents |
| `GCLOUD_PROJECT_ID` | Yes | GCP project ID (alias: `GCS_PROJECT_ID`) |
| `DOCUMENT_AI_LOCATION` | Yes | Document AI location, e.g. `us` |
| `DOCUMENT_AI_PROCESSOR_ID` | Yes | Document AI OCR processor ID |
| `QDRANT_URL` | Yes | Qdrant endpoint |
| `QDRANT_API_KEY` | If secured | Qdrant API key |
| `QDRANT_COLLECTION` | No | Default: `legal_embeddings_v2` |
| `ELASTICSEARCH_URL` | Yes | Elasticsearch endpoint |
| `ELASTICSEARCH_USERNAME` | If secured | Elasticsearch user (alias: `ELASTIC_USER`) |
| `ELASTICSEARCH_PASSWORD` | If secured | Elasticsearch password (alias: `ELASTIC_PASSWORD`) |
| `GEMINI_EMBEDDING_MODEL` | No | Embedding model override |
| `PORT` | No | Default: `8095` (Cloud Run injects `8080`) |

### 6c. One-time: initialize the Qdrant collection

Before the service can store embeddings, create the vector collection. Run once
against your Qdrant endpoint (locally or from a job) with `QDRANT_URL`,
`QDRANT_API_KEY` and `QDRANT_COLLECTION` set:

```bash
cd judgement-service
node scripts/initQdrantCollection.js
```

This creates the collection (default `legal_embeddings_v2`) with the correct
embedding dimension and payload indexes. It is idempotent — safe to re-run.

---

## 7. Update CORS (Backend)

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

## 8. Update Frontend for Production

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

> The Judgement Service is reached **through the Backend** (`/api/judgement/*`
> proxy), so the Frontend needs no separate judgement URL.

---

## 9. One-Command Deploy (Cloud Build)

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
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'REGION-docker.pkg.dev/$PROJECT_ID/super-admin/judgement:$SHORT_SHA', 'judgement-service']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'REGION-docker.pkg.dev/$PROJECT_ID/super-admin/judgement:$SHORT_SHA']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - run
      - deploy
      - judgement
      - --image=REGION-docker.pkg.dev/$PROJECT_ID/super-admin/judgement:$SHORT_SHA
      - --region=REGION
      - --platform=managed
```

Trigger:

```bash
gcloud builds submit --config cloudbuild.yaml
```

---

## 10. Quick Reference

| Service | Default Port | Cloud Run Port | URL after deploy |
|---------|--------------|----------------|------------------|
| Backend | 4000 | 8080 | `https://backend-xxx-REGION.run.app` |
| Analyzer Agent | 8000 | 8080 | `https://analyzer-xxx-REGION.run.app` |
| Judgement Service | 8095 | 8080 | `https://judgement-xxx-REGION.run.app` |

---

## 11. Troubleshooting

- **503 / Timeout**: Increase `--timeout` (max 3600) and `--memory` for the Analyzer
  and Judgement services; template/judgement analysis and OCR can be slow.
- **Database connection refused**: Ensure Cloud SQL has authorized networks (or use
  Private IP / VPC connector). Each service needs its own DB URL set.
- **CORS errors**: Add Frontend and Backend URLs to `allowedOrigins`.
- **Judgement 502 from Backend**: Check `JUDGEMENT_SERVICE_URL` points to the deployed
  service and that `INTERNAL_SERVICE_KEY` / `JUDGEMENT_INTERNAL_API_KEY` matches on
  both sides.
- **Qdrant errors / empty search**: Confirm the collection was created
  (`scripts/initQdrantCollection.js`) and `QDRANT_URL` / `QDRANT_API_KEY` /
  `QDRANT_COLLECTION` match between the init run and the deployed service.
- **Elasticsearch auth failures**: Verify `ELASTICSEARCH_URL` and the
  username/password (or `ELASTIC_USER` / `ELASTIC_PASSWORD`) credentials.
- **Secret values**: Prefer Secret Manager over plain `--set-env-vars` for sensitive data.
```
