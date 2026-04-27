const { Pool } = require('pg');

const aiDocumentPool = new Pool({
  connectionString: process.env.CHATBOT_DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

aiDocumentPool.connect()
  .then(client => {
    console.log('✅ Chatbot/Document DB connected successfully');
    console.log('📊 Chatbot DB:', process.env.CHATBOT_DATABASE_URL?.split('@')[1] || 'connected');
    client.release();
  })
  .catch(err => {
    console.error('❌ Failed to connect to Chatbot/Document DB:', err.message);
  });

aiDocumentPool.on('error', (err) => {
  console.error('❌ Unexpected error on Chatbot/Document DB client:', err);
});

module.exports = aiDocumentPool;
