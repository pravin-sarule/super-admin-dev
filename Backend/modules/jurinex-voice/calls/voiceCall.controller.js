/**
 * HTTP controllers for Jurinex voice call history and analytics.
 */
const repo = require('./voiceCall.repository');
const voiceLogger = require('../observability/voiceLogger');

const parseQuery = (query = {}) => ({
  start_date: query.start_date || query.from || query.start,
  end_date: query.end_date || query.to || query.end,
  timezone: query.timezone || 'Asia/Kolkata',
  agent_id: query.agent_id || undefined,
  direction: query.direction || undefined,
  status: query.status || undefined,
  outcome: query.outcome || undefined,
  sentiment: query.sentiment || undefined,
  search: query.search || undefined,
  limit: query.limit,
  offset: query.offset,
});

const listCalls = async (req, res) => {
  try {
    const result = await repo.listCalls(parseQuery(req.query));
    return res.json({
      success: true,
      calls: result.calls,
      total: result.total,
      has_enrichment_table: result.has_enrichment_table,
    });
  } catch (err) {
    voiceLogger.errorWithContext('listVoiceCalls failed', err, {
      requestId: req.requestId,
    });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const result = await repo.getAnalytics(parseQuery(req.query));
    return res.json({ success: true, ...result });
  } catch (err) {
    voiceLogger.errorWithContext('getVoiceCallAnalytics failed', err, {
      requestId: req.requestId,
    });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

const getCall = async (req, res) => {
  try {
    const call = await repo.getCallById(req.params.callId);
    if (!call) {
      return res.status(404).json({
        success: false,
        error: { message: 'Call not found' },
      });
    }

    const [messages, debugEvents, toolEvents, tickets, escalations] = await Promise.all([
      repo.listCallMessages(call.id),
      repo.listCallDebugEvents(call.id),
      repo.listCallToolEvents(call.id),
      repo.listCallTickets(call.id),
      repo.listCallEscalations(call.id),
    ]);

    return res.json({
      success: true,
      call,
      messages,
      debug_events: debugEvents,
      tool_events: toolEvents,
      tickets,
      escalations,
    });
  } catch (err) {
    voiceLogger.errorWithContext('getVoiceCall failed', err, {
      requestId: req.requestId,
    });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

module.exports = {
  listCalls,
  getAnalytics,
  getCall,
};
