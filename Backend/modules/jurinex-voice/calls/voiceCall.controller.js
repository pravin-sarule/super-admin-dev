/**
 * HTTP controllers for Jurinex voice call history and analytics.
 */
const path = require('path');
const repo = require('./voiceCall.repository');
const voiceLogger = require('../observability/voiceLogger');
const gcs = require('../gcs/gcsStorage.service');

// Parse a gs://bucket/object/path URI into its parts. Returns null if
// the input isn't a gs:// URI (eg. already a https URL or empty).
const parseGcsUri = (uri) => {
  if (typeof uri !== 'string') return null;
  const match = uri.match(/^gs:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], object: match[2] };
};

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

// Resolves the call's recording into a browser-fetchable URL. If the
// recording is already an https:// link we just hand it back; if it's a
// gs:// URI we mint a short-lived v4 signed read URL. The drawer's
// download button POSTs here, then redirects the browser to `url`.
const getCallRecordingUrl = async (req, res) => {
  try {
    const call = await repo.getCallById(req.params.callId);
    if (!call) {
      return res.status(404).json({ success: false, error: { message: 'Call not found' } });
    }
    const uri = call.recording_uri;
    if (!uri) {
      return res.status(404).json({
        success: false,
        error: { message: 'This call has no recording on file.' },
      });
    }
    if (/^https?:\/\//i.test(uri)) {
      return res.json({ success: true, url: uri, source: 'direct', expires_at: null });
    }
    const parsed = parseGcsUri(uri);
    if (!parsed) {
      return res.status(422).json({
        success: false,
        error: { message: `Recording URI is in an unsupported format: ${uri}` },
      });
    }

    // Pre-flight the object's existence before minting a signed URL.
    // The live-call-agent stores the *call directory* in the DB (e.g.
    // gs://.../2026-05-25/HH-MM-SS_<callSid>) while the actual audio
    // lives one level deeper as recording.wav. Try the exact path
    // first, then fall back to standard filenames inside that prefix.
    const RECORDING_CANDIDATES = [
      'recording.wav',
      'recording.mp3',
      'recording.ogg',
      'recording.m4a',
      'recording.flac',
    ];
    const tryPaths = [parsed.object];
    if (!parsed.object.includes('.')) {
      const prefix = parsed.object.replace(/\/+$/, '');
      for (const name of RECORDING_CANDIDATES) tryPaths.push(`${prefix}/${name}`);
    }

    let resolvedObject = null;
    for (const candidate of tryPaths) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const ok = await gcs.fileExists(parsed.bucket, candidate);
        if (ok) {
          resolvedObject = candidate;
          break;
        }
      } catch (err) {
        voiceLogger.errorWithContext('recording existence check failed', err, {
          callId: req.params.callId,
          bucket: parsed.bucket,
          object: candidate,
        });
      }
    }

    if (!resolvedObject) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RECORDING_OBJECT_MISSING',
          message:
            'The recording path stored for this call does not exist in GCS. The live-call-agent likely failed to upload it, or stored a stale path.',
        },
        bucket: parsed.bucket,
        object: parsed.object,
        gcs_uri: uri,
        tried: tryPaths,
      });
    }

    const expiresInMinutes = 15;
    const signedUrl = await gcs.getSignedReadUrl(parsed.bucket, resolvedObject, expiresInMinutes);
    return res.json({
      success: true,
      url: signedUrl,
      source: 'gcs_signed',
      bucket: parsed.bucket,
      object: resolvedObject,
      filename: path.basename(resolvedObject),
      resolved_from_prefix: resolvedObject !== parsed.object ? parsed.object : undefined,
      expires_at: new Date(Date.now() + expiresInMinutes * 60_000).toISOString(),
    });
  } catch (err) {
    voiceLogger.errorWithContext('getCallRecordingUrl failed', err, {
      requestId: req.requestId,
      callId: req.params.callId,
    });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

module.exports = {
  listCalls,
  getAnalytics,
  getCall,
  getCallRecordingUrl,
};
