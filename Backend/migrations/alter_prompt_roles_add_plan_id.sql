-- Migration: Add plan_id to prompt_roles (docDB)
-- Links a prompt role to a subscription plan for token limit enforcement

ALTER TABLE prompt_roles ADD COLUMN IF NOT EXISTS plan_id INTEGER;
