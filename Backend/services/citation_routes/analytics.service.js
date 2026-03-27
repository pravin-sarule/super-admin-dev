/**
 * Service for citation_service_usage analytics.
 */
class AnalyticsService {
  constructor(repo, docPool = null, authPool = null) {
    this.repo = repo;
    this.docPool = docPool;
    this.authPool = authPool;
  }

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

  async _loadUserProfiles(userIds) {
    const ids = Array.from(new Set((userIds || []).filter(Boolean).map(String)));
    if (!ids.length) return {};

    const merged = {};
    // Prefer doc DB first if available (as requested), fallback to auth DB.
    try {
      const docProfiles = await this._getProfilesFromPool(this.docPool, ids);
      Object.assign(merged, docProfiles);
    } catch (_err) {
      // swallow: fallback below
    }
    try {
      const missing = ids.filter((id) => !merged[id]);
      if (missing.length) {
        const authProfiles = await this._getProfilesFromPool(this.authPool, missing);
        Object.assign(merged, authProfiles);
      }
    } catch (_err) {
      // swallow: unresolved users fallback to user_id
    }
    return merged;
  }

  async getAnalytics(requestId) {
    const [byService, byUser, platformTotal, records, totalRecords] = await Promise.all([
      this.repo.getUsageByService(),
      this.repo.getUsageByUser(100),
      this.repo.getTotalPlatformCost(),
      this.repo.getUsageRecords(200, 0),
      this.repo.getUsageRecordsCount(),
    ]);

    // Build scorecard for known services (Gemini, Claude, Document AI, India Kanoon)
    const knownServices = ['gemini', 'claude', 'document_ai', 'india_kanoon'];
    const SERVICE_LABELS = {
      gemini: 'Gemini',
      claude: 'Claude',
      document_ai: 'Document AI',
      india_kanoon: 'India Kanoon',
    };
    const byServiceMap = Object.fromEntries(
      byService.map((r) => [String(r.service || '').toLowerCase(), r])
    );

    const mergeIndiaKanoon = (canonicalKey) => {
      if (canonicalKey !== 'india_kanoon') return null;
      const alt = byServiceMap.indian_kanoon;
      if (!alt) return null;
      return {
        total_quantity: Number(alt.total_quantity ?? 0),
        total_cost_inr: Number(alt.total_cost_inr ?? 0),
        total_cost_usd: Number(alt.total_cost_usd ?? 0),
        unit_summary: alt.unit_summary || null,
      };
    };

    const scoreCards = knownServices.map((s) => {
      const primary = byServiceMap[s];
      const merged = mergeIndiaKanoon(s);
      return {
        service: s,
        label: SERVICE_LABELS[s] || s,
        total_quantity:
          Number(primary?.total_quantity ?? 0) + (merged ? merged.total_quantity : 0),
        unit_summary: primary?.unit_summary || merged?.unit_summary || null,
        total_cost_inr: Number(primary?.total_cost_inr ?? 0) + (merged ? merged.total_cost_inr : 0),
        total_cost_usd: Number(primary?.total_cost_usd ?? 0) + (merged ? merged.total_cost_usd : 0),
      };
    });

    // Add any other services not in known list (skip indian_kanoon — merged into india_kanoon)
    byService.forEach((r) => {
      const key = String(r.service || '').toLowerCase();
      if (key === 'indian_kanoon') return;
      if (!knownServices.includes(key)) {
        scoreCards.push({
          service: key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          total_quantity: Number(r.total_quantity ?? 0),
          unit_summary: r.unit_summary || null,
          total_cost_inr: Number(r.total_cost_inr ?? 0),
          total_cost_usd: Number(r.total_cost_usd ?? 0),
        });
      }
    });

    const totalKnownCostInr = scoreCards
      .filter((c) => knownServices.includes(String(c.service)))
      .reduce((sum, c) => sum + (Number(c.total_cost_inr) || 0), 0);
    const totalKnownCostUsd = scoreCards
      .filter((c) => knownServices.includes(String(c.service)))
      .reduce((sum, c) => sum + (Number(c.total_cost_usd) || 0), 0);
    const totalKnownQuantity = scoreCards
      .filter((c) => knownServices.includes(String(c.service)))
      .reduce((sum, c) => sum + (Number(c.total_quantity) || 0), 0);

    const userIds = byUser.map((u) => String(u.user_id));
    const profileMap = await this._loadUserProfiles(userIds);

    return {
      score_cards: scoreCards,
      total_platform_cost_inr: Number(platformTotal?.total_cost_inr ?? 0),
      total_platform_cost_usd: Number(platformTotal?.total_cost_usd ?? 0),
      total_platform_quantity: Number(platformTotal?.total_quantity ?? 0),
      total_known_cost_inr: totalKnownCostInr,
      total_known_cost_usd: totalKnownCostUsd,
      total_known_quantity: totalKnownQuantity,
      total_records: totalRecords ?? 0,
      synced_at: new Date().toISOString(),
      user_breakdown: byUser.map((u) => ({
        user_id: u.user_id,
        user_name:
          profileMap[String(u.user_id)]?.user_name ||
          u.usage_username ||
          String(u.user_id),
        email: profileMap[String(u.user_id)]?.email || null,
        services_used: Array.isArray(u.services_used) ? u.services_used : [],
        total_quantity: Number(u.total_quantity ?? 0),
        unit_summary: u.unit_summary || null,
        total_cost_inr: Number(u.total_cost_inr ?? 0),
        total_cost_usd: Number(u.total_cost_usd ?? 0),
        record_count: Number(u.record_count ?? 0),
        last_used_at: u.last_used_at || null,
      })),
      usage_table: records,
    };
  }

  async getUserDetails(userId, requestId) {
    const [totals, byService, timeline] = await Promise.all([
      this.repo.getUserTotals(userId),
      this.repo.getUserServiceBreakdown(userId),
      this.repo.getUserTimeline(userId, 200),
    ]);

    if (!totals) {
      return {
        user_id: String(userId),
        user_name: String(userId),
        email: null,
        totals: {
          total_quantity: 0,
          total_cost_inr: 0,
          total_cost_usd: 0,
          record_count: 0,
          last_used_at: null,
        },
        service_breakdown: [],
        timeline: [],
      };
    }

    const profileMap = await this._loadUserProfiles([String(userId)]);
    const profile = profileMap[String(userId)] || {};

    return {
      user_id: String(userId),
      user_name: profile.user_name || totals.usage_username || String(userId),
      email: profile.email || null,
      totals: {
        total_quantity: Number(totals.total_quantity ?? 0),
        total_cost_inr: Number(totals.total_cost_inr ?? 0),
        total_cost_usd: Number(totals.total_cost_usd ?? 0),
        record_count: Number(totals.record_count ?? 0),
        last_used_at: totals.last_used_at || null,
      },
      service_breakdown: (byService || []).map((s) => ({
        service: s.service,
        total_quantity: Number(s.total_quantity ?? 0),
        unit_summary: s.unit_summary || null,
        total_cost_inr: Number(s.total_cost_inr ?? 0),
        total_cost_usd: Number(s.total_cost_usd ?? 0),
        record_count: Number(s.record_count ?? 0),
        last_used_at: s.last_used_at || null,
      })),
      timeline: timeline || [],
      synced_at: new Date().toISOString(),
    };
  }

  async getHeartbeat(requestId) {
    await this.repo.heartbeat();
    return { ok: true, timestamp: new Date().toISOString() };
  }
}

module.exports = AnalyticsService;
