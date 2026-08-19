/**
 * Repo for citation_usage_events (citationTest / CITATION_ANALYTICS_DB_URL).
 *
 * Reads the v_citation_usage_events view, which defines `service_canonical` (the India
 * Kanoon alias merge) and `user_key` (the '' / NULL -> 'unknown' bucket) in ONE place.
 *
 * Every query is scoped by an IST date range. Dates arrive as 'YYYY-MM-DD' and the range
 * is half-open — [from 00:00 IST, to+1 day 00:00 IST) — so nothing after `to 00:00` is
 * silently dropped, and the predicate stays sargable against idx_cue_occurred.
 */
const SRC = 'v_citation_usage_events';
const EVENT_TIME = 'occurred_at';

class AnalyticsRepo {
    constructor(pool) {
        this.pool = pool;
    }

    /**
     * Build the shared WHERE clause.
     * @param {{from:string,to:string,userIds?:string[]|null,excludeUserIds?:string[]|null}} f
     * @param {number} startIdx - first positional parameter index to use
     * @returns {{clause:string, params:any[], nextIdx:number}}
     */
    _where(f, startIdx = 1) {
        const conds = [];
        const params = [];
        let i = startIdx;

        conds.push(`${EVENT_TIME} >= ($${i}::date AT TIME ZONE 'Asia/Kolkata')`);
        params.push(f.from);
        i += 1;

        conds.push(`${EVENT_TIME} < (($${i}::date + 1) AT TIME ZONE 'Asia/Kolkata')`);
        params.push(f.to);
        i += 1;

        if (Array.isArray(f.userIds)) {
            conds.push(`user_key = ANY($${i}::text[])`);
            params.push(f.userIds);
            i += 1;
        }
        if (Array.isArray(f.excludeUserIds) && f.excludeUserIds.length) {
            conds.push(`NOT (user_key = ANY($${i}::text[]))`);
            params.push(f.excludeUserIds);
            i += 1;
        }

        return { clause: `WHERE ${conds.join(' AND ')}`, params, nextIdx: i };
    }

    /** Score cards: one row per canonical service. */
    async getUsageByService(f) {
        const { clause, params } = this._where(f);
        const query = `
      SELECT
        service_canonical AS service,
        COALESCE(SUM(quantity), 0)::bigint AS total_quantity,
        COALESCE(SUM(calls), 0)::bigint AS total_calls,
        (ARRAY_AGG(unit ORDER BY calls DESC NULLS LAST))[1] AS unit_summary,
        COALESCE(SUM(cost_inr), 0)::numeric(18,6) AS total_cost_inr,
        COALESCE(SUM(cost_usd), 0)::numeric(18,8) AS total_cost_usd,
        COUNT(*)::int AS record_count,
        MAX(${EVENT_TIME}) AS last_used_at
      FROM ${SRC}
      ${clause}
      GROUP BY service_canonical
      ORDER BY total_cost_inr DESC NULLS LAST
    `;
        const result = await this.pool.query(query, params);
        return result.rows;
    }

    /** Platform-wide totals for the same range/department scope. */
    async getTotalPlatformCost(f) {
        const { clause, params } = this._where(f);
        const query = `
      SELECT
        COALESCE(SUM(cost_inr), 0)::numeric(18,6) AS total_cost_inr,
        COALESCE(SUM(cost_usd), 0)::numeric(18,8) AS total_cost_usd,
        COALESCE(SUM(quantity), 0)::bigint AS total_quantity,
        COALESCE(SUM(calls), 0)::bigint AS total_calls,
        COUNT(*)::int AS total_records,
        COUNT(*) FILTER (WHERE success = FALSE)::int AS failed_records,
        COUNT(*) FILTER (WHERE cost_source = 'unpriced')::int AS unpriced_records,
        COUNT(DISTINCT user_key)::int AS distinct_users,
        COUNT(DISTINCT session_id)::int AS distinct_sessions,
        MIN(${EVENT_TIME}) AS first_event_at,
        MAX(${EVENT_TIME}) AS last_event_at
      FROM ${SRC}
      ${clause}
    `;
        const result = await this.pool.query(query, params);
        return result.rows[0];
    }

    /** Total distinct users in scope — drives server-side pagination. */
    async getUsageByUserCount(f) {
        const { clause, params } = this._where(f);
        const result = await this.pool.query(
            `SELECT COUNT(DISTINCT user_key)::int AS total FROM ${SRC} ${clause}`,
            params
        );
        return result.rows[0]?.total ?? 0;
    }

    /**
     * One page of the user breakdown.
     * ORDER BY carries a `user_key ASC` tiebreak — without a total order, rows repeat or
     * vanish across pages whenever two users tie on cost.
     */
    async getUsageByUser(f, { limit = 20, offset = 0 } = {}) {
        const { clause, params, nextIdx } = this._where(f);
        const query = `
      SELECT
        user_key AS user_id,
        COALESCE(SUM(quantity), 0)::bigint AS total_quantity,
        COALESCE(SUM(calls), 0)::bigint AS total_calls,
        (ARRAY_AGG(unit ORDER BY calls DESC NULLS LAST))[1] AS unit_summary,
        COALESCE(SUM(cost_inr), 0)::numeric(18,6) AS total_cost_inr,
        COALESCE(SUM(cost_usd), 0)::numeric(18,8) AS total_cost_usd,
        COUNT(*)::int AS record_count,
        MAX(${EVENT_TIME}) AS last_used_at,
        ARRAY_AGG(DISTINCT service_canonical ORDER BY service_canonical) AS services_used
      FROM ${SRC}
      ${clause}
      GROUP BY user_key
      ORDER BY total_cost_inr DESC NULLS LAST, user_key ASC
      LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
    `;
        const result = await this.pool.query(query, [...params, limit, offset]);
        return result.rows;
    }

    async getUserTotals(userId, f) {
        const { clause, params, nextIdx } = this._where(f);
        const query = `
      SELECT
        user_key AS user_id,
        COALESCE(SUM(quantity), 0)::bigint AS total_quantity,
        COALESCE(SUM(calls), 0)::bigint AS total_calls,
        COALESCE(SUM(cost_inr), 0)::numeric(18,6) AS total_cost_inr,
        COALESCE(SUM(cost_usd), 0)::numeric(18,8) AS total_cost_usd,
        COUNT(*)::int AS record_count,
        MAX(${EVENT_TIME}) AS last_used_at
      FROM ${SRC}
      ${clause} AND user_key = $${nextIdx}
      GROUP BY user_key
    `;
        const result = await this.pool.query(query, [...params, String(userId)]);
        return result.rows[0] || null;
    }

    async getUserServiceBreakdown(userId, f) {
        const { clause, params, nextIdx } = this._where(f);
        const query = `
      SELECT
        service_canonical AS service,
        COALESCE(SUM(quantity), 0)::bigint AS total_quantity,
        COALESCE(SUM(calls), 0)::bigint AS total_calls,
        (ARRAY_AGG(unit ORDER BY calls DESC NULLS LAST))[1] AS unit_summary,
        COALESCE(SUM(cost_inr), 0)::numeric(18,6) AS total_cost_inr,
        COALESCE(SUM(cost_usd), 0)::numeric(18,8) AS total_cost_usd,
        COUNT(*)::int AS record_count,
        MAX(${EVENT_TIME}) AS last_used_at
      FROM ${SRC}
      ${clause} AND user_key = $${nextIdx}
      GROUP BY service_canonical
      ORDER BY total_cost_inr DESC NULLS LAST
    `;
        const result = await this.pool.query(query, [...params, String(userId)]);
        return result.rows;
    }

    /**
     * Recent raw events for the drill-down modal.
     * Aliases (`created_at`, `operation`, `usage_time_ms`) are chosen so the existing
     * modal JSX renders unchanged.
     */
    async getUserTimeline(userId, f, limit = 200) {
        const { clause, params, nextIdx } = this._where(f);
        const query = `
      SELECT
        id,
        run_id,
        session_id,
        doc_id,
        user_key AS user_id,
        service_canonical AS service,
        operation,
        stage,
        model,
        quantity,
        unit,
        calls,
        input_tokens,
        output_tokens,
        cached_tokens,
        cost_inr,
        cost_usd,
        cost_source,
        rate_version,
        success,
        error_code,
        metadata,
        usage_time_ms,
        ${EVENT_TIME} AS created_at
      FROM ${SRC}
      ${clause} AND user_key = $${nextIdx}
      ORDER BY ${EVENT_TIME} DESC
      LIMIT $${nextIdx + 1}
    `;
        const result = await this.pool.query(query, [...params, String(userId), limit]);
        return result.rows;
    }

    // ------------------------------------------------------------------ sessions

    /**
     * Total distinct RUNS in scope — drives pagination.
     *
     * A session_id spans the whole user session and accumulates many searches, so grouping
     * by session alone collapses every run into one row. The grouping key is
     * (session_id, run_id); rows with no run_id (e.g. the costLedger backfill, which is a
     * session-level snapshot) collapse to a single row per session, which is correct.
     */
    async getSessionsCount(f) {
        const { clause, params } = this._where(f);
        const result = await this.pool.query(
            `SELECT COUNT(*)::int AS total FROM (
               SELECT 1 FROM ${SRC} ${clause} AND session_id IS NOT NULL
                GROUP BY session_id, run_id
             ) g`,
            params
        );
        return result.rows[0]?.total ?? 0;
    }

    /**
     * One page of run rows. The AI / API split mirrors the engine's terminal report:
     * "AI subtotal" = LLM providers, "IK subtotal" = the metered HTTP APIs.
     */
    async getSessions(f, { limit = 10, offset = 0 } = {}) {
        const { clause, params, nextIdx } = this._where(f);
        const query = `
      SELECT
        session_id,
        run_id,
        MAX(user_key)  AS user_id,
        MAX(case_id)   AS case_id,
        COUNT(*)::int                AS event_count,
        COALESCE(SUM(calls), 0)::bigint          AS total_calls,
        COALESCE(SUM(input_tokens), 0)::bigint   AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint  AS output_tokens,
        COUNT(*) FILTER (WHERE cache_hit)::int   AS cache_hits,
        COALESCE(SUM(cost_inr) FILTER (WHERE provider IN ('gemini','claude','openai')), 0)::numeric(18,6) AS ai_cost_inr,
        COALESCE(SUM(cost_inr) FILTER (WHERE provider NOT IN ('gemini','claude','openai')), 0)::numeric(18,6) AS api_cost_inr,
        COALESCE(SUM(cost_inr), 0)::numeric(18,6) AS total_cost_inr,
        COALESCE(SUM(cost_usd), 0)::numeric(18,8) AS total_cost_usd,
        COUNT(*) FILTER (WHERE cost_source = 'unpriced')::int AS unpriced_count,
        ARRAY_AGG(DISTINCT service_canonical ORDER BY service_canonical) AS services_used,
        MIN(${EVENT_TIME}) AS started_at,
        MAX(${EVENT_TIME}) AS last_event_at
      FROM ${SRC}
      ${clause} AND session_id IS NOT NULL
      GROUP BY session_id, run_id
      ORDER BY MAX(${EVENT_TIME}) DESC, session_id ASC, run_id ASC NULLS FIRST
      LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
    `;
        const result = await this.pool.query(query, [...params, limit, offset]);
        return result.rows;
    }

    /**
     * Scope a drill-down to one run when runId is given, else the whole session.
     * `$2 IS NULL` means "all runs"; an explicit run id (including the string 'null' for
     * rows that genuinely have no run_id) narrows to that run.
     */
    _runScope(runId, idx = 2) {
        return runId === undefined || runId === null
            ? { sql: '', param: [] }
            : { sql: ` AND COALESCE(run_id, '') = $${idx}`, param: [String(runId)] };
    }

    /** Run/session header totals — no date filter: a run is billed whole. */
    async getSessionTotals(sessionId, runId) {
        const scope = this._runScope(runId);
        const query = `
      SELECT
        session_id,
        MAX(run_id)   AS run_id,
        MAX(user_key) AS user_id,
        MAX(case_id)  AS case_id,
        COUNT(*)::int                AS event_count,
        COALESCE(SUM(calls), 0)::bigint          AS total_calls,
        COALESCE(SUM(input_tokens), 0)::bigint   AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint  AS output_tokens,
        COALESCE(SUM(cached_tokens), 0)::bigint  AS cached_tokens,
        COUNT(*) FILTER (WHERE cache_hit)::int   AS cache_hits,
        COUNT(*) FILTER (WHERE success = FALSE)::int AS failed_count,
        COUNT(*) FILTER (WHERE cost_source = 'unpriced')::int AS unpriced_count,
        COUNT(*) FILTER (WHERE cost_source = 'producer')::int  AS producer_priced_count,
        COALESCE(SUM(cost_inr) FILTER (WHERE provider IN ('gemini','claude','openai')), 0)::numeric(18,6) AS ai_cost_inr,
        COALESCE(SUM(cost_inr) FILTER (WHERE provider NOT IN ('gemini','claude','openai')), 0)::numeric(18,6) AS api_cost_inr,
        COALESCE(SUM(cost_inr), 0)::numeric(18,6) AS total_cost_inr,
        COALESCE(SUM(cost_usd), 0)::numeric(18,8) AS total_cost_usd,
        COALESCE(SUM(producer_cost_inr), 0)::numeric(18,6) AS producer_cost_inr,
        MIN(${EVENT_TIME}) AS started_at,
        MAX(${EVENT_TIME}) AS last_event_at
      FROM ${SRC}
      WHERE session_id = $1${scope.sql}
      GROUP BY session_id
    `;
        const result = await this.pool.query(query, [String(sessionId), ...scope.param]);
        return result.rows[0] || null;
    }

    /**
     * LLM lines for a session — one row per (agent, model), matching the engine's
     * "Task / agent | Model | Calls | Tokens in | Tokens out | Cost INR" table.
     */
    async getSessionLlmBreakdown(sessionId, runId) {
        const scope = this._runScope(runId);
        const query = `
      SELECT
        operation,
        MIN(stage) AS stage,
        model,
        provider,
        service_canonical AS service,
        COALESCE(SUM(calls), 0)::bigint         AS calls,
        COALESCE(SUM(input_tokens), 0)::bigint  AS input_tokens,
        COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
        COALESCE(SUM(cached_tokens), 0)::bigint AS cached_tokens,
        COALESCE(SUM(cost_inr), 0)::numeric(18,6) AS cost_inr,
        COALESCE(SUM(cost_usd), 0)::numeric(18,8) AS cost_usd,
        COALESCE(SUM(producer_cost_inr), 0)::numeric(18,6) AS producer_cost_inr,
        MIN(rate_version) AS rate_version,
        MIN(cost_source)  AS cost_source
      FROM ${SRC}
      WHERE session_id = $1 AND unit = 'tokens'${scope.sql}
      GROUP BY operation, model, provider, service_canonical
      ORDER BY cost_inr DESC
    `;
        const result = await this.pool.query(query, [String(sessionId), ...scope.param]);
        return result.rows;
    }

    /**
     * Metered API lines for a session (India Kanoon, Serper, Document AI, grounding) —
     * one row per operation, with the effective per-unit rate derived from the cost.
     */
    async getSessionApiBreakdown(sessionId, runId) {
        const scope = this._runScope(runId);
        const query = `
      SELECT
        provider,
        service_canonical AS service,
        operation,
        unit,
        COALESCE(SUM(calls), 0)::bigint AS calls,
        COALESCE(SUM(quantity), 0)::bigint AS quantity,
        COUNT(*) FILTER (WHERE cache_hit)::int AS cache_hits,
        COALESCE(SUM(cost_inr), 0)::numeric(18,6) AS cost_inr,
        COALESCE(SUM(cost_usd), 0)::numeric(18,8) AS cost_usd,
        CASE WHEN SUM(calls) FILTER (WHERE NOT cache_hit) > 0
             THEN (SUM(cost_inr) / SUM(calls) FILTER (WHERE NOT cache_hit))::numeric(18,4)
             ELSE 0 END AS unit_rate_inr,
        MIN(rate_version) AS rate_version,
        MIN(cost_source)  AS cost_source
      FROM ${SRC}
      WHERE session_id = $1 AND unit <> 'tokens'${scope.sql}
      GROUP BY 1, 2, 3, 4
      ORDER BY cost_inr DESC
    `;
        const result = await this.pool.query(query, [String(sessionId), ...scope.param]);
        return result.rows;
    }

    /** Raw call log for the drill-down. */
    async getSessionTimeline(sessionId, runId, limit = 300) {
        const scope = this._runScope(runId);
        const query = `
      SELECT
        id, run_id, step_no, doc_id,
        provider, service_canonical AS service,
        operation, stage, model, unit,
        quantity, calls, input_tokens, output_tokens, cached_tokens, cache_hit,
        cost_inr, cost_usd, cost_source, rate_version,
        success, error_code, usage_time_ms,
        ${EVENT_TIME} AS occurred_at
      FROM ${SRC}
      WHERE session_id = $1${this._runScope(runId, 3).sql}
      ORDER BY ${EVENT_TIME} ASC, id ASC
      LIMIT $2
    `;
        const result = await this.pool.query(query, [
            String(sessionId),
            limit,
            ...this._runScope(runId, 3).param,
        ]);
        return result.rows;
    }

    /** One page of the CSV export — same shape as the user breakdown. */
    async getExportUsersPage(f, { limit = 1000, offset = 0 } = {}) {
        return this.getUsageByUser(f, { limit, offset });
    }

    /**
     * One page of raw events for the finance-grade CSV.
     * ORDER BY carries an `id ASC` tiebreak so LIMIT/OFFSET paging is stable.
     */
    async getExportEventsPage(f, { limit = 1000, offset = 0 } = {}) {
        const { clause, params, nextIdx } = this._where(f);
        const query = `
      SELECT
        ${EVENT_TIME} AS occurred_at,
        session_id, run_id, user_key AS user_id, doc_id,
        provider, service_canonical AS service, operation, stage, model,
        unit, quantity, calls, input_tokens, output_tokens, cached_tokens, cache_hit,
        cost_inr, cost_usd, cost_source, rate_version,
        success, error_code, usage_time_ms
      FROM ${SRC}
      ${clause}
      ORDER BY ${EVENT_TIME} ASC, id ASC
      LIMIT $${nextIdx} OFFSET $${nextIdx + 1}
    `;
        const result = await this.pool.query(query, [...params, limit, offset]);
        return result.rows;
    }

    /** Liveness + ingestion-lag signal (two clocks: producer vs admin). */
    async heartbeat() {
        const result = await this.pool.query(`
      SELECT
        MAX(occurred_at) AS last_event_at,
        MAX(created_at)  AS last_ingest_at,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS ingested_last_hour,
        COUNT(*)::bigint AS total_events
      FROM citation_usage_events
    `);
        return { ok: true, ...(result.rows[0] || {}) };
    }
}

module.exports = AnalyticsRepo;
