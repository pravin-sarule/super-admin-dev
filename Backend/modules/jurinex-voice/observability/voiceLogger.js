/**
 * Thin wrapper around the project winston logger that scopes everything to
 * the `JURINEX_VOICE` layer so dataflow logs are easy to grep.
 */
const baseLogger = require('../../../config/logger');

const LAYER = 'JURINEX_VOICE';

const withLayer = (meta = {}) => ({ layer: LAYER, ...meta });

const voiceLogger = {
  info: (msg, meta) => baseLogger.info(msg, withLayer(meta)),
  warn: (msg, meta) => baseLogger.warn(msg, withLayer(meta)),
  error: (msg, meta) => baseLogger.error(msg, withLayer(meta)),
  debug: (msg, meta) => baseLogger.debug(msg, withLayer(meta)),
  flow: (msg, meta) => baseLogger.flow(msg, withLayer(meta)),
  errorWithContext: (msg, err, meta) => baseLogger.errorWithContext(msg, err, withLayer(meta)),
};

module.exports = voiceLogger;
