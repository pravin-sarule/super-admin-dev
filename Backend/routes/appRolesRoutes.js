// routes/appRolesRoutes.js
// Manages user roles in the Jurinex application database (main pool)
const express = require('express');
const router = express.Router();
const docPool = require('../config/docDB');
const { protect, authorize } = require('../middleware/authMiddleware');

module.exports = (pool) => {
  // GET /api/app-roles — all roles (no firm filter, solo users)
  router.get('/', protect(pool), async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, name, description, is_system, is_active, created_at
         FROM roles
         ORDER BY is_system DESC, name ASC`
      );
      res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching app roles:', error.message);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // POST /api/app-roles — create a new custom role
  router.post('/', protect(pool), authorize(['super-admin']), async (req, res) => {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    try {
      const existing = await pool.query(
        'SELECT id FROM roles WHERE LOWER(name) = LOWER($1)',
        [name.trim()]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ message: 'Role name already exists' });
      }

      const result = await pool.query(
        `INSERT INTO roles (id, name, description, is_system, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, false, true, NOW(), NOW())
         RETURNING id, name, description, is_system, is_active, created_at`,
        [name.trim(), description?.trim() || null]
      );

      res.status(201).json({ success: true, message: 'Role created successfully', data: result.rows[0] });
    } catch (error) {
      console.error('Error creating app role:', error.message);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // PUT /api/app-roles/:id — update name/description for non-system roles
  router.put('/:id', protect(pool), authorize(['super-admin']), async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Role name is required' });
    }

    try {
      const found = await pool.query('SELECT id, is_system FROM roles WHERE id = $1', [id]);
      if (found.rows.length === 0) {
        return res.status(404).json({ message: 'Role not found' });
      }
      if (found.rows[0].is_system) {
        return res.status(403).json({ message: 'System roles cannot be edited' });
      }

      const duplicate = await pool.query(
        'SELECT id FROM roles WHERE LOWER(name) = LOWER($1) AND id != $2',
        [name.trim(), id]
      );
      if (duplicate.rows.length > 0) {
        return res.status(409).json({ message: 'Role name already exists' });
      }

      const result = await pool.query(
        `UPDATE roles SET name = $1, description = $2, updated_at = NOW() WHERE id = $3
         RETURNING id, name, description, is_system, is_active, created_at`,
        [name.trim(), description?.trim() || null, id]
      );
      res.status(200).json({ success: true, message: 'Role updated successfully', data: result.rows[0] });
    } catch (error) {
      console.error('Error updating app role:', error.message);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

  // DELETE /api/app-roles/:id — permanently remove custom roles
  router.delete('/:id', protect(pool), authorize(['super-admin']), async (req, res) => {
    const { id } = req.params;
    try {
      const found = await pool.query('SELECT id, name, is_system FROM roles WHERE id = $1', [id]);
      if (found.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Role not found' });
      }
      if (found.rows[0].is_system) {
        return res.status(403).json({ success: false, message: 'System roles cannot be deleted' });
      }

      const usersUsing = await pool.query(
        'SELECT COUNT(*)::int AS count FROM users WHERE role_id = $1',
        [id]
      );
      const userCount = usersUsing.rows[0]?.count ?? 0;
      if (userCount > 0) {
        return res.status(409).json({
          success: false,
          message: `Cannot delete "${found.rows[0].name}": ${userCount} user(s) are still assigned this role. Reassign those users in the main app first.`,
          users_assigned: userCount,
        });
      }

      await docPool.query(
        'UPDATE secret_manager SET role_id = NULL WHERE role_id = $1',
        [id]
      ).catch(() => {});

      await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);
      await pool.query('DELETE FROM user_roles WHERE role_id = $1', [id]);
      await pool.query('DELETE FROM invite_tokens WHERE role_id = $1', [id]);

      const deleted = await pool.query('DELETE FROM roles WHERE id = $1 RETURNING id', [id]);
      if (deleted.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'Role not found' });
      }

      res.status(200).json({ success: true, message: 'Role deleted successfully' });
    } catch (error) {
      console.error('Error deleting app role:', error.message);
      if (error.code === '23503') {
        return res.status(409).json({
          success: false,
          message: 'Role is still referenced by other records and cannot be deleted.',
        });
      }
      res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  });

  return router;
};
