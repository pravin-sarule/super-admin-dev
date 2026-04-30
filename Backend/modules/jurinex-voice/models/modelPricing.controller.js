/**
 * HTTP controller for allowed Gemini voice model pricing.
 */
const repo = require('./modelPricing.repository');
const voiceLogger = require('../observability/voiceLogger');

const list = async (req, res) => {
  try {
    const models = await repo.list({ active: true });
    return res.json({ success: true, models });
  } catch (err) {
    voiceLogger.errorWithContext('listVoiceModelPricing failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

module.exports = {
  list,
};
