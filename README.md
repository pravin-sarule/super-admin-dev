# NexIntel Super Admin Platform

Internal administration platform for managing NexIntel users, plans, prompts, legal content, support operations, AI document workflows, judgments, citations, and voice agents.

The repository contains four applications that are developed and deployed independently:

| Application | Technology | Default local URL | Purpose |
| --- | --- | --- | --- |
| `Frontend` | React 19, Vite 7, Tailwind CSS 4 | `http://localhost:3001` | Role-based administration dashboard |
| `Backend` | Node.js 20, Express 5 | `http://localhost:4000` | Main API, authentication, administration modules, and upstream service proxying |
| `judgement-service` | Node.js, Express 5 | `http://localhost:8095` | Judgment ingestion, OCR, metadata extraction, vector indexing, and search |
| `Template Analyzer Agent` | Python 3.11, FastAPI | `http://localhost:8000` | Legal-template analysis, field extraction, and prompt generation |

## Contents

- [Main capabilities](#main-capabilities)
- [System architecture](#system-architecture)
- [Role-based access control](#role-based-access-control-rbac)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Local development](#local-development)
- [API entry points](#api-entry-points)
- [Deployment](#deployment)

## Main capabilities

- Role-based access for super, user, account, marketing, and support administrators
- User, administrator, role, subscription, add-on, and plan analytics management
- LLM, system prompt, agent prompt, preset prompt, and chatbot configuration
- Legal template, court, judge, case-type, and document management
- Support ticket workspace and demo-booking management
- Judgment upload, pipeline monitoring, metadata review, semantic/full-text search, and citation analytics
- Jurinex Voice agent configuration, knowledge bases, call history, scheduling, calendar tools, and diagnostics

## System architecture

The browser talks to two application APIs. Most administration modules go through the main Express API; template analysis calls the FastAPI service directly.

```text
                       +-----------------------------+
                       | React Admin Dashboard       |
                       | Frontend (:3001)            |
                       +--------------+--------------+
                                      |
                         +------------+------------+
                         |                         |
                       /api                    /analysis
                         |                         |
                +--------v---------+      +--------v-----------+
                | Main Backend     |      | Template Analyzer  |
                | Express (:4000)  |      | FastAPI (:8000)    |
                | Auth + admin APIs|      | Template analysis  |
                +----+---------+---+      +----------+---------+
                     |         |                     |
                     |         | judgment proxy      |
                     v         v                     v
            +-----------+  +----------------+  +----------------+
            | App DBs   |  | Judgment      |  | Draft/Auth DB  |
            | GCS + AI  |  | service :8095 |  | LLM + Doc AI   |
            +-----------+  +-------+--------+  +----------------+
                                     |
                         +-----------+-----------+
                         |           |           |
                         v           v           v
                    PostgreSQL    Qdrant   Elasticsearch
                    source data   semantic    full-text
```

On `localhost`, Vite forwards `/api` requests to the main API. Judgment requests enter through `/api/judgements-admin` and are forwarded to `judgement-service` at `/api/judgements`. Template analysis uses the analyzer `/analysis` routes.

### Authenticated admin request

```text
+---------+    +-------+    +-------------+    +-----------------+
| Browser | -> | Login | -> | JWT created | -> | Protected route |
+---------+    +-------+    +-------------+    +--------+--------+
                                                        |
                                                        v
+----------------+    +----------------+    +------------+------+
| DB or service  | <- | Backend auth   | <- | Dashboard module |
| dependency     |    | and role check |    | API request      |
+----------------+    +----------------+    +-------------------+
```

The frontend blocks routes that are not available to the current administrator role. The backend then performs the authoritative JWT and role check before reading or changing data.

### Judgment processing pipeline

```text
+------------+    +--------------+    +-------------+    +------------+
| PDF upload | -> | GCS original | -> | Split pages | -> | Text / OCR |
+------------+    +--------------+    +-------------+    +------+-----+
                                                               |
                                                               v
+-------------------+    +------------------+    +----------------+
| PostgreSQL record | <- | Extract metadata | <- | Merge page text|
+---------+---------+    +------------------+    +----------------+
          |
          v
+--------------------+
| Chunk and embed    |
+---------+----------+
          |
    +-----+------------------+
    |                        |
    v                        v
+---------+            +---------------+
| Qdrant  |            | Elasticsearch |
| semantic|            | full-text     |
+----+----+            +-------+-------+
     |                         |
     +------------+------------+
                  |
                  v
          +-----------------+
          | Admin search UI |
          +-----------------+
```

PostgreSQL is the source of truth. Google Cloud Storage holds original and generated artifacts, Qdrant supports semantic search, and Elasticsearch supports full-text search.

## Role-based access control (RBAC)

The dashboard defines five administrator roles. Access is enforced at three independent layers, so a role only ever *sees* — and can only ever *reach* — the areas it is entitled to.

### Administrator roles

| Role | Modules it can access | Login landing |
| --- | --- | --- |
| `super-admin` | Every module | `/dashboard` |
| `user-admin` | Dashboard, User Management (incl. per-user and per-firm analytics), Content Management (case type, court, judge), Settings | `/dashboard` |
| `account-admin` | Dashboard, Subscription Management (incl. plan analytics), Settings | `/dashboard` |
| `marketing-admin` | AI Chatbot, Demo Bookings, Settings | `/dashboard/demo-bookings` |
| `support-admin` | Support & Help workspace, Settings | `/dashboard/support` |

Admin, Role, Prompt, System-Prompt, Agent-Prompt, Template, Citation, LLM, and Voice management, plus Judgment upload and search, are **super-admin only**. Settings is available to every authenticated role. A `super-admin` (and the legacy generic `admin`) passes every check.

### Enforcement layers

Hiding a menu item is only cosmetic; the route guard and the API are what actually restrict access. All three layers are kept in sync — when a module is added, its role list must be set in each.

| Layer | Location | Responsibility |
| --- | --- | --- |
| Menu visibility | `Frontend/src/pages/dashboard/Sidebar.jsx` (`allMenuItems[].roles`) | Show only the links a role is allowed to use |
| Route guard | `Frontend/src/App.jsx` (`RequireRole` + `ROLE_HOME`) | Redirect a role away from a page it cannot use, even when the URL is typed directly |
| API authorization | `Backend/middleware/authMiddleware.js` (`protect` + `authorize([...])`) | The authoritative check — verify the JWT, load the admin, and confirm the role before reading or writing data |

`protect` verifies the JWT and attaches the admin (id, email, normalized role, blocked flag); `authorize(['super-admin', ...])` then rejects any role outside its allow-list with `403`. When a role opens a page it may not use, the route guard redirects it to that role's home defined in `ROLE_HOME` (user-admin → User Management, account-admin → Subscription Management, marketing-admin → Demo Bookings, support-admin → Support).

### Support workspace RBAC

Inside the Support & Help workspace a second, finer-grained model governs ticket access. Support accounts form a three-level hierarchy:

| Hierarchy role | Meaning |
| --- | --- |
| `super_admin` | Sees the entire workspace |
| `support_admin` | Team manager — creates support users, owns a queue, and distributes tickets |
| `support_user` | Agent — works only the tickets allowed by their queue permissions |

Each support user is granted queue permissions that decide which ticket **scopes** (queue tabs) they can open:

| Permission | Scope it unlocks |
| --- | --- |
| `can_view_assigned_to_me` | **Assigned To Me** — tickets whose assignee is the current user |
| `can_view_all_tickets` | **All Tickets** — the manager's full queue |
| `can_view_team_tickets` | **My Team** — tickets assigned to teammates |
| `can_view_unassigned_tickets` | **Unassigned** — tickets waiting for assignment |
| `can_view_closed_tickets` | **Closed** — finished tickets |

Tickets link to an owner through `assigned_to_admin_id`. Being able to *see* a ticket (via team or full-queue permission) is separate from it being *assigned* to you: **Assigned To Me** counts only tickets whose owner is the logged-in user. Managers hand tickets to support users from the **Assignment Center** (`/api/support-admin/tickets/bulk-assign`) or from an individual ticket. These rules are enforced in `Backend/middleware/support/workspace.middleware.js` and `Backend/controllers/support/workspace.controller.js`.

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

### Recommended startup order

```text
                 +--------------------------------+
                 | Databases, cloud, and search   |
                 | dependencies are available     |
                 +---------------+----------------+
                                 |
                   +-------------+-------------+
                   |                           |
                   v                           v
       +------------------------+   +------------------------+
       | 1. Judgment service    |   | 3. Template Analyzer   |
       | localhost:8095         |   | localhost:8000         |
       +-----------+------------+   +-----------+------------+
                   |                            |
                   v                            |
       +------------------------+               |
       | 2. Main Backend        |               |
       | localhost:4000         |               |
       +-----------+------------+               |
                   |                            |
                   +-------------+--------------+
                                 |
                                 v
                     +------------------------+
                     | 4. React Frontend      |
                     | localhost:3001         |
                     +------------------------+
```

The frontend can open after the main API starts, but the judgment and template-analysis screens require their corresponding services and external dependencies.

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
