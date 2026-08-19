const { Pool } = require('pg');
require('dotenv').config();

/**
 * Citation Analytics cost DB (citationTest) — backs the Citation Analytics tab ONLY.
 *
 * Deliberately separate from config/citationDB.js (CITATION_DB_URL → citation_db), which
 * serves the Overview / HITL Queue / Data Pipeline / Routes & DB / Business Metrics tabs.
 * Those tables live only in citation_db, so CITATION_DB_URL must never be repointed here.
 *
 * Like citationDB.js this connects lazily and never process.exit()s — a cost DB outage
 * must not take down the admin API.
 */
const url = process.env.CITATION_ANALYTICS_DB_URL;

let citationAnalyticsPool;

if (!url) {
    // Export a stub rather than a Pool with an undefined connection string: pg would
    // otherwise fall back to libpq defaults and spew connection noise on every query.
    console.warn(
        '⚠️  CITATION_ANALYTICS_DB_URL not set — Citation Analytics will report COST_DB_NOT_CONFIGURED'
    );
    const notConfigured = () => {
        const err = new Error('CITATION_ANALYTICS_DB_URL is not configured');
        err.code = 'COST_DB_NOT_CONFIGURED';
        err.statusCode = 503;
        return Promise.reject(err);
    };
    citationAnalyticsPool = {
        configured: false,
        query: notConfigured,
        connect: notConfigured,
        end: async () => {},
        on: () => {},
    };
} else {
    // max:5 — one polling dashboard tab must not starve the shared instance.
    citationAnalyticsPool = new Pool({ connectionString: url, max: 5 });
    citationAnalyticsPool.configured = true;

    citationAnalyticsPool.on('error', (err) => {
        console.error('❌ Unexpected error on Citation Analytics DB client:', err);
    });

    console.log('💰 Citation Analytics cost DB pool created (lazy connect via CITATION_ANALYTICS_DB_URL)');
}

module.exports = citationAnalyticsPool;
