const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();

module.exports = { JWT_SECRET };
