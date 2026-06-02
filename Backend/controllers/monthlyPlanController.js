// Monthly plan catalog (payment_DB → monthly_plans).
// Simplified recurring plans: name, description, price, monthly token allocation, daily token cap.
// Monthly tokens ARE subject to the daily cap; topup credits (see topupPlanController) are not.

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

/** Build a monthly_plans row from request body, falling back to an existing row on update. */
function rowFromBody(body, existing = null) {
    const name = (body.name != null ? String(body.name) : existing?.name || '').trim();

    const monthly_tokens = body.monthly_tokens != null ? toInt(body.monthly_tokens) : existing?.monthly_tokens ?? null;

    // daily_token_limit is nullable (NULL = no daily cap). Treat empty string as "no cap".
    let daily_token_limit;
    if (body.daily_token_limit !== undefined) {
        daily_token_limit = body.daily_token_limit === '' || body.daily_token_limit === null ? null : toInt(body.daily_token_limit);
    } else {
        daily_token_limit = existing?.daily_token_limit ?? null;
    }

    // storage_limit_gb is nullable (NULL = no cap / custom). 1024 = 1 TB.
    let storage_limit_gb;
    if (body.storage_limit_gb !== undefined) {
        storage_limit_gb = body.storage_limit_gb === '' || body.storage_limit_gb === null ? null : toInt(body.storage_limit_gb);
    } else {
        storage_limit_gb = existing?.storage_limit_gb ?? null;
    }

    return {
        name,
        description: body.description != null ? String(body.description) : existing?.description ?? null,
        price: body.price != null ? toNum(body.price) ?? 0 : existing?.price != null ? Number(existing.price) : 0,
        currency: body.currency || existing?.currency || 'INR',
        monthly_tokens,
        daily_token_limit,
        storage_limit_gb,
        // 1=monthly, 3=quarterly, 6=half-yearly, 12=yearly
        billing_interval_months: body.billing_interval_months != null
            ? (toInt(body.billing_interval_months) ?? 1)
            : existing?.billing_interval_months ?? 1,
        // audience: 'solo' or 'firm' (anything else normalises to 'solo')
        category: ((body.category != null ? String(body.category) : existing?.category || 'solo').toLowerCase().trim() === 'firm') ? 'firm' : 'solo',
        // true = "Contact us" card — price/tokens optional
        is_custom: toBool(body.is_custom, existing?.is_custom ?? false),
        is_active: toBool(body.is_active, existing?.is_active ?? true),
        sort_order: body.sort_order != null ? toInt(body.sort_order) ?? 0 : existing?.sort_order ?? 0,
        razorpay_plan_id: body.razorpay_plan_id != null ? String(body.razorpay_plan_id) || null : existing?.razorpay_plan_id ?? null,
    };
}

function validate(row) {
    if (!row.name) return 'Plan name is required';
    if (!['solo', 'firm'].includes(row.category)) return 'Category must be solo or firm';
    // "Contact us" plans don't need a token allocation.
    if (!row.is_custom && (row.monthly_tokens == null || Number.isNaN(row.monthly_tokens) || row.monthly_tokens < 0))
        return 'Monthly token allocation is required and must be a non-negative number';
    if (row.daily_token_limit != null && row.daily_token_limit < 0)
        return 'Daily token limit must be a non-negative number';
    if (row.storage_limit_gb != null && row.storage_limit_gb < 1)
        return 'Storage cap must be at least 1 GB';
    if (row.billing_interval_months == null || Number.isNaN(row.billing_interval_months) || row.billing_interval_months < 1)
        return 'Billing cycle must be at least 1 month';
    if (row.price != null && row.price < 0) return 'Price must be a non-negative number';
    return null;
}

/** @route POST /api/admin/monthly-plans */
exports.createMonthlyPlan = async (req, res, paymentPool) => {
    const row = rowFromBody(req.body);
    const err = validate(row);
    if (err) return res.status(400).json({ success: false, message: err });

    try {
        const dup = await paymentPool.query(
            'SELECT id FROM monthly_plans WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1',
            [row.name]
        );
        if (dup.rows.length > 0) {
            return res.status(409).json({ success: false, message: `A monthly plan named "${row.name}" already exists.` });
        }

        const { rows } = await paymentPool.query(
            `INSERT INTO monthly_plans
               (name, description, price, currency, monthly_tokens, daily_token_limit, billing_interval_months, category, is_custom, is_active, sort_order, razorpay_plan_id, storage_limit_gb)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING *`,
            [row.name, row.description, row.price, row.currency, row.monthly_tokens ?? 0,
             row.daily_token_limit, row.billing_interval_months, row.category, row.is_custom, row.is_active, row.sort_order, row.razorpay_plan_id, row.storage_limit_gb]
        );
        return res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
        if (error.code === '23505')
            return res.status(409).json({ success: false, message: `A monthly plan named "${row.name}" already exists.` });
        return res.status(400).json({ success: false, message: error.message });
    }
};

/** @route GET /api/admin/monthly-plans  (?active=true|false, ?search=) */
exports.getAllMonthlyPlans = async (req, res, paymentPool) => {
    const { active, search, category } = req.query;
    const conditions = [];
    const values = [];
    let i = 1;

    if (active === 'true' || active === 'false') {
        conditions.push(`is_active = $${i++}`);
        values.push(active === 'true');
    }
    if (category === 'solo' || category === 'firm') {
        conditions.push(`category = $${i++}`);
        values.push(category);
    }
    if (search) {
        conditions.push(`name ILIKE $${i++}`);
        values.push(`%${search}%`);
    }

    let query = 'SELECT * FROM monthly_plans';
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY sort_order ASC, name ASC';

    try {
        const { rows } = await paymentPool.query(query, values);
        return res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** @route GET /api/admin/monthly-plans/:id */
exports.getMonthlyPlanById = async (req, res, paymentPool) => {
    try {
        const { rows } = await paymentPool.query('SELECT * FROM monthly_plans WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Monthly plan not found' });
        return res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** @route PUT /api/admin/monthly-plans/:id */
exports.updateMonthlyPlan = async (req, res, paymentPool) => {
    const { id } = req.params;
    try {
        const existing = await paymentPool.query('SELECT * FROM monthly_plans WHERE id = $1', [id]);
        if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Monthly plan not found' });

        const row = rowFromBody(req.body, existing.rows[0]);
        const err = validate(row);
        if (err) return res.status(400).json({ success: false, message: err });

        const conflict = await paymentPool.query(
            'SELECT id FROM monthly_plans WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND id <> $2 LIMIT 1',
            [row.name, id]
        );
        if (conflict.rows.length > 0)
            return res.status(409).json({ success: false, message: `A monthly plan named "${row.name}" already exists.` });

        const { rows } = await paymentPool.query(
            `UPDATE monthly_plans SET
               name=$1, description=$2, price=$3, currency=$4, monthly_tokens=$5,
               daily_token_limit=$6, billing_interval_months=$7, category=$8, is_custom=$9, is_active=$10, sort_order=$11, razorpay_plan_id=$12, storage_limit_gb=$13, updated_at=NOW()
             WHERE id=$14
             RETURNING *`,
            [row.name, row.description, row.price, row.currency, row.monthly_tokens ?? 0,
             row.daily_token_limit, row.billing_interval_months, row.category, row.is_custom, row.is_active, row.sort_order, row.razorpay_plan_id, row.storage_limit_gb, id]
        );
        return res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
        if (error.code === '23505')
            return res.status(409).json({ success: false, message: 'A monthly plan with that name already exists.' });
        return res.status(400).json({ success: false, message: error.message });
    }
};

/**
 * @route DELETE /api/admin/monthly-plans/:id
 * Hard delete — safe while nothing references plans (catalog-only phase). Once purchase
 * tables exist, switch to a soft delete (UPDATE ... SET is_active = false) to keep history.
 */
exports.deleteMonthlyPlan = async (req, res, paymentPool) => {
    try {
        const result = await paymentPool.query('DELETE FROM monthly_plans WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Monthly plan not found' });
        return res.status(200).json({ success: true, message: 'Monthly plan deleted successfully' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
