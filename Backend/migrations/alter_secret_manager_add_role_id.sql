-- Migration: Add role_id to secret_manager table (docDB)
-- role_id references the roles table in the main Jurinex application DB (UUID type)

ALTER TABLE secret_manager
  ADD COLUMN IF NOT EXISTS role_id UUID DEFAULT NULL;

COMMENT ON COLUMN secret_manager.role_id IS 'References roles.id from the Jurinex application DB — used for role-based prompt assignment';
