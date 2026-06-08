
const db = require('../config/payment_DB');

/** Map UI labels to payment DB `plan_interval` enum values. */
function normalizePlanInterval(interval) {
    if (!interval) return 'month';
    const v = String(interval).toLowerCase();
    if (v === 'monthly' || v === 'month') return 'month';
    if (v === 'yearly' || v === 'year') return 'year';
    if (v === 'quarterly' || v === 'quarter') return 'quarter';
    return interval;
}

/** Helper: read an int field from body or fall back to existing row value. */
function intField(body, existing, key, fallback = null) {
    const raw = body[key] != null ? body[key] : existing?.[key];
    if (raw == null) return fallback;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
}

/** Build a full plan row from request body + optional existing DB row. */
function planRowFromBody(body, existing = null) {
    const name = (body.name != null ? String(body.name) : existing?.name || '').trim();

    // Per-service daily token limits
    const chat_token_limit          = intField(body, existing, 'chat_token_limit');
    const summarization_token_limit = intField(body, existing, 'summarization_token_limit');

    // token_limit: backward-compat derived value
    const tokenLimitRaw = body.token_limit != null ? body.token_limit : existing?.token_limit;
    let token_limit;
    if (tokenLimitRaw != null) {
        token_limit = parseInt(tokenLimitRaw, 10);
    } else {
        const c = Number.isFinite(chat_token_limit) ? chat_token_limit : 0;
        const s = Number.isFinite(summarization_token_limit) ? summarization_token_limit : 0;
        token_limit = (c > 0 || s > 0) ? Math.max(c, s) : 0;
    }

    const limits = body.limits != null
        ? (typeof body.limits === 'object' ? body.limits : JSON.parse(body.limits || '{}'))
        : (existing?.limits || { summaries: 0, drafts: 0 });

    return {
        name,
        token_limit,
        // Chat Model per-plan limits
        chat_token_limit,
        chat_messages_per_hour:       intField(body, existing, 'chat_messages_per_hour'),
        chat_chats_per_day:           intField(body, existing, 'chat_chats_per_day'),
        chat_quota_per_minute:        intField(body, existing, 'chat_quota_per_minute'),
        chat_max_document_pages:      intField(body, existing, 'chat_max_document_pages'),
        chat_max_document_size_mb:    intField(body, existing, 'chat_max_document_size_mb'),
        chat_max_file_upload_per_day: intField(body, existing, 'chat_max_file_upload_per_day'),
        chat_max_upload_files:        intField(body, existing, 'chat_max_upload_files'),
        // Summarization per-plan limits
        summarization_token_limit,
        sum_messages_per_hour:        intField(body, existing, 'sum_messages_per_hour'),
        sum_chats_per_day:            intField(body, existing, 'sum_chats_per_day'),
        sum_quota_per_minute:         intField(body, existing, 'sum_quota_per_minute'),
        sum_max_document_pages:       intField(body, existing, 'sum_max_document_pages'),
        sum_max_document_size_mb:     intField(body, existing, 'sum_max_document_size_mb'),
        sum_max_file_upload_per_day:  intField(body, existing, 'sum_max_file_upload_per_day'),
        sum_max_upload_files:         intField(body, existing, 'sum_max_upload_files'),
        sum_max_context_documents:    intField(body, existing, 'sum_max_context_documents'),
        sum_max_conversation_history: intField(body, existing, 'sum_max_conversation_history'),
        // Legacy / background columns
        description: (body.description != null ? String(body.description) : existing?.description || name || 'Plan').trim(),
        price: body.price != null ? parseFloat(body.price) : (existing?.price != null ? Number(existing.price) : 0),
        currency: body.currency || existing?.currency || 'INR',
        interval: normalizePlanInterval(body.interval || existing?.interval),
        type: body.type || existing?.type || 'individual',
        features: body.features != null ? body.features : (existing?.features ?? {}),
        document_limit: body.document_limit != null ? parseInt(body.document_limit, 10) : (existing?.document_limit ?? 0),
        ai_analysis_limit: body.ai_analysis_limit != null ? parseInt(body.ai_analysis_limit, 10) : (existing?.ai_analysis_limit ?? 0),
        template_access: body.template_access || existing?.template_access || 'basic',
        carry_over_limit: body.carry_over_limit != null ? parseInt(body.carry_over_limit, 10) : (existing?.carry_over_limit ?? 0),
        limits,
        storage_limit_gb: body.storage_limit_gb != null ? parseInt(body.storage_limit_gb, 10) : (existing?.storage_limit_gb ?? 0),
        drafting_type: body.drafting_type || existing?.drafting_type || 'basic',
    };
}

/**
 * @desc    Create plan — only name and token_limit (per day) required from admin UI
 * @route   POST /api/admin/plans
 */
exports.createPlan = async (req, res, paymentPool) => {
    const row = planRowFromBody(req.body);

    if (!row.name) {
        return res.status(400).json({ success: false, message: 'Plan name is required' });
    }
    if (row.chat_token_limit == null || Number.isNaN(row.chat_token_limit) || row.chat_token_limit < 0) {
        return res.status(400).json({ success: false, message: 'Chat token limit (per day) is required and must be a non-negative number' });
    }
    if (row.summarization_token_limit == null || Number.isNaN(row.summarization_token_limit) || row.summarization_token_limit < 0) {
        return res.status(400).json({ success: false, message: 'Summarization token limit (per day) is required and must be a non-negative number' });
    }

    const query = `
        INSERT INTO subscription_plans (
            name, description, price, currency, "interval", type,
            features, document_limit, ai_analysis_limit, template_access,
            token_limit, carry_over_limit, limits, storage_limit_gb, drafting_type,
            chat_token_limit, chat_messages_per_hour, chat_chats_per_day, chat_quota_per_minute,
            chat_max_document_pages, chat_max_document_size_mb, chat_max_file_upload_per_day, chat_max_upload_files,
            summarization_token_limit, sum_messages_per_hour, sum_chats_per_day, sum_quota_per_minute,
            sum_max_document_pages, sum_max_document_size_mb, sum_max_file_upload_per_day, sum_max_upload_files,
            sum_max_context_documents, sum_max_conversation_history
        )
        VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
            $16,$17,$18,$19,$20,$21,$22,$23,
            $24,$25,$26,$27,$28,$29,$30,$31,$32,$33
        )
        RETURNING *;
    `;

    const values = [
        row.name, row.description, row.price, row.currency, row.interval, row.type,
        typeof row.features === 'object' ? JSON.stringify(row.features) : (row.features || '{}'),
        row.document_limit, row.ai_analysis_limit, row.template_access,
        row.token_limit, row.carry_over_limit, JSON.stringify(row.limits), row.storage_limit_gb, row.drafting_type,
        // chat
        row.chat_token_limit, row.chat_messages_per_hour, row.chat_chats_per_day, row.chat_quota_per_minute,
        row.chat_max_document_pages, row.chat_max_document_size_mb, row.chat_max_file_upload_per_day, row.chat_max_upload_files,
        // summarization
        row.summarization_token_limit, row.sum_messages_per_hour, row.sum_chats_per_day, row.sum_quota_per_minute,
        row.sum_max_document_pages, row.sum_max_document_size_mb, row.sum_max_file_upload_per_day, row.sum_max_upload_files,
        row.sum_max_context_documents, row.sum_max_conversation_history,
    ];

    try {
        const existingByName = await paymentPool.query(
            'SELECT id, name FROM subscription_plans WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) LIMIT 1',
            [row.name]
        );
        if (existingByName.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: `A plan named "${row.name}" already exists. Use a different name or edit the existing plan.`,
            });
        }

        const { rows } = await paymentPool.query(query, values);
        return res.status(201).json({ success: true, data: rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: `A plan named "${row.name}" already exists. Use a different name or edit the existing plan.`,
            });
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

    query += ' ORDER BY name ASC';

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

    try {
        const existing = await paymentPool.query('SELECT * FROM subscription_plans WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }

        const row = planRowFromBody(req.body, existing.rows[0]);

        if (!row.name) {
            return res.status(400).json({ success: false, message: 'Plan name is required' });
        }
        if (row.chat_token_limit == null || Number.isNaN(row.chat_token_limit) || row.chat_token_limit < 0) {
            return res.status(400).json({ success: false, message: 'Chat token limit (per day) is required' });
        }
        if (row.summarization_token_limit == null || Number.isNaN(row.summarization_token_limit) || row.summarization_token_limit < 0) {
            return res.status(400).json({ success: false, message: 'Summarization token limit (per day) is required' });
        }

        const nameConflict = await paymentPool.query(
            'SELECT id FROM subscription_plans WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND id <> $2 LIMIT 1',
            [row.name, id]
        );
        if (nameConflict.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: `A plan named "${row.name}" already exists. Use a different name.`,
            });
        }

        const { rows } = await paymentPool.query(
            `UPDATE subscription_plans
             SET name = $1, token_limit = $2, description = $3,
                 price = $4, currency = $5, "interval" = $6, type = $7,
                 chat_token_limit = $8, chat_messages_per_hour = $9, chat_chats_per_day = $10,
                 chat_quota_per_minute = $11, chat_max_document_pages = $12, chat_max_document_size_mb = $13,
                 chat_max_file_upload_per_day = $14, chat_max_upload_files = $15,
                 summarization_token_limit = $16, sum_messages_per_hour = $17, sum_chats_per_day = $18,
                 sum_quota_per_minute = $19, sum_max_document_pages = $20, sum_max_document_size_mb = $21,
                 sum_max_file_upload_per_day = $22, sum_max_upload_files = $23,
                 sum_max_context_documents = $24, sum_max_conversation_history = $25,
                 updated_at = NOW()
             WHERE id = $26
             RETURNING *`,
            [
                row.name, row.token_limit, row.description,
                row.price, row.currency, row.interval, row.type,
                row.chat_token_limit, row.chat_messages_per_hour, row.chat_chats_per_day,
                row.chat_quota_per_minute, row.chat_max_document_pages, row.chat_max_document_size_mb,
                row.chat_max_file_upload_per_day, row.chat_max_upload_files,
                row.summarization_token_limit, row.sum_messages_per_hour, row.sum_chats_per_day,
                row.sum_quota_per_minute, row.sum_max_document_pages, row.sum_max_document_size_mb,
                row.sum_max_file_upload_per_day, row.sum_max_upload_files,
                row.sum_max_context_documents, row.sum_max_conversation_history,
                id,
            ]
        );

        return res.status(200).json({ success: true, data: rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: `A plan named "${row.name}" already exists. Use a different name.`,
            });
        }
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



