/**
 * transfer_call tool — bridges the live caller to a configured human
 * support number.
 *
 * In the agent test panel there is no Twilio call leg to reroute, so we
 * (a) read the configured destination, (b) tell the browser/UI we are
 * transferring, and (c) close the Live session cleanly. In production
 * (live Twilio call) this same tool would update the active TwiML to
 * `<Dial>` the destination — that branch is wired through
 * context.bridgeTwilioCall when present.
 */

const E164 = /^\+[1-9]\d{6,14}$/;

const formatDestination = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return null;
  return E164.test(value) ? value : value;
};

const run = async (args = {}, context = {}) => {
  const reason = String(args.reason || 'user_request').slice(0, 80);
  const announcement = String(args.announcement || '').slice(0, 400);
  const transferConfig = context.transferConfig || {};
  const destination = formatDestination(
    transferConfig.static_destination ||
      transferConfig.destination ||
      transferConfig.phone ||
      ''
  );

  console.log('[VOICE_TOOL][transfer_call] requested', {
    sessionId: context.sessionId,
    agentId: context.agentId,
    reason,
    destination,
    routingMode: transferConfig.routing_mode || null,
    transferType: transferConfig.transfer_type || null,
  });

  if (!destination) {
    return {
      status: 'transfer_unavailable',
      reason,
      detail:
        'No transfer destination is configured for this agent. Apologize to the caller and offer to take a callback or end the call.',
    };
  }

  // Real Twilio bridge — only present when running on a real phone leg.
  if (typeof context.bridgeTwilioCall === 'function') {
    try {
      await context.bridgeTwilioCall({
        destination,
        reason,
        announcement,
        transferType: transferConfig.transfer_type || 'warm',
      });
      console.log('[VOICE_TOOL][transfer_call] Twilio bridge initiated', {
        sessionId: context.sessionId,
        destination,
      });
      return {
        status: 'transfer_initiated',
        destination,
        reason,
        detail: 'Caller is being bridged to the human agent.',
      };
    } catch (err) {
      console.error('[VOICE_TOOL][transfer_call] Twilio bridge failed', {
        sessionId: context.sessionId,
        destination,
        error: err.message,
      });
      throw err;
    }
  }

  // Test-panel path: no Twilio leg exists, so we just announce the
  // intent, persist the audit row, and end the Gemini session.
  context.endSession?.({
    reason: `transfer:${reason}`,
    farewell: announcement || `Transferring you now to ${destination}.`,
    source: 'tool:transfer_call',
    transfer: { destination, transferType: transferConfig.transfer_type || 'warm' },
  });

  return {
    status: 'transfer_simulated',
    destination,
    reason,
    detail:
      'Test panel is not connected to live telephony, so the transfer is recorded as simulated. The session is ending; in a real call this would be a Twilio Dial bridge.',
  };
};

module.exports = { name: 'transfer_call', run };
