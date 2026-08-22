DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_crm_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_equipe_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_aluno_dashboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rodar_cron_job(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_historico_cron_job(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_kpis_cron_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_listar_cron_jobs() TO authenticated;