const logger = require('../../config/logger');

class HitlService {
    constructor(hitlRepo) {
        this.repo = hitlRepo;
    }

    async listTasks(filters, requestId) {
        logger.debug('HitlService.listTasks called', { requestId, layer: 'HITL_SERVICE' });
        const result = await this.repo.listTasks(filters, requestId);
        logger.info('HitlService.listTasks completed', { requestId, layer: 'HITL_SERVICE' });
        return result;
    }

    async getTaskDetail(taskId, requestId) {
        logger.debug(`HitlService.getTaskDetail called for ${taskId}`, { requestId, layer: 'HITL_SERVICE' });
        const task = await this.repo.getTaskById(taskId, requestId);
        if (!task) {
            const err = new Error(`HITL task ${taskId} not found`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }
        logger.info('HitlService.getTaskDetail completed', { requestId, layer: 'HITL_SERVICE' });
        return task;
    }

    async processAction(taskId, actionBody, requestId) {
        logger.debug(`HitlService.processAction called for ${taskId}`, { requestId, layer: 'HITL_SERVICE' });

        const { action, reviewer, notes, blacklist, reason } = actionBody;

        // Validate task exists
        const task = await this.repo.getTaskById(taskId, requestId);
        if (!task) {
            const err = new Error(`HITL task ${taskId} not found`);
            err.statusCode = 404;
            err.code = 'NOT_FOUND';
            throw err;
        }

        // Update task status
        const updatedTask = await this.repo.updateTaskStatus(taskId, action, requestId);

        // If blacklist=true on REJECTED, insert into blacklist
        let blacklistEntry = null;
        if (blacklist === true && action === 'REJECTED') {
            blacklistEntry = await this.repo.insertBlacklist({
                citation_string: task.citation_string || '',
                normalized_string: task.canonical_id || task.citation_string || '',
                reason: reason || 'Rejected by reviewer',
                confirmed_by: reviewer || 'admin',
            }, requestId);
        }

        logger.info(`HitlService.processAction completed: ${action}`, { requestId, layer: 'HITL_SERVICE' });

        return {
            task: updatedTask,
            blacklistEntry,
        };
    }
}

module.exports = HitlService;
