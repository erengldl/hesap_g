-- Compatibility no-op.
-- This migration preserves the legacy baseline entry using a canonical
-- Supabase migration filename so hosted Branching can match it reliably.
--
-- The real initial schema migration for this project is
-- 20260525190128_initial_sqlite_migration.sql and must continue to run
-- after this no-op marker. Do not add DDL here, or fresh databases will
-- replay the initial schema twice.

BEGIN;

COMMIT;
