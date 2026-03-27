const logger = require('../../config/logger');

class RoutesdbRepo {
  constructor(pool) {
    this.pool = pool;
  }

  async getSummary(requestId) {
    const start = Date.now();
    logger.debug('Executing routesdb summary query', { requestId, layer: 'ROUTESDB_REPO' });

    // Actual verification_status values in DB: 'VERIFIED', 'VERIFIED_WARN', 'pending'
    const result = await this.pool.query(`
      SELECT
        (SELECT COUNT(*) FROM judgments)::int AS total_judgments,
        (SELECT COUNT(*) FROM citation_aliases)::int AS total_aliases,
        (SELECT COUNT(*) FROM statutes_cited)::int AS total_statutes_rows,
        (SELECT COUNT(*) FROM judgments WHERE verification_status IN ('VERIFIED', 'VERIFIED_WARN'))::int AS verified_count,
        (SELECT COUNT(*) FROM judgments WHERE verification_status NOT IN ('VERIFIED', 'VERIFIED_WARN'))::int AS unverified_count
    `);

    logger.info('Routesdb summary query completed', { requestId, layer: 'ROUTESDB_REPO', durationMs: Date.now() - start });
    return result.rows[0];
  }

  async getVerificationBreakdown(requestId) {
    const start = Date.now();
    logger.debug('Executing verification breakdown query', { requestId, layer: 'ROUTESDB_REPO' });

    const result = await this.pool.query(`
      SELECT COALESCE(verification_status, 'unknown') AS status, COUNT(*)::int AS count
      FROM judgments
      GROUP BY verification_status
      ORDER BY count DESC
    `);

    logger.info('Verification breakdown query completed', { requestId, layer: 'ROUTESDB_REPO', durationMs: Date.now() - start });
    return result.rows;
  }

  async getTopCited(limit, requestId) {
    const start = Date.now();
    logger.debug('Executing top cited query', { requestId, layer: 'ROUTESDB_REPO' });

    const result = await this.pool.query(`
      SELECT judgment_uuid, canonical_id, citation_frequency, court_code, court_tier, verification_status
      FROM judgments
      WHERE citation_frequency IS NOT NULL
      ORDER BY citation_frequency DESC
      LIMIT $1
    `, [limit]);

    logger.info('Top cited query completed', { requestId, layer: 'ROUTESDB_REPO', durationMs: Date.now() - start });
    return result.rows;
  }

  async getCourtsBreakdown(requestId) {
    const start = Date.now();
    logger.debug('Executing courts breakdown query', { requestId, layer: 'ROUTESDB_REPO' });

    const result = await this.pool.query(`
      SELECT
        COALESCE(court_tier, 'unknown') AS court_tier,
        COALESCE(court_code, 'unknown') AS court_code,
        COUNT(*)::int AS count
      FROM judgments
      GROUP BY court_tier, court_code
      ORDER BY count DESC
    `);

    logger.info('Courts breakdown query completed', { requestId, layer: 'ROUTESDB_REPO', durationMs: Date.now() - start });
    return result.rows;
  }
}

module.exports = RoutesdbRepo;
