

// const docDB = require('../config/docDB');
// const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
// const fs = require('fs');
// const path = require('path');
// const os = require('os');

// let secretClient;

// // Setup GCP client from base64 key
// function setupGCPClientFromBase64() {
//   try {
//     const base64Key = process.env.GCS_KEY_BASE64;
//     if (!base64Key) throw new Error('GCS_KEY_BASE64 is not set');

//     const cleanedBase64 = base64Key.replace(/^["']|["']$/g, '').trim().replace(/\s/g, '');
//     const keyJson = Buffer.from(cleanedBase64, 'base64').toString('utf8');
//     const keyObject = JSON.parse(keyJson);

//     if (!keyObject.private_key || !keyObject.client_email || !keyObject.project_id) {
//       throw new Error('Invalid GCP key structure');
//     }

//     const tempFilePath = path.join(os.tmpdir(), 'gcp-key.json');
//     fs.writeFileSync(tempFilePath, JSON.stringify(keyObject, null, 2), 'utf8');
//     process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFilePath;

//     secretClient = new SecretManagerServiceClient();
//   } catch (error) {
//     console.error('Error setting up GCP client:', error.message);
//     throw error;
//   }
// }

// if (!secretClient) setupGCPClientFromBase64();
// const GCLOUD_PROJECT_ID = process.env.GCS_PROJECT_ID;
// if (!GCLOUD_PROJECT_ID) throw new Error('GCS_PROJECT_ID not set');

// // ---------------------
// // Fetch all secrets (optionally with values and LLM name)
// // ---------------------
// const getAllSecrets = async (req, res) => {
//   const includeValues = req.query.fetch === 'true';

//   try {
//     const result = await docDB.query(`
//       SELECT s.*, l.name AS llm_name 
//       FROM secret_manager s
//       LEFT JOIN llm_models l ON s.llm_id = l.id
//       ORDER BY s.created_at DESC
//     `);
//     const rows = result.rows;

//     if (!includeValues) return res.status(200).json(rows);

//     const enriched = await Promise.all(
//       rows.map(async (row) => {
//         try {
//           const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${row.secret_manager_id}/versions/${row.version}`;
//           const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
//           const value = accessResponse.payload.data.toString('utf8');
//           return { ...row, value };
//         } catch (err) {
//           return { ...row, value: '[ERROR: Cannot fetch]' };
//         }
//       })
//     );

//     res.status(200).json(enriched);
//   } catch (err) {
//     console.error('Error fetching secrets:', err.message);
//     res.status(500).json({ error: 'Failed to fetch secrets: ' + err.message });
//   }
// };

// // ---------------------
// // Create secret in GCP and docDB with llm_id
// // ---------------------
// const createSecret = async (req, res) => {
//   const {
//     name,
//     description,
//     secret_manager_id,
//     secret_value,
//     llm_id,             // NEW: LLM ID
//     version = '1',
//     created_by = 1,
//     template_type = 'system',
//     status = 'active',
//     usage_count = 0,
//     success_rate = 0,
//     avg_processing_time = 0,
//     template_metadata = {},
//   } = req.body;

//   if (!llm_id) return res.status(400).json({ message: 'llm_id is required' });

//   try {
//     const parent = `projects/${GCLOUD_PROJECT_ID}`;
//     const secretName = `${parent}/secrets/${secret_manager_id}`;

//     // Check if secret exists
//     let exists = false;
//     try { await secretClient.getSecret({ name: secretName }); exists = true; } 
//     catch (err) { if (err.code !== 5) throw err; }

//     if (!exists) {
//       await secretClient.createSecret({
//         parent,
//         secretId: secret_manager_id,
//         secret: { replication: { automatic: {} } },
//       });
//     }

//     // Add secret version
//     const [versionResponse] = await secretClient.addSecretVersion({
//       parent: secretName,
//       payload: { data: Buffer.from(secret_value, 'utf8') },
//     });
//     const versionId = versionResponse.name.split('/').pop();

//     // Insert metadata into docDB
//     const result = await docDB.query(`
//       INSERT INTO secret_manager (
//         id, name, description, template_type, status,
//         usage_count, success_rate, avg_processing_time,
//         created_by, updated_by, created_at, updated_at,
//         activated_at, last_used_at, template_metadata,
//         secret_manager_id, version, llm_id
//       ) VALUES (
//         gen_random_uuid(), $1, $2, $3, $4,
//         $5, $6, $7,
//         $8, $8, now(), now(),
//         now(), NULL, $9::jsonb,
//         $10, $11, $12
//       ) RETURNING *;
//     `, [
//       name, description, template_type, status,
//       usage_count, success_rate, avg_processing_time,
//       created_by, JSON.stringify(template_metadata),
//       secret_manager_id, versionId, llm_id
//     ]);

//     res.status(201).json({
//       message: 'Secret created successfully in GCP and docDB',
//       dbRecord: result.rows[0],
//       gcpVersion: versionId
//     });
//   } catch (err) {
//     console.error('Error creating secret:', err.message);
//     res.status(500).json({ error: 'Failed to create secret: ' + err.message });
//   }
// };

// // ---------------------
// // Fetch secret value by ID
// // ---------------------
// const fetchSecretValueById = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const result = await docDB.query(
//       'SELECT secret_manager_id, version, llm_id FROM secret_manager WHERE id = $1',
//       [id]
//     );
//     if (result.rows.length === 0) return res.status(404).json({ error: 'Secret not found' });

//     const { secret_manager_id, version, llm_id } = result.rows[0];
//     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//     const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
//     const value = accessResponse.payload.data.toString('utf8');

//     // Fetch LLM name
//     const llmResult = await docDB.query('SELECT name FROM llm_models WHERE id = $1', [llm_id]);
//     const llmName = llmResult.rows[0]?.name || null;

//     res.status(200).json({ secret_manager_id, version, value, llm_id, llmName });
//   } catch (err) {
//     console.error('Error fetching secret value:', err.message);
//     res.status(500).json({ error: 'Failed to fetch secret: ' + err.message });
//   }
// };

// module.exports = {
//   getAllSecrets,
//   createSecret,
//   fetchSecretValueById
// };



// const docDB = require('../config/docDB');
// const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
// const fs = require('fs');
// const path = require('path');
// const os = require('os');

// let secretClient;

// // ---------------------
// // Setup GCP client from base64 key
// // ---------------------
// function setupGCPClientFromBase64() {
//   try {
//     const base64Key = process.env.GCS_KEY_BASE64;
//     if (!base64Key) throw new Error('GCS_KEY_BASE64 is not set');

//     const cleanedBase64 = base64Key.replace(/^["']|["']$/g, '').trim().replace(/\s/g, '');
//     const keyJson = Buffer.from(cleanedBase64, 'base64').toString('utf8');
//     const keyObject = JSON.parse(keyJson);

//     if (!keyObject.private_key || !keyObject.client_email || !keyObject.project_id) {
//       throw new Error('Invalid GCP key structure');
//     }

//     const tempFilePath = path.join(os.tmpdir(), 'gcp-key.json');
//     fs.writeFileSync(tempFilePath, JSON.stringify(keyObject, null, 2), 'utf8');
//     process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFilePath;

//     secretClient = new SecretManagerServiceClient();
//   } catch (error) {
//     console.error('Error setting up GCP client:', error.message);
//     throw error;
//   }
// }

// if (!secretClient) setupGCPClientFromBase64();
// const GCLOUD_PROJECT_ID = process.env.GCS_PROJECT_ID;
// if (!GCLOUD_PROJECT_ID) throw new Error('GCS_PROJECT_ID not set');

// // ---------------------
// // Get all secrets
// // ---------------------
// const getAllSecrets = async (req, res) => {
//   const includeValues = req.query.fetch === 'true';

//   try {
//     const result = await docDB.query(`
//       SELECT s.*, l.name AS llm_name, c.method_name AS chunking_method_name
//       FROM secret_manager s
//       LEFT JOIN llm_models l ON s.llm_id = l.id
//       LEFT JOIN chunking_methods c ON s.chunking_method_id = c.id
//       ORDER BY s.created_at DESC
//     `);
//     const rows = result.rows;

//     if (!includeValues) return res.status(200).json(rows);

//     const enriched = await Promise.all(
//       rows.map(async (row) => {
//         try {
//           const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${row.secret_manager_id}/versions/${row.version}`;
//           const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
//           const value = accessResponse.payload.data.toString('utf8');
//           return { ...row, value };
//         } catch (err) {
//           return { ...row, value: '[ERROR: Cannot fetch]' };
//         }
//       })
//     );

//     res.status(200).json(enriched);
//   } catch (err) {
//     console.error('Error fetching secrets:', err.message);
//     res.status(500).json({ error: 'Failed to fetch secrets: ' + err.message });
//   }
// };

// // ---------------------
// // Create secret
// // ---------------------
// const createSecret = async (req, res) => {
//   const {
//     name,
//     description,
//     secret_manager_id,
//     secret_value,
//     llm_id,
//     chunking_method_id, // NEW: Chunking Method ID
//     version = '1',
//     created_by = 1,
//     template_type = 'system',
//     status = 'active',
//     usage_count = 0,
//     success_rate = 0,
//     avg_processing_time = 0,
//     template_metadata = {},
//   } = req.body;

//   if (!llm_id) return res.status(400).json({ message: 'llm_id is required' });
//   if (!chunking_method_id) return res.status(400).json({ message: 'chunking_method_id is required' });

//   try {
//     const parent = `projects/${GCLOUD_PROJECT_ID}`;
//     const secretName = `${parent}/secrets/${secret_manager_id}`;

//     let exists = false;
//     try { await secretClient.getSecret({ name: secretName }); exists = true; } 
//     catch (err) { if (err.code !== 5) throw err; }

//     if (!exists) {
//       await secretClient.createSecret({
//         parent,
//         secretId: secret_manager_id,
//         secret: { replication: { automatic: {} } },
//       });
//     }

//     const [versionResponse] = await secretClient.addSecretVersion({
//       parent: secretName,
//       payload: { data: Buffer.from(secret_value, 'utf8') },
//     });
//     const versionId = versionResponse.name.split('/').pop();

//     const result = await docDB.query(`
//       INSERT INTO secret_manager (
//         id, name, description, template_type, status,
//         usage_count, success_rate, avg_processing_time,
//         created_by, updated_by, created_at, updated_at,
//         activated_at, last_used_at, template_metadata,
//         secret_manager_id, version, llm_id, chunking_method_id
//       ) VALUES (
//         gen_random_uuid(), $1, $2, $3, $4,
//         $5, $6, $7,
//         $8, $8, now(), now(),
//         now(), NULL, $9::jsonb,
//         $10, $11, $12, $13
//       ) RETURNING *;
//     `, [
//       name, description, template_type, status,
//       usage_count, success_rate, avg_processing_time,
//       created_by, JSON.stringify(template_metadata),
//       secret_manager_id, versionId, llm_id, chunking_method_id
//     ]);

//     res.status(201).json({
//       message: 'Secret created successfully in GCP and docDB',
//       dbRecord: result.rows[0],
//       gcpVersion: versionId
//     });
//   } catch (err) {
//     console.error('Error creating secret:', err.message);
//     res.status(500).json({ error: 'Failed to create secret: ' + err.message });
//   }
// };

// // ---------------------
// // Fetch secret by ID
// // ---------------------
// const fetchSecretValueById = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const result = await docDB.query(
//       'SELECT secret_manager_id, version, llm_id, chunking_method_id FROM secret_manager WHERE id = $1',
//       [id]
//     );
//     if (result.rows.length === 0) return res.status(404).json({ error: 'Secret not found' });

//     const { secret_manager_id, version, llm_id, chunking_method_id } = result.rows[0];
//     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//     const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
//     const value = accessResponse.payload.data.toString('utf8');

//     const llmResult = await docDB.query('SELECT name FROM llm_models WHERE id = $1', [llm_id]);
//     const llmName = llmResult.rows[0]?.name || null;

//     const chunkingMethodResult = await docDB.query('SELECT method_name FROM chunking_methods WHERE id = $1', [chunking_method_id]);
//     const chunkingMethodName = chunkingMethodResult.rows[0]?.name || null;

//     res.status(200).json({ secret_manager_id, version, value, llm_id, llmName, chunking_method_id, chunkingMethodName });
//   } catch (err) {
//     console.error('Error fetching secret value:', err.message);
//     res.status(500).json({ error: 'Failed to fetch secret: ' + err.message });
//   }
// };

// // ---------------------
// // Update secret (value and metadata)
// // ---------------------
// // const updateSecret = async (req, res) => {
// //   const { id } = req.params;
// //   const {
// //     name,
// //     description,
// //     status,
// //     template_metadata,
// //     secret_value,
// //     updated_by = 1
// //   } = req.body;

// //   try {
// //     const result = await docDB.query('SELECT * FROM secret_manager WHERE id = $1', [id]);
// //     if (result.rows.length === 0) return res.status(404).json({ error: 'Secret not found' });
// //     const secret = result.rows[0];

// //     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret.secret_manager_id}`;

// //     let versionId = secret.version;
// //     if (secret_value) {
// //       const [versionResponse] = await secretClient.addSecretVersion({
// //         parent: secretName,
// //         payload: { data: Buffer.from(secret_value, 'utf8') },
// //       });
// //       versionId = versionResponse.name.split('/').pop();
// //     }

// //     const updateQuery = `
// //       UPDATE secret_manager 
// //       SET 
// //         name = COALESCE($1, name),
// //         description = COALESCE($2, description),
// //         status = COALESCE($3, status),
// //         template_metadata = COALESCE($4::jsonb, template_metadata),
// //         version = $5,
// //         updated_by = $6,
// //         updated_at = now()
// //       WHERE id = $7
// //       RETURNING *;
// //     `;
// //     const updated = await docDB.query(updateQuery, [
// //       name, description, status, template_metadata ? JSON.stringify(template_metadata) : null,
// //       versionId, updated_by, id
// //     ]);

// //     res.status(200).json({
// //       message: 'Secret updated successfully',
// //       updatedRecord: updated.rows[0]
// //     });
// //   } catch (err) {
// //     console.error('Error updating secret:', err.message);
// //     res.status(500).json({ error: 'Failed to update secret: ' + err.message });
// //   }
// // };
// const updateSecret = async (req, res) => {
//   const { id } = req.params;
//   const {
//     name,
//     description,
//     status,
//     template_metadata,
//     secret_value,
//     llm_id,
//     chunking_method_id, // ✅ include chunking_method_id from request body
//     updated_by = 1
//   } = req.body;

//   try {
//     const result = await docDB.query('SELECT * FROM secret_manager WHERE id = $1', [id]);
//     if (result.rows.length === 0)
//       return res.status(404).json({ error: 'Secret not found' });

//     const secret = result.rows[0];
//     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret.secret_manager_id}`;

//     let versionId = secret.version;
//     if (secret_value) {
//       const [versionResponse] = await secretClient.addSecretVersion({
//         parent: secretName,
//         payload: { data: Buffer.from(secret_value, 'utf8') },
//       });
//       versionId = versionResponse.name.split('/').pop();
//     }

//     const updateQuery = `
//       UPDATE secret_manager
//       SET
//         name = COALESCE($1, name),
//         description = COALESCE($2, description),
//         status = COALESCE($3, status),
//         template_metadata = COALESCE($4::jsonb, template_metadata),
//         version = $5,
//         llm_id = COALESCE($6, llm_id),
//         chunking_method_id = COALESCE($7, chunking_method_id),
//         updated_by = $8,
//         updated_at = now()
//       WHERE id = $9
//       RETURNING *;
//     `;

//     const updated = await docDB.query(updateQuery, [
//       name,
//       description,
//       status,
//       template_metadata ? JSON.stringify(template_metadata) : null,
//       versionId,
//       llm_id || null,
//       chunking_method_id || null,
//       updated_by,
//       id
//     ]);

//     res.status(200).json({
//       message: 'Secret updated successfully',
//       updatedRecord: updated.rows[0]
//     });
//   } catch (err) {
//     console.error('Error updating secret:', err.message);
//     res.status(500).json({ error: 'Failed to update secret: ' + err.message });
//   }
// };

// // ---------------------
// // Delete secret (from GCP + docDB)
// // ---------------------
// const deleteSecret = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const result = await docDB.query('SELECT * FROM secret_manager WHERE id = $1', [id]);
//     if (result.rows.length === 0) return res.status(404).json({ error: 'Secret not found' });

//     const { secret_manager_id } = result.rows[0];
//     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}`;

//     try {
//       await secretClient.deleteSecret({ name: secretName });
//     } catch (err) {
//       if (err.code !== 5) console.warn('Warning: Failed to delete from GCP:', err.message);
//     }

//     await docDB.query('DELETE FROM secret_manager WHERE id = $1', [id]);

//     res.status(200).json({ message: 'Secret deleted successfully from GCP and docDB' });
//   } catch (err) {
//     console.error('Error deleting secret:', err.message);
//     res.status(500).json({ error: 'Failed to delete secret: ' + err.message });
//   }
// };

// // ---------------------
// module.exports = {
//   getAllSecrets,
//   createSecret,
//   fetchSecretValueById,
//   updateSecret,
//   deleteSecret
// };







// const docDB = require('../config/docDB');
// const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
// const fs = require('fs');
// const path = require('path');
// const os = require('os');

// let secretClient;

// // Setup GCP client from base64 key
// function setupGCPClientFromBase64() {
//   try {
//     const base64Key = process.env.GCS_KEY_BASE64;
//     if (!base64Key) throw new Error('GCS_KEY_BASE64 is not set');

//     const cleanedBase64 = base64Key.replace(/^["']|["']$/g, '').trim().replace(/\s/g, '');
//     const keyJson = Buffer.from(cleanedBase64, 'base64').toString('utf8');
//     const keyObject = JSON.parse(keyJson);

//     if (!keyObject.private_key || !keyObject.client_email || !keyObject.project_id) {
//       throw new Error('Invalid GCP key structure');
//     }

//     const tempFilePath = path.join(os.tmpdir(), 'gcp-key.json');
//     fs.writeFileSync(tempFilePath, JSON.stringify(keyObject, null, 2), 'utf8');
//     process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFilePath;

//     secretClient = new SecretManagerServiceClient();
//   } catch (error) {
//     console.error('Error setting up GCP client:', error.message);
//     throw error;
//   }
// }

// if (!secretClient) setupGCPClientFromBase64();
// const GCLOUD_PROJECT_ID = process.env.GCS_PROJECT_ID;
// if (!GCLOUD_PROJECT_ID) throw new Error('GCS_PROJECT_ID not set');

// // ---------------------
// // Fetch all secrets (optionally with values and LLM name)
// // ---------------------
// const getAllSecrets = async (req, res) => {
//   const includeValues = req.query.fetch === 'true';

//   try {
//     const result = await docDB.query(`
//       SELECT s.*, l.name AS llm_name 
//       FROM secret_manager s
//       LEFT JOIN llm_models l ON s.llm_id = l.id
//       ORDER BY s.created_at DESC
//     `);
//     const rows = result.rows;

//     if (!includeValues) return res.status(200).json(rows);

//     const enriched = await Promise.all(
//       rows.map(async (row) => {
//         try {
//           const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${row.secret_manager_id}/versions/${row.version}`;
//           const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
//           const value = accessResponse.payload.data.toString('utf8');
//           return { ...row, value };
//         } catch (err) {
//           return { ...row, value: '[ERROR: Cannot fetch]' };
//         }
//       })
//     );

//     res.status(200).json(enriched);
//   } catch (err) {
//     console.error('Error fetching secrets:', err.message);
//     res.status(500).json({ error: 'Failed to fetch secrets: ' + err.message });
//   }
// };

// // ---------------------
// // Create secret in GCP and docDB with llm_id
// // ---------------------
// const createSecret = async (req, res) => {
//   const {
//     name,
//     description,
//     secret_manager_id,
//     secret_value,
//     llm_id,             // NEW: LLM ID
//     version = '1',
//     created_by = 1,
//     template_type = 'system',
//     status = 'active',
//     usage_count = 0,
//     success_rate = 0,
//     avg_processing_time = 0,
//     template_metadata = {},
//   } = req.body;

//   if (!llm_id) return res.status(400).json({ message: 'llm_id is required' });

//   try {
//     const parent = `projects/${GCLOUD_PROJECT_ID}`;
//     const secretName = `${parent}/secrets/${secret_manager_id}`;

//     // Check if secret exists
//     let exists = false;
//     try { await secretClient.getSecret({ name: secretName }); exists = true; } 
//     catch (err) { if (err.code !== 5) throw err; }

//     if (!exists) {
//       await secretClient.createSecret({
//         parent,
//         secretId: secret_manager_id,
//         secret: { replication: { automatic: {} } },
//       });
//     }

//     // Add secret version
//     const [versionResponse] = await secretClient.addSecretVersion({
//       parent: secretName,
//       payload: { data: Buffer.from(secret_value, 'utf8') },
//     });
//     const versionId = versionResponse.name.split('/').pop();

//     // Insert metadata into docDB
//     const result = await docDB.query(`
//       INSERT INTO secret_manager (
//         id, name, description, template_type, status,
//         usage_count, success_rate, avg_processing_time,
//         created_by, updated_by, created_at, updated_at,
//         activated_at, last_used_at, template_metadata,
//         secret_manager_id, version, llm_id
//       ) VALUES (
//         gen_random_uuid(), $1, $2, $3, $4,
//         $5, $6, $7,
//         $8, $8, now(), now(),
//         now(), NULL, $9::jsonb,
//         $10, $11, $12
//       ) RETURNING *;
//     `, [
//       name, description, template_type, status,
//       usage_count, success_rate, avg_processing_time,
//       created_by, JSON.stringify(template_metadata),
//       secret_manager_id, versionId, llm_id
//     ]);

//     res.status(201).json({
//       message: 'Secret created successfully in GCP and docDB',
//       dbRecord: result.rows[0],
//       gcpVersion: versionId
//     });
//   } catch (err) {
//     console.error('Error creating secret:', err.message);
//     res.status(500).json({ error: 'Failed to create secret: ' + err.message });
//   }
// };

// // ---------------------
// // Fetch secret value by ID
// // ---------------------
// const fetchSecretValueById = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const result = await docDB.query(
//       'SELECT secret_manager_id, version, llm_id FROM secret_manager WHERE id = $1',
//       [id]
//     );
//     if (result.rows.length === 0) return res.status(404).json({ error: 'Secret not found' });

//     const { secret_manager_id, version, llm_id } = result.rows[0];
//     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
//     const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
//     const value = accessResponse.payload.data.toString('utf8');

//     // Fetch LLM name
//     const llmResult = await docDB.query('SELECT name FROM llm_models WHERE id = $1', [llm_id]);
//     const llmName = llmResult.rows[0]?.name || null;

//     res.status(200).json({ secret_manager_id, version, value, llm_id, llmName });
//   } catch (err) {
//     console.error('Error fetching secret value:', err.message);
//     res.status(500).json({ error: 'Failed to fetch secret: ' + err.message });
//   }
// };

// module.exports = {
//   getAllSecrets,
//   createSecret,
//   fetchSecretValueById
// };



const docDB = require('../config/docDB');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const { bucket, bucketName } = require('../config/gcs');
const { extractTextFromPDF } = require('../services/documentAIService');
const { mapToLegalSummarySchema } = require('../services/schemaMapperService');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

let secretClient;

// ---------------------
// Setup GCP client from base64 key
// ---------------------
function setupGCPClientFromBase64() {
  try {
    const base64Key = process.env.GCS_KEY_BASE64;
    if (!base64Key) throw new Error('GCS_KEY_BASE64 is not set');

    const cleanedBase64 = base64Key.replace(/^["']|["']$/g, '').trim().replace(/\s/g, '');
    const keyJson = Buffer.from(cleanedBase64, 'base64').toString('utf8');
    const keyObject = JSON.parse(keyJson);

    if (!keyObject.private_key || !keyObject.client_email || !keyObject.project_id) {
      throw new Error('Invalid GCP key structure');
    }

    const tempFilePath = path.join(os.tmpdir(), 'gcp-key.json');
    fs.writeFileSync(tempFilePath, JSON.stringify(keyObject, null, 2), 'utf8');
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFilePath;

    secretClient = new SecretManagerServiceClient();
  } catch (error) {
    console.error('Error setting up GCP client:', error.message);
    throw error;
  }
}

if (!secretClient) setupGCPClientFromBase64();
const GCLOUD_PROJECT_ID = process.env.GCS_PROJECT_ID;
if (!GCLOUD_PROJECT_ID) throw new Error('GCS_PROJECT_ID not set');

// ---------------------
// Helper Functions for File Upload
// ---------------------

/**
 * Upload file to GCP Storage bucket
 * @param {Buffer} fileBuffer - File buffer
 * @param {String} fileName - Original filename
 * @param {String} folder - Folder path (input/ or output/)
 * @returns {Object} Upload result with bucket path and metadata
 */
const uploadFileToGCS = async (fileBuffer, fileName, folder) => {
  try {
    console.log(`📤 Uploading file to bucket: ${bucketName}, folder: ${folder}`);
    
    // Generate unique filename to avoid conflicts
    const fileExtension = path.extname(fileName);
    const baseName = path.basename(fileName, fileExtension);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueFileName = `${sanitizedBaseName}_${Date.now()}${fileExtension}`;
    const bucketPath = `${folder}${uniqueFileName}`;

    console.log(`📤 Target path: ${bucketPath}`);

    // Check if bucket exists first
    const [exists] = await bucket.exists();
    if (!exists) {
      throw new Error(`Bucket "${bucketName}" does not exist. Please create it in GCP Console.`);
    }

    // Upload file to GCS
    const file = bucket.file(bucketPath);
    await file.save(fileBuffer, {
      metadata: {
        contentType: 'application/pdf',
      },
    });

    console.log(`✅ File uploaded successfully: ${bucketPath}`);

    // Make file publicly readable (or use signed URLs)
    // Note: We're using signed URLs, so this is optional
    await file.makePublic().catch(() => {
      // Ignore if already public or if we're using signed URLs
      console.log(`ℹ️  File is not public (using signed URLs instead)`);
    });

    return {
      bucketPath,
      fileName: uniqueFileName,
      originalFileName: fileName,
      fileSize: fileBuffer.length,
    };
  } catch (error) {
    console.error('❌ Error uploading file to GCS:', error);
    
    // Provide helpful error messages
    if (error.code === 403) {
      const serviceAccount = error.response?.data?.error?.message?.match(/@[\w-]+\.iam\.gserviceaccount\.com/)?.[0] || 'the service account';
      throw new Error(
        `Permission denied: ${serviceAccount} does not have storage.objects.create permission on bucket "${bucketName}". ` +
        `Please grant the "Storage Object Creator" role to the service account in GCP IAM.`
      );
    } else if (error.code === 404) {
      throw new Error(
        `Bucket "${bucketName}" not found. Please verify the bucket name and ensure it exists in GCP Console.`
      );
    }
    
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Generate signed URL for a file in GCS
 * @param {String} bucketPath - Path to file in bucket
 * @param {Number} expiryMinutes - URL expiry time in minutes (default: 60)
 * @returns {Object} Signed URL and expiry timestamp
 */
const generateSignedURL = async (bucketPath, expiryMinutes = 60) => {
  try {
    const file = bucket.file(bucketPath);
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiryMinutes * 60 * 1000,
    });

    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    return {
      signedUrl: url,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

/**
 * Save file metadata to template_files table
 * @param {Object} fileData - File data
 * @param {UUID} secretManagerId - Secret manager ID
 * @param {Number} createdBy - User ID
 * @returns {UUID} Template file ID
 */
const saveFileMetadata = async (fileData, secretManagerId, createdBy) => {
  try {
    const fileId = crypto.randomUUID();
    const { signedUrl, expiresAt } = await generateSignedURL(fileData.bucketPath, 60);

    const result = await docDB.query(`
      INSERT INTO template_files (
        id, filename, original_filename, file_type, mime_type,
        file_extension, bucket_name, bucket_path, bucket_region,
        file_size, signed_url, signed_url_expires_at, signed_url_expiry_minutes,
        secret_manager_id, created_by, uploaded_by, created_at, updated_at, uploaded_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $15, NOW(), NOW(), NOW()
      ) RETURNING id;
    `, [
      fileId,
      fileData.fileName,
      fileData.originalFileName,
      fileData.fileType, // 'input' or 'output'
      'application/pdf',
      path.extname(fileData.fileName).substring(1) || 'pdf',
      bucketName,
      fileData.bucketPath,
      'asia-south1',
      fileData.fileSize,
      signedUrl,
      expiresAt,
      60,
      secretManagerId,
      createdBy,
    ]);

    return result.rows[0].id;
  } catch (error) {
    console.error('Error saving file metadata:', error);
    throw new Error(`Failed to save file metadata: ${error.message}`);
  }
};

/**
/**
 * Sanitize Document AI raw response by removing pixel values and image data
 * @param {Object} rawResponse - Raw Document AI response
 * @returns {Object} Sanitized response without pixel values
 */
const sanitizeRawResponse = (rawResponse) => {
  if (!rawResponse || typeof rawResponse !== 'object') {
    return rawResponse;
  }

  const sanitize = (obj, depth = 0) => {
    // Prevent infinite recursion
    if (depth > 20) {
      return '[Max depth reached]';
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => sanitize(item, depth + 1));
    }

    if (typeof obj !== 'object') {
      // Skip very long strings that might be base64 image data
      if (typeof obj === 'string' && obj.length > 50000) {
        return '[Large data string removed]';
      }
      return obj;
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Skip pixel/image related fields
      if (lowerKey.includes('pixel') || 
          lowerKey.includes('bitmap') ||
          lowerKey.includes('raster') ||
          lowerKey.includes('image') && !lowerKey.includes('imagequalityscores')) {
        sanitized[key] = '[Image/Pixel data removed]';
        continue;
      }

      // Skip base64 encoded image data
      if (typeof value === 'string' && (
          value.startsWith('data:image/') ||
          (value.length > 10000 && /^[A-Za-z0-9+/=]+$/.test(value))
        )) {
        sanitized[key] = '[Base64 image data removed]';
        continue;
      }

      // For Document AI specific structures, remove image data from pages
      if (key === 'pages' && Array.isArray(value)) {
        sanitized[key] = value.map(page => {
          const sanitizedPage = { ...page };
          // Remove image data from page
          delete sanitizedPage.image;
          delete sanitizedPage.transformedText;
          // Keep layout and other useful data
          return sanitize(sanitizedPage, depth + 1);
        });
        continue;
      }

      // Recursively sanitize nested objects
      if (typeof value === 'object') {
        sanitized[key] = sanitize(value, depth + 1);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  };

  return sanitize(rawResponse);
};

/**
 * Save extracted text to document_ai_extractions table
 * @param {UUID} templateFileId - Template file ID
 * @param {String} fileType - 'input' or 'output'
 * @param {Object} extractionResult - Result from Document AI
 * @returns {UUID} Extraction record ID
 */
const saveExtractedText = async (templateFileId, fileType, extractionResult) => {
  try {
    const extractionId = crypto.randomUUID();

    // Map extraction result to structured schema format for LLM
    let structuredSchema = null;
    try {
      // Create document object with text for schema mapping
      const documentObject = {
        document: {
          text: extractionResult.extractedText || extractionResult.rawResponse || ''
        }
      };
      structuredSchema = mapToLegalSummarySchema(documentObject, fileType);
      console.log(`✅ Structured schema generated for ${fileType} file`);
    } catch (schemaError) {
      console.error(`⚠️  Error generating structured schema: ${schemaError.message}`);
      // Continue without structured schema - don't fail the entire extraction
    }

    const result = await docDB.query(`
      INSERT INTO document_ai_extractions (
        id, template_file_id, file_type,
        document_ai_processor_id, document_ai_processor_version,
        document_ai_operation_name, document_ai_request_id,
        extracted_text, extracted_text_hash,
        page_count, total_characters, total_words, total_paragraphs,
        entities, form_fields, tables,
        confidence_score, average_confidence, min_confidence, max_confidence,
        processing_status, processing_duration_ms,
        raw_response, structured_schema, processed_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3,
        $4, $5,
        $6, $7,
        $8, $9,
        $10, $11, $12, $13,
        $14::jsonb, $15::jsonb, $16::jsonb,
        $17, $18, $19, $20,
        $21, $22,
        $23::text, $24::jsonb, NOW(), NOW(), NOW()
      ) RETURNING id;
    `, [
      extractionId,
      templateFileId,
      fileType,
      extractionResult.documentAIProcessorId || null,
      extractionResult.documentAIProcessorVersion || null,
      extractionResult.documentAIOperationName || null,
      extractionResult.documentAIRequestId || null,
      extractionResult.extractedText,
      extractionResult.extractedTextHash,
      extractionResult.pageCount || null,
      extractionResult.totalCharacters || null,
      extractionResult.totalWords || null,
      extractionResult.totalParagraphs || null,
      JSON.stringify(extractionResult.entities || []),
      JSON.stringify(extractionResult.formFields || []),
      JSON.stringify(extractionResult.tables || []),
      extractionResult.confidenceScore || null,
      extractionResult.averageConfidence || null,
      extractionResult.minConfidence || null,
      extractionResult.maxConfidence || null,
      'completed',
      extractionResult.processingDuration || null,
      extractionResult.rawResponse || '', // Store as text string
      structuredSchema ? JSON.stringify(structuredSchema) : null, // Store structured JSON schema
    ]);

    console.log(`✅ Extracted text saved for ${fileType} file: ${extractionId}`);
    return result.rows[0].id;
  } catch (error) {
    console.error('Error saving extracted text:', error);
    // Don't throw - we don't want to fail the entire upload if extraction save fails
    console.warn('⚠️  Continuing without saving extracted text');
    return null;
  }
};

// ---------------------
// Get all secrets
// ---------------------
const getAllSecrets = async (req, res) => {
  const includeValues = req.query.fetch === 'true';

  try {
    const result = await docDB.query(`
      SELECT s.*, l.name AS llm_name, c.method_name AS chunking_method_name
      FROM secret_manager s
      LEFT JOIN llm_models l ON s.llm_id = l.id
      LEFT JOIN chunking_methods c ON s.chunking_method_id = c.id
      ORDER BY s.created_at DESC
    `);
    const rows = result.rows;

    if (!includeValues) return res.status(200).json(rows);

    const enriched = await Promise.all(
      rows.map(async (row) => {
        try {
          const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${row.secret_manager_id}/versions/${row.version}`;
          const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
          const value = accessResponse.payload.data.toString('utf8');
          return { ...row, value };
        } catch (err) {
          return { ...row, value: '[ERROR: Cannot fetch]' };
        }
      })
    );

    res.status(200).json(enriched);
  } catch (err) {
    console.error('Error fetching secrets:', err.message);
    res.status(500).json({ error: 'Failed to fetch secrets: ' + err.message });
  }
};

// ---------------------
// Create secret with file uploads
// ---------------------
const createSecret = async (req, res) => {
  try {
    // Extract form fields (from req.body for multipart/form-data)
    const {
      name,
      description,
      secret_manager_id,
      secret_value, // This is the prompt
      llm_id,
      chunking_method_id,
      temperature,
      created_by = 1,
      template_type = 'system',
      status = 'active',
      usage_count = 0,
      success_rate = 0,
      avg_processing_time = 0,
      template_metadata = {},
    } = req.body;

    // Validate required fields
    if (!name || !secret_value) {
      return res.status(400).json({ error: 'name and secret_value (prompt) are required' });
    }

    // Extract files from req.files (multer)
    const inputPdf = req.files?.input_pdf?.[0] || req.files?.input_pdf;
    const outputPdf = req.files?.output_pdf?.[0] || req.files?.output_pdf;

    if (!inputPdf || !outputPdf) {
      return res.status(400).json({ 
        error: 'Both input_pdf and output_pdf files are required' 
      });
    }

    // Step 1: Generate secret_manager_id from name if not provided
    let finalSecretManagerId = secret_manager_id ? String(secret_manager_id).trim() : null;
    if (!finalSecretManagerId || finalSecretManagerId === '') {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return res.status(400).json({ error: 'name cannot be empty when generating secret_manager_id' });
      }
      
      let sanitized = trimmedName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
      
      if (sanitized.length === 0) {
        sanitized = 'secret';
      }
      
      if (/^[0-9]/.test(sanitized)) {
        sanitized = 'secret_' + sanitized;
      }
      
      finalSecretManagerId = sanitized + '_' + Date.now();
    }
    
    if (!finalSecretManagerId || finalSecretManagerId.trim() === '') {
      return res.status(400).json({ error: 'secret_manager_id cannot be empty' });
    }
    
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(finalSecretManagerId)) {
      return res.status(400).json({ 
        error: `Invalid secret_manager_id format. Must match [a-zA-Z_][a-zA-Z0-9_]* (got: "${finalSecretManagerId}")` 
      });
    }

    // Step 2: Store prompt in GCP Secret Manager
    const parent = `projects/${GCLOUD_PROJECT_ID}`;
    const secretName = `${parent}/secrets/${finalSecretManagerId}`;

    let exists = false;
    try { 
      await secretClient.getSecret({ name: secretName }); 
      exists = true; 
    } catch (err) { 
      if (err.code !== 5) throw err;
    }

    if (!exists) {
      await secretClient.createSecret({
        parent,
        secretId: finalSecretManagerId,
        secret: { replication: { automatic: {} } },
      });
    }

    const [versionResponse] = await secretClient.addSecretVersion({
      parent: secretName,
      payload: { data: Buffer.from(secret_value, 'utf8') },
    });
    const versionId = versionResponse.name.split('/').pop();

    // Step 3: Upload input PDF to GCS (input/ folder)
    // Multer with memoryStorage stores file in buffer property
    const inputFileBuffer = inputPdf.buffer;
    if (!inputFileBuffer) {
      return res.status(400).json({ error: 'Input PDF file buffer is missing' });
    }
    const inputFileData = await uploadFileToGCS(inputFileBuffer, inputPdf.originalname, 'input/');

    // Step 4: Upload output PDF to GCS (output/ folder)
    const outputFileBuffer = outputPdf.buffer;
    if (!outputFileBuffer) {
      return res.status(400).json({ error: 'Output PDF file buffer is missing' });
    }
    const outputFileData = await uploadFileToGCS(outputFileBuffer, outputPdf.originalname, 'output/');

    // Step 5: Save secret_manager record first (to get the ID)
    const secretResult = await docDB.query(`
      INSERT INTO secret_manager (
        id, name, description, template_type, status,
        usage_count, success_rate, avg_processing_time,
        created_by, updated_by, created_at, updated_at,
        activated_at, last_used_at, template_metadata,
        secret_manager_id, version, llm_id, chunking_method_id, temperature
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        $5, $6, $7,
        $8, $8, now(), now(),
        now(), NULL, $9::jsonb,
        $10, $11, $12, $13, $14
      ) RETURNING id;
    `, [
      name, description, template_type, status,
      usage_count, success_rate, avg_processing_time,
      created_by, JSON.stringify(template_metadata),
      finalSecretManagerId, versionId, llm_id || null, chunking_method_id || null,
      temperature !== undefined && temperature !== null ? parseFloat(temperature) : null
    ]);

    const secretManagerId = secretResult.rows[0].id;

    // Step 6: Save file metadata to template_files table
    inputFileData.fileType = 'input';
    const inputTemplateId = await saveFileMetadata(inputFileData, secretManagerId, created_by);

    outputFileData.fileType = 'output';
    const outputTemplateId = await saveFileMetadata(outputFileData, secretManagerId, created_by);

    // Step 7: Process files with Document AI and extract text
    console.log('🤖 Starting Document AI text extraction...');
    let inputExtractionId = null;
    let outputExtractionId = null;

    try {
      // Extract text from input PDF
      console.log('📄 Processing input PDF with Document AI...');
      const inputExtractionResult = await extractTextFromPDF(
        inputFileBuffer,
        inputPdf.originalname
      );
      inputExtractionId = await saveExtractedText(
        inputTemplateId,
        'input',
        inputExtractionResult
      );
      console.log(`✅ Input text extracted: ${inputExtractionResult.totalCharacters} characters`);
    } catch (extractionError) {
      console.error('❌ Failed to extract text from input PDF:', extractionError.message);
      // Continue even if extraction fails - don't block the upload
    }

    try {
      // Extract text from output PDF
      console.log('📄 Processing output PDF with Document AI...');
      const outputExtractionResult = await extractTextFromPDF(
        outputFileBuffer,
        outputPdf.originalname
      );
      outputExtractionId = await saveExtractedText(
        outputTemplateId,
        'output',
        outputExtractionResult
      );
      console.log(`✅ Output text extracted: ${outputExtractionResult.totalCharacters} characters`);
    } catch (extractionError) {
      console.error('❌ Failed to extract text from output PDF:', extractionError.message);
      // Continue even if extraction fails - don't block the upload
    }

    // Step 8: Update secret_manager with template IDs
    await docDB.query(`
      UPDATE secret_manager
      SET input_template_id = $1, output_template_id = $2
      WHERE id = $3
    `, [inputTemplateId, outputTemplateId, secretManagerId]);

    // Step 9: Generate fresh signed URLs for response
    const inputSignedUrl = await generateSignedURL(inputFileData.bucketPath, 60);
    const outputSignedUrl = await generateSignedURL(outputFileData.bucketPath, 60);

    // Step 10: Fetch complete record
    const finalResult = await docDB.query(`
      SELECT s.*, l.name AS llm_name, c.method_name AS chunking_method_name
      FROM secret_manager s
      LEFT JOIN llm_models l ON s.llm_id = l.id
      LEFT JOIN chunking_methods c ON s.chunking_method_id = c.id
      WHERE s.id = $1
    `, [secretManagerId]);

    res.status(201).json({
      message: 'Secret created successfully with template files',
      dbRecord: finalResult.rows[0],
      gcpVersion: versionId,
      templates: {
        input: {
          id: inputTemplateId,
          filename: inputFileData.fileName,
          originalFilename: inputFileData.originalFileName,
          signedUrl: inputSignedUrl.signedUrl,
          expiresAt: inputSignedUrl.expiresAt,
          textExtracted: inputExtractionId !== null,
          extractionId: inputExtractionId,
        },
        output: {
          id: outputTemplateId,
          filename: outputFileData.fileName,
          originalFilename: outputFileData.originalFileName,
          signedUrl: outputSignedUrl.signedUrl,
          expiresAt: outputSignedUrl.expiresAt,
          textExtracted: outputExtractionId !== null,
          extractionId: outputExtractionId,
        },
      },
    });
  } catch (err) {
    console.error('Error creating secret:', err.message);
    res.status(500).json({ error: 'Failed to create secret: ' + err.message });
  }
};

// ---------------------
// Fetch secret by ID with template files
// ---------------------
const fetchSecretValueById = async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch secret manager record with joins
    const result = await docDB.query(`
      SELECT 
        s.*,
        l.name AS llm_name,
        c.method_name AS chunking_method_name,
        s.input_template_id,
        s.output_template_id
      FROM secret_manager s
      LEFT JOIN llm_models l ON s.llm_id = l.id
      LEFT JOIN chunking_methods c ON s.chunking_method_id = c.id
      WHERE s.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Secret not found' });
    }

    const secret = result.rows[0];
    const { secret_manager_id, version, llm_id, chunking_method_id, input_template_id, output_template_id } = secret;

    // Fetch prompt value from GCP Secret Manager
    const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}/versions/${version}`;
    const [accessResponse] = await secretClient.accessSecretVersion({ name: secretName });
    const value = accessResponse.payload.data.toString('utf8');

    // Fetch template files
    const templateFiles = await docDB.query(`
      SELECT * FROM template_files
      WHERE secret_manager_id = $1
      ORDER BY file_type
    `, [id]);

    // Process template files and generate/refresh signed URLs
    const templates = {
      input: null,
      output: null,
    };

    for (const file of templateFiles.rows) {
      // Check if signed URL is expired
      const isExpired = !file.signed_url_expires_at || 
        new Date(file.signed_url_expires_at) < new Date();

      let signedUrl = file.signed_url;
      let expiresAt = file.signed_url_expires_at;

      // Generate new signed URL if expired
      if (isExpired) {
        const newUrlData = await generateSignedURL(file.bucket_path, 60);
        signedUrl = newUrlData.signedUrl;
        expiresAt = newUrlData.expiresAt;

        // Update database with new signed URL
        await docDB.query(`
          UPDATE template_files
          SET signed_url = $1, signed_url_expires_at = $2
          WHERE id = $3
        `, [signedUrl, expiresAt, file.id]);
      }

      // Fetch Document AI extraction data
      const extractionResult = await docDB.query(`
        SELECT 
          id,
          document_ai_processor_id,
          document_ai_processor_version,
          document_ai_operation_name,
          document_ai_request_id,
          extracted_text,
          extracted_text_hash,
          page_count,
          total_characters,
          total_words,
          total_paragraphs,
          entities,
          form_fields,
          tables,
          confidence_score,
          average_confidence,
          min_confidence,
          max_confidence,
          processing_status,
          processing_duration_ms,
          raw_response,
          structured_schema,
          processed_at
        FROM document_ai_extractions
        WHERE template_file_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [file.id]);

      let extractionData = null;
      if (extractionResult.rows.length > 0) {
        const extraction = extractionResult.rows[0];
        
        // Use structured_schema from database if available, otherwise generate from raw_response
        let structuredSchema = extraction.structured_schema;
        if (!structuredSchema && extraction.raw_response) {
          try {
            structuredSchema = mapToLegalSummarySchema(extraction.raw_response, file.file_type);
          } catch (schemaError) {
            console.error(`Error mapping schema for ${file.file_type} file:`, schemaError.message);
          }
        }

        extractionData = {
          id: extraction.id,
          processorId: extraction.document_ai_processor_id,
          processorVersion: extraction.document_ai_processor_version,
          operationName: extraction.document_ai_operation_name,
          requestId: extraction.document_ai_request_id,
          extractedText: extraction.extracted_text,
          extractedTextHash: extraction.extracted_text_hash,
          pageCount: extraction.page_count,
          totalCharacters: extraction.total_characters,
          totalWords: extraction.total_words,
          totalParagraphs: extraction.total_paragraphs,
          entities: extraction.entities,
          formFields: extraction.form_fields,
          tables: extraction.tables,
          confidenceScore: extraction.confidence_score,
          averageConfidence: extraction.average_confidence,
          minConfidence: extraction.min_confidence,
          maxConfidence: extraction.max_confidence,
          processingStatus: extraction.processing_status,
          processingDurationMs: extraction.processing_duration_ms,
          rawResponse: extraction.raw_response, // Plain text
          structuredSchema: structuredSchema, // Clean structured JSON schema for LLM
          processedAt: extraction.processed_at,
        };
      }

      const fileData = {
        id: file.id,
        filename: file.filename,
        originalFilename: file.original_filename,
        fileType: file.file_type,
        fileSize: file.file_size,
        signedUrl,
        expiresAt,
        bucketPath: file.bucket_path,
        extraction: extractionData,
      };

      if (file.file_type === 'input') {
        templates.input = fileData;
      } else if (file.file_type === 'output') {
        templates.output = fileData;
      }
    }

    res.status(200).json({
      id: secret.id,
      name: secret.name,
      description: secret.description,
      secret_manager_id,
      version,
      value, // The prompt
      llm_id,
      llmName: secret.llm_name,
      chunking_method_id,
      chunkingMethodName: secret.chunking_method_name,
      temperature: secret.temperature,
      templates,
    });
  } catch (err) {
    console.error('Error fetching secret value:', err.message);
    res.status(500).json({ error: 'Failed to fetch secret: ' + err.message });
  }
};

// ---------------------
// Update secret (value and metadata)
// ---------------------
// const updateSecret = async (req, res) => {
//   const { id } = req.params;
//   const {
//     name,
//     description,
//     status,
//     template_metadata,
//     secret_value,
//     updated_by = 1
//   } = req.body;

//   try {
//     const result = await docDB.query('SELECT * FROM secret_manager WHERE id = $1', [id]);
//     if (result.rows.length === 0) return res.status(404).json({ error: 'Secret not found' });
//     const secret = result.rows[0];

//     const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret.secret_manager_id}`;

//     let versionId = secret.version;
//     if (secret_value) {
//       const [versionResponse] = await secretClient.addSecretVersion({
//         parent: secretName,
//         payload: { data: Buffer.from(secret_value, 'utf8') },
//       });
//       versionId = versionResponse.name.split('/').pop();
//     }

//     const updateQuery = `
//       UPDATE secret_manager 
//       SET 
//         name = COALESCE($1, name),
//         description = COALESCE($2, description),
//         status = COALESCE($3, status),
//         template_metadata = COALESCE($4::jsonb, template_metadata),
//         version = $5,
//         updated_by = $6,
//         updated_at = now()
//       WHERE id = $7
//       RETURNING *;
//     `;
//     const updated = await docDB.query(updateQuery, [
//       name, description, status, template_metadata ? JSON.stringify(template_metadata) : null,
//       versionId, updated_by, id
//     ]);

//     res.status(200).json({
//       message: 'Secret updated successfully',
//       updatedRecord: updated.rows[0]
//     });
//   } catch (err) {
//     console.error('Error updating secret:', err.message);
//     res.status(500).json({ error: 'Failed to update secret: ' + err.message });
//   }
// };
const updateSecret = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    status,
    template_metadata,
    secret_value,
    llm_id,
    chunking_method_id, // ✅ include chunking_method_id from request body
    temperature, // ✅ include temperature from request body
    updated_by = 1
  } = req.body;

  try {
    const result = await docDB.query('SELECT * FROM secret_manager WHERE id = $1', [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Secret not found' });

    const secret = result.rows[0];
    const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret.secret_manager_id}`;

    let versionId = secret.version;
    if (secret_value) {
      const [versionResponse] = await secretClient.addSecretVersion({
        parent: secretName,
        payload: { data: Buffer.from(secret_value, 'utf8') },
      });
      versionId = versionResponse.name.split('/').pop();
    }

    const updateQuery = `
      UPDATE secret_manager
      SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        template_metadata = COALESCE($4::jsonb, template_metadata),
        version = $5,
        llm_id = COALESCE($6, llm_id),
        chunking_method_id = COALESCE($7, chunking_method_id),
        temperature = COALESCE($8, temperature),
        updated_by = $9,
        updated_at = now()
      WHERE id = $10
      RETURNING *;
    `;

    const updated = await docDB.query(updateQuery, [
      name,
      description,
      status,
      template_metadata ? JSON.stringify(template_metadata) : null,
      versionId,
      llm_id || null,
      chunking_method_id || null,
      temperature !== undefined && temperature !== null ? parseFloat(temperature) : null,
      updated_by,
      id
    ]);

    res.status(200).json({
      message: 'Secret updated successfully',
      updatedRecord: updated.rows[0]
    });
  } catch (err) {
    console.error('Error updating secret:', err.message);
    res.status(500).json({ error: 'Failed to update secret: ' + err.message });
  }
};

// ---------------------
// Delete secret (from GCP + docDB)
// ---------------------
const deleteSecret = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await docDB.query('SELECT * FROM secret_manager WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Secret not found' });

    const { secret_manager_id } = result.rows[0];
    const secretName = `projects/${GCLOUD_PROJECT_ID}/secrets/${secret_manager_id}`;

    try {
      await secretClient.deleteSecret({ name: secretName });
    } catch (err) {
      if (err.code !== 5) console.warn('Warning: Failed to delete from GCP:', err.message);
    }

    await docDB.query('DELETE FROM secret_manager WHERE id = $1', [id]);

    res.status(200).json({ message: 'Secret deleted successfully from GCP and docDB' });
  } catch (err) {
    console.error('Error deleting secret:', err.message);
    res.status(500).json({ error: 'Failed to delete secret: ' + err.message });
  }
};

// ---------------------
module.exports = {
  getAllSecrets,
  createSecret,
  fetchSecretValueById,
  updateSecret,
  deleteSecret
};

