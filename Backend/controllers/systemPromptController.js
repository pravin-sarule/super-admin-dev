// controllers/systemPromptController.js
const pool = require('../config/docDB');
const paymentPool = require('../config/payment_DB');

const ROLES_INFO_SQL = `
  COALESCE(
    (SELECT json_agg(json_build_object('id', pr.id, 'name', pr.name, 'plan_id', pr.plan_id))
     FROM prompt_roles pr
     WHERE pr.id = ANY(sp.assigned_role_ids)),
    '[]'
  ) AS assigned_roles_info
`;

async function enrichRolesInfo(rolesInfo) {
  const roles = Array.isArray(rolesInfo) ? rolesInfo : [];
  if (roles.length === 0) return [];

  const planIds = [...new Set(roles.map((r) => r.plan_id).filter(Boolean))];
  let planMap = {};
  if (planIds.length > 0) {
    try {
      const { rows: plans } = await paymentPool.query(
        'SELECT id, name, daily_token_limit AS token_limit FROM monthly_plans WHERE id = ANY($1)',
        [planIds]
      );
      planMap = Object.fromEntries(plans.map((p) => [p.id, p]));
    } catch {
      planMap = {};
    }
  }

  return roles.map((r) => {
    const plan = r.plan_id ? planMap[r.plan_id] : null;
    return {
      ...r,
      plan_name: plan?.name || null,
      token_limit: plan?.token_limit ?? null,
    };
  });
}

async function enrichPromptRow(row) {
  if (!row) return row;
  const assigned_roles_info = await enrichRolesInfo(row.assigned_roles_info);
  return { ...row, assigned_roles_info };
}

// Ensure assignment columns exist (safe to run multiple times)
let columnsReady = false;
const ensureColumns = async () => {
  if (columnsReady) return;
  await pool.query(`
    ALTER TABLE system_prompts
      ADD COLUMN IF NOT EXISTS assigned_role_ids INTEGER[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS assigned_user_ids INTEGER[] DEFAULT '{}'
  `);
  columnsReady = true;
};

const PROMPT_TYPES = ['general', 'chat_model', 'summarization', 'charter', 'banking', 'finance'];
const SERVICE_TYPES = ['chat_model', 'summarization'];

function normalizePromptType(raw) {
  const v = (raw == null ? 'general' : String(raw)).toLowerCase().trim();
  return PROMPT_TYPES.includes(v) ? v : null;
}

function toIntArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(Number).filter((n) => !isNaN(n));
  if (typeof val === 'string') {
    return val.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  }
  return [];
}

async function upsertServicePrompt(systemPrompt, promptType, assignedRoleIds, assignedUserIds) {
  const existing = await pool.query(
    'SELECT id FROM system_prompts WHERE prompt_type = $1',
    [promptType]
  );
  if (existing.rows.length > 0) {
    const result = await pool.query(
      `UPDATE system_prompts
       SET system_prompt = $1, assigned_role_ids = $2, assigned_user_ids = $3, updated_at = NOW()
       WHERE prompt_type = $4
       RETURNING *`,
      [systemPrompt, assignedRoleIds, assignedUserIds, promptType]
    );
    return { row: result.rows[0], created: false };
  }
  const result = await pool.query(
    `INSERT INTO system_prompts (system_prompt, prompt_type, assigned_role_ids, assigned_user_ids)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [systemPrompt, promptType, assignedRoleIds, assignedUserIds]
  );
  return { row: result.rows[0], created: true };
}

const createSystemPrompt = async (req, res) => {
  const { system_prompt } = req.body;
  const promptType = normalizePromptType(req.body.prompt_type);
  const assignedRoleIds = toIntArray(req.body.assigned_role_ids);
  const assignedUserIds = toIntArray(req.body.assigned_user_ids);

  if (!system_prompt || system_prompt.trim() === '') {
    return res.status(400).json({ message: 'System prompt is required' });
  }
  if (!promptType) {
    return res.status(400).json({
      message: `prompt_type must be one of: ${PROMPT_TYPES.join(', ')}`,
    });
  }

  try {
    await ensureColumns();
    if (SERVICE_TYPES.includes(promptType)) {
      const { row, created } = await upsertServicePrompt(
        system_prompt.trim(), promptType, assignedRoleIds, assignedUserIds
      );
      return res.status(created ? 201 : 200).json({
        success: true,
        message: created
          ? 'System prompt created successfully'
          : 'System prompt updated successfully (one prompt per service)',
        data: row,
      });
    }

    const result = await pool.query(
      `INSERT INTO system_prompts (system_prompt, prompt_type, assigned_role_ids, assigned_user_ids)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [system_prompt.trim(), promptType, assignedRoleIds, assignedUserIds]
    );

    res.status(201).json({
      success: true,
      message: 'System prompt created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating system prompt:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getAllSystemPrompts = async (req, res) => {
  try {
    await ensureColumns();
    const result = await pool.query(`
      SELECT sp.*, ${ROLES_INFO_SQL}
      FROM system_prompts sp
      ORDER BY
        CASE prompt_type
          WHEN 'chat_model' THEN 0
          WHEN 'summarization' THEN 1
          WHEN 'charter' THEN 2
          WHEN 'banking' THEN 3
          WHEN 'finance' THEN 4
          ELSE 5
        END,
        created_at DESC
    `);

    const data = await Promise.all(result.rows.map(enrichPromptRow));

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error('Error fetching system prompts:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getSystemPromptById = async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ message: 'Valid system prompt ID is required' });
  }

  try {
    const result = await pool.query(
      `SELECT sp.*, ${ROLES_INFO_SQL} FROM system_prompts sp WHERE sp.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'System prompt not found' });
    }

    const data = await enrichPromptRow(result.rows[0]);
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error fetching system prompt:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateSystemPrompt = async (req, res) => {
  const { id } = req.params;
  const { system_prompt } = req.body;
  const assignedRoleIds = req.body.assigned_role_ids !== undefined
    ? toIntArray(req.body.assigned_role_ids)
    : null;
  const assignedUserIds = req.body.assigned_user_ids !== undefined
    ? toIntArray(req.body.assigned_user_ids)
    : null;

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ message: 'Valid system prompt ID is required' });
  }
  if (!system_prompt || system_prompt.trim() === '') {
    return res.status(400).json({ message: 'System prompt is required' });
  }

  try {
    await ensureColumns();
    const setClauses = ['system_prompt = $1', 'updated_at = NOW()'];
    const values = [system_prompt.trim()];
    let idx = 2;

    if (assignedRoleIds !== null) {
      setClauses.push(`assigned_role_ids = $${idx++}`);
      values.push(assignedRoleIds);
    }
    if (assignedUserIds !== null) {
      setClauses.push(`assigned_user_ids = $${idx++}`);
      values.push(assignedUserIds);
    }
    values.push(id);

    const result = await pool.query(
      `UPDATE system_prompts SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'System prompt not found' });
    }

    res.status(200).json({
      success: true,
      message: 'System prompt updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating system prompt:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteSystemPrompt = async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ message: 'Valid system prompt ID is required' });
  }

  try {
    const result = await pool.query('DELETE FROM system_prompts WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'System prompt not found' });
    }
    res.status(200).json({
      success: true,
      message: 'System prompt deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting system prompt:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Public endpoint — returns prompts accessible by a given role or user ID
const getPromptsForUser = async (req, res) => {
  const { role_id, user_id } = req.query;
  const roleId = parseInt(role_id, 10) || null;
  const userId = parseInt(user_id, 10) || null;

  try {
    let query;
    let params;

    if (roleId && userId) {
      query = `SELECT * FROM system_prompts
               WHERE $1 = ANY(assigned_role_ids) OR $2 = ANY(assigned_user_ids)
               ORDER BY created_at DESC`;
      params = [roleId, userId];
    } else if (roleId) {
      query = `SELECT * FROM system_prompts WHERE $1 = ANY(assigned_role_ids) ORDER BY created_at DESC`;
      params = [roleId];
    } else if (userId) {
      query = `SELECT * FROM system_prompts WHERE $1 = ANY(assigned_user_ids) ORDER BY created_at DESC`;
      params = [userId];
    } else {
      return res.status(400).json({ message: 'Provide role_id or user_id query param' });
    }

    const result = await pool.query(query, params);
    res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    console.error('Error fetching prompts for user:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  createSystemPrompt,
  getAllSystemPrompts,
  getSystemPromptById,
  updateSystemPrompt,
  deleteSystemPrompt,
  getPromptsForUser,
};
