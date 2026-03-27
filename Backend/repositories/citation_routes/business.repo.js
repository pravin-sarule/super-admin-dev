const logger = require('../../config/logger');

class BusinessRepo {
    constructor(pool) {
        this.pool = pool;
    }

    async getSummary(requestId) {
        const start = Date.now();
        logger.debug('Executing business summary query', { requestId, layer: 'BUSINESS_REPO' });

        const result = await this.pool.query(`
      SELECT
        COUNT(*)::int AS total_reports,
        ROUND(AVG(citation_count)::numeric, 2) AS avg_citations_per_report
      FROM citation_reports
    `);

        logger.info('Business summary query completed', { requestId, layer: 'BUSINESS_REPO', durationMs: Date.now() - start });
        return result.rows[0];
    }

    async getReportsPerDay(days, requestId) {
        const start = Date.now();
        logger.debug(`Executing reports per day query (${days} days)`, { requestId, layer: 'BUSINESS_REPO' });

        const result = await this.pool.query(`
      SELECT created_at::date AS date, COUNT(*)::int AS report_count
      FROM citation_reports
      WHERE created_at >= NOW() - INTERVAL '1 day' * $1
      GROUP BY created_at::date
      ORDER BY date DESC
    `, [days]);

        logger.info('Reports per day query completed', { requestId, layer: 'BUSINESS_REPO', durationMs: Date.now() - start });
        return result.rows;
    }

    async getTopUsers(limit, requestId) {
        const start = Date.now();
        logger.debug('Executing top users query', { requestId, layer: 'BUSINESS_REPO' });

        const result = await this.pool.query(`
      SELECT
        user_id,
        COUNT(*)::int AS total_reports,
        COALESCE(SUM(citation_count), 0)::int AS total_citations
      FROM citation_reports
      WHERE user_id IS NOT NULL
      GROUP BY user_id
      ORDER BY total_reports DESC
      LIMIT $1
    `, [limit]);

        logger.info('Top users query completed', { requestId, layer: 'BUSINESS_REPO', durationMs: Date.now() - start });
        return result.rows;
    }
}

module.exports = BusinessRepo;
