const { v4: uuidv4 } = require('uuid');
const logger = require('../config/logger');
const { summarizeValue } = require('../utils/logging.utils');

/**
 * Middleware: attach X-Request-Id to req and res, log request start/end with duration.
 */
function requestIdMiddleware(req, res, next) {
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    const start = Date.now();

    logger.flow('HTTP request received', {
        requestId,
        layer: 'HTTP',
        summary: {
            method: req.method,
            path: req.originalUrl,
            ip: req.ip,
        },
        params: summarizeValue(req.params),
        queryParams: summarizeValue(req.query),
        body: ['GET', 'HEAD'].includes(req.method) ? null : summarizeValue(req.body),
        context: {
            userAgent: req.headers['user-agent'] || null,
            referer: req.headers.referer || null,
        },
    });

    res.on('finish', () => {
        const durationMs = Date.now() - start;
        const level =
            res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

        logger.flow('HTTP request completed', {
            level,
            requestId,
            layer: 'HTTP',
            durationMs,
            summary: {
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                role: req.user?.role || null,
                userId: req.user?.id || null,
            },
            metrics: {
                durationMs,
                contentLength: res.getHeader('content-length') || null,
            },
        });
    });

    next();
}

module.exports = requestIdMiddleware;
