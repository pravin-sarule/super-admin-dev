-- Add per-service daily token limits to subscription_plans
-- These replace the single generic token_limit for granular Chat / Summarization caps.

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS chat_token_limit INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS summarization_token_limit INTEGER DEFAULT NULL;

COMMENT ON COLUMN subscription_plans.chat_token_limit IS 'Daily token cap for the Chat Model service for users on this plan';
COMMENT ON COLUMN subscription_plans.summarization_token_limit IS 'Daily token cap for the Summarization Chat service for users on this plan';
