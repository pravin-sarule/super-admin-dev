
// const Template = require('../models/template');
// const UserTemplateUsage = require('../models/userTemplateUsage');
// const { bucket } = require('../middleware/upload');
// const { Op } = require('sequelize');

// // POST /admin/templates
// exports.createTemplate = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: 'No file uploaded.' });
//     }

//     const { name, category, type, status = 'active' } = req.body;
//     const gcs_path = req.file.gcsUrl;

//     const template = await Template.create({
//       name,
//       category,
//       type,
//       status,
//       gcs_path,
//     });

//     res.status(201).json({
//       message: 'Template uploaded and added successfully',
//       template,
//     });
//   } catch (error) {
//     console.error('Error creating template:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };

// // GET /admin/templates
// exports.getAllTemplates = async (req, res) => {
//   try {
//     const templates = await Template.findAll({
//       include: [{
//         model: UserTemplateUsage,
//         attributes: [],
//         duplicating: false,
//       }],
//       attributes: {
//         include: [
//           [
//             Template.sequelize.literal(`(
//               SELECT COUNT(*)
//               FROM user_template_usage AS usage
//               WHERE usage.template_id = "Template"."id"
//             )`),
//             'usageCount'
//           ]
//         ]
//       },
//       order: [['created_at', 'DESC']],
//     });

//     res.status(200).json(templates);
//   } catch (error) {
//     console.error('Error fetching templates:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };

// // GET /admin/templates/:id
// exports.getTemplateById = async (req, res) => {
//   try {
//     const template = await Template.findByPk(req.params.id, {
//       include: [{
//         model: UserTemplateUsage,
//         attributes: [],
//         duplicating: false,
//       }],
//       attributes: {
//         include: [
//           [
//             Template.sequelize.literal(`(
//               SELECT COUNT(*)
//               FROM user_template_usage AS usage
//               WHERE usage.template_id = "Template"."id"
//             )`),
//             'usageCount'
//           ]
//         ]
//       },
//     });

//     if (!template) {
//       return res.status(404).json({ message: 'Template not found' });
//     }

//     res.status(200).json(template);
//   } catch (error) {
//     console.error('Error fetching template by ID:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };

// // PUT /admin/templates/:id
// exports.updateTemplate = async (req, res) => {
//   try {
//     const { name, category, type, status } = req.body;
//     const template = await Template.findByPk(req.params.id);

//     if (!template) {
//       return res.status(404).json({ message: 'Template not found' });
//     }

//     template.name = name || template.name;
//     template.category = category || template.category;
//     template.type = type || template.type;
//     template.status = status || template.status;
//     template.updated_at = new Date();

//     await template.save();

//     res.status(200).json({
//       message: 'Template updated successfully',
//       template,
//     });
//   } catch (error) {
//     console.error('Error updating template:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };

// // DELETE /admin/templates/:id
// exports.deleteTemplate = async (req, res) => {
//   try {
//     const template = await Template.findByPk(req.params.id);

//     if (!template) {
//       return res.status(404).json({ message: 'Template not found' });
//     }

//     // Extract filename
//     const gcsFileName = template.gcs_path.split('/').slice(-2).join('/');
//     const file = bucket.file(gcsFileName);

//     // Delete from GCS
//     await file.delete().catch(err => {
//       console.warn('GCS file not found or already deleted:', err.message);
//     });

//     await template.destroy();

//     res.status(200).json({ message: 'Template deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting template:', error);
//     res.status(500).json({ message: 'Server error', error: error.message });
//   }
// };



const draftDB = require('../config/draftDB');
const { bucket } = require('../middleware/upload');

// POST /admin/templates
exports.createTemplate = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const { name, category, type, status = 'active' } = req.body;
    const gcs_path = req.file.gcsUrl;

    console.log('📝 Creating template in draftDB...');

    const result = await draftDB.query(
      `INSERT INTO templates (id, name, category, type, status, gcs_path, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING *`,
      [name, category, type, status, gcs_path]
    );

    const template = result.rows[0];

    res.status(201).json({
      message: 'Template uploaded and added successfully',
      template,
    });
  } catch (error) {
    console.error('🚨 Error creating template:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /admin/templates - only admin-added templates (user_id IS NULL)
exports.getAllTemplates = async (req, res) => {
  try {
    console.log('📋 Fetching admin templates from draftDB (user_id IS NULL)...');

    const result = await draftDB.query(
      `SELECT 
        t.*,
        COALESCE(
          (SELECT COUNT(*) 
           FROM user_template_usage u 
           WHERE u.template_id = t.id), 0
        ) AS "usageCount"
       FROM templates t
       WHERE t.user_id IS NULL
       ORDER BY t.created_at DESC`
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('🚨 Error fetching templates:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /admin/templates/:id - only admin-added template (user_id IS NULL)
exports.getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📦 Fetching admin template by ID from draftDB:', id);

    const result = await draftDB.query(
      `SELECT 
        t.*,
        COALESCE(
          (SELECT COUNT(*) 
           FROM user_template_usage u 
           WHERE u.template_id = t.id), 0
        ) AS "usageCount"
       FROM templates t
       WHERE t.id = $1 AND t.user_id IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Template not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('🚨 Error fetching template by ID:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT /admin/templates/:id
exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, type, status } = req.body;

    console.log('✏️ Updating template in draftDB:', id);

    // Only allow updating admin-added templates (user_id IS NULL)
    const checkResult = await draftDB.query(
      'SELECT * FROM templates WHERE id = $1 AND user_id IS NULL',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let valueIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${valueIndex++}`);
      values.push(name);
    }
    if (category !== undefined) {
      updates.push(`category = $${valueIndex++}`);
      values.push(category);
    }
    if (type !== undefined) {
      updates.push(`type = $${valueIndex++}`);
      values.push(type);
    }
    if (status !== undefined) {
      updates.push(`status = $${valueIndex++}`);
      values.push(status);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const updateQuery = `
      UPDATE templates 
      SET ${updates.join(', ')}
      WHERE id = $${valueIndex} AND user_id IS NULL
      RETURNING *
    `;

    const result = await draftDB.query(updateQuery, values);

    res.status(200).json({
      message: 'Template updated successfully',
      template: result.rows[0],
    });
  } catch (error) {
    console.error('🚨 Error updating template:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE /admin/templates/:id
exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Deleting template from draftDB:', id);

    // Only allow deleting admin-added templates (user_id IS NULL)
    const result = await draftDB.query(
      'SELECT * FROM templates WHERE id = $1 AND user_id IS NULL',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Template not found' });
    }

    const template = result.rows[0];

    // Extract filename from GCS path
    const gcsFileName = template.gcs_path.split('/').slice(-2).join('/');
    const file = bucket.file(gcsFileName);

    // Delete from GCS
    try {
      await file.delete();
      console.log('✅ File deleted from GCS');
    } catch (err) {
      console.warn('⚠️ GCS file not found or already deleted:', err.message);
    }

    // Delete from database (only admin template)
    await draftDB.query('DELETE FROM templates WHERE id = $1 AND user_id IS NULL', [id]);

    res.status(200).json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('🚨 Error deleting template:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /admin/templates/category/:category
exports.getTemplatesByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    console.log('📂 Fetching templates by category from draftDB:', category);

    const result = await draftDB.query(
      `SELECT 
        t.*,
        COALESCE(
          (SELECT COUNT(*) 
           FROM user_template_usage u 
           WHERE u.template_id = t.id), 0
        ) AS "usageCount"
       FROM templates t
       WHERE t.category = $1
       ORDER BY t.created_at DESC`,
      [category]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('🚨 Error fetching templates by category:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET /admin/templates/search/:query
exports.searchTemplates = async (req, res) => {
  try {
    const { query } = req.params;

    console.log('🔍 Searching templates in draftDB:', query);

    const result = await draftDB.query(
      `SELECT 
        t.*,
        COALESCE(
          (SELECT COUNT(*) 
           FROM user_template_usage u 
           WHERE u.template_id = t.id), 0
        ) AS "usageCount"
       FROM templates t
       WHERE t.name ILIKE $1 OR t.category ILIKE $1 OR t.type ILIKE $1
       ORDER BY t.created_at DESC`,
      [`%${query}%`]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('🚨 Error searching templates:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};