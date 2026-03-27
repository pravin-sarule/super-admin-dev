const logger = require('../config/logger');

/**
 * Joi validation middleware factory.
 * @param {object} schema - Joi schema with optional query, body, params keys.
 * @returns Express middleware
 */
function validate(schema) {
    return (req, res, next) => {
        const targets = {};
        if (schema.query) targets.query = req.query;
        if (schema.body) targets.body = req.body;
        if (schema.params) targets.params = req.params;

        for (const [key, data] of Object.entries(targets)) {
            const { error, value } = schema[key].validate(data, { abortEarly: false, stripUnknown: true });
            if (error) {
                const details = error.details.map(d => d.message);
                logger.warn(`Validation failed on ${key}: ${details.join('; ')}`, {
                    requestId: req.requestId,
                    layer: 'VALIDATION',
                });
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request parameters',
                        details,
                    },
                    requestId: req.requestId,
                });
            }
            req[key] = value; // replace with validated+stripped values
        }
        next();
    };
}

module.exports = validate;
