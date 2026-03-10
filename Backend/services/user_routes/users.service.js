const logger = require('../../config/logger');

class UsersService {
    constructor(usersRepo) {
        this.repo = usersRepo;
    }

    async listUsers(filters, requestId) {
        logger.debug('UsersService.listUsers called', { requestId, layer: 'USER_SERVICE' });
        const result = await this.repo.listUsers(filters, requestId);
        logger.info('UsersService.listUsers completed', { requestId, layer: 'USER_SERVICE' });
        return result;
    }

    async getPendingApprovals(requestId) {
        logger.debug('UsersService.getPendingApprovals called', { requestId, layer: 'USER_SERVICE' });
        const rows = await this.repo.getPendingApprovals(requestId);
        logger.info('UsersService.getPendingApprovals completed', { requestId, layer: 'USER_SERVICE' });
        return rows;
    }

    async approveUser(userId, requestId) {
        logger.debug(`UsersService.approveUser called for ${userId}`, { requestId, layer: 'USER_SERVICE' });
        const user = await this.repo.approveUser(userId, requestId);
        if (!user) {
            const err = new Error(`User ${userId} not found`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }
        logger.info(`UsersService.approveUser completed for ${userId}`, { requestId, layer: 'USER_SERVICE' });
        return user;
    }

    async blockUser(userId, requestId) {
        logger.debug(`UsersService.blockUser called for ${userId}`, { requestId, layer: 'USER_SERVICE' });
        const user = await this.repo.blockUser(userId, requestId);
        if (!user) {
            const err = new Error(`User ${userId} not found`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }
        logger.info(`UsersService.blockUser completed for ${userId}`, { requestId, layer: 'USER_SERVICE' });
        return user;
    }

    async unblockUser(userId, requestId) {
        logger.debug(`UsersService.unblockUser called for ${userId}`, { requestId, layer: 'USER_SERVICE' });
        const user = await this.repo.unblockUser(userId, requestId);
        if (!user) {
            const err = new Error(`User ${userId} not found`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }
        logger.info(`UsersService.unblockUser completed for ${userId}`, { requestId, layer: 'USER_SERVICE' });
        return user;
    }

    async getUserStats(requestId) {
        logger.debug('UsersService.getUserStats called', { requestId, layer: 'USER_SERVICE' });
        const stats = await this.repo.getUserStats(requestId);
        logger.info('UsersService.getUserStats completed', { requestId, layer: 'USER_SERVICE' });
        return stats;
    }
}

module.exports = UsersService;
