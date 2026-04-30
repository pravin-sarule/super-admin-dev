/**
 * agent_transfer tool — hands the caller from the current voice agent
 * to a different one. In the test panel this records the intent and
 * ends the current Gemini session. In production telephony the same
 * dispatcher could spin up a new Live session for the target agent
 * sharing the existing Twilio media stream.
 */

const agentRepo = require('../agents/voiceAgent.repository');

const run = async (args = {}, context = {}) => {
  const reason = String(args.reason || 'agent_handoff').slice(0, 80);
  const targetLabel = String(args.target_agent_label || '').trim();
  const targetIdInput = String(args.target_agent_id || '').trim();

  let targetAgent = null;
  if (targetIdInput) {
    targetAgent = await agentRepo.getById(targetIdInput).catch(() => null);
  }
  if (!targetAgent && targetLabel) {
    const list = await agentRepo.list().catch(() => []);
    targetAgent =
      list.find(
        (a) =>
          a?.id !== context.agentId &&
          (
            (a.display_name && a.display_name.toLowerCase() === targetLabel.toLowerCase()) ||
            (a.name && a.name.toLowerCase() === targetLabel.toLowerCase())
          )
      ) || null;
  }

  console.log('[VOICE_TOOL][agent_transfer] requested', {
    sessionId: context.sessionId,
    fromAgentId: context.agentId,
    targetLabel,
    targetIdInput,
    resolvedTargetId: targetAgent?.id || null,
    reason,
  });

  if (!targetAgent) {
    return {
      status: 'target_agent_not_found',
      reason,
      detail:
        'No matching voice agent was found. Apologize, ask what the caller needs, and continue the conversation yourself or call transfer_call instead.',
    };
  }

  context.endSession?.({
    reason: `agent_transfer:${reason}`,
    farewell: `Connecting you to ${targetAgent.display_name || targetAgent.name}.`,
    source: 'tool:agent_transfer',
    agentTransfer: {
      from_agent_id: context.agentId,
      to_agent_id: targetAgent.id,
      to_agent_name: targetAgent.display_name || targetAgent.name,
    },
  });

  return {
    status: 'agent_transfer_initiated',
    target_agent_id: targetAgent.id,
    target_agent_name: targetAgent.display_name || targetAgent.name,
    reason,
    detail:
      'The current session is closing. Production telephony would resume the call with the target agent on the same audio leg.',
  };
};

module.exports = { name: 'agent_transfer', run };
