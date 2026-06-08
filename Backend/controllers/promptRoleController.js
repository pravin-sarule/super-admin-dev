// controllers/promptRoleController.js
const docPool = require('../config/docDB');
const paymentPool = require('../config/payment_DB');

// Auto-create prompt_roles table on first use
let tableReady = false;
const ensureTable = async () => {
  if (tableReady) return;
  await docPool.query(`
    CREATE TABLE IF NOT EXISTS prompt_roles (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      plan_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await docPool.query(`ALTER TABLE prompt_roles ADD COLUMN IF NOT EXISTS plan_id INTEGER`);
  await docPool.query(`
    INSERT INTO prompt_roles (name, description) VALUES
      ('charter', 'Charter domain prompts'),
      ('banking', 'Banking domain prompts'),
      ('finance', 'Finance domain prompts')
    ON CONFLICT (name) DO NOTHING
  `);
  tableReady = true;
};

async function fetchPlanById(planId) {
  if (!planId) return null;
  try {
    const { rows } = await paymentPool.query(
      'SELECT id, name, daily_token_limit AS token_limit, price, currency, billing_interval_months AS "interval", category AS type FROM monthly_plans WHERE id = $1',
      [planId]
    );
    return rows[0] || null;
  } catch {
    return null;
  }
}

/** Resolve user's active subscription plan from payment DB (best-effort across common table names). */
async function fetchUserSubscriptionPlan(userId) {
  const uid = Number(userId);
  if (!uid || Number.isNaN(uid)) return null;

  const queries = [
    `SELECT sp.id, sp.name, sp.token_limit, sp.price, sp.currency, sp."interval", sp.type
     FROM subscriptions s
     JOIN subscription_plans sp ON sp.id = s.plan_id
     WHERE s.user_id = $1 AND (s.status = 'active' OR s.status IS NULL)
     ORDER BY s.created_at DESC NULLS LAST LIMIT 1`,
    `SELECT sp.id, sp.name, sp.token_limit, sp.price, sp.currency, sp."interval", sp.type
     FROM user_subscriptions us
     JOIN subscription_plans sp ON sp.id = us.plan_id
     WHERE us.user_id = $1 AND (us.status = 'active' OR us.is_active = true)
     ORDER BY us.created_at DESC NULLS LAST LIMIT 1`,
    `SELECT sp.id, sp.name, sp.token_limit, sp.price, sp.currency, sp."interval", sp.type
     FROM user_plans up
     JOIN subscription_plans sp ON sp.id = up.plan_id
     WHERE up.user_id = $1 AND (up.status = 'active' OR up.is_active = true)
     ORDER BY up.created_at DESC NULLS LAST LIMIT 1`,
  ];

  for (const sql of queries) {
    try {
      const { rows } = await paymentPool.query(sql, [uid]);
      if (rows.length > 0) return { ...rows[0], source: 'user_subscription' };
    } catch {
      // table may not exist in this environment
    }
  }
  return null;
}

const enrichWithPlanInfo = async (roles) => {
  const planIds = [...new Set(roles.map((r) => r.plan_id).filter(Boolean))];
  if (planIds.length === 0) return roles.map((r) => ({ ...r, plan_info: null }));
  try {
    const { rows: plans } = await paymentPool.query(
      'SELECT id, name, daily_token_limit AS token_limit, price, currency, billing_interval_months AS "interval", category AS type FROM monthly_plans WHERE id = ANY($1)',
      [planIds]
    );
    const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));
    return roles.map((r) => ({ ...r, plan_info: r.plan_id ? (planMap[r.plan_id] || null) : null }));
  } catch {
    return roles.map((r) => ({ ...r, plan_info: null }));
  }
};

const getAllRoles = async (req, res) => {
  try {
    await ensureTable();
    const result = await docPool.query('SELECT * FROM prompt_roles ORDER BY created_at ASC');
    const enriched = await enrichWithPlanInfo(result.rows);
    res.status(200).json({ success: true, data: enriched });
  } catch (error) {
    console.error('Error fetching prompt roles:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const createRole = async (req, res) => {
  const { name, description, plan_id } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'Role name is required' });
  }

  try {
    await ensureTable();
    if (plan_id) {
      const plan = await fetchPlanById(plan_id);
      if (!plan) {
        return res.status(400).json({ message: 'Invalid plan_id — plan not found in payment service' });
      }
    }
    const existing = await docPool.query(
      'SELECT id FROM prompt_roles WHERE LOWER(name) = LOWER($1)',
      [name.trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Role name already exists' });
    }

    const result = await docPool.query(
      'INSERT INTO prompt_roles (name, description, plan_id) VALUES ($1, $2, $3) RETURNING *',
      [name.trim().toLowerCase(), description?.trim() || null, plan_id || null]
    );
    const [enriched] = await enrichWithPlanInfo([result.rows[0]]);
    res.status(201).json({ success: true, message: 'Role created successfully', data: enriched });
  } catch (error) {
    console.error('Error creating prompt role:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateRole = async (req, res) => {
  const { id } = req.params;
  const { name, description, plan_id } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json({ message: 'Role name is required' });
  }

  try {
    await ensureTable();
    if (plan_id) {
      const plan = await fetchPlanById(plan_id);
      if (!plan) {
        return res.status(400).json({ message: 'Invalid plan_id — plan not found in payment service' });
      }
    }
    const existing = await docPool.query(
      'SELECT id FROM prompt_roles WHERE LOWER(name) = LOWER($1) AND id != $2',
      [name.trim(), id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Role name already exists' });
    }

    const result = await docPool.query(
      `UPDATE prompt_roles SET name = $1, description = $2, plan_id = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [name.trim().toLowerCase(), description?.trim() || null, plan_id || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }
    const [enriched] = await enrichWithPlanInfo([result.rows[0]]);
    res.status(200).json({ success: true, message: 'Role updated successfully', data: enriched });
  } catch (error) {
    console.error('Error updating prompt role:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteRole = async (req, res) => {
  const { id } = req.params;
  try {
    await ensureTable();
    const result = await docPool.query('DELETE FROM prompt_roles WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }
    res.status(200).json({ success: true, message: 'Role deleted successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Error deleting prompt role:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getTokenLimitByRoleId = async (req, res) => {
  const { id } = req.params;
  try {
    await ensureTable();
    const roleResult = await docPool.query(
      'SELECT id, name, plan_id FROM prompt_roles WHERE id = $1',
      [id]
    );
    if (roleResult.rows.length === 0) {
      return res.status(404).json({ message: 'Role not found' });
    }
    const role = roleResult.rows[0];
    if (!role.plan_id) {
      return res.status(200).json({
        success: true,
        role_id: role.id,
        role_name: role.name,
        token_limit: null,
        plan: null,
        source: null,
        message: 'No plan assigned to this prompt role',
      });
    }
    const plan = await fetchPlanById(role.plan_id);
    if (!plan) {
      return res.status(200).json({
        success: true,
        role_id: role.id,
        role_name: role.name,
        token_limit: null,
        plan: null,
        source: 'role_plan',
        message: 'Assigned plan not found in payment service',
      });
    }
    res.status(200).json({
      success: true,
      role_id: role.id,
      role_name: role.name,
      token_limit: plan.token_limit,
      plan,
      source: 'role_plan',
    });
  } catch (error) {
    console.error('Error fetching token limit:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Resolve token limit for a user: prefers their active subscription plan, else prompt role's assigned plan.
 * @route GET /api/prompt-roles/user/:userId/token-limit?role_id=
 */
const getTokenLimitForUser = async (req, res) => {
  const { userId } = req.params;
  const roleId = req.query.role_id ? parseInt(req.query.role_id, 10) : null;

  try {
    await ensureTable();
    const userPlan = await fetchUserSubscriptionPlan(userId);
    let rolePlan = null;
    let role = null;

    if (roleId && !Number.isNaN(roleId)) {
      const roleResult = await docPool.query(
        'SELECT id, name, plan_id FROM prompt_roles WHERE id = $1',
        [roleId]
      );
      if (roleResult.rows.length > 0) {
        role = roleResult.rows[0];
        if (role.plan_id) {
          rolePlan = await fetchPlanById(role.plan_id);
          if (rolePlan) rolePlan = { ...rolePlan, source: 'role_plan' };
        }
      }
    }

    const effectivePlan = userPlan || rolePlan;
    const source = userPlan ? 'user_subscription' : (rolePlan ? 'role_plan' : null);

    res.status(200).json({
      success: true,
      user_id: Number(userId),
      role_id: role?.id || roleId || null,
      role_name: role?.name || null,
      token_limit: effectivePlan?.token_limit ?? null,
      plan: effectivePlan
        ? {
            id: effectivePlan.id,
            name: effectivePlan.name,
            token_limit: effectivePlan.token_limit,
            price: effectivePlan.price,
            currency: effectivePlan.currency,
            interval: effectivePlan.interval,
            type: effectivePlan.type,
          }
        : null,
      source,
      user_plan: userPlan
        ? { id: userPlan.id, name: userPlan.name, token_limit: userPlan.token_limit }
        : null,
      role_plan: rolePlan
        ? { id: rolePlan.id, name: rolePlan.name, token_limit: rolePlan.token_limit }
        : null,
      message: effectivePlan
        ? undefined
        : 'No active user subscription or prompt-role plan found',
    });
  } catch (error) {
    console.error('Error resolving user token limit:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllRoles,
  createRole,
  updateRole,
  deleteRole,
  getTokenLimitByRoleId,
  getTokenLimitForUser,
};
