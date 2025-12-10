

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = (pool) => {
  /**
   * @desc Login admin
   * @route POST /api/admins/login
   * @access Public
   */
  const loginAdmin = async (req, res) => {
    const { email, password } = req.body;
    console.log(`Attempting login for email: ${email}`); // Log the email

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
      // Fetch admin and join with roles to get role name
      const result = await pool.query(
        `SELECT a.id, a.name, a.email, a.password, r.name AS role_name
         FROM super_admins a
         JOIN admin_roles r ON a.role_id = r.id
         WHERE a.email = $1`,
        [email]
      );

      console.log('Database query result:', result.rows); // Log the query result
      const admin = result.rows[0];

      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }

      // Compare password
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Generate JWT token with id and role_name
      const token = jwt.sign(
        { id: admin.id, role: admin.role_name },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log(`JWT token generated for user ID: ${admin.id}, role: ${admin.role_name}`);

      // Send response
      res.status(200).json({
        success: true,
        token,
        admin: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: admin.role_name
        }
      });
    } catch (error) {
      console.error('Login error:', error.message);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };

  return { loginAdmin };
};
