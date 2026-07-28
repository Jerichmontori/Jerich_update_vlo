
-- 1) Enum roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'inspektur';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ketua_juri';
