const logger = require('../../config/logger');

class RoutesdbService {
    constructor(routesdbRepo) {
        this.repo = routesdbRepo;
    }

    async getSummary(requestId) {
        logger.debug('RoutesdbService.getSummary called', { requestId, layer: 'ROUTESDB_SERVICE' });

        const [summary, verificationBreakdown] = await Promise.all([
            this.repo.getSummary(requestId),
            this.repo.getVerificationBreakdown(requestId),
        ]);

        const result = {
            ...summary,
            verification_status_breakdown: verificationBreakdown,
        };

        logger.info('RoutesdbService.getSummary completed', { requestId, layer: 'ROUTESDB_SERVICE' });
        return result;
    }

    async getTopCited(limit, requestId) {
        logger.debug('RoutesdbService.getTopCited called', { requestId, layer: 'ROUTESDB_SERVICE' });
        const rows = await this.repo.getTopCited(limit, requestId);
        logger.info('RoutesdbService.getTopCited completed', { requestId, layer: 'ROUTESDB_SERVICE' });
        return rows;
    }

    async getCourtsBreakdown(requestId) {
        logger.debug('RoutesdbService.getCourtsBreakdown called', { requestId, layer: 'ROUTESDB_SERVICE' });
        const rows = await this.repo.getCourtsBreakdown(requestId);
        logger.info('RoutesdbService.getCourtsBreakdown completed', { requestId, layer: 'ROUTESDB_SERVICE' });
        return rows;
    }
}

module.exports = RoutesdbService;
