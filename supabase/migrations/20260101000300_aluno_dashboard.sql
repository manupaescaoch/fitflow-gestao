-- A área do aluno usa esta RPC apenas através do servidor com service_role.
CREATE OR REPLACE FUNCTION public.get_aluno_dashboard(_aluno_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'aluno', to_jsonb(a),
    'avaliacoes', COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.created_at DESC)
      FROM public.physical_assessments v WHERE v.student_id = a.id), '[]'::jsonb),
    'circunferencias', (SELECT to_jsonb(c) FROM public.body_circumferences c
      JOIN public.physical_assessments v ON v.id = c.assessment_id
      WHERE v.student_id = a.id ORDER BY v.created_at DESC LIMIT 1),
    'dieta', (SELECT to_jsonb(d) FROM public.dieta_planos d
      WHERE d.aluno_id = a.id ORDER BY d.atualizado_em DESC LIMIT 1),
    'checkins', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.data_checkin DESC)
      FROM public.daily_checkins c WHERE c.aluno_id = a.id), '[]'::jsonb),
    'entregas', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.data_referencia DESC)
      FROM public.entregas_dia e WHERE e.aluno_id = a.id), '[]'::jsonb),
    'feedbacks', COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.criado_em DESC)
      FROM public.formularios f WHERE f.aluno_id = a.id AND f.tipo IN
        ('feedback_quinzenal', 'feedback_mensal')), '[]'::jsonb),
    'transacoes', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.data_transacao DESC)
      FROM public.transacoes t WHERE t.aluno_id = a.id), '[]'::jsonb),
    'comunicacoes', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.criado_em DESC)
      FROM public.comunicacoes c WHERE c.aluno_id = a.id), '[]'::jsonb),
    'agua_ml_hoje', COALESCE((SELECT sum(l.ml) FROM public.aluno_agua_log l
      WHERE l.aluno_id = a.id AND l.data_referencia = CURRENT_DATE), 0),
    'atividades_hoje', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.aluno_atividades_dia x
      WHERE x.aluno_id = a.id AND x.data_referencia = CURRENT_DATE), '[]'::jsonb),
    'refeicoes_hoje', COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM public.aluno_refeicoes_log x
      WHERE x.aluno_id = a.id AND x.data_referencia = CURRENT_DATE), '[]'::jsonb)
  ) FROM public.alunos a WHERE a.id = _aluno_id;
$$;
REVOKE ALL ON FUNCTION public.get_aluno_dashboard(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_aluno_dashboard(uuid) TO service_role;
