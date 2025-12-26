
const express = require('express');
const cors = require('cors');
require('dotenv').config();

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
const llmRoutes = require('./routes/llmRoutes');
const chunkingMethodRoutes = require('./routes/chunkingMethodRoutes');
const customQueryRoutes = require('./routes/customQueryRoutes');
const systemPromptRoutes = require('./routes/systemPromptRoutes');
const llmUsageRoutes = require('./routes/llmUsageRoutes');

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
app.use('/api/system-prompts', systemPromptRoutes(pool)); // pool for auth, controller uses docDB

console.log('📌 /api/auth           → Using Main DB (pool)');
app.use('/api/auth', authRoutes(pool));

console.log('📌 /api/users          → Using Main DB (pool)');
app.use('/api/users', userRoutes(pool));

console.log('📌 /api/admin/templates → Using Main DB (pool)');
app.use('/api/admin/templates', adminTemplateRoutes(draftPool));

console.log('📌 /api/admin          → Using Main DB (pool)');
app.use('/api/admin', planRoutes(paymentPool));

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

console.log('='.repeat(60) + '\n');

// --- 404 ---
app.use((req, res) => res.status(404).json({ message: 'API Endpoint Not Found' }));

// --- Initialize system_prompts table if it doesn't exist ---
const initializeSystemPromptsTable = async () => {
  try {
    // Check if table exists in docDB
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
      
      // Create index for faster queries
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

// --- Start server ---
const startServer = async () => {
  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Sequelize Database synced!');

    // Initialize system_prompts table
    await initializeSystemPromptsTable();

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




















