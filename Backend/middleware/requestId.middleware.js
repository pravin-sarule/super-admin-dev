const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');

/**
 * Middleware: attach X-Request-Id to req and res, log request start/end with duration.
 */
function requestIdMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    const start = Date.now();

    logger.info(`→ ${req.method} ${req.originalUrl}`, { requestId, layer: 'HTTP' });

    const originalEnd = res.end.bind(res);
    res.end = function (...args) {
        const durationMs = Date.now() - start;
        logger.info(`← ${req.method} ${req.originalUrl} ${res.statusCode}`, { requestId, layer: 'HTTP', durationMs });
        originalEnd(...args);
    };

    next();
}

module.exports = requestIdMiddleware;
