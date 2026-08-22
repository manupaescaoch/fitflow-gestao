import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { listPendenciasImpl } from "./pendencias-core.server";

const DIA = 86400000;

export type DashboardResumo = {
  alunosAtivos: number;
  alunosPorModalidade: Array<{ label: string; total: number }>;
  novosAlunos30d: number;
  renovacoes7d: number;
  aguardandoAnamnese: number;
  emProducao: number;
  planejamentosAtrasados: number;
  planejamentosAtrasadosLista: Array<{
    aluno_id: string; aluno_nome: string; data_referencia: string;
    dias_atraso: number; falta_dieta: boolean; falta_treino: boolean;
  }>;
  feedbacksEnviados30d: number;
  feedbacksPreenchidos30d: number;
  taxaResposta: number;
  feedbacksAtrasados: number;
  feedbacksAtrasadosMensais: number;
  feedbacksAtrasadosQuinzenais: number;
  falhasEnvio7d: number;
  jobsPendentesAtrasados: number;
  atualizadoEm: string;
};

function hojeBRT(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function getDashboardResumoImpl(): Promise<DashboardResumo> {
  const agora = Date.now();
  const d30 = new Date(agora - 30 * DIA).toISOString();
  const d7 = new Date(agora - 7 * DIA).toISOString();
  const in7 = new Date(agora + 7 * DIA).toISOString();
  const nowIso = new Date(agora).toISOString();
  const hoje = hojeBRT();

  const [
    ativos,
    novos30,
    renov7,
    aguardAnam,
    producao,
    entregas,
    fbEnviados,
    fbPreenchidos,
    falhas7d,
    jobsAtrasados,
    pendencias,
  ] = await Promise.all([
    supabaseAdmin.from("alunos").select("id, modalidade").eq("status", "ativo"),
    supabaseAdmin.from("alunos").select("id", { count: "exact", head: true }).gte("criado_em", d30),
    supabaseAdmin.from("alunos").select("id", { count: "exact", head: true })
      .eq("status", "ativo").gte("data_expiracao", nowIso).lte("data_expiracao", in7),
    supabaseAdmin.from("alunos").select("id", { count: "exact", head: true }).eq("status", "aguardando_anamnese"),
    supabaseAdmin.from("alunos").select("id", { count: "exact", head: true }).eq("status", "em_producao"),
    supabaseAdmin.from("entregas_dia")
      .select("aluno_id, data_referencia, dieta_entregue, treino_entregue")
      .lt("data_referencia", hoje)
      .or("dieta_entregue.eq.false,treino_entregue.eq.false")
      .order("data_referencia", { ascending: true })
      .limit(200),
    supabaseAdmin.from("mensagens_log").select("id", { count: "exact", head: true })
      .in("tipo_job", ["feedback_mensal_link", "feedback_quinzenal_link"])
      .eq("status_envio", "enviado").gte("enviado_em", d30),
    supabaseAdmin.from("formularios").select("id", { count: "exact", head: true })
      .eq("respondido", true).in("tipo", ["feedback_mensal", "feedback_quinzenal"])
      .gte("respondido_em", d30),
    supabaseAdmin.from("mensagens_log").select("id", { count: "exact", head: true })
      .eq("status_envio", "erro").gte("enviado_em", d7),
    supabaseAdmin.from("jobs_disparos").select("id", { count: "exact", head: true })
      .eq("executado", false).lt("agendado_para", nowIso),
    listPendenciasImpl().catch(() => null),
  ]);

  const listaAtivos = ativos.data ?? [];
  const porMod = new Map<string, number>();
  for (const a of listaAtivos as Array<{ modalidade: string | null }>) {
    const k = a.modalidade ?? "sem_modalidade";
    porMod.set(k, (porMod.get(k) ?? 0) + 1);
  }

  const entregasPend = (entregas.data ?? []) as Array<{
    aluno_id: string; data_referencia: string; dieta_entregue: boolean; treino_entregue: boolean;
  }>;
  const idsEnt = Array.from(new Set(entregasPend.map((e) => e.aluno_id)));
  const nomes = new Map<string, { nome: string; status: string }>();
  if (idsEnt.length) {
    const { data: al } = await supabaseAdmin.from("alunos").select("id, nome, status").in("id", idsEnt);
    (al ?? []).forEach((a: any) => nomes.set(a.id, { nome: a.nome, status: a.status }));
  }
  const atrasadosLista = entregasPend
    .filter((e) => {
      const info = nomes.get(e.aluno_id);
      return info && info.status !== "cancelado";
    })
    .map((e) => ({
      aluno_id: e.aluno_id,
      aluno_nome: nomes.get(e.aluno_id)?.nome ?? "—",
      data_referencia: e.data_referencia,
      dias_atraso: Math.max(
        0,
        Math.floor((new Date(hoje).getTime() - new Date(e.data_referencia).getTime()) / DIA),
      ),
      falta_dieta: !e.dieta_entregue,
      falta_treino: !e.treino_entregue,
    }))
    .sort((a, b) => b.dias_atraso - a.dias_atraso);

  const enviados = fbEnviados.count ?? 0;
  const preenchidos = fbPreenchidos.count ?? 0;

  return {
    alunosAtivos: listaAtivos.length,
    alunosPorModalidade: Array.from(porMod.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total),
    novosAlunos30d: novos30.count ?? 0,
    renovacoes7d: renov7.count ?? 0,
    aguardandoAnamnese: aguardAnam.count ?? 0,
    emProducao: producao.count ?? 0,
    planejamentosAtrasados: atrasadosLista.length,
    planejamentosAtrasadosLista: atrasadosLista.slice(0, 15),
    feedbacksEnviados30d: enviados,
    feedbacksPreenchidos30d: preenchidos,
    taxaResposta: enviados > 0 ? Math.round((preenchidos / enviados) * 100) : 0,
    feedbacksAtrasados: pendencias?.indicadores.total ?? 0,
    feedbacksAtrasadosMensais: pendencias?.indicadores.mensais ?? 0,
    feedbacksAtrasadosQuinzenais: pendencias?.indicadores.quinzenais ?? 0,
    falhasEnvio7d: falhas7d.count ?? 0,
    jobsPendentesAtrasados: jobsAtrasados.count ?? 0,
    atualizadoEm: new Date().toISOString(),
  };
}
