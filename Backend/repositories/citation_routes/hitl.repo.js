const logger = require('../../config/logger');

class HitlRepo {
    constructor(pool) {
        this.pool = pool;
    }

    async listTasks({ status, limit, offset, sort }, requestId) {
        const start = Date.now();
        logger.debug('Listing HITL tasks', { requestId, layer: 'HITL_REPO' });

        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (status) {
            conditions.push(`LOWER(status) = LOWER($${paramIdx++})`);
            params.push(status);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        let orderBy = 'ORDER BY priority_score DESC, created_at DESC';
        if (sort === 'created_at_desc') orderBy = 'ORDER BY created_at DESC';
        if (sort === 'created_at_asc') orderBy = 'ORDER BY created_at ASC';
        if (sort === 'priority_asc') orderBy = 'ORDER BY priority_score ASC, created_at DESC';

        const countQuery = `SELECT COUNT(*)::int AS total FROM hitl_queue ${where}`;
        const countResult = await this.pool.query(countQuery, params);

        const dataQuery = `
      SELECT task_id, citation_string, canonical_id, query_context, web_source_url,
             priority_score, status, created_at, report_id, run_id, case_id, user_id,
             reason_queued, reviewed_at, reviewed_by, updated_at
      FROM hitl_queue
      ${where}
      ${orderBy}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
        params.push(limit, offset);
        const dataResult = await this.pool.query(dataQuery, params);

        logger.info('HITL list query completed', { requestId, layer: 'HITL_REPO', durationMs: Date.now() - start });

        return {
            rows: dataResult.rows,
            totalCount: countResult.rows[0].total,
        };
    }

    async getTaskById(taskId, requestId) {
        const start = Date.now();
        logger.debug(`Fetching HITL task ${taskId}`, { requestId, layer: 'HITL_REPO' });

        const result = await this.pool.query(
            `SELECT * FROM hitl_queue WHERE task_id = $1`,
            [taskId]
        );

        logger.info('HITL task detail query completed', { requestId, layer: 'HITL_REPO', durationMs: Date.now() - start });
        return result.rows[0] || null;
    }

    async updateTaskStatus(taskId, status, requestId) {
        const start = Date.now();
        logger.debug(`Updating HITL task ${taskId} status to ${status}`, { requestId, layer: 'HITL_REPO' });

        const result = await this.pool.query(
            `UPDATE hitl_queue SET status = $1 WHERE task_id = $2 RETURNING *`,
            [status, taskId]
        );

        logger.info('HITL task status updated', { requestId, layer: 'HITL_REPO', durationMs: Date.now() - start });
        return result.rows[0] || null;
    }

    async insertBlacklist({ citation_string, reason }, requestId) {
        const start = Date.now();
        logger.debug('Inserting into citation_blacklist', { requestId, layer: 'HITL_REPO' });

        // Actual table: citation_blacklist with columns: id, normalized_key, reason, created_at
        const normalizedKey = (citation_string || '').toLowerCase().trim();
        const result = await this.pool.query(
            `INSERT INTO citation_blacklist (normalized_key, reason)
       VALUES ($1, $2)
       ON CONFLICT (normalized_key) DO UPDATE SET reason = EXCLUDED.reason
       RETURNING *`,
            [normalizedKey, reason || '']
        );

        logger.info('Blacklist insert completed', { requestId, layer: 'HITL_REPO', durationMs: Date.now() - start });
        return result.rows[0];
    }
}

module.exports = HitlRepo;
