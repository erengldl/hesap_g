-- Canonical timestamped filename to satisfy Supabase hosted Branching.
BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id
  ON public.users(auth_user_id);

COMMIT;
