/**
 * Standard success JSON response.
 */
function sendSuccess(res, data, statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        data,
    });
}

/**
 * Standard error JSON response.
 */
function sendError(res, { code = 'INTERNAL_ERROR', message = 'Something went wrong', details = null, statusCode = 500, requestId = null }) {
    const body = {
        success: false,
        error: { code, message },
        requestId,
    };
    if (details) body.error.details = details;
    return res.status(statusCode).json(body);
}

module.exports = { sendSuccess, sendError };
