-- Migration: Create prompt_roles table (stored in docDB)
-- Custom roles that can be assigned to system prompts

CREATE TABLE IF NOT EXISTS prompt_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO prompt_roles (name, description) VALUES
  ('charter', 'Charter domain prompts'),
  ('banking', 'Banking domain prompts'),
  ('finance', 'Finance domain prompts')
ON CONFLICT (name) DO NOTHING;
