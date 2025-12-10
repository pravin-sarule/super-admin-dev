// controllers/chunkingMethodController.js
const pool = require('../config/docDB'); // import your db pool

// Get all chunking methods
const getAllChunkingMethods = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM chunking_methods ORDER BY id ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching chunking methods:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add a new chunking method
const addChunkingMethod = async (req, res) => {
  const { name, is_active } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Chunking method name is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO chunking_methods (name, is_active) VALUES ($1, $2) RETURNING *',
      [name, is_active ?? true]
    );

    res.status(201).json({ message: 'Chunking method added successfully', method: result.rows[0] });
  } catch (error) {
    console.error('Error adding chunking method:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAllChunkingMethods,
  addChunkingMethod,
};