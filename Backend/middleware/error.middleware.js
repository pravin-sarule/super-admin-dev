const logger = require('../config/logger');
const { summarizeValue } = require('../utils/logging.utils');

/**
 * Centralized error handler middleware. Must be registered LAST.
 * Returns JSON: { success: false, error: { code, message, details }, requestId }
 */
function errorMiddleware(err, req, res, _next) {
    const requestId = req.requestId || 'unknown';

    // Determine status code
    let statusCode = err.statusCode || err.status || 500;
    if (statusCode < 100 || statusCode > 599) statusCode = 500;

    const code = err.code || 'INTERNAL_ERROR';
    const message = statusCode === 500 ? 'Internal server error' : err.message;

    logger.errorWithContext('Unhandled application error', err, {
        requestId,
        layer: 'ERROR_HANDLER',
        summary: {
            method: req.method,
            path: req.originalUrl,
            statusCode,
        },
        params: summarizeValue(req.params),
        queryParams: summarizeValue(req.query),
        body: summarizeValue(req.body),
        context: {
            userId: req.user?.id || null,
            role: req.user?.role || null,
            details: summarizeValue(err.details),
        },
    });

    return res.status(statusCode).json({
        success: false,
        error: {
            code,
            message,
            details: err.details || null,
        },
        requestId,
    });
}

module.exports = errorMiddleware;
