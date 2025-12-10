const { Sequelize } = require('sequelize');
const pool = require('./db'); // Import the existing pg pool

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectModule: require('pg'), // Explicitly specify pg as the dialect module
  pool: pool, // Use the existing pg pool
  logging: false, // Disable logging SQL queries
});

module.exports = sequelize;