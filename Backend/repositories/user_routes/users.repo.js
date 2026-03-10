const logger = require('../../config/logger');

class UsersRepo {
    constructor(pool) {
        this.pool = pool; // Auth DB pool
    }

    async listUsers({ role, approval_status, account_type, search, limit, offset }, requestId) {
        const start = Date.now();
        logger.debug('Listing users', { requestId, layer: 'USER_REPOSITORY' });

        const conditions = [];
        const params = [];
        let paramIdx = 1;

        if (role) {
            conditions.push(`role = $${paramIdx++}`);
            params.push(role);
        }
        if (approval_status) {
            conditions.push(`approval_status = $${paramIdx++}`);
            params.push(approval_status);
        }
        if (account_type) {
            conditions.push(`account_type = $${paramIdx++}`);
            params.push(account_type);
        }
        if (search) {
            conditions.push(`(email ILIKE $${paramIdx} OR username ILIKE $${paramIdx})`);
            params.push(`%${search}%`);
            paramIdx++;
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const countResult = await this.pool.query(
            `SELECT COUNT(*)::int AS total FROM users ${where}`, params
        );

        const dataResult = await this.pool.query(
            `SELECT id, email, username, role, auth_type, profile_image,
              is_blocked, approval_status, account_type, is_active,
              created_at, phone, location
       FROM users
       ${where}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
            [...params, limit, offset]
        );

        logger.info('Users list query completed', { requestId, layer: 'USER_REPOSITORY', durationMs: Date.now() - start });

        return {
            rows: dataResult.rows,
            totalCount: countResult.rows[0].total,
        };
    }

    async getPendingApprovals(requestId) {
        const start = Date.now();
        logger.debug('Fetching pending approvals', { requestId, layer: 'USER_REPOSITORY' });

        const result = await this.pool.query(
            `SELECT id, email, username, role, account_type, approval_status, is_active, created_at, phone, location
       FROM users
       WHERE approval_status = 'PENDING'
       ORDER BY created_at DESC`
        );

        logger.info('Pending approvals query completed', { requestId, layer: 'USER_REPOSITORY', durationMs: Date.now() - start });
        return result.rows;
    }

    async approveUser(userId, requestId) {
        const start = Date.now();
        logger.debug(`Approving user ${userId}`, { requestId, layer: 'USER_REPOSITORY' });

        const result = await this.pool.query(
            `UPDATE users SET approval_status = 'APPROVED', is_active = true WHERE id = $1 RETURNING *`,
            [userId]
        );

        logger.info('User approved', { requestId, layer: 'USER_REPOSITORY', durationMs: Date.now() - start });
        return result.rows[0] || null;
    }

    async blockUser(userId, requestId) {
        const start = Date.now();
        logger.debug(`Blocking user ${userId}`, { requestId, layer: 'USER_REPOSITORY' });

        const result = await this.pool.query(
            `UPDATE users SET is_blocked = true, is_active = false WHERE id = $1 RETURNING *`,
            [userId]
        );

        logger.info('User blocked', { requestId, layer: 'USER_REPOSITORY', durationMs: Date.now() - start });
        return result.rows[0] || null;
    }

    async unblockUser(userId, requestId) {
        const start = Date.now();
        logger.debug(`Unblocking user ${userId}`, { requestId, layer: 'USER_REPOSITORY' });

        const result = await this.pool.query(
            `UPDATE users SET is_blocked = false, is_active = true WHERE id = $1 RETURNING *`,
            [userId]
        );

        logger.info('User unblocked', { requestId, layer: 'USER_REPOSITORY', durationMs: Date.now() - start });
        return result.rows[0] || null;
    }

    async getUserStats(requestId) {
        const start = Date.now();
        logger.debug('Fetching user stats', { requestId, layer: 'USER_REPOSITORY' });

        const result = await this.pool.query(`
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE is_active = true)::int AS active_users,
        COUNT(*) FILTER (WHERE is_blocked = true)::int AS blocked_users,
        COUNT(*) FILTER (WHERE approval_status = 'PENDING')::int AS pending_approvals,
        COUNT(*) FILTER (WHERE account_type = 'FIRM_ADMIN')::int AS firm_admin_count,
        COUNT(*) FILTER (WHERE account_type = 'FIRM_USER')::int AS firm_user_count,
        COUNT(*) FILTER (WHERE account_type = 'SOLO')::int AS solo_users
      FROM users
    `);

        logger.info('User stats query completed', { requestId, layer: 'USER_REPOSITORY', durationMs: Date.now() - start });
        return result.rows[0];
    }
}

module.exports = UsersRepo;
