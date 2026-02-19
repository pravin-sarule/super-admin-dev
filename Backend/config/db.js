// // const { Pool } = require('pg');
// // require('dotenv').config();

// // const connectDB = async () => {
// //   try {
// //     const pool = new Pool({
// //       connectionString: process.env.DATABASE_URL,
// //     });
// //     await pool.connect();
// //     console.log('PostgreSQL connected...');
// //     return pool;
// //   } catch (err) {
// //     console.error(err.message);
// //     // Exit process with failure
// //     process.exit(1);
// //   }
// // };

// // module.exports = connectDB;
// // db.js
// const { Pool } = require('pg');
// require('dotenv').config();

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
// });

// pool.on('connect', () => {
//   console.log('PostgreSQL connected...');
// });

// // Add error handling for the pool
// pool.on('error', (err) => {
//   console.error('Unexpected error on idle client', err);
//   process.exit(-1); // Exit the process if a database error occurs
// });

// module.exports = pool;
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.connect()
  .then(client => {
    console.log('✅ Main PostgreSQL Database connected successfully');
    console.log('📊 Main DB URL:', process.env.DATABASE_URL?.substring(0, 30) + '...');
    client.release();
  })
  .catch(err => {
    console.error('❌ Failed to connect to Main Database:', err);
    process.exit(-1);
  });

pool.on('error', (err) => {
  console.error('❌ Unexpected error on Main DB client:', err);
  process.exit(-1);
});

module.exports = pool;