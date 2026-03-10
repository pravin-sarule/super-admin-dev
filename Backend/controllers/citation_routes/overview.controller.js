const logger = require('../../config/logger');
const { sendSuccess, sendError } = require('../../utils/response');

class OverviewController {
    constructor(overviewService) {
        this.service = overviewService;
    }

    getOverview = async (req, res, next) => {
        const requestId = req.requestId;
        logger.debug('OverviewController.getOverview called', { requestId, layer: 'OVERVIEW_CONTROLLER' });
        try {
            const data = await this.service.getOverview(requestId);
            logger.info('OverviewController.getOverview completed', { requestId, layer: 'OVERVIEW_CONTROLLER' });
            return sendSuccess(res, data);
        } catch (err) {
            logger.error(`OverviewController.getOverview error: ${err.message}`, { requestId, layer: 'OVERVIEW_CONTROLLER', stack: err.stack });
            next(err);
        }
    };
}

module.exports = OverviewController;
