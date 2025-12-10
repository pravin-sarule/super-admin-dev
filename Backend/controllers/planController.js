// const db = require('../config/db'); // Import the database configuration
// /**
//  * @desc    Create a new subscription plan
//  * @route   POST /api/admin/plans
//  */
// exports.createPlan = async (req, res) => {
//     const { name, description, price, currency, interval, type, features, limits } = req.body;

//     if (!name || !description || !interval || !type || !limits) {
//         return res.status(400).json({ success: false, message: 'Missing required fields: name, description, interval, type, limits' });
//     }

//     const queryText = `
//         INSERT INTO subscription_plans(name, description, price, currency, "interval", type, features, limits)
//         VALUES($1, $2, $3, $4, $5, $6, $7, $8)
//         RETURNING *;
//     `;
//     const values = [name, description, price, currency, interval, type, features, JSON.stringify(limits)];

//     try {
//         const { rows } = await db.query(queryText, values);
//         // FIX: Changed status code from 21 to 201 (Created)
//         res.status(201).json({ success: true, data: rows[0] });
//     } catch (error) {
//         if (error.code === '23505') { // Unique constraint violation
//             return res.status(409).json({ success: false, message: 'A plan with this name, type, and interval already exists.' });
//         }
//         res.status(400).json({ success: false, message: error.message });
//     }
// };

// /**
//  * @desc    Get all subscription plans (with filtering)
//  * @route   GET /api/admin/plans?type=individual&interval=month
//  */
// exports.getAllPlans = async (req, res) => {
//     const { type, interval } = req.query;

//     let queryText = 'SELECT * FROM subscription_plans';
//     const conditions = [];
//     const values = [];
//     let paramIndex = 1;

//     if (type) {
//         conditions.push(`type = $${paramIndex++}`);
//         values.push(type);
//     }
//     if (interval) {
//         conditions.push(`"interval" = $${paramIndex++}`);
//         values.push(interval);
//     }

//     if (conditions.length > 0) {
//         queryText += ' WHERE ' + conditions.join(' AND ');
//     }
    
//     queryText += ' ORDER BY type, "interval", price ASC;';

//     try {
//         const { rows } = await db.query(queryText, values);
//         res.status(200).json({ success: true, count: rows.length, data: rows });
//     } catch (error) {
//         res.status(500).json({ success: false, message: 'Server Error', error: error.message });
//     }
// };

// /**
//  * @desc    Get a single subscription plan by ID
//  * @route   GET /api/admin/plans/:id
//  */
// exports.getPlanById = async (req, res) => {
//     try {
//         const { rows } = await db.query('SELECT * FROM subscription_plans WHERE id = $1', [req.params.id]);
//         if (rows.length === 0) {
//             return res.status(404).json({ success: false, message: 'Plan not found' });
//         }
//         res.status(200).json({ success: true, data: rows[0] });
//     } catch (error) {
//         res.status(500).json({ success: false, message: 'Server Error' });
//     }
// };

// /**
//  * @desc    Update a subscription plan
//  * @route   PUT /api/admin/plans/:id
//  */
// exports.updatePlan = async (req, res) => {
//     const { id } = req.params;
//     const { name, description, price, currency, interval, type, features, limits } = req.body;

//     const queryText = `
//         UPDATE subscription_plans
//         SET name = $1, description = $2, price = $3, currency = $4, "interval" = $5, type = $6, features = $7, limits = $8
//         WHERE id = $9
//         RETURNING *;
//     `;
//     const values = [name, description, price, currency, interval, type, features, JSON.stringify(limits), id];

//     try {
//         const { rows } = await db.query(queryText, values);
//         if (rows.length === 0) {
//             return res.status(404).json({ success: false, message: 'Plan not found' });
//         }
//         res.status(200).json({ success: true, data: rows[0] });
//     } catch (error) {
//         res.status(400).json({ success: false, message: error.message });
//     }
// };

// /**
//  * @desc    Delete a subscription plan
//  * @route   DELETE /api/admin/plans/:id
//  */
// exports.deletePlan = async (req, res) => {
//     try {
//         const result = await db.query('DELETE FROM subscription_plans WHERE id = $1 RETURNING *;', [req.params.id]);
//         if (result.rowCount === 0) {
//             return res.status(404).json({ success: false, message: 'Plan not found' });
//         }
//         res.status(200).json({ success: true, message: 'Plan deleted successfully' });
//     } catch (error) {
//         res.status(500).json({ success: false, message: 'Server Error' });
//     }
// };
// const db = require('../config/db'); // PostgreSQL pool

// /**
//  * @desc    Create a new subscription plan
//  * @route   POST /api/admin/plans
//  */
// exports.createPlan = async (req, res) => {
//     const {
//         name,
//         description,
//         price,
//         currency = 'INR',
//         interval,
//         type,
//         features,
//         limits,
//         token_limit,
//         carry_over_limit,
//         razorpay_plan_id
//     } = req.body;

//     // Validate required fields
//     if (!name || !description || !interval || !type || !limits || token_limit == null || carry_over_limit == null) {
//         return res.status(400).json({
//             success: false,
//             message: 'Missing required fields: name, description, interval, type, limits, token_limit, carry_over_limit'
//         });
//     }

//     const query = `
//         INSERT INTO subscription_plans (
//             name, description, price, currency, "interval", type, features, limits,
//             token_limit, carry_over_limit, razorpay_plan_id
//         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
//         RETURNING *;
//     `;

//     const values = [
//         name,
//         description,
//         price,
//         currency,
//         interval,
//         type,
//         features,
//         JSON.stringify(limits),
//         token_limit,
//         carry_over_limit,
//         razorpay_plan_id
//     ];

//     try {
//         const { rows } = await db.query(query, values);
//         return res.status(201).json({ success: true, data: rows[0] });
//     } catch (error) {
//         if (error.code === '23505') {
//             return res.status(409).json({ success: false, message: 'Plan with this name already exists.' });
//         }
//         return res.status(400).json({ success: false, message: error.message });
//     }
// };

// /**
//  * @desc    Get all subscription plans (optional filter)
//  * @route   GET /api/admin/plans?type=business&interval=year
//  */
// exports.getAllPlans = async (req, res) => {
//     const { type, interval } = req.query;

//     let query = 'SELECT * FROM subscription_plans';
//     const conditions = [];
//     const values = [];
//     let i = 1;

//     if (type) {
//         conditions.push(`type = $${i++}`);
//         values.push(type);
//     }

//     if (interval) {
//         conditions.push(`"interval" = $${i++}`);
//         values.push(interval);
//     }

//     if (conditions.length > 0) {
//         query += ' WHERE ' + conditions.join(' AND ');
//     }

//     query += ' ORDER BY type, interval, price ASC';

//     try {
//         const { rows } = await db.query(query, values);
//         return res.status(200).json({ success: true, count: rows.length, data: rows });
//     } catch (error) {
//         return res.status(500).json({ success: false, message: error.message });
//     }
// };

// /**
//  * @desc    Get a plan by ID
//  * @route   GET /api/admin/plans/:id
//  */
// exports.getPlanById = async (req, res) => {
//     try {
//         const { rows } = await db.query('SELECT * FROM subscription_plans WHERE id = $1', [req.params.id]);
//         if (rows.length === 0) {
//             return res.status(404).json({ success: false, message: 'Plan not found' });
//         }
//         return res.status(200).json({ success: true, data: rows[0] });
//     } catch (error) {
//         return res.status(500).json({ success: false, message: error.message });
//     }
// };

// /**
//  * @desc    Update a subscription plan
//  * @route   PUT /api/admin/plans/:id
//  */
// exports.updatePlan = async (req, res) => {
//     const { id } = req.params;
//     const {
//         name,
//         description,
//         price,
//         currency = 'INR',
//         interval,
//         type,
//         features,
//         limits,
//         token_limit,
//         carry_over_limit,
//         razorpay_plan_id
//     } = req.body;

//     const query = `
//         UPDATE subscription_plans SET
//         name = $1,
//         description = $2,
//         price = $3,
//         currency = $4,
//         "interval" = $5,
//         type = $6,
//         features = $7,
//         limits = $8,
//         token_limit = $9,
//         carry_over_limit = $10,
//         razorpay_plan_id = $11,
//         updated_at = NOW()
//         WHERE id = $12
//         RETURNING *;
//     `;

//     const values = [
//         name,
//         description,
//         price,
//         currency,
//         interval,
//         type,
//         features,
//         JSON.stringify(limits),
//         token_limit,
//         carry_over_limit,
//         razorpay_plan_id,
//         id
//     ];

//     try {
//         const { rows } = await db.query(query, values);
//         if (rows.length === 0) {
//             return res.status(404).json({ success: false, message: 'Plan not found' });
//         }
//         return res.status(200).json({ success: true, data: rows[0] });
//     } catch (error) {
//         return res.status(400).json({ success: false, message: error.message });
//     }
// };

// /**
//  * @desc    Delete a subscription plan
//  * @route   DELETE /api/admin/plans/:id
//  */
// exports.deletePlan = async (req, res) => {
//     try {
//         const result = await db.query('DELETE FROM subscription_plans WHERE id = $1 RETURNING *', [req.params.id]);
//         if (result.rowCount === 0) {
//             return res.status(404).json({ success: false, message: 'Plan not found' });
//         }
//         return res.status(200).json({ success: true, message: 'Plan deleted successfully' });
//     } catch (error) {
//         return res.status(500).json({ success: false, message: error.message });
//     }
// };
// const db = require('../config/db');

// /**
//  * @desc    Create a new subscription plan
//  * @route   POST /api/admin/plans
//  */
// exports.createPlan = async (req, res) => {
//     const {
//         name,
//         description,
//         price,
//         currency = 'INR',
//         interval, // 'monthly', 'half-yearly', 'yearly'
//         type,     // 'individual', 'business'
//         features,
//         document_limit,
//         ai_analysis_limit,
//         template_access, // 'basic' | 'premium'
//         token_limit,
//         carry_over_limit,
//         limits, // Optional JSON: { summaries: 50, drafts: 10 }
//         razorpay_plan_id
//     } = req.body;

//     if (!name || !description || !interval || !type || token_limit == null ||
//         carry_over_limit == null || document_limit == null || ai_analysis_limit == null || !template_access) {
//         return res.status(400).json({
//             success: false,
//             message: 'Missing required fields'
//         });
//     }

//     const query = `
//         INSERT INTO subscription_plans (
//             name, description, price, currency, "interval", type,
//             features, document_limit, ai_analysis_limit, template_access,
//             token_limit, carry_over_limit, limits, razorpay_plan_id
//         )
//         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
//         RETURNING *;
//     `;

//     const values = [
//         name,
//         description,
//         price,
//         currency,
//         interval,
//         type,
//         features,
//         document_limit,
//         ai_analysis_limit,
//         template_access,
//         token_limit,
//         carry_over_limit,
//         JSON.stringify(limits),
//         razorpay_plan_id
//     ];

//     try {
//         const { rows } = await db.query(query, values);
//         return res.status(201).json({ success: true, data: rows[0] });
//     } catch (error) {
//         if (error.code === '23505') {
//             return res.status(409).json({ success: false, message: 'Plan with this name already exists.' });
//         }
//         return res.status(400).json({ success: false, message: error.message });
//     }
// };

// /**
//  * @desc    Get all plans (with optional type/interval filter)
//  * @route   GET /api/admin/plans
//  */
// exports.getAllPlans = async (req, res) => {
//     const { type, interval } = req.query;
//     let query = 'SELECT * FROM subscription_plans';
//     const conditions = [];
//     const values = [];
//     let i = 1;

//     if (type) {
//         conditions.push(`type = $${i++}`);
//         values.push(type);
//     }

//     if (interval) {
//         conditions.push(`"interval" = $${i++}`);
//         values.push(interval);
//     }

//     if (conditions.length > 0) {
//         query += ' WHERE ' + conditions.join(' AND ');
//     }

//     query += ' ORDER BY price ASC';

//     try {
//         const { rows } = await db.query(query, values);
//         return res.status(200).json({ success: true, count: rows.length, data: rows });
//     } catch (error) {
//         return res.status(500).json({ success: false, message: error.message });
//     }
// };

// /**
//  * @desc    Get a plan by ID
//  * @route   GET /api/admin/plans/:id
//  */
// exports.getPlanById = async (req, res) => {
//     try {
//         const { rows } = await db.query('SELECT * FROM subscription_plans WHERE id = $1', [req.params.id]);
//         if (rows.length === 0) {
//             return res.status(404).json({ success: false, message: 'Plan not found' });
//         }
//         return res.status(200).json({ success: true, data: rows[0] });
//     } catch (error) {
//         return res.status(500).json({ success: false, message: error.message });
//     }
// };

// /**
//  * @desc    Update a plan
//  * @route   PUT /api/admin/plans/:id
//  */
// exports.updatePlan = async (req, res) => {
//     const { id } = req.params;
//     const {
//         name,
//         description,
//         price,
//         currency = 'INR',
//         interval,
//         type,
//         features,
//         document_limit,
//         ai_analysis_limit,
//         template_access,
//         token_limit,
//         carry_over_limit,
//         limits,
//         razorpay_plan_id
//     } = req.body;

//     const query = `
//         UPDATE subscription_plans SET
//         name = $1,
//         description = $2,
//         price = $3,
//         currency = $4,
//         "interval" = $5,
//         type = $6,
//         features = $7,
//         document_limit = $8,
//         ai_analysis_limit = $9,
//         template_access = $10,
//         token_limit = $11,
//         carry_over_limit = $12,
//         limits = $13,
//         razorpay_plan_id = $14,
//         updated_at = NOW()
//         WHERE id = $15
//         RETURNING *;
//     `;

//     const values = [
//         name,
//         description,
//         price,
//         currency,
//         interval,
//         type,
//         features,
//         document_limit,
//         ai_analysis_limit,
//         template_access,
//         token_limit,
//         carry_over_limit,
//         JSON.stringify(limits),
//         razorpay_plan_id,
//         id
//     ];

//     try {
//         const { rows } = await db.query(query, values);
//         if (rows.length === 0) {
//             return res.status(404).json({ success: false, message: 'Plan not found' });
//         }
//         return res.status(200).json({ success: true, data: rows[0] });
//     } catch (error) {
//         return res.status(400).json({ success: false, message: error.message });
//     }
// };

// /**
//  * @desc    Delete a plan
//  * @route   DELETE /api/admin/plans/:id
//  */
// exports.deletePlan = async (req, res) => {
//     try {
//         const result = await db.query('DELETE FROM subscription_plans WHERE id = $1 RETURNING *', [req.params.id]);
//         if (result.rowCount === 0) {
//             return res.status(404).json({ success: false, message: 'Plan not found' });
//         }
//         return res.status(200).json({ success: true, message: 'Plan deleted successfully' });
//     } catch (error) {
//         return res.status(500).json({ success: false, message: error.message });
//     }
// };
const db = require('../config/payment_DB');

/**
 * @desc    Create a new one-time subscription plan (no Razorpay plan_id)
 * @route   POST /api/admin/plans
 */
exports.createPlan = async (req, res, paymentPool) => {
    const {
        name,
        description,
        price,
        currency = 'INR',
        interval, // 'monthly', 'half-yearly', 'yearly'
        type,     // 'individual', 'business'
        features,
        document_limit,
        ai_analysis_limit,
        template_access, // 'basic' | 'premium'
        token_limit,
        carry_over_limit,
        limits, // Optional JSON: { summaries: 50, drafts: 10 }
        storage_limit_gb,
        drafting_type,
        razorpay_plan_id
    } = req.body;

    if (!name || !description || !interval || !type || price == null ||
        token_limit == null || carry_over_limit == null || document_limit == null ||
        ai_analysis_limit == null || !template_access || storage_limit_gb == null || !drafting_type) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields'
        });
    }

    const query = `
        INSERT INTO subscription_plans (
            name, description, price, currency, "interval", type,
            features, document_limit, ai_analysis_limit, template_access,
            token_limit, carry_over_limit, limits, storage_limit_gb, drafting_type, razorpay_plan_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *;
    `;

    const values = [
        name,
        description,
        price,
        currency,
        interval,
        type,
        features,
        document_limit,
        ai_analysis_limit,
        template_access,
        token_limit,
        carry_over_limit,
        JSON.stringify(limits),
        storage_limit_gb,
        drafting_type,
        razorpay_plan_id
    ];

    try {
        const { rows } = await paymentPool.query(query, values);
        return res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'Plan with this name already exists.' });
        }
        return res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all plans (used by frontend to display to user)
 * @route   GET /api/admin/plans
 */
exports.getAllPlans = async (req, res, paymentPool) => {
    const { type, interval } = req.query;
    let query = 'SELECT * FROM subscription_plans';
    const conditions = [];
    const values = [];
    let i = 1;

    if (type) {
        conditions.push(`type = $${i++}`);
        values.push(type);
    }

    if (interval) {
        conditions.push(`"interval" = $${i++}`);
        values.push(interval);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY price ASC';

    try {
        const { rows } = await paymentPool.query(query, values);
        return res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get a single plan by ID
 * @route   GET /api/admin/plans/:id
 */
exports.getPlanById = async (req, res, paymentPool) => {
    try {
        const { rows } = await paymentPool.query('SELECT * FROM subscription_plans WHERE id = $1', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        return res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update a plan
 * @route   PUT /api/admin/plans/:id
 */
exports.updatePlan = async (req, res, paymentPool) => {
    const { id } = req.params;
    const {
        name,
        description,
        price,
        currency = 'INR',
        interval,
        type,
        features,
        document_limit,
        ai_analysis_limit,
        template_access,
        token_limit,
        carry_over_limit,
        limits,
        storage_limit_gb,
        drafting_type,
        razorpay_plan_id
    } = req.body;

    const query = `
        UPDATE subscription_plans SET
        name = $1,
        description = $2,
        price = $3,
        currency = $4,
        "interval" = $5,
        type = $6,
        features = $7,
        document_limit = $8,
        ai_analysis_limit = $9,
        template_access = $10,
        token_limit = $11,
        carry_over_limit = $12,
        limits = $13,
        storage_limit_gb = $14,
        drafting_type = $15,
        razorpay_plan_id = $16,
        updated_at = NOW()
        WHERE id = $17
        RETURNING *;
    `;

    const values = [
        name,
        description,
        price,
        currency,
        interval,
        type,
        features,
        document_limit,
        ai_analysis_limit,
        template_access,
        token_limit,
        carry_over_limit,
        JSON.stringify(limits),
        storage_limit_gb,
        drafting_type,
        razorpay_plan_id,
        id
    ];

    try {
        const { rows } = await paymentPool.query(query, values);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        return res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete a plan
 * @route   DELETE /api/admin/plans/:id
 */
exports.deletePlan = async (req, res, paymentPool) => {
    try {
        const result = await paymentPool.query('DELETE FROM subscription_plans WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        return res.status(200).json({ success: true, message: 'Plan deleted successfully' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
