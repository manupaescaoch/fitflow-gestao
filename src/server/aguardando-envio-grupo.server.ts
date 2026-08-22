import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { lerRoteamento, enviarZapiRoteado } from "./roteamento-grupos.server";
import { previewMensagemJobImpl } from "./motor-preview.server";

const TIPO_LABEL: Record<string, string> = {
  feedback_quinzenal_link: "Link Quinzenal",
  feedback_mensal_link: "Link Mensal",
  feedback_link_lembrete: "Lembrete de Feedback",
  followup_d7: "Follow-up D7",
  followup_d21: "Follow-up D21",
  pos_entrega_d1: "Pós-entrega D+1",
};
const MOD_LABEL: Record<string, string> = {
  mpteam: "MPTEAM",
  mp_elite: "MP Elite",
  mp_presencial: "MP Presencial",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function marcarJobsExecutados(ids: string[], observacao: string) {
  if (ids.length === 0) return;
  const nowIso = new Date().toISOString();
  await supabaseAdmin
    .from("jobs_disparos")
    .update({ executado: true, executado_em: nowIso, erro: observacao } as any)
    .in("id", ids);
}

/**
 * Envia ao grupo de Feedbacks & Follow-ups uma mensagem por job aguardando envio
 * (FUs, links de feedback e lembretes do dia). Marca cada job como executado para
 * que saia da fila do motor.
 */
export async function enviarAguardandoEnvioParaGrupoImpl(ids: string[]): Promise<{
  ok: boolean; total: number; enviados: number; falhas: number; error?: string;
}> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, total: 0, enviados: 0, falhas: 0, error: "Nenhum job informado" };
  }

  const cfg = await lerRoteamento("feedbacks_fu");
  if (!cfg.ativo || !cfg.destinoValor.trim()) {
    return { ok: false, total: ids.length, enviados: 0, falhas: 0, error: "Roteamento de Feedbacks & Follow-ups não está ativo ou sem destino configurado" };
  }
  const destino = cfg.destinoValor.trim();

  const { data: jobs } = await supabaseAdmin
    .from("jobs_disparos")
    .select("id, aluno_id, tipo, agendado_para, formulario_id, executado")
    .in("id", ids);

  const pendentes = (jobs ?? []).filter((j: any) => j.aluno_id && !j.executado);
  if (pendentes.length === 0) return { ok: false, total: 0, enviados: 0, falhas: 0, error: "Nenhum job pendente" };

  const alunoIds = Array.from(new Set(pendentes.map((j: any) => j.aluno_id as string)));
  const { data: alunos } = await supabaseAdmin
    .from("alunos")
    .select("id, nome, whatsapp, modalidade")
    .in("id", alunoIds);
  const alunosMap = new Map<string, { nome: string; whatsapp: string; modalidade: string | null }>();
  (alunos ?? []).forEach((a) => alunosMap.set(a.id, { nome: a.nome, whatsapp: a.whatsapp, modalidade: a.modalidade }));

  // Cabeçalho
  const header = `📋 *Feedbacks & Follow-ups do dia* (${pendentes.length})`;
  const resHeader = await enviarZapiRoteado(cfg.destinoTipo, destino, header);
  await supabaseAdmin.from("mensagens_log").insert({
    tipo_job: "resumo_aguardando_envio_grupo",
    mensagem_enviada: header,
    whatsapp_destino: destino,
    status_envio: resHeader.ok ? "enviado" : "erro",
    erro_detalhe: resHeader.error,
  } as any);

  let enviados = 0;
  let falhas = 0;
  const idsOk: string[] = [];

  for (const j of pendentes as any[]) {
    await sleep(3000 + Math.floor(Math.random() * 2001));
    const a = alunosMap.get(j.aluno_id);
    if (!a) { falhas++; continue; }

    const prev = await previewMensagemJobImpl({
      alunoId: j.aluno_id,
      tipo: j.tipo,
      formularioId: j.formulario_id ?? null,
    });
    const msgOriginal = prev.mensagem || `(não foi possível gerar prévia: ${prev.error ?? "erro"})`;
    const mod = a.modalidade ? ` [${MOD_LABEL[a.modalidade] ?? a.modalidade}]` : "";
    const corpo = [
      `*Aluno:* ${a.nome}${mod}`,
      `*Telefone:* ${a.whatsapp || "—"}`,
      `*Tipo:* ${TIPO_LABEL[j.tipo as string] ?? j.tipo}`,
      "",
      msgOriginal,
    ].join("\n");

    const res = await enviarZapiRoteado(cfg.destinoTipo, destino, corpo);
    if (res.ok) { enviados++; idsOk.push(j.id); } else falhas++;

    await supabaseAdmin.from("mensagens_log").insert({
      aluno_id: j.aluno_id,
      tipo_job: "resumo_aguardando_envio_grupo",
      mensagem_enviada: corpo,
      whatsapp_destino: destino,
      status_envio: res.ok ? "enviado" : "erro",
      erro_detalhe: res.error,
    } as any);
  }

  // Tira da fila do motor os que foram enviados ao grupo
  await marcarJobsExecutados(idsOk, "roteado_grupo_feedbacks_fu");

  return { ok: falhas === 0, total: pendentes.length, enviados, falhas };
}

/**
 * Marca uma lista de jobs como executados manualmente (sem disparo automático).
 * Usado quando a equipe abre o WhatsApp direto com a mensagem programada — o
 * envio passa a ser feito à mão e o job deve sair da fila.
 */
export async function marcarJobsEnviadosManualmenteImpl(ids: string[]): Promise<{ ok: boolean; total: number }> {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, total: 0 };
  const { data: jobs } = await supabaseAdmin
    .from("jobs_disparos")
    .select("id, aluno_id, tipo")
    .in("id", ids)
    .eq("executado", false);

  const pendentes = (jobs ?? []) as any[];
  if (pendentes.length === 0) return { ok: true, total: 0 };

  await marcarJobsExecutados(pendentes.map((j) => j.id as string), "envio_manual_whatsapp");

  // Loga para histórico
  for (const j of pendentes) {
    await supabaseAdmin.from("mensagens_log").insert({
      aluno_id: j.aluno_id,
      tipo_job: j.tipo,
      mensagem_enviada: "(envio manual via WhatsApp pela equipe)",
      status_envio: "enviado",
      erro_detalhe: null,
    } as any);
  }

  return { ok: true, total: pendentes.length };
}