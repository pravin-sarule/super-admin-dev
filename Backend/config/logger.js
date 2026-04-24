const winston = require('winston');
const {
    buildAsciiTable,
    buildKeyValueSummary,
    safeJson,
    summarizeValue,
} = require('../utils/logging.utils');

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

    const summaryLine = buildKeyValueSummary(metaForPrint.summary);
    if (summaryLine) {
        log += ` | ${summaryLine}`;
    }

    const sections = [];
    const appendSection = (label, value, { table = false } = {}) => {
        if (value == null) return;
        if (Array.isArray(value) && value.length === 0) return;
        if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return;

        const content = table ? buildAsciiTable(value) : safeJson(value);
        if (!content) return;
        sections.push(`${label}:\n${content}`);
    };

    appendSection('input', metaForPrint.input);
    appendSection('output', metaForPrint.output);
    appendSection('context', metaForPrint.context);
    appendSection('params', metaForPrint.params);
    appendSection('query', metaForPrint.queryParams);
    appendSection('body', metaForPrint.body);
    appendSection('metrics', metaForPrint.metrics);
    appendSection('table', metaForPrint.table, { table: true });
    appendSection('extra', metaForPrint.extra);

    const reservedKeys = new Set([
        'summary',
        'input',
        'output',
        'context',
        'params',
        'queryParams',
        'body',
        'metrics',
        'table',
        'extra',
    ]);

    const remainingMeta = Object.fromEntries(
        Object.entries(metaForPrint).filter(([key]) => !reservedKeys.has(key))
    );

    if (Object.keys(remainingMeta).length > 0) {
        sections.push(`meta:\n${safeJson(remainingMeta)}`);
    }

    if (sections.length > 0) {
        log += `\n${sections.join('\n')}`;
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

logger.flow = function flow(message, meta = {}) {
    const { level = 'info', ...rest } = meta;
    return this.log({ level, message, ...rest });
};

logger.table = function table(message, rows = [], meta = {}) {
    const { level = 'info', ...rest } = meta;
    return this.log({
        level,
        message,
        ...rest,
        table: Array.isArray(rows) ? rows.map((row) => summarizeValue(row)) : [],
    });
};

logger.pipeline = function pipeline(message, meta = {}) {
    const { pipelineName, stage, status, summary = {}, ...rest } = meta;
    return this.flow(message, {
        ...rest,
        summary: {
            pipeline: pipelineName || null,
            stage: stage || null,
            status: status || null,
            ...summary,
        },
    });
};

logger.errorWithContext = function errorWithContext(message, error, meta = {}) {
    return this.log({
        level: meta.level || 'error',
        message,
        ...meta,
        summary: {
            ...(meta.summary || {}),
            errorName: error?.name || null,
            errorCode: error?.code || error?.original?.code || error?.parent?.code || null,
        },
        context: {
            ...(meta.context || {}),
            errorMessage: error?.message || null,
        },
        stack: error?.stack || meta.stack,
    });
};

module.exports = logger;
