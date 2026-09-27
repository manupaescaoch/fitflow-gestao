-- Base de permissões para uma instalação NOVA. Aplicar após 20260101000000.
-- As funções SECURITY DEFINER usam search_path fixo e não expõem tabelas
-- sensíveis a usuários anônimos.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.usuarios_crm
    WHERE id = _user_id AND ativo = true AND perfil = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_crm_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.usuarios_crm
    WHERE id = _user_id AND ativo = true);
$$;

CREATE OR REPLACE FUNCTION public.is_equipe_or_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.usuarios_crm
    WHERE id = _user_id AND ativo = true AND perfil IN ('admin', 'equipe'));
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role),
  public.is_admin(uuid), public.is_crm_user(uuid),
  public.is_equipe_or_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role),
  public.is_admin(uuid), public.is_crm_user(uuid),
  public.is_equipe_or_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.normalizar_telefone_br(_telefone text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN length(d) > 11 AND left(d, 2) = '55' THEN substr(d, 3)
    ELSE d END
  FROM (SELECT regexp_replace(coalesce(_telefone, ''), '[^0-9]', '', 'g') AS d) s;
$$;

CREATE OR REPLACE FUNCTION public.buscar_aluno_por_telefone(_telefone text)
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.nome FROM public.alunos a
  WHERE public.normalizar_telefone_br(a.whatsapp) = public.normalizar_telefone_br(_telefone)
  ORDER BY a.criado_em LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.buscar_aluno_por_telefone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_aluno_por_telefone(text) TO service_role;

-- Leitura de CRM. Senhas e códigos de acesso continuam exclusivos do servidor.
DO $$ DECLARE tab text; BEGIN
  FOR tab IN SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('alunos_acesso', 'formulario_verificacoes',
        'usuarios_crm', 'workflow_config')
  LOOP
    EXECUTE format('CREATE POLICY crm_read ON public.%I FOR SELECT TO authenticated USING (public.is_crm_user(auth.uid()))', tab);
    EXECUTE format('CREATE POLICY crm_write ON public.%I FOR ALL TO authenticated USING (public.is_equipe_or_admin(auth.uid())) WITH CHECK (public.is_equipe_or_admin(auth.uid()))', tab);
  END LOOP;
END $$;

CREATE POLICY usuarios_self_read ON public.usuarios_crm
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY usuarios_admin_write ON public.usuarios_crm
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- workflow_config inclui credenciais de serviços em `valor`.
CREATE POLICY workflow_config_admin_only ON public.workflow_config
  FOR ALL TO authenticated USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Restringir tabelas privadas mesmo quando um grant padrão exista.
REVOKE ALL ON public.alunos_acesso FROM anon, authenticated;
GRANT ALL ON public.alunos_acesso TO service_role;
