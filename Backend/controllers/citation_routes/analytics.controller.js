const logger = require('../../config/logger');
const { sendSuccess, sendError } = require('../../utils/response');

class AnalyticsController {
  constructor(analyticsService) {
    this.service = analyticsService;
  }

  getAnalytics = async (req, res, next) => {
    const requestId = req.requestId;
    try {
      const data = await this.service.getAnalytics(requestId);
      return sendSuccess(res, data);
    } catch (err) {
      logger.error(`AnalyticsController.getAnalytics: ${err.message}`, {
        requestId,
        stack: err.stack,
      });
      next(err);
    }
  };

  getHeartbeat = async (req, res, next) => {
    const requestId = req.requestId;
    try {
      const data = await this.service.getHeartbeat(requestId);
      return sendSuccess(res, data);
    } catch (err) {
      logger.error(`AnalyticsController.getHeartbeat: ${err.message}`, {
        requestId,
        stack: err.stack,
      });
      return sendError(res, {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Citation usage analytics unavailable',
        statusCode: 503,
        requestId,
      });
    }
  };

  getUserDetails = async (req, res, next) => {
    const requestId = req.requestId;
    const { userId } = req.params;
    try {
      const data = await this.service.getUserDetails(userId, requestId);
      return sendSuccess(res, data);
    } catch (err) {
      logger.error(`AnalyticsController.getUserDetails: ${err.message}`, {
        requestId,
        stack: err.stack,
      });
      next(err);
    }
  };
}

module.exports = AnalyticsController;
