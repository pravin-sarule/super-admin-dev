const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

/**
 * Protect routes: Verify JWT and attach user object from DB
 */
const protect = (pool) => async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  let rawToken = authHeader.split(' ')[1];
  if (!rawToken) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
  let token = rawToken.trim();
  // If frontend sent "Bearer <jwt>" in the token value, strip prefix so verify gets raw JWT
  if (token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }

  if (!JWT_SECRET) {
    console.error('JWT Verification Error: JWT_SECRET not configured');
    return res.status(500).json({ message: 'Server configuration error' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Ensure id is passed as integer if DB uses integer type
    const userId = decoded.id != null ? Number(decoded.id) : decoded.id;

    // Fetch user from DB to ensure user exists and is active
    const userResult = await pool.query(
      `SELECT a.id, a.email, r.name AS role
       FROM super_admins a
       JOIN admin_roles r ON a.role_id = r.id
       WHERE a.id = $1`,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: User not found or blocked' });
    }
    if (user.is_blocked) {
      return res.status(401).json({ message: 'Unauthorized: User is blocked' });
    }

    req.user = user; // Attach user object to request
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      console.error('JWT Verification Error:', err.message, '| token length:', token?.length, '| starts with:', token?.slice(0, 20));
      return res.status(401).json({ message: 'Invalid token', code: 'INVALID_TOKEN' });
    }
    console.error('Auth middleware error:', err.message);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

/**
 * Role-based authorization: Only allow access if user has one of the allowed roles
 * @param {Array} roles - List of allowed roles, e.g., ['super-admin', 'user-admin']
 */
const authorize = (roles = []) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized: User not authenticated' });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      message: `Access denied: Requires one of the following roles: ${roles.join(', ')}`
    });
  }

  next();
};

module.exports = { protect, authorize };
