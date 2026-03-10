const logger = require('../../config/logger');
const { sendSuccess } = require('../../utils/response');

class RoutesdbController {
    constructor(routesdbService) {
        this.service = routesdbService;
    }

    getSummary = async (req, res, next) => {
        const requestId = req.requestId;
        logger.debug('RoutesdbController.getSummary called', { requestId, layer: 'ROUTESDB_CONTROLLER' });
        try {
            const data = await this.service.getSummary(requestId);
            return sendSuccess(res, data);
        } catch (err) {
            logger.error(`RoutesdbController.getSummary error: ${err.message}`, { requestId, layer: 'ROUTESDB_CONTROLLER', stack: err.stack });
            next(err);
        }
    };

    getTopCited = async (req, res, next) => {
        const requestId = req.requestId;
        logger.debug('RoutesdbController.getTopCited called', { requestId, layer: 'ROUTESDB_CONTROLLER' });
        try {
            const limit = parseInt(req.query.limit, 10) || 20;
            const data = await this.service.getTopCited(limit, requestId);
            return sendSuccess(res, data);
        } catch (err) {
            logger.error(`RoutesdbController.getTopCited error: ${err.message}`, { requestId, layer: 'ROUTESDB_CONTROLLER', stack: err.stack });
            next(err);
        }
    };

    getCourtsBreakdown = async (req, res, next) => {
        const requestId = req.requestId;
        logger.debug('RoutesdbController.getCourtsBreakdown called', { requestId, layer: 'ROUTESDB_CONTROLLER' });
        try {
            const data = await this.service.getCourtsBreakdown(requestId);
            return sendSuccess(res, data);
        } catch (err) {
            logger.error(`RoutesdbController.getCourtsBreakdown error: ${err.message}`, { requestId, layer: 'ROUTESDB_CONTROLLER', stack: err.stack });
            next(err);
        }
    };
}

module.exports = RoutesdbController;
