/**
 * Function declarations advertised to Gemini Live so the model knows
 * which tools it may call. Each entry has a stable `name` that maps to
 * a handler in dispatcher.js. Keep names in sync with FUNCTION_OPTIONS
 * on the frontend (agentBuilderConstants.js).
 */

const ALL_DECLARATIONS = [
  {
    name: 'end_call',
    description:
      'End the current voice call once the conversation is complete or the caller asks to hang up. Always say a brief goodbye to the caller before calling this.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Short reason the call is ending (e.g. "user_request", "completed", "out_of_scope").',
        },
        farewell: {
          type: 'string',
          description: 'Optional farewell line that the agent already said in audio. Used for the call summary.',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'transfer_call',
    description:
      'Transfer the live caller to a configured human support number. Use when the caller asks for a human or when the question is account-specific.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Short reason for the transfer (e.g. "billing_question", "account_specific", "user_request").',
        },
        announcement: {
          type: 'string',
          description: 'Single-line message the agent already spoke before this tool call (e.g. "Connecting you to our support team now").',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'agent_transfer',
    description:
      'Hand the caller off to a different voice agent (e.g. switch from Preeti to a sales agent). The receiving agent will pick up the same WebSocket session.',
    parameters: {
      type: 'object',
      properties: {
        target_agent_label: {
          type: 'string',
          description: 'Friendly name of the target agent as configured in the agent builder.',
        },
        target_agent_id: {
          type: 'string',
          description: 'UUID of the target agent (preferred when known).',
        },
        reason: {
          type: 'string',
          description: 'Why this caller should be moved to the target agent.',
        },
      },
      required: ['reason'],
    },
  },
  {
    name: 'calendar_check',
    description:
      'Check availability on the configured Google Calendar between two ISO timestamps. Returns a list of busy windows so the agent can propose a free slot.',
    parameters: {
      type: 'object',
      properties: {
        start_iso: {
          type: 'string',
          description: 'Start of the search window in ISO 8601 (e.g. "2026-05-01T09:00:00+05:30").',
        },
        end_iso: {
          type: 'string',
          description: 'End of the search window in ISO 8601.',
        },
        slot_duration_minutes: {
          type: 'integer',
          description: 'Desired meeting length in minutes. Default 30 if omitted.',
        },
      },
      required: ['start_iso', 'end_iso'],
    },
  },
  {
    name: 'search_knowledge_base',
    description:
      'Search the agent\'s product/policy knowledge base by semantic similarity and return the top matching snippets. Always call this BEFORE answering any product, pricing, feature, or policy question — never invent facts. The result has `confident: true` only when the top match is above the configured similarity floor.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'A short, focused phrase summarizing what the caller is asking. Example: "Smart Case Summarizer pricing", "supported document formats".',
        },
        k: {
          type: 'integer',
          description: 'How many top snippets to fetch. Default 5; raise only when the question is broad.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'calendar_book',
    description:
      'Book an appointment on the configured Google Calendar. Always read back the chosen time and attendee email to confirm before calling this tool.',
    parameters: {
      type: 'object',
      properties: {
        start_iso: { type: 'string', description: 'Start time in ISO 8601 with timezone.' },
        end_iso: { type: 'string', description: 'End time in ISO 8601 with timezone.' },
        summary: { type: 'string', description: 'Short title for the calendar event (e.g. "Demo call with Acme Corp").' },
        description: { type: 'string', description: 'Optional longer description / notes.' },
        attendee_name: { type: 'string', description: 'Caller display name.' },
        attendee_email: { type: 'string', description: 'Caller email so the invite can be delivered.' },
        attendee_phone: { type: 'string', description: 'Caller phone number in E.164.' },
      },
      required: ['start_iso', 'end_iso', 'summary'],
    },
  },
];

const DECLARATIONS_BY_NAME = Object.fromEntries(
  ALL_DECLARATIONS.map((decl) => [decl.name, decl])
);

/**
 * Resolve which declarations should be exposed to the model for this
 * agent. `enabledKeys` comes from builderSettings.functions[].
 */
const getDeclarationsForAgent = (enabledKeys = []) => {
  const set = new Set(enabledKeys.filter(Boolean));
  return ALL_DECLARATIONS.filter((decl) => set.has(decl.name));
};

module.exports = {
  ALL_DECLARATIONS,
  DECLARATIONS_BY_NAME,
  getDeclarationsForAgent,
};
