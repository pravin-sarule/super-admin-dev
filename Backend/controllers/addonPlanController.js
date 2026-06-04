// Add-on plan catalog (payment_DB → addon_plans).
// Storage add-ons for now: extra space, no tokens. Either recurring (billed each cycle)
// or one-time permanent (pay once, never expires).

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

/** Build an addon_plans row from request body, falling back to an existing row on update. */
function rowFromBody(body, existing = null) {
    const name = (body.name != null ? String(body.name) : existing?.name || '').trim();

    const billing_type = ((body.billing_type != null ? String(body.billing_type) : existing?.billing_type || 'recurring')
        .toLowerCase().trim() === 'one_time') ? 'one_time' : 'recurring';

    // billing_interval_months only applies to recurring add-ons; force NULL for one-time.
    let billing_interval_months = null;
    if (billing_type === 'recurring') {
        billing_interval_months = body.billing_interval_months != null
            ? (toInt(body.billing_interval_months) ?? 1)
            : existing?.billing_interval_months ?? 1;
    }

    // validity_years only applies to one-time add-ons (long-term term, then renew); NULL for recurring.
    let validity_years = null;
    if (billing_type === 'one_time') {
        validity_years = body.validity_years != null
            ? (toInt(body.validity_years) ?? 10)
            : existing?.validity_years ?? 10;
    }

    return {
        name,
        description: body.description != null ? String(body.description) : existing?.description ?? null,
        addon_type: (body.addon_type != null ? String(body.addon_type) : existing?.addon_type || 'storage').toLowerCase().trim() || 'storage',
        price: body.price != null ? toNum(body.price) ?? 0 : existing?.price != null ? Number(existing.price) : 0,
        currency: body.currency || existing?.currency || 'INR',
        storage_gb: body.storage_gb != null ? toInt(body.storage_gb) : existing?.storage_gb ?? null,
        billing_type,
        billing_interval_months,
        validity_years,
        is_active: toBool(body.is_active, existing?.is_active ?? true),
        sort_order: body.sort_order != null ? toInt(body.sort_order) ?? 0 : existing?.sort_order ?? 0,
    };
}

function validate(row) {
    if (!row.name) return 'Plan name is required';
    if (row.storage_gb == null || Number.isNaN(row.storage_gb) || row.storage_gb < 1)
        return 'Storage amount is required and must be at least 1 GB';
    if (!['recurring', 'one_time'].includes(row.billing_type)) return 'Billing type must be recurring or one_time';
    if (row.billing_type === 'recurring' && (row.billing_interval_months == null || row.billing_interval_months < 1))
        return 'Billing cycle must be at least 1 month';
    if (row.billing_type === 'one_time' && (row.validity_years == null || row.validity_years < 1))
        return 'Validity (years) is required for one-time add-ons';
    if (row.price != null && row.price < 0) return 'Price must be a non-negative number';
    return null;
}

/** @route POST /api/admin/addon-plans */
exports.createAddonPlan = async (req, res, paymentPool) => {
    const row = rowFromBody(req.body);
    const err = validate(row);
    if (err) return res.status(400).json({ success: false, message: err });

    try {
        const dup = await paymentPool.query(
            'SELECT id FROM addon_plans WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1',
            [row.name]
        );
        if (dup.rows.length > 0) {
            return res.status(409).json({ success: false, message: `An add-on plan named "${row.name}" already exists.` });
        }

        const { rows } = await paymentPool.query(
            `INSERT INTO addon_plans
               (name, description, addon_type, price, currency, storage_gb, billing_type, billing_interval_months, is_active, sort_order, validity_years)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING *`,
            [row.name, row.description, row.addon_type, row.price, row.currency, row.storage_gb,
             row.billing_type, row.billing_interval_months, row.is_active, row.sort_order, row.validity_years]
        );
        return res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
        if (error.code === '23505')
            return res.status(409).json({ success: false, message: `An add-on plan named "${row.name}" already exists.` });
        return res.status(400).json({ success: false, message: error.message });
    }
};

/** @route GET /api/admin/addon-plans  (?active=true|false, ?search=, ?type=storage) */
exports.getAllAddonPlans = async (req, res, paymentPool) => {
    const { active, search, type } = req.query;
    const conditions = [];
    const values = [];
    let i = 1;

    if (active === 'true' || active === 'false') {
        conditions.push(`is_active = $${i++}`);
        values.push(active === 'true');
    }
    if (type) {
        conditions.push(`addon_type = $${i++}`);
        values.push(String(type).toLowerCase());
    }
    if (search) {
        conditions.push(`name ILIKE $${i++}`);
        values.push(`%${search}%`);
    }

    let query = 'SELECT * FROM addon_plans';
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY sort_order ASC, name ASC';

    try {
        const { rows } = await paymentPool.query(query, values);
        return res.status(200).json({ success: true, count: rows.length, data: rows });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** @route GET /api/admin/addon-plans/:id */
exports.getAddonPlanById = async (req, res, paymentPool) => {
    try {
        const { rows } = await paymentPool.query('SELECT * FROM addon_plans WHERE id = $1', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Add-on plan not found' });
        return res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/** @route PUT /api/admin/addon-plans/:id */
exports.updateAddonPlan = async (req, res, paymentPool) => {
    const { id } = req.params;
    try {
        const existing = await paymentPool.query('SELECT * FROM addon_plans WHERE id = $1', [id]);
        if (existing.rows.length === 0) return res.status(404).json({ success: false, message: 'Add-on plan not found' });

        const row = rowFromBody(req.body, existing.rows[0]);
        const err = validate(row);
        if (err) return res.status(400).json({ success: false, message: err });

        const conflict = await paymentPool.query(
            'SELECT id FROM addon_plans WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND id <> $2 LIMIT 1',
            [row.name, id]
        );
        if (conflict.rows.length > 0)
            return res.status(409).json({ success: false, message: `An add-on plan named "${row.name}" already exists.` });

        const { rows } = await paymentPool.query(
            `UPDATE addon_plans SET
               name=$1, description=$2, addon_type=$3, price=$4, currency=$5, storage_gb=$6,
               billing_type=$7, billing_interval_months=$8, is_active=$9, sort_order=$10, validity_years=$11, updated_at=NOW()
             WHERE id=$12
             RETURNING *`,
            [row.name, row.description, row.addon_type, row.price, row.currency, row.storage_gb,
             row.billing_type, row.billing_interval_months, row.is_active, row.sort_order, row.validity_years, id]
        );
        return res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
        if (error.code === '23505')
            return res.status(409).json({ success: false, message: 'An add-on plan with that name already exists.' });
        return res.status(400).json({ success: false, message: error.message });
    }
};

/** @route DELETE /api/admin/addon-plans/:id */
exports.deleteAddonPlan = async (req, res, paymentPool) => {
    try {
        const result = await paymentPool.query('DELETE FROM addon_plans WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rowCount === 0) return res.status(404).json({ success: false, message: 'Add-on plan not found' });
        return res.status(200).json({ success: true, message: 'Add-on plan deleted successfully' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
