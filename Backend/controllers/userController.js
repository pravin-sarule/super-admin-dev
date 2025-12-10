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

  return {
    getAllUsers,
    toggleBlockUser,
    updateUser,
    unblockUser,
    getUserSessions,
    getAllUsersWithLastSession,
    getUserById,
    getUserStats
  };
};