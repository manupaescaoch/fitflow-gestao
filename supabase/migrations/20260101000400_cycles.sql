CREATE OR REPLACE FUNCTION public.calcular_data_limite_entrega(data_base date)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d date := data_base; n integer := 0;
BEGIN
  WHILE n < 3 LOOP
    d := d + 1;
    IF EXTRACT(ISODOW FROM d) < 6 THEN n := n + 1; END IF;
  END LOOP;
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION public.next_brt_16h(base timestamptz)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT ((base AT TIME ZONE 'America/Recife')::date
    + CASE WHEN (base AT TIME ZONE 'America/Recife')::time >= time '16:00'
      THEN 1 ELSE 0 END + time '16:00') AT TIME ZONE 'America/Recife';
$$;

CREATE OR REPLACE FUNCTION public.next_brt_8am(base timestamptz)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT ((base AT TIME ZONE 'America/Recife')::date
    + CASE WHEN (base AT TIME ZONE 'America/Recife')::time >= time '08:00'
      THEN 1 ELSE 0 END + time '08:00') AT TIME ZONE 'America/Recife';
$$;

CREATE OR REPLACE FUNCTION public.next_brt_business_window(base timestamptz)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN (base AT TIME ZONE 'America/Recife')::time BETWEEN time '08:00' AND time '16:00'
    THEN base ELSE public.next_brt_8am(base) END;
$$;

CREATE OR REPLACE FUNCTION public.agendar_jobs_apos_entrega(_aluno_id uuid, _d0 timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
  SELECT _aluno_id, j.tipo::public.job_tipo, _d0 + j.dias * interval '1 day'
  FROM (VALUES ('pos_entrega_d1',1), ('followup_d7',7),
    ('feedback_quinzenal_link',15), ('followup_d21',21),
    ('feedback_mensal_link',30)) AS j(tipo,dias)
  WHERE NOT EXISTS (SELECT 1 FROM public.jobs_disparos x
    WHERE x.aluno_id = _aluno_id AND x.tipo::text = j.tipo
      AND x.agendado_para = _d0 + j.dias * interval '1 day');
END $$;

CREATE OR REPLACE FUNCTION public.trg_agendar_apos_entrega()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE instante timestamptz := COALESCE(NEW.d0_confirmado_em, now());
BEGIN
  IF NEW.d0_confirmado AND (TG_OP = 'INSERT' OR NOT OLD.d0_confirmado) THEN
    UPDATE public.alunos SET data_d0 = instante,
      data_expiracao = instante + make_interval(days => COALESCE(NULLIF(prazo_dias,0),30)::integer),
      status = 'ativo' WHERE id = NEW.aluno_id;
    PERFORM public.agendar_jobs_apos_entrega(NEW.aluno_id, instante);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER entregas_d0_agenda AFTER INSERT OR UPDATE OF d0_confirmado
  ON public.entregas_dia FOR EACH ROW EXECUTE FUNCTION public.trg_agendar_apos_entrega();

CREATE OR REPLACE FUNCTION public.agendar_ciclos_alunos_ativos()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; processados integer := 0;
BEGIN
  FOR a IN SELECT id, data_d0 FROM public.alunos
    WHERE status = 'ativo' AND data_d0 IS NOT NULL LOOP
    PERFORM public.agendar_jobs_apos_entrega(a.id, a.data_d0);
    processados := processados + 1;
  END LOOP;
  RETURN jsonb_build_object('processados', processados);
END $$;

REVOKE ALL ON FUNCTION public.agendar_jobs_apos_entrega(uuid,timestamptz),
  public.agendar_ciclos_alunos_ativos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agendar_jobs_apos_entrega(uuid,timestamptz),
  public.agendar_ciclos_alunos_ativos() TO service_role;
