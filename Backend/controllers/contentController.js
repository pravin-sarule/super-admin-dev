

// const docDB = require('../config/docDB');

// /* ============================================================
//    CASE TYPES
// ============================================================ */

// // Fetch all case types
// const getCaseTypes = async (req, res) => {
//   try {
//     const result = await docDB.query(`SELECT * FROM case_types ORDER BY id ASC`);
//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching case types:', error.message);
//     res.status(500).json({ error: 'Failed to fetch case types: ' + error.message });
//   }
// };

// // Fetch sub-types for a specific case type
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

// /* ============================================================
//    COURTS
// ============================================================ */

// // Fetch all courts
// const getCourts = async (req, res) => {
//   try {
//     const result = await docDB.query(`SELECT * FROM courts ORDER BY id ASC`);
//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching courts:', error.message);
//     res.status(500).json({ error: 'Failed to fetch courts: ' + error.message });
//   }
// };

// // Fetch courts by level (e.g., High Court, District Court)
// const getCourtsByLevel = async (req, res) => {
//   const { level } = req.params;

//   try {
//     const result = await docDB.query(
//       `SELECT * FROM courts WHERE LOWER(court_level) = LOWER($1) ORDER BY id ASC`,
//       [level]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ message: 'No courts found for this level' });
//     }

//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching courts by level:', error.message);
//     res.status(500).json({ error: 'Failed to fetch courts: ' + error.message });
//   }
// };

// // Fetch single court by ID
// const getCourtById = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const result = await docDB.query(`SELECT * FROM courts WHERE id = $1`, [id]);
//     if (result.rows.length === 0) {
//       return res.status(404).json({ message: 'Court not found' });
//     }
//     res.status(200).json(result.rows[0]);
//   } catch (error) {
//     console.error('Error fetching court by ID:', error.message);
//     res.status(500).json({ error: 'Failed to fetch court: ' + error.message });
//   }
// };

// /* ============================================================
//    ADMIN CREATION ROUTES
// ============================================================ */

// // Create new case type
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

// // Create new sub-type (under a case type)
// const createSubType = async (req, res) => {
//   const { case_type_id, name } = req.body;
//   if (!case_type_id || !name)
//     return res.status(400).json({ message: 'case_type_id and name are required' });

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

// // Create new court (with jurisdiction, state, etc.)
// const createCourt = async (req, res) => {
//   const { name, jurisdiction, state, bench, court_level } = req.body;

//   if (!name || !jurisdiction || !state || !court_level) {
//     return res
//       .status(400)
//       .json({ message: 'name, jurisdiction, state, and court_level are required' });
//   }

//   try {
//     const result = await docDB.query(
//       `INSERT INTO courts (name, jurisdiction, state, bench, court_level)
//        VALUES ($1, $2, $3, $4, $5)
//        RETURNING *`,
//       [name, jurisdiction, state, bench || null, court_level]
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

// /* ============================================================
//    DELETE ROUTES
// ============================================================ */

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



// // ==========================================
// // Create new judge
// // ==========================================
// const createJudge = async (req, res) => {
//   const { name, designation, court_id, bench_name } = req.body;

//   if (!name || !court_id || !bench_name) {
//     return res.status(400).json({ message: 'name, court_id, and bench_name are required' });
//   }

//   try {
//     const result = await docDB.query(
//       `INSERT INTO judges (name, designation, court_id, bench_name)
//        VALUES ($1, $2, $3, $4)
//        RETURNING *`,
//       [name, designation || 'Justice', court_id, bench_name]
//     );

//     res.status(201).json({
//       message: 'Judge added successfully',
//       data: result.rows[0],
//     });
//   } catch (error) {
//     console.error('Error adding judge:', error.message);
//     res.status(500).json({ error: 'Failed to add judge: ' + error.message });
//   }
// };

// // ==========================================
// // Fetch judges by bench (within a court)
// // ==========================================
// const getJudgesByBench = async (req, res) => {
//   const { courtId, benchName } = req.query; // /judges?courtId=1&benchName=Principal Bench

//   try {
//     const result = await docDB.query(
//       `SELECT * FROM judges 
//        WHERE court_id = $1 
//        AND LOWER(bench_name) = LOWER($2)
//        ORDER BY name ASC`,
//       [courtId, benchName]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ message: 'No judges found for this bench' });
//     }

//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching judges:', error.message);
//     res.status(500).json({ error: 'Failed to fetch judges: ' + error.message });
//   }
// };

// /* ============================================================
//    EXPORTS
// ============================================================ */

// module.exports = {
//   // Case Types
//   getCaseTypes,
//   getSubTypesByCaseType,
//   createCaseType,
//   deleteCaseType,

//   // Sub Types
//   createSubType,
//   deleteSubType,

//   // Courts
//   getCourts,
//   getCourtsByLevel,
//   getCourtById,
//   createCourt,
//   deleteCourt,
//    createJudge,
//    getJudgesByBench
// };





const docDB = require('../config/docDB');

/* ============================================================
   JURISDICTIONS
============================================================ */

// Get all jurisdictions
const getAllJurisdictions = async (req, res, docPool) => {
  const db = docPool || docDB;
  try {
    const result = await db.query(
      `SELECT j.*, COUNT(DISTINCT c.id) as court_count
       FROM jurisdictions j
       LEFT JOIN courts c ON j.id = c.jurisdiction_id
       GROUP BY j.id
       ORDER BY j.id ASC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching jurisdictions:', error.message);
    res.status(500).json({ error: 'Failed to fetch jurisdictions: ' + error.message });
  }
};

// Create new jurisdiction
const createJurisdiction = async (req, res, docPool) => {
  try {
    const db = docPool || docDB;
    
    if (!db) {
      console.error('❌ Database connection not available');
      return res.status(500).json({ error: 'Database connection not available' });
    }
    
    const { name, description } = req.body;

    console.log('📥 Create Jurisdiction Request:', { name, description, body: req.body });
    console.log('📥 Database pool:', db ? 'available' : 'missing');

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'name is required' });
    }

    const result = await db.query(
      `INSERT INTO jurisdictions (name, description)
       VALUES ($1, $2)
       RETURNING *`,
      [name.trim(), description ? description.trim() : null]
    );

    console.log('✅ Jurisdiction created successfully:', result.rows[0]);
    res.status(201).json({
      message: 'Jurisdiction created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('❌ Error creating jurisdiction:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error code:', error.code);
    console.error('Error detail:', error.detail);
    
    if (!res.headersSent) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Jurisdiction already exists' });
      }
      if (error.code === '42P01') {
        return res.status(500).json({ error: 'Database table "jurisdictions" does not exist. Please create the table first.' });
      }
      if (error.code === '23503') {
        return res.status(400).json({ error: 'Foreign key constraint violation: ' + (error.detail || error.message) });
      }
      res.status(500).json({ error: 'Failed to create jurisdiction: ' + error.message });
    }
  }
};

// Update jurisdiction
const updateJurisdiction = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }

  try {
    const result = await db.query(
      `UPDATE jurisdictions 
       SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [name, description || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Jurisdiction not found' });
    }

    res.status(200).json({
      message: 'Jurisdiction updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating jurisdiction:', error.message);
    res.status(500).json({ error: 'Failed to update jurisdiction: ' + error.message });
  }
};

// Delete jurisdiction
const deleteJurisdiction = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM jurisdictions WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Jurisdiction not found' });
    }

    res.status(200).json({
      message: 'Jurisdiction deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting jurisdiction:', error.message);
    res.status(500).json({ error: 'Failed to delete jurisdiction: ' + error.message });
  }
};

/* ============================================================
   COURTS
============================================================ */

// Get all courts
const getAllCourts = async (req, res, docPool) => {
  const db = docPool || docDB;
  try {
    const result = await db.query(
      `SELECT c.*, j.name as jurisdiction_name, COUNT(b.id) as bench_count
       FROM courts c
       LEFT JOIN jurisdictions j ON c.jurisdiction_id = j.id
       LEFT JOIN benches b ON c.id = b.court_id
       GROUP BY c.id, j.name
       ORDER BY c.id DESC`
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching courts:', error.message);
    res.status(500).json({ error: 'Failed to fetch courts: ' + error.message });
  }
};

// Get courts by jurisdiction
const getCourtsByJurisdiction = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { jurisdiction_id } = req.params;

  try {
    const result = await db.query(
      `SELECT c.*, COUNT(b.id) as bench_count
       FROM courts c
       LEFT JOIN benches b ON c.id = b.court_id
       WHERE c.jurisdiction_id = $1
       GROUP BY c.id
       ORDER BY c.court_name ASC`,
      [jurisdiction_id]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching courts:', error.message);
    res.status(500).json({ error: 'Failed to fetch courts: ' + error.message });
  }
};

// Get single court by ID
const getCourtById = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT c.*, j.name as jurisdiction_name
       FROM courts c
       LEFT JOIN jurisdictions j ON c.jurisdiction_id = j.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Court not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching court by ID:', error.message);
    res.status(500).json({ error: 'Failed to fetch court: ' + error.message });
  }
};

// Create new court
const createCourt = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { jurisdiction_id, court_name } = req.body;

  if (!jurisdiction_id || !court_name) {
    return res.status(400).json({ message: 'jurisdiction_id and court_name are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO courts (jurisdiction_id, court_name)
       VALUES ($1, $2)
       RETURNING *`,
      [jurisdiction_id, court_name]
    );

    res.status(201).json({
      message: 'Court created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating court:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Court already exists in this jurisdiction' });
    }
    res.status(500).json({ error: 'Failed to create court: ' + error.message });
  }
};

// Update court
const updateCourt = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { id } = req.params;
  const { jurisdiction_id, court_name } = req.body;

  if (!jurisdiction_id || !court_name) {
    return res.status(400).json({ message: 'jurisdiction_id and court_name are required' });
  }

  try {
    const result = await db.query(
      `UPDATE courts 
       SET jurisdiction_id = $1, court_name = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [jurisdiction_id, court_name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Court not found' });
    }

    res.status(200).json({
      message: 'Court updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating court:', error.message);
    res.status(500).json({ error: 'Failed to update court: ' + error.message });
  }
};

// Delete court
const deleteCourt = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM courts WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Court not found' });
    }

    res.status(200).json({
      message: 'Court deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting court:', error.message);
    res.status(500).json({ error: 'Failed to delete court: ' + error.message });
  }
};

/* ============================================================
   BENCHES
============================================================ */

// Get benches by court
const getBenchesByCourt = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { court_id } = req.params;

  try {
    const result = await db.query(
      `SELECT * FROM benches 
       WHERE court_id = $1 
       ORDER BY is_principal DESC, bench_name ASC`,
      [court_id]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching benches:', error.message);
    res.status(500).json({ error: 'Failed to fetch benches: ' + error.message });
  }
};

// Create new bench
const createBench = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { court_id, bench_name, location, is_principal } = req.body;

  if (!court_id || !bench_name) {
    return res.status(400).json({ message: 'court_id and bench_name are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO benches (court_id, bench_name, location, is_principal)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [court_id, bench_name, location || null, is_principal || false]
    );

    res.status(201).json({
      message: 'Bench created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating bench:', error.message);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Bench already exists in this court' });
    }
    res.status(500).json({ error: 'Failed to create bench: ' + error.message });
  }
};

// Update bench
const updateBench = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { id } = req.params;
  const { bench_name, location, is_principal } = req.body;

  if (!bench_name) {
    return res.status(400).json({ message: 'bench_name is required' });
  }

  try {
    const result = await db.query(
      `UPDATE benches 
       SET bench_name = $1, location = $2, is_principal = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [bench_name, location || null, is_principal || false, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Bench not found' });
    }

    res.status(200).json({
      message: 'Bench updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating bench:', error.message);
    res.status(500).json({ error: 'Failed to update bench: ' + error.message });
  }
};

// Delete bench
const deleteBench = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM benches WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Bench not found' });
    }

    res.status(200).json({
      message: 'Bench deleted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error deleting bench:', error.message);
    res.status(500).json({ error: 'Failed to delete bench: ' + error.message });
  }
};

/* ============================================================
   CASE TYPES
============================================================ */

// Get all case types
const getCaseTypes = async (req, res, docPool) => {
  const db = docPool || docDB;
  try {
    const result = await db.query(`SELECT * FROM case_types ORDER BY id ASC`);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching case types:', error.message);
    res.status(500).json({ error: 'Failed to fetch case types: ' + error.message });
  }
};

// Get sub-types by case type
const getSubTypesByCaseType = async (req, res, docPool) => {
  const db = docPool || docDB;
  // Support both :caseTypeId and :id parameter names
  const caseTypeId = req.params.caseTypeId || req.params.id;

  if (!caseTypeId) {
    return res.status(400).json({ message: 'Case type ID is required' });
  }

  try {
    const result = await db.query(
      `SELECT * FROM sub_types WHERE case_type_id = $1 ORDER BY id ASC`,
      [caseTypeId]
    );

    // Return empty array instead of 404 if no sub-types found
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching sub-types:', error.message);
    res.status(500).json({ error: 'Failed to fetch sub-types: ' + error.message });
  }
};

// // Create new case type
// const createCaseType = async (req, res, docPool) => {
//   const db = docPool || docDB;
//   const { name } = req.body;
//   if (!name) return res.status(400).json({ message: 'Case type name is required' });

//   try {
//     const result = await db.query(
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

// Create new case type
const createCaseType = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Case type name is required' });

  try {
    // Get the next ID by finding the max ID and adding 1
    const maxIdResult = await docDB.query(
      `SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM case_types`
    );
    const nextId = maxIdResult.rows[0].next_id;

    const result = await docDB.query(
      `INSERT INTO case_types (id, name) VALUES ($1, $2) RETURNING *`,
      [nextId, name]
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


// Update case type
const updateCaseType = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { id } = req.params;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Case type name is required' });
  }

  try {
    const result = await db.query(
      `UPDATE case_types SET name = $1 WHERE id = $2 RETURNING *`,
      [name, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Case type not found' });
    }

    res.status(200).json({
      message: 'Case type updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating case type:', error.message);
    res.status(500).json({ error: 'Failed to update case type: ' + error.message });
  }
};

// Delete case type
const deleteCaseType = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { id } = req.params;
  try {
    const result = await db.query(`DELETE FROM case_types WHERE id = $1 RETURNING *`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Case type not found' });
    }

    res.status(200).json({ message: 'Case type deleted successfully' });
  } catch (error) {
    console.error('Error deleting case type:', error.message);
    res.status(500).json({ error: 'Failed to delete case type: ' + error.message });
  }
};

/* ============================================================
   SUB TYPES
============================================================ */

// Create new sub-type
const createSubType = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { case_type_id, name } = req.body;
  if (!case_type_id || !name)
    return res.status(400).json({ message: 'case_type_id and name are required' });

  try {
    // Get the next ID by finding the max ID and adding 1
    const maxIdResult = await db.query(
      `SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM sub_types`
    );
    const nextId = maxIdResult.rows[0].next_id;

    const result = await db.query(
      `INSERT INTO sub_types (id, case_type_id, name) VALUES ($1, $2, $3) RETURNING *`,
      [nextId, case_type_id, name]
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

// Update sub-type
const updateSubType = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { id } = req.params;
  const { name, case_type_id } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Sub-type name is required' });
  }

  try {
    const query = case_type_id
      ? `UPDATE sub_types SET name = $1, case_type_id = $2 WHERE id = $3 RETURNING *`
      : `UPDATE sub_types SET name = $1 WHERE id = $2 RETURNING *`;
    
    const params = case_type_id ? [name, case_type_id, id] : [name, id];

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Sub-type not found' });
    }

    res.status(200).json({
      message: 'Sub-type updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating sub-type:', error.message);
    res.status(500).json({ error: 'Failed to update sub-type: ' + error.message });
  }
};

// Delete sub-type
const deleteSubType = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { id } = req.params;
  
  console.log(`[deleteSubType] ==========================================`);
  console.log(`[deleteSubType] Starting deletion of sub-type with id=${id}`);
  console.log(`[deleteSubType] ==========================================`);
  
  try {
    // First verify the sub-type exists
    const checkResult = await db.query(
      `SELECT id, case_type_id, name FROM sub_types WHERE id = $1`,
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      console.log(`[deleteSubType] Sub-type with id=${id} not found`);
      return res.status(404).json({ message: 'Sub-type not found' });
    }

    const subTypeData = checkResult.rows[0];
    const caseTypeId = subTypeData.case_type_id;
    console.log(`[deleteSubType] Found sub-type: id=${subTypeData.id}, name="${subTypeData.name}", case_type_id=${caseTypeId}`);

    // Verify case type exists before deletion (for logging and verification)
    const caseTypeCheck = await db.query(
      `SELECT id, name FROM case_types WHERE id = $1`,
      [caseTypeId]
    );
    if (caseTypeCheck.rows.length > 0) {
      console.log(`[deleteSubType] ✅ Parent case type exists BEFORE deletion: id=${caseTypeCheck.rows[0].id}, name="${caseTypeCheck.rows[0].name}"`);
    } else {
      console.error(`[deleteSubType] ⚠️  Parent case type does not exist! case_type_id=${caseTypeId}`);
    }

    // CRITICAL: Delete ONLY from sub_types table - NOT from case_types
    // This query explicitly targets ONLY the sub_types table
    console.log(`[deleteSubType] Executing: DELETE FROM sub_types WHERE id = ${id}`);
    console.log(`[deleteSubType] This will NOT delete from case_types table`);
    
    const result = await db.query(
      `DELETE FROM sub_types WHERE id = $1 RETURNING id, case_type_id, name`,
      [id]
    );
    
    if (result.rows.length === 0) {
      console.log(`[deleteSubType] No rows deleted - sub-type with id=${id} not found`);
      return res.status(404).json({ message: 'Sub-type not found' });
    }

    const deletedSubType = result.rows[0];
    console.log(`[deleteSubType] ✅ Successfully deleted sub-type: id=${deletedSubType.id}, name="${deletedSubType.name}"`);

    // CRITICAL VERIFICATION: Verify case type still exists after deletion
    const caseTypeCheckAfter = await db.query(
      `SELECT id, name FROM case_types WHERE id = $1`,
      [caseTypeId]
    );
    if (caseTypeCheckAfter.rows.length > 0) {
      console.log(`[deleteSubType] ✅ VERIFIED: Case type still exists after sub-type deletion: id=${caseTypeCheckAfter.rows[0].id}, name="${caseTypeCheckAfter.rows[0].name}"`);
    } else {
      console.error(`[deleteSubType] ❌❌❌ CRITICAL ERROR: Case type was deleted when it should not have been! case_type_id=${caseTypeId}`);
      console.error(`[deleteSubType] This indicates a database constraint or trigger is causing unwanted deletions`);
    }

    console.log(`[deleteSubType] ==========================================`);
    console.log(`[deleteSubType] Deletion completed successfully`);
    console.log(`[deleteSubType] ==========================================`);

    res.status(200).json({ 
      message: 'Sub-type deleted successfully',
      data: deletedSubType
    });
  } catch (error) {
    console.error(`[deleteSubType] ❌ ERROR: Error deleting sub-type with id=${id}`);
    console.error(`[deleteSubType] Error message:`, error.message);
    console.error(`[deleteSubType] Error code:`, error.code);
    console.error(`[deleteSubType] Error stack:`, error.stack);
    res.status(500).json({ error: 'Failed to delete sub-type: ' + error.message });
  }
};

/* ============================================================
   JUDGES
============================================================ */

// Get all judges
const getAllJudges = async (req, res, docPool) => {
  const db = docPool || docDB;
  try {
    const result = await db.query(`
      SELECT j.*, c.court_name, b.bench_name as bench, b.location,
             jur.name as jurisdiction_name
      FROM judges j
      LEFT JOIN benches b ON j.bench_id = b.id
      LEFT JOIN courts c ON b.court_id = c.id
      LEFT JOIN jurisdictions jur ON c.jurisdiction_id = jur.id
      ORDER BY j.id DESC
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching all judges:', error.message);
    res.status(500).json({ error: 'Failed to fetch judges: ' + error.message });
  }
};

// Get judges by bench
const getJudgesByBench = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { bench_id } = req.params;

  try {
    const result = await db.query(
      `SELECT j.*, b.bench_name, c.court_name
       FROM judges j
       LEFT JOIN benches b ON j.bench_id = b.id
       LEFT JOIN courts c ON b.court_id = c.id
       WHERE j.bench_id = $1
       ORDER BY j.name ASC`,
      [bench_id]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching judges:', error.message);
    res.status(500).json({ error: 'Failed to fetch judges: ' + error.message });
  }
};

// Create new judge
const createJudge = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { name, designation, bench_id } = req.body;

  if (!name || !bench_id) {
    return res.status(400).json({ message: 'name and bench_id are required' });
  }

  try {
    const result = await db.query(
      `INSERT INTO judges (name, designation, bench_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, designation || 'Justice', bench_id]
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

// Update judge
const updateJudge = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { id } = req.params;
  const { name, designation, bench_id } = req.body;

  if (!name || !bench_id) {
    return res.status(400).json({ 
      message: 'name and bench_id are required' 
    });
  }

  try {
    const result = await db.query(
      `UPDATE judges 
       SET name = $1, designation = $2, bench_id = $3 
       WHERE id = $4 
       RETURNING *`,
      [name, designation || 'Justice', bench_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Judge not found' });
    }

    res.status(200).json({
      message: 'Judge updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating judge:', error.message);
    res.status(500).json({ error: 'Failed to update judge: ' + error.message });
  }
};

// Delete judge
const deleteJudge = async (req, res, docPool) => {
  const db = docPool || docDB;
  const { id } = req.params;
  try {
    const result = await db.query(`DELETE FROM judges WHERE id = $1 RETURNING *`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Judge not found' });
    }

    res.status(200).json({ message: 'Judge deleted successfully' });
  } catch (error) {
    console.error('Error deleting judge:', error.message);
    res.status(500).json({ error: 'Failed to delete judge: ' + error.message });
  }
};

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  // Jurisdictions
  getAllJurisdictions,
  createJurisdiction,
  updateJurisdiction,
  deleteJurisdiction,

  // Courts
  getAllCourts,
  getCourtsByJurisdiction,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt,

  // Benches
  getBenchesByCourt,
  createBench,
  updateBench,
  deleteBench,

  // Case Types
  getCaseTypes,
  getSubTypesByCaseType,
  createCaseType,
  updateCaseType,
  deleteCaseType,

  // Sub Types
  createSubType,
  updateSubType,
  deleteSubType,

  // Judges
  getAllJudges,
  getJudgesByBench,
  createJudge,
  updateJudge,
  deleteJudge,
};