/**
 * Hybrid admin auth for /admin/jurinex-voice/*.
 *
 * Accepts ANY of:
 *   - X-Admin-API-Key:    matches process.env.ADMIN_API_KEY
 *   - Authorization: Bearer <ADMIN_TOKEN>     (existing admin token)
 *   - Authorization: Bearer <JWT>             (existing dashboard login)
 *
 * Per spec: "If the existing admin app already has stronger auth, keep it
 * AND also support X-Admin-API-Key for these routes."
 */

const jwt = require('jsonwebtoken');
const logger = require('../../../config/logger');
const { JWT_SECRET } = require('../../../config/env');

function adminApiKeyMiddleware(pool) {
  return async function (req, res, next) {
    const apiKeyHeader =
      req.headers['x-admin-api-key'] ||
      req.headers['X-Admin-API-Key'] ||
      req.headers['x-admin-apikey'];
    const adminApiKey = process.env.ADMIN_API_KEY;

    // 1) X-Admin-API-Key (preferred for this module)
    if (adminApiKey && apiKeyHeader && String(apiKeyHeader).trim() === adminApiKey) {
      req.adminAuth = { method: 'api_key' };
      return next();
    }

    // 2) Existing admin token / JWT (backwards compat with rest of admin app)
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      const fixedToken = process.env.ADMIN_TOKEN;

      if (fixedToken && token === fixedToken) {
        req.adminAuth = { method: 'admin_token' };
        return next();
      }

      if (JWT_SECRET && pool && token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const userId = decoded.id != null ? Number(decoded.id) : decoded.id;
          const userResult = await pool.query(
            `SELECT a.id, a.email, r.name AS role
               FROM super_admins a
               JOIN admin_roles r ON a.role_id = r.id
              WHERE a.id = $1`,
            [userId]
          );
          const user = userResult.rows[0];
          if (
            user &&
            ['super-admin', 'user-admin', 'admin', 'support-admin'].includes(user.role)
          ) {
            req.user = user;
            req.adminAuth = { method: 'jwt', userId: user.id, email: user.email };
            return next();
          }
        } catch (e) {
          if (e.name !== 'JsonWebTokenError' && e.name !== 'TokenExpiredError') {
            logger.error('jurinex-voice JWT verify error', {
              layer: 'JURINEX_VOICE_AUTH',
              message: e.message,
              requestId: req.requestId,
            });
          }
        }
      }
    }

    logger.warn('jurinex-voice unauthorized', {
      layer: 'JURINEX_VOICE_AUTH',
      requestId: req.requestId,
      summary: { hasApiKey: !!apiKeyHeader, hasBearer: !!authHeader },
    });

    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'X-Admin-API-Key header or Authorization Bearer token is required',
      },
      requestId: req.requestId,
    });
  };
}

module.exports = adminApiKeyMiddleware;
