const logger = require('../../config/logger');
const { sendSuccess, sendError } = require('../../utils/response');
const { parsePagination, paginationMeta } = require('../../utils/pagination');

class HitlController {
    constructor(hitlService) {
        this.service = hitlService;
    }

    listTasks = async (req, res, next) => {
        const requestId = req.requestId;
        logger.debug('HitlController.listTasks called', { requestId, layer: 'HITL_CONTROLLER' });
        try {
            const { page, pageSize, offset } = parsePagination(req.query);
            const { status, sort } = req.query;

            const result = await this.service.listTasks(
                { status, limit: pageSize, offset, sort: sort || 'priority_desc' },
                requestId
            );

            logger.info('HitlController.listTasks completed', { requestId, layer: 'HITL_CONTROLLER' });
            return sendSuccess(res, {
                tasks: result.rows,
                pagination: paginationMeta(result.totalCount, page, pageSize),
            });
        } catch (err) {
            logger.error(`HitlController.listTasks error: ${err.message}`, { requestId, layer: 'HITL_CONTROLLER', stack: err.stack });
            next(err);
        }
    };

    getTaskDetail = async (req, res, next) => {
        const requestId = req.requestId;
        const { taskId } = req.params;
        logger.debug(`HitlController.getTaskDetail called for ${taskId}`, { requestId, layer: 'HITL_CONTROLLER' });
        try {
            const task = await this.service.getTaskDetail(taskId, requestId);
            logger.info('HitlController.getTaskDetail completed', { requestId, layer: 'HITL_CONTROLLER' });
            return sendSuccess(res, task);
        } catch (err) {
            logger.error(`HitlController.getTaskDetail error: ${err.message}`, { requestId, layer: 'HITL_CONTROLLER', stack: err.stack });
            next(err);
        }
    };

    processAction = async (req, res, next) => {
        const requestId = req.requestId;
        const { taskId } = req.params;
        logger.debug(`HitlController.processAction called for ${taskId}`, { requestId, layer: 'HITL_CONTROLLER' });
        try {
            const result = await this.service.processAction(taskId, req.body, requestId);
            logger.info('HitlController.processAction completed', { requestId, layer: 'HITL_CONTROLLER' });
            return sendSuccess(res, result);
        } catch (err) {
            logger.error(`HitlController.processAction error: ${err.message}`, { requestId, layer: 'HITL_CONTROLLER', stack: err.stack });
            next(err);
        }
    };
}

module.exports = HitlController;
