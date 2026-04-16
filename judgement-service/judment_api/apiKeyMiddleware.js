const crypto = require('crypto');
const { createLogger } = require('../utils/logger');

const logger = createLogger('JudmentApiAuth');
const internalServiceKey =
  process.env.JUDGEMENT_INTERNAL_API_KEY ||
  process.env.INTERNAL_SERVICE_KEY ||
  '';

function getConfiguredApiKey() {
  return (
    process.env.JUDMENT_API_KEY ||
    process.env.JUDGEMENT_API_KEY ||
    ''
  );
}

function extractApiKey(req) {
  const headerValue = req.headers['x-api-key'];
  if (headerValue) {
    return String(headerValue).trim();
  }

  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex').slice(0, 16);
}

function keysMatch(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ''), 'utf8');
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function authenticateApiKey(req, res, next) {
  const providedInternalKey = String(req.headers['x-internal-service-key'] || '').trim();
  if (internalServiceKey && providedInternalKey && keysMatch(providedInternalKey, internalServiceKey)) {
    req.apiClient = {
      fingerprint: fingerprint(providedInternalKey),
      authType: 'internal-service-key',
    };

    logger.flow('Authenticated judment API request via internal service key', {
      path: req.originalUrl,
      apiKeyFingerprint: req.apiClient.fingerprint,
      authType: req.apiClient.authType,
    });

    return next();
  }

  const configuredApiKey = getConfiguredApiKey();
  if (!configuredApiKey) {
    logger.error('Judment API key is not configured', null, {
      path: req.originalUrl,
    });
    return res.status(500).json({
      success: false,
      message: 'Judment API key is not configured',
    });
  }

  const providedApiKey = extractApiKey(req);
  if (!providedApiKey || !keysMatch(providedApiKey, configuredApiKey)) {
    logger.warn('Rejected judment API request with invalid API key', {
      path: req.originalUrl,
      providedFingerprint: fingerprint(providedApiKey),
    });
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: invalid API key',
    });
  }

  req.apiClient = {
    fingerprint: fingerprint(providedApiKey),
    authType: req.headers['x-api-key'] ? 'x-api-key' : 'bearer',
  };

  logger.flow('Authenticated judment API request', {
    path: req.originalUrl,
    apiKeyFingerprint: req.apiClient.fingerprint,
    authType: req.apiClient.authType,
  });

  return next();
}

module.exports = {
  authenticateApiKey,
};
