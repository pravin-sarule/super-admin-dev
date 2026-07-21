// controllers/userPresetPromptController.js
// Super-admin access to end-user preset prompts (read + assign).
//
// The prompt tables live in Document_DB (docPool) and are owned by the document/chat
// service. Their user_id is TEXT, while users live in the main Auth_DB (pool) with an
// INTEGER id — so the two cannot be joined in SQL. We stitch them in JS, the same way
// systemPromptController joins docDB prompts to paymentDB plans.
//
// Anything this controller inserts is stamped created_by='superadmin'. Because the
// document service already scopes its own queries to WHERE user_id = <caller>, a row
// written here shows up in that user's workspace automatically and is invisible to
// everyone else — no change needed on that side.
const docPool = require('../config/docDB');
const pool = require('../config/db');
const logger = require('../config/logger');

const SOURCE_USER = 'user';
const SOURCE_ADMIN = 'superadmin';

const UNIQUE_VIOLATION = '23505';

/** Trim to a string, returning '' for null/undefined. */
const str = (v) => String(v ?? '').trim();

/**
 * Look up display info for a set of TEXT user ids from the main DB.
 * Non-numeric ids are skipped (users.id is an integer column).
 * @returns {Promise<Map<string, object>>} keyed by the ORIGINAL text id
 */
const fetchUserDetails = async (textUserIds) => {
  const map = new Map();

  const numeric = [];
  for (const raw of textUserIds) {
    const trimmed = str(raw);
    if (trimmed !== '' && /^\d+$/.test(trimmed)) {
      numeric.push({ text: trimmed, num: Number(trimmed) });
    }
  }
  if (numeric.length === 0) return map;

  try {
    const { rows } = await pool.query(
      `SELECT id, username, email, account_type, is_blocked
         FROM users
        WHERE id = ANY($1::int[])`,
      [numeric.map((n) => n.num)]
    );

    const byNum = new Map(rows.map((r) => [Number(r.id), r]));
    for (const { text, num } of numeric) {
      const user = byNum.get(num);
      if (user) map.set(text, user);
    }
  } catch (err) {
    // Enrichment is best-effort — a failure here must not hide the prompts themselves.
    logger.error('Failed to enrich preset-prompt user ids from main DB', {
      layer: 'USER_PRESET_PROMPTS',
      error: err.message,
    });
  }

  return map;
};

/**
 * Resolve super_admins.id -> email for the "added by" label.
 * @returns {Promise<Map<number, string>>}
 */
const fetchAdminEmails = async (adminIds) => {
  const map = new Map();
  const ids = [...new Set(adminIds.filter((id) => Number.isInteger(id)))];
  if (ids.length === 0) return map;

  try {
    const { rows } = await pool.query(
      `SELECT id, email FROM super_admins WHERE id = ANY($1::int[])`,
      [ids]
    );
    rows.forEach((r) => map.set(Number(r.id), r.email));
  } catch (err) {
    logger.error('Failed to resolve admin emails for preset prompts', {
      layer: 'USER_PRESET_PROMPTS',
      error: err.message,
    });
  }

  return map;
};

/**
 * Confirm a user exists in the main DB before we write prompts against their id.
 * Prevents assigning prompts to a typo'd id that nobody will ever see.
 */
const assertUserExists = async (userId) => {
  if (!/^\d+$/.test(userId)) return null;
  const { rows } = await pool.query(
    `SELECT id, username, email FROM users WHERE id = $1`,
    [Number(userId)]
  );
  return rows[0] || null;
};

/* -------------------------------------------------------------------------- */
/*                                    READ                                     */
/* -------------------------------------------------------------------------- */

/**
 * GET /api/user-preset-prompts/directory
 * Lightweight user list for the "assign to user" picker.
 */
const getUserDirectory = async (req, res) => {
  try {
    const search = str(req.query.search);
    const params = [];
    let where = '';

    if (search) {
      params.push(`%${search}%`);
      where = `WHERE username ILIKE $1 OR email ILIKE $1 OR CAST(id AS TEXT) ILIKE $1`;
    }

    const { rows } = await pool.query(
      `SELECT id, username, email, account_type
         FROM users
         ${where}
        ORDER BY username NULLS LAST
        LIMIT 200`,
      params
    );

    return res.json({
      success: true,
      count: rows.length,
      data: rows.map((r) => ({
        user_id: String(r.id), // string, to match the TEXT user_id in the prompt tables
        username: r.username,
        email: r.email,
        account_type: r.account_type,
      })),
    });
  } catch (err) {
    logger.error('Failed to load user directory', {
      layer: 'USER_PRESET_PROMPTS',
      error: err.message,
    });
    return res.status(500).json({ success: false, message: 'Failed to load users' });
  }
};

/**
 * GET /api/user-preset-prompts/users
 * Per-user rollup, split by who created the prompts.
 */
const getUsersWithPresetPrompts = async (req, res) => {
  try {
    const { rows } = await docPool.query(
      `SELECT g.user_id,
              COUNT(DISTINCT g.id) AS groups,
              COUNT(p.id)          AS prompts,
              COUNT(p.id) FILTER (WHERE p.created_by = $1) AS admin_prompts,
              COUNT(p.id) FILTER (WHERE p.created_by = $2) AS user_prompts,
              MAX(p.updated_at)    AS last_activity
         FROM user_prompt_groups g
         LEFT JOIN user_custom_prompts p ON p.group_id = g.id
        GROUP BY g.user_id
        ORDER BY last_activity DESC NULLS LAST`,
      [SOURCE_ADMIN, SOURCE_USER]
    );

    const userDetails = await fetchUserDetails(rows.map((r) => r.user_id));

    const data = rows.map((r) => {
      const user = userDetails.get(str(r.user_id));
      const adminPrompts = Number(r.admin_prompts) || 0;
      const userPrompts = Number(r.user_prompts) || 0;

      // What to show in the single "Added By" column: whoever contributed, or Mixed.
      let addedBy = 'none';
      if (adminPrompts > 0 && userPrompts > 0) addedBy = 'mixed';
      else if (adminPrompts > 0) addedBy = SOURCE_ADMIN;
      else if (userPrompts > 0) addedBy = SOURCE_USER;

      return {
        user_id: r.user_id,
        username: user?.username || null,
        email: user?.email || null,
        account_type: user?.account_type || null,
        is_blocked: user?.is_blocked ?? null,
        groups: Number(r.groups) || 0,
        prompts: Number(r.prompts) || 0,
        admin_prompts: adminPrompts,
        user_prompts: userPrompts,
        added_by: addedBy,
        last_activity: r.last_activity,
      };
    });

    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    logger.error('Failed to list users with preset prompts', {
      layer: 'USER_PRESET_PROMPTS',
      error: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ success: false, message: 'Failed to fetch preset prompt users' });
  }
};

/**
 * GET /api/user-preset-prompts/users/:userId
 * Every group for one user, each with its prompts nested. Empty groups are included
 * (LEFT JOIN) so a folder the user made but never filled still shows up.
 */
const getPresetPromptsByUser = async (req, res) => {
  const userId = str(req.params.userId);

  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  try {
    const { rows } = await docPool.query(
      `SELECT g.id          AS group_id,
              g.name        AS group_name,
              g.description AS group_description,
              g.created_at  AS group_created_at,
              g.updated_at  AS group_updated_at,
              g.created_by  AS group_created_by,
              g.created_by_admin_id AS group_created_by_admin_id,
              p.id          AS prompt_id,
              p.name        AS prompt_name,
              p.description AS prompt_description,
              p.prompt_text,
              p.created_at  AS prompt_created_at,
              p.updated_at  AS prompt_updated_at,
              p.created_by  AS prompt_created_by,
              p.created_by_admin_id AS prompt_created_by_admin_id
         FROM user_prompt_groups g
         LEFT JOIN user_custom_prompts p ON p.group_id = g.id
        WHERE g.user_id = $1
        ORDER BY g.created_at, p.created_at`,
      [userId] // TEXT column — compare as string, never cast to int
    );

    // Collapse the flat join into groups -> prompts.
    const groupsById = new Map();
    const adminIds = [];

    for (const row of rows) {
      if (!groupsById.has(row.group_id)) {
        if (row.group_created_by_admin_id) adminIds.push(Number(row.group_created_by_admin_id));
        groupsById.set(row.group_id, {
          id: row.group_id,
          name: row.group_name,
          description: row.group_description,
          created_at: row.group_created_at,
          updated_at: row.group_updated_at,
          created_by: row.group_created_by,
          created_by_admin_id: row.group_created_by_admin_id,
          prompts: [],
        });
      }
      // prompt_id is null for a group with no prompts.
      if (row.prompt_id) {
        if (row.prompt_created_by_admin_id) adminIds.push(Number(row.prompt_created_by_admin_id));
        groupsById.get(row.group_id).prompts.push({
          id: row.prompt_id,
          name: row.prompt_name,
          description: row.prompt_description,
          prompt_text: row.prompt_text,
          created_at: row.prompt_created_at,
          updated_at: row.prompt_updated_at,
          created_by: row.prompt_created_by,
          created_by_admin_id: row.prompt_created_by_admin_id,
        });
      }
    }

    const adminEmails = await fetchAdminEmails(adminIds);
    const label = (entity) =>
      entity.created_by === SOURCE_ADMIN
        ? adminEmails.get(Number(entity.created_by_admin_id)) || 'Superadmin'
        : null;

    const groups = Array.from(groupsById.values()).map((g) => ({
      ...g,
      created_by_label: label(g),
      prompts: g.prompts.map((p) => ({ ...p, created_by_label: label(p) })),
    }));

    const userDetails = await fetchUserDetails([userId]);
    const user = userDetails.get(userId);

    return res.json({
      success: true,
      data: {
        user: {
          user_id: userId,
          username: user?.username || null,
          email: user?.email || null,
          account_type: user?.account_type || null,
        },
        totals: {
          groups: groups.length,
          prompts: groups.reduce((sum, g) => sum + g.prompts.length, 0),
        },
        groups,
      },
    });
  } catch (err) {
    logger.error('Failed to fetch preset prompts for user', {
      layer: 'USER_PRESET_PROMPTS',
      error: err.message,
      stack: err.stack,
      userId,
    });
    return res.status(500).json({ success: false, message: 'Failed to fetch preset prompts' });
  }
};

/* -------------------------------------------------------------------------- */
/*                                   WRITE                                     */
/* -------------------------------------------------------------------------- */

/**
 * Find a user's group by name (case-insensitive, matching the DB's unique index),
 * or create it as a superadmin-owned group. Runs inside the caller's transaction.
 */
const findOrCreateGroup = async (client, { userId, name, description, adminId }) => {
  const existing = await client.query(
    `SELECT id, name, created_by FROM user_prompt_groups
      WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
    [userId, name]
  );
  if (existing.rows[0]) return { group: existing.rows[0], created: false };

  try {
    const inserted = await client.query(
      `INSERT INTO user_prompt_groups (user_id, name, description, created_by, created_by_admin_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, created_by`,
      [userId, name, description || null, SOURCE_ADMIN, adminId]
    );
    return { group: inserted.rows[0], created: true };
  } catch (err) {
    // Lost a race against a concurrent insert — the unique index caught it, so re-read.
    if (err.code === UNIQUE_VIOLATION) {
      const retry = await client.query(
        `SELECT id, name, created_by FROM user_prompt_groups
          WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
        [userId, name]
      );
      if (retry.rows[0]) return { group: retry.rows[0], created: false };
    }
    throw err;
  }
};

/**
 * POST /api/user-preset-prompts/users/:userId/groups
 * Body: { name, description? }
 */
const createGroupForUser = async (req, res) => {
  const userId = str(req.params.userId);
  const name = str(req.body?.name);
  const description = str(req.body?.description);
  const adminId = req.user?.id ?? null;

  if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
  if (!name) return res.status(400).json({ success: false, message: 'Group name is required' });

  const client = await docPool.connect();
  try {
    const targetUser = await assertUserExists(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: `No user found with id ${userId}` });
    }

    await client.query('BEGIN');
    const { group, created } = await findOrCreateGroup(client, {
      userId, name, description, adminId,
    });
    await client.query('COMMIT');

    if (!created) {
      return res.status(409).json({
        success: false,
        message: `"${group.name}" already exists for this user`,
        data: { id: group.id, name: group.name },
      });
    }

    logger.info('Superadmin created preset prompt group', {
      layer: 'USER_PRESET_PROMPTS', adminId, userId, groupId: group.id,
    });
    return res.status(201).json({ success: true, data: group });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Failed to create preset prompt group', {
      layer: 'USER_PRESET_PROMPTS', error: err.message, stack: err.stack, userId,
    });
    return res.status(500).json({ success: false, message: 'Failed to create group' });
  } finally {
    client.release();
  }
};

/**
 * POST /api/user-preset-prompts/users/:userId/prompts
 * Body: { name, prompt_text, description?, group_id? | group_name? }
 * Supply group_id to use an existing folder, or group_name to reuse-or-create one.
 */
const createPromptForUser = async (req, res) => {
  const userId = str(req.params.userId);
  const name = str(req.body?.name);
  const promptText = str(req.body?.prompt_text);
  const description = str(req.body?.description);
  const groupId = str(req.body?.group_id);
  const groupName = str(req.body?.group_name);
  const adminId = req.user?.id ?? null;

  if (!userId) return res.status(400).json({ success: false, message: 'userId is required' });
  if (!name) return res.status(400).json({ success: false, message: 'Prompt name is required' });
  if (!promptText) return res.status(400).json({ success: false, message: 'Prompt text is required' });
  if (!groupId && !groupName) {
    return res.status(400).json({ success: false, message: 'Either group_id or group_name is required' });
  }

  const client = await docPool.connect();
  try {
    const targetUser = await assertUserExists(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: `No user found with id ${userId}` });
    }

    await client.query('BEGIN');

    let group;
    if (groupId) {
      // Must belong to this user — otherwise an admin could file a prompt into
      // someone else's folder and it would surface in the wrong workspace.
      const owned = await client.query(
        `SELECT id, name, created_by FROM user_prompt_groups WHERE id = $1 AND user_id = $2`,
        [groupId, userId]
      );
      if (!owned.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Group not found for this user',
        });
      }
      group = owned.rows[0];
    } else {
      ({ group } = await findOrCreateGroup(client, {
        userId, name: groupName, description: null, adminId,
      }));
    }

    const inserted = await client.query(
      `INSERT INTO user_custom_prompts
         (group_id, user_id, name, description, prompt_text, created_by, created_by_admin_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, group_id, name, description, prompt_text, created_by, created_at, updated_at`,
      [group.id, userId, name, description || null, promptText, SOURCE_ADMIN, adminId]
    );

    await client.query('COMMIT');

    logger.info('Superadmin assigned preset prompt to user', {
      layer: 'USER_PRESET_PROMPTS',
      adminId, userId, groupId: group.id, promptId: inserted.rows[0].id,
    });

    return res.status(201).json({
      success: true,
      data: { ...inserted.rows[0], group_name: group.name },
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('Failed to create preset prompt for user', {
      layer: 'USER_PRESET_PROMPTS', error: err.message, stack: err.stack, userId,
    });
    return res.status(500).json({ success: false, message: 'Failed to create prompt' });
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/user-preset-prompts/prompts/:promptId
 * Superadmin-created prompts only — we never delete something the user wrote themselves.
 */
const deletePrompt = async (req, res) => {
  const promptId = str(req.params.promptId);
  if (!promptId) return res.status(400).json({ success: false, message: 'promptId is required' });

  try {
    const { rows } = await docPool.query(
      `SELECT id, created_by FROM user_custom_prompts WHERE id = $1`,
      [promptId]
    );
    const prompt = rows[0];
    if (!prompt) return res.status(404).json({ success: false, message: 'Prompt not found' });

    if (prompt.created_by !== SOURCE_ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'This prompt was created by the user and cannot be deleted from the admin panel',
      });
    }

    await docPool.query(`DELETE FROM user_custom_prompts WHERE id = $1`, [promptId]);
    logger.info('Superadmin deleted preset prompt', {
      layer: 'USER_PRESET_PROMPTS', adminId: req.user?.id, promptId,
    });
    return res.json({ success: true, message: 'Prompt deleted' });
  } catch (err) {
    logger.error('Failed to delete preset prompt', {
      layer: 'USER_PRESET_PROMPTS', error: err.message, promptId,
    });
    return res.status(500).json({ success: false, message: 'Failed to delete prompt' });
  }
};

/**
 * DELETE /api/user-preset-prompts/groups/:groupId
 * Superadmin-created groups only. Deleting a group cascades to its prompts, so this
 * refuses if the group still holds any prompt the user wrote themselves.
 */
const deleteGroup = async (req, res) => {
  const groupId = str(req.params.groupId);
  if (!groupId) return res.status(400).json({ success: false, message: 'groupId is required' });

  try {
    const { rows } = await docPool.query(
      `SELECT id, created_by FROM user_prompt_groups WHERE id = $1`,
      [groupId]
    );
    const group = rows[0];
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

    if (group.created_by !== SOURCE_ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'This group was created by the user and cannot be deleted from the admin panel',
      });
    }

    // ON DELETE CASCADE would silently take the user's own prompts with it.
    const { rows: owned } = await docPool.query(
      `SELECT COUNT(*)::int AS n FROM user_custom_prompts
        WHERE group_id = $1 AND created_by = $2`,
      [groupId, SOURCE_USER]
    );
    if (owned[0].n > 0) {
      return res.status(409).json({
        success: false,
        message: `This group holds ${owned[0].n} prompt(s) the user created. Delete those from the user's side first.`,
      });
    }

    await docPool.query(`DELETE FROM user_prompt_groups WHERE id = $1`, [groupId]);
    logger.info('Superadmin deleted preset prompt group', {
      layer: 'USER_PRESET_PROMPTS', adminId: req.user?.id, groupId,
    });
    return res.json({ success: true, message: 'Group deleted' });
  } catch (err) {
    logger.error('Failed to delete preset prompt group', {
      layer: 'USER_PRESET_PROMPTS', error: err.message, groupId,
    });
    return res.status(500).json({ success: false, message: 'Failed to delete group' });
  }
};

module.exports = {
  getUserDirectory,
  getUsersWithPresetPrompts,
  getPresetPromptsByUser,
  createGroupForUser,
  createPromptForUser,
  deletePrompt,
  deleteGroup,
};
