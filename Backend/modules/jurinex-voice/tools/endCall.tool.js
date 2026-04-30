/**
 * end_call tool — gracefully ends the current Live session.
 *
 * The dispatcher passes us a `context.endSession(reason, farewell)`
 * helper that closes the Gemini Live socket and instructs the browser
 * to stop capture and play any farewell audio still in flight.
 */

const run = async (args = {}, context = {}) => {
  const reason = String(args.reason || 'completed').slice(0, 80);
  const farewell = String(args.farewell || '').slice(0, 400);

  console.log('[VOICE_TOOL][end_call] requested', {
    sessionId: context.sessionId,
    agentId: context.agentId,
    reason,
    farewellPreview: farewell.slice(0, 120),
  });

  // Hand off to the live socket so it can sequence: send a final
  // "bye" turn, wait for the audio to flush, then close cleanly.
  context.endSession?.({ reason, farewell, source: 'tool:end_call' });

  return {
    status: 'ending_call',
    reason,
    detail: 'The voice session is winding down. The agent should stop speaking after the farewell.',
  };
};

module.exports = { name: 'end_call', run };
