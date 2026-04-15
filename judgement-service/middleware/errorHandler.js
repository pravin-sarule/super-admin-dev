const { createLogger } = require('../utils/logger');

const logger = createLogger('ErrorHandler');

function errorHandler(error, req, res, next) {
  logger.error('Unhandled request error', error, {
    method: req.method,
    path: req.originalUrl,
  });

  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: error.message || 'Internal server error',
  });
}

module.exports = errorHandler;
