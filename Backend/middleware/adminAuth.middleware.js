const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const { JWT_SECRET } = require('../config/env');

/**
 * Admin auth: accepts either ADMIN_TOKEN (env) or valid JWT (dashboard login).
 * Apply to all /api/admin/* citation and user management routes.
 */
function adminAuthMiddleware(pool) {
    return async function (req, res, next) {
        const adminToken = process.env.ADMIN_TOKEN;

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('Missing or malformed Authorization header', { requestId: req.requestId, layer: 'AUTH' });
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Authorization header required: Bearer <token>' },
                requestId: req.requestId,
            });
        }

        const token = authHeader.split(' ')[1]?.trim();
        if (!token) {
            return res.status(401).json({
                success: false,
                error: { code: 'UNAUTHORIZED', message: 'Authorization header required: Bearer <token>' },
                requestId: req.requestId,
            });
        }

        // 1) Fixed admin token (e.g. Postman)
        if (adminToken && token === adminToken) {
            logger.debug('Admin token validated', { requestId: req.requestId, layer: 'AUTH' });
            return next();
        }

        // 2) JWT from dashboard login
        if (JWT_SECRET && pool) {
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
                if (user && (user.role === 'super-admin' || user.role === 'user-admin' || user.role === 'admin')) {
                    req.user = user;
                    return next();
                }
            } catch (e) {
                if (e.name === 'TokenExpiredError') {
                    return res.status(401).json({
                        success: false,
                        error: { code: 'UNAUTHORIZED', message: 'Token expired' },
                        requestId: req.requestId,
                    });
                }
                if (e.name !== 'JsonWebTokenError') logger.error('Admin auth JWT error', { message: e.message, requestId: req.requestId });
            }
        }

        logger.warn('Invalid admin token or JWT', { requestId: req.requestId, layer: 'AUTH' });
        return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Invalid admin token' },
            requestId: req.requestId,
        });
    };
}

module.exports = adminAuthMiddleware;
