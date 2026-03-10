const logger = require('../../config/logger');

class PipelineService {
    constructor(pipelineRepo) {
        this.repo = pipelineRepo;
    }

    async getSummary(requestId) {
        logger.debug('PipelineService.getSummary called', { requestId, layer: 'PIPELINE_SERVICE' });
        const rows = await this.repo.getSummary(requestId);
        const summary = {};
        for (const row of rows) {
            summary[row.status] = row.count;
        }
        logger.info('PipelineService.getSummary completed', { requestId, layer: 'PIPELINE_SERVICE' });
        return summary;
    }

    async listItems(filters, requestId) {
        logger.debug('PipelineService.listItems called', { requestId, layer: 'PIPELINE_SERVICE' });
        const result = await this.repo.listItems(filters, requestId);
        logger.info('PipelineService.listItems completed', { requestId, layer: 'PIPELINE_SERVICE' });
        return result;
    }

    async getRecentErrors(limit, requestId) {
        logger.debug('PipelineService.getRecentErrors called', { requestId, layer: 'PIPELINE_SERVICE' });
        const errors = await this.repo.getRecentErrors(limit, requestId);
        logger.info('PipelineService.getRecentErrors completed', { requestId, layer: 'PIPELINE_SERVICE' });
        return errors;
    }
}

module.exports = PipelineService;
