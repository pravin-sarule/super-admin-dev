/**
 * Repository for voice_agents.
 */
const pool = require('../db/jurinexVoiceDB');

const SELECT_COLS = `
  id, name, display_name, description, status, language_config,
  system_prompt, created_by, created_at, updated_at
`;

const list = async ({ status } = {}) => {
  const params = [];
  const where = [];
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  const sql = `
    SELECT ${SELECT_COLS}
    FROM voice_agents
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
};

const getById = async (id) => {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLS} FROM voice_agents WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

const getByName = async (name) => {
  const { rows } = await pool.query(
    `SELECT ${SELECT_COLS} FROM voice_agents WHERE name = $1 LIMIT 1`,
    [name]
  );
  return rows[0] || null;
};

const create = async ({
  name,
  display_name,
  description,
  status = 'active',
  language_config = null,
  system_prompt = null,
  created_by = null,
}) => {
  const { rows } = await pool.query(
    `INSERT INTO voice_agents
       (name, display_name, description, status, language_config, system_prompt, created_by)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)
     RETURNING ${SELECT_COLS}`,
    [
      name,
      display_name || null,
      description || null,
      status,
      language_config ? JSON.stringify(language_config) : null,
      system_prompt || null,
      created_by || null,
    ]
  );
  return rows[0];
};

const update = async (id, fields) => {
  const allowed = [
    'display_name',
    'description',
    'status',
    'language_config',
    'system_prompt',
  ];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (fields[key] === undefined) continue;
    params.push(key === 'language_config' && fields[key] ? JSON.stringify(fields[key]) : fields[key]);
    sets.push(
      key === 'language_config'
        ? `${key} = $${params.length}::jsonb`
        : `${key} = $${params.length}`
    );
  }
  if (sets.length === 0) return getById(id);
  params.push(id);
  const sql = `
    UPDATE voice_agents
       SET ${sets.join(', ')}, updated_at = NOW()
     WHERE id = $${params.length}
     RETURNING ${SELECT_COLS}
  `;
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
};

const softDelete = async (id) => {
  const { rows } = await pool.query(
    `UPDATE voice_agents
        SET status = 'inactive', updated_at = NOW()
      WHERE id = $1
      RETURNING ${SELECT_COLS}`,
    [id]
  );
  return rows[0] || null;
};

const documentCounts = async () => {
  const { rows } = await pool.query(`
    SELECT COALESCE(agent_id::text, 'global') AS key, COUNT(*)::int AS count
      FROM kb_documents
     GROUP BY agent_id
  `);
  const map = {};
  for (const r of rows) map[r.key] = r.count;
  return map;
};

module.exports = {
  list,
  getById,
  getByName,
  create,
  update,
  softDelete,
  documentCounts,
};
