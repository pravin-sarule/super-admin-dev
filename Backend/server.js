
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { JWT_SECRET } = require('./config/env');

if (!JWT_SECRET) {
  console.error('❌ Fatal: JWT_SECRET not set. Check Backend/.env');
  process.exit(1);
}

// --- Database & Models ---
const pool = require('./config/db');           // Main DB
const docPool = require('./config/docDB');     // Secret Manager DB
const sequelize = require('./config/sequelize');
require('./models/template');
require('./models/userTemplateUsage');
require('./models/support_query');
require('./models/support_priority');
require('./models/support_admin_profile');

// --- Routes ---
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const adminTemplateRoutes = require('./routes/adminTemplateRoutes');
const planRoutes = require('./routes/planRoutes');
const supportQueryRoutes = require('./routes/supportQueryRoutes');
const supportPriorityRoutes = require('./routes/supportPriorityRoutes');
const supportWorkspaceRoutes = require('./routes/support/workspace.routes');
const secretRoutes = require('./routes/secretManagerRoutes');
const contentRoutes = require('./routes/contentRoutes');
const draftPool = require('./config/draftDB');
const paymentPool = require('./config/payment_DB');
const citationPool = require('./config/citationDB');
const llmRoutes = require('./routes/llmRoutes');
const chunkingMethodRoutes = require('./routes/chunkingMethodRoutes');
const systemPromptRoutes = require('./routes/systemPromptRoutes');
const agentPromptRoutes = require('./routes/agentPromptRoutes');
const llmUsageRoutes = require('./routes/llmUsageRoutes');
const tokenUsageRoutes = require('./routes/tokenUsageRoutes');
const fileRoutes = require('./routes/fileRoutes');
const judgementRoutes = require('./routes/judgementRoutes');
const citationAdminRoutes = require('./routes/citation_routes');
const userAdminRoutes = require('./routes/user_routes/users.routes');
const llmChatConfigRoutes = require('./routes/llmChatConfigRoutes');
const summarizationChatConfigRoutes = require('./routes/summarizationChatConfigRoutes');
const aiDocumentRoutes = require('./routes/aiDocumentRoutes');
const { recoverStuckDocuments } = require('./controllers/aiDocumentController');
const chatbotConfigRoutes = require('./routes/chatbotConfigRoutes');
const chatbotTokenUsageRoutes = require('./routes/chatbotTokenUsageRoutes');
const chatHistoryRoutes = require('./routes/chatHistoryRoutes');
const demoRoutes = require('./routes/demoRoutes');
const aiDocumentPool = require('./config/aiDocumentDB');
const requestIdMiddleware = require('./middleware/requestId.middleware');
const errorMiddleware = require('./middleware/error.middleware');
const app = express();


// --- CORS ---
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:4000',
  'https://nexintel-super-admin.netlify.app',
  'https://super-admin-dev.netlify.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));


// --- Middleware ---
app.use(express.json());
app.use(requestIdMiddleware);

console.log('\n' + '='.repeat(60));
console.log('🔧 INITIALIZING ROUTES WITH DATABASE CONNECTIONS');
console.log('='.repeat(60));

// --- Routes ---

app.use('/api/admins', adminRoutes(pool));

console.log('📌 /api/system-prompts → Using docDB (docPool) for data, Main DB (pool) for auth');
app.use('/api/system-prompts', systemPromptRoutes(pool));

console.log('📌 /api/agent-prompts → Using draftDB for data, Main DB (pool) for auth');
app.use('/api/agent-prompts', agentPromptRoutes(pool)); // pool for auth, controller uses draftDB

console.log('📌 /api/auth           → Using Main DB (pool)');
app.use('/api/auth', authRoutes(pool));

console.log('📌 /api/users          → Using Main DB (pool)');
app.use('/api/users', userRoutes(pool));

console.log('📌 /api/admin/templates → Using Main DB (pool)');
app.use('/api/admin/templates', adminTemplateRoutes(draftPool));

// Citation admin: dedicated path so it never conflicts with /api/admin/plans or other admin routes
console.log('📌 /api/citation-admin  → Using Citation DB + Auth DB + docDB');
app.use('/api/citation-admin', citationAdminRoutes(citationPool, pool, docPool));

console.log('📌 /api/admin/plans     → Using Payment DB (paymentPool)');
app.use('/api/admin/plans', planRoutes(paymentPool));

console.log('📌 /api/support-queries   → Using Main DB (pool)');
app.use('/api/support-queries', supportQueryRoutes(pool));

console.log('📌 /api/support-priorities → Using Support DB (supportSequelize)');
app.use('/api/support-priorities', supportPriorityRoutes(pool));

console.log('📌 /api/support-admin     → Using Support DB + Main DB auth');
app.use('/api/support-admin', supportWorkspaceRoutes(pool));

console.log('📌 /api/secrets        → Using docDB (docPool) ✨');
app.use('/api/secrets', secretRoutes(docPool));

console.log('📌 /api/secrets        → Using docDB (docPool) ✨');
app.use('/api/contents', contentRoutes(docPool));

console.log('📌 /api/secrets        → Using docDB (docPool) ✨');
app.use('/api/llm', llmRoutes);

console.log('📌 /api/chunking-methods → Using docDB (docPool) ✨');
app.use('/api/chunking-methods', chunkingMethodRoutes);

console.log('📌 /api/llm-usage → Using Payment DB (paymentPool) ✨');
app.use('/api/llm-usage', llmUsageRoutes(pool));

console.log('📌 /api/token-usage → Using Payment DB (paymentPool) ✨');
app.use('/api/token-usage', tokenUsageRoutes(pool));

console.log('📌 /api/file → Using Main DB (pool) ✨');
app.use('/api/file', fileRoutes(pool));

const judgementServiceBaseUrl = String(process.env.JUDGEMENT_SERVICE_URL || 'http://localhost:8095').replace(/\/+$/, '');
console.log(`🔗 Judgement service base URL: ${judgementServiceBaseUrl}`);
console.log('📌 /api/judgements-admin → Proxying protected admin uploads to judgement-service ✨');
app.use('/api/judgements-admin', judgementRoutes(pool));

// --- Health Check (no auth required) ---
app.get('/api/admin/health', async (req, res) => {
  const checks = {};
  try {
    await pool.query('SELECT 1');
    checks.authDB = 'ok';
  } catch (e) {
    checks.authDB = `error: ${e.message}`;
  }
  try {
    await citationPool.query('SELECT 1');
    checks.citationDB = 'ok';
  } catch (e) {
    checks.citationDB = `error: ${e.message}`;
  }
  const allOk = checks.authDB === 'ok' && checks.citationDB === 'ok';
  res.status(allOk ? 200 : 503).json({ success: allOk, databases: checks });
});

console.log('📌 /api/admin/users → Using Auth DB (pool)');
app.use('/api/admin/users', userAdminRoutes(pool));

console.log('📌 /api/admin/llm-config → Using docDB (docPool) for config, Main DB (pool) for auth');
app.use('/api/admin/llm-config', llmChatConfigRoutes(pool));

console.log('📌 /api/admin/summarization-chat-config → Using docDB (docPool) for config, Main DB (pool) for auth');
app.use('/api/admin/summarization-chat-config', summarizationChatConfigRoutes(pool));

console.log('📌 /api/admin → AI Document Processing (GCS + Document AI + Gemini Embeddings)');
app.use('/api/admin', aiDocumentRoutes(pool));

console.log('📌 /api/admin/chatbot-config → Chatbot model & voice configuration');
app.use('/api/admin/chatbot-config', chatbotConfigRoutes(pool));

console.log('📌 /api/admin/chatbot-token-usage → Chatbot token usage & cost analytics (SSE)');
app.use('/api/admin/chatbot-token-usage', chatbotTokenUsageRoutes(pool));

console.log('📌 /api/admin/chat-history → All chatbot sessions & messages');
app.use('/api/admin/chat-history', chatHistoryRoutes(pool));

console.log('📌 /api/admin/demo → Demo booking & slot management');
app.use('/api/admin/demo', demoRoutes(pool));

console.log('='.repeat(60) + '\n');

// --- 404 ---
app.use((req, res) => res.status(404).json({ message: 'API Endpoint Not Found' }));

// --- Centralized error handler (must be last) ---
app.use(errorMiddleware);

// --- Initialize system_prompts table if it doesn't exist ---
const initializeSystemPromptsTable = async () => {
  try {
    const checkTable = await docPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'system_prompts'
      );
    `);

    if (!checkTable.rows[0].exists) {
      console.log('📋 Creating system_prompts table in docDB...');
      await docPool.query(`
        CREATE TABLE system_prompts (
          id SERIAL PRIMARY KEY,
          system_prompt TEXT NOT NULL,
          prompt_type VARCHAR(32) NOT NULL DEFAULT 'general',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await docPool.query(`
        CREATE INDEX IF NOT EXISTS idx_system_prompts_created_at 
        ON system_prompts(created_at DESC);
      `);
      await docPool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_system_prompts_service_type
        ON system_prompts (prompt_type)
        WHERE prompt_type IN ('chat_model', 'summarization');
      `);
      console.log('✅ system_prompts table created successfully!');
    } else {
      console.log('✅ system_prompts table already exists');
      await docPool.query(`
        ALTER TABLE system_prompts
        ADD COLUMN IF NOT EXISTS prompt_type VARCHAR(32) NOT NULL DEFAULT 'general';
      `);
      await docPool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_system_prompts_service_type
        ON system_prompts (prompt_type)
        WHERE prompt_type IN ('chat_model', 'summarization');
      `);
    }

    // Fix legacy tables where `id` was created without SERIAL (INSERTs fail with null id)
    await docPool.query(`
      DO $$
      DECLARE
        col_default text;
        id_identity text;
      BEGIN
        SELECT c.column_default, c.is_identity INTO col_default, id_identity
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'system_prompts'
          AND c.column_name = 'id';

        IF col_default IS NULL AND COALESCE(id_identity, 'NO') <> 'YES' THEN
          IF NOT EXISTS (
            SELECT 1 FROM pg_class rel
            JOIN pg_namespace n ON n.oid = rel.relnamespace
            WHERE rel.relkind = 'S' AND rel.relname = 'system_prompts_id_seq' AND n.nspname = 'public'
          ) THEN
            CREATE SEQUENCE public.system_prompts_id_seq;
          END IF;
          -- setval() does not accept 0; empty table: is_called false so next nextval() is 1
          IF (SELECT COALESCE(MAX(id), 0) FROM public.system_prompts) = 0 THEN
            PERFORM setval('public.system_prompts_id_seq', 1, false);
          ELSE
            PERFORM setval(
              'public.system_prompts_id_seq',
              (SELECT MAX(id) FROM public.system_prompts)
            );
          END IF;
          ALTER TABLE public.system_prompts
            ALTER COLUMN id SET DEFAULT nextval('public.system_prompts_id_seq'::regclass);
          -- Skip OWNED BY: PG requires sequence and table same owner; DEFAULT alone is enough for inserts
          RAISE NOTICE 'system_prompts.id: attached SERIAL sequence (legacy table repair)';
        END IF;
      END $$;
    `);
  } catch (error) {
    console.error('❌ Error initializing system_prompts table:', error.message);
    throw error;
  }
};

// --- Initialize agent_prompts table in draftDB if it doesn't exist ---
const initializeAgentPromptsTable = async () => {
  try {
    const checkTable = await draftPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'agent_prompts'
      );
    `);

    if (!checkTable.rows[0].exists) {
      console.log('📋 Creating agent_prompts table in draftDB...');
      await draftPool.query(`
        CREATE TABLE agent_prompts (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          prompt TEXT NOT NULL,
          model_ids JSONB DEFAULT '[]',
          temperature DECIMAL(3,2) DEFAULT 0.7,
          agent_type VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await draftPool.query(`
        CREATE INDEX IF NOT EXISTS idx_agent_prompts_agent_type 
        ON agent_prompts(agent_type);
      `);
      console.log('✅ agent_prompts table created successfully in draftDB!');
    } else {
      console.log('✅ agent_prompts table already exists in draftDB');
    }

    // Add llm_parameters column if missing (for LLM parameter config per agent)
    const checkCol = await draftPool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'agent_prompts' AND column_name = 'llm_parameters'
      );
    `);
    if (!checkCol.rows[0].exists) {
      console.log('📋 Adding llm_parameters column to agent_prompts...');
      await draftPool.query(`
        ALTER TABLE agent_prompts ADD COLUMN llm_parameters JSONB DEFAULT '{}';
      `);
      console.log('✅ llm_parameters column added to agent_prompts');
    }
  } catch (error) {
    console.error('❌ Error initializing agent_prompts table:', error.message);
    throw error;
  }
};

// --- Initialize llm_models table in docDB if it doesn't exist (and fix id default if needed) ---
const initializeLlmModelsTable = async () => {
  try {
    const checkTable = await docPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'llm_models'
      );
    `);

    if (!checkTable.rows[0].exists) {
      console.log('📋 Creating llm_models table in docDB...');
      await docPool.query(`
        CREATE TABLE llm_models (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      console.log('✅ llm_models table created successfully in docDB!');
    } else {
      // Ensure id has a default (fix for existing tables created without SERIAL)
      const colDefault = await docPool.query(`
        SELECT column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'llm_models' AND column_name = 'id';
      `);
      if (colDefault.rows[0] && !colDefault.rows[0].column_default) {
        console.log('📋 Fixing llm_models.id: adding sequence default...');
        await docPool.query(`
          CREATE SEQUENCE IF NOT EXISTS llm_models_id_seq;
          SELECT setval('llm_models_id_seq', COALESCE((SELECT MAX(id) FROM llm_models), 0));
          ALTER TABLE llm_models ALTER COLUMN id SET DEFAULT nextval('llm_models_id_seq'::regclass);
        `);
        console.log('✅ llm_models.id default set.');
      }
    }
  } catch (error) {
    console.error('❌ Error initializing llm_models table:', error.message);
    throw error;
  }
};

// --- Initialize llm_model_parameters table in docDB if it doesn't exist ---
const initializeLlmModelParametersTable = async () => {
  try {
    const checkTable = await docPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'llm_model_parameters'
      );
    `);

    if (!checkTable.rows[0].exists) {
      console.log('📋 Creating llm_model_parameters table in docDB...');
      await docPool.query(`
        CREATE TABLE llm_model_parameters (
          id SERIAL PRIMARY KEY,
          model_id INTEGER NOT NULL UNIQUE REFERENCES llm_models(id) ON DELETE CASCADE,
          temperature NUMERIC(3,2) DEFAULT 1.0 CHECK (temperature >= 0 AND temperature <= 2),
          media_resolution VARCHAR(50) DEFAULT 'default',
          thinking_mode BOOLEAN DEFAULT false,
          thinking_budget BOOLEAN DEFAULT false,
          thinking_level VARCHAR(50) DEFAULT 'default',
          structured_outputs_enabled BOOLEAN DEFAULT false,
          structured_outputs_config JSONB DEFAULT '{}',
          code_execution BOOLEAN DEFAULT false,
          function_calling_enabled BOOLEAN DEFAULT false,
          function_calling_config JSONB DEFAULT '{}',
          grounding_google_search BOOLEAN DEFAULT false,
          url_context BOOLEAN DEFAULT false,
          system_instructions TEXT DEFAULT '',
          api_key_status VARCHAR(50) DEFAULT 'none',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await docPool.query(`
        CREATE INDEX IF NOT EXISTS idx_llm_model_parameters_model_id ON llm_model_parameters(model_id);
      `);
      console.log('✅ llm_model_parameters table created successfully in docDB!');
    } else {
      console.log('✅ llm_model_parameters table already exists in docDB');
    }
  } catch (error) {
    console.error('❌ Error initializing llm_model_parameters table:', error.message);
    throw error;
  }
};

// --- Initialize llm_chat_config table in docDB if it doesn't exist ---
const initializeLlmChatConfigTable = async () => {
  try {
    const checkTable = await docPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'llm_chat_config'
      );
    `);

    if (!checkTable.rows[0].exists) {
      console.log('📋 Creating llm_chat_config table in docDB...');
      await docPool.query(`
        CREATE TABLE llm_chat_config (
          id SERIAL PRIMARY KEY,
          max_output_tokens INT DEFAULT 20000,
          total_tokens_per_day INT DEFAULT 250000,
          llm_model VARCHAR(100) DEFAULT 'gemini-2.5-flash-lite',
          llm_provider VARCHAR(100) DEFAULT 'google',
          model_temperature DECIMAL(3,2) DEFAULT 0.7,
          messages_per_hour INT DEFAULT 50,
          quota_chats_per_minute INT DEFAULT 10,
          chats_per_day INT DEFAULT 60,
          max_document_pages INT DEFAULT 300,
          max_document_size_mb INT DEFAULT 40,
          max_file_upload_per_day INT DEFAULT 15,
          max_upload_files INT DEFAULT 8,
          streaming_delay INT DEFAULT 100,
          updated_by INT DEFAULT NULL,
          updated_at TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await docPool.query(`
        INSERT INTO llm_chat_config (
          max_output_tokens, total_tokens_per_day, llm_model, llm_provider, model_temperature,
          messages_per_hour, quota_chats_per_minute, chats_per_day,
          max_document_pages, max_document_size_mb, max_file_upload_per_day,
          max_upload_files, streaming_delay
        ) VALUES (
          20000, 250000, 'gemini-2.5-flash-lite', 'google', 0.7,
          50, 10, 60, 300, 40, 15, 8, 100
        );
      `);
      console.log('✅ llm_chat_config table created with default row!');
    } else {
      await docPool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'llm_chat_config' AND column_name = 'llm_provider') THEN
            ALTER TABLE llm_chat_config ADD COLUMN llm_provider VARCHAR(100) DEFAULT 'google';
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'llm_chat_config' AND column_name = 'max_upload_files') THEN
            ALTER TABLE llm_chat_config ADD COLUMN max_upload_files INT DEFAULT 8;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'llm_chat_config' AND column_name = 'streaming_delay') THEN
            ALTER TABLE llm_chat_config ADD COLUMN streaming_delay INT DEFAULT 100;
          END IF;
        END $$;
      `);
      // Ensure a default row exists
      const rowCheck = await docPool.query('SELECT id FROM llm_chat_config LIMIT 1');
      if (rowCheck.rowCount === 0) {
        await docPool.query(`
          INSERT INTO llm_chat_config (
            max_output_tokens, total_tokens_per_day, llm_model, llm_provider, model_temperature,
            messages_per_hour, quota_chats_per_minute, chats_per_day,
            max_document_pages, max_document_size_mb, max_file_upload_per_day,
            max_upload_files, streaming_delay
          ) VALUES (
            20000, 250000, 'gemini-2.5-flash-lite', 'google', 0.7,
            50, 10, 60, 300, 40, 15, 8, 100
          );
        `);
        console.log('✅ Default llm_chat_config row inserted.');
      } else {
        console.log('✅ llm_chat_config table already exists');
      }
    }
  } catch (error) {
    console.error('❌ Error initializing llm_chat_config table:', error.message);
    throw error;
  }
};

// --- Initialize summarization_chat_config table in docDB ---
const initializeSummarizationChatConfigTable = async () => {
  try {
    const checkTable = await docPool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'summarization_chat_config'
      );
    `);

    if (!checkTable.rows[0].exists) {
      console.log('📋 Creating summarization_chat_config table in docDB...');
      await docPool.query(`
        CREATE TABLE summarization_chat_config (
          id SERIAL PRIMARY KEY,
          llm_model VARCHAR(200) DEFAULT 'gemini-2.5-flash',
          llm_provider VARCHAR(100) DEFAULT 'google',
          model_temperature DECIMAL(3,2) DEFAULT 0.7,
          max_output_tokens INT DEFAULT 25000,
          streaming_delay INT DEFAULT 50,
          max_upload_files INT DEFAULT 10,
          max_file_size_mb INT DEFAULT 100,
          max_document_size_mb INT DEFAULT 40,
          max_document_pages INT DEFAULT 400,
          max_context_documents INT DEFAULT 8,
          embedding_provider VARCHAR(100) DEFAULT 'google',
          embedding_model VARCHAR(200) DEFAULT 'text-embedding-004',
          embedding_dimension INT DEFAULT 768,
          retrieval_top_k INT DEFAULT 10,
          use_hybrid_search BOOLEAN DEFAULT TRUE,
          use_rrf BOOLEAN DEFAULT TRUE,
          semantic_weight DECIMAL(4,3) DEFAULT 0.7,
          keyword_weight DECIMAL(4,3) DEFAULT 0.3,
          text_search_language VARCHAR(50) DEFAULT 'english',
          total_tokens_per_day INT DEFAULT 300000,
          messages_per_hour INT DEFAULT 60,
          quota_chats_per_minute INT DEFAULT 20,
          chats_per_day INT DEFAULT 80,
          max_file_upload_per_day INT DEFAULT 15,
          max_conversation_history INT DEFAULT 25,
          updated_by INT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await docPool.query(`
        INSERT INTO summarization_chat_config (
          llm_model, llm_provider, model_temperature, max_output_tokens, streaming_delay,
          max_upload_files, max_file_size_mb,
          max_document_size_mb, max_document_pages, max_context_documents,
          embedding_provider, embedding_model, embedding_dimension, retrieval_top_k,
          use_hybrid_search, use_rrf, semantic_weight, keyword_weight, text_search_language,
          total_tokens_per_day, messages_per_hour, quota_chats_per_minute, chats_per_day,
          max_file_upload_per_day, max_conversation_history
        ) VALUES (
          'gemini-2.5-flash', 'google', 0.7, 25000, 50,
          10, 100,
          40, 400, 8,
          'google', 'text-embedding-004', 768, 10,
          TRUE, TRUE, 0.7, 0.3, 'english',
          300000, 60, 20, 80,
          15, 25
        );
      `);
      console.log('✅ summarization_chat_config table created with default row!');
    } else {
      const rowCheck = await docPool.query('SELECT id FROM summarization_chat_config LIMIT 1');
      if (rowCheck.rowCount === 0) {
        await docPool.query(`
          INSERT INTO summarization_chat_config (
            llm_model, llm_provider, model_temperature, max_output_tokens, streaming_delay,
            max_upload_files, max_file_size_mb,
            max_document_size_mb, max_document_pages, max_context_documents,
            embedding_provider, embedding_model, embedding_dimension, retrieval_top_k,
            use_hybrid_search, use_rrf, semantic_weight, keyword_weight, text_search_language,
            total_tokens_per_day, messages_per_hour, quota_chats_per_minute, chats_per_day,
            max_file_upload_per_day, max_conversation_history
          ) VALUES (
            'gemini-2.5-flash', 'google', 0.7, 25000, 50,
            10, 100,
            40, 400, 8,
            'google', 'text-embedding-004', 768, 10,
            TRUE, TRUE, 0.7, 0.3, 'english',
            300000, 60, 20, 80,
            15, 25
          );
        `);
        console.log('✅ Default summarization_chat_config row inserted.');
      } else {
        console.log('✅ summarization_chat_config table already exists');
      }
    }

    await docPool.query(`
      ALTER TABLE summarization_chat_config
      DROP COLUMN IF EXISTS summarization_model,
      DROP COLUMN IF EXISTS max_summarization_output_tokens;
    `);
  } catch (error) {
    console.error('❌ Error initializing summarization_chat_config table:', error.message);
    throw error;
  }
};

// --- Initialize AI Document Processing tables (exact user schema) ---
const initializeAIDocumentTables = async () => {
  try {
    await aiDocumentPool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await aiDocumentPool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // ── documents ────────────────────────────────────────────────────────────
    await aiDocumentPool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_name            TEXT NOT NULL DEFAULT '',
        original_extension   VARCHAR(10),
        gcs_input_path       TEXT NOT NULL DEFAULT '',
        gcs_ocr_path         TEXT,
        processing_status    VARCHAR(20) DEFAULT 'uploaded'
          CHECK (processing_status IN ('uploaded','ocr_processing','ocr_completed','embedding_processing','active','failed')),
        document_type        VARCHAR(50),
        checksum             TEXT,
        total_pages          INT,
        created_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration guards — run safely against any pre-existing documents table
    const docAlters = [
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name           TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS original_extension  VARCHAR(10)`,
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS gcs_input_path      TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS gcs_ocr_path        TEXT`,
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_status   VARCHAR(20) DEFAULT 'uploaded'`,
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_type       VARCHAR(50)`,
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS checksum            TEXT`,
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS total_pages         INT`,
      // Extra operational columns not in the base schema but needed by pipeline
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS total_chunks        INT`,
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS operation_id        TEXT`,
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message       TEXT`,
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
      `ALTER TABLE documents ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
    ];
    for (const sql of docAlters) await aiDocumentPool.query(sql).catch(() => {});

    await aiDocumentPool.query(`CREATE INDEX IF NOT EXISTS idx_doc_status ON documents(processing_status);`);
    await aiDocumentPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_gcs_input ON documents(gcs_input_path) WHERE gcs_input_path <> '';`);

    // ── document_chunks ──────────────────────────────────────────────────────
    await aiDocumentPool.query(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
        content     TEXT NOT NULL DEFAULT '',
        chunk_index INT  NOT NULL DEFAULT 0,
        page_number INT,
        token_count INT,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const chunkAlters = [
      `ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS document_id UUID`,
      `ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS content     TEXT NOT NULL DEFAULT ''`,
      `ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS chunk_index INT  NOT NULL DEFAULT 0`,
      `ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS page_number INT`,
      `ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS token_count INT`,
      `ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`,
    ];
    for (const sql of chunkAlters) await aiDocumentPool.query(sql).catch(() => {});

    await aiDocumentPool.query(`CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);`);

    // ── chunk_embeddings (768-dim) ───────────────────────────────────────────
    await aiDocumentPool.query(`
      CREATE TABLE IF NOT EXISTS chunk_embeddings (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chunk_id   UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
        embedding  vector(768),
        task_type  VARCHAR(50) DEFAULT 'RETRIEVAL_DOCUMENT',
        model_name VARCHAR(50) DEFAULT 'gemini-embedding-2'
      );
    `);

    const embAlters = [
      `ALTER TABLE chunk_embeddings ADD COLUMN IF NOT EXISTS task_type  VARCHAR(50) DEFAULT 'RETRIEVAL_DOCUMENT'`,
      `ALTER TABLE chunk_embeddings ADD COLUMN IF NOT EXISTS model_name VARCHAR(50) DEFAULT 'gemini-embedding-2'`,
    ];
    for (const sql of embAlters) await aiDocumentPool.query(sql).catch(() => {});

    await aiDocumentPool.query(`CREATE INDEX IF NOT EXISTS idx_vector_768_search ON chunk_embeddings USING hnsw (embedding vector_cosine_ops);`).catch(() => {});
    await aiDocumentPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_chunk_embedding_unique ON chunk_embeddings(chunk_id);`).catch(() => {});

    // ── chatbot_config ───────────────────────────────────────────────────────
    await aiDocumentPool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_config (
        id                  SERIAL PRIMARY KEY,
        config_key          VARCHAR(100) NOT NULL UNIQUE,
        model_text          VARCHAR(100) NOT NULL DEFAULT 'gemini-1.5-flash',
        model_audio         VARCHAR(100) NOT NULL DEFAULT 'gemini-3.1-flash-live-preview',
        max_tokens          INT          NOT NULL DEFAULT 150,
        temperature         FLOAT        NOT NULL DEFAULT 0.1,
        top_k_results       INT          NOT NULL DEFAULT 5,
        top_p               FLOAT        NOT NULL DEFAULT 0.95,
        voice_name          VARCHAR(50)  NOT NULL DEFAULT 'Puck',
        language_code       VARCHAR(20)  NOT NULL DEFAULT 'en-US',
        speaking_rate       FLOAT        NOT NULL DEFAULT 1.0,
        pitch               FLOAT        NOT NULL DEFAULT 0.0,
        volume_gain_db      FLOAT        NOT NULL DEFAULT 0.0,
        system_prompt       TEXT NOT NULL DEFAULT 'You are the Nexintel AI Support Agent. Provide fast, accurate solutions based ONLY on the provided document context. If the answer is not found, state: "I''m sorry, I don''t have information on that in our records." Keep responses under 3 sentences.',
        audio_system_prompt TEXT NOT NULL DEFAULT 'You are the Nexintel AI Support Agent. Provide fast, accurate answers based ONLY on documents retrieved via search_documents. Keep spoken responses under 20 seconds.',
        updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await aiDocumentPool.query(`INSERT INTO chatbot_config (config_key) VALUES ('default') ON CONFLICT (config_key) DO NOTHING;`);

    const cfgAlters = [
      // All 13 editable columns — guards run safely against any pre-existing chatbot_config table
      `ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS model_text          VARCHAR(100) NOT NULL DEFAULT 'gemini-1.5-flash'`,
      `ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS model_audio         VARCHAR(100) NOT NULL DEFAULT 'gemini-3.1-flash-live-preview'`,
      `ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS max_tokens          INT          NOT NULL DEFAULT 150`,
      `ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS temperature         FLOAT        NOT NULL DEFAULT 0.1`,
      `ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS top_k_results       INT          NOT NULL DEFAULT 5`,
      `ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS top_p               FLOAT        NOT NULL DEFAULT 0.95`,
      `ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS voice_name          VARCHAR(50)  NOT NULL DEFAULT 'Puck'`,
      `ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS language_code       VARCHAR(20)  NOT NULL DEFAULT 'en-US'`,
      `ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS speaking_rate       FLOAT        NOT NULL DEFAULT 1.0`,
      `ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS pitch               FLOAT        NOT NULL DEFAULT 0.0`,
      `ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS volume_gain_db      FLOAT        NOT NULL DEFAULT 0.0`,
      `ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS system_prompt       TEXT NOT NULL DEFAULT 'You are the Nexintel AI Support Agent.'`,
      `ALTER TABLE chatbot_config ADD COLUMN IF NOT EXISTS audio_system_prompt TEXT NOT NULL DEFAULT 'You are the Nexintel AI Support Agent.'`,
    ];
    for (const sql of cfgAlters) await aiDocumentPool.query(sql).catch(() => {});

    // ── chat_sessions ────────────────────────────────────────────────────────
    await aiDocumentPool.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_token  TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
        mode           VARCHAR(10) DEFAULT 'text' CHECK (mode IN ('text','audio')),
        created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ── chat_messages ────────────────────────────────────────────────────────
    await aiDocumentPool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role       VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant')),
        content    TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await aiDocumentPool.query(`CREATE INDEX IF NOT EXISTS idx_chat_msg_session_time ON chat_messages(session_id, created_at);`).catch(() => {});

    // ── chatbot_token_usage ──────────────────────────────────────────────────
    await aiDocumentPool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_token_usage (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id    UUID        REFERENCES chat_sessions(id) ON DELETE SET NULL,
        mode          TEXT        NOT NULL CHECK (mode IN ('text', 'audio')),
        model_name    TEXT        NOT NULL,
        input_tokens  INTEGER     NOT NULL DEFAULT 0,
        output_tokens INTEGER     NOT NULL DEFAULT 0,
        total_tokens  INTEGER     GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
        ip_address    INET,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await aiDocumentPool.query(`CREATE INDEX IF NOT EXISTS idx_ctu_created_at  ON chatbot_token_usage (created_at DESC);`).catch(() => {});
    await aiDocumentPool.query(`CREATE INDEX IF NOT EXISTS idx_ctu_session_id  ON chatbot_token_usage (session_id);`).catch(() => {});
    await aiDocumentPool.query(`CREATE INDEX IF NOT EXISTS idx_ctu_mode        ON chatbot_token_usage (mode);`).catch(() => {});
    await aiDocumentPool.query(`CREATE INDEX IF NOT EXISTS idx_ctu_model_name  ON chatbot_token_usage (model_name);`).catch(() => {});
    await aiDocumentPool.query(`CREATE INDEX IF NOT EXISTS idx_ctu_ip          ON chatbot_token_usage (ip_address);`).catch(() => {});

    console.log('✅ All AI/Chatbot tables ready (documents, document_chunks, chunk_embeddings, chatbot_config, chat_sessions, chat_messages, chatbot_token_usage)');
  } catch (error) {
    console.error('❌ Error initializing AI Document tables:', error.message);
    throw error;
  }
};

// --- Initialize support_priorities table in Support DB ---
const supportSequelize = require('./config/supportSequelize');

const DEFAULT_PRIORITIES = [
  { value: 'low',    label: 'Low',    color: 'bg-emerald-50 text-emerald-700 border-emerald-200', display_order: 1 },
  { value: 'medium', label: 'Medium', color: 'bg-amber-50 text-amber-700 border-amber-200',       display_order: 2 },
  { value: 'high',   label: 'High',   color: 'bg-orange-50 text-orange-700 border-orange-200',    display_order: 3 },
  { value: 'urgent', label: 'Urgent', color: 'bg-rose-50 text-rose-700 border-rose-200',          display_order: 4 },
];

const initializeSupportPrioritiesTable = async () => {
  try {
    await supportSequelize.query(`
      CREATE TABLE IF NOT EXISTS support_priorities (
        id            SERIAL PRIMARY KEY,
        value         VARCHAR(50)  NOT NULL UNIQUE,
        label         VARCHAR(100) NOT NULL,
        color         VARCHAR(200) NOT NULL DEFAULT 'bg-slate-100 text-slate-600 border-slate-200',
        display_order INTEGER      NOT NULL DEFAULT 0,
        is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    // Seed default priorities — skip if already present
    for (const p of DEFAULT_PRIORITIES) {
      await supportSequelize.query(
        `INSERT INTO support_priorities (value, label, color, display_order, is_active, created_at, updated_at)
         VALUES (:value, :label, :color, :display_order, TRUE, NOW(), NOW())
         ON CONFLICT (value) DO NOTHING;`,
        { replacements: p }
      );
    }

    console.log('✅ support_priorities table ready with default seed data');
  } catch (error) {
    console.error('❌ Error initializing support_priorities table:', error.message);
    throw error;
  }
};

const initializeSupportWorkspaceSchema = async () => {
  try {
    await supportSequelize.query(`
      CREATE TABLE IF NOT EXISTS support_admin_profiles (
        id                        SERIAL PRIMARY KEY,
        admin_id                  INTEGER      NOT NULL UNIQUE,
        manager_admin_id          INTEGER,
        team_name                 VARCHAR(120) NOT NULL DEFAULT 'Support Team',
        is_team_manager           BOOLEAN      NOT NULL DEFAULT FALSE,
        can_manage_team           BOOLEAN      NOT NULL DEFAULT FALSE,
        can_view_all_tickets      BOOLEAN      NOT NULL DEFAULT FALSE,
        can_view_assigned_to_me   BOOLEAN      NOT NULL DEFAULT TRUE,
        can_view_team_tickets     BOOLEAN      NOT NULL DEFAULT FALSE,
        can_view_unassigned_tickets BOOLEAN    NOT NULL DEFAULT FALSE,
        can_view_closed_tickets   BOOLEAN      NOT NULL DEFAULT FALSE,
        can_view_archived_tickets BOOLEAN      NOT NULL DEFAULT FALSE,
        default_queue             VARCHAR(40)  NOT NULL DEFAULT 'assigned_to_me',
        allowed_priorities        JSONB        NOT NULL DEFAULT '[]'::jsonb,
        allowed_categories        JSONB        NOT NULL DEFAULT '[]'::jsonb,
        assignment_preferences    JSONB        NOT NULL DEFAULT '{}'::jsonb,
        created_by_admin_id       INTEGER,
        updated_by_admin_id       INTEGER,
        is_active                 BOOLEAN      NOT NULL DEFAULT TRUE,
        created_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );
    `);

    await supportSequelize.query(`
      ALTER TABLE support_queries
      ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL DEFAULT 'general',
      ADD COLUMN IF NOT EXISTS assigned_to_admin_id INTEGER,
      ADD COLUMN IF NOT EXISTS assigned_by_admin_id INTEGER,
      ADD COLUMN IF NOT EXISTS team_manager_admin_id INTEGER,
      ADD COLUMN IF NOT EXISTS assignment_method VARCHAR(40),
      ADD COLUMN IF NOT EXISTS internal_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS closed_by_admin_id INTEGER,
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
    `);

    await supportSequelize.query(`
      UPDATE support_queries
      SET
        category = COALESCE(NULLIF(TRIM(category), ''), 'general'),
        internal_notes = COALESCE(internal_notes, '[]'::jsonb),
        last_activity_at = COALESCE(last_activity_at, updated_at, created_at, NOW())
      WHERE
        category IS NULL
        OR TRIM(category) = ''
        OR internal_notes IS NULL
        OR last_activity_at IS NULL;
    `);

    await supportSequelize.query(`
      UPDATE support_queries
      SET closed_by_admin_id = assigned_to_admin_id
      WHERE
        status = 'closed'
        AND closed_at IS NOT NULL
        AND closed_by_admin_id IS NULL
        AND assigned_to_admin_id IS NOT NULL;
    `);

    await supportSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_support_queries_assigned_to_admin_id
      ON support_queries (assigned_to_admin_id);
    `);
    await supportSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_support_queries_team_manager_admin_id
      ON support_queries (team_manager_admin_id);
    `);
    await supportSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_support_queries_status_archived_at
      ON support_queries (status, archived_at);
    `);
    await supportSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_support_queries_category
      ON support_queries (category);
    `);
    await supportSequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_support_admin_profiles_manager_admin_id
      ON support_admin_profiles (manager_admin_id);
    `);

    console.log('✅ support workspace schema ready');
  } catch (error) {
    console.error('❌ Error initializing support workspace schema:', error.message);
    throw error;
  }
};

// --- Start server ---
const startServer = async () => {
  try {
    // Start listening immediately so Cloud Run startup probe passes
    const PORT = process.env.PORT || 4000;
    const server = app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log('🚀 SERVER STARTED SUCCESSFULLY');
      console.log('='.repeat(60));
      console.log(`🌐 Server running on port: ${PORT}`);
      console.log(`📊 Main Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[1] || 'Connected'}`);
      console.log(`📄 docDB Database: ${process.env.DOCDB_URL?.split('@')[1]?.split('/')[1] || 'Connected'}`);
      console.log('='.repeat(60) + '\n');
    });

    // Run DB initialization after port is open (avoids Cloud Run startup probe timeout)
    await sequelize.sync({ alter: true });
    console.log('✅ Sequelize Database synced!');

    // Initialize system_prompts, agent_prompts, llm_models, and llm_model_parameters tables
    await initializeSystemPromptsTable();
    await initializeAgentPromptsTable();
    await initializeLlmModelsTable();
    await initializeLlmModelParametersTable();
    await initializeLlmChatConfigTable();
    await initializeSummarizationChatConfigTable();
    await initializeSupportWorkspaceSchema();
    await initializeSupportPrioritiesTable();
    await initializeAIDocumentTables();
    await recoverStuckDocuments();

    const shutdown = async (signal) => {
      console.log(`\n⚠️  ${signal} received. Closing server...`);
      server.close(async () => {
        console.log('🛑 HTTP server closed.');

        // Close both database pools
        try {
          await pool.end();
          console.log('✅ Main PostgreSQL pool closed.');
        } catch (e) {
          console.error('❌ Error closing main pool:', e);
        }

        try {
          await docPool.end();
          console.log('✅ docDB PostgreSQL pool closed.');
        } catch (e) {
          console.error('❌ Error closing docDB pool:', e);
        }

        try {
          await citationPool.end();
          console.log('✅ Citation PostgreSQL pool closed.');
        } catch (e) {
          console.error('❌ Error closing citation pool:', e);
        }

        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('unhandledRejection', err => {
      console.error('❌ Unhandled Rejection:', err);
    });

    process.on('uncaughtException', err => {
      console.error('❌ Uncaught Exception:', err);
      shutdown('Uncaught Exception');
    });

  } catch (err) {
    console.error('❌ Startup Error:', err);
    process.exit(1);
  }
};

startServer();
