const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Protect routes: Verify JWT and attach user object from DB
 */
const protect = (pool) => async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from DB to ensure user exists and is active
    const userResult = await pool.query(
      `SELECT a.id, a.email, r.name AS role
       FROM super_admins a
       JOIN admin_roles r ON a.role_id = r.id
       WHERE a.id = $1`,
      [decoded.id]
    );

    const user = userResult.rows[0];

    if (!user || user.is_blocked) {
      return res.status(401).json({ message: 'Unauthorized: User not found or blocked' });
    }

    req.user = user; // Attach user object to request
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    return res.status(401).json({ message: 'Invalid token' });
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
