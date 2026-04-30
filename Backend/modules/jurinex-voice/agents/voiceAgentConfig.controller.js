/**
 * HTTP controllers for first-class voice agent configuration.
 */
const agentRepo = require('./voiceAgent.repository');
const configRepo = require('./voiceAgentConfig.repository');
const voiceLogger = require('../observability/voiceLogger');
const dataflow = require('../observability/dataflowLogger');

const get = async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = await agentRepo.getById(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: { message: 'Agent not found' } });
    }

    const config = await configRepo.get(agentId);
    await dataflow.logAgentBuilderEvent({
      event_type: 'agent_config_loaded',
      stage: 'config_load',
      message: 'Agent builder configuration loaded',
      agent_id: agentId,
      payload: {
        request_id: req.requestId,
        agent_name: agent.name,
        live_model: config?.live_model || null,
        voice: config?.voice || null,
        has_builder_settings: Boolean(config?.custom_settings?.agent_builder),
      },
    });
    return res.json({ success: true, agent, config });
  } catch (err) {
    voiceLogger.errorWithContext('getAgentConfig failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

const update = async (req, res) => {
  try {
    const { agentId } = req.params;
    const agent = await agentRepo.getById(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: { message: 'Agent not found' } });
    }

    const config = await configRepo.update(agentId, req.body || {});
    const updatedAgent = await agentRepo.getById(agentId);
    const builder = config?.custom_settings?.agent_builder || {};
    await dataflow.logAgentBuilderEvent({
      event_type: 'agent_config_saved',
      stage: 'config_save',
      message: 'Agent builder configuration saved',
      agent_id: agentId,
      payload: {
        request_id: req.requestId,
        agent_name: updatedAgent?.name || agent.name,
        live_model: config.live_model,
        voice: config.voice,
        language_count: Array.isArray(builder.languages) ? builder.languages.length : 0,
        function_count: Array.isArray(builder.functions) ? builder.functions.length : 0,
        extraction_count: Array.isArray(builder.post_call_extraction) ? builder.post_call_extraction.length : 0,
        prompt_chars: config.system_prompts?.audio_live?.length || 0,
      },
    });
    return res.json({ success: true, agent: updatedAgent, config });
  } catch (err) {
    voiceLogger.errorWithContext('updateAgentConfig failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

module.exports = {
  get,
  update,
};
