const pool = require('../config/aiDocumentDB');

// GET /api/admin/chat-history
// Returns all sessions ordered by latest activity, with message count and preview
const getAllSessions = async (req, res) => {
  try {
    const { page = 1, limit = 50, mode = 'all', search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions = [];
    let params = [];

    if (mode !== 'all') {
      params.push(mode);
      conditions.push(`s.mode = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`s.id::text ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM chat_sessions s ${where}`,
      params
    );

    const totalCount = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const { rows } = await pool.query(
      `SELECT
         s.id,
         s.mode,
         s.created_at,
         s.last_active_at,
         COUNT(m.id)                                        AS message_count,
         MAX(CASE WHEN m.role = 'user' THEN m.content END) AS last_user_message
       FROM chat_sessions s
       LEFT JOIN chat_messages m ON m.session_id = s.id
       ${where}
       GROUP BY s.id, s.mode, s.created_at, s.last_active_at
       ORDER BY s.last_active_at DESC NULLS LAST
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.json({
      success: true,
      total: totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      sessions: rows.map((r) => ({
        id:                r.id,
        mode:              r.mode,
        message_count:     parseInt(r.message_count),
        last_user_message: r.last_user_message
          ? r.last_user_message.slice(0, 120) + (r.last_user_message.length > 120 ? '…' : '')
          : null,
        created_at:        r.created_at,
        last_active_at:    r.last_active_at,
      })),
    });
  } catch (err) {
    console.error('chat-history getAllSessions error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/admin/chat-history/:sessionId
// Returns all messages for a session in chronological order
const getSessionMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const sessionRes = await pool.query(
      `SELECT id, mode, created_at, last_active_at FROM chat_sessions WHERE id = $1`,
      [sessionId]
    );
    if (!sessionRes.rows.length) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const { rows: messages } = await pool.query(
      `SELECT id, role, content, created_at
       FROM chat_messages
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId]
    );

    return res.json({
      success: true,
      session: sessionRes.rows[0],
      messages,
    });
  } catch (err) {
    console.error('chat-history getSessionMessages error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getAllSessions, getSessionMessages };
