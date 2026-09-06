CREATE TABLE public.permissoes_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL,
  perfil text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modulo, perfil)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_modulos TO authenticated;
GRANT ALL ON public.permissoes_modulos TO service_role;

ALTER TABLE public.permissoes_modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Apenas admins gerenciam permissoes"
  ON public.permissoes_modulos
  FOR ALL
  TO authenticated
  USING (
    public.is_crm_user(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.is_crm_user(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

INSERT INTO public.permissoes_modulos (modulo, perfil, ativo) VALUES
  ('Visão Geral', 'admin', true),
  ('Alunos', 'admin', true),
  ('Caixa de Saída', 'admin', true),
  ('Formulários', 'admin', true),
  ('Feedbacks', 'admin', true),
  ('Relatórios', 'admin', true),
  ('Financeiro', 'admin', true),
  ('Configurações', 'admin', true),

  ('Visão Geral', 'equipe', true),
  ('Alunos', 'equipe', true),
  ('Caixa de Saída', 'equipe', false),
  ('Formulários', 'equipe', true),
  ('Feedbacks', 'equipe', true),
  ('Relatórios', 'equipe', false),
  ('Financeiro', 'equipe', false),
  ('Configurações', 'equipe', false),

  ('Visão Geral', 'consultor', true),
  ('Alunos', 'consultor', true),
  ('Caixa de Saída', 'consultor', false),
  ('Formulários', 'consultor', false),
  ('Feedbacks', 'consultor', false),
  ('Relatórios', 'consultor', false),
  ('Financeiro', 'consultor', false),
  ('Configurações', 'consultor', false),

  ('Visão Geral', 'visualizador', true),
  ('Alunos', 'visualizador', true),
  ('Caixa de Saída', 'visualizador', false),
  ('Formulários', 'visualizador', false),
  ('Feedbacks', 'visualizador', false),
  ('Relatórios', 'visualizador', false),
  ('Financeiro', 'visualizador', false),
  ('Configurações', 'visualizador', false);