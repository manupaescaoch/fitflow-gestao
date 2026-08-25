CREATE OR REPLACE FUNCTION public.next_brt_16h(base timestamp with time zone)
RETURNS timestamp with time zone
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN (base AT TIME ZONE 'America/Sao_Paulo')::time <= '16:00:00'
      THEN ((base AT TIME ZONE 'America/Sao_Paulo')::date + time '16:00') AT TIME ZONE 'America/Sao_Paulo'
      ELSE ((base AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 day' + time '16:00') AT TIME ZONE 'America/Sao_Paulo'
    END
$function$;

REVOKE ALL ON FUNCTION public.next_brt_16h(timestamp with time zone) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.jobs_disparos_normalizar_horario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo IN (
    'anamnese_confirmacao',
    'ia_check_shape',
    'ia_feedback_quinzenal',
    'aniversario'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo = 'pos_entrega_d1' THEN
    IF NEW.agendado_para IS NOT NULL THEN
      NEW.agendado_para := public.next_brt_16h(NEW.agendado_para);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.tipo IN (
    'feedback_quinzenal_resposta',
    'feedback_mensal_resposta',
    'pos_feedback_mensal',
    'followup_d7',
    'followup_d21',
    'feedback_quinzenal_link',
    'feedback_mensal_link',
    'feedback_link_lembrete'
  ) THEN
    IF NEW.agendado_para IS NOT NULL THEN
      NEW.agendado_para := public.next_brt_business_window(NEW.agendado_para);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.agendado_para IS NOT NULL THEN
    NEW.agendado_para := public.next_brt_8am(NEW.agendado_para);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.agendar_jobs_apos_entrega(_aluno_id uuid, _d0 timestamp with time zone)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _aluno_id IS NULL OR _d0 IS NULL THEN RETURN; END IF;

  INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
  SELECT _aluno_id, 'pos_entrega_d1'::job_tipo,
         (((_d0 AT TIME ZONE 'America/Sao_Paulo')::date + interval '1 day' + time '16:00')) AT TIME ZONE 'America/Sao_Paulo'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.jobs_disparos
    WHERE aluno_id=_aluno_id AND tipo='pos_entrega_d1'::job_tipo AND executado=false
  );

  INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
  SELECT _aluno_id, 'followup_d7'::job_tipo, _d0 + interval '7 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.jobs_disparos
    WHERE aluno_id=_aluno_id AND tipo='followup_d7'::job_tipo AND executado=false
  );

  INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
  SELECT _aluno_id, 'feedback_quinzenal_link'::job_tipo, _d0 + interval '15 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.jobs_disparos
    WHERE aluno_id=_aluno_id AND tipo='feedback_quinzenal_link'::job_tipo AND executado=false
  );

  INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
  SELECT _aluno_id, 'followup_d21'::job_tipo, _d0 + interval '21 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.jobs_disparos
    WHERE aluno_id=_aluno_id AND tipo='followup_d21'::job_tipo AND executado=false
  );

  INSERT INTO public.jobs_disparos (aluno_id, tipo, agendado_para)
  SELECT _aluno_id, 'feedback_mensal_link'::job_tipo, _d0 + interval '30 days'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.jobs_disparos
    WHERE aluno_id=_aluno_id AND tipo='feedback_mensal_link'::job_tipo AND executado=false
  );
END;
$function$;

UPDATE public.jobs_disparos
SET agendado_para = ((agendado_para AT TIME ZONE 'America/Sao_Paulo')::date + time '16:00') AT TIME ZONE 'America/Sao_Paulo'
WHERE tipo = 'pos_entrega_d1'::job_tipo
  AND executado = false
  AND (agendado_para AT TIME ZONE 'America/Sao_Paulo')::time <> time '16:00';