const logger = require('../../config/logger');

class PipelineRepo {
    constructor(pool) {
        this.pool = pool;
    }

    async getSummary(requestId) {
        const start = Date.now();
        logger.debug('Executing pipeline summary query', { requestId, layer: 'PIPELINE_REPO' });

        const result = await this.pool.query(`
      SELECT status, COUNT(*)::int AS count
      FROM ingestion_queue
      GROUP BY status
      ORDER BY status
    `);

        logger.info('Pipeline summary query completed', { requestId, layer: 'PIPELINE_REPO', durationMs: Date.now() - start });
        return result.rows;
    }

    async listItems({ status, source, startDate, endDate, hasError, limit, offset }, requestId) {
        const start = Date.now();
        logger.debug('Listing pipeline items', { requestId, layer: 'PIPELINE_REPO' });

        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (status) {
            conditions.push(`status = $${paramIdx++}`);
            params.push(status);
        }
        if (source) {
            conditions.push(`source = $${paramIdx++}`);
            params.push(source);
        }
        if (startDate) {
            conditions.push(`queued_at >= $${paramIdx++}`);
            params.push(startDate);
        }
        if (endDate) {
            conditions.push(`queued_at <= $${paramIdx++}`);
            params.push(endDate);
        }
        if (hasError === 'true') {
            conditions.push(`error_message IS NOT NULL AND error_message != ''`);
        } else if (hasError === 'false') {
            conditions.push(`(error_message IS NULL OR error_message = '')`);
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countResult = await this.pool.query(
            `SELECT COUNT(*)::int AS total FROM ingestion_queue ${where}`, params
        );

        const dataResult = await this.pool.query(
            `SELECT queue_id, canonical_id, source, priority, status, queued_at, processed_at, error_message
       FROM ingestion_queue
       ${where}
       ORDER BY queued_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...params, limit, offset]
        );

        logger.info('Pipeline items query completed', { requestId, layer: 'PIPELINE_REPO', durationMs: Date.now() - start });

        return {
            rows: dataResult.rows,
            totalCount: countResult.rows[0].total,
        };
    }

    async getRecentErrors(limit, requestId) {
        const start = Date.now();
        logger.debug('Fetching recent pipeline errors', { requestId, layer: 'PIPELINE_REPO' });

        const result = await this.pool.query(
            `SELECT queue_id, canonical_id, source, status, error_message, queued_at, processed_at
       FROM ingestion_queue
       WHERE error_message IS NOT NULL AND error_message != ''
       ORDER BY processed_at DESC NULLS LAST, queued_at DESC
       LIMIT $1`,
            [limit]
        );

        logger.info('Pipeline errors query completed', { requestId, layer: 'PIPELINE_REPO', durationMs: Date.now() - start });
        return result.rows;
    }
}

module.exports = PipelineRepo;
