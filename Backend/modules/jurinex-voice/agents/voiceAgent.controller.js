/**
 * HTTP controllers for voice agents.
 */
const repo = require('./voiceAgent.repository');
const configRepo = require('./voiceAgentConfig.repository');
const voiceLogger = require('../observability/voiceLogger');

const ALLOWED_STATUS = ['active', 'inactive', 'draft'];

const list = async (req, res) => {
  try {
    const { status } = req.query;
    const agents = await repo.list({ status });
    const counts = await repo.documentCounts();
    const enriched = agents.map((a) => ({
      ...a,
      document_count: counts[a.id] || 0,
    }));
    return res.json({ success: true, agents: enriched });
  } catch (err) {
    voiceLogger.errorWithContext('listAgents failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

const get = async (req, res) => {
  try {
    const agent = await repo.getById(req.params.agentId);
    if (!agent) return res.status(404).json({ success: false, error: { message: 'Agent not found' } });
    return res.json({ success: true, agent });
  } catch (err) {
    voiceLogger.errorWithContext('getAgent failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

const create = async (req, res) => {
  try {
    const { name, display_name, description, status, language_config, system_prompt } = req.body || {};
    if (!name) {
      return res.status(400).json({ success: false, error: { message: '`name` is required' } });
    }
    if (status && !ALLOWED_STATUS.includes(status)) {
      return res.status(400).json({ success: false, error: { message: `status must be one of ${ALLOWED_STATUS.join(', ')}` } });
    }

    const existing = await repo.getByName(name);
    if (existing) {
      return res.status(409).json({ success: false, error: { message: `Agent with name "${name}" already exists` } });
    }

    const agent = await repo.create({
      name,
      display_name,
      description,
      status: status || 'active',
      language_config,
      system_prompt,
      created_by: req.user?.email || req.adminAuth?.method || null,
    });
    await configRepo.ensureRows(agent.id);
    return res.status(201).json({ success: true, agent });
  } catch (err) {
    voiceLogger.errorWithContext('createAgent failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

const update = async (req, res) => {
  try {
    const { agentId } = req.params;
    const updates = req.body || {};
    if (updates.status && !ALLOWED_STATUS.includes(updates.status)) {
      return res.status(400).json({ success: false, error: { message: `status must be one of ${ALLOWED_STATUS.join(', ')}` } });
    }
    const agent = await repo.update(agentId, updates);
    if (!agent) return res.status(404).json({ success: false, error: { message: 'Agent not found' } });
    return res.json({ success: true, agent });
  } catch (err) {
    voiceLogger.errorWithContext('updateAgent failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

const remove = async (req, res) => {
  try {
    const agent = await repo.softDelete(req.params.agentId);
    if (!agent) return res.status(404).json({ success: false, error: { message: 'Agent not found' } });
    return res.json({ success: true, agent });
  } catch (err) {
    voiceLogger.errorWithContext('deleteAgent failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

module.exports = { list, get, create, update, remove };
