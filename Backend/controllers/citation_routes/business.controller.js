const logger = require('../../config/logger');
const { sendSuccess } = require('../../utils/response');

class BusinessController {
    constructor(businessService) {
        this.service = businessService;
    }

    getSummary = async (req, res, next) => {
        const requestId = req.requestId;
        logger.debug('BusinessController.getSummary called', { requestId, layer: 'BUSINESS_CONTROLLER' });
        try {
            const data = await this.service.getSummary(requestId);
            return sendSuccess(res, data);
        } catch (err) {
            logger.error(`BusinessController.getSummary error: ${err.message}`, { requestId, layer: 'BUSINESS_CONTROLLER', stack: err.stack });
            next(err);
        }
    };
    //test//
    getReportsPerDay = async (req, res, next) => {
        const requestId = req.requestId;
        logger.debug('BusinessController.getReportsPerDay called', { requestId, layer: 'BUSINESS_CONTROLLER' });
        try {
            const days = parseInt(req.query.days, 10) || 30;
            const data = await this.service.getReportsPerDay(days, requestId);
            return sendSuccess(res, data);
        } catch (err) {
            logger.error(`BusinessController.getReportsPerDay error: ${err.message}`, { requestId, layer: 'BUSINESS_CONTROLLER', stack: err.stack });
            next(err);
        }
    };

    getTopUsers = async (req, res, next) => {
        const requestId = req.requestId;
        logger.debug('BusinessController.getTopUsers called', { requestId, layer: 'BUSINESS_CONTROLLER' });
        try {
            const limit = parseInt(req.query.limit, 10) || 20;
            const data = await this.service.getTopUsers(limit, requestId);
            return sendSuccess(res, data);
        } catch (err) {
            logger.error(`BusinessController.getTopUsers error: ${err.message}`, { requestId, layer: 'BUSINESS_CONTROLLER', stack: err.stack });
            next(err);
        }
    };
}

module.exports = BusinessController;
