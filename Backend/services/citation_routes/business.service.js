const logger = require('../../config/logger');

class BusinessService {
    constructor(businessRepo, authPool) {
        this.repo = businessRepo;
        this.authPool = authPool; // Auth DB for user info enrichment
    }

    async getSummary(requestId) {
        logger.debug('BusinessService.getSummary called', { requestId, layer: 'BUSINESS_SERVICE' });
        const summary = await this.repo.getSummary(requestId);
        logger.info('BusinessService.getSummary completed', { requestId, layer: 'BUSINESS_SERVICE' });
        return summary;
    }

    async getReportsPerDay(days, requestId) {
        logger.debug('BusinessService.getReportsPerDay called', { requestId, layer: 'BUSINESS_SERVICE' });
        const rows = await this.repo.getReportsPerDay(days, requestId);
        logger.info('BusinessService.getReportsPerDay completed', { requestId, layer: 'BUSINESS_SERVICE' });
        return rows;
    }

    async getTopUsers(limit, requestId) {
        logger.debug('BusinessService.getTopUsers called', { requestId, layer: 'BUSINESS_SERVICE' });

        const topUsers = await this.repo.getTopUsers(limit, requestId);

        // Enrich with user info from Auth DB
        if (topUsers.length > 0 && this.authPool) {
            try {
                const userIds = topUsers.map(u => u.user_id).filter(Boolean);
                if (userIds.length > 0) {
                    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(', ');
                    const authResult = await this.authPool.query(
                        `SELECT id, email, username FROM users WHERE id::text IN (${placeholders})`,
                        userIds.map(String)
                    );
                    const userMap = {};
                    for (const row of authResult.rows) {
                        userMap[String(row.id)] = { email: row.email, username: row.username };
                    }
                    for (const user of topUsers) {
                        const info = userMap[String(user.user_id)];
                        user.email = info?.email || null;
                        user.username = info?.username || null;
                    }
                    logger.info('Enriched top users with Auth DB data', { requestId, layer: 'BUSINESS_SERVICE' });
                }
            } catch (err) {
                logger.warn(`Failed to enrich top users from Auth DB: ${err.message}`, { requestId, layer: 'BUSINESS_SERVICE' });
                // Non-fatal: return data without enrichment
            }
        }

        logger.info('BusinessService.getTopUsers completed', { requestId, layer: 'BUSINESS_SERVICE' });
        return topUsers;
    }
}

module.exports = BusinessService;
