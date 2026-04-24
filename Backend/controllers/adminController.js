




// const bcrypt = require('bcrypt');
// const nodemailer = require('nodemailer');
// require('dotenv').config();

// // Configure nodemailer
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST || 'smtp.your-email.com',
//   port: process.env.SMTP_PORT || 587,
//   secure: false,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// module.exports = (pool) => {
//   /**
//    * @desc Create a new admin (super-admin only)
//    * @route POST /api/admins/create
//    * @access Super-admin
//    */
//   const createAdmin = async (req, res) => {
//     try {
//       const { name, email, password, role_name } = req.body;

//       // Validate input
//       if (!name || !email || !password || !role_name) {
//         return res.status(400).json({ message: 'All fields are required' });
//       }

//       // Check if email already exists
//       const existingUser = await pool.query('SELECT * FROM super_admins WHERE email=$1', [email]);
//       if (existingUser.rows.length) {
//         return res.status(400).json({ message: 'Email already exists' });
//       }

//       // Get role_id from admin_roles table
//       const roleRes = await pool.query('SELECT id FROM admin_roles WHERE name=$1', [role_name]);
//       if (!roleRes.rows.length) return res.status(400).json({ message: 'Invalid role' });
//       const role_id = roleRes.rows[0].id;

//       // Hash password
//       const hashedPassword = await bcrypt.hash(password, 10);

//       // Insert new admin
//       const newAdminRes = await pool.query(
//         `INSERT INTO super_admins (name, email, password, role, role_id)
//          VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role`,
//         [name, email, hashedPassword, role_name, role_id]
//       );
//       const newAdmin = newAdminRes.rows[0];

//       // Send email with credentials
//       await transporter.sendMail({
//         from: process.env.EMAIL_USER,
//         to: email,
//         subject: 'Admin Account Created',
//         html: `<p>Hello ${name},</p>
//                <p>Your admin account has been created successfully.</p>
//                <p><strong>Email:</strong> ${email}</p>
//                <p><strong>Password:</strong> ${password}</p>
//                <p><strong>Role:</strong> ${role_name}</p>`,
//       });

//       return res.status(201).json({
//         success: true,
//         message: 'Admin created successfully and email sent',
//         admin: newAdmin,
//       });

//     } catch (error) {
//       console.error('Create Admin Error:', error.message);
//       return res.status(500).json({ success: false, message: 'Server Error' });
//     }
//   };

//   return { createAdmin };
// };


// const bcrypt = require('bcrypt');
// const nodemailer = require('nodemailer');
// require('dotenv').config();

// module.exports = (pool) => {
//   // Configure nodemailer transporter
//   const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST || 'smtp.your-email.com',
//     port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
//     secure: false, // true for 465, false for other ports
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS,
//     },
//   });

//   const createAdmin = async (req, res) => {
//     try {
//       const { name, email, password, role_name } = req.body;

//       // Validate input
//       if (!name || !email || !password || !role_name) {
//         return res.status(400).json({ message: 'All fields are required' });
//       }

//       // Check if email already exists
//       const existingUser = await pool.query('SELECT * FROM super_admins WHERE email=$1', [email]);
//       if (existingUser.rows.length > 0) {
//         return res.status(400).json({ message: 'Email already exists' });
//       }

//       // Get role_id from admin_roles table
//       const roleRes = await pool.query('SELECT id FROM admin_roles WHERE name=$1', [role_name]);
//       if (roleRes.rows.length === 0) {
//         return res.status(400).json({ message: 'Invalid role' });
//       }
//       const role_id = roleRes.rows[0].id;

//       // Hash password
//       const hashedPassword = await bcrypt.hash(password, 10);

//       // Insert new admin
//       const newAdminRes = await pool.query(
//         `INSERT INTO super_admins (name, email, password, role, role_id)
//          VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role`,
//         [name, email, hashedPassword, role_name, role_id]
//       );
//       const newAdmin = newAdminRes.rows[0];

//       // Send email (optional: wrap in try/catch so it doesn't block response)
//       try {
//         await transporter.sendMail({
//           from: process.env.EMAIL_USER,
//           to: email,
//           subject: 'Admin Account Created',
//           html: `<p>Hello ${name},</p>
//                  <p>Your admin account has been created successfully.</p>
//                  <p><strong>Email:</strong> ${email}</p>
//                  <p><strong>Password:</strong> ${password}</p>
//                  <p><strong>Role:</strong> ${role_name}</p>`,
//         });
//       } catch (emailError) {
//         console.error('Email send failed:', emailError.message);
//       }

//       return res.status(201).json({
//         success: true,
//         message: 'Admin created successfully',
//         admin: newAdmin,
//       });

//     } catch (error) {
//       console.error('Create Admin Error:', error.message);
//       return res.status(500).json({ success: false, message: 'Server Error' });
//     }
//   };

//   return { createAdmin };
// };
// const bcrypt = require('bcrypt');
// // const nodemailer = require('nodemailer'); // temporarily not needed
// require('dotenv').config();

// module.exports = (pool) => {
//   /*
//   // Configure nodemailer transporter (temporarily disabled)
//   const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST || 'smtp.your-email.com',
//     port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
//     secure: false,
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS,
//     },
//   });
//   */

//   const createAdmin = async (req, res) => {
//     try {
//       const { name, email, password, role_name } = req.body;

//       if (!name || !email || !password || !role_name) {
//         return res.status(400).json({ message: 'All fields are required' });
//       }

//       const existingUser = await pool.query(
//         'SELECT * FROM super_admins WHERE email=$1',
//         [email]
//       );
//       if (existingUser.rows.length > 0) {
//         return res.status(400).json({ message: 'Email already exists' });
//       }

//       const roleRes = await pool.query(
//         'SELECT id FROM admin_roles WHERE name=$1',
//         [role_name]
//       );
//       if (roleRes.rows.length === 0) {
//         return res.status(400).json({ message: 'Invalid role' });
//       }
//       const role_id = roleRes.rows[0].id;

//       const hashedPassword = await bcrypt.hash(password, 10);

//       const newAdminRes = await pool.query(
//         `INSERT INTO super_admins (name, email, password, role, role_id)
//          VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role`,
//         [name, email, hashedPassword, role_name, role_id]
//       );
//       const newAdmin = newAdminRes.rows[0];

//       /*
//       // Email sending temporarily disabled
//       try {
//         await transporter.sendMail({
//           from: process.env.EMAIL_USER,
//           to: email,
//           subject: 'Admin Account Created',
//           html: `<p>Hello ${name},</p>
//                  <p>Your admin account has been created successfully.</p>
//                  <p><strong>Email:</strong> ${email}</p>
//                  <p><strong>Password:</strong> ${password}</p>
//                  <p><strong>Role:</strong> ${role_name}</p>`,
//         });
//       } catch (emailError) {
//         console.error('Email send failed:', emailError.message);
//       }
//       */

//       return res.status(201).json({
//         success: true,
//         message: 'Admin created successfully',
//         admin: newAdmin,
//       });

//     } catch (error) {
//       console.error('Create Admin Error:', error.message);
//       return res.status(500).json({ success: false, message: 'Server Error' });
//     }
//   };

//   return { createAdmin };
// };


const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const sendEmail = require('../utils/sendEmail');
const SupportAdminProfile = require('../models/support_admin_profile');
const { getAdminCreationEmailTemplate, getAdminDeletionEmailTemplate, getAdminUpdateEmailTemplate } = require('../utils/emailTemplates');
const logger = require('../config/logger');
const { summarizeValue } = require('../utils/logging.utils');

const normalizeText = (value) => String(value || '').trim();

const normalizeSupportQueue = (value, fallback = 'all') => {
  const normalized = normalizeText(value).toLowerCase();
  return ['all', 'assigned_to_me', 'my_team', 'unassigned', 'closed'].includes(normalized)
    ? normalized
    : fallback;
};

const buildSupportAdminProfilePayload = ({ adminId, teamName, defaultQueue, actorAdminId }) => ({
  admin_id: Number(adminId),
  manager_admin_id: Number(adminId),
  team_name: teamName || 'Support Team',
  is_team_manager: true,
  can_manage_team: true,
  can_view_all_tickets: true,
  can_view_assigned_to_me: true,
  can_view_team_tickets: true,
  can_view_unassigned_tickets: true,
  can_view_closed_tickets: true,
  can_view_archived_tickets: false,
  default_queue: normalizeSupportQueue(defaultQueue, 'all'),
  is_active: true,
});

const isSuperAdminsPrimaryKeyConflict = (error) =>
  error?.code === '23505' && String(error?.constraint || '').trim() === 'super_admins_pkey';

const isMissingRelationError = (error) => {
  const errorCode =
    error?.original?.code ||
    error?.parent?.code ||
    error?.code ||
    null;

  return errorCode === '42P01' || /relation .* does not exist/i.test(String(error?.message || ''));
};

let ensureSupportAdminProfilesTablePromise = null;

const ensureSupportAdminProfilesTable = async () => {
  if (!ensureSupportAdminProfilesTablePromise) {
    ensureSupportAdminProfilesTablePromise = SupportAdminProfile.sync()
      .catch((error) => {
        ensureSupportAdminProfilesTablePromise = null;
        throw error;
      });
  }

  return ensureSupportAdminProfilesTablePromise;
};

const fetchSupportAdminProfilesMap = async () => {
  try {
    await ensureSupportAdminProfilesTable();
    const profiles = await SupportAdminProfile.findAll({ raw: true });
    return new Map(profiles.map((profile) => [Number(profile.admin_id), profile]));
  } catch (error) {
    if (isMissingRelationError(error)) {
      logger.warn('Support admin profiles table is not ready yet. Returning admins without support profile metadata.', {
        layer: 'ADMIN_CONTROLLER',
      });
      return new Map();
    }

    throw error;
  }
};

const syncSuperAdminsIdSequence = async (pool) => {
  const sequenceResult = await pool.query(
    `SELECT pg_get_serial_sequence('super_admins', 'id') AS sequence_name`
  );

  const sequenceName = sequenceResult.rows[0]?.sequence_name || null;
  if (!sequenceName) return null;

  await pool.query(
    `SELECT setval($1::regclass, COALESCE((SELECT MAX(id) FROM super_admins), 0) + 1, false)`,
    [sequenceName]
  );

  return sequenceName;
};

const insertAdminWithSequenceSync = async (pool, values) => {
  await syncSuperAdminsIdSequence(pool);

  const insertOnce = () =>
    pool.query(
      `INSERT INTO super_admins (name, email, password, role, role_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role`,
      values
    );

  try {
    return await insertOnce();
  } catch (error) {
    if (!isSuperAdminsPrimaryKeyConflict(error)) {
      throw error;
    }

    await syncSuperAdminsIdSequence(pool);
    return insertOnce();
  }
};

module.exports = (pool) => {

  // CREATE ADMIN
  const createAdmin = async (req, res) => {
    try {
      const { name, email, password, role_name } = req.body;
      const teamName = normalizeText(req.body.team_name || req.body.teamName);
      const defaultQueue = normalizeSupportQueue(req.body.default_queue || req.body.defaultQueue, 'all');
      logger.flow('Create admin request received', {
        requestId: req.requestId,
        layer: 'ADMIN_CONTROLLER',
        summary: {
          action: 'createAdmin',
          role: role_name,
        },
        input: summarizeValue({
          name,
          email,
          role_name,
          team_name: teamName || null,
          default_queue: defaultQueue,
        }),
      });

      if (!name || !email || !password || !role_name) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      if (role_name === 'support-admin' && !teamName) {
        return res.status(400).json({ message: 'Support admin must have a team / group name' });
      }

      const existingUser = await pool.query('SELECT * FROM super_admins WHERE email=$1', [email]);
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ message: 'Email already exists' });
      }

      const roleRes = await pool.query('SELECT id FROM admin_roles WHERE name=$1', [role_name]);
      if (roleRes.rows.length === 0) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      const role_id = roleRes.rows[0].id;

      const hashedPassword = await bcrypt.hash(password, 10);

      const newAdminRes = await insertAdminWithSequenceSync(pool, [
        name,
        email,
        hashedPassword,
        role_name,
        role_id,
      ]);
      const newAdmin = newAdminRes.rows[0];

      if (role_name === 'support-admin') {
        await ensureSupportAdminProfilesTable();
        await SupportAdminProfile.create({
          ...buildSupportAdminProfilePayload({
            adminId: newAdmin.id,
            teamName: teamName || `${name} Team`,
            defaultQueue,
            actorAdminId: req.user?.id,
          }),
          created_by_admin_id: req.user?.id || null,
          updated_by_admin_id: req.user?.id || null,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      // Send admin creation email
      try {
        await sendEmail({
          email: email,
          subject: 'Admin Account Created - Nexintel',
          html: getAdminCreationEmailTemplate(name, email, password),
        });
      } catch (emailError) {
        logger.errorWithContext('Failed to send admin creation email', emailError, {
          requestId: req.requestId,
          layer: 'ADMIN_CONTROLLER',
          summary: {
            action: 'createAdmin',
            adminId: newAdmin.id,
          },
          context: {
            email,
          },
        });
      }

      logger.flow('Admin created successfully', {
        requestId: req.requestId,
        layer: 'ADMIN_CONTROLLER',
        summary: {
          action: 'createAdmin',
          adminId: newAdmin.id,
          role: role_name,
        },
        output: summarizeValue({
          id: newAdmin.id,
          name: newAdmin.name,
          email: newAdmin.email,
          team_name: role_name === 'support-admin' ? teamName || `${name} Team` : null,
          default_queue: role_name === 'support-admin' ? defaultQueue : null,
        }),
      });

      return res.status(201).json({
        success: true,
        message: 'Admin created successfully',
        admin: {
          ...newAdminRes.rows[0],
          team_name: role_name === 'support-admin' ? teamName || `${name} Team` : null,
          default_queue: role_name === 'support-admin' ? defaultQueue : null,
        },
      });

    } catch (error) {
      logger.errorWithContext('Create admin failed', error, {
        requestId: req.requestId,
        layer: 'ADMIN_CONTROLLER',
        summary: {
          action: 'createAdmin',
        },
        input: summarizeValue(req.body),
      });
      return res.status(500).json({ success: false, message: 'Server Error' });
    }
  };

  // // FETCH ALL ADMINS
  // const fetchAdmins = async (req, res) => {
  //   try {
  //     const adminsRes = await pool.query('SELECT id, name, email, role FROM super_admins ORDER BY id DESC');
  //     return res.status(200).json({ success: true, admins: adminsRes.rows });
  //   } catch (error) {
  //     console.error('Fetch Admins Error:', error.message);
  //     return res.status(500).json({ success: false, message: 'Server Error' });
  //   }
  // };
// FETCH ALL ADMINS WITH ROLE DETAILS
const fetchAdmins = async (req, res) => {
  try {
    const query = `
      SELECT 
        a.id,
        a.name,
        a.email,
        a.role,
        a.role_id,
        a.is_blocked,
        r.name AS role_name,
        r.description AS role_description,
        a.created_at,
        a.updated_at
      FROM super_admins a
      LEFT JOIN admin_roles r ON a.role_id = r.id
      ORDER BY a.id DESC
    `;

    const [result, supportProfilesByAdminId] = await Promise.all([
      pool.query(query),
      fetchSupportAdminProfilesMap(),
    ]);

    const admins = result.rows.map((admin) => {
      const supportProfile = supportProfilesByAdminId.get(Number(admin.id));

      return {
        ...admin,
        team_name: supportProfile?.team_name || null,
        default_queue: supportProfile?.default_queue || null,
        is_team_manager: Boolean(supportProfile?.is_team_manager),
      };
    });

    logger.flow('Admin list loaded', {
      requestId: req.requestId,
      layer: 'ADMIN_CONTROLLER',
      summary: {
        action: 'fetchAdmins',
        total: admins.length,
        supportAdmins: admins.filter((admin) => admin.role === 'support-admin').length,
      },
    });
    logger.table(
      'Admin list preview',
      admins.slice(0, 10).map((admin) => ({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        team_name: admin.team_name || '-',
        blocked: Boolean(admin.is_blocked),
      })),
      {
        requestId: req.requestId,
        layer: 'ADMIN_CONTROLLER',
      }
    );

    return res.status(200).json({
      success: true,
      total: admins.length,
      admins,
    });
  } catch (error) {
    logger.errorWithContext('Fetch admins failed', error, {
      requestId: req.requestId,
      layer: 'ADMIN_CONTROLLER',
      summary: {
        action: 'fetchAdmins',
      },
    });
    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

  // UPDATE ADMIN
  const updateAdmin = async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, password, role_name } = req.body;
      const teamName = normalizeText(req.body.team_name || req.body.teamName);
      const defaultQueue = normalizeSupportQueue(req.body.default_queue || req.body.defaultQueue, 'all');
      logger.flow('Update admin request received', {
        requestId: req.requestId,
        layer: 'ADMIN_CONTROLLER',
        summary: {
          action: 'updateAdmin',
          adminId: id,
        },
        input: summarizeValue({
          name,
          email,
          role_name,
          team_name: teamName || null,
          default_queue: defaultQueue,
          password_provided: Boolean(password),
        }),
      });

      const adminRes = await pool.query('SELECT * FROM super_admins WHERE id=$1', [id]);
      if (adminRes.rows.length === 0) {
        return res.status(404).json({ message: 'Admin not found' });
      }

      let hashedPassword = adminRes.rows[0].password;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      let role_id = adminRes.rows[0].role_id;
      if (role_name) {
        const roleRes = await pool.query('SELECT id FROM admin_roles WHERE name=$1', [role_name]);
        if (roleRes.rows.length === 0) {
          return res.status(400).json({ message: 'Invalid role' });
        }
        role_id = roleRes.rows[0].id;
      }

      const updatedAdminRes = await pool.query(
        `UPDATE super_admins
         SET name=$1, email=$2, password=$3, role=$4, role_id=$5
         WHERE id=$6
         RETURNING id, name, email, role`,
        [name || adminRes.rows[0].name,
         email || adminRes.rows[0].email,
         hashedPassword,
         role_name || adminRes.rows[0].role,
         role_id,
         id]
      );

      const updatedAdmin = updatedAdminRes.rows[0];
      const nextRole = role_name || adminRes.rows[0].role;
      await ensureSupportAdminProfilesTable();
      const existingProfile = await SupportAdminProfile.findOne({
        where: { admin_id: Number(id) },
      });

      if (nextRole === 'support-admin') {
        if (existingProfile) {
          await existingProfile.update({
            ...buildSupportAdminProfilePayload({
              adminId: id,
              teamName: teamName || existingProfile.team_name || `${updatedAdmin.name} Team`,
              defaultQueue,
              actorAdminId: req.user?.id,
            }),
            updated_by_admin_id: req.user?.id || null,
            updated_at: new Date(),
          });
        } else {
          await SupportAdminProfile.create({
            ...buildSupportAdminProfilePayload({
              adminId: id,
              teamName: teamName || `${updatedAdmin.name} Team`,
              defaultQueue,
              actorAdminId: req.user?.id,
            }),
            created_by_admin_id: req.user?.id || null,
            updated_by_admin_id: req.user?.id || null,
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      } else if (existingProfile) {
        await existingProfile.update({
          is_active: false,
          updated_by_admin_id: req.user?.id || null,
          updated_at: new Date(),
        });
      }

      // Send admin update email
      try {
        const updatedFields = {};
        if (name && name !== adminRes.rows[0].name) updatedFields.name = name;
        if (email && email !== adminRes.rows[0].email) updatedFields.email = email;
        if (role_name && role_name !== adminRes.rows[0].role) updatedFields.role = role_name;
        if (teamName) updatedFields.team_name = teamName;
        if (password) updatedFields.password = password; // Include password if updated, as per user request.

        if (Object.keys(updatedFields).length > 0) {
          await sendEmail({
            email: adminRes.rows[0].email, // Send to the original email in case it was changed
            subject: 'Admin Account Updated - Nexintel',
            html: getAdminUpdateEmailTemplate(adminRes.rows[0].name, adminRes.rows[0].email, updatedFields),
          });
        }
      } catch (emailError) {
        logger.errorWithContext('Failed to send admin update email', emailError, {
          requestId: req.requestId,
          layer: 'ADMIN_CONTROLLER',
          summary: {
            action: 'updateAdmin',
            adminId: id,
          },
        });
      }

      logger.flow('Admin updated successfully', {
        requestId: req.requestId,
        layer: 'ADMIN_CONTROLLER',
        summary: {
          action: 'updateAdmin',
          adminId: id,
          role: nextRole,
        },
        output: summarizeValue({
          id: updatedAdmin.id,
          name: updatedAdmin.name,
          email: updatedAdmin.email,
          role: updatedAdmin.role,
          team_name: nextRole === 'support-admin' ? teamName || null : null,
          default_queue: nextRole === 'support-admin' ? defaultQueue : null,
        }),
      });

      return res.status(200).json({
        success: true,
        message: 'Admin updated successfully',
        admin: {
          ...updatedAdmin,
          team_name: nextRole === 'support-admin' ? teamName || null : null,
          default_queue: nextRole === 'support-admin' ? defaultQueue : null,
        },
      });

    } catch (error) {
      logger.errorWithContext('Update admin failed', error, {
        requestId: req.requestId,
        layer: 'ADMIN_CONTROLLER',
        summary: {
          action: 'updateAdmin',
          adminId: req.params.id,
        },
        input: summarizeValue(req.body),
      });
      return res.status(500).json({ success: false, message: 'Server Error' });
    }
  };

  // DELETE ADMIN
  const deleteAdmin = async (req, res) => {
    try {
      const { id } = req.params;
      logger.flow('Delete admin request received', {
        requestId: req.requestId,
        layer: 'ADMIN_CONTROLLER',
        summary: {
          action: 'deleteAdmin',
          adminId: id,
        },
      });

      const adminRes = await pool.query('SELECT * FROM super_admins WHERE id=$1', [id]);
      if (adminRes.rows.length === 0) {
        return res.status(404).json({ message: 'Admin not found' });
      }

      const deletedAdmin = adminRes.rows[0];
      await pool.query('DELETE FROM super_admins WHERE id=$1', [id]);

      // Send admin deletion email
      try {
        await sendEmail({
          email: deletedAdmin.email,
          subject: 'Admin Account Deleted - Nexintel',
          html: getAdminDeletionEmailTemplate(deletedAdmin.name, deletedAdmin.email),
        });
      } catch (emailError) {
        logger.errorWithContext('Failed to send admin deletion email', emailError, {
          requestId: req.requestId,
          layer: 'ADMIN_CONTROLLER',
          summary: {
            action: 'deleteAdmin',
            adminId: id,
          },
        });
      }

      logger.flow('Admin deleted successfully', {
        requestId: req.requestId,
        layer: 'ADMIN_CONTROLLER',
        summary: {
          action: 'deleteAdmin',
          adminId: id,
        },
        output: summarizeValue({
          id: deletedAdmin.id,
          name: deletedAdmin.name,
          email: deletedAdmin.email,
          role: deletedAdmin.role,
        }),
      });

      return res.status(200).json({ success: true, message: 'Admin deleted successfully' });

    } catch (error) {
      logger.errorWithContext('Delete admin failed', error, {
        requestId: req.requestId,
        layer: 'ADMIN_CONTROLLER',
        summary: {
          action: 'deleteAdmin',
          adminId: req.params.id,
        },
      });
      return res.status(500).json({ success: false, message: 'Server Error' });
    }
  };

  return { createAdmin, fetchAdmins, updateAdmin, deleteAdmin };
};
