// Admin per-user (and per-firm) billing/usage analytics — STRICTLY READ-ONLY.
// Every query here is a SELECT (plus a read-only to_regclass existence check).
// This controller NEVER inserts/updates/deletes or alters any table in any database.
//
// Aggregates the same data the user-facing "Billing & Usage" page shows, for any
// admin-selected user, across: Auth DB (users/firms), Payment DB (subscriptions,
// plans, payments, llm_usage_logs), Document DB (user_files/file_chats/chunk_vectors),
// Draft DB (generated_documents/user_drafts), Citation DB (citation_reports).
//
// Pools are passed in: { authPool, paymentPool, aiDocumentPool, draftPool, citationPool }.

/* ── helpers ── */
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pct = (used, limit) => (limit > 0 ? (num(used) / num(limit)) * 100 : 0);
const GB = 1024 * 1024 * 1024;

/** Run a section query; never throws — returns {ok,data,error} so one DB outage can't 500 the page. */
async function safeSection(label, fn, errors) {
    try {
        return { ok: true, data: await fn() };
    } catch (e) {
        console.error(`[userAnalytics] section "${label}" failed:`, e.message);
        if (errors) errors.push(label);
        return { ok: false, error: e.message, data: null };
    }
}

/* ── per-user sub-queries (take an array of numeric user ids; single-user passes [id]) ── */

async function queryUsers(userIds, authPool) {
    const { rows } = await authPool.query(
        `SELECT id, email, username, account_type, is_blocked, active_plan_id, active_plan_name
         FROM users WHERE id = ANY($1::int[])`,
        [userIds]
    );
    return rows;
}

async function querySubscriptions(userIds, paymentPool) {
    // One best row per user: active/topup_only first, else most recently updated.
    const { rows } = await paymentPool.query(
        `SELECT DISTINCT ON (us.user_id)
           us.user_id,
           COALESCE(mp.name, sp.name, 'Free')                    AS plan_name,
           (mp.id IS NULL AND sp.id IS NOT NULL)                 AS is_legacy,
           COALESCE(mp.monthly_tokens, sp.token_limit, 0)::bigint AS monthly_tokens,
           COALESCE(us.plan_tokens_used, 0)::bigint              AS plan_tokens_used,
           COALESCE(mp.storage_limit_gb, sp.storage_limit_gb)    AS storage_limit_gb,
           COALESCE(us.topup_token_balance, 0)::bigint           AS topup_token_balance,
           us.topup_expires_at,
           COALESCE(us.last_reset_date, us.start_date)           AS billing_period_start,
           us.end_date,
           us.status,
           COALESCE(us.current_token_balance, 0)::bigint         AS current_token_balance
         FROM user_subscriptions us
         LEFT JOIN monthly_plans mp      ON mp.id = us.monthly_plan_id
         LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
         WHERE us.user_id = ANY($1::int[])
         ORDER BY us.user_id,
                  (LOWER(COALESCE(us.status, 'active')) IN ('active', 'topup_only')) DESC,
                  us.updated_at DESC NULLS LAST`,
        [userIds]
    );
    return rows;
}

/** Per-user token totals: today (IST), all-time, this billing period (per each user's own start). */
async function queryTokensPerUser(userIds, paymentPool) {
    const { rows } = await paymentPool.query(
        `WITH sub AS (
           SELECT DISTINCT ON (user_id) user_id, COALESCE(last_reset_date, start_date) AS period_start
           FROM user_subscriptions
           WHERE user_id = ANY($1::int[])
           ORDER BY user_id,
                    (LOWER(COALESCE(status, 'active')) IN ('active', 'topup_only')) DESC,
                    updated_at DESC NULLS LAST
         )
         SELECT
           l.user_id::text AS user_id,
           COALESCE(SUM(l.total_tokens) FILTER (
             WHERE (l.used_at AT TIME ZONE 'Asia/Kolkata')::date = (NOW() AT TIME ZONE 'Asia/Kolkata')::date
           ), 0)::bigint AS today,
           COALESCE(SUM(l.total_tokens), 0)::bigint AS all_time,
           COALESCE(SUM(l.total_tokens) FILTER (
             WHERE s.period_start IS NOT NULL AND l.used_at >= s.period_start
           ), 0)::bigint AS this_period,
           COALESCE(SUM(l.total_cost), 0)::numeric AS total_cost
         FROM llm_usage_logs l
         LEFT JOIN sub s ON s.user_id = l.user_id::int
         WHERE l.user_id::text = ANY($1::text[])
         GROUP BY l.user_id`,
        [userIds]
    );
    return rows;
}

async function queryAiByModel(userIds, paymentPool, days = null) {
    const params = [userIds];
    let dateClause = '';
    if (days) { params.push(String(days)); dateClause = `AND used_at >= NOW() - ($${params.length} || ' days')::interval`; }
    const { rows } = await paymentPool.query(
        `SELECT model_name,
                COALESCE(SUM(total_tokens), 0)::bigint  AS total_tokens,
                COALESCE(SUM(input_tokens), 0)::bigint  AS input_tokens,
                COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
                COALESCE(SUM(total_cost), 0)::numeric   AS total_cost,
                COALESCE(SUM(request_count), 0)::bigint AS requests
         FROM llm_usage_logs
         WHERE user_id::text = ANY($1::text[]) ${dateClause}
         GROUP BY model_name
         ORDER BY total_cost DESC NULLS LAST, total_tokens DESC`,
        params
    );
    return rows;
}

/** Daily token/cost series over the last N days (IST). Shared by token-usage + ai-usage endpoints. */
async function queryTokenSeries(userIds, paymentPool, days) {
    const { rows } = await paymentPool.query(
        `SELECT (used_at AT TIME ZONE 'Asia/Kolkata')::date AS date,
                COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens,
                COALESCE(SUM(total_cost), 0)::numeric  AS total_cost,
                COALESCE(SUM(request_count), 0)::bigint AS requests
         FROM llm_usage_logs
         WHERE user_id::text = ANY($1::text[]) AND used_at >= (NOW() - ($2 || ' days')::interval)
         GROUP BY date ORDER BY date ASC`,
        [userIds, String(days)]
    );
    return rows.map((r) => ({ date: r.date, total_tokens: num(r.total_tokens), total_cost: num(r.total_cost), requests: num(r.requests) }));
}

const clampDays = (v, def = 30) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 1 && n <= 366 ? n : def;
};

async function queryPayments(userIds, paymentPool) {
    const { rows } = await paymentPool.query(
        `SELECT p.id, p.amount, p.currency, p.status, p.payment_method,
                p.created_at, p.transaction_date, p.razorpay_payment_id,
                p.user_id,
                COALESCE(mp.name, sp.name) AS plan_name
         FROM payments p
         LEFT JOIN user_subscriptions us ON p.subscription_id = us.id
         LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
         LEFT JOIN monthly_plans mp      ON us.monthly_plan_id = mp.id
         WHERE p.user_id = ANY($1::int[])
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT 200`,
        [userIds]
    );
    return rows;
}

/** Top-up purchases live in their own table (separate from `payments`). */
async function queryTopupPurchases(userIds, paymentPool) {
    const { rows } = await paymentPool.query(
        `SELECT tp.id, tp.amount, tp.currency, tp.status, tp.created_at, tp.expires_at,
                tp.tokens_credited, tp.razorpay_payment_id, pl.name AS plan_name
         FROM user_token_topup_purchases tp
         LEFT JOIN topup_plans pl ON pl.id = tp.topup_plan_id
         WHERE tp.user_id = ANY($1::int[])
         ORDER BY tp.created_at DESC NULLS LAST
         LIMIT 200`,
        [userIds]
    );
    return rows;
}

async function queryPaymentsTotalPerUser(userIds, paymentPool) {
    const { rows } = await paymentPool.query(
        `SELECT user_id::text AS user_id,
                COALESCE(SUM(amount) FILTER (WHERE LOWER(COALESCE(status,'')) IN ('captured','paid','success','succeeded')), 0)::numeric AS paid_total,
                COUNT(*)::int AS payment_count
         FROM payments WHERE user_id = ANY($1::int[]) GROUP BY user_id`,
        [userIds]
    );
    return rows;
}

/** Add-ons: catalog only for now. Detect a runtime per-user table without assuming it exists. */
async function queryAddons(userIds, paymentPool) {
    const reg = await paymentPool.query(`SELECT to_regclass('public.user_addons') AS t`);
    const hasUserAddons = reg.rows[0] && reg.rows[0].t;
    const catalog = await paymentPool.query(
        `SELECT id, name, price, currency, storage_gb, billing_type, billing_interval_months, validity_years
         FROM addon_plans WHERE is_active = true ORDER BY sort_order ASC, id ASC`
    );
    if (!hasUserAddons) {
        return { tracked: false, catalog: catalog.rows, purchased: [] };
    }
    // Defensive: only runs if a user_addons table actually exists.
    const purchased = await paymentPool.query(
        `SELECT * FROM user_addons WHERE user_id = ANY($1::int[])`,
        [userIds]
    );
    return { tracked: true, catalog: catalog.rows, purchased: purchased.rows };
}

/* ── derivations ── */

function deriveTokens(subRow, tokenRow) {
    const monthly = num(subRow?.monthly_tokens);
    const planUsed = num(subRow?.plan_tokens_used);
    const thisPeriod = num(tokenRow?.this_period);
    const topupExpired = subRow?.topup_expires_at ? new Date(subRow.topup_expires_at) < new Date() : false;
    const topupBalance = topupExpired ? 0 : num(subRow?.topup_token_balance);
    const planLeft = Math.max(0, monthly - planUsed);
    return {
        today: num(tokenRow?.today),
        all_time: num(tokenRow?.all_time),
        this_period: thisPeriod,
        monthly_tokens: monthly,
        plan_tokens_used: planUsed,
        plan_tokens_left: planLeft,
        topup_balance: topupBalance,
        topup_expired: topupExpired,
        total_available: planLeft + topupBalance,
        remaining: Math.max(0, monthly - thisPeriod),
    };
}

function aiTotals(byModel) {
    return byModel.reduce((acc, m) => ({
        total_tokens: acc.total_tokens + num(m.total_tokens),
        total_cost: acc.total_cost + num(m.total_cost),
        requests: acc.requests + num(m.requests),
    }), { total_tokens: 0, total_cost: 0, requests: 0 });
}

const PAID_STATUSES = new Set(['captured', 'paid', 'success', 'succeeded', 'completed']);

/** Merge regular plan payments + topup purchases into one typed, sorted list with a summary + monthly series. */
function buildPaymentsPayload(planRows, topupRows) {
    const items = [
        ...(planRows || []).map((r) => ({
            id: `p-${r.id}`, type: 'plan', amount: num(r.amount), currency: r.currency || 'INR',
            status: r.status, payment_method: r.payment_method || '—', created_at: r.created_at || r.transaction_date,
            plan_name: r.plan_name || '—', tokens_credited: null, expires_at: null, razorpay_payment_id: r.razorpay_payment_id,
        })),
        ...(topupRows || []).map((r) => ({
            id: `t-${r.id}`, type: 'topup', amount: num(r.amount), currency: r.currency || 'INR',
            status: r.status, payment_method: 'Razorpay', created_at: r.created_at,
            plan_name: r.plan_name || 'Top-up', tokens_credited: num(r.tokens_credited), expires_at: r.expires_at, razorpay_payment_id: r.razorpay_payment_id,
        })),
    ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const summary = items.reduce((s, it) => {
        const paid = PAID_STATUSES.has(String(it.status || '').toLowerCase());
        if (it.type === 'topup') { s.topup_count += 1; s.topup_total += paid ? it.amount : 0; s.topup_tokens += it.tokens_credited || 0; }
        else { s.plan_count += 1; s.plan_total += paid ? it.amount : 0; }
        return s;
    }, { plan_total: 0, plan_count: 0, topup_total: 0, topup_count: 0, topup_tokens: 0 });
    summary.total = summary.plan_total + summary.topup_total;

    const mm = {};
    items.forEach((it) => {
        if (!PAID_STATUSES.has(String(it.status || '').toLowerCase()) || !it.created_at) return;
        const key = new Date(it.created_at).toISOString().slice(0, 7); // YYYY-MM
        if (!mm[key]) mm[key] = { month: key, plan: 0, topup: 0 };
        mm[key][it.type === 'topup' ? 'topup' : 'plan'] += it.amount;
    });
    const by_month = Object.values(mm).sort((a, b) => a.month.localeCompare(b.month));

    return { items, summary, by_month };
}

/* ── storage (heavy, cross-DB; each slice independently fail-safe) ── */

async function computeStorage(userIds, pools, errors) {
    const { aiDocumentPool, draftPool, citationPool } = pools;

    const files = await safeSection('files', async () => {
        const { rows } = await aiDocumentPool.query(
            `SELECT
               COALESCE(SUM(size),0)::bigint AS total_bytes,
               COUNT(*)::int AS total_count,
               COALESCE(SUM(size) FILTER (WHERE COALESCE(gcs_path,'') LIKE 'chat-uploads/%'),0)::bigint AS chat_bytes,
               COUNT(*) FILTER (WHERE COALESCE(gcs_path,'') LIKE 'chat-uploads/%')::int AS chat_count,
               COALESCE(SUM(size) FILTER (WHERE COALESCE(gcs_path,'') ~ ('^' || user_id || '/documents/')),0)::bigint AS doc_bytes,
               COUNT(*) FILTER (WHERE COALESCE(gcs_path,'') ~ ('^' || user_id || '/documents/'))::int AS doc_count,
               COALESCE(SUM(size) FILTER (WHERE COALESCE(gcs_path,'') LIKE 'uploads/%'),0)::bigint AS upload_bytes,
               COUNT(*) FILTER (WHERE COALESCE(gcs_path,'') LIKE 'uploads/%')::int AS upload_count,
               COALESCE(SUM(size) FILTER (
                 WHERE COALESCE(gcs_path,'') NOT LIKE 'chat-uploads/%'
                   AND NOT (COALESCE(gcs_path,'') ~ ('^' || user_id || '/documents/'))
                   AND COALESCE(gcs_path,'') NOT LIKE 'uploads/%'),0)::bigint AS other_bytes,
               COUNT(*) FILTER (
                 WHERE COALESCE(gcs_path,'') NOT LIKE 'chat-uploads/%'
                   AND NOT (COALESCE(gcs_path,'') ~ ('^' || user_id || '/documents/'))
                   AND COALESCE(gcs_path,'') NOT LIKE 'uploads/%')::int AS other_count
             FROM user_files
             WHERE user_id = ANY($1::text[]) AND (is_folder IS NULL OR is_folder = false)`,
            [userIds]
        );
        return rows[0];
    }, errors);

    const chats = await safeSection('chat_text', async () => {
        const { rows } = await aiDocumentPool.query(
            `SELECT COUNT(*)::int AS cnt,
                    COALESCE(SUM(OCTET_LENGTH(COALESCE(question,'')) + OCTET_LENGTH(COALESCE(answer,''))),0)::bigint AS bytes
             FROM file_chats WHERE user_id = ANY($1::int[])`,
            [userIds]
        );
        return rows[0];
    }, errors);

    const vectors = await safeSection('vectors', async () => {
        const { rows } = await aiDocumentPool.query(
            `SELECT COUNT(*)::int AS cnt
             FROM chunk_vectors cv JOIN user_files uf ON cv.file_id = uf.id
             WHERE uf.user_id = ANY($1::text[])`,
            [userIds]
        );
        return rows[0];
    }, errors);

    const drafts = await safeSection('drafts', async () => {
        const { rows } = await draftPool.query(
            `SELECT COUNT(gd.document_id)::int AS cnt, COALESCE(SUM(gd.file_size),0)::bigint AS bytes
             FROM generated_documents gd JOIN user_drafts ud ON gd.draft_id = ud.draft_id
             WHERE ud.user_id = ANY($1::int[])`,
            [userIds]
        );
        return rows[0];
    }, errors);

    const citations = await safeSection('citations', async () => {
        const { rows } = await citationPool.query(
            `SELECT COUNT(*)::int AS cnt,
                    COALESCE(SUM(OCTET_LENGTH(COALESCE(query,'')) + OCTET_LENGTH(COALESCE(report_format::text,''))),0)::bigint AS bytes
             FROM citation_reports WHERE user_id = ANY($1::text[])`,
            [userIds]
        );
        return rows[0];
    }, errors);

    const vectorBytes = vectors.ok ? num(vectors.data.cnt) * 768 * 4 : 0;
    const breakdown = [
        { key: 'documents',   label: 'Documents',        bytes: files.ok ? num(files.data.doc_bytes) : 0,    count: files.ok ? num(files.data.doc_count) : null,    ok: files.ok },
        { key: 'chat_uploads',label: 'Chat Uploads',     bytes: files.ok ? num(files.data.chat_bytes) : 0,   count: files.ok ? num(files.data.chat_count) : null,   ok: files.ok },
        { key: 'uploads',     label: 'Draft Attachments',bytes: files.ok ? num(files.data.upload_bytes) : 0, count: files.ok ? num(files.data.upload_count) : null, ok: files.ok },
        { key: 'other',       label: 'Other Uploads',    bytes: files.ok ? num(files.data.other_bytes) : 0,  count: files.ok ? num(files.data.other_count) : null,  ok: files.ok },
        { key: 'chat_text',   label: 'Chat History',     bytes: chats.ok ? num(chats.data.bytes) : 0,        count: chats.ok ? num(chats.data.cnt) : null,          ok: chats.ok },
        { key: 'vectors',     label: 'Smart Search Index', bytes: vectorBytes,                                count: vectors.ok ? num(vectors.data.cnt) : null,      ok: vectors.ok },
        { key: 'drafts',      label: 'Generated Drafts', bytes: drafts.ok ? num(drafts.data.bytes) : 0,      count: drafts.ok ? num(drafts.data.cnt) : null,        ok: drafts.ok },
        { key: 'citations',   label: 'Legal Research',   bytes: citations.ok ? num(citations.data.bytes) : 0,count: citations.ok ? num(citations.data.cnt) : null,  ok: citations.ok },
    ];
    const totalBytes = breakdown.reduce((s, b) => s + b.bytes, 0);
    return { totalBytes, breakdown };
}

/* ── route handlers ── */

/** GET /users/:userId/analytics */
exports.getUserAnalytics = async (req, res, pools) => {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    const ids = [userId];
    const section_errors = [];
    try {
        const users = await queryUsers(ids, pools.authPool);
        if (users.length === 0) return res.status(404).json({ success: false, message: 'User not found' });

        const [subs, tokensPU, byModel, payments, topups, addons] = await Promise.all([
            safeSection('plan', () => querySubscriptions(ids, pools.paymentPool), section_errors),
            safeSection('tokens', () => queryTokensPerUser(ids, pools.paymentPool), section_errors),
            safeSection('ai_usage', () => queryAiByModel(ids, pools.paymentPool), section_errors),
            safeSection('payments', () => queryPayments(ids, pools.paymentPool), section_errors),
            safeSection('topups', () => queryTopupPurchases(ids, pools.paymentPool), section_errors),
            safeSection('addons', () => queryAddons(ids, pools.paymentPool), section_errors),
        ]);

        const subRow = subs.ok ? subs.data[0] || null : null;
        const tokenRow = tokensPU.ok ? tokensPU.data[0] || null : null;
        const byModelRows = byModel.ok ? byModel.data : [];
        const paymentsPayload = buildPaymentsPayload(payments.ok ? payments.data : [], topups.ok ? topups.data : []);

        return res.status(200).json({
            success: true,
            data: {
                user: users[0],
                plan: { ok: subs.ok, error: subs.error, data: subRow },
                tokens: { ok: subs.ok && tokensPU.ok, data: deriveTokens(subRow, tokenRow) },
                ai_usage: { ok: byModel.ok, error: byModel.error, data: { by_model: byModelRows, totals: aiTotals(byModelRows) } },
                payments: { ok: payments.ok && topups.ok, error: payments.error || topups.error, data: paymentsPayload },
                addons: { ok: addons.ok, error: addons.error, data: addons.ok ? addons.data : { tracked: false, catalog: [], purchased: [] } },
            },
            meta: { section_errors },
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};

/** GET /users/:userId/storage */
exports.getUserStorage = async (req, res, pools) => {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    const ids = [userId];
    const section_errors = [];
    try {
        const subs = await safeSection('plan', () => querySubscriptions(ids, pools.paymentPool), section_errors);
        const limitGb = subs.ok && subs.data[0] && subs.data[0].storage_limit_gb != null ? num(subs.data[0].storage_limit_gb) : null;
        const { totalBytes, breakdown } = await computeStorage(ids, pools, section_errors);
        const limitBytes = limitGb != null ? limitGb * GB : null;
        return res.status(200).json({
            success: true,
            data: {
                total_bytes: totalBytes,
                total_gb: +(totalBytes / GB).toFixed(2),
                limit_gb: limitGb,
                limit_bytes: limitBytes,
                used_percent: limitBytes ? +pct(totalBytes, limitBytes).toFixed(1) : null,
                over_limit: limitBytes ? totalBytes > limitBytes : false,
                breakdown,
            },
            meta: { section_errors },
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};

/** GET /users/:userId/token-usage?days=30 — daily token series for the chart. */
exports.getUserTokenTimeseries = async (req, res, pools) => {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    const days = clampDays(req.query.days);
    try {
        const series = await queryTokenSeries([userId], pools.paymentPool, days);
        return res.status(200).json({ success: true, data: { days, series } });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};

/** GET /users/:userId/ai-usage?days=30 — windowed AI/LLM usage: by-model + daily trend + totals. */
exports.getUserAiUsage = async (req, res, pools) => {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    const days = clampDays(req.query.days);
    try {
        const [byModel, daily] = await Promise.all([
            queryAiByModel([userId], pools.paymentPool, days),
            queryTokenSeries([userId], pools.paymentPool, days),
        ]);
        return res.status(200).json({
            success: true,
            data: { days, by_model: byModel, daily, totals: aiTotals(byModel) },
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};

/** GET /firms/:firmId/analytics — aggregate over member user_ids + per-member breakdown. */
exports.getFirmAnalytics = async (req, res, pools) => {
    const firmId = req.params.firmId;
    const section_errors = [];
    try {
        // Firm + members from Auth DB.
        const firmRes = await pools.authPool.query(
            `SELECT id, firm_name, approval_status, admin_user_id FROM firms WHERE id = $1`,
            [firmId]
        );
        if (firmRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Firm not found' });
        const membersRes = await pools.authPool.query(
            `SELECT u.id, u.username, u.email, u.is_blocked, u.account_type, fu.role
             FROM firm_users fu JOIN users u ON fu.user_id = u.id
             WHERE fu.firm_id = $1 ORDER BY fu.created_at ASC NULLS LAST, u.id ASC`,
            [firmId]
        );
        const members = membersRes.rows;
        const memberIds = members.map((m) => m.id);

        if (memberIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    firm: { ...firmRes.rows[0], member_count: 0 },
                    aggregate: { tokens: deriveTokens(null, null), ai_usage: { by_model: [], totals: aiTotals([]) }, payments_total: 0, payment_count: 0 },
                    members: [],
                },
                meta: { member_user_ids: [], section_errors },
            });
        }

        const [subs, tokensPU, byModel, payTotals, payments, topups] = await Promise.all([
            safeSection('plan', () => querySubscriptions(memberIds, pools.paymentPool), section_errors),
            safeSection('tokens', () => queryTokensPerUser(memberIds, pools.paymentPool), section_errors),
            safeSection('ai_usage', () => queryAiByModel(memberIds, pools.paymentPool), section_errors),
            safeSection('payments_total', () => queryPaymentsTotalPerUser(memberIds, pools.paymentPool), section_errors),
            safeSection('payments', () => queryPayments(memberIds, pools.paymentPool), section_errors),
            safeSection('topups', () => queryTopupPurchases(memberIds, pools.paymentPool), section_errors),
        ]);

        const subByUser = new Map((subs.ok ? subs.data : []).map((r) => [String(r.user_id), r]));
        const tokByUser = new Map((tokensPU.ok ? tokensPU.data : []).map((r) => [String(r.user_id), r]));
        const payByUser = new Map((payTotals.ok ? payTotals.data : []).map((r) => [String(r.user_id), r]));
        const byModelRows = byModel.ok ? byModel.data : [];

        // Aggregate token numbers = sum across members (each on their own period).
        const agg = { today: 0, all_time: 0, this_period: 0, monthly_tokens: 0, plan_tokens_used: 0, plan_tokens_left: 0, topup_balance: 0, total_available: 0, remaining: 0 };
        const memberRows = members.map((m) => {
            const sub = subByUser.get(String(m.id)) || null;
            const tok = tokByUser.get(String(m.id)) || null;
            const d = deriveTokens(sub, tok);
            const pay = payByUser.get(String(m.id));
            agg.today += d.today; agg.all_time += d.all_time; agg.this_period += d.this_period;
            agg.monthly_tokens += d.monthly_tokens; agg.plan_tokens_used += d.plan_tokens_used;
            agg.plan_tokens_left += d.plan_tokens_left; agg.topup_balance += d.topup_balance;
            agg.total_available += d.total_available; agg.remaining += d.remaining;
            return {
                user: { id: m.id, username: m.username, email: m.email, role: m.role, is_blocked: m.is_blocked, account_type: m.account_type },
                plan_name: sub ? sub.plan_name : 'Free',
                tokens: { today: d.today, all_time: d.all_time, this_period: d.this_period },
                ai_cost: num(tok?.total_cost),
                payments_total: num(pay?.paid_total),
            };
        });

        const paidTotal = (payTotals.ok ? payTotals.data : []).reduce((s, r) => s + num(r.paid_total), 0);
        const payCount = (payTotals.ok ? payTotals.data : []).reduce((s, r) => s + num(r.payment_count), 0);

        return res.status(200).json({
            success: true,
            data: {
                firm: { ...firmRes.rows[0], member_count: members.length },
                aggregate: {
                    tokens: agg,
                    ai_usage: { by_model: byModelRows, totals: aiTotals(byModelRows) },
                    payments_total: paidTotal,
                    payment_count: payCount,
                    payments: buildPaymentsPayload(payments.ok ? payments.data : [], topups.ok ? topups.data : []),
                },
                members: memberRows,
            },
            meta: { member_user_ids: memberIds, section_errors },
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};
