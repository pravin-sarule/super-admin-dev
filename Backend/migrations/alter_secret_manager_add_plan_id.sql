-- Migration: Link secret_manager (Prompt Management) to subscription_plans in payment DB
-- plan_id references subscription_plans.id — token_limit on plan is the per-day token cap

ALTER TABLE secret_manager
  ADD COLUMN IF NOT EXISTS plan_id INTEGER DEFAULT NULL;

COMMENT ON COLUMN secret_manager.plan_id IS 'Subscription plan from payment service; token_limit on plan is daily token cap for this prompt';
