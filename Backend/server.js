
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

// --- Routes ---
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const userRoutes = require('./routes/userRoutes');
const adminTemplateRoutes = require('./routes/adminTemplateRoutes');
const planRoutes = require('./routes/planRoutes');
const supportQueryRoutes = require('./routes/supportQueryRoutes');
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
const citationAdminRoutes = require('./routes/citation_routes');
const userAdminRoutes = require('./routes/user_routes/users.routes');
const llmChatConfigRoutes = require('./routes/llmChatConfigRoutes');
const summarizationChatConfigRoutes = require('./routes/summarizationChatConfigRoutes');
const requestIdMiddleware = require('./middleware/requestId.middleware');
const errorMiddleware = require('./middleware/error.middleware');
const app = express();

// // --- CORS ---
// const allowedOrigins = [
//   'http://localhost:3001',
//   'https://nexinteladmin.netlify.app'
// ];

// app.use(cors({
//   origin: (origin, callback) => {
//     if (!origin || allowedOrigins.includes(origin)) callback(null, true);
//     else callback(new Error(`CORS blocked for origin: ${origin}`));
//   },
//   credentials: true
// }));


// --- CORS ---
const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:4000',
  'https://nexintel-super-admin.netlify.app'
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
app.use((req, res, next) => {
  console.log(`📥 Incoming Request: ${req.method} ${req.originalUrl}`);
  next();
});

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

console.log('📌 /api/support-queries → Using Main DB (pool)');
app.use('/api/support-queries', supportQueryRoutes(pool));

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

// --- Start server ---
const startServer = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Sequelize Database synced!');

    // Initialize system_prompts, agent_prompts, llm_models, and llm_model_parameters tables
    await initializeSystemPromptsTable();
    await initializeAgentPromptsTable();
    await initializeLlmModelsTable();
    await initializeLlmModelParametersTable();
    await initializeLlmChatConfigTable();
    await initializeSummarizationChatConfigTable();

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




















