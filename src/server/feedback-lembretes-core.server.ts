import { supabaseAdmin } from "@/integrations/supabase/client.server";

const DIAS_PARA_LEMBRETE = 3;

/**
 * Lógica pura do gerador de lembretes — chamada tanto pelo serverFn
 * autenticado quanto pelo hook público /api/public/hooks/feedback-lembretes.
 */
export async function gerarLembretesFeedbackPendentesImpl() {
  const limiteISO = new Date(Date.now() - DIAS_PARA_LEMBRETE * 86400000).toISOString();

  const { data: forms } = await supabaseAdmin
    .from("formularios")
    .select("id, aluno_id, tipo")
    .in("tipo", ["feedback_mensal"] as any)
    .eq("respondido", false)
    .lte("recebido_em", limiteISO)
    .not("aluno_id", "is", null)
    .limit(500);

  const lista = forms ?? [];
  if (lista.length === 0) return { criados: 0, total: 0 };

  const alunoIds = Array.from(new Set(lista.map((f) => f.aluno_id!).filter(Boolean)));
  const formIds = lista.map((f) => f.id);

  const [{ data: ativos }, { data: jobs }] = await Promise.all([
    supabaseAdmin.from("alunos").select("id").in("id", alunoIds).eq("status", "ativo"),
    supabaseAdmin
      .from("jobs_disparos")
      .select("formulario_id" as any)
      .eq("tipo", "feedback_link_lembrete" as any)
      .in("formulario_id" as any, formIds as any),
  ]);

  const ativosSet = new Set((ativos ?? []).map((a) => a.id));
  const jaTemJob = new Set(((jobs ?? []) as any[]).map((j) => j.formulario_id).filter(Boolean));

  const novos = lista
    .filter((f) => f.aluno_id && ativosSet.has(f.aluno_id) && !jaTemJob.has(f.id))
    .map((f) => ({
      aluno_id: f.aluno_id!,
      tipo: "feedback_link_lembrete" as any,
      agendado_para: new Date().toISOString(),
      formulario_id: f.id,
    }));

  if (novos.length === 0) return { criados: 0, total: lista.length };

  const { error } = await supabaseAdmin.from("jobs_disparos").insert(novos as any);
  if (error) return { criados: 0, total: lista.length, error: error.message };
  return { criados: novos.length, total: lista.length };
}
