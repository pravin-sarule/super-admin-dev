const adminProtect = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized: User not authenticated' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Requires admin role' });
  }

  next();
};

module.exports = { adminProtect };
