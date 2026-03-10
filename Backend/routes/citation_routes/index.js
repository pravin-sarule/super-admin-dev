const express = require('express');
const adminAuthMiddleware = require('../../middleware/adminAuth.middleware');

// Repos
const OverviewRepo = require('../../repositories/citation_routes/overview.repo');
const HitlRepo = require('../../repositories/citation_routes/hitl.repo');
const PipelineRepo = require('../../repositories/citation_routes/pipeline.repo');
const RoutesdbRepo = require('../../repositories/citation_routes/routesdb.repo');
const BusinessRepo = require('../../repositories/citation_routes/business.repo');

// Services
const OverviewService = require('../../services/citation_routes/overview.service');
const HitlService = require('../../services/citation_routes/hitl.service');
const PipelineService = require('../../services/citation_routes/pipeline.service');
const RoutesdbService = require('../../services/citation_routes/routesdb.service');
const BusinessService = require('../../services/citation_routes/business.service');

// Controllers
const OverviewController = require('../../controllers/citation_routes/overview.controller');
const HitlController = require('../../controllers/citation_routes/hitl.controller');
const PipelineController = require('../../controllers/citation_routes/pipeline.controller');
const RoutesdbController = require('../../controllers/citation_routes/routesdb.controller');
const BusinessController = require('../../controllers/citation_routes/business.controller');

// Route factories
const overviewRoutes = require('./overview.routes');
const hitlRoutes = require('./hitl.routes');
const pipelineRoutes = require('./pipeline.routes');
const pipelineAgentsRoutes = require('./pipeline_agents.routes');
const routesdbRoutes = require('./routesdb.routes');
const businessRoutes = require('./business.routes');

/**
 * Wire up all citation admin routes.
 * @param {Pool} citationPool - Citation DB pool
 * @param {Pool} authPool - Auth DB pool (for user enrichment in business metrics)
 */
module.exports = (citationPool, authPool) => {
    const router = express.Router();

    // Apply auth middleware (accepts ADMIN_TOKEN or JWT from dashboard)
    router.use(adminAuthMiddleware(authPool));

    // --- Overview ---
    const overviewRepo = new OverviewRepo(citationPool);
    const overviewService = new OverviewService(overviewRepo);
    const overviewController = new OverviewController(overviewService);
    router.use('/overview', overviewRoutes(overviewController));

    // --- HITL ---
    const hitlRepo = new HitlRepo(citationPool);
    const hitlService = new HitlService(hitlRepo);
    const hitlController = new HitlController(hitlService);
    router.use('/hitl', hitlRoutes(hitlController));

    // --- Pipeline ---
    const pipelineRepo = new PipelineRepo(citationPool);
    const pipelineService = new PipelineService(pipelineRepo);
    const pipelineController = new PipelineController(pipelineService);
    router.use('/pipeline', pipelineRoutes(pipelineController));

    // --- Pipeline Agents (dynamic) ---
    router.use('/pipeline', pipelineAgentsRoutes(citationPool));

    // --- Routes & DB ---
    const routesdbRepo = new RoutesdbRepo(citationPool);
    const routesdbService = new RoutesdbService(routesdbRepo);
    const routesdbController = new RoutesdbController(routesdbService);
    router.use('/routesdb', routesdbRoutes(routesdbController));

    // --- Business ---
    const businessRepo = new BusinessRepo(citationPool);
    const businessService = new BusinessService(businessRepo, authPool);
    const businessController = new BusinessController(businessService);
    router.use('/business', businessRoutes(businessController));

    return router;
};
