-- All non-tool system prompt fragments live here so admins can edit copy
-- without code changes. Sister table to voice_tool_system_prompts (which
-- holds per-tool guidance keyed by tool_name).
--
-- Mustache-style {{placeholders}} are rendered at session start by
-- systemPromptFragments.repository.js. Variables available depend on the
-- fragment — documented per row.

CREATE TABLE IF NOT EXISTS voice_system_prompt_fragments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fragment_key  TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  description   TEXT,
  template      TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT NOT NULL DEFAULT 100,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_system_prompt_fragments_active_idx
  ON voice_system_prompt_fragments (is_active, sort_order);

INSERT INTO voice_system_prompt_fragments (fragment_key, display_name, description, template, sort_order)
VALUES
(
  'live_session_base',
  'Live session — base scaffolding',
  'Generic instructions appended after the agent persona prompt. Variables: {{language_label}}.',
  $$You are running a live browser audio test. Reply in {{language_label}}.
Respond naturally and completely according to the caller request.
Ask one focused follow-up question when you need more information.
Do not mention that this is a test unless the user asks.$$,
  10
),
(
  'live_session_realtime_rules',
  'Live session — phone-call style rules',
  'Realtime conversation rules. Variables: (none).',
  $$This is a realtime phone-call style audio session.
Listen continuously, answer as soon as the caller finishes a thought, and allow interruption if the caller starts speaking again.
Keep the same selected language unless the caller clearly asks to switch.
Do not describe internal settings, test mode, or streaming mechanics.$$,
  20
),
(
  'knowledge_base_header',
  'Knowledge base — header & rules',
  'Wraps the KB chunks injected from kb_chunks. Variables: {{kb_sections_block}}, {{kb_truncated_note}}.',
  $$---
KNOWLEDGE BASE (the only source of truth for product/policy questions):
{{kb_sections_block}}
{{kb_truncated_note}}
---
Rules for using the knowledge base above:
- Answer product/policy/feature questions ONLY from the knowledge base content above.
- If the answer is not present in the knowledge base, say so plainly in the caller's language and offer to transfer or take a callback. Do not invent facts.
- Quote document titles or sections naturally when helpful, but never read raw markdown or section markers.
- For account-specific or out-of-scope requests, follow the agent prompt's transfer policy.$$,
  30
),
(
  'knowledge_base_truncated_note',
  'Knowledge base — truncated notice',
  'Inserted into knowledge_base_header when KB content exceeded the size budget. Variables: (none).',
  $$[Note: knowledge base content was truncated due to size budget.]$$,
  31
),
(
  'welcome_turn_template',
  'Welcome turn — first AI utterance',
  'Sent to Gemini Live as a realtime text input to trigger the first audio reply. Variables: {{language_label}}, {{welcome_message}}.',
  $$Start the call now by saying this greeting naturally in {{language_label}}: {{welcome_message}}$$,
  40
),
(
  'fallback_phrase',
  'Fallback phrase — when the agent has no answer',
  'Spoken when neither the knowledge base nor the agent prompt covers the question. Wired in via the live system instruction. Variables: (none).',
  $$When you have no source of truth for a question and cannot transfer, say: "I am sorry, I do not have information on that in our records." Then offer to take a callback.$$,
  50
)
ON CONFLICT (fragment_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description  = EXCLUDED.description,
  template     = EXCLUDED.template,
  sort_order   = EXCLUDED.sort_order,
  is_active    = true,
  updated_at   = now();
