const logger = require('../../config/logger');
const { sendSuccess } = require('../../utils/response');
const { parsePagination, paginationMeta } = require('../../utils/pagination');

class PipelineController {
    constructor(pipelineService) {
        this.service = pipelineService;
    }

    getSummary = async (req, res, next) => {
        const requestId = req.requestId;
        logger.debug('PipelineController.getSummary called', { requestId, layer: 'PIPELINE_CONTROLLER' });
        try {
            const data = await this.service.getSummary(requestId);
            return sendSuccess(res, data);
        } catch (err) {
            logger.error(`PipelineController.getSummary error: ${err.message}`, { requestId, layer: 'PIPELINE_CONTROLLER', stack: err.stack });
            next(err);
        }
    };

    listItems = async (req, res, next) => {
        const requestId = req.requestId;
        logger.debug('PipelineController.listItems called', { requestId, layer: 'PIPELINE_CONTROLLER' });
        try {
            const { page, pageSize, offset } = parsePagination(req.query);
            const { status, source, startDate, endDate, hasError } = req.query;

            const result = await this.service.listItems(
                { status, source, startDate, endDate, hasError, limit: pageSize, offset },
                requestId
            );

            return sendSuccess(res, {
                items: result.rows,
                pagination: paginationMeta(result.totalCount, page, pageSize),
            });
        } catch (err) {
            logger.error(`PipelineController.listItems error: ${err.message}`, { requestId, layer: 'PIPELINE_CONTROLLER', stack: err.stack });
            next(err);
        }
    };

    getRecentErrors = async (req, res, next) => {
        const requestId = req.requestId;
        logger.debug('PipelineController.getRecentErrors called', { requestId, layer: 'PIPELINE_CONTROLLER' });
        try {
            const limit = parseInt(req.query.limit, 10) || 50;
            const data = await this.service.getRecentErrors(limit, requestId);
            return sendSuccess(res, data);
        } catch (err) {
            logger.error(`PipelineController.getRecentErrors error: ${err.message}`, { requestId, layer: 'PIPELINE_CONTROLLER', stack: err.stack });
            next(err);
        }
    };
}

module.exports = PipelineController;
