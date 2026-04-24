const MAX_STRING_LENGTH = 180;
const MAX_ARRAY_ITEMS = 10;
const MAX_OBJECT_KEYS = 12;

const truncateText = (value, maxLength = MAX_STRING_LENGTH) => {
  const text = String(value ?? '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
};

const summarizeValue = (value, depth = 0) => {
  if (value == null) return value;

  if (typeof value === 'string') return truncateText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((entry) => summarizeValue(entry, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`... +${value.length - MAX_ARRAY_ITEMS} more`);
    }
    return items;
  }

  if (typeof value === 'object') {
    if (depth >= 2) {
      return `[Object keys:${Object.keys(value).length}]`;
    }

    const keys = Object.keys(value);
    const summary = {};
    keys.slice(0, MAX_OBJECT_KEYS).forEach((key) => {
      summary[key] = summarizeValue(value[key], depth + 1);
    });
    if (keys.length > MAX_OBJECT_KEYS) {
      summary.__truncated__ = `+${keys.length - MAX_OBJECT_KEYS} keys`;
    }
    return summary;
  }

  return String(value);
};

const serializeError = (error) => ({
  name: error?.name || 'Error',
  message: error?.message || 'Unknown error',
  stack: error?.stack || null,
  status: error?.status || null,
  code: error?.code || null,
  traceId: error?.traceId || null,
  payload: summarizeValue(error?.payload),
});

const hasRows = (rows) => Array.isArray(rows) && rows.length > 0;

const normalizeTableRows = (rows = []) =>
  rows.map((row) =>
    Object.fromEntries(
      Object.entries(row || {}).map(([key, value]) => [key, summarizeValue(value)])
    )
  );

export const createDebugLogger = (namespace) => {
  const prefix = `[${namespace}]`;

  const event = (stage, payload = {}, level = 'log') => {
    const logger = console[level] || console.log;
    logger(`${prefix} ${stage}`, summarizeValue(payload));
  };

  const table = (title, rows = []) => {
    if (!hasRows(rows)) return;
    console.log(`${prefix} ${title}`);
    console.table(normalizeTableRows(rows));
  };

  const flow = (
    stage,
    {
      level = 'log',
      summary,
      input,
      output,
      context,
      metrics,
      table: tableRows,
      error,
      collapsed = true,
    } = {}
  ) => {
    const group = collapsed ? console.groupCollapsed : console.group;
    group(`${prefix} ${stage}`);

    if (summary) {
      console.log('Summary', summarizeValue(summary));
    }
    if (input) {
      console.log('Input', summarizeValue(input));
    }
    if (output) {
      console.log('Output', summarizeValue(output));
    }
    if (context) {
      console.log('Context', summarizeValue(context));
    }
    if (metrics) {
      console.log('Metrics', summarizeValue(metrics));
    }
    if (hasRows(tableRows)) {
      console.table(normalizeTableRows(tableRows));
    }
    if (error) {
      const logger = console[level] || console.error;
      logger('Error', serializeError(error));
    }

    console.groupEnd();
  };

  const errorLog = (stage, error, context = {}) =>
    flow(stage, {
      level: 'error',
      error,
      ...context,
    });

  return {
    event,
    table,
    flow,
    error: errorLog,
    summarizeValue,
  };
};

export { summarizeValue, serializeError };
