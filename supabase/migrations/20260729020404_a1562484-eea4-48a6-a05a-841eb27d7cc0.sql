CREATE TABLE public.password_reset_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  identifier text NOT NULL,
  new_password text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.password_reset_request TO authenticated;
GRANT ALL ON public.password_reset_request TO service_role;

ALTER TABLE public.password_reset_request ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage password reset request"
  ON public.password_reset_request FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_password_reset_request_updated_at
  BEFORE UPDATE ON public.password_reset_request
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();