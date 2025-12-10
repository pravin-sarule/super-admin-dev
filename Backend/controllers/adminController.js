




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
require('dotenv').config();
const sendEmail = require('../utils/sendEmail');
const { getAdminCreationEmailTemplate, getAdminDeletionEmailTemplate, getAdminUpdateEmailTemplate } = require('../utils/emailTemplates');

module.exports = (pool) => {

  // CREATE ADMIN
  const createAdmin = async (req, res) => {
    try {
      const { name, email, password, role_name } = req.body;
      if (!name || !email || !password || !role_name) {
        return res.status(400).json({ message: 'All fields are required' });
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

      const newAdminRes = await pool.query(
        `INSERT INTO super_admins (name, email, password, role, role_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role`,
        [name, email, hashedPassword, role_name, role_id]
      );
      const newAdmin = newAdminRes.rows[0];

      // Send admin creation email
      try {
        await sendEmail({
          email: email,
          subject: 'Admin Account Created - Nexintel',
          html: getAdminCreationEmailTemplate(name, email, password),
        });
      } catch (emailError) {
        console.error('Error sending admin creation email:', emailError);
      }

      return res.status(201).json({
        success: true,
        message: 'Admin created successfully',
        admin: newAdminRes.rows[0],
      });

    } catch (error) {
      console.error('Create Admin Error:', error.message);
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
    // Join super_admins with admin_roles to get full role info
    const query = `
      SELECT 
        a.id,
        a.name,
        a.email,
        a.role,
        a.role_id,
        r.name AS role_name,
        r.description AS role_description,
        a.created_at,
        a.updated_at
      FROM super_admins a
      LEFT JOIN admin_roles r ON a.role_id = r.id
      ORDER BY a.id DESC
    `;

    const result = await pool.query(query);

    return res.status(200).json({
      success: true,
      total: result.rowCount,
      admins: result.rows
    });
  } catch (error) {
    console.error('Fetch Admins Error:', error.message);
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

      // Send admin update email
      try {
        const updatedFields = {};
        if (name && name !== adminRes.rows[0].name) updatedFields.name = name;
        if (email && email !== adminRes.rows[0].email) updatedFields.email = email;
        if (role_name && role_name !== adminRes.rows[0].role) updatedFields.role = role_name;
        if (password) updatedFields.password = password; // Include password if updated, as per user request.

        if (Object.keys(updatedFields).length > 0) {
          await sendEmail({
            email: adminRes.rows[0].email, // Send to the original email in case it was changed
            subject: 'Admin Account Updated - Nexintel',
            html: getAdminUpdateEmailTemplate(adminRes.rows[0].name, adminRes.rows[0].email, updatedFields),
          });
        }
      } catch (emailError) {
        console.error('Error sending admin update email:', emailError);
      }

      return res.status(200).json({
        success: true,
        message: 'Admin updated successfully',
        admin: updatedAdmin,
      });

    } catch (error) {
      console.error('Update Admin Error:', error.message);
      return res.status(500).json({ success: false, message: 'Server Error' });
    }
  };

  // DELETE ADMIN
  const deleteAdmin = async (req, res) => {
    try {
      const { id } = req.params;
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
        console.error('Error sending admin deletion email:', emailError);
      }

      return res.status(200).json({ success: true, message: 'Admin deleted successfully' });

    } catch (error) {
      console.error('Delete Admin Error:', error.message);
      return res.status(500).json({ success: false, message: 'Server Error' });
    }
  };

  return { createAdmin, fetchAdmins, updateAdmin, deleteAdmin };
};
