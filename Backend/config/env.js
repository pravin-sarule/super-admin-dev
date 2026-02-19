// Load .env for other vars; JWT_SECRET forced so sign/verify always match project-wide
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Force this secret everywhere (login sign + all route verify) - single source, no override
const JWT_SECRET = '4e14aa06e9fc8bc7a4140949f711bdf89b7f600942d2cbfad513f87d11af02cc';

module.exports = { JWT_SECRET };
