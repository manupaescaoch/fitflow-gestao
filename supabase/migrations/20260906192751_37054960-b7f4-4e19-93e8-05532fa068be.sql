CREATE TABLE public.app_branding (
  id boolean PRIMARY KEY DEFAULT true,
  nome text NOT NULL DEFAULT 'MPTEAM',
  subtitulo text NOT NULL DEFAULT 'CRM',
  logo_url text,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid,
  CONSTRAINT app_branding_singleton CHECK (id)
);

GRANT SELECT ON public.app_branding TO anon;
GRANT SELECT, INSERT, UPDATE ON public.app_branding TO authenticated;
GRANT ALL ON public.app_branding TO service_role;

ALTER TABLE public.app_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branding visivel para todos" ON public.app_branding
  FOR SELECT USING (true);

CREATE POLICY "Admins alteram branding" ON public.app_branding
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins criam branding" ON public.app_branding
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER app_branding_set_updated
  BEFORE UPDATE ON public.app_branding
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

INSERT INTO public.app_branding (id, nome, subtitulo) VALUES (true, 'MPTEAM', 'CRM');