const pool = require('../config/docDB');

const getSelectedLLM = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cq.id,
              cq.llm_model_id,
              cq.llm_name,
              cq.created_at
         FROM custom_query cq
         ORDER BY cq.created_at DESC
         LIMIT 1`
    );

    res.status(200).json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching selected LLM:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const setSelectedLLM = async (req, res) => {
  const { llm_model_id } = req.body;

  if (!llm_model_id) {
    return res.status(400).json({ message: 'llm_model_id is required' });
  }

  try {
    await pool.query('BEGIN');

    const llmResult = await pool.query('SELECT id, name FROM llm_models WHERE id = $1', [llm_model_id]);
    if (llmResult.rowCount === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ message: 'LLM model not found' });
    }

    const llmName = llmResult.rows[0].name;

    await pool.query('DELETE FROM custom_query');

    const insertResult = await pool.query(
      'INSERT INTO custom_query (llm_model_id, llm_name) VALUES ($1, $2) RETURNING *',
      [llm_model_id, llmName]
    );

    await pool.query('COMMIT');

    res.status(201).json({
      message: 'Custom query LLM updated successfully',
      data: insertResult.rows[0],
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating custom query LLM:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getSelectedLLM,
  setSelectedLLM,
};

