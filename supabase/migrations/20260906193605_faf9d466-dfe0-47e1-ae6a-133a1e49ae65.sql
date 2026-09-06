
CREATE TABLE public.form_resposta_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id uuid NOT NULL REFERENCES public.form_respostas(id) ON DELETE CASCADE,
  autor_id uuid,
  autor_nome text,
  texto text NOT NULL,
  interno boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_resposta_comentarios TO authenticated;
GRANT ALL ON public.form_resposta_comentarios TO service_role;
ALTER TABLE public.form_resposta_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "com_read" ON public.form_resposta_comentarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "com_write" ON public.form_resposta_comentarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "com_update" ON public.form_resposta_comentarios FOR UPDATE TO authenticated USING (autor_id = auth.uid());
CREATE POLICY "com_delete" ON public.form_resposta_comentarios FOR DELETE TO authenticated USING (autor_id = auth.uid());
CREATE INDEX idx_form_com_resposta ON public.form_resposta_comentarios(resposta_id, criado_em DESC);

CREATE TABLE public.form_resposta_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id uuid NOT NULL REFERENCES public.form_respostas(id) ON DELETE CASCADE,
  campo text NOT NULL,
  de text,
  para text,
  autor_id uuid,
  autor_nome text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.form_resposta_eventos TO authenticated;
GRANT ALL ON public.form_resposta_eventos TO service_role;
ALTER TABLE public.form_resposta_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ev_read" ON public.form_resposta_eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "ev_write" ON public.form_resposta_eventos FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_form_ev_resposta ON public.form_resposta_eventos(resposta_id, criado_em DESC);

CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'geral',
  titulo text NOT NULL,
  mensagem text,
  link text,
  lida boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_own_read" ON public.notificacoes FOR SELECT TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "notif_insert" ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notif_own_update" ON public.notificacoes FOR UPDATE TO authenticated USING (usuario_id = auth.uid());
CREATE POLICY "notif_own_delete" ON public.notificacoes FOR DELETE TO authenticated USING (usuario_id = auth.uid());
CREATE INDEX idx_notif_usuario ON public.notificacoes(usuario_id, lida, criado_em DESC);

CREATE OR REPLACE FUNCTION public.form_notificar_nova_resposta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form public.form_formularios%ROWTYPE;
  v_dest uuid;
BEGIN
  SELECT * INTO v_form FROM public.form_formularios WHERE id = NEW.formulario_id;
  IF v_form.id IS NULL THEN RETURN NEW; END IF;
  v_dest := COALESCE(v_form.responsavel_id, v_form.autor_id);
  IF v_dest IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
  VALUES (
    v_dest, 'form_resposta',
    'Nova resposta em ' || v_form.titulo,
    COALESCE(NEW.respondente_nome, 'Respondente anônimo') || ' enviou o protocolo ' || COALESCE(NEW.protocolo, ''),
    '/forms/' || v_form.id::text || '/respostas'
  );
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.form_notificar_nova_resposta() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_form_notificar_nova_resposta
AFTER INSERT ON public.form_respostas
FOR EACH ROW EXECUTE FUNCTION public.form_notificar_nova_resposta();
