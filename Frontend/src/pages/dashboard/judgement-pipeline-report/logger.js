function log(level, scope, message, meta) {
  const prefix = `[JudgementPipelineReport][${scope}][${level}] ${message}`;

  if (level === 'ERROR') {
    console.groupCollapsed(prefix);
    if (meta) {
      console.error(meta);
    }
    console.groupEnd();
    return;
  }

  if (meta !== undefined) {
    console.debug(prefix, meta);
    return;
  }

  console.debug(prefix);
}

export function createPipelineReportLogger(scope) {
  return {
    flow(message, meta = undefined) {
      log('FLOW', scope, message, meta);
    },
    info(message, meta = undefined) {
      log('INFO', scope, message, meta);
    },
    warn(message, meta = undefined) {
      log('WARN', scope, message, meta);
    },
    error(message, error = undefined, meta = undefined) {
      log('ERROR', scope, message, {
        ...(meta || {}),
        ...(error
          ? {
            errorMessage: error.message || null,
            errorName: error.name || null,
            errorStack: error.stack || null,
          }
          : {}),
      });
    },
  };
}
