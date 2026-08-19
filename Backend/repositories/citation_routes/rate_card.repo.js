/**
 * Repo for citation_rate_card (citationTest / CITATION_ANALYTICS_DB_URL).
 *
 * Rows are versioned, never edited in place: an "update" closes the current row
 * (effective_to = NOW(), is_active = false) and inserts a successor. That preserves the
 * audit trail and is why historical events keep the cost they were priced at.
 */
const COLUMNS = `
  id, version, provider, service, model, operation, tier, display_name, unit, currency,
  inr_per_usd, input_rate_per_million, output_rate_per_million,
  cached_input_rate_per_million, cache_storage_rate_per_million_hour, flat_rate_per_unit,
  effective_from, effective_to, is_active, notes, updated_by, created_at, updated_at
`;

/** Writable fields, in the order used by INSERT. */
const WRITABLE = [
    'version',
    'provider',
    'service',
    'model',
    'operation',
    'tier',
    'display_name',
    'unit',
    'currency',
    'inr_per_usd',
    'input_rate_per_million',
    'output_rate_per_million',
    'cached_input_rate_per_million',
    'cache_storage_rate_per_million_hour',
    'flat_rate_per_unit',
    'is_active',
    'notes',
    'updated_by',
];

class RateCardRepo {
    constructor(pool) {
        this.pool = pool;
    }

    async list({ includeInactive = false } = {}) {
        const query = `
      SELECT ${COLUMNS}
      FROM citation_rate_card
      ${includeInactive ? '' : 'WHERE is_active'}
      ORDER BY provider ASC,
               COALESCE(model, operation, '') ASC,
               tier ASC,
               effective_from DESC
    `;
        const result = await this.pool.query(query);
        return result.rows;
    }

    async getById(id) {
        const result = await this.pool.query(
            `SELECT ${COLUMNS} FROM citation_rate_card WHERE id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }

    async create(payload) {
        const values = WRITABLE.map((k) => payload[k]);
        const placeholders = WRITABLE.map((_, i) => `$${i + 1}`).join(', ');
        const result = await this.pool.query(
            `INSERT INTO citation_rate_card (${WRITABLE.join(', ')})
       VALUES (${placeholders})
       RETURNING ${COLUMNS}`,
            values
        );
        return result.rows[0];
    }

    /**
     * Close the existing row and insert its successor, atomically.
     * Uses a single pooled client so BEGIN/COMMIT actually wrap both statements.
     */
    async supersede(id, payload) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            const current = await client.query(
                `SELECT ${COLUMNS} FROM citation_rate_card WHERE id = $1 FOR UPDATE`,
                [id]
            );
            if (!current.rows.length) {
                await client.query('ROLLBACK');
                return null;
            }

            await client.query(
                `UPDATE citation_rate_card
            SET effective_to = NOW(), is_active = FALSE, updated_at = NOW()
          WHERE id = $1`,
                [id]
            );

            const merged = { ...current.rows[0], ...payload };
            const values = WRITABLE.map((k) => merged[k]);
            const placeholders = WRITABLE.map((_, i) => `$${i + 1}`).join(', ');
            const inserted = await client.query(
                `INSERT INTO citation_rate_card (${WRITABLE.join(', ')}, effective_from)
         VALUES (${placeholders}, NOW())
         RETURNING ${COLUMNS}`,
                values
            );

            await client.query('COMMIT');
            return inserted.rows[0];
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    }

    async deactivate(id, updatedBy) {
        const result = await this.pool.query(
            `UPDATE citation_rate_card
          SET is_active = FALSE, effective_to = COALESCE(effective_to, NOW()),
              updated_by = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING ${COLUMNS}`,
            [id, updatedBy || null]
        );
        return result.rows[0] || null;
    }

    /** Mirrors the SQL citation_rate_lookup() used by the pricing trigger. */
    async resolveRate({ provider, model, operation, at }) {
        const result = await this.pool.query(
            `SELECT ${COLUMNS} FROM citation_rate_lookup($1, $2, $3, $4)`,
            [provider, model || null, operation || null, at || new Date().toISOString()]
        );
        return result.rows[0]?.id ? result.rows[0] : null;
    }

    /** Distinct models/operations seen in events but with no active rate card row. */
    async findUnpricedTargets() {
        const result = await this.pool.query(`
      SELECT provider, service, model, operation,
             COUNT(*)::int AS event_count,
             MAX(occurred_at) AS last_seen
        FROM citation_usage_events
       WHERE cost_source = 'unpriced'
       GROUP BY provider, service, model, operation
       ORDER BY event_count DESC
       LIMIT 50
    `);
        return result.rows;
    }
}

module.exports = RateCardRepo;
