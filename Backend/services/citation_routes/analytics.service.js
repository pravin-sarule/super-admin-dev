/**
 * Service for Citation Analytics (citation_usage_events @ citationTest).
 *
 * Cross-DB by necessity: cost events live in citationTest, while user names, emails and
 * firm ("department") membership live in Auth_DB. Postgres cannot join across databases,
 * so the department filter is resolved to a user_id list here and pushed down into SQL,
 * and profile enrichment is a second query merged in JS — the pattern already used by
 * controllers/userAnalyticsController.js.
 *
 * All Auth_DB access is READ-ONLY.
 */
const SERVICE_LABELS = {
    gemini: 'Gemini',
    claude: 'Claude',
    document_ai: 'Document AI',
    india_kanoon: 'India Kanoon',
    serper: 'Serper',
    openai: 'OpenAI',
};

const KNOWN_SERVICES = ['gemini', 'claude', 'document_ai', 'india_kanoon'];

const DEPARTMENT_TTL_MS = 60 * 1000;
// Generous enough for the "All time" preset (which starts at 2024-01-01) while still
// rejecting absurd input. occurred_at is indexed and volume is low, so a wide range is cheap.
const MAX_RANGE_DAYS = 3700;

/** Fault isolation: one failing section degrades a card instead of 500-ing the tab. */
async function safeSection(label, fn, errors) {
    try {
        return await fn();
    } catch (err) {
        console.error(`[citationAnalytics] section "${label}" failed:`, err.message);
        if (errors) errors.push({ section: label, message: err.message });
        return null;
    }
}

const titleCase = (s) =>
    String(s || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

class AnalyticsService {
    constructor(repo, docPool = null, authPool = null) {
        this.repo = repo;
        this.docPool = docPool;
        this.authPool = authPool;
        this._deptCache = null; // { at:number, byUser:Map, firms:[] }
    }

    // ---------------------------------------------------------------- date range

    /** Today in IST. 'en-CA' formats as YYYY-MM-DD, avoiding UTC server drift. */
    static istToday() {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    }

    static istDaysAgo(n) {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
            new Date(Date.now() - n * 86400000)
        );
    }

    _resolveRange(from, to) {
        const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
        const today = AnalyticsService.istToday();

        const resolvedTo = to && DATE_RE.test(to) ? to : today;
        const resolvedFrom = from && DATE_RE.test(from) ? from : AnalyticsService.istDaysAgo(29);

        if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
            const err = new Error('from/to must be YYYY-MM-DD dates');
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            throw err;
        }
        if (resolvedFrom > resolvedTo) {
            const err = new Error('`from` must not be after `to`');
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            throw err;
        }
        const spanDays = Math.round(
            (Date.parse(`${resolvedTo}T00:00:00Z`) - Date.parse(`${resolvedFrom}T00:00:00Z`)) / 86400000
        );
        if (spanDays > MAX_RANGE_DAYS) {
            const err = new Error(`Date range must not exceed ${MAX_RANGE_DAYS} days`);
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            throw err;
        }
        return { from: resolvedFrom, to: resolvedTo };
    }

    // ---------------------------------------------------------------- departments

    /**
     * Auth_DB firm membership, cached briefly (the tab polls).
     * DISTINCT ON keeps the department stable when a user belongs to two firms —
     * firm_users has no uniqueness constraint, so without it the value would flicker.
     */
    async _loadDepartmentMap() {
        const now = Date.now();
        if (this._deptCache && now - this._deptCache.at < DEPARTMENT_TTL_MS) {
            return this._deptCache;
        }
        if (!this.authPool) return { at: now, byUser: new Map(), firms: [] };

        const members = await this.authPool.query(`
      SELECT DISTINCT ON (fu.user_id)
             fu.user_id::text AS user_id,
             f.id::text       AS department_id,
             f.firm_name      AS department
        FROM firm_users fu
        JOIN firms f ON f.id = fu.firm_id
       WHERE fu.user_id IS NOT NULL
       ORDER BY fu.user_id, fu.firm_id ASC
    `);

        const firms = await this.authPool.query(`
      SELECT f.id::text AS id,
             f.firm_name AS name,
             COUNT(DISTINCT fu.user_id)::int AS user_count
        FROM firms f
        LEFT JOIN firm_users fu ON fu.firm_id = f.id
       WHERE COALESCE(NULLIF(TRIM(f.firm_name), ''), '') <> ''
       GROUP BY f.id, f.firm_name
       ORDER BY f.firm_name ASC
    `);

        const byUser = new Map();
        for (const r of members.rows) {
            byUser.set(String(r.user_id), { id: r.department_id, name: r.department });
        }

        this._deptCache = { at: now, byUser, firms: firms.rows };
        return this._deptCache;
    }

    /**
     * Turn a `department` query param into a SQL-pushdown filter.
     *
     * 'unassigned' EXCLUDES every firm member rather than including the known firmless
     * users. That is deliberate: only exclusion also captures 'anonymous' and any user_id
     * absent from Auth_DB. With an inclusion list those rows vanish and the per-department
     * totals stop summing to the "All Departments" total.
     */
    async _resolveDepartment(department) {
        const dept = department == null || department === '' ? 'all' : String(department);
        if (dept === 'all') {
            return { userIds: null, excludeUserIds: null, label: 'All Departments', id: 'all' };
        }

        const map = await this._loadDepartmentMap();

        if (dept === 'unassigned') {
            return {
                userIds: null,
                excludeUserIds: Array.from(map.byUser.keys()),
                label: 'Unassigned',
                id: 'unassigned',
            };
        }

        const firm = map.firms.find((f) => String(f.id) === dept);
        if (!firm) {
            const err = new Error(`Unknown department: ${dept}`);
            err.statusCode = 400;
            err.code = 'VALIDATION_ERROR';
            throw err;
        }

        const userIds = [];
        for (const [userId, d] of map.byUser.entries()) {
            if (String(d.id) === dept) userIds.push(userId);
        }
        return { userIds, excludeUserIds: null, label: firm.name, id: dept };
    }

    async getDepartments() {
        const map = await this._loadDepartmentMap();
        return {
            departments: [
                { id: 'all', name: 'All Departments' },
                ...map.firms.map((f) => ({ id: f.id, name: f.name, user_count: f.user_count })),
                { id: 'unassigned', name: 'Unassigned' },
            ],
        };
    }

    // ---------------------------------------------------------------- user profiles

    async _getProfilesFromPool(pool, userIds) {
        if (!pool || !userIds?.length) return {};
        const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
        const query = `
      SELECT
        id::text AS id,
        COALESCE(NULLIF(username, ''), NULLIF(email, ''), id::text) AS user_name,
        email
      FROM users
      WHERE id::text IN (${placeholders})
    `;
        const result = await pool.query(query, userIds);
        const map = {};
        for (const row of result.rows) {
            map[String(row.id)] = {
                user_name: row.user_name || String(row.id),
                email: row.email || null,
            };
        }
        return map;
    }

    /** docDB first (as before), Auth_DB for anything still missing. */
    async _loadUserProfiles(userIds, errors) {
        const ids = Array.from(new Set((userIds || []).filter(Boolean).map(String)));
        if (!ids.length) return {};

        const merged = {};
        await safeSection(
            'profiles_doc_db',
            async () => Object.assign(merged, await this._getProfilesFromPool(this.docPool, ids)),
            null // docDB has no `users` in some deployments; Auth_DB below is the real source
        );
        await safeSection(
            'profiles_auth_db',
            async () => {
                const missing = ids.filter((id) => !merged[id]);
                if (missing.length) {
                    Object.assign(merged, await this._getProfilesFromPool(this.authPool, missing));
                }
            },
            errors
        );
        return merged;
    }

    // ---------------------------------------------------------------- main payload

    async getAnalytics({ from, to, department, page = 1, pageSize = 4 } = {}) {
        const range = this._resolveRange(from, to);
        const dept = await this._resolveDepartment(department);
        const filters = {
            ...range,
            userIds: dept.userIds,
            excludeUserIds: dept.excludeUserIds,
        };
        const offset = (page - 1) * pageSize;
        const errors = [];

        // A department with zero members can short-circuit without touching the cost DB.
        const emptyScope = Array.isArray(dept.userIds) && dept.userIds.length === 0;

        const [byService, platformTotal, byUser, userTotal] = emptyScope
            ? [[], null, [], 0]
            : await Promise.all([
                  safeSection('score_cards', () => this.repo.getUsageByService(filters), errors),
                  safeSection('totals', () => this.repo.getTotalPlatformCost(filters), errors),
                  safeSection(
                      'user_breakdown',
                      () => this.repo.getUsageByUser(filters, { limit: pageSize, offset }),
                      errors
                  ),
                  safeSection('user_count', () => this.repo.getUsageByUserCount(filters), errors),
              ]);

        const services = byService || [];
        const users = byUser || [];
        const totalUsers = userTotal || 0;

        // Score cards: the four known buckets always render (zeroed when absent), then any
        // extra service the producer emitted, ordered by cost.
        const byServiceMap = Object.fromEntries(
            services.map((r) => [String(r.service || '').toLowerCase(), r])
        );
        const scoreCards = KNOWN_SERVICES.map((s) => {
            const row = byServiceMap[s];
            return {
                service: s,
                label: SERVICE_LABELS[s] || titleCase(s),
                total_quantity: Number(row?.total_quantity ?? 0),
                total_calls: Number(row?.total_calls ?? 0),
                unit_summary: row?.unit_summary || null,
                total_cost_inr: Number(row?.total_cost_inr ?? 0),
                total_cost_usd: Number(row?.total_cost_usd ?? 0),
                record_count: Number(row?.record_count ?? 0),
                last_used_at: row?.last_used_at || null,
            };
        });
        for (const r of services) {
            const key = String(r.service || '').toLowerCase();
            if (KNOWN_SERVICES.includes(key)) continue;
            scoreCards.push({
                service: key,
                label: SERVICE_LABELS[key] || titleCase(key),
                total_quantity: Number(r.total_quantity ?? 0),
                total_calls: Number(r.total_calls ?? 0),
                unit_summary: r.unit_summary || null,
                total_cost_inr: Number(r.total_cost_inr ?? 0),
                total_cost_usd: Number(r.total_cost_usd ?? 0),
                record_count: Number(r.record_count ?? 0),
                last_used_at: r.last_used_at || null,
            });
        }

        const sumBy = (key) =>
            scoreCards
                .filter((c) => KNOWN_SERVICES.includes(c.service))
                .reduce((acc, c) => acc + (Number(c[key]) || 0), 0);

        const deptMap = await safeSection(
            'departments',
            () => this._loadDepartmentMap(),
            errors
        );
        const profileMap = await this._loadUserProfiles(
            users.map((u) => String(u.user_id)),
            errors
        );

        const totalPlatformInr = Number(platformTotal?.total_cost_inr ?? 0);
        const totalPlatformUsd = Number(platformTotal?.total_cost_usd ?? 0);

        return {
            score_cards: scoreCards,

            total_platform_cost_inr: totalPlatformInr,
            total_platform_cost_usd: totalPlatformUsd,
            total_platform_quantity: Number(platformTotal?.total_quantity ?? 0),
            total_platform_calls: Number(platformTotal?.total_calls ?? 0),

            // Retained as aliases so the frontend's `?? total_platform_*` fallback is never undefined.
            total_known_cost_inr: sumBy('total_cost_inr'),
            total_known_cost_usd: sumBy('total_cost_usd'),
            total_known_quantity: sumBy('total_quantity'),

            total_records: Number(platformTotal?.total_records ?? 0),
            failed_records: Number(platformTotal?.failed_records ?? 0),
            unpriced_records: Number(platformTotal?.unpriced_records ?? 0),
            distinct_users: Number(platformTotal?.distinct_users ?? 0),
            distinct_sessions: Number(platformTotal?.distinct_sessions ?? 0),

            user_breakdown: users.map((u) => {
                const id = String(u.user_id);
                const d = deptMap?.byUser?.get(id);
                return {
                    user_id: id,
                    user_name:
                        id === 'unknown'
                            ? 'Unknown / anonymous'
                            : profileMap[id]?.user_name || id,
                    email: profileMap[id]?.email || null,
                    department: d?.name || 'Unassigned',
                    department_id: d?.id || null,
                    services_used: Array.isArray(u.services_used) ? u.services_used : [],
                    total_quantity: Number(u.total_quantity ?? 0),
                    total_calls: Number(u.total_calls ?? 0),
                    unit_summary: u.unit_summary || null,
                    total_cost_inr: Number(u.total_cost_inr ?? 0),
                    total_cost_usd: Number(u.total_cost_usd ?? 0),
                    record_count: Number(u.record_count ?? 0),
                    last_used_at: u.last_used_at || null,
                };
            }),

            pagination: {
                page,
                pageSize,
                total: totalUsers,
                totalPages: totalUsers ? Math.ceil(totalUsers / pageSize) : 1,
            },
            filters: {
                from: range.from,
                to: range.to,
                department: dept.id,
                department_label: dept.label,
            },
            section_errors: errors,
            synced_at: new Date().toISOString(),
        };
    }

    async getUserDetails(userId, { from, to } = {}) {
        const range = this._resolveRange(from, to);
        const filters = { ...range, userIds: null, excludeUserIds: null };

        const [totals, byService, timeline] = await Promise.all([
            this.repo.getUserTotals(userId, filters),
            this.repo.getUserServiceBreakdown(userId, filters),
            this.repo.getUserTimeline(userId, filters, 200),
        ]);

        const id = String(userId);
        const profileMap = await this._loadUserProfiles([id], null);
        const deptMap = await safeSection('departments', () => this._loadDepartmentMap(), null);
        const d = deptMap?.byUser?.get(id);

        return {
            user_id: id,
            user_name: id === 'unknown' ? 'Unknown / anonymous' : profileMap[id]?.user_name || id,
            email: profileMap[id]?.email || null,
            department: d?.name || 'Unassigned',
            totals: {
                total_quantity: Number(totals?.total_quantity ?? 0),
                total_calls: Number(totals?.total_calls ?? 0),
                total_cost_inr: Number(totals?.total_cost_inr ?? 0),
                total_cost_usd: Number(totals?.total_cost_usd ?? 0),
                record_count: Number(totals?.record_count ?? 0),
                last_used_at: totals?.last_used_at || null,
            },
            service_breakdown: (byService || []).map((s) => ({
                service: s.service,
                total_quantity: Number(s.total_quantity ?? 0),
                total_calls: Number(s.total_calls ?? 0),
                unit_summary: s.unit_summary || null,
                total_cost_inr: Number(s.total_cost_inr ?? 0),
                total_cost_usd: Number(s.total_cost_usd ?? 0),
                record_count: Number(s.record_count ?? 0),
                last_used_at: s.last_used_at || null,
            })),
            timeline: timeline || [],
            filters: { from: range.from, to: range.to },
            synced_at: new Date().toISOString(),
        };
    }

    // ---------------------------------------------------------------- sessions

    /** Paginated session rows for the "Session Cost Breakdown" table. */
    async getSessions({ from, to, department, page = 1, pageSize = 10 } = {}) {
        const range = this._resolveRange(from, to);
        const dept = await this._resolveDepartment(department);
        const filters = { ...range, userIds: dept.userIds, excludeUserIds: dept.excludeUserIds };
        const offset = (page - 1) * pageSize;
        const errors = [];

        const emptyScope = Array.isArray(dept.userIds) && dept.userIds.length === 0;

        const [rows, total] = emptyScope
            ? [[], 0]
            : await Promise.all([
                  safeSection(
                      'sessions',
                      () => this.repo.getSessions(filters, { limit: pageSize, offset }),
                      errors
                  ),
                  safeSection('sessions_count', () => this.repo.getSessionsCount(filters), errors),
              ]);

        const list = rows || [];
        const profileMap = await this._loadUserProfiles(
            list.map((s) => String(s.user_id)),
            errors
        );

        return {
            sessions: list.map((s) => {
                const uid = String(s.user_id ?? 'unknown');
                return {
                    session_id: s.session_id,
                    run_id: s.run_id || null,
                    user_id: uid,
                    user_name:
                        uid === 'unknown' ? 'Unknown / anonymous' : profileMap[uid]?.user_name || uid,
                    email: profileMap[uid]?.email || null,
                    case_id: s.case_id || null,
                    event_count: Number(s.event_count ?? 0),
                    total_calls: Number(s.total_calls ?? 0),
                    input_tokens: Number(s.input_tokens ?? 0),
                    output_tokens: Number(s.output_tokens ?? 0),
                    cache_hits: Number(s.cache_hits ?? 0),
                    unpriced_count: Number(s.unpriced_count ?? 0),
                    ai_cost_inr: Number(s.ai_cost_inr ?? 0),
                    api_cost_inr: Number(s.api_cost_inr ?? 0),
                    total_cost_inr: Number(s.total_cost_inr ?? 0),
                    total_cost_usd: Number(s.total_cost_usd ?? 0),
                    services_used: Array.isArray(s.services_used) ? s.services_used : [],
                    started_at: s.started_at || null,
                    last_event_at: s.last_event_at || null,
                };
            }),
            pagination: {
                page,
                pageSize,
                total: total || 0,
                totalPages: total ? Math.ceil(total / pageSize) : 1,
            },
            filters: {
                from: range.from,
                to: range.to,
                department: dept.id,
                department_label: dept.label,
            },
            section_errors: errors,
            synced_at: new Date().toISOString(),
        };
    }

    /**
     * Full cost breakdown for one session — the UI equivalent of the engine's
     * "COMPLETE COST — END-TO-END session" terminal block.
     *
     * Not date-filtered: a session is billed as a whole regardless of the dashboard range.
     */
    async getSessionDetails(sessionId, runId) {
        const [totals, llm, api, timeline] = await Promise.all([
            this.repo.getSessionTotals(sessionId, runId),
            this.repo.getSessionLlmBreakdown(sessionId, runId),
            this.repo.getSessionApiBreakdown(sessionId, runId),
            this.repo.getSessionTimeline(sessionId, runId, 300),
        ]);

        if (!totals) {
            const err = new Error(`Session ${sessionId} has no recorded usage`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }

        const uid = String(totals.user_id ?? 'unknown');
        const profileMap = await this._loadUserProfiles([uid], null);
        const deptMap = await safeSection('departments', () => this._loadDepartmentMap(), null);

        const num = (v) => Number(v ?? 0);

        return {
            session_id: String(sessionId),
            run_id: totals.run_id || null,
            user_id: uid,
            user_name: uid === 'unknown' ? 'Unknown / anonymous' : profileMap[uid]?.user_name || uid,
            email: profileMap[uid]?.email || null,
            department: deptMap?.byUser?.get(uid)?.name || 'Unassigned',
            case_id: totals.case_id || null,

            totals: {
                event_count: num(totals.event_count),
                total_calls: num(totals.total_calls),
                input_tokens: num(totals.input_tokens),
                output_tokens: num(totals.output_tokens),
                cached_tokens: num(totals.cached_tokens),
                cache_hits: num(totals.cache_hits),
                failed_count: num(totals.failed_count),
                unpriced_count: num(totals.unpriced_count),
                producer_priced_count: num(totals.producer_priced_count),
                ai_cost_inr: num(totals.ai_cost_inr),
                api_cost_inr: num(totals.api_cost_inr),
                total_cost_inr: num(totals.total_cost_inr),
                total_cost_usd: num(totals.total_cost_usd),
                // What the engine itself reported, for drift comparison.
                producer_cost_inr: num(totals.producer_cost_inr),
                started_at: totals.started_at || null,
                last_event_at: totals.last_event_at || null,
            },

            // "Task / agent | Model | Calls | Tokens in | Tokens out | Cost INR"
            llm_breakdown: (llm || []).map((r) => ({
                operation: r.operation,
                stage: r.stage || null,
                model: r.model || null,
                provider: r.provider,
                service: r.service,
                calls: num(r.calls),
                input_tokens: num(r.input_tokens),
                output_tokens: num(r.output_tokens),
                cached_tokens: num(r.cached_tokens),
                cost_inr: num(r.cost_inr),
                cost_usd: num(r.cost_usd),
                producer_cost_inr: num(r.producer_cost_inr),
                rate_version: r.rate_version || null,
                cost_source: r.cost_source || null,
            })),

            // "Indian Kanoon | Calls | Rate | Cost INR"
            api_breakdown: (api || []).map((r) => ({
                provider: r.provider,
                service: r.service,
                operation: r.operation,
                unit: r.unit,
                calls: num(r.calls),
                quantity: num(r.quantity),
                cache_hits: num(r.cache_hits),
                unit_rate_inr: num(r.unit_rate_inr),
                cost_inr: num(r.cost_inr),
                cost_usd: num(r.cost_usd),
                rate_version: r.rate_version || null,
                cost_source: r.cost_source || null,
            })),

            timeline: timeline || [],
            synced_at: new Date().toISOString(),
        };
    }

    // ---------------------------------------------------------------- CSV export

    /**
     * Returns a pager the controller drives, so no full result set is materialised.
     * Deliberately bypasses parsePagination's 100-row cap — an export is not a page.
     */
    async getExportPager({ from, to, department, scope = 'users' } = {}) {
        const range = this._resolveRange(from, to);
        const dept = await this._resolveDepartment(department);
        const filters = { ...range, userIds: dept.userIds, excludeUserIds: dept.excludeUserIds };

        const BATCH = 1000;
        const MAX_EXPORT_ROWS = 100000;
        let offset = 0;
        let emitted = 0;
        let truncated = false;

        const deptMap = await safeSection('departments', () => this._loadDepartmentMap(), null);

        const stamp = `${range.from}_to_${range.to}`;
        const fmt = (v) => (v == null ? '' : v);

        if (scope === 'events') {
            return {
                filename: `citation-cost-events-${stamp}.csv`,
                columns: [
                    { key: 'occurred_at', header: 'Occurred At (IST)', get: (r) => this._ist(r.occurred_at) },
                    { key: 'session_id', header: 'Session ID' },
                    { key: 'run_id', header: 'Run ID' },
                    { key: 'user_id', header: 'User ID' },
                    { key: 'doc_id', header: 'Doc ID' },
                    { key: 'provider', header: 'Provider' },
                    { key: 'service', header: 'Service' },
                    { key: 'operation', header: 'Operation' },
                    { key: 'stage', header: 'Stage' },
                    { key: 'model', header: 'Model' },
                    { key: 'unit', header: 'Unit' },
                    { key: 'quantity', header: 'Quantity' },
                    { key: 'calls', header: 'Calls' },
                    { key: 'input_tokens', header: 'Input Tokens' },
                    { key: 'output_tokens', header: 'Output Tokens' },
                    { key: 'cached_tokens', header: 'Cached Tokens' },
                    { key: 'cache_hit', header: 'Cache Hit' },
                    { key: 'cost_inr', header: 'Cost (INR)' },
                    { key: 'cost_usd', header: 'Cost (USD)' },
                    { key: 'cost_source', header: 'Cost Source' },
                    { key: 'rate_version', header: 'Rate Version' },
                    { key: 'success', header: 'Success' },
                    { key: 'error_code', header: 'Error Code' },
                    { key: 'usage_time_ms', header: 'Latency (ms)' },
                ],
                next: async () => {
                    if (truncated || emitted >= MAX_EXPORT_ROWS) return null;
                    const rows = await this.repo.getExportEventsPage(filters, {
                        limit: BATCH,
                        offset,
                    });
                    if (!rows.length) return null;
                    offset += rows.length;
                    emitted += rows.length;
                    if (emitted >= MAX_EXPORT_ROWS) truncated = true;
                    return rows;
                },
                wasTruncated: () => truncated,
            };
        }

        return {
            filename: `citation-cost-users-${stamp}.csv`,
            columns: [
                { key: 'user_id', header: 'User ID' },
                { key: 'user_name', header: 'User Name' },
                { key: 'email', header: 'Email' },
                { key: 'department', header: 'Department' },
                { key: 'services_used', header: 'Services Used' },
                { key: 'total_calls', header: 'Total Requests' },
                { key: 'total_quantity', header: 'Total Quantity' },
                { key: 'unit_summary', header: 'Unit' },
                { key: 'total_cost_inr', header: 'Cost (INR)' },
                { key: 'total_cost_usd', header: 'Cost (USD)' },
                { key: 'record_count', header: 'Records' },
                { key: 'last_used_at', header: 'Last Used (IST)', get: (r) => this._ist(r.last_used_at) },
            ],
            next: async () => {
                if (truncated || emitted >= MAX_EXPORT_ROWS) return null;
                const rows = await this.repo.getExportUsersPage(filters, { limit: BATCH, offset });
                if (!rows.length) return null;
                offset += rows.length;
                emitted += rows.length;
                if (emitted >= MAX_EXPORT_ROWS) truncated = true;

                const ids = rows.map((r) => String(r.user_id));
                const profiles = await this._loadUserProfiles(ids, null);
                return rows.map((r) => {
                    const id = String(r.user_id);
                    const d = deptMap?.byUser?.get(id);
                    return {
                        ...r,
                        user_id: id,
                        user_name:
                            id === 'unknown' ? 'Unknown / anonymous' : profiles[id]?.user_name || id,
                        email: fmt(profiles[id]?.email),
                        department: d?.name || 'Unassigned',
                    };
                });
            },
            wasTruncated: () => truncated,
        };
    }

    _ist(value) {
        if (!value) return '';
        return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    }

    async getHeartbeat() {
        const hb = await this.repo.heartbeat();
        return {
            ok: true,
            source: 'citationTest.citation_usage_events',
            last_event_at: hb.last_event_at || null,
            last_ingest_at: hb.last_ingest_at || null,
            ingested_last_hour: Number(hb.ingested_last_hour ?? 0),
            total_events: Number(hb.total_events ?? 0),
            timestamp: new Date().toISOString(),
        };
    }
}

module.exports = AnalyticsService;
