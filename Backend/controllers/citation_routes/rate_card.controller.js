const logger = require('../../config/logger');
const { sendSuccess, sendError } = require('../../utils/response');

/**
 * Rate card CRUD — the only write path in the Citation Analytics slice.
 *
 * adminAuthMiddleware admits six roles AND a bare ADMIN_TOKEN (on which it never sets
 * req.user). Reads stay open to all of them; mutations are restricted to super-admin, or
 * to the ADMIN_TOKEN path, which is a server-side secret.
 */
function canMutate(req) {
    // ADMIN_TOKEN path: authenticated, but no req.user is attached.
    if (!req.user) return true;
    return req.user.role === 'super-admin';
}

function actor(req) {
    return req.user?.email || 'admin-token';
}

class RateCardController {
    constructor(rateCardService) {
        this.service = rateCardService;
    }

    _forbid(res, requestId) {
        return sendError(res, {
            code: 'FORBIDDEN',
            message: 'Only super-admins can modify the rate card',
            statusCode: 403,
            requestId,
        });
    }

    list = async (req, res, next) => {
        const requestId = req.requestId;
        try {
            const includeInactive =
                req.query.includeInactive === 'true' || req.query.includeInactive === '1';
            const data = await this.service.list({ includeInactive });
            return sendSuccess(res, data);
        } catch (err) {
            logger.error(`RateCardController.list: ${err.message}`, { requestId, stack: err.stack });
            next(err);
        }
    };

    create = async (req, res, next) => {
        const requestId = req.requestId;
        if (!canMutate(req)) return this._forbid(res, requestId);
        try {
            const data = await this.service.create(req.body || {}, actor(req));
            return sendSuccess(res, data, 201);
        } catch (err) {
            logger.error(`RateCardController.create: ${err.message}`, { requestId, stack: err.stack });
            next(err);
        }
    };

    update = async (req, res, next) => {
        const requestId = req.requestId;
        if (!canMutate(req)) return this._forbid(res, requestId);
        try {
            const data = await this.service.update(req.params.id, req.body || {}, actor(req));
            return sendSuccess(res, data);
        } catch (err) {
            logger.error(`RateCardController.update: ${err.message}`, { requestId, stack: err.stack });
            next(err);
        }
    };

    deactivate = async (req, res, next) => {
        const requestId = req.requestId;
        if (!canMutate(req)) return this._forbid(res, requestId);
        try {
            const data = await this.service.deactivate(req.params.id, actor(req));
            return sendSuccess(res, data);
        } catch (err) {
            logger.error(`RateCardController.deactivate: ${err.message}`, {
                requestId,
                stack: err.stack,
            });
            next(err);
        }
    };
}

module.exports = RateCardController;
