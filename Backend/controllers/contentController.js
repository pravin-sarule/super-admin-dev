// const docDB = require('../config/docDB');

// // ==========================================
// // Fetch all case types
// // ==========================================
// const getCaseTypes = async (req, res) => {
//   try {
//     const result = await docDB.query(`SELECT * FROM case_types ORDER BY id ASC`);
//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching case types:', error.message);
//     res.status(500).json({ error: 'Failed to fetch case types: ' + error.message });
//   }
// };

// // ==========================================
// // Fetch sub-types for a specific case type
// // ==========================================
// const getSubTypesByCaseType = async (req, res) => {
//   const { caseTypeId } = req.params;

//   try {
//     const result = await docDB.query(
//       `SELECT * FROM sub_types WHERE case_type_id = $1 ORDER BY id ASC`,
//       [caseTypeId]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ message: 'No sub-types found for this case type' });
//     }

//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching sub-types:', error.message);
//     res.status(500).json({ error: 'Failed to fetch sub-types: ' + error.message });
//   }
// };

// // ==========================================
// // Fetch all courts
// // ==========================================
// const getCourts = async (req, res) => {
//   try {
//     const result = await docDB.query(`SELECT * FROM courts ORDER BY id ASC`);
//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching courts:', error.message);
//     res.status(500).json({ error: 'Failed to fetch courts: ' + error.message });
//   }
// };

// // ==========================================
// // Admin: Create new case type
// // ==========================================
// const createCaseType = async (req, res) => {
//   const { name } = req.body;

//   if (!name) return res.status(400).json({ message: 'Case type name is required' });

//   try {
//     const result = await docDB.query(
//       `INSERT INTO case_types (name) VALUES ($1) RETURNING *`,
//       [name]
//     );
//     res.status(201).json({
//       message: 'Case type created successfully',
//       data: result.rows[0],
//     });
//   } catch (error) {
//     console.error('Error creating case type:', error.message);
//     res.status(500).json({ error: 'Failed to create case type: ' + error.message });
//   }
// };

// // ==========================================
// // Admin: Create new sub-type (under a case type)
// // ==========================================
// const createSubType = async (req, res) => {
//   const { case_type_id, name } = req.body;

//   if (!case_type_id || !name) {
//     return res.status(400).json({ message: 'case_type_id and name are required' });
//   }

//   try {
//     const result = await docDB.query(
//       `INSERT INTO sub_types (case_type_id, name) VALUES ($1, $2) RETURNING *`,
//       [case_type_id, name]
//     );
//     res.status(201).json({
//       message: 'Sub-type created successfully',
//       data: result.rows[0],
//     });
//   } catch (error) {
//     console.error('Error creating sub-type:', error.message);
//     res.status(500).json({ error: 'Failed to create sub-type: ' + error.message });
//   }
// };

// // ==========================================
// // Admin: Create new court
// // ==========================================
// const createCourt = async (req, res) => {
//   const { name } = req.body;

//   if (!name) return res.status(400).json({ message: 'Court name is required' });

//   try {
//     const result = await docDB.query(
//       `INSERT INTO courts (name) VALUES ($1) RETURNING *`,
//       [name]
//     );
//     res.status(201).json({
//       message: 'Court created successfully',
//       data: result.rows[0],
//     });
//   } catch (error) {
//     console.error('Error creating court:', error.message);
//     res.status(500).json({ error: 'Failed to create court: ' + error.message });
//   }
// };

// // ==========================================
// // Admin: Delete case type (and cascade sub-types)
// // ==========================================
// const deleteCaseType = async (req, res) => {
//   const { id } = req.params;

//   try {
//     await docDB.query(`DELETE FROM case_types WHERE id = $1`, [id]);
//     res.status(200).json({ message: 'Case type deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting case type:', error.message);
//     res.status(500).json({ error: 'Failed to delete case type: ' + error.message });
//   }
// };

// // ==========================================
// // Admin: Delete sub-type
// // ==========================================
// const deleteSubType = async (req, res) => {
//   const { id } = req.params;

//   try {
//     await docDB.query(`DELETE FROM sub_types WHERE id = $1`, [id]);
//     res.status(200).json({ message: 'Sub-type deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting sub-type:', error.message);
//     res.status(500).json({ error: 'Failed to delete sub-type: ' + error.message });
//   }
// };

// // ==========================================
// // Admin: Delete court
// // ==========================================
// const deleteCourt = async (req, res) => {
//   const { id } = req.params;

//   try {
//     await docDB.query(`DELETE FROM courts WHERE id = $1`, [id]);
//     res.status(200).json({ message: 'Court deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting court:', error.message);
//     res.status(500).json({ error: 'Failed to delete court: ' + error.message });
//   }
// };

// module.exports = {
//   getCaseTypes,
//   getSubTypesByCaseType,
//   getCourts,
//   createCaseType,
//   createSubType,
//   createCourt,
//   deleteCaseType,
//   deleteSubType,
//   deleteCourt,
// };


const docDB = require('../config/docDB');

/* ============================================================
   CASE TYPES
============================================================ */

// Fetch all case types
const getCaseTypes = async (req, res) => {
  try {
    const result = await docDB.query(`SELECT * FROM case_types ORDER BY id ASC`);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching case types:', error.message);
    res.status(500).json({ error: 'Failed to fetch case types: ' + error.message });
  }
};

// Fetch sub-types for a specific case type
const getSubTypesByCaseType = async (req, res) => {
  const { caseTypeId } = req.params;

  try {
    const result = await docDB.query(
      `SELECT * FROM sub_types WHERE case_type_id = $1 ORDER BY id ASC`,
      [caseTypeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No sub-types found for this case type' });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching sub-types:', error.message);
    res.status(500).json({ error: 'Failed to fetch sub-types: ' + error.message });
  }
};

/* ============================================================
   COURTS
============================================================ */

// Fetch all courts
const getCourts = async (req, res) => {
  try {
    const result = await docDB.query(`SELECT * FROM courts ORDER BY id ASC`);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching courts:', error.message);
    res.status(500).json({ error: 'Failed to fetch courts: ' + error.message });
  }
};

// Fetch courts by level (e.g., High Court, District Court)
const getCourtsByLevel = async (req, res) => {
  const { level } = req.params;

  try {
    const result = await docDB.query(
      `SELECT * FROM courts WHERE LOWER(court_level) = LOWER($1) ORDER BY id ASC`,
      [level]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No courts found for this level' });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching courts by level:', error.message);
    res.status(500).json({ error: 'Failed to fetch courts: ' + error.message });
  }
};

// Fetch single court by ID
const getCourtById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await docDB.query(`SELECT * FROM courts WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Court not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching court by ID:', error.message);
    res.status(500).json({ error: 'Failed to fetch court: ' + error.message });
  }
};

/* ============================================================
   ADMIN CREATION ROUTES
============================================================ */

// Create new case type
const createCaseType = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Case type name is required' });

  try {
    const result = await docDB.query(
      `INSERT INTO case_types (name) VALUES ($1) RETURNING *`,
      [name]
    );
    res.status(201).json({
      message: 'Case type created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating case type:', error.message);
    res.status(500).json({ error: 'Failed to create case type: ' + error.message });
  }
};

// Create new sub-type (under a case type)
const createSubType = async (req, res) => {
  const { case_type_id, name } = req.body;
  if (!case_type_id || !name)
    return res.status(400).json({ message: 'case_type_id and name are required' });

  try {
    const result = await docDB.query(
      `INSERT INTO sub_types (case_type_id, name) VALUES ($1, $2) RETURNING *`,
      [case_type_id, name]
    );
    res.status(201).json({
      message: 'Sub-type created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating sub-type:', error.message);
    res.status(500).json({ error: 'Failed to create sub-type: ' + error.message });
  }
};

// Create new court (with jurisdiction, state, etc.)
const createCourt = async (req, res) => {
  const { name, jurisdiction, state, bench, court_level } = req.body;

  if (!name || !jurisdiction || !state || !court_level) {
    return res
      .status(400)
      .json({ message: 'name, jurisdiction, state, and court_level are required' });
  }

  try {
    const result = await docDB.query(
      `INSERT INTO courts (name, jurisdiction, state, bench, court_level)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, jurisdiction, state, bench || null, court_level]
    );

    res.status(201).json({
      message: 'Court created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating court:', error.message);
    res.status(500).json({ error: 'Failed to create court: ' + error.message });
  }
};

/* ============================================================
   DELETE ROUTES
============================================================ */

const deleteCaseType = async (req, res) => {
  const { id } = req.params;
  try {
    await docDB.query(`DELETE FROM case_types WHERE id = $1`, [id]);
    res.status(200).json({ message: 'Case type deleted successfully' });
  } catch (error) {
    console.error('Error deleting case type:', error.message);
    res.status(500).json({ error: 'Failed to delete case type: ' + error.message });
  }
};

const deleteSubType = async (req, res) => {
  const { id } = req.params;
  try {
    await docDB.query(`DELETE FROM sub_types WHERE id = $1`, [id]);
    res.status(200).json({ message: 'Sub-type deleted successfully' });
  } catch (error) {
    console.error('Error deleting sub-type:', error.message);
    res.status(500).json({ error: 'Failed to delete sub-type: ' + error.message });
  }
};

const deleteCourt = async (req, res) => {
  const { id } = req.params;
  try {
    await docDB.query(`DELETE FROM courts WHERE id = $1`, [id]);
    res.status(200).json({ message: 'Court deleted successfully' });
  } catch (error) {
    console.error('Error deleting court:', error.message);
    res.status(500).json({ error: 'Failed to delete court: ' + error.message });
  }
};



// ==========================================
// Create new judge
// ==========================================
const createJudge = async (req, res) => {
  const { name, designation, court_id, bench_name } = req.body;

  if (!name || !court_id || !bench_name) {
    return res.status(400).json({ message: 'name, court_id, and bench_name are required' });
  }

  try {
    const result = await docDB.query(
      `INSERT INTO judges (name, designation, court_id, bench_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, designation || 'Justice', court_id, bench_name]
    );

    res.status(201).json({
      message: 'Judge added successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error adding judge:', error.message);
    res.status(500).json({ error: 'Failed to add judge: ' + error.message });
  }
};

// ==========================================
// Fetch judges by bench (within a court)
// ==========================================
const getJudgesByBench = async (req, res) => {
  const { courtId, benchName } = req.query; // /judges?courtId=1&benchName=Principal Bench

  try {
    const result = await docDB.query(
      `SELECT * FROM judges 
       WHERE court_id = $1 
       AND LOWER(bench_name) = LOWER($2)
       ORDER BY name ASC`,
      [courtId, benchName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No judges found for this bench' });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching judges:', error.message);
    res.status(500).json({ error: 'Failed to fetch judges: ' + error.message });
  }
};

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  // Case Types
  getCaseTypes,
  getSubTypesByCaseType,
  createCaseType,
  deleteCaseType,

  // Sub Types
  createSubType,
  deleteSubType,

  // Courts
  getCourts,
  getCourtsByLevel,
  getCourtById,
  createCourt,
  deleteCourt,
   createJudge,
   getJudgesByBench
};
