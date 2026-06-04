// Plan-centric analytics — STRICTLY READ-ONLY (SELECT only; never mutates any table).
// "How many users bought each plan" + drill-in lists of those users.
//   monthly → subscribers from user_subscriptions.monthly_plan_id
//   topup   → buyers from user_token_topup_purchases.topup_plan_id
//   addon   → catalog only (no per-user purchase table yet → tracked:false)
// pools = { authPool, paymentPool }.

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const PAID = ['captured', 'paid', 'success', 'succeeded', 'completed'];

/** Enrich Payment-DB rows (which only have user_id) with username/email from the Auth DB. */
async function attachUsers(rows, authPool) {
    const ids = [...new Set(rows.map((r) => r.user_id).filter((v) => v != null))];
    if (!ids.length) return rows.map((r) => ({ ...r, username: null, email: null, is_blocked: false }));
    const { rows: users } = await authPool.query(
        'SELECT id, username, email, is_blocked FROM users WHERE id = ANY($1::int[])',
        [ids]
    );
    const map = new Map(users.map((u) => [String(u.id), u]));
    return rows.map((r) => {
        const u = map.get(String(r.user_id));
        return { ...r, username: u?.username || null, email: u?.email || null, is_blocked: u?.is_blocked || false };
    });
}

/** GET /summary — counts per monthly plan + per topup plan, plus add-on catalog. */
exports.getSummary = async (req, res, pools) => {
    try {
        const monthly = await pools.paymentPool.query(
            `SELECT mp.id, mp.name, mp.price, mp.currency, mp.category, mp.is_custom,
                    COUNT(us.id)::int AS subscribers,
                    COUNT(us.id) FILTER (WHERE LOWER(COALESCE(us.status, 'active')) IN ('active', 'topup_only'))::int AS active_subscribers
             FROM monthly_plans mp
             LEFT JOIN user_subscriptions us ON us.monthly_plan_id = mp.id
             GROUP BY mp.id, mp.name, mp.price, mp.currency, mp.category, mp.is_custom
             ORDER BY subscribers DESC, mp.sort_order ASC, mp.id ASC`
        );
        const topup = await pools.paymentPool.query(
            `SELECT tp.id, tp.name, tp.price, tp.currency, tp.tokens,
                    COUNT(DISTINCT up.user_id)::int AS buyers,
                    COUNT(up.id)::int AS purchases,
                    COALESCE(SUM(up.amount) FILTER (WHERE LOWER(COALESCE(up.status, '')) = ANY($1::text[])), 0)::numeric AS revenue
             FROM topup_plans tp
             LEFT JOIN user_token_topup_purchases up ON up.topup_plan_id = tp.id
             GROUP BY tp.id, tp.name, tp.price, tp.currency, tp.tokens
             ORDER BY purchases DESC, tp.sort_order ASC, tp.id ASC`,
            [PAID]
        );
        const addons = await pools.paymentPool.query(
            `SELECT id, name, price, currency, storage_gb, billing_type, billing_interval_months, validity_years
             FROM addon_plans WHERE is_active = true ORDER BY sort_order ASC, id ASC`
        );
        return res.status(200).json({
            success: true,
            data: {
                monthly: monthly.rows,
                topup: topup.rows,
                addons: { tracked: false, catalog: addons.rows },
            },
        });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};

/** GET /monthly/:planId/subscribers */
exports.getMonthlySubscribers = async (req, res, pools) => {
    const planId = parseInt(req.params.planId, 10);
    if (!Number.isFinite(planId)) return res.status(400).json({ success: false, message: 'Invalid plan id' });
    try {
        const { rows } = await pools.paymentPool.query(
            `SELECT us.user_id, us.status, us.start_date, us.last_reset_date, us.end_date, us.created_at,
                    COALESCE(us.current_token_balance, 0)::bigint AS current_token_balance,
                    COALESCE(us.topup_token_balance, 0)::bigint  AS topup_token_balance
             FROM user_subscriptions us
             WHERE us.monthly_plan_id = $1
             ORDER BY us.created_at DESC NULLS LAST`,
            [planId]
        );
        return res.status(200).json({ success: true, data: await attachUsers(rows, pools.authPool) });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};

/** GET /topup/:planId/buyers */
exports.getTopupBuyers = async (req, res, pools) => {
    const planId = parseInt(req.params.planId, 10);
    if (!Number.isFinite(planId)) return res.status(400).json({ success: false, message: 'Invalid plan id' });
    try {
        const { rows } = await pools.paymentPool.query(
            `SELECT up.user_id, up.amount, up.currency, up.tokens_credited, up.status, up.created_at, up.expires_at
             FROM user_token_topup_purchases up
             WHERE up.topup_plan_id = $1
             ORDER BY up.created_at DESC NULLS LAST
             LIMIT 500`,
            [planId]
        );
        return res.status(200).json({ success: true, data: await attachUsers(rows, pools.authPool) });
    } catch (e) {
        return res.status(500).json({ success: false, message: e.message });
    }
};
