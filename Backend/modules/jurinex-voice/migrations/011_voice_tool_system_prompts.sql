-- One editable system-prompt fragment per voice agent function.
-- Backend reads these rows when starting a Live session and appends the
-- ones whose tool_name is in the agent's enabled functions list. Admins
-- edit prompt copy in this table instead of in code.
--
-- Placeholders use Mustache-style `{{var}}`. Available variables are
-- supplied by buildToolUsageBlock() in agentLiveTest.socket.js:
--   {{timezone}}                 e.g. "Asia/Kolkata"
--   {{default_meeting_minutes}}  number
--   {{working_hours_block}}      pre-formatted multi-line list
--   {{disabled_days}}            "Sunday" / "(none)"
--   {{blocked_dates}}            "2026-05-15, 2026-12-25" / "(none)"
--   {{view_only_warning}}        empty unless view_only=true
--   {{transfer_destination}}     E.164 phone for transfer_call
--   {{transfer_type}}            "warm" / "cold"
--   {{language_label}}           e.g. "English (US)" / "Hindi (India)"
-- Unknown placeholders are left as-is so admins can spot typos.

CREATE TABLE IF NOT EXISTS voice_tool_system_prompts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name       TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  description     TEXT,
  prompt_template TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  sort_order      INT NOT NULL DEFAULT 100,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS voice_tool_system_prompts_active_idx
  ON voice_tool_system_prompts (is_active, sort_order);

INSERT INTO voice_tool_system_prompts (tool_name, display_name, description, prompt_template, sort_order)
VALUES
(
  'end_call',
  'End Call',
  'Tells the agent how and when to hang up.',
  $$END_CALL TOOL — you may end the conversation when appropriate.
- When the caller is clearly done (says goodbye, has the answer they need, asks to hang up), say one short farewell in {{language_label}}.
- Then call `end_call` with: reason (short label like "user_request" or "completed") and farewell (the exact line you just said). Do not call this tool if the caller is still asking questions.$$,
  10
),
(
  'transfer_call',
  'Call Transfer',
  'Tells the agent how to escalate to a human number.',
  $$TRANSFER_CALL TOOL — you may bridge the caller to a human support number.
- Use this when the caller asks for a human, has an account-specific issue you cannot answer, or the question is out of scope for the knowledge base.
- Say one short transfer line in {{language_label}} (e.g. "Connecting you to our team now"), then call `transfer_call` with: reason (short label) and announcement (the line you just said).
- Configured destination: {{transfer_destination}} ({{transfer_type}} transfer). Do not invent another number.$$,
  20
),
(
  'agent_transfer',
  'Agent Transfer',
  'Tells the agent how to hand off to another voice agent.',
  $$AGENT_TRANSFER TOOL — you may hand the caller to a different voice agent (e.g. sales, billing).
- Use this only if the caller's need clearly belongs to another agent.
- Speak one short hand-off line in {{language_label}}, then call `agent_transfer` with target_agent_label, target_agent_id (if known), and reason.$$,
  30
),
(
  'calendar_check',
  'Check Calendar Availability',
  'Tells the agent how to query free slots before booking.',
  $$CALENDAR_CHECK TOOL — you have access to a real Google Calendar to look up availability.
Time zone: {{timezone}}. Default meeting length: {{default_meeting_minutes}} minutes.
Working hours (the ONLY times bookings can be proposed):
{{working_hours_block}}
Closed on: {{disabled_days}}.
Blocked dates (holidays, refuse): {{blocked_dates}}.
{{view_only_warning}}

How to use:
- When the caller asks about availability, free slots, or "when can we meet", FIRST call `calendar_check` with start_iso and end_iso covering the window they asked about.
- ALWAYS pass timestamps in ISO 8601 with timezone offset (e.g. "2026-05-04T09:00:00+05:30"). Never use vague strings.
- Read the returned `free_windows` and propose specific times in natural spoken language. Never read raw ISO strings.
- If `free_windows` is empty, tell the caller nothing is open in that range and suggest a different day inside the working hours above.$$,
  40
),
(
  'calendar_book',
  'Book on the Calendar',
  'Tells the agent how to confirm and create a calendar event.',
  $$CALENDAR_BOOK TOOL — you may create a Google Calendar event.
{{view_only_warning}}

Strict procedure:
1. Before calling `calendar_book`, verbally read back the chosen date, time, meeting reason, and the caller's email in {{language_label}}, and get a clear "yes" from the caller. Ask the caller to spell their email — never guess.
2. Then call `calendar_book` with: start_iso, end_iso (start + {{default_meeting_minutes}} minutes unless the caller asked otherwise), summary (short reason), attendee_name, attendee_email, optional attendee_phone.
3. Only after the tool returns `status: "booked"` confirm the booking aloud.
4. If the tool returns `outside_working_hours`, `date_blocked`, or `day_disabled`, apologize and propose another slot inside the working hours configured in CALENDAR_CHECK.$$,
  50
)
ON CONFLICT (tool_name) DO UPDATE SET
  display_name    = EXCLUDED.display_name,
  description     = EXCLUDED.description,
  prompt_template = EXCLUDED.prompt_template,
  sort_order      = EXCLUDED.sort_order,
  is_active       = true,
  updated_at      = now();
