-- Códigos de acesso aos formulários públicos; somente o servidor (service role)
-- pode ler ou alterar esta tabela.
CREATE TABLE IF NOT EXISTS public.formulario_verificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('feedback_mensal', 'feedback_quinzenal')),
  codigo_hash text NOT NULL,
  salt text NOT NULL,
  tentativas integer NOT NULL DEFAULT 0 CHECK (tentativas BETWEEN 0 AND 5),
  expira_em timestamptz NOT NULL,
  usado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX formulario_verificacoes_limite_idx
  ON public.formulario_verificacoes (aluno_id, criado_em DESC);

ALTER TABLE public.formulario_verificacoes ENABLE ROW LEVEL SECURITY;
