function safeMeta(meta) {
  if (!meta || typeof meta !== 'object') return meta;

  try {
    return JSON.parse(JSON.stringify(meta));
  } catch (_) {
    return { note: 'meta_not_serializable' };
  }
}

function timestamp() {
  return new Date().toISOString();
}

function print(level, scope, message, meta) {
  const prefix = `[${timestamp()}][JudgementService][${scope}][${level}] ${message}`;

  if (meta && Object.keys(meta).length) {
    console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](prefix, safeMeta(meta));
    return;
  }

  console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](prefix);
}

function createLogger(scope) {
  return {
    info(message, meta = undefined) {
      print('INFO', scope, message, meta);
    },
    step(message, meta = undefined) {
      print('STEP', scope, message, meta);
    },
    flow(message, meta = undefined) {
      print('FLOW', scope, message, meta);
    },
    warn(message, meta = undefined) {
      print('WARN', scope, message, meta);
    },
    error(message, error = undefined, meta = undefined) {
      const payload = {
        ...(meta || {}),
        ...(error
          ? {
            error_message: error.message,
            error_stack: error.stack,
            error_name: error.name,
          }
          : {}),
      };
      print('ERROR', scope, message, payload);
    },
  };
}

module.exports = {
  createLogger,
};
