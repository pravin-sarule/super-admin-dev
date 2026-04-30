/**
 * Tool dispatcher used by agentLiveTest.socket.js to fulfil Gemini Live
 * `toolCall` messages.
 *
 *   const result = await dispatcher.execute({
 *     name, args, sessionId, agentId, traceId, functionCallId,
 *     toolSettings, transferConfig, endSession, bridgeTwilioCall,
 *   });
 *
 * The dispatcher
 *   • writes a row to voice_tool_executions before and after the tool runs
 *   • emits structured console + dataflow logs for both success and error
 *   • returns a plain JSON object that the caller wraps in a
 *     toolResponse.functionResponses[] envelope back to Gemini Live
 */

const pool = require('../db/jurinexVoiceDB');
const dataflow = require('../observability/dataflowLogger');

const tools = {
  end_call: require('./endCall.tool'),
  transfer_call: require('./transferCall.tool'),
  agent_transfer: require('./agentTransfer.tool'),
  calendar_check: require('./calendarCheck.tool'),
  calendar_book: require('./calendarBook.tool'),
};

const insertExecutionRow = async ({ sessionId, agentId, traceId, functionCallId, name, args }) => {
  try {
    const { rows } = await pool.query(
      `INSERT INTO voice_tool_executions
         (session_id, agent_id, trace_id, function_call_id, tool_name, input_json, status)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,'pending')
       RETURNING id`,
      [
        sessionId || null,
        agentId || null,
        traceId || null,
        functionCallId || null,
        name,
        JSON.stringify(args || {}),
      ]
    );
    return rows[0]?.id || null;
  } catch (err) {
    console.warn('[VOICE_TOOL_DISPATCHER] insert tool_execution row failed', {
      tool: name,
      error: err.message,
    });
    return null;
  }
};

const completeExecutionRow = async ({ id, status, output, errorMessage, latencyMs }) => {
  if (!id) return;
  try {
    await pool.query(
      `UPDATE voice_tool_executions
          SET status        = $2,
              output_json   = $3::jsonb,
              error_message = $4,
              latency_ms    = $5,
              completed_at  = now()
        WHERE id = $1`,
      [
        id,
        status,
        output != null ? JSON.stringify(output) : null,
        errorMessage || null,
        latencyMs || null,
      ]
    );
  } catch (err) {
    console.warn('[VOICE_TOOL_DISPATCHER] update tool_execution row failed', {
      id,
      error: err.message,
    });
  }
};

const drawBox = (title, rows) => {
  const width = 64;
  const top = '╔' + '═'.repeat(width - 2) + '╗';
  const sep = '╠' + '═'.repeat(width - 2) + '╣';
  const bot = '╚' + '═'.repeat(width - 2) + '╝';
  const pad = (text) => {
    const t = text.length > width - 4 ? text.slice(0, width - 5) + '…' : text;
    return `║ ${t}${' '.repeat(width - 3 - t.length)}║`;
  };
  const out = [top, pad(title), sep];
  for (const [k, v] of rows) {
    const display = v == null ? '-' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    out.push(pad(`${String(k).padEnd(14)} ${display.length > 44 ? display.slice(0, 43) + '…' : display}`));
  }
  out.push(bot);
  return out.join('\n');
};

const execute = async ({
  name,
  args = {},
  sessionId,
  agentId,
  traceId,
  functionCallId,
  toolSettings,
  transferConfig,
  endSession,
  bridgeTwilioCall,
}) => {
  const handler = tools[name];
  const startedAt = Date.now();
  const executionId = await insertExecutionRow({
    sessionId,
    agentId,
    traceId,
    functionCallId,
    name,
    args,
  });

  console.log(
    drawBox(`🛠️  TOOL DISPATCH → ${name}`, [
      ['Session', sessionId ? `${String(sessionId).slice(0, 8)}…` : '-'],
      ['Agent', agentId ? `${String(agentId).slice(0, 8)}…` : '-'],
      ['CallId', functionCallId || '-'],
      ['Args', JSON.stringify(args).slice(0, 80)],
    ])
  );

  void dataflow
    .logVoiceEvent('voice_tool_dispatch', 'tool', `Tool dispatched: ${name}`, {
      session_id: sessionId,
      agent_id: agentId,
      trace_id: traceId,
      tool_name: name,
      function_call_id: functionCallId,
      input: args,
      execution_id: executionId,
    })
    .catch(() => {});

  if (!handler) {
    const errorMsg = `Unknown tool '${name}'.`;
    console.warn('[VOICE_TOOL_DISPATCHER]', errorMsg);
    await completeExecutionRow({
      id: executionId,
      status: 'error',
      output: null,
      errorMessage: errorMsg,
      latencyMs: Date.now() - startedAt,
    });
    return {
      status: 'unknown_tool',
      tool_name: name,
      detail: errorMsg,
    };
  }

  let result;
  let status = 'ok';
  let errorMessage = null;
  try {
    result = await handler.run(args, {
      sessionId,
      agentId,
      traceId,
      functionCallId,
      toolExecutionId: executionId,
      toolSettings: toolSettings || {},
      transferConfig: transferConfig || {},
      endSession,
      bridgeTwilioCall,
    });
    status = result?.status === 'invalid_arguments' || result?.status === 'calendar_error' || result?.status === 'unknown_tool'
      ? 'tool_returned_error'
      : 'ok';
  } catch (err) {
    status = 'exception';
    errorMessage = err && err.message ? err.message : String(err);
    result = {
      status: 'exception',
      detail: `Tool ${name} threw an exception: ${errorMessage}. Apologize to the caller and continue.`,
    };
    console.error('[VOICE_TOOL_DISPATCHER] tool threw', {
      tool: name,
      sessionId,
      agentId,
      error: errorMessage,
    });
  }

  const latencyMs = Date.now() - startedAt;
  await completeExecutionRow({
    id: executionId,
    status,
    output: result,
    errorMessage,
    latencyMs,
  });

  console.log(
    drawBox(`✅ TOOL RESULT ← ${name}`, [
      ['Status', result?.status || status],
      ['LatencyMs', latencyMs],
      ['Detail', String(result?.detail || '').slice(0, 60)],
    ])
  );

  void dataflow
    .logVoiceEvent('voice_tool_result', 'tool', `Tool result: ${name}`, {
      session_id: sessionId,
      agent_id: agentId,
      tool_name: name,
      status,
      latency_ms: latencyMs,
      output: result,
      error: errorMessage,
      execution_id: executionId,
    })
    .catch(() => {});

  return result;
};

module.exports = {
  execute,
  knownTools: Object.keys(tools),
};
