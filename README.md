# NexIntel Super Admin Platform

Internal administration platform for managing NexIntel users, plans, prompts, legal content, support operations, AI document workflows, judgments, citations, and voice agents.

The repository contains four applications that are developed and deployed independently:

| Application | Technology | Default local URL | Purpose |
| --- | --- | --- | --- |
| `Frontend` | React 19, Vite 7, Tailwind CSS 4 | `http://localhost:3001` | Role-based administration dashboard |
| `Backend` | Node.js 20, Express 5 | `http://localhost:4000` | Main API, authentication, administration modules, and upstream service proxying |
| `judgement-service` | Node.js, Express 5 | `http://localhost:8095` | Judgment ingestion, OCR, metadata extraction, vector indexing, and search |
| `Template Analyzer Agent` | Python 3.11, FastAPI | `http://localhost:8000` | Legal-template analysis, field extraction, and prompt generation |

## Main capabilities

- Role-based access for super, user, account, marketing, and support administrators
- User, administrator, role, subscription, add-on, and plan analytics management
- LLM, system prompt, agent prompt, preset prompt, and chatbot configuration
- Legal template, court, judge, case-type, and document management
- Support ticket workspace and demo-booking management
- Judgment upload, pipeline monitoring, metadata review, semantic/full-text search, and citation analytics
- Jurinex Voice agent configuration, knowledge bases, call history, scheduling, calendar tools, and diagnostics

## Architecture

```text
React admin dashboard (Frontend)
        |-- /api --> Main Express API (Backend)
        |                 |-- PostgreSQL databases
        |                 |-- Google Cloud Storage / AI services
        |                 `--> judgement-service
        |                         |-- PostgreSQL
        |                         |-- Google Document AI / Storage
        |                         |-- Elasticsearch
        |                         `-- Qdrant
        |
        `-- /analysis --> Template Analyzer Agent
                              |-- Draft/Auth PostgreSQL
                              `-- configured LLM / Document AI provider
```

On `localhost`, Vite forwards `/api` requests to the main API. Judgment requests normally enter through `/api/judgements-admin` and are forwarded to `judgement-service` at `/api/judgements`. The frontend calls the Template Analyzer `/analysis` routes directly.

## Repository layout

```text
.
├── Backend/                    Main Express API and Jurinex Voice module
├── Frontend/                   React administration dashboard
├── judgement-service/         Judgment processing and search service
├── Template Analyzer Agent/   FastAPI template-analysis service
├── docs/                       Feature-specific integration documents
├── DEPLOYMENT.md               Google Cloud Run deployment guide
└── README.md                   Project overview and local setup
```

## Prerequisites

- Node.js `20.19+` and npm (Vite 7 requires a current Node.js 20 or 22 release)
- Python `3.11+` and `pip`
- PostgreSQL databases for the modules you intend to run
- `pgvector` where vector-backed document or voice features are enabled
- Access to the configured Google Cloud, Gemini/Google AI, Elasticsearch, and Qdrant resources for the associated workflows

There is no root package manifest. Install dependencies separately in each JavaScript application.

## Configuration

Keep credentials in local `.env` files or a managed secret store. Never commit database URLs, JWT secrets, API keys, or service-account JSON. Values below are names only; use credentials for your own environment.

### Main API: `Backend/.env`

The main API loads several data stores during startup. Configure the connections used by your environment:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port; defaults to `4000` |
| `DATABASE_URL` | Main authentication and user PostgreSQL database |
| `DOCDB_URL` | Document, prompt, and secret-management PostgreSQL database |
| `DRAFT_DB_URL` | Draft/template and agent-prompt PostgreSQL database |
| `PAYMENT_DB_URL` | Plans, subscriptions, and usage PostgreSQL database |
| `CITATION_DB_URL` | Citation analytics PostgreSQL database |
| `CHATBOT_DATABASE_URL` | AI document and chatbot PostgreSQL database |
| `SUPPORT_DATABASE_URL` | Support workspace PostgreSQL database (`SUPPORT_DB_URL` is also accepted) |
| `JURINEX_VOICE_DATABASE_URL` | Jurinex Voice PostgreSQL database |
| `JUDGEMENT_SERVICE_URL` | Judgment service origin; defaults to `http://localhost:8095` |
| `JUDGEMENT_INTERNAL_API_KEY` | Shared key for trusted main-API-to-judgment-service requests |
| `GCS_KEY_BASE64` | Base64-encoded Google service-account JSON |
| `GCS_PROJECT_ID` | Google Cloud project used by storage integrations |
| `GCS_BUCKET_NAME` | Default/support attachment bucket |
| `LEGAL_TEMPLATES_BUCKET_NAME` | Legal-template bucket |
| `GCS_VOICE_BUCKET` | Jurinex Voice knowledge-document bucket |
| `GOOGLE_API_KEY` or `GEMINI_API_KEY` | Gemini embeddings, previews, and other AI features |

Email, Google Calendar, Document AI, usage-cost, and voice-test variables are feature-specific. See [Jurinex Voice module documentation](Backend/modules/jurinex-voice/README.md), [Jurinex Voice data model](docs/JURINEX_VOICE_DATA_MODEL.md), and [Document AI setup](Backend/DOCUMENT_AI_SETUP.md).

### Judgment service: `judgement-service/.env`

| Variable | Purpose |
| --- | --- |
| `PORT` | Service port; defaults to `8095` |
| `CITATION_DB_URL` or `DATABASE_URL` | Judgment PostgreSQL database |
| `JWT_SECRET` | JWT verification secret shared with the authentication system |
| `JUDGEMENT_INTERNAL_API_KEY` | Trusted proxy key shared with the main API |
| `JUDMENT_API_KEY` | API key for external search routes; the spelling matches the implemented module |
| `GCS_PROJECT_ID`, `GCS_BUCKET_NAME` | Google Cloud project and judgment artifact bucket |
| `GCS_KEY_BASE64` or `GOOGLE_APPLICATION_CREDENTIALS` | Google service-account credentials |
| `DOCUMENT_AI_LOCATION`, `DOCUMENT_AI_PROCESSOR_ID` | Google Document AI OCR processor |
| `GOOGLE_API_KEY` | Gemini embedding and metadata extraction |
| `ELASTICSEARCH_URL` | Full-text search service (`ELASTIC_URL` is also accepted) |
| `ELASTICSEARCH_USERNAME`, `ELASTICSEARCH_PASSWORD` | Elasticsearch credentials when required |
| `QDRANT_URL`, `QDRANT_API_KEY` | Vector search service and optional credential |
| `QDRANT_COLLECTION` | Vector collection; defaults to `legal_embeddings_v2` |

The service exposes authenticated administration routes under `/api/judgements` and API-key-protected search routes under `/api/judment-api`.

### Template Analyzer Agent: `Template Analyzer Agent/.env`

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` or `DRAFT_DB_URL` | Draft/template PostgreSQL database |
| `AUTH_DATABASE_URL` | Optional authentication database for role and ownership checks |
| `JWT_SECRET` | JWT verification secret shared with the authentication system |
| `DEFAULT_LLM_PROVIDER` | Default analysis provider; provider-specific overrides are supported |
| `ANTHROPIC_API_KEY` | Required when an Anthropic analysis provider is selected |
| `GEMINI_API_KEY` | Required when Gemini is selected |
| `GCS_KEY_BASE64`, `GCLOUD_PROJECT_ID`, `GCS_BUCKET_NAME` | Google Cloud Storage configuration |
| `DOCUMENT_AI_LOCATION`, `DOCUMENT_AI_PROCESSOR_ID` | Document AI extraction configuration |

For all endpoints and authorization behavior, see the [Template Analyzer API documentation](Template%20Analyzer%20Agent/API_DOCUMENTATION.md).

### Frontend: `Frontend/.env`

Browser-facing `VITE_*` values are embedded at build time. The development proxy target is read by `vite.config.js` when the dev server starts:

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Main API origin or `/api` base; `/api` is used automatically on localhost |
| `VITE_DEV_PROXY_TARGET` | Local Vite proxy target; defaults to `http://localhost:4000` |
| `VITE_JUDGEMENT_SERVICE_URL` | Direct judgment-service origin used by fallback flows |
| `VITE_TEMPLATE_ANALYZER_BASE_URL` | Template Analyzer origin |
| `VITE_ANALYSIS_API_URL` | Optional complete analyzer `/analysis` URL |
| `VITE_JUDGEMENT_UPLOAD_MAX_FILES` | Client-side batch upload limit |

A minimal local frontend can run without `Frontend/.env` when the main API is available at `http://localhost:4000`.

## Local development

Use a separate terminal for each service.

### 1. Start the judgment service

```bash
cd judgement-service
npm ci
npm run dev
```

Basic health check: `GET http://localhost:8095/health`.

### 2. Start the main API

```bash
cd Backend
npm ci
npm run dev
```

Database health check: `GET http://localhost:4000/api/admin/health`.

The API initializes supporting tables during startup. Review the first-run output and resolve any unavailable database or cloud dependency before using its related dashboard module.

### 3. Start the Template Analyzer Agent

```bash
cd 'Template Analyzer Agent'
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn src.app:app --reload --port 8000
```

On Windows PowerShell, activate the environment with `.venv\Scripts\Activate.ps1`. FastAPI documentation is available at `http://localhost:8000/docs`.

### 4. Start the frontend

```bash
cd Frontend
npm ci
npm run dev
```

Open `http://localhost:3001`. Requests to `/api` are proxied to `http://localhost:4000` unless `VITE_DEV_PROXY_TARGET` is set.

## Useful commands

| Directory | Command | Description |
| --- | --- | --- |
| `Frontend` | `npm run dev` | Start the Vite development server |
| `Frontend` | `npm run build` | Create a production build in `Frontend/dist` |
| `Frontend` | `npm run lint` | Run ESLint |
| `Frontend` | `npm run preview` | Preview the production build |
| `Backend` | `npm run dev` | Start the main API with Nodemon |
| `Backend` | `npm start` | Start the main API with Node.js |
| `Backend` | `npm run test:admin-api` | Run the admin API integration script |
| `Backend` | `npm run migrate:template-files` | Apply the template-files migration |
| `Backend` | `npm run migrate:document-ai` | Apply the Document AI extraction migration |
| `Backend` | `npm run migrate:jurinex-voice` | Apply idempotent Jurinex Voice migrations |
| `judgement-service` | `npm run dev` | Start the service with Nodemon |
| `judgement-service` | `npm start` | Start the service with Node.js |
| `Template Analyzer Agent` | `uvicorn src.app:app --reload` | Start FastAPI in development mode |

The backend package's default `npm test` is a placeholder and intentionally exits with an error. Use the specific admin API script when its required services and test data are available.

## API entry points

| Service | Entry point | Authentication |
| --- | --- | --- |
| Main API | `/api/*` | JWT and role checks, except explicitly public routes |
| Main API health | `/api/admin/health` | Public health route |
| Main API judgment proxy | `/api/judgements-admin/*` | Super-admin JWT |
| Judgment service administration | `/api/judgements/*` | Super-admin JWT or trusted internal key |
| Judgment search API | `/api/judment-api/*` | `x-api-key` or bearer API key |
| Template Analyzer | `/analysis/*` | Shared JWT with role/ownership checks |
| Jurinex Voice administration | `/api/admin/jurinex-voice/*` | Admin authentication middleware |

## Deployment

- The frontend includes Netlify build configuration and SPA redirects.
- The main API and Template Analyzer Agent include Cloud Run Dockerfiles.
- See [DEPLOYMENT.md](DEPLOYMENT.md) for Google Cloud setup, container builds, and Cloud Run deployment.
- Set production frontend API URLs at build time because Vite embeds `VITE_*` values into the bundle.
- Store production secrets in the deployment platform's secret manager, not in images or source control.

## Additional documentation

- [Frontend notes](Frontend/README.md)
- [Backend API documentation](Backend/documentation.md)
- [Template Analyzer overview](Template%20Analyzer%20Agent/README.md)
- [Template Analyzer API reference](Template%20Analyzer%20Agent/API_DOCUMENTATION.md)
- [Judgment storage and data flow](judgement-service/database_storing.md)
- [Judgment search API](judgement-service/judment_api/README.md)
- [Jurinex Voice module](Backend/modules/jurinex-voice/README.md)
- [Jurinex Voice data model](docs/JURINEX_VOICE_DATA_MODEL.md)
- [Jurinex Voice GCS setup](docs/JURINEX_VOICE_GCS_SETUP.md)
- [Plan limits integration](docs/PLAN_LIMITS_INTEGRATION.md)
