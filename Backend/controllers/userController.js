// const bcrypt = require('bcrypt');

// module.exports = (pool) => {
//   // 📌 GET all users
//   const getAllUsers = async (req, res) => {
//     try {
//       const result = await pool.query(`
//         SELECT id, username, email, auth_type, google_uid, firebase_uid, profile_image, is_blocked, role, created_at, updated_at
//         FROM users
//       `);
//       res.status(200).json(result.rows);
//     } catch (err) {
//       console.error('Error fetching users:', err);
//       res.status(500).json({ error: 'Failed to fetch users' });
//     }
//   };

//   // 📌 TOGGLE block/unblock user
//   const toggleBlockUser = async (req, res) => {
//     const { userId } = req.params;
//     try {
//       const user = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [userId]);
//       if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });

//       const newStatus = !user.rows[0].is_blocked;
//       await pool.query(
//         'UPDATE users SET is_blocked = $1, updated_at = NOW() WHERE id = $2',
//         [newStatus, userId]
//       );

//       res.status(200).json({ message: `User ${newStatus ? 'blocked' : 'unblocked'} successfully` });
//     } catch (err) {
//       console.error('Error updating block status:', err);
//       res.status(500).json({ error: 'Failed to update user status' });
//     }
//   };

//   // 📌 UPDATE user (username or password)
//   const updateUser = async (req, res) => {
//     const { userId } = req.params;
//     const { username, password } = req.body;

//     try {
//       const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
//       if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

//       const user = userRes.rows[0];
//       let hashedPassword = user.password;

//       if (password && user.auth_type === 'manual') {
//         hashedPassword = await bcrypt.hash(password, 10);
//       }

//       await pool.query(
//         `UPDATE users
//          SET username = COALESCE($1, username),
//              password = COALESCE($2, password),
//              updated_at = NOW()
//          WHERE id = $3`,
//         [username, hashedPassword, userId]
//       );

//       res.status(200).json({ message: 'User updated successfully' });
//     } catch (err) {
//       console.error('Error updating user:', err);
//       res.status(500).json({ error: 'Failed to update user' });
//     }
//   };

//   // 📌 UNBLOCK specific user
//   const unblockUser = async (req, res) => {
//     const { userId } = req.params;

//     try {
//       const user = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [userId]);
//       if (user.rows.length === 0)
//         return res.status(404).json({ error: 'User not found' });

//       if (!user.rows[0].is_blocked)
//         return res.status(400).json({ message: 'User is already unblocked' });

//       await pool.query('UPDATE users SET is_blocked = false, updated_at = NOW() WHERE id = $1', [userId]);
//       res.status(200).json({ message: 'User unblocked successfully' });
//     } catch (err) {
//       console.error('Error unblocking user:', err);
//       res.status(500).json({ error: 'Failed to unblock user' });
//     }
//   };

//   return {
//     getAllUsers,
//     toggleBlockUser,
//     updateUser,
//     unblockUser,
//   };
// };
// const bcrypt = require('bcrypt');

// module.exports = (pool) => {
//   // 📌 GET all users
//   const getAllUsers = async (req, res) => {
//     try {
//       const result = await pool.query(`
//         SELECT id, username, email, auth_type, google_uid, firebase_uid, profile_image, is_blocked, role, created_at, updated_at
//         FROM users
//       `);
//       res.status(200).json(result.rows);
//     } catch (err) {
//       console.error('Error fetching users:', err);
//       res.status(500).json({ error: 'Failed to fetch users' });
//     }
//   };

//   // 📌 TOGGLE block/unblock user
//   const toggleBlockUser = async (req, res) => {
//     const { userId } = req.params;
//     try {
//       const user = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [userId]);
//       if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });

//       const newStatus = !user.rows[0].is_blocked;
//       await pool.query(
//         'UPDATE users SET is_blocked = $1, updated_at = NOW() WHERE id = $2',
//         [newStatus, userId]
//       );

//       res.status(200).json({ message: `User ${newStatus ? 'blocked' : 'unblocked'} successfully` });
//     } catch (err) {
//       console.error('Error updating block status:', err);
//       res.status(500).json({ error: 'Failed to update user status' });
//     }
//   };

//   // 📌 UPDATE user (username or password)
//   const updateUser = async (req, res) => {
//     const { userId } = req.params;
//     const { username, password } = req.body;

//     try {
//       const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
//       if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

//       const user = userRes.rows[0];
//       let hashedPassword = user.password;

//       if (password && user.auth_type === 'manual') {
//         hashedPassword = await bcrypt.hash(password, 10);
//       }

//       await pool.query(
//         `UPDATE users
//          SET username = COALESCE($1, username),
//              password = COALESCE($2, password),
//              updated_at = NOW()
//          WHERE id = $3`,
//         [username, hashedPassword, userId]
//       );

//       res.status(200).json({ message: 'User updated successfully' });
//     } catch (err) {
//       console.error('Error updating user:', err);
//       res.status(500).json({ error: 'Failed to update user' });
//     }
//   };

//   // 📌 UNBLOCK specific user
//   const unblockUser = async (req, res) => {
//     const { userId } = req.params;

//     try {
//       const user = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [userId]);
//       if (user.rows.length === 0)
//         return res.status(404).json({ error: 'User not found' });

//       if (!user.rows[0].is_blocked)
//         return res.status(400).json({ message: 'User is already unblocked' });

//       await pool.query('UPDATE users SET is_blocked = false, updated_at = NOW() WHERE id = $1', [userId]);
//       res.status(200).json({ message: 'User unblocked successfully' });
//     } catch (err) {
//       console.error('Error unblocking user:', err);
//       res.status(500).json({ error: 'Failed to unblock user' });
//     }
//   };

//   // 📌 GET all sessions for a specific user
//   const getUserSessions = async (req, res) => {
//     const { userId } = req.params;

//     try {
//       const result = await pool.query(`
//         SELECT id, login_at, logout_at, created_at
//         FROM user_sessions
//         WHERE user_id = $1
//         ORDER BY login_at DESC
//       `, [userId]);

//       res.status(200).json({ userId, sessions: result.rows });
//     } catch (err) {
//       console.error('Error fetching user sessions:', err.message);
//       res.status(500).json({ error: 'Failed to fetch user sessions' });
//     }
//   };

//   // 📌 GET all users with their latest session info
//   const getAllUsersWithLastSession = async (req, res) => {
//     try {
//       const result = await pool.query(`
//         SELECT 
//           u.id, u.username, u.email, u.role, u.is_blocked, u.created_at, u.updated_at,
//           s.login_at AS last_login_at,
//           s.logout_at AS last_logout_at
//         FROM users u
//         LEFT JOIN LATERAL (
//           SELECT login_at, logout_at
//           FROM user_sessions
//           WHERE user_id = u.id
//           ORDER BY login_at DESC
//           LIMIT 1
//         ) s ON true
//         ORDER BY u.id
//       `);

//       res.status(200).json(result.rows);
//     } catch (err) {
//       console.error('Error fetching users with sessions:', err.message);
//       res.status(500).json({ error: 'Failed to fetch user activity' });
//     }
//   };

//   return {
//     getAllUsers,
//     toggleBlockUser,
//     updateUser,
//     unblockUser,
//     getUserSessions,
//     getAllUsersWithLastSession,
//   };
// };
// const bcrypt = require('bcrypt');

// module.exports = (pool) => {
//   // 📌 GET all users
//   const getAllUsers = async (req, res) => {
//     try {
//       const result = await pool.query(`
//         SELECT id, username, email, auth_type, google_uid, firebase_uid,
//                profile_image, is_blocked, role, created_at, updated_at
//         FROM users
//       `);
//       res.status(200).json(result.rows);
//     } catch (err) {
//       console.error('Error fetching users:', err);
//       res.status(500).json({ error: 'Failed to fetch users' });
//     }
//   };

//   // 📌 TOGGLE block/unblock user
//   const toggleBlockUser = async (req, res) => {
//     const { userId } = req.params;
//     try {
//       const user = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [userId]);
//       if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });

//       const newStatus = !user.rows[0].is_blocked;
//       await pool.query(
//         'UPDATE users SET is_blocked = $1, updated_at = NOW() WHERE id = $2',
//         [newStatus, userId]
//       );

//       res.status(200).json({ message: `User ${newStatus ? 'blocked' : 'unblocked'} successfully` });
//     } catch (err) {
//       console.error('Error updating block status:', err);
//       res.status(500).json({ error: 'Failed to update user status' });
//     }
//   };

//   // 📌 UPDATE user (username or password)
//   const updateUser = async (req, res) => {
//     const { userId } = req.params;
//     const { username, password } = req.body;

//     try {
//       const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
//       if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

//       const user = userRes.rows[0];
//       let hashedPassword = user.password;

//       if (password && user.auth_type === 'manual') {
//         hashedPassword = await bcrypt.hash(password, 10);
//       }

//       await pool.query(
//         `UPDATE users
//          SET username = COALESCE($1, username),
//              password = COALESCE($2, password),
//              updated_at = NOW()
//          WHERE id = $3`,
//         [username, hashedPassword, userId]
//       );

//       res.status(200).json({ message: 'User updated successfully' });
//     } catch (err) {
//       console.error('Error updating user:', err);
//       res.status(500).json({ error: 'Failed to update user' });
//     }
//   };

//   // 📌 UNBLOCK specific user
//   const unblockUser = async (req, res) => {
//     const { userId } = req.params;

//     try {
//       const user = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [userId]);
//       if (user.rows.length === 0)
//         return res.status(404).json({ error: 'User not found' });

//       if (!user.rows[0].is_blocked)
//         return res.status(400).json({ message: 'User is already unblocked' });

//       await pool.query('UPDATE users SET is_blocked = false, updated_at = NOW() WHERE id = $1', [userId]);
//       res.status(200).json({ message: 'User unblocked successfully' });
//     } catch (err) {
//       console.error('Error unblocking user:', err);
//       res.status(500).json({ error: 'Failed to unblock user' });
//     }
//   };

//   // 📌 GET login/logout sessions for a user
//   const getUserSessions = async (req, res) => {
//     const { userId } = req.params;

//     try {
//       const result = await pool.query(
//         'SELECT login_time, logout_time FROM user_sessions WHERE user_id = $1 ORDER BY login_time DESC',
//         [userId]
//       );
//       res.status(200).json(result.rows);
//     } catch (err) {
//       console.error('Error fetching user sessions:', err);
//       res.status(500).json({ error: 'Failed to fetch user sessions' });
//     }
//   };

//   // 📌 GET latest session (login/logout) info for all users
//   const getAllUsersWithLastSession = async (req, res) => {
//     try {
//       const result = await pool.query(`
//         SELECT u.id, u.username, u.email, us.login_time, us.logout_time
//         FROM users u
//         LEFT JOIN LATERAL (
//           SELECT login_time, logout_time
//           FROM user_sessions
//           WHERE user_id = u.id
//           ORDER BY login_time DESC
//           LIMIT 1
//         ) us ON true
//         ORDER BY us.login_time DESC NULLS LAST;
//       `);
//       res.status(200).json(result.rows);
//     } catch (err) {
//       console.error('Error fetching user sessions:', err);
//       res.status(500).json({ error: 'Failed to fetch user sessions' });
//     }
//   };

//   return {
//     getAllUsers,
//     toggleBlockUser,
//     updateUser,
//     unblockUser,
//     getUserSessions,
//     getAllUsersWithLastSession
//   };
// };
const bcrypt = require('bcrypt');

module.exports = (pool) => {
  // 📌 GET all users
  const getAllUsers = async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, username, email, auth_type, google_uid, firebase_uid,
               profile_image, is_blocked, role, created_at, updated_at
        FROM users
        ORDER BY created_at DESC
      `);
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Error fetching users:', err);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  };

  // 📌 TOGGLE block/unblock user
  const toggleBlockUser = async (req, res) => {
    const { userId } = req.params;
    try {
      const user = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [userId]);
      if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const newStatus = !user.rows[0].is_blocked;
      await pool.query(
        'UPDATE users SET is_blocked = $1, updated_at = NOW() WHERE id = $2',
        [newStatus, userId]
      );

      res.status(200).json({ 
        message: `User ${newStatus ? 'blocked' : 'unblocked'} successfully`,
        is_blocked: newStatus
      });
    } catch (err) {
      console.error('Error updating block status:', err);
      res.status(500).json({ error: 'Failed to update user status' });
    }
  };

  // 📌 UPDATE user (username or password)
  const updateUser = async (req, res) => {
    const { userId } = req.params;
    const { username, password } = req.body;

    try {
      const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const user = userRes.rows[0];
      let hashedPassword = user.password;

      // Only hash password if provided and user is manual auth type
      if (password && password.trim() && user.auth_type === 'manual') {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      // Build update query dynamically
      let updateFields = [];
      let values = [];
      let paramIndex = 1;

      if (username && username.trim()) {
        updateFields.push(`username = $${paramIndex++}`);
        values.push(username.trim());
      }

      if (password && password.trim() && user.auth_type === 'manual') {
        updateFields.push(`password = $${paramIndex++}`);
        values.push(hashedPassword);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(userId);

      const updateQuery = `
        UPDATE users
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, username, email, auth_type, is_blocked, role, created_at, updated_at
      `;

      const result = await pool.query(updateQuery, values);

      res.status(200).json({ 
        message: 'User updated successfully',
        user: result.rows[0]
      });
    } catch (err) {
      console.error('Error updating user:', err);
      res.status(500).json({ error: 'Failed to update user' });
    }
  };

  // 📌 UNBLOCK specific user
  const unblockUser = async (req, res) => {
    const { userId } = req.params;

    try {
      const user = await pool.query('SELECT is_blocked FROM users WHERE id = $1', [userId]);
      if (user.rows.length === 0)
        return res.status(404).json({ error: 'User not found' });

      if (!user.rows[0].is_blocked)
        return res.status(400).json({ message: 'User is already unblocked' });

      await pool.query(
        'UPDATE users SET is_blocked = false, updated_at = NOW() WHERE id = $1', 
        [userId]
      );
      
      res.status(200).json({ message: 'User unblocked successfully' });
    } catch (err) {
      console.error('Error unblocking user:', err);
      res.status(500).json({ error: 'Failed to unblock user' });
    }
  };

  // 📌 GET login/logout sessions for a specific user
  const getUserSessions = async (req, res) => {
    const { userId } = req.params;

    try {
      const result = await pool.query(
        `SELECT id, login_time, logout_time, created_at
         FROM user_sessions 
         WHERE user_id = $1 
         ORDER BY login_time DESC 
         LIMIT 50`,
        [userId]
      );
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Error fetching user sessions:', err);
      res.status(500).json({ error: 'Failed to fetch user sessions' });
    }
  };

  // 📌 GET all users with their latest session info
  const getAllUsersWithLastSession = async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          u.id, 
          u.username, 
          u.email, 
          u.auth_type,
          u.google_uid,
          u.firebase_uid,
          u.profile_image,
          u.is_blocked, 
          u.role, 
          u.created_at, 
          u.updated_at,
          us.login_time,
          us.logout_time
        FROM users u
        LEFT JOIN LATERAL (
          SELECT login_time, logout_time
          FROM user_sessions
          WHERE user_id = u.id
          ORDER BY login_time DESC
          LIMIT 1
        ) us ON true
        ORDER BY 
          CASE WHEN u.is_blocked THEN 1 ELSE 0 END,
          us.login_time DESC NULLS LAST,
          u.created_at DESC
      `);
      
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Error fetching users with sessions:', err);
      res.status(500).json({ error: 'Failed to fetch user sessions' });
    }
  };

  // 📌 GET user details by ID
  const getUserById = async (req, res) => {
    const { userId } = req.params;

    try {
      const result = await pool.query(`
        SELECT id, username, email, auth_type, google_uid, firebase_uid,
               profile_image, is_blocked, role, created_at, updated_at
        FROM users
        WHERE id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.status(200).json(result.rows[0]);
    } catch (err) {
      console.error('Error fetching user:', err);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  };

  // 📌 GET user stats (optional - for dashboard)
  const getUserStats = async (req, res) => {
    try {
      const stats = await pool.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE is_blocked = true) as blocked_users,
          COUNT(*) FILTER (WHERE is_blocked = false) as active_users,
          COUNT(*) FILTER (WHERE auth_type = 'google') as google_users,
          COUNT(*) FILTER (WHERE auth_type = 'manual') as manual_users
        FROM users
      `);

      const recentSessions = await pool.query(`
        SELECT COUNT(*) as recent_logins
        FROM user_sessions
        WHERE login_time >= NOW() - INTERVAL '7 days'
      `);

      res.status(200).json({
        ...stats.rows[0],
        recent_logins: recentSessions.rows[0].recent_logins
      });
    } catch (err) {
      console.error('Error fetching user stats:', err);
      res.status(500).json({ error: 'Failed to fetch user statistics' });
    }
  };

  // 📌 GET solo users (account_type = 'SOLO')
  const getSoloUsers = async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          u.id, 
          u.username, 
          u.email, 
          u.auth_type,
          u.google_uid,
          u.firebase_uid,
          u.profile_image,
          u.is_blocked, 
          u.role, 
          u.account_type,
          u.approval_status,
          u.first_login,
          u.is_active,
          u.created_at, 
          u.updated_at,
          upp.full_name,
          upp.state_bar_council,
          upp.mobile,
          upp.office_address,
          upp.city,
          upp.state,
          upp.pin_code,
          upp.pan_number,
          upp.gst_number,
          us.login_time,
          us.logout_time
        FROM users u
        LEFT JOIN user_professional_profiles upp ON u.id = upp.user_id
        LEFT JOIN LATERAL (
          SELECT login_time, logout_time
          FROM user_sessions
          WHERE user_id = u.id
          ORDER BY login_time DESC
          LIMIT 1
        ) us ON true
        WHERE u.account_type = 'SOLO'
        ORDER BY 
          CASE WHEN u.is_blocked THEN 1 ELSE 0 END,
          us.login_time DESC NULLS LAST,
          u.created_at DESC
      `);
      
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Error fetching solo users:', err);
      res.status(500).json({ error: 'Failed to fetch solo users' });
    }
  };

  // 📌 GET all firms
  const getAllFirms = async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          f.*,
          u.username as admin_username,
          u.email as admin_email,
          COUNT(fu.user_id) as total_users
        FROM firms f
        LEFT JOIN users u ON f.admin_user_id = u.id
        LEFT JOIN firm_users fu ON f.id = fu.firm_id
        GROUP BY f.id, u.username, u.email
        ORDER BY f.created_at DESC
      `);
      
      res.status(200).json(result.rows);
    } catch (err) {
      console.error('Error fetching firms:', err);
      res.status(500).json({ error: 'Failed to fetch firms' });
    }
  };

  // 📌 GET firm by ID with all details
  const getFirmById = async (req, res) => {
    const { firmId } = req.params;

    try {
      // Get firm details
      const firmResult = await pool.query(`
        SELECT 
          f.*,
          u.username as admin_username,
          u.email as admin_email
        FROM firms f
        LEFT JOIN users u ON f.admin_user_id = u.id
        WHERE f.id = $1
      `, [firmId]);

      if (firmResult.rows.length === 0) {
        return res.status(404).json({ error: 'Firm not found' });
      }

      const firm = firmResult.rows[0];

      // Get firm users
      const usersResult = await pool.query(`
        SELECT 
          fu.id,
          fu.role,
          fu.created_at,
          u.id as user_id,
          u.username,
          u.email,
          u.is_blocked,
          u.is_active
        FROM firm_users fu
        JOIN users u ON fu.user_id = u.id
        WHERE fu.firm_id = $1
        ORDER BY fu.created_at DESC
      `, [firmId]);

      firm.users = usersResult.rows;

      res.status(200).json(firm);
    } catch (err) {
      console.error('Error fetching firm:', err);
      res.status(500).json({ error: 'Failed to fetch firm details' });
    }
  };

  // 📌 UPDATE firm approval status
  const updateFirmApproval = async (req, res) => {
    const { firmId } = req.params;
    const { approval_status } = req.body;

    if (!approval_status || !['PENDING', 'APPROVED', 'REJECTED'].includes(approval_status)) {
      return res.status(400).json({ error: 'Invalid approval_status. Must be PENDING, APPROVED, or REJECTED' });
    }

    try {
      // Get firm details first
      const firmResult = await pool.query(`
        SELECT f.*, u.email as admin_email, u.username as admin_username
        FROM firms f
        LEFT JOIN users u ON f.admin_user_id = u.id
        WHERE f.id = $1
      `, [firmId]);

      if (firmResult.rows.length === 0) {
        return res.status(404).json({ error: 'Firm not found' });
      }

      const firm = firmResult.rows[0];

      // Update approval status
      const updateResult = await pool.query(`
        UPDATE firms 
        SET approval_status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [approval_status, firmId]);

      // If approved, generate certificate and send email
      if (approval_status === 'APPROVED') {
        try {
          const { generateCertificate } = require('../services/certificateService');
          const { getFirmApprovalEmailTemplate } = require('../utils/emailTemplates');
          const sendEmail = require('../utils/sendEmail');

          // Generate UUID first (will be used as certificate ID from database)
          // This UUID will be displayed on the certificate
          const { v4: uuidv4 } = require('uuid');
          const certificateUuid = uuidv4();

          // Generate certificate with UUID
          console.log('Generating certificate for firm:', firm.firm_name);
          const certificateData = await generateCertificate(firm, certificateUuid);

          // Save certificate to database with the UUID
          const certificateResult = await pool.query(`
            INSERT INTO firm_certificates (
              id,
              firm_id, 
              certificate_path, 
              issue_date, 
              expiry_date, 
              is_active
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
          `, [
            certificateUuid,
            firmId,
            certificateData.certificatePath,
            certificateData.issueDate,
            certificateData.expiryDate,
            true
          ]);

          console.log('Certificate saved to database with UUID:', certificateResult.rows[0].id);

          // Send approval email with certificate link (using signed URL)
          const emailHtml = getFirmApprovalEmailTemplate(firm, certificateData.signedUrl);
          
          await sendEmail({
            email: firm.email,
            subject: 'Firm Registration Approved - Jurinex Legal AI Assistant',
            html: emailHtml,
            text: `Congratulations! Your firm "${firm.firm_name}" has been officially approved. You can now access our AI services. Download your certificate (valid for 24 hours): ${certificateData.signedUrl}`
          });

          console.log('Approval email sent to:', firm.email);

            return res.status(200).json({ 
            message: `Firm approved successfully. Certificate generated and email sent.`,
            firm: updateResult.rows[0],
            certificate: {
              id: certificateResult.rows[0].id,
              signedUrl: certificateData.signedUrl,
              urlExpiresAt: certificateData.urlExpiresAt
            }
          });

        } catch (certError) {
          console.error('Error generating certificate or sending email:', certError);
          // Still return success for approval, but log the error
          return res.status(200).json({ 
            message: `Firm approved successfully, but certificate generation failed. Please try again.`,
            firm: updateResult.rows[0],
            error: certError.message
          });
        }
      }

      res.status(200).json({ 
        message: `Firm ${approval_status.toLowerCase()} successfully`,
        firm: updateResult.rows[0]
      });
    } catch (err) {
      console.error('Error updating firm approval:', err);
      res.status(500).json({ error: 'Failed to update firm approval status' });
    }
  };

  // 📌 DELETE firm
  const deleteFirm = async (req, res) => {
    const { firmId } = req.params;

    try {
      const result = await pool.query(`
        DELETE FROM firms 
        WHERE id = $1
        RETURNING id, firm_name
      `, [firmId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Firm not found' });
      }

      res.status(200).json({ 
        message: 'Firm deleted successfully',
        firm: result.rows[0]
      });
    } catch (err) {
      console.error('Error deleting firm:', err);
      res.status(500).json({ error: 'Failed to delete firm' });
    }
  };

  // 📌 GET certificate by firm ID with signed URL
  const getFirmCertificate = async (req, res) => {
    const { firmId } = req.params;

    try {
      const result = await pool.query(`
        SELECT * FROM firm_certificates
        WHERE firm_id = $1 AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `, [firmId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Certificate not found for this firm' });
      }

      const certificate = result.rows[0];
      
      // Generate a new signed URL for the certificate (valid for 30 days)
      try {
        const { storage } = require('../config/gcs');
        const certificateBucketName = process.env.CERTIFICATE_BUCKET_NAME;
        if (!certificateBucketName) {
          throw new Error('CERTIFICATE_BUCKET_NAME is not set');
        }

        // Extract file path from gs:// URL
        const gsPath = certificate.certificate_path;
        const fileName = gsPath.replace(`gs://${certificateBucketName}/`, '');
        const file = storage.bucket(certificateBucketName).file(fileName);

        // Generate signed URL (valid for 24 hours)
        const [signedUrl] = await file.getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        });

        res.status(200).json({
          ...certificate,
          signedUrl: signedUrl,
          urlExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
      } catch (urlError) {
        console.error('Error generating signed URL:', urlError);
        // Return certificate data without signed URL if generation fails
        res.status(200).json({
          ...certificate,
          error: 'Failed to generate download URL. Please contact support.'
        });
      }
    } catch (err) {
      console.error('Error fetching certificate:', err);
      res.status(500).json({ error: 'Failed to fetch certificate' });
    }
  };

  return {
    getAllUsers,
    toggleBlockUser,
    updateUser,
    unblockUser,
    getUserSessions,
    getAllUsersWithLastSession,
    getUserById,
    getUserStats,
    getSoloUsers,
    getAllFirms,
    getFirmById,
    updateFirmApproval,
    deleteFirm,
    getFirmCertificate
  };
};