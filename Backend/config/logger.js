const winston = require('winston');

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, requestId, layer, ...meta }) => {
    let log = `${timestamp} [${level}]`;
    if (requestId) log += ` [reqId:${requestId}]`;
    if (layer) log += ` [${layer}]`;
    log += ` ${message}`;
    if (meta.durationMs !== undefined) log += ` (${meta.durationMs}ms)`;
    if (meta.stack) log += `\n${meta.stack}`;
    if (meta.query) log += ` | query: ${meta.query}`;

    const metaForPrint = { ...meta };
    delete metaForPrint.durationMs;
    delete metaForPrint.stack;
    delete metaForPrint.query;

    if (Object.keys(metaForPrint).length > 0) {
        try {
            log += ` | meta: ${JSON.stringify(metaForPrint)}`;
        } catch (error) {
            log += ` | meta: [unserializable: ${error.message}]`;
        }
    }
    return log;
});

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        logFormat
    ),
    transports: [
        new winston.transports.Console({
            format: combine(
                colorize({ all: true }),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
                logFormat
            )
        })
    ],
    exitOnError: false,
});

module.exports = logger;
