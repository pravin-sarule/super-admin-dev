const logger = require('../../config/logger');
const { startOfTodayIST } = require('../../utils/time');

class OverviewService {
    constructor(overviewRepo) {
        this.repo = overviewRepo;
    }

    async getOverview(requestId) {
        logger.debug('OverviewService.getOverview called', { requestId, layer: 'OVERVIEW_SERVICE' });

        const todayStart = startOfTodayIST();
        const [stats, ingestionCounts, confidenceDist] = await Promise.all([
            this.repo.getOverviewStats(todayStart, requestId),
            this.repo.getIngestionStatusCounts(requestId),
            this.repo.getConfidenceDistribution(requestId),
        ]);

        const ingestion_status_counts = {};
        for (const row of ingestionCounts) {
            ingestion_status_counts[row.status] = row.count;
        }

        const result = {
            total_judgments: parseInt(stats.total_judgments, 10) || 0,
            verified_judgments_count: parseInt(stats.verified_judgments_count, 10) || 0,
            unverified_judgments_count: parseInt(stats.unverified_judgments_count, 10) || 0,
            avg_confidence_score: stats.avg_confidence_score ? parseFloat(stats.avg_confidence_score) : null,
            hitl_pending_count: parseInt(stats.hitl_pending_count, 10) || 0,
            blacklist_count: parseInt(stats.blacklist_count, 10) || 0,
            today_citations_added: parseInt(stats.today_citations_added, 10) || 0,
            ingestion_status_counts,
            confidence_distribution: {
                '0-0.4': confidenceDist['0-0.4'] || 0,
                '0.4-0.7': confidenceDist['0.4-0.7'] || 0,
                '0.7-0.9': confidenceDist['0.7-0.9'] || 0,
                '0.9-1.0': confidenceDist['0.9-1.0'] || 0,
            },
        };

        logger.info('OverviewService.getOverview completed', { requestId, layer: 'OVERVIEW_SERVICE' });
        return result;
    }
}

module.exports = OverviewService;
