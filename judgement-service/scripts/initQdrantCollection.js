#!/usr/bin/env node

const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { EMBEDDING_DIMENSION } = require('../services/embeddingService');
const { COLLECTION_NAME } = require('../services/qdrantService');

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY =
  process.env.QDRANT_API_KEY ||
  process.env.Qdrant_API_KEY;

function qdrantClient() {
  return axios.create({
    baseURL: QDRANT_URL,
    timeout: 120000,
    headers: QDRANT_API_KEY ? {
      'api-key': QDRANT_API_KEY,
      'Content-Type': 'application/json',
    } : {
      'Content-Type': 'application/json',
    },
  });
}

async function main() {
  if (!QDRANT_URL) {
    console.error('QDRANT_URL is not configured in .env');
    process.exit(1);
  }

  const api = qdrantClient();

  console.log(`Checking if Qdrant collection "${COLLECTION_NAME}" exists...`);
  let exists = false;
  try {
    await api.get(`/collections/${COLLECTION_NAME}`);
    exists = true;
    console.log(`Collection "${COLLECTION_NAME}" already exists.`);
  } catch (error) {
    if (error.response?.status !== 404) {
      throw error;
    }
  }

  if (!exists) {
    console.log(`Creating Qdrant collection "${COLLECTION_NAME}" with dimension ${EMBEDDING_DIMENSION}...`);
    await api.put(`/collections/${COLLECTION_NAME}`, {
      vectors: {
        size: EMBEDDING_DIMENSION,
        distance: 'Cosine',
      },
    });
    console.log(`Collection "${COLLECTION_NAME}" created successfully.`);
  }

  console.log('Ensuring payload indexes...');
  const fields = [
    { field_name: 'judgment_uuid', field_schema: 'keyword' },
    { field_name: 'canonical_id', field_schema: 'keyword' },
    { field_name: 'case_name', field_schema: 'keyword' },
    { field_name: 'source_type', field_schema: 'keyword' },
  ];

  for (const fieldConfig of fields) {
    console.log(`Creating payload index for field: ${fieldConfig.field_name}`);
    await api.put(`/collections/${COLLECTION_NAME}/index?wait=true`, fieldConfig);
  }

  console.log('Qdrant collection setup complete!');
}

main().catch((error) => {
  console.error('Failed to initialize Qdrant collection:', error.message);
  if (error.response?.data) {
    console.error('Response:', JSON.stringify(error.response.data, null, 2));
  }
  process.exit(1);
});
