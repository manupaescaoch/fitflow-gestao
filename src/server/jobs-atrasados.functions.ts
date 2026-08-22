import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Helpers para revisão dos jobs atrasados antes de reativar o cron motor.
 * Todas as ações exigem ação manual via UI em Configurações.
 */

type ResumoJob = {
  tipo: string;
  total: number;
  atrasados: number;
  mais_antigo: string | null;
};

/** Resumo agrupado por tipo + status atual do MOTOR_ATIVO */
export const getJobsAtrasadosResumo = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data: jobs } = await supabaseAdmin
      .from("jobs_disparos")
      .select("tipo, agendado_para")
      .eq("executado", false);

    const now = Date.now();
    const map = new Map<string, ResumoJob>();
    for (const j of jobs ?? []) {
      const cur = map.get(j.tipo) ?? { tipo: j.tipo, total: 0, atrasados: 0, mais_antigo: null };
      cur.total++;
      const ts = new Date(j.agendado_para).getTime();
      if (ts < now) cur.atrasados++;
      if (!cur.mais_antigo || ts < new Date(cur.mais_antigo).getTime()) cur.mais_antigo = j.agendado_para;
      map.set(j.tipo, cur);
    }

    const { data: cfg } = await supabaseAdmin
      .from("workflow_config")
      .select("valor")
      .eq("chave", "MOTOR_ATIVO")
      .maybeSingle();

    return {
      motor_ativo: (cfg?.valor ?? "false").toLowerCase() === "true",
      resumo: Array.from(map.values()).sort((a, b) => b.atrasados - a.atrasados),
    };
  });

/** Lista detalhada de jobs atrasados (limit 200) */
export const listarJobsAtrasados = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async () => {
    const nowIso = new Date().toISOString();
    const { data } = await supabaseAdmin
      .from("jobs_disparos")
      .select("id, aluno_id, tipo, agendado_para, tentativas")
      .eq("executado", false)
      .lte("agendado_para", nowIso)
      .order("agendado_para", { ascending: true })
      .limit(200);

    const ids = Array.from(new Set((data ?? []).map((j) => j.aluno_id).filter(Boolean) as string[]));
    const alunoMap = new Map<string, { nome: string; whatsapp: string | null }>();
    if (ids.length) {
      const { data: alunos } = await supabaseAdmin
        .from("alunos")
        .select("id, nome, whatsapp")
        .in("id", ids);
      (alunos ?? []).forEach((a) => alunoMap.set(a.id, { nome: a.nome, whatsapp: a.whatsapp }));
    }

    return (data ?? []).map((j) => ({
      ...j,
      aluno_nome: j.aluno_id ? alunoMap.get(j.aluno_id)?.nome ?? null : null,
      aluno_whatsapp: j.aluno_id ? alunoMap.get(j.aluno_id)?.whatsapp ?? null : null,
    }));
  });

/**
 * Descartar jobs atrasados há mais de N dias (marca como executado com erro).
 * Default: 3 dias.
 */
export const descartarJobsAtrasados = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: { dias?: number } | undefined) => ({
    dias: typeof data?.dias === "number" && data.dias > 0 ? data.dias : 3,
  }))
  .handler(async ({ data }) => {
    const corte = new Date(Date.now() - data.dias * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("jobs_disparos")
      .update({
        executado: true,
        executado_em: new Date().toISOString(),
        erro: `Descartado manualmente (atrasado >${data.dias}d)`,
      })
      .eq("executado", false)
      .lt("agendado_para", corte)
      .select("id");
    if (error) throw new Error(error.message);
    return { descartados: rows?.length ?? 0 };
  });

/**
 * Reagendar jobs atrasados para horário comercial (próximo slot 09–18h, dias úteis),
 * espalhando 5 minutos entre cada um.
 */
export const reagendarJobsHorarioComercial = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async () => {
    const nowIso = new Date().toISOString();
    const { data: jobs, error: errSel } = await supabaseAdmin
      .from("jobs_disparos")
      .select("id, agendado_para")
      .eq("executado", false)
      .lt("agendado_para", nowIso)
      .order("agendado_para", { ascending: true });
    if (errSel) throw new Error(errSel.message);

    let cursor = proximoSlotComercial(new Date());
    let count = 0;
    for (const j of jobs ?? []) {
      cursor = avancarSeNecessario(cursor);
      const { error } = await supabaseAdmin
        .from("jobs_disparos")
        .update({ agendado_para: cursor.toISOString() })
        .eq("id", j.id);
      if (!error) count++;
      cursor = new Date(cursor.getTime() + 5 * 60 * 1000);
    }
    return { reagendados: count };
  });

/** Liga/desliga a flag MOTOR_ATIVO (não mexe no cron do pg_cron). */
export const setMotorAtivo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: { ativo: boolean }) => ({ ativo: !!data.ativo }))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("workflow_config")
      .upsert(
        { chave: "MOTOR_ATIVO", valor: data.ativo ? "true" : "false", secao: "motor", tipo: "bool" },
        { onConflict: "chave" }
      );
    if (error) throw new Error(error.message);
    return { ativo: data.ativo };
  });

/* ---------------- Helpers de horário comercial ---------------- */

const HORA_INI = 9;
const HORA_FIM = 18;

function ehDiaUtil(d: Date) {
  const dow = d.getDay(); // 0 dom, 6 sab
  return dow >= 1 && dow <= 5;
}

function proximoSlotComercial(base: Date): Date {
  const d = new Date(base);
  if (!ehDiaUtil(d) || d.getHours() < HORA_INI) {
    while (!ehDiaUtil(d)) d.setDate(d.getDate() + 1);
    d.setHours(HORA_INI, 0, 0, 0);
    return d;
  }
  if (d.getHours() >= HORA_FIM) {
    d.setDate(d.getDate() + 1);
    while (!ehDiaUtil(d)) d.setDate(d.getDate() + 1);
    d.setHours(HORA_INI, 0, 0, 0);
  }
  return d;
}

function avancarSeNecessario(d: Date): Date {
  if (!ehDiaUtil(d) || d.getHours() < HORA_INI || d.getHours() >= HORA_FIM) {
    return proximoSlotComercial(d);
  }
  return d;
}