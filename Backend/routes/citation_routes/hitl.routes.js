const express = require('express');
const Joi = require('joi');
const validate = require('../../middleware/validate.middleware');

const hitlActionSchema = {
    body: Joi.object({
        action: Joi.string().valid('APPROVED', 'REJECTED', 'ESCALATED').required(),
        reviewer: Joi.string().allow('', null).default('admin'),
        notes: Joi.string().allow('', null).default(''),
        blacklist: Joi.boolean().default(false),
        reason: Joi.string().allow('', null).default(''),
    }),
};

module.exports = (hitlController) => {
    const router = express.Router();

    // GET /api/admin/citation/hitl
    router.get('/', hitlController.listTasks);

    // GET /api/admin/citation/hitl/:taskId
    router.get('/:taskId', hitlController.getTaskDetail);

    // POST /api/admin/citation/hitl/:taskId/action
    router.post('/:taskId/action', validate(hitlActionSchema), hitlController.processAction);

    return router;
};
