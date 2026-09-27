CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public AS $$
  SELECT public.unaccent('public.unaccent'::regdictionary, $1);
$$;

CREATE OR REPLACE FUNCTION public.recalcular_score_dia(_aluno_id uuid, _data date)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sum(score_gerado), 0) FROM public.daily_checkins
  WHERE aluno_id = _aluno_id AND data_checkin = _data;
$$;
REVOKE ALL ON FUNCTION public.recalcular_score_dia(uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_score_dia(uuid,date) TO service_role;
