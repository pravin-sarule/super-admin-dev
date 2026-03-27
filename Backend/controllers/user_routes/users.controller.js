const logger = require('../../config/logger');
const { sendSuccess } = require('../../utils/response');
const { parsePagination, paginationMeta } = require('../../utils/pagination');

class UsersController {
    constructor(usersService) {
        this.service = usersService;
    }

    listUsers = async (req, res, next) => {
        const requestId = req.requestId;
        logger.debug('UsersController.listUsers called', { requestId, layer: 'USER_CONTROLLER' });
        try {
            const { page, pageSize, offset } = parsePagination(req.query);
            const { role, approval_status, account_type, search } = req.query;

            const result = await this.service.listUsers(
                { role, approval_status, account_type, search, limit: pageSize, offset },
                requestId
            );

            return sendSuccess(res, {
                users: result.rows,
                pagination: paginationMeta(result.totalCount, page, pageSize),
            });
        } catch (err) {
            logger.error(`UsersController.listUsers error: ${err.message}`, { requestId, layer: 'USER_CONTROLLER', stack: err.stack });
            next(err);
        }
    };

    getPendingApprovals = async (req, res, next) => {
        const requestId = req.requestId;
        logger.debug('UsersController.getPendingApprovals called', { requestId, layer: 'USER_CONTROLLER' });
        try {
            const users = await this.service.getPendingApprovals(requestId);
            return sendSuccess(res, { users });
        } catch (err) {
            logger.error(`UsersController.getPendingApprovals error: ${err.message}`, { requestId, layer: 'USER_CONTROLLER', stack: err.stack });
            next(err);
        }
    };

    approveUser = async (req, res, next) => {
        const requestId = req.requestId;
        const { id } = req.params;
        logger.debug(`UsersController.approveUser called for ${id}`, { requestId, layer: 'USER_CONTROLLER' });
        try {
            const user = await this.service.approveUser(id, requestId);
            return sendSuccess(res, { user, message: 'User approved successfully' });
        } catch (err) {
            logger.error(`UsersController.approveUser error: ${err.message}`, { requestId, layer: 'USER_CONTROLLER', stack: err.stack });
            next(err);
        }
    };

    blockUser = async (req, res, next) => {
        const requestId = req.requestId;
        const { id } = req.params;
        logger.debug(`UsersController.blockUser called for ${id}`, { requestId, layer: 'USER_CONTROLLER' });
        try {
            const user = await this.service.blockUser(id, requestId);
            return sendSuccess(res, { user, message: 'User blocked successfully' });
        } catch (err) {
            logger.error(`UsersController.blockUser error: ${err.message}`, { requestId, layer: 'USER_CONTROLLER', stack: err.stack });
            next(err);
        }
    };

    unblockUser = async (req, res, next) => {
        const requestId = req.requestId;
        const { id } = req.params;
        logger.debug(`UsersController.unblockUser called for ${id}`, { requestId, layer: 'USER_CONTROLLER' });
        try {
            const user = await this.service.unblockUser(id, requestId);
            return sendSuccess(res, { user, message: 'User unblocked successfully' });
        } catch (err) {
            logger.error(`UsersController.unblockUser error: ${err.message}`, { requestId, layer: 'USER_CONTROLLER', stack: err.stack });
            next(err);
        }
    };

    getUserStats = async (req, res, next) => {
        const requestId = req.requestId;
        logger.debug('UsersController.getUserStats called', { requestId, layer: 'USER_CONTROLLER' });
        try {
            const stats = await this.service.getUserStats(requestId);
            return sendSuccess(res, stats);
        } catch (err) {
            logger.error(`UsersController.getUserStats error: ${err.message}`, { requestId, layer: 'USER_CONTROLLER', stack: err.stack });
            next(err);
        }
    };
}

module.exports = UsersController;
