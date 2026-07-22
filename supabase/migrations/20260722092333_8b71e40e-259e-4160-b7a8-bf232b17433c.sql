
ALTER TABLE public.juri
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS role public.app_role,
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Existing juri rows created previously: mark as approved so nothing breaks
UPDATE public.juri SET approved = true WHERE approved = false AND user_id IS NULL;
