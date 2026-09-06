-- ============ FORMULÁRIOS ============
CREATE TABLE public.form_formularios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(8), 'hex'),
  titulo text NOT NULL DEFAULT 'Novo formulário',
  descricao text,
  capa_url text,
  cor_primaria text NOT NULL DEFAULT '#e11d48',
  status text NOT NULL DEFAULT 'rascunho',
  autor_id uuid REFERENCES public.usuarios_crm(id) ON DELETE SET NULL,
  autor_nome text,
  responsavel_id uuid REFERENCES public.usuarios_crm(id) ON DELETE SET NULL,
  abre_em timestamptz,
  encerra_em timestamptz,
  mensagem_sucesso text NOT NULL DEFAULT 'Resposta enviada com sucesso. Obrigado!',
  redirect_url text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_respostas integer,
  total_respostas integer NOT NULL DEFAULT 0,
  ultima_resposta_em timestamptz,
  versao integer NOT NULL DEFAULT 1,
  publicado_em timestamptz,
  excluido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT form_formularios_status_chk CHECK (status IN ('rascunho','publicado','pausado','encerrado','arquivado'))
);
CREATE INDEX form_formularios_status_idx ON public.form_formularios(status) WHERE excluido_em IS NULL;

CREATE TABLE public.form_secoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id uuid NOT NULL REFERENCES public.form_formularios(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  titulo text NOT NULL DEFAULT 'Seção',
  descricao text,
  destino text NOT NULL DEFAULT 'proxima',
  destino_secao_id uuid,
  excluido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX form_secoes_form_idx ON public.form_secoes(formulario_id);

CREATE TABLE public.form_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id uuid NOT NULL REFERENCES public.form_formularios(id) ON DELETE CASCADE,
  secao_id uuid REFERENCES public.form_secoes(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  tipo text NOT NULL DEFAULT 'texto_curto',
  titulo text NOT NULL DEFAULT 'Pergunta sem título',
  descricao text,
  obrigatoria boolean NOT NULL DEFAULT false,
  opcoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  condicoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  excluido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX form_perguntas_form_idx ON public.form_perguntas(formulario_id);

CREATE SEQUENCE public.form_protocolo_seq;

CREATE TABLE public.form_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id uuid NOT NULL REFERENCES public.form_formularios(id) ON DELETE CASCADE,
  protocolo text NOT NULL DEFAULT ('PRT-' || to_char(now(),'YYMM') || '-' || lpad(nextval('public.form_protocolo_seq')::text, 5, '0')),
  edit_token text NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  respondente_nome text,
  respondente_email text,
  respondente_telefone text,
  aluno_id uuid REFERENCES public.alunos(id) ON DELETE SET NULL,
  identificador text,
  status text NOT NULL DEFAULT 'nova',
  prioridade text NOT NULL DEFAULT 'normal',
  responsavel_id uuid REFERENCES public.usuarios_crm(id) ON DELETE SET NULL,
  prazo date,
  revisada boolean NOT NULL DEFAULT false,
  critica boolean NOT NULL DEFAULT false,
  duracao_seg integer,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT form_respostas_status_chk CHECK (status IN ('nova','em_analise','acao_necessaria','em_andamento','resolvida','arquivada')),
  CONSTRAINT form_respostas_prioridade_chk CHECK (prioridade IN ('baixa','normal','alta','critica'))
);
CREATE INDEX form_respostas_form_idx ON public.form_respostas(formulario_id, enviado_em DESC);

CREATE TABLE public.form_resposta_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id uuid NOT NULL REFERENCES public.form_respostas(id) ON DELETE CASCADE,
  pergunta_id uuid REFERENCES public.form_perguntas(id) ON DELETE SET NULL,
  pergunta_titulo text NOT NULL,
  pergunta_tipo text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  valor_texto text,
  valor_num numeric,
  valor_data date,
  valor_json jsonb,
  arquivos jsonb NOT NULL DEFAULT '[]'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX form_resposta_itens_resp_idx ON public.form_resposta_itens(resposta_id);
CREATE INDEX form_resposta_itens_perg_idx ON public.form_resposta_itens(pergunta_id);

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_formularios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_secoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_perguntas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_respostas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_resposta_itens TO authenticated;
GRANT ALL ON public.form_formularios, public.form_secoes, public.form_perguntas, public.form_respostas, public.form_resposta_itens TO service_role;
GRANT USAGE ON SEQUENCE public.form_protocolo_seq TO anon, authenticated, service_role;

GRANT SELECT ON public.form_formularios TO anon;
GRANT SELECT ON public.form_secoes TO anon;
GRANT SELECT ON public.form_perguntas TO anon;
GRANT INSERT ON public.form_respostas TO anon;
GRANT INSERT ON public.form_resposta_itens TO anon;

-- ============ RLS ============
ALTER TABLE public.form_formularios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_secoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_resposta_itens ENABLE ROW LEVEL SECURITY;

-- Equipe do CRM: acesso total
CREATE POLICY "crm gerencia formularios" ON public.form_formularios FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid())) WITH CHECK (public.is_crm_user(auth.uid()));
CREATE POLICY "crm gerencia secoes" ON public.form_secoes FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid())) WITH CHECK (public.is_crm_user(auth.uid()));
CREATE POLICY "crm gerencia perguntas" ON public.form_perguntas FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid())) WITH CHECK (public.is_crm_user(auth.uid()));
CREATE POLICY "crm gerencia respostas" ON public.form_respostas FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid())) WITH CHECK (public.is_crm_user(auth.uid()));
CREATE POLICY "crm gerencia itens" ON public.form_resposta_itens FOR ALL TO authenticated
  USING (public.is_crm_user(auth.uid())) WITH CHECK (public.is_crm_user(auth.uid()));

-- Público: leitura de formulários publicados
CREATE POLICY "publico le formulario publicado" ON public.form_formularios FOR SELECT TO anon
  USING (status IN ('publicado','pausado','encerrado') AND excluido_em IS NULL);
CREATE POLICY "publico le secoes publicadas" ON public.form_secoes FOR SELECT TO anon
  USING (excluido_em IS NULL AND EXISTS (
    SELECT 1 FROM public.form_formularios f
    WHERE f.id = formulario_id AND f.status IN ('publicado','pausado','encerrado') AND f.excluido_em IS NULL));
CREATE POLICY "publico le perguntas publicadas" ON public.form_perguntas FOR SELECT TO anon
  USING (excluido_em IS NULL AND EXISTS (
    SELECT 1 FROM public.form_formularios f
    WHERE f.id = formulario_id AND f.status IN ('publicado','pausado','encerrado') AND f.excluido_em IS NULL));

-- Público: envio de respostas apenas em formulário publicado dentro do prazo
CREATE POLICY "publico envia resposta" ON public.form_respostas FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.form_formularios f
    WHERE f.id = formulario_id
      AND f.status = 'publicado'
      AND f.excluido_em IS NULL
      AND (f.abre_em IS NULL OR f.abre_em <= now())
      AND (f.encerra_em IS NULL OR f.encerra_em >= now())
      AND (f.max_respostas IS NULL OR f.total_respostas < f.max_respostas)
      AND COALESCE((f.config->>'aceitar_respostas')::boolean, true)
  ));
CREATE POLICY "publico envia itens" ON public.form_resposta_itens FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.form_respostas r
    JOIN public.form_formularios f ON f.id = r.formulario_id
    WHERE r.id = resposta_id AND f.status = 'publicado' AND f.excluido_em IS NULL
  ));

-- ============ TRIGGERS ============
CREATE TRIGGER form_formularios_set_atualizado BEFORE UPDATE ON public.form_formularios
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();
CREATE TRIGGER form_secoes_set_atualizado BEFORE UPDATE ON public.form_secoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();
CREATE TRIGGER form_perguntas_set_atualizado BEFORE UPDATE ON public.form_perguntas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();
CREATE TRIGGER form_respostas_set_atualizado BEFORE UPDATE ON public.form_respostas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

CREATE OR REPLACE FUNCTION public.tg_form_contabiliza_resposta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.form_formularios
     SET total_respostas = total_respostas + 1,
         ultima_resposta_em = NEW.enviado_em
   WHERE id = NEW.formulario_id;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_form_contabiliza_resposta() FROM anon, authenticated;

CREATE TRIGGER form_respostas_contabiliza AFTER INSERT ON public.form_respostas
  FOR EACH ROW EXECUTE FUNCTION public.tg_form_contabiliza_resposta();