/**
 * Service for the Citation Analytics rate card.
 *
 * Rates are entered in the provider's own currency (USD for Gemini/Claude, INR for
 * India Kanoon / Document AI / Serper) plus an inr_per_usd peg. Every response also
 * carries the derived INR figures so the UI can show "you typed $0.30 = ₹25.50".
 *
 * Editing a rate never reprices history: citation_usage_events is append-only and each
 * row keeps the cost it was priced at, tagged with rate_version.
 */
const UNITS = ['tokens', 'calls', 'pages'];
const CURRENCIES = ['USD', 'INR'];
const TIERS = ['intro', 'standard'];

const NUMERIC_FIELDS = [
    'inr_per_usd',
    'input_rate_per_million',
    'output_rate_per_million',
    'cached_input_rate_per_million',
    'cache_storage_rate_per_million_hour',
    'flat_rate_per_unit',
];

function badRequest(message) {
    const err = new Error(message);
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    return err;
}

class RateCardService {
    constructor(repo) {
        this.repo = repo;
    }

    /** Attach derived INR values so the UI never has to redo the currency maths. */
    _decorate(row) {
        if (!row) return row;
        const fx = Number(row.inr_per_usd) || 0;
        const toInr = (v) => {
            const n = Number(v) || 0;
            return row.currency === 'INR' ? n : n * fx;
        };
        return {
            ...row,
            inr_per_usd: fx,
            input_rate_per_million: Number(row.input_rate_per_million) || 0,
            output_rate_per_million: Number(row.output_rate_per_million) || 0,
            cached_input_rate_per_million: Number(row.cached_input_rate_per_million) || 0,
            cache_storage_rate_per_million_hour: Number(row.cache_storage_rate_per_million_hour) || 0,
            flat_rate_per_unit: Number(row.flat_rate_per_unit) || 0,
            derived_inr: {
                input_per_million: toInr(row.input_rate_per_million),
                output_per_million: toInr(row.output_rate_per_million),
                cached_input_per_million: toInr(row.cached_input_rate_per_million),
                flat_per_unit: toInr(row.flat_rate_per_unit),
            },
        };
    }

    _validate(payload, { partial = false } = {}) {
        const out = {};
        const require_ = (k) => {
            if (!partial && (payload[k] === undefined || payload[k] === null || payload[k] === '')) {
                throw badRequest(`${k} is required`);
            }
        };

        ['provider', 'service', 'unit'].forEach(require_);

        for (const k of [
            'version',
            'provider',
            'service',
            'model',
            'operation',
            'tier',
            'display_name',
            'unit',
            'currency',
            'notes',
        ]) {
            if (payload[k] !== undefined) {
                const v = payload[k];
                out[k] = v === null || v === '' ? null : String(v).trim();
            }
        }

        // model/operation are wildcards when blank — NOT empty strings.
        if (out.model === '') out.model = null;
        if (out.operation === '') out.operation = null;

        if (out.unit !== undefined && out.unit !== null && !UNITS.includes(out.unit)) {
            throw badRequest(`unit must be one of: ${UNITS.join(', ')}`);
        }
        if (out.currency !== undefined && out.currency !== null && !CURRENCIES.includes(out.currency)) {
            throw badRequest(`currency must be one of: ${CURRENCIES.join(', ')}`);
        }
        if (out.tier !== undefined && out.tier !== null && !TIERS.includes(out.tier)) {
            throw badRequest(`tier must be one of: ${TIERS.join(', ')}`);
        }

        for (const k of NUMERIC_FIELDS) {
            if (payload[k] === undefined) continue;
            const n = Number(payload[k]);
            if (!Number.isFinite(n) || n < 0) throw badRequest(`${k} must be a non-negative number`);
            out[k] = n;
        }
        if (out.inr_per_usd !== undefined && out.inr_per_usd <= 0) {
            throw badRequest('inr_per_usd must be greater than 0');
        }

        if (payload.is_active !== undefined) out.is_active = Boolean(payload.is_active);

        // Defaults for create
        if (!partial) {
            out.version = out.version || 'v1';
            out.tier = out.tier || 'standard';
            out.currency = out.currency || 'USD';
            out.model = out.model ?? null;
            out.operation = out.operation ?? null;
            out.display_name = out.display_name ?? null;
            out.notes = out.notes ?? null;
            out.is_active = out.is_active ?? true;
            for (const k of NUMERIC_FIELDS) {
                if (out[k] === undefined) out[k] = k === 'inr_per_usd' ? 95.66 : 0;
            }
            if (!out.model && !out.operation) {
                throw badRequest('Specify at least a model or an operation');
            }
        }

        return out;
    }

    async list({ includeInactive = false } = {}) {
        const rows = await this.repo.list({ includeInactive });
        const unpriced = await this.repo.findUnpricedTargets().catch(() => []);
        return {
            rates: rows.map((r) => this._decorate(r)),
            unpriced_targets: unpriced,
            units: UNITS,
            currencies: CURRENCIES,
            tiers: TIERS,
        };
    }

    async create(payload, updatedBy) {
        const clean = this._validate(payload, { partial: false });
        clean.updated_by = updatedBy || null;
        const row = await this.repo.create(clean);
        return this._decorate(row);
    }

    /** Closes the current row and inserts a successor — never an in-place edit. */
    async update(id, payload, updatedBy) {
        const clean = this._validate(payload, { partial: true });
        clean.updated_by = updatedBy || null;
        clean.is_active = clean.is_active ?? true;
        const row = await this.repo.supersede(id, clean);
        if (!row) {
            const err = new Error(`Rate card row ${id} not found`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }
        return this._decorate(row);
    }

    async deactivate(id, updatedBy) {
        const row = await this.repo.deactivate(id, updatedBy);
        if (!row) {
            const err = new Error(`Rate card row ${id} not found`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }
        return this._decorate(row);
    }
}

module.exports = RateCardService;
