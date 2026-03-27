const logger = require('../../config/logger');

class OverviewRepo {
  constructor(pool) {
    this.pool = pool;
  }

  async getOverviewStats(todayStart, requestId) {
    const start = Date.now();
    logger.debug('Executing overview stats query', { requestId, layer: 'OVERVIEW_REPO' });

    // Real verification_status values in DB: 'VERIFIED', 'VERIFIED_WARN', 'pending'
    const query = `
      SELECT
        (SELECT COUNT(*) FROM judgments) AS total_judgments,
        (SELECT COUNT(*) FROM judgments WHERE verification_status IN ('VERIFIED', 'VERIFIED_WARN')) AS verified_judgments_count,
        (SELECT COUNT(*) FROM judgments WHERE verification_status NOT IN ('VERIFIED', 'VERIFIED_WARN')) AS unverified_judgments_count,
        (SELECT ROUND(AVG(confidence_score)::numeric, 4) FROM judgments WHERE confidence_score IS NOT NULL) AS avg_confidence_score,
        (SELECT COUNT(*) FROM hitl_queue WHERE LOWER(status) = 'pending') AS hitl_pending_count,
        (SELECT COUNT(*) FROM citation_blacklist) AS blacklist_count,
        (SELECT COUNT(*) FROM judgments WHERE ingested_at >= $1) AS today_citations_added
    `;

    const result = await this.pool.query(query, [todayStart]);
    logger.info('Overview stats query completed', { requestId, layer: 'OVERVIEW_REPO', durationMs: Date.now() - start });
    return result.rows[0];
  }

  async getIngestionStatusCounts(requestId) {
    const start = Date.now();
    logger.debug('Executing ingestion status counts query', { requestId, layer: 'OVERVIEW_REPO' });

    const query = `
 SELECT status, COUNT(*)::int AS count
 FROM ingestion_queue
 GROUP BY status
 ORDER BY status
 `;

    const result = await this.pool.query(query);
    logger.info('Ingestion status counts query completed', { requestId, layer: 'OVERVIEW_REPO', durationMs: Date.now() - start });
    return result.rows;
  }

  async getConfidenceDistribution(requestId) {
    const start = Date.now();
    logger.debug('Executing confidence distribution query', { requestId, layer: 'OVERVIEW_REPO' });

    const query = `
 SELECT
 COUNT(*) FILTER (WHERE confidence_score >= 0 AND confidence_score < 0.4)::int AS "0-0.4",
 COUNT(*) FILTER (WHERE confidence_score >= 0.4 AND confidence_score < 0.7)::int AS "0.4-0.7",
 COUNT(*) FILTER (WHERE confidence_score >= 0.7 AND confidence_score < 0.9)::int AS "0.7-0.9",
 COUNT(*) FILTER (WHERE confidence_score >= 0.9 AND confidence_score <= 1.0)::int AS "0.9-1.0"
 FROM judgments
 WHERE confidence_score IS NOT NULL
 `;

    const result = await this.pool.query(query);
    logger.info('Confidence distribution query completed', { requestId, layer: 'OVERVIEW_REPO', durationMs: Date.now() - start });
    return result.rows[0];
  }
}

module.exports = OverviewRepo;