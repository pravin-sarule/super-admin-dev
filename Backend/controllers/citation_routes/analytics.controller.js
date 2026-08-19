const { once } = require('events');
const logger = require('../../config/logger');
const { sendSuccess, sendError } = require('../../utils/response');
const { parsePagination } = require('../../utils/pagination');
const { CSV_BOM, csvHeader, csvRow, csvLine } = require('../../utils/csv');

class AnalyticsController {
  constructor(analyticsService) {
    this.service = analyticsService;
  }

  /** Shared query parsing: date range, department, export scope, pagination. */
  _parseQuery(req) {
    const { page, pageSize } = parsePagination({
      page: req.query.page,
      pageSize: req.query.pageSize ?? 4,
    });
    return {
      from: req.query.from,
      to: req.query.to,
      department: req.query.department ?? 'all',
      scope: req.query.scope === 'events' ? 'events' : 'users',
      page,
      pageSize,
    };
  }

  getAnalytics = async (req, res, next) => {
    const requestId = req.requestId;
    try {
      const data = await this.service.getAnalytics(this._parseQuery(req), requestId);
      return sendSuccess(res, data);
    } catch (err) {
      logger.error(`AnalyticsController.getAnalytics: ${err.message}`, {
        requestId,
        stack: err.stack,
      });
      next(err);
    }
  };

  getHeartbeat = async (req, res, next) => {
    const requestId = req.requestId;
    try {
      const data = await this.service.getHeartbeat(requestId);
      return sendSuccess(res, data);
    } catch (err) {
      logger.error(`AnalyticsController.getHeartbeat: ${err.message}`, {
        requestId,
        stack: err.stack,
      });
      return sendError(res, {
        code: err.code === 'COST_DB_NOT_CONFIGURED' ? 'COST_DB_NOT_CONFIGURED' : 'SERVICE_UNAVAILABLE',
        message: 'Citation usage analytics unavailable',
        statusCode: 503,
        requestId,
      });
    }
  };

  getDepartments = async (req, res, next) => {
    const requestId = req.requestId;
    try {
      const data = await this.service.getDepartments(requestId);
      return sendSuccess(res, data);
    } catch (err) {
      logger.error(`AnalyticsController.getDepartments: ${err.message}`, {
        requestId,
        stack: err.stack,
      });
      next(err);
    }
  };

  getSessions = async (req, res, next) => {
    const requestId = req.requestId;
    try {
      const q = this._parseQuery(req);
      // Sessions list uses its own page size (the user table's 4 is too small here).
      const pageSize = req.query.pageSize ? q.pageSize : 10;
      const data = await this.service.getSessions({ ...q, pageSize }, requestId);
      return sendSuccess(res, data);
    } catch (err) {
      logger.error(`AnalyticsController.getSessions: ${err.message}`, {
        requestId,
        stack: err.stack,
      });
      next(err);
    }
  };

  getSessionDetails = async (req, res, next) => {
    const requestId = req.requestId;
    try {
      // run_id absent => whole session; present => just that run.
      const runId = req.query.run_id === undefined ? undefined : String(req.query.run_id ?? '');
      const data = await this.service.getSessionDetails(req.params.sessionId, runId, requestId);
      return sendSuccess(res, data);
    } catch (err) {
      logger.error(`AnalyticsController.getSessionDetails: ${err.message}`, {
        requestId,
        stack: err.stack,
      });
      next(err);
    }
  };

  getUserDetails = async (req, res, next) => {
    const requestId = req.requestId;
    const { userId } = req.params;
    try {
      const { from, to } = this._parseQuery(req);
      const data = await this.service.getUserDetails(userId, { from, to }, requestId);
      return sendSuccess(res, data);
    } catch (err) {
      logger.error(`AnalyticsController.getUserDetails: ${err.message}`, {
        requestId,
        stack: err.stack,
      });
      next(err);
    }
  };

  /**
   * Streaming CSV export. Not the standard JSON envelope — headers are set directly.
   * Back-pressure aware, and paged rather than materialising the whole result set.
   */
  exportCsv = async (req, res, next) => {
    const requestId = req.requestId;
    try {
      const pager = await this.service.getExportPager(this._parseQuery(req), requestId);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${pager.filename}"`);
      res.setHeader('Cache-Control', 'no-store');
      if (requestId) res.setHeader('X-Request-Id', requestId);

      const write = async (chunk) => {
        if (!res.write(chunk)) await once(res, 'drain');
      };

      await write(CSV_BOM + csvHeader(pager.columns));

      let rows;
      // eslint-disable-next-line no-cond-assign
      while ((rows = await pager.next()) !== null) {
        let buf = '';
        for (const row of rows) buf += csvRow(pager.columns, row);
        await write(buf);
      }

      if (pager.wasTruncated && pager.wasTruncated()) {
        await write(csvLine(['…truncated at export row limit…']));
      }

      return res.end();
    } catch (err) {
      logger.error(`AnalyticsController.exportCsv: ${err.message}`, {
        requestId,
        stack: err.stack,
      });
      // Once headers are sent the response cannot become a JSON envelope.
      if (res.headersSent) return res.end();
      return next(err);
    }
  };
}

module.exports = AnalyticsController;
