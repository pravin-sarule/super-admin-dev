
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
const customQueryRoutes = require('./routes/customQueryRoutes');
const systemPromptRoutes = require('./routes/systemPromptRoutes');
const agentPromptRoutes = require('./routes/agentPromptRoutes');
const llmUsageRoutes = require('./routes/llmUsageRoutes');
const tokenUsageRoutes = require('./routes/tokenUsageRoutes');
const fileRoutes = require('./routes/fileRoutes');
const citationAdminRoutes = require('./routes/citation_routes');
const userAdminRoutes = require('./routes/user_routes/users.routes');
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
console.log('📌 /api/citation-admin  → Using Citation DB (citationPool) + Auth DB (pool)');
app.use('/api/citation-admin', citationAdminRoutes(citationPool, pool));

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

console.log('📌 /api/custom-query → Using docDB (docPool) ✨');
app.use('/api/custom-query', customQueryRoutes);

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
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await docPool.query(`
        CREATE INDEX IF NOT EXISTS idx_system_prompts_created_at 
        ON system_prompts(created_at DESC);
      `);
      console.log('✅ system_prompts table created successfully!');
    } else {
      console.log('✅ system_prompts table already exists');
    }
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




















