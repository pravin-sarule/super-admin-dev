# Jurinex Voice — GCS bucket setup

The Jurinex Voice admin module stores **original uploaded knowledge files**
in Google Cloud Storage. Extracted text, chunks, embeddings, and metadata
live in PostgreSQL (`Calling_agent_DB`).

## Bucket name

```
jurinex-voice-docs
```

> Override with `GCS_VOICE_BUCKET` (or `JURINEX_VOICE_GCS_BUCKET`).

## Create the bucket

```bash
# Recommended: gcloud
gcloud storage buckets create gs://jurinex-voice-docs \
  --location=asia-south1 \
  --uniform-bucket-level-access

# Legacy: gsutil
gsutil mb -l asia-south1 gs://jurinex-voice-docs
```

## Required object permissions

The service account used by the admin backend (or Cloud Run service) must
hold the following object-level permissions on the bucket:

- `storage.objects.create`
- `storage.objects.get`
- `storage.objects.delete`
- `storage.objects.list`

## Granting `roles/storage.objectAdmin` (recommended)

```bash
SA="<your-service-account>@<project>.iam.gserviceaccount.com"

gcloud storage buckets add-iam-policy-binding gs://jurinex-voice-docs \
  --member="serviceAccount:${SA}" \
  --role="roles/storage.objectAdmin"
```

## Object naming convention

Uploads are written as:

```
gs://jurinex-voice-docs/voice-agents/{agent_id}/documents/{document_id}/{safe_filename}
```

If `agent_id` is null (global document):

```
gs://jurinex-voice-docs/voice-agents/global/documents/{document_id}/{safe_filename}
```

The filename is sanitized (NFKD + replace non-`[a-zA-Z0-9._-]` with `_`).

## Credential resolution order

The module uses, in order:

1. `GCS_KEY_BASE64` — base64-encoded service-account JSON (matches the
   existing project convention in `middleware/upload.js`).
2. `GOOGLE_APPLICATION_CREDENTIALS` — file path to a JSON key.
3. ADC — falls back automatically on Cloud Run / GCE.

`GCP_PROJECT_ID` (or `GCS_PROJECT_ID`) is read for the project hint.
