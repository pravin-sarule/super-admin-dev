const { Sequelize } = require('sequelize');

const supportDatabaseUrl =
  process.env.SUPPORT_DATABASE_URL || process.env.SUPPORT_DB_URL;

if (!supportDatabaseUrl) {
  throw new Error('SUPPORT_DATABASE_URL or SUPPORT_DB_URL must be configured');
}

const supportSequelize = new Sequelize(supportDatabaseUrl, {
  dialect: 'postgres',
  dialectModule: require('pg'),
  logging: false,
});

supportSequelize
  .authenticate()
  .then(() => {
    console.log('✅ Support PostgreSQL Database connected successfully');
    console.log('📊 Support DB URL:', supportDatabaseUrl?.substring(0, 30) + '...');
  })
  .catch((error) => {
    console.error('❌ Failed to connect to Support Database:', error);
  });

module.exports = supportSequelize;
