const jwt = require('jsonwebtoken');
require('dotenv').config();
const { createLogger } = require('../utils/logger');

const DEFAULT_JWT_SECRET = '4e14aa06e9fc8bc7a4140949f711bdf89b7f600942d2cbfad513f87d11af02cc';
const INTERNAL_SERVICE_KEY =
  process.env.JUDGEMENT_INTERNAL_API_KEY ||
  process.env.INTERNAL_SERVICE_KEY ||
  '';

const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const logger = createLogger('Auth');

function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function buildInternalUser(req) {
  return {
    id: req.headers['x-admin-user-id'] ? Number(req.headers['x-admin-user-id']) : null,
    role: req.headers['x-admin-role'] || 'super-admin',
    normalizedRole: normalizeRole(req.headers['x-admin-role'] || 'super-admin'),
    email: req.headers['x-admin-email'] || null,
    source: 'backend-proxy',
  };
}

function authenticate(req, res, next) {
  const internalKey = req.headers['x-internal-service-key'];

  if (INTERNAL_SERVICE_KEY && internalKey && internalKey === INTERNAL_SERVICE_KEY) {
    req.user = buildInternalUser(req);
    logger.flow('Authenticated request via internal service key', {
      userId: req.user.id,
      role: req.user.role,
      path: req.originalUrl,
    });
    return next();
  }

  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    logger.warn('Rejected request with missing bearer token', {
      path: req.originalUrl,
    });
    return res.status(401).json({ success: false, message: 'Unauthorized: missing bearer token' });
  }

  const token = authHeader.slice(7).trim();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const role = decoded.role || req.headers['x-admin-role'] || 'super-admin';

    req.user = {
      id: decoded.id != null ? Number(decoded.id) : null,
      role,
      normalizedRole: normalizeRole(role),
      email: decoded.email || req.headers['x-admin-email'] || null,
      source: 'jwt',
    };

    logger.flow('Authenticated request via JWT', {
      userId: req.user.id,
      role: req.user.role,
      path: req.originalUrl,
    });

    return next();
  } catch (error) {
    logger.error('JWT authentication failed', error, {
      path: req.originalUrl,
    });
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: invalid or expired token',
      code: error.name || 'AUTH_ERROR',
    });
  }
}

function authorize(roles = []) {
  const allowed = roles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (allowed.length === 0 || allowed.includes(req.user.normalizedRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Forbidden',
      currentRole: req.user.role,
      allowedRoles: roles,
    });
  };
}

module.exports = {
  authenticate,
  authorize,
  normalizeRole,
};
