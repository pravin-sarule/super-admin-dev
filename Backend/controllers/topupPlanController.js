// Topup plan catalog (payment_DB → topup_plans).
// One-time token packs: name, description, price, tokens granted, validity (fixed-preset days).
// Topup credits are a single pool spent anytime until expiry — NOT subject to any daily cap.

/* ── small parsers ── */
const toInt = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
};
const toNum = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};
const toBool = (v, fallback) => {
    if (v === undefined || v === null || v === '') return fallback;
    if (typeof v === 'boolean') return v;
    const s = String(v).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
};

/** Build a topup_plans row from request body, falling back to an existing row on update. */
function rowFromBody(body, existing = null) {
    const name = (body.name != null ? String(body.name) : existing?.name || '').trim();

    return {
        name,
        description: body.description != null ? String(body.description) : existing?.description ?? null,
        price: body.price != null ? toNum(body.price) ?? 0 : existing?.price != null ? Number(existing.price) : 0,
        currency: body.currency || existing?.currency || 'INR',
        tokens: body.tokens != null ? toInt(body.tokens) : existing?.tokens ?? null,
        validity_days: body.validity_days != null ? toInt(body.validity_days) : existing?.validity_days ?? null,
        is_active: toBool(body.is_active, existing?.is_active ?? true),
        sort_order: body.sort_order != null ? toInt(body.sort_order) ?? 0 : existing?.sort_order ?? 0,
        razorpay_plan_id: body.razorpay_plan_id != null ? String(body.razorpay_plan_id) || null : existing?.razorpay_plan_id ?? null,
    };
}

function validate(row) {
    if (!row.name) return 'Plan name is required';
    if (row.tokens == null || Number.isNaN(row.tokens) || row.tokens < 0)
        return 'Tokens is required and must be a non-negative number';
    if (row.validity_days == null || Number.isNaN(row.validity_days) || row.validity_days < 1)
        return 'Validity (in days) is required and must be at least 1';
    if (row.price != null && row.price < 0) return 'Price must be a non-negative number';
    return null;
}

/** @route POST /api/admin/topup-plans */
exports.createTopupPlan = async (req, res, paymentPool) => {
    const row = rowFromBody(req.body);
    const err = validate(row);
    if (err) return res.status(400).json({ success: false, message: err });

    try {
        const dup = await paymentPool.query(
            'SELECT id FROM topup_plans WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1',
            [row.name]
        );
        if (dup.rows.length > 0) {
            return res.status(409).json({ success: false, message: `A topup plan named "${row.name}" already exists.` });
        }

        const { rows } = await paymentPool.query(
            `INSERT INTO topup_plans
               (name, description, price, currency, tokens, validity_days, is_active, sort_order, razorpay_plan_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING *`,
            [row.name, row.description, row.price, row.currency, row.tokens,
             row.validity_days, row.is_active, row.sort_order, row.razorpay_plan_id]
        );
        return res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
        if (error.code === '23505')
            return res.status(409).json({ success: false, message: `A topup plan named "${row.name}" already exists.` });
        return res.status(400).json({ success: false, message: error.message });
    }
};

/** @route GET /api/admin/topup-plans  (?active=true|false, ?search=) */
exports.getAllTopupPlans = async (req, res, paymentPool) => {
    const { active, search } = req.query;
    const conditions = [];
    const values = [];
    let i = 1;

    if (active === 'true' || active === 'false') {
        conditions.push(`is_active = $${i++}`);
        values.push(active === 'true');
    }
    if (search) {
        conditions.push(`name ILIKE $${i++}`);
        values.push(`%${search}%`);
    }

    let query = 'SELECT * FROM topup_plans';
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY sort_order ASC, name ASC';

    try {
        const { rows } = await paymentPool.query(query, values);
        return res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** @route GET /api/admin/topup-plans/:id */
exports.getTopupPlanById = async (req, res, paymentPool) => {
    try {
        const { rows } = await paymentPool.query('SELECT * FROM topup_plans WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Topup plan not found' });
        return res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** @route PUT /api/admin/topup-plans/:id */
exports.updateTopupPlan = async (req, res, paymentPool) => {
    const { id } = req.params;
    try {
        const existing = await paymentPool.query('SELECT * FROM topup_plans WHERE id = $1', [id]);
        if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Topup plan not found' });

        const row = rowFromBody(req.body, existing.rows[0]);
        const err = validate(row);
        if (err) return res.status(400).json({ success: false, message: err });

        const conflict = await paymentPool.query(
            'SELECT id FROM topup_plans WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND id <> $2 LIMIT 1',
            [row.name, id]
        );
        if (conflict.rows.length > 0)
            return res.status(409).json({ success: false, message: `A topup plan named "${row.name}" already exists.` });

        const { rows } = await paymentPool.query(
            `UPDATE topup_plans SET
               name=$1, description=$2, price=$3, currency=$4, tokens=$5,
               validity_days=$6, is_active=$7, sort_order=$8, razorpay_plan_id=$9, updated_at=NOW()
             WHERE id=$10
             RETURNING *`,
            [row.name, row.description, row.price, row.currency, row.tokens,
             row.validity_days, row.is_active, row.sort_order, row.razorpay_plan_id, id]
        );
        return res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
        if (error.code === '23505')
            return res.status(409).json({ success: false, message: 'A topup plan with that name already exists.' });
        return res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @route DELETE /api/admin/topup-plans/:id
 * Hard delete — safe while nothing references plans (catalog-only phase). Once purchase/grant
 * tables exist, switch to a soft delete (UPDATE ... SET is_active = false) to keep history.
 */
exports.deleteTopupPlan = async (req, res, paymentPool) => {
    try {
        const result = await paymentPool.query('DELETE FROM topup_plans WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Topup plan not found' });
        return res.status(200).json({ success: true, message: 'Topup plan deleted successfully' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
