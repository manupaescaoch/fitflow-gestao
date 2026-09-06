import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAuthOrCron } from "./auth-or-cron.middleware";
import { gerarLembretesFeedbackPendentesImpl } from "./feedback-lembretes-core.server";
import { enviarResumoFeedbacksPendentesGrupoImpl } from "./resumo-feedbacks-grupo.server";
import { enviarResumoDevolutivasPendentesGrupoImpl } from "./resumo-devolutivas-grupo.server";
import { enviarAguardandoEnvioParaGrupoImpl, marcarJobsEnviadosManualmenteImpl } from "./aguardando-envio-grupo.server";
import { previewMensagemJobImpl } from "./motor-preview.server";

/**
 * Feedbacks sem resposta — formulários enviados há 3+ dias, ainda pendentes,
 * de alunos ativos. Inclui status do lembrete (job feedback_link_lembrete).
 */

export type FeedbackPendente = {
  formulario_id: string;
  token: string;
  link_publico: string | null;
  tipo: string;
  enviado_em: string;
  dias_sem_resposta: number;
  aluno_id: string;
  aluno_nome: string;
  whatsapp: string;
  modalidade: string | null;
  lembrete_agendado_em: string | null;
  lembrete_enviado_em: string | null;
};

export type FeedbackAguardandoDevolutiva = {
  formulario_id: string;
  tipo: string;
  respondido_em: string;
  dias_aguardando: number;
  aluno_id: string;
  aluno_nome: string;
  whatsapp: string;
  modalidade: string | null;
  mensagem_pronta: string | null;
  mensagem_erro: string | null;
};

export type FeedbackAguardandoEnvio = {
  job_id: string;
  tipo: string;
  agendado_para: string;
  atrasado: boolean;
  aluno_id: string;
  aluno_nome: string;
  whatsapp: string;
  modalidade: string | null;
  formulario_id: string | null;
  mensagem_pronta: string | null;
  mensagem_erro: string | null;
};

const DIAS_PARA_LEMBRETE = 3;

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export const listFeedbacksSemResposta = createServerFn({ method: "GET" })
  .middleware([requireAuthOrCron])
  .handler(async () => {
  // Formulários de feedback mensal ainda não respondidos.
  // O quinzenal não tem mais formulário — virou mensagem de check-in.
  const limiteISO = new Date(Date.now() - DIAS_PARA_LEMBRETE * 86400000).toISOString();

  const { data: forms } = await supabaseAdmin
    .from("formularios")
    .select("id, aluno_id, tipo, token, link_publico, recebido_em, respondido")
    .in("tipo", ["feedback_mensal"] as any)
    .eq("respondido", false)
    .lte("recebido_em", limiteISO)
    .not("aluno_id", "is", null)
    .order("recebido_em", { ascending: false })
    .limit(300);

  const lista = forms ?? [];
  if (lista.length === 0) return { itens: [] as FeedbackPendente[] };

  const alunoIds = Array.from(new Set(lista.map((f) => f.aluno_id!).filter(Boolean)));
  const formIds = lista.map((f) => f.id);

  const [{ data: alunos }, { data: jobs }, { data: logs }] = await Promise.all([
    supabaseAdmin
      .from("alunos")
      .select("id, nome, whatsapp, modalidade, status")
      .in("id", alunoIds)
      .eq("status", "ativo"),
    supabaseAdmin
      .from("jobs_disparos")
      .select("id, formulario_id, agendado_para, executado, executado_em" as any)
      .eq("tipo", "feedback_link_lembrete" as any)
      .in("formulario_id" as any, formIds as any),
    supabaseAdmin
      .from("mensagens_log")
      .select("aluno_id, tipo_job, enviado_em, status_envio")
      .in("tipo_job", ["feedback_link_lembrete", "resumo_feedbacks_pendentes_grupo"]) 
      .in("aluno_id", alunoIds)
      .order("enviado_em", { ascending: false }),
  ]);

  const alunosMap = new Map<string, { nome: string; whatsapp: string; modalidade: string | null }>();
  (alunos ?? []).forEach((a) => alunosMap.set(a.id, { nome: a.nome, whatsapp: a.whatsapp, modalidade: a.modalidade }));

  const jobByForm = new Map<string, { agendado_para: string; executado: boolean; executado_em: string | null }>();
  ((jobs ?? []) as any[]).forEach((j) => {
    if (j.formulario_id) jobByForm.set(j.formulario_id, j);
  });

  const logByAluno = new Map<string, string>();
  const grupoByAluno = new Map<string, string>();
  (logs ?? []).forEach((l) => {
    if (!l.aluno_id) return;
    if ((l as any).status_envio === "erro") return;
    if (l.tipo_job === "feedback_link_lembrete" && !logByAluno.has(l.aluno_id)) {
      logByAluno.set(l.aluno_id, l.enviado_em);
    } else if (l.tipo_job === "resumo_feedbacks_pendentes_grupo" && !grupoByAluno.has(l.aluno_id)) {
      grupoByAluno.set(l.aluno_id, l.enviado_em);
    }
  });

  const itens: FeedbackPendente[] = [];
  for (const f of lista) {
    if (!f.aluno_id) continue;
    const a = alunosMap.get(f.aluno_id);
    if (!a) continue; // aluno não ativo
    // Já foi enviado ao grupo após o formulário chegar? remove da lista
    const enviadoGrupo = grupoByAluno.get(f.aluno_id);
    if (enviadoGrupo && new Date(enviadoGrupo).getTime() >= new Date(f.recebido_em).getTime()) {
      continue;
    }
    const job = jobByForm.get(f.id);
    itens.push({
      formulario_id: f.id,
      token: f.token,
      link_publico: f.link_publico,
      tipo: f.tipo,
      enviado_em: f.recebido_em,
      dias_sem_resposta: diasDesde(f.recebido_em),
      aluno_id: f.aluno_id,
      aluno_nome: a.nome,
      whatsapp: a.whatsapp,
      modalidade: a.modalidade,
      lembrete_agendado_em: job && !job.executado ? job.agendado_para : null,
      lembrete_enviado_em: job?.executado ? job.executado_em : (logByAluno.get(f.aluno_id) ?? null),
    });
  }

  return { itens };
});

/**
 * Cria (ou agenda imediatamente) um job feedback_link_lembrete para o formulário
 * informado. Idempotente — não duplica jobs pendentes.
 */
export const agendarLembreteFeedback = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .inputValidator((d: { formularioId: string; agendadoPara?: string | null }) => {
    if (!d?.formularioId) throw new Error("formularioId obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const { data: f } = await supabaseAdmin
      .from("formularios")
      .select("id, aluno_id, tipo, respondido")
      .eq("id", data.formularioId)
      .maybeSingle();
    if (!f) return { ok: false, error: "Formulário não encontrado" };
    if (f.respondido) return { ok: false, error: "Formulário já respondido" };
    if (!f.aluno_id) return { ok: false, error: "Formulário sem aluno" };

    // Já existe um job pendente para esse formulário?
    const { data: existente } = await supabaseAdmin
      .from("jobs_disparos")
      .select("id")
      .eq("formulario_id" as any, f.id as any)
      .eq("tipo", "feedback_link_lembrete" as any)
      .eq("executado", false)
      .maybeSingle();
    if (existente) return { ok: true, jobId: (existente as any).id, jaExistia: true };

    const agendado = data.agendadoPara ?? new Date().toISOString();
    const { data: novo, error } = await supabaseAdmin
      .from("jobs_disparos")
      .insert({
        aluno_id: f.aluno_id,
        tipo: "feedback_link_lembrete" as any,
        agendado_para: agendado,
        formulario_id: f.id,
      } as any)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, jobId: (novo as any)?.id ?? null, jaExistia: false };
  });

/**
 * Cron / hook: cria jobs feedback_link_lembrete para todos os formulários
 * elegíveis (D+3, sem resposta, aluno ativo, sem job prévio).
 */
export const gerarLembretesFeedbackPendentes = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .handler(async () => gerarLembretesFeedbackPendentesImpl());

/**
 * Envia um único resumo ao grupo configurado (bucket `feedbacks_fu`) listando
 * todos os feedbacks sem resposta há 3 dias ou mais. Não cria jobs nem envia
 * mensagem aos alunos — apenas notifica a equipe no grupo.
 */
export const enviarResumoFeedbacksPendentesGrupo = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .handler(async () => enviarResumoFeedbacksPendentesGrupoImpl());

/**
 * Envia ao grupo configurado (bucket `feedbacks_fu`) o resumo de feedbacks
 * respondidos pelos alunos que ainda aguardam devolutiva da equipe.
 */
export const enviarResumoDevolutivasPendentesGrupo = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .handler(async () => enviarResumoDevolutivasPendentesGrupoImpl());

/**
 * Envia ao grupo de Feedbacks & Follow-ups TODAS as mensagens aguardando envio
 * (FUs, links de feedback e lembretes) e marca cada job como executado.
 */
export const enviarAguardandoEnvioParaGrupo = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .inputValidator((d: { ids: string[] }) => ({
    ids: Array.isArray(d?.ids) ? d.ids.filter((x) => typeof x === "string") : [],
  }))
  .handler(async ({ data }) => enviarAguardandoEnvioParaGrupoImpl(data.ids));

/**
 * Marca jobs como enviados manualmente (clique no WhatsApp pela equipe),
 * removendo-os da fila do motor.
 */
export const marcarJobsEnviadosManualmente = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .inputValidator((d: { ids: string[] }) => ({
    ids: Array.isArray(d?.ids) ? d.ids.filter((x) => typeof x === "string") : [],
  }))
  .handler(async ({ data }) => marcarJobsEnviadosManualmenteImpl(data.ids));

/**
 * Registra que a equipe enviou manualmente (via clique no WhatsApp) a
 * devolutiva de um feedback respondido pelo aluno. Cria um registro em
 * mensagens_log para que o item saia da lista "aguardando devolutiva".
 */
export const marcarDevolutivaEnviadaManualmente = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .inputValidator((d: { formularioId: string; alunoId: string; tipo: string; mensagem?: string | null }) => {
    if (!d?.formularioId) throw new Error("formularioId obrigatório");
    if (!d?.alunoId) throw new Error("alunoId obrigatório");
    if (d?.tipo !== "feedback_mensal" && d?.tipo !== "feedback_quinzenal") {
      throw new Error("tipo inválido");
    }
    return {
      formularioId: d.formularioId,
      alunoId: d.alunoId,
      tipo: d.tipo,
      mensagem: typeof d.mensagem === "string" ? d.mensagem : null,
    };
  })
  .handler(async ({ data }) => {
    const tipoJob = data.tipo === "feedback_mensal"
      ? "feedback_mensal_resposta"
      : "feedback_quinzenal_resposta";
    const { data: aluno } = await supabaseAdmin
      .from("alunos")
      .select("whatsapp")
      .eq("id", data.alunoId)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("mensagens_log").insert({
      aluno_id: data.alunoId,
      tipo_job: tipoJob,
      mensagem_enviada: data.mensagem ?? "(enviado manualmente via WhatsApp)",
      whatsapp_destino: aluno?.whatsapp ?? null,
      status_envio: "enviado_manual",
    } as any);
    return { ok: !error, error: error?.message ?? null };
  });

/**
 * Enfileira e dispara IMEDIATAMENTE a devolutiva (feedback_*_resposta) via Z-API
 * para o WhatsApp do aluno, sem abrir wa.me. Reutiliza job pendente se existir.
 */
export const enviarDevolutivaDireto = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .inputValidator((d: { formularioId: string; alunoId: string; tipo: string }) => {
    if (!d?.formularioId) throw new Error("formularioId obrigatório");
    if (!d?.alunoId) throw new Error("alunoId obrigatório");
    if (d?.tipo !== "feedback_mensal" && d?.tipo !== "feedback_quinzenal") {
      throw new Error("tipo inválido");
    }
    return { formularioId: d.formularioId, alunoId: d.alunoId, tipo: d.tipo };
  })
  .handler(async ({ data }) => {
    const tipoJob = data.tipo === "feedback_mensal"
      ? "feedback_mensal_resposta"
      : "feedback_quinzenal_resposta";

    // Reaproveita job pendente, se houver
    const { data: existente } = await supabaseAdmin
      .from("jobs_disparos")
      .select("id")
      .eq("formulario_id" as any, data.formularioId as any)
      .eq("tipo", tipoJob as any)
      .eq("executado", false)
      .maybeSingle();

    let jobId = (existente as any)?.id as string | undefined;
    if (!jobId) {
      const { data: novo, error } = await supabaseAdmin
        .from("jobs_disparos")
        .insert({
          aluno_id: data.alunoId,
          tipo: tipoJob as any,
          agendado_para: new Date().toISOString(),
          formulario_id: data.formularioId,
        } as any)
        .select("id")
        .maybeSingle();
      if (error || !novo) return { ok: false, error: error?.message ?? "Falha ao enfileirar job" };
      jobId = (novo as any).id as string;
    }

    const { dispararJobsAgoraImpl } = await import("./motor-core.server");
    const r = await dispararJobsAgoraImpl({ ids: [jobId!], intervaloMs: 0 });
    const det = r.detalhes?.[0];
    if (det?.ok) return { ok: true as const, jobId };
    return { ok: false as const, error: det?.error ?? "Falha no envio Z-API", jobId };
  });

/**
 * Jobs de feedback (link mensal/quinzenal e lembretes) ainda não executados,
 * agendados até o fim do dia de hoje. Atrasados também entram.
 */
export const listFeedbacksAguardandoEnvio = createServerFn({ method: "GET" })
  .middleware([requireAuthOrCron])
  .handler(async () => {
    const fimHoje = new Date();
    fimHoje.setHours(23, 59, 59, 999);
    const agoraMs = Date.now();

    const { data: jobs } = await supabaseAdmin
      .from("jobs_disparos")
      .select("id, aluno_id, tipo, agendado_para, formulario_id")
      .in("tipo", [
        "feedback_mensal_link",
        "feedback_quinzenal_link",
        "feedback_link_lembrete",
        "followup_d7",
        "followup_d21",
        "pos_entrega_d1",
      ] as any)
      .eq("executado", false)
      .lte("agendado_para", fimHoje.toISOString())
      .not("aluno_id", "is", null)
      .order("agendado_para", { ascending: true })
      .limit(500);

    const lista = jobs ?? [];
    if (lista.length === 0) return { itens: [] as FeedbackAguardandoEnvio[] };

    const alunoIds = Array.from(new Set(lista.map((j) => j.aluno_id as string)));
    const { data: alunos } = await supabaseAdmin
      .from("alunos")
      .select("id, nome, whatsapp, modalidade, status")
      .in("id", alunoIds)
      .eq("status", "ativo");
    const alunosMap = new Map<string, { nome: string; whatsapp: string; modalidade: string | null }>();
    (alunos ?? []).forEach((a) => alunosMap.set(a.id, { nome: a.nome, whatsapp: a.whatsapp, modalidade: a.modalidade }));

    const itens: FeedbackAguardandoEnvio[] = [];
    for (const j of lista) {
      const a = j.aluno_id ? alunosMap.get(j.aluno_id) : null;
      if (!a) continue;
      // MP Presencial só recebe followups; bloqueia tipos de feedback link/lembrete
      const tipo = j.tipo as string;
      const isFeedbackTipo = tipo === "feedback_mensal_link" || tipo === "feedback_quinzenal_link" || tipo === "feedback_link_lembrete";
      const isPresencialBloqueado = isFeedbackTipo || tipo === "pos_entrega_d1";
      if (a.modalidade === "mp_presencial" && isPresencialBloqueado) continue;
      itens.push({
        job_id: j.id,
        tipo,
        agendado_para: j.agendado_para,
        atrasado: new Date(j.agendado_para).getTime() < agoraMs - 2 * 60 * 1000,
        aluno_id: j.aluno_id as string,
        aluno_nome: a.nome,
        whatsapp: a.whatsapp,
        modalidade: a.modalidade,
        formulario_id: (j as any).formulario_id ?? null,
        mensagem_pronta: null,
        mensagem_erro: null,
      });
    }

    await Promise.all(
      itens.map(async (it) => {
        try {
          const r = await previewMensagemJobImpl({ alunoId: it.aluno_id, tipo: it.tipo, formularioId: it.formulario_id });
          it.mensagem_pronta = r.mensagem;
          it.mensagem_erro = r.error;
        } catch (e) {
          it.mensagem_erro = e instanceof Error ? e.message : "Falha ao gerar mensagem";
        }
      }),
    );
    return { itens };
  });

/**
 * Feedbacks RESPONDIDOS pelo aluno mas que ainda não tiveram devolutiva
 * enviada pela equipe (sem mensagens_log do tipo *_resposta para o aluno
 * após o respondido_em). Janela: últimos 30 dias.
 */
export const listFeedbacksAguardandoDevolutiva = createServerFn({ method: "GET" })
  .middleware([requireAuthOrCron])
  .handler(async () => {
    const desdeISO = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data: forms } = await supabaseAdmin
      .from("formularios")
      .select("id, aluno_id, tipo, respondido, respondido_em")
      .in("tipo", ["feedback_mensal"] as any)
      .eq("respondido", true)
      .not("respondido_em", "is", null)
      .gte("respondido_em", desdeISO)
      .not("aluno_id", "is", null)
      .order("respondido_em", { ascending: false })
      .limit(300);

    const lista = forms ?? [];
    if (lista.length === 0) return { itens: [] as FeedbackAguardandoDevolutiva[] };

    const alunoIds = Array.from(new Set(lista.map((f) => f.aluno_id!).filter(Boolean)));

    const [{ data: alunos }, { data: logs }] = await Promise.all([
      supabaseAdmin
        .from("alunos")
        .select("id, nome, whatsapp, modalidade, status")
        .in("id", alunoIds)
        .eq("status", "ativo"),
      supabaseAdmin
        .from("mensagens_log")
        .select("aluno_id, tipo_job, enviado_em, status_envio")
        .in("tipo_job", [
          "feedback_quinzenal_resposta",
          "feedback_mensal_resposta",
          "resumo_devolutivas_pendentes_grupo",
        ] as any)
        .in("aluno_id", alunoIds)
        .gte("enviado_em", desdeISO),
    ]);

    const alunosMap = new Map<string, { nome: string; whatsapp: string; modalidade: string | null }>();
    (alunos ?? []).forEach((a) => alunosMap.set(a.id, { nome: a.nome, whatsapp: a.whatsapp, modalidade: a.modalidade }));

    // Mais recente envio de devolutiva por aluno+tipo
    const ultimaDev = new Map<string, string>(); // key = aluno_id|tipoFormulario
    for (const l of (logs ?? []) as any[]) {
      if (!l.aluno_id || !l.enviado_em) continue;
      if (l.status_envio === "erro") continue;
      // resumo_devolutivas_pendentes_grupo cobre ambos os tipos do aluno
      const tiposForm =
        l.tipo_job === "feedback_quinzenal_resposta"
          ? ["feedback_quinzenal"]
          : ["feedback_mensal"];
      for (const tipoForm of tiposForm) {
        const k = `${l.aluno_id}|${tipoForm}`;
        const cur = ultimaDev.get(k);
        if (!cur || new Date(l.enviado_em).getTime() > new Date(cur).getTime()) {
          ultimaDev.set(k, l.enviado_em);
        }
      }
    }

    const itens: FeedbackAguardandoDevolutiva[] = [];
    for (const f of lista) {
      if (!f.aluno_id || !f.respondido_em) continue;
      const a = alunosMap.get(f.aluno_id);
      if (!a) continue;
      const k = `${f.aluno_id}|${f.tipo}`;
      const dev = ultimaDev.get(k);
      if (dev && new Date(dev).getTime() >= new Date(f.respondido_em).getTime()) continue;
      itens.push({
        formulario_id: f.id,
        tipo: f.tipo,
        respondido_em: f.respondido_em,
        dias_aguardando: diasDesde(f.respondido_em),
        aluno_id: f.aluno_id,
        aluno_nome: a.nome,
        whatsapp: a.whatsapp,
        modalidade: a.modalidade,
        mensagem_pronta: null,
        mensagem_erro: null,
      });
    }

    return { itens };
  });

/**
 * Histórico de envios de feedback de um aluno: qual feedback foi enviado,
 * quando, por qual canal e se já foi respondido.
 */
export type HistoricoEnvioFeedback = {
  id: string;
  tipo: string;
  origem: "formulario" | "mensagem";
  enviado_em: string;
  respondido_em: string | null;
  status: string | null;
  link: string | null;
};

export const listHistoricoFeedbacksAluno = createServerFn({ method: "GET" })
  .middleware([requireAuthOrCron])
  .inputValidator((d: { alunoId: string }) => ({ alunoId: String(d.alunoId) }))
  .handler(async ({ data }) => {
    const [{ data: forms }, { data: logs }] = await Promise.all([
      supabaseAdmin
        .from("formularios")
        .select("id, tipo, recebido_em, respondido, respondido_em, link_publico")
        .eq("aluno_id", data.alunoId)
        .order("recebido_em", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("mensagens_log")
        .select("id, tipo_job, enviado_em, status_envio")
        .eq("aluno_id", data.alunoId)
        .order("enviado_em", { ascending: false })
        .limit(50),
    ]);

    const itens: HistoricoEnvioFeedback[] = [];

    for (const f of forms ?? []) {
      if (!f.recebido_em) continue;
      itens.push({
        id: `f_${f.id}`,
        tipo: f.tipo,
        origem: "formulario",
        enviado_em: f.recebido_em,
        respondido_em: f.respondido ? (f.respondido_em ?? null) : null,
        status: f.respondido ? "respondido" : "aguardando",
        link: f.link_publico ?? null,
      });
    }

    for (const l of logs ?? []) {
      const tipo = String(l.tipo_job ?? "");
      if (!tipo.includes("feedback") && !tipo.includes("followup")) continue;
      if (!l.enviado_em) continue;
      itens.push({
        id: `m_${l.id}`,
        tipo,
        origem: "mensagem",
        enviado_em: l.enviado_em,
        respondido_em: null,
        status: l.status_envio ?? null,
        link: null,
      });
    }

    itens.sort((a, b) => new Date(b.enviado_em).getTime() - new Date(a.enviado_em).getTime());
    return { itens: itens.slice(0, 40) };
  });
