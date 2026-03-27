/**
 * Repo for citation_service_usage analytics.
 * Event time: prefer used_at (live schema), fall back to created_at (older migrations).
 */
const EVENT_TIME = 'COALESCE(citation_service_usage.used_at, citation_service_usage.created_at)';

/** Merge India Kanoon API name variants into one analytics bucket */
const CANONICAL_SERVICE = `(CASE
  WHEN LOWER(TRIM(service)) IN (
    'indian_kanoon', 'india_kanoon', 'indiakanoon',
    'india_kanoon_api', 'indian_kanoon_api',
    'inidia_kanoon'
  ) THEN 'india_kanoon'
  ELSE LOWER(TRIM(service))
END)`;

class AnalyticsRepo {
  constructor(pool) {
    this.pool = pool;
  }

  async getUsageByService() {
    const query = `
      SELECT
        ${CANONICAL_SERVICE} AS service,
        COALESCE(SUM(quantity), 0)::bigint AS total_quantity,
        MAX(unit) AS unit_summary,
        COALESCE(SUM(cost_inr), 0)::numeric(14,4) AS total_cost_inr,
        COALESCE(SUM(cost_usd), 0)::numeric(14,6) AS total_cost_usd
      FROM citation_service_usage
      GROUP BY ${CANONICAL_SERVICE}
      ORDER BY total_cost_inr DESC NULLS LAST
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async getUsageByUser(limit = 100) {
    const query = `
      SELECT
        user_id,
        COALESCE(SUM(quantity), 0)::bigint AS total_quantity,
        MAX(unit) AS unit_summary,
        COALESCE(SUM(cost_inr), 0)::numeric(14,4) AS total_cost_inr,
        COALESCE(SUM(cost_usd), 0)::numeric(14,6) AS total_cost_usd,
        COUNT(*)::int AS record_count,
        MAX(${EVENT_TIME}) AS last_used_at,
        MAX(NULLIF(TRIM(username), '')) AS usage_username,
        ARRAY_AGG(DISTINCT ${CANONICAL_SERVICE}) FILTER (WHERE service IS NOT NULL) AS services_used
      FROM citation_service_usage
      GROUP BY user_id
      ORDER BY total_cost_inr DESC NULLS LAST
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  async getTotalPlatformCost() {
    const query = `
      SELECT
        COALESCE(SUM(cost_inr), 0)::numeric(14,4) AS total_cost_inr,
        COALESCE(SUM(cost_usd), 0)::numeric(14,6) AS total_cost_usd,
        COALESCE(SUM(quantity), 0)::bigint AS total_quantity,
        COUNT(*)::int AS total_records
      FROM citation_service_usage
    `;
    const result = await this.pool.query(query);
    return result.rows[0];
  }

  async getUsageRecords(limit = 200, offset = 0) {
    const query = `
      SELECT
        id,
        run_id,
        user_id,
        username,
        service,
        operation,
        quantity,
        unit,
        cost_inr,
        cost_usd,
        metadata,
        usage_time_ms,
        ${EVENT_TIME} AS created_at
      FROM citation_service_usage
      ORDER BY ${EVENT_TIME} DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `;
    const result = await this.pool.query(query, [limit, offset]);
    return result.rows;
  }

  async getUsageRecordsCount() {
    const result = await this.pool.query(
      'SELECT COUNT(*)::int AS total FROM citation_service_usage'
    );
    return result.rows[0]?.total ?? 0;
  }

  async getUserTotals(userId) {
    const query = `
      SELECT
        user_id,
        COALESCE(SUM(quantity), 0)::bigint AS total_quantity,
        COALESCE(SUM(cost_inr), 0)::numeric(14,4) AS total_cost_inr,
        COALESCE(SUM(cost_usd), 0)::numeric(14,6) AS total_cost_usd,
        COUNT(*)::int AS record_count,
        MAX(${EVENT_TIME}) AS last_used_at,
        MAX(NULLIF(TRIM(username), '')) AS usage_username
      FROM citation_service_usage
      WHERE user_id = $1
      GROUP BY user_id
    `;
    const result = await this.pool.query(query, [String(userId)]);
    return result.rows[0] || null;
  }

  async getUserServiceBreakdown(userId) {
    const query = `
      SELECT
        ${CANONICAL_SERVICE} AS service,
        COALESCE(SUM(quantity), 0)::bigint AS total_quantity,
        MAX(unit) AS unit_summary,
        COALESCE(SUM(cost_inr), 0)::numeric(14,4) AS total_cost_inr,
        COALESCE(SUM(cost_usd), 0)::numeric(14,6) AS total_cost_usd,
        COUNT(*)::int AS record_count,
        MAX(${EVENT_TIME}) AS last_used_at
      FROM citation_service_usage
      WHERE user_id = $1
      GROUP BY ${CANONICAL_SERVICE}
      ORDER BY total_cost_inr DESC NULLS LAST
    `;
    const result = await this.pool.query(query, [String(userId)]);
    return result.rows;
  }

  async getUserTimeline(userId, limit = 200) {
    const query = `
      SELECT
        id,
        run_id,
        user_id,
        username,
        ${CANONICAL_SERVICE} AS service,
        operation,
        quantity,
        unit,
        cost_inr,
        cost_usd,
        metadata,
        usage_time_ms,
        ${EVENT_TIME} AS created_at
      FROM citation_service_usage
      WHERE user_id = $1
      ORDER BY ${EVENT_TIME} DESC NULLS LAST
      LIMIT $2
    `;
    const result = await this.pool.query(query, [String(userId), limit]);
    return result.rows;
  }

  async heartbeat() {
    await this.pool.query('SELECT 1 FROM citation_service_usage LIMIT 1');
    return { ok: true };
  }
}

module.exports = AnalyticsRepo;
