import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { primeiroNome } from "@/lib/nome";
import { MSG_CHECKIN_QUINZENAL_PADRAO } from "./mensagens-fixas";

/* ----------------------------------------------------------------- */
/*  Motor de automações MPTEAM — lógica pura (sem createServerFn)    */
/*  Chamada pelos serverFns autenticados e pelos hooks públicos.     */
/* ----------------------------------------------------------------- */

function onlyDigits(s: string | null | undefined) {
  return (s || "").replace(/\D/g, "");
}

async function getConfigMap(chaves: string[]): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin
    .from("workflow_config")
    .select("chave, valor")
    .in("chave", chaves);
  const out: Record<string, string> = {};
  (data ?? []).forEach((r) => { out[r.chave] = r.valor ?? ""; });
  return out;
}

async function getVariantesMap(chaves: string[]): Promise<Record<string, string[]>> {
  const { data } = await supabaseAdmin
    .from("mensagens_variantes")
    .select("chave, texto, ativo")
    .in("chave", chaves)
    .eq("ativo", true);
  const out: Record<string, string[]> = {};
  (data ?? []).forEach((r) => {
    if (!r.texto || !r.texto.trim()) return;
    (out[r.chave] ||= []).push(r.texto);
  });
  return out;
}

function pickVariante(
  chave: string,
  cfg: Record<string, string>,
  variantes: Record<string, string[]>,
): string {
  const lista = variantes[chave];
  if (lista && lista.length > 0) {
    return lista[Math.floor(Math.random() * lista.length)];
  }
  return cfg[chave] || "";
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_m, k) => vars[k] ?? `{${k}}`);
}

async function sendZapi(phone: string, message: string): Promise<{ ok: boolean; error: string | null }> {
  const instance = process.env.ZAPI_INSTANCE_ID || process.env.ZAPI_INSTANCE;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instance || !token || !clientToken) return { ok: false, error: "Z-API não configurada" };
  const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone, message }),
    });
    if (!r.ok) return { ok: false, error: `Z-API ${r.status}: ${(await r.text()).slice(0, 200)}` };
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha Z-API" };
  }
}

async function gerarTextoIA(promptTipo: string, nomeAluno: string): Promise<{ mensagem: string | null; error: string | null }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { mensagem: null, error: "LOVABLE_API_KEY ausente" };
  const { data: promptRow } = await supabaseAdmin
    .from("prompts_ia")
    .select("prompt_sistema")
    .eq("tipo", promptTipo as any)
    .maybeSingle();
  const rawPrompt = promptRow?.prompt_sistema?.trim()
    || `Você escreve mensagens curtas e motivadoras para alunos de consultoria. Seja direto e caloroso.`;
  const nomeCurto = primeiroNome(nomeAluno);
  const vars: Record<string, string> = { nome_aluno: nomeCurto };
  const sys = rawPrompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`)
    + "\n\nIMPORTANTE: Escreva a mensagem final pronta para envio. NÃO use placeholders entre chaves ou colchetes. Se faltar dado, reescreva a frase de forma genérica.";
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Gere a mensagem de WhatsApp para ${nomeCurto}.` },
        ],
        max_tokens: 1200,
      }),
    });
    if (!r.ok) {
      if (r.status === 402) return { mensagem: null, error: "Créditos de IA esgotados." };
      if (r.status === 429) return { mensagem: null, error: "Muitas requisições à IA. Tente novamente em instantes." };
      return { mensagem: null, error: `IA indisponível (${r.status})` };
    }
    const j = await r.json();
    const m = j?.choices?.[0]?.message?.content?.trim() ?? "";
    return m ? { mensagem: m, error: null } : { mensagem: null, error: "IA vazia" };
  } catch (e) {
    return { mensagem: null, error: e instanceof Error ? e.message : "Falha IA" };
  }
}

export async function gerarRespostaFeedbackIA(
  alunoId: string,
  tipoForm: "feedback_quinzenal" | "feedback_mensal",
  formularioId?: string | null,
): Promise<{ mensagem: string | null; error: string | null }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return { mensagem: null, error: "LOVABLE_API_KEY ausente" };
  let form: { id: string; dados_resposta: any } | null = null;
  if (formularioId) {
    const { data } = await supabaseAdmin
      .from("formularios")
      .select("id, dados_resposta")
      .eq("id", formularioId)
      .maybeSingle();
    form = (data as any) ?? null;
  }
  if (!form?.dados_resposta) {
    const { data } = await supabaseAdmin
      .from("formularios")
      .select("id, dados_resposta")
      .eq("aluno_id", alunoId)
      .eq("tipo", tipoForm as any)
      .eq("respondido", true)
      .order("respondido_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    form = (data as any) ?? null;
  }
  if (!form?.dados_resposta) return { mensagem: null, error: "Sem formulário respondido" };

  const { data: aluno } = await supabaseAdmin.from("alunos").select("nome").eq("id", alunoId).maybeSingle();
  const { data: promptRow } = await supabaseAdmin
    .from("prompts_ia")
    .select("prompt_sistema")
    .eq("tipo", tipoForm as any)
    .maybeSingle();
  const raw = promptRow?.prompt_sistema?.trim()
    || "Você é um Customer Success que responde feedbacks de aluno. Seja claro, objetivo e firme.";
  const respostas = JSON.stringify(form.dados_resposta, null, 2);
  const nomeCurto = primeiroNome(aluno?.nome) || "aluno";
  const vars: Record<string, string> = { nome_aluno: nomeCurto, respostas };
  const sys = raw.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`)
    + "\n\nIMPORTANTE: Mensagem final pronta para WhatsApp. Não use placeholders.";
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: `Nome do aluno: ${nomeCurto}\n\nRespostas:\n${respostas}` },
        ],
        max_tokens: 2400,
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error("Lovable AI feedback error", r.status, txt.slice(0, 300));
      if (r.status === 402) return { mensagem: null, error: "Créditos de IA esgotados." };
      if (r.status === 429) return { mensagem: null, error: "Muitas requisições à IA. Tente novamente em instantes." };
      return { mensagem: null, error: `IA indisponível (${r.status})` };
    }
    const j = await r.json();
    const m = j?.choices?.[0]?.message?.content?.trim() ?? "";
    return m ? { mensagem: m, error: null } : { mensagem: null, error: "IA vazia" };
  } catch (e) {
    return { mensagem: null, error: e instanceof Error ? e.message : "Falha IA" };
  }
}

type JobRow = {
  id: string;
  aluno_id: string | null;
  tipo: string;
  agendado_para: string;
  tentativas: number;
  formulario_id?: string | null;
};

async function processarJob(
  job: JobRow,
  cfg: Record<string, string>,
  variantes: Record<string, string[]> = {},
): Promise<{ ok: boolean; error: string | null; mensagem?: string }> {
  if (!job.aluno_id) return { ok: false, error: "Job sem aluno_id" };

  const { data: aluno } = await supabaseAdmin
    .from("alunos")
    .select("id, nome, whatsapp, status, modalidade")
    .eq("id", job.aluno_id)
    .maybeSingle();
  if (!aluno) return { ok: false, error: "Aluno não encontrado" };

  // Notificação ao admin sobre novo aluno: o destino é fixo (Manu),
  // não depende do whatsapp do aluno. Tratada antes das demais regras.
  if (job.tipo === "novo_aluno_admin") {
    const adminPhone = "5581971161234";
    const base = (cfg["APP_BASE_URL"] || "https://mpteam-crm.lovable.app").replace(/\/$/, "");
    const link = `${base}/alunos/${aluno.id}`;
    const mensagemAdmin =
      `🆕 Novo aluno cadastrado: *${aluno.nome}*.\n\n` +
      `Atualize o plano por aqui:\n${link}`;
    const sendAdmin = await sendZapi(adminPhone, mensagemAdmin);
    await supabaseAdmin.from("mensagens_log").insert({
      aluno_id: aluno.id,
      tipo_job: job.tipo,
      mensagem_enviada: mensagemAdmin,
      whatsapp_destino: adminPhone,
      status_envio: sendAdmin.ok ? "enviado" : "erro",
      erro_detalhe: sendAdmin.error,
    });
    return { ok: sendAdmin.ok, error: sendAdmin.error, mensagem: mensagemAdmin };
  }

  const phone = onlyDigits(aluno.whatsapp);
  if (phone.length < 10) return { ok: false, error: "WhatsApp inválido" };

  // Inativos/vencidos/cancelados nunca recebem feedbacks ou follow-ups.
  const tiposBloqueadosSeInativo = new Set([
    "feedback_quinzenal_link",
    "feedback_mensal_link",
    "feedback_link_lembrete",
    "feedback_quinzenal_resposta",
    "feedback_mensal_resposta",
    "pos_feedback_mensal",
    "followup_d7",
    "followup_d21",
  ]);
  if (tiposBloqueadosSeInativo.has(job.tipo) && (aluno as any).status !== "ativo") {
    return { ok: false, error: `Aluno não está ativo (status=${(aluno as any).status}) — job cancelado` };
  }

  // MP Presencial recebe todos os tipos de automação (liberado).

  // Dedupe: nunca enviar o MESMO tipo de mensagem ao MESMO aluno duas vezes
  // dentro de uma janela curta. Evita reenvio repetitivo quando há jobs
  // duplicados em jobs_disparos ou quando o motor reprocessa por engano.
  const janelaDedupeHoras: Record<string, number> = {
    feedback_quinzenal_link: 10 * 24,
    feedback_mensal_link: 20 * 24,
    feedback_link_lembrete: 24,
    feedback_quinzenal_resposta: 24,
    feedback_mensal_resposta: 24,
    pos_feedback_mensal: 20 * 24,
    pos_entrega_d1: 24,
    followup_d7: 48,
    followup_d21: 48,
    anamnese_confirmacao: 24,
    aniversario: 20 * 24,
  };
  const horasDedupe = janelaDedupeHoras[job.tipo];
  if (typeof horasDedupe === "number" && horasDedupe > 0) {
    const since = new Date(Date.now() - horasDedupe * 3600_000).toISOString();
    const { data: jaEnviado } = await supabaseAdmin
      .from("mensagens_log")
      .select("id")
      .eq("aluno_id", aluno.id)
      .eq("tipo_job", job.tipo)
      .eq("status_envio", "enviado")
      .gte("enviado_em", since)
      .limit(1)
      .maybeSingle();
    if (jaEnviado) {
      return { ok: false, error: `Dedupe: já enviado ${job.tipo} para este aluno nas últimas ${horasDedupe}h — job ignorado` };
    }
  }

  // Dedupe forte para devolutivas: nunca enviar mais de UMA devolutiva por
  // formulário respondido. Se já existe qualquer envio bem-sucedido para o
  // mesmo aluno/tipo após a data de resposta deste formulário, ignora.
  if (job.tipo === "feedback_quinzenal_resposta" || job.tipo === "feedback_mensal_resposta") {
    const tipoForm = job.tipo === "feedback_quinzenal_resposta" ? "feedback_quinzenal" : "feedback_mensal";
    let respondidoEm: string | null = null;
    if (job.formulario_id) {
      const { data: f } = await supabaseAdmin
        .from("formularios")
        .select("respondido_em")
        .eq("id", job.formulario_id)
        .maybeSingle();
      respondidoEm = (f as any)?.respondido_em ?? null;
    }
    if (!respondidoEm) {
      const { data: f } = await supabaseAdmin
        .from("formularios")
        .select("respondido_em")
        .eq("aluno_id", aluno.id)
        .eq("tipo", tipoForm as any)
        .eq("respondido", true)
        .order("respondido_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      respondidoEm = (f as any)?.respondido_em ?? null;
    }
    if (respondidoEm) {
      const { data: jaResp } = await supabaseAdmin
        .from("mensagens_log")
        .select("id")
        .eq("aluno_id", aluno.id)
        .eq("tipo_job", job.tipo)
        .eq("status_envio", "enviado")
        .gte("enviado_em", respondidoEm)
        .limit(1)
        .maybeSingle();
      if (jaResp) {
        return { ok: false, error: "Dedupe: devolutiva deste formulário já foi enviada — job ignorado" };
      }
    }
  }

  let mensagem = "";
  switch (job.tipo) {
    case "anamnese_confirmacao": {
      const tpl = pickVariante("MSG_CONFIRMACAO_ANAMNESE", cfg, variantes);
      mensagem = renderTemplate(tpl, { nome: primeiroNome(aluno.nome) });
      break;
    }
    case "feedback_quinzenal_link": {
      // Check-in quinzenal: mensagem de acompanhamento, SEM formulário/link.
      const tplCfg = cfg["MSG_CHECKIN_QUINZENAL"] || "";
      const tpl = tplCfg.trim().length > 0 ? tplCfg : MSG_CHECKIN_QUINZENAL_PADRAO;
      mensagem = renderTemplate(tpl, { nome: primeiroNome(aluno.nome) });
      break;
    }
    case "feedback_mensal_link": {
      const tpl = pickVariante("MSG_LINK_MENSAL", cfg, variantes);
      mensagem = renderTemplate(tpl, { nome: primeiroNome(aluno.nome), link: cfg["FORM_URL_MENSAL"] || "" });
      break;
    }
    case "pos_feedback_mensal": {
      const tpl = pickVariante("MSG_POS_FEEDBACK_MENSAL", cfg, variantes);
      const prazoMsg = renderTemplate(tpl, { nome: primeiroNome(aluno.nome) });
      // Gera devolutiva IA do feedback mensal e prepende ao prazo, para que
      // quando este job é roteado ao grupo, a devolutiva também apareça lá.
      const ia = await gerarRespostaFeedbackIA(aluno.id, "feedback_mensal");
      mensagem = ia.mensagem
        ? `${ia.mensagem}\n\n━━━━━━━━━━━━━━━\n\n${prazoMsg}`
        : prazoMsg;
      break;
    }
    case "pos_entrega_d1": {
      const tpl = pickVariante("MSG_POS_ENTREGA_D1", cfg, variantes);
      mensagem = renderTemplate(tpl, { nome: primeiroNome(aluno.nome) });
      break;
    }
    case "feedback_link_lembrete": {
      let link = "";
      let tipoForm: string | null = null;
      if (job.formulario_id) {
        const { data: f } = await supabaseAdmin
          .from("formularios")
          .select("id, tipo, token, link_publico, respondido")
          .eq("id", job.formulario_id)
          .maybeSingle();
        if (!f) return { ok: false, error: "Formulário do lembrete não encontrado" };
        if (f.respondido) return { ok: false, error: "Formulário já respondido — lembrete cancelado" };
        tipoForm = f.tipo;
        link = f.link_publico
          || (cfg["APP_BASE_URL"] ? `${cfg["APP_BASE_URL"].replace(/\/$/, "")}/formularios/${f.token}` : `/formularios/${f.token}`);
      } else {
        link = cfg["FORM_URL_QUINZENAL"] || cfg["FORM_URL_MENSAL"] || "";
      }
      const tplCfg = cfg["MSG_LEMBRETE_FEEDBACK"] || "";
      const tpl = tplCfg.trim().length > 0
        ? tplCfg
        : "Fala, {nome}! Tudo certo?\n\nSeu feedback ainda está pendente.\nPreenche por aqui para a gente conseguir acompanhar sua evolução e ajustar o que for necessário:\n\n{link_feedback}";
      mensagem = renderTemplate(tpl, {
        nome: primeiroNome(aluno.nome),
        link_feedback: link,
        link,
        tipo: tipoForm ?? "feedback",
      });
      break;
    }
    case "aniversario": {
      const tpl = cfg["MSG_ANIVERSARIO"] || "";
      mensagem = renderTemplate(tpl, { nome: primeiroNome(aluno.nome) });
      break;
    }
    case "followup_d7":
    case "followup_d21": {
      const r = await gerarTextoIA(job.tipo, aluno.nome);
      if (!r.mensagem) return { ok: false, error: r.error };
      mensagem = r.mensagem;
      break;
    }
    case "feedback_quinzenal_resposta":
      // Quinzenal não tem mais formulário: nada é gerado automaticamente.
      return { ok: false, error: "Feedback quinzenal não gera devolutiva automática — job encerrado" };
    case "feedback_mensal_resposta": {
      const r = await gerarRespostaFeedbackIA(aluno.id, "feedback_mensal");
      if (!r.mensagem) return { ok: false, error: r.error };
      mensagem = r.mensagem;
      break;
    }
    default:
      return { ok: false, error: `Tipo de job não suportado pelo motor: ${job.tipo}` };
  }

  if (!mensagem.trim()) return { ok: false, error: "Mensagem vazia" };

  const send = await sendZapi(phone, mensagem);

  await supabaseAdmin.from("mensagens_log").insert({
    aluno_id: aluno.id,
    tipo_job: job.tipo,
    mensagem_enviada: mensagem,
    whatsapp_destino: phone,
    status_envio: send.ok ? "enviado" : "erro",
    erro_detalhe: send.error,
  });

  const tiposNotificaveis = new Set([
    "feedback_quinzenal_link",
    "feedback_mensal_link",
    "feedback_link_lembrete",
    "feedback_quinzenal_resposta",
    "feedback_mensal_resposta",
    "followup_d7",
    "followup_d21",
  ]);
  if (tiposNotificaveis.has(job.tipo)) {
    try {
      const { dispararSnapshotRespostasFeedbacks } = await import("./notificacoes-feedbacks.server");
      await dispararSnapshotRespostasFeedbacks(`motor:${job.tipo}`);
    } catch (e) {
      console.error("[motor] falha ao disparar snapshot respostas_feedbacks:", e);
    }
  }

  return { ok: send.ok, error: send.error, mensagem };
}

/**
 * Lógica pura do motor — executa um ciclo, respeitando MOTOR_ATIVO.
 */
export async function runMotorAutomacoesImpl(opts: { force?: boolean } = {}) {
  const force = opts.force === true;

  // Janela permitida: seg–sex, 8h–20h (America/Sao_Paulo). Disparo manual
  // (dispararJobsAgoraImpl) ignora essa janela.
  if (!force) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit", hour12: false, weekday: "short",
    }).formatToParts(new Date());
    const hora = parseInt(fmt.find((p) => p.type === "hour")?.value ?? "0", 10);
    const diaCurto = fmt.find((p) => p.type === "weekday")?.value ?? "";
    const diasUteis = new Set(["Mon", "Tue", "Wed", "Thu", "Fri"]);
    if (!diasUteis.has(diaCurto) || hora < 8 || hora >= 20) {
      return { skipped: true, reason: `Fora da janela (seg–sex 8h–20h BRT) — ${diaCurto} ${hora}h`, processados: 0 };
    }
  }

  const cfg = await getConfigMap([
    "MOTOR_ATIVO",
    "MSG_CONFIRMACAO_ANAMNESE",
    "MSG_LINK_QUINZENAL",
    "MSG_LINK_MENSAL",
    "MSG_POS_FEEDBACK_MENSAL",
    "MSG_POS_ENTREGA_D1",
    "MSG_ANIVERSARIO",
    "FORM_URL_QUINZENAL",
    "FORM_URL_MENSAL",
    "MSG_LEMBRETE_FEEDBACK",
    "APP_BASE_URL",
  ]);
  const ativo = (cfg["MOTOR_ATIVO"] ?? "false").toLowerCase() === "true";
  if (!ativo && !force) return { skipped: true, reason: "MOTOR_ATIVO=false", processados: 0 };

  const variantes = await getVariantesMap([
    "MSG_CONFIRMACAO_ANAMNESE",
    "MSG_LINK_QUINZENAL",
    "MSG_LINK_MENSAL",
    "MSG_POS_FEEDBACK_MENSAL",
    "MSG_POS_ENTREGA_D1",
  ]);

  const { data: jobs } = await supabaseAdmin
    .from("jobs_disparos")
    .select("id, aluno_id, tipo, agendado_para, tentativas, formulario_id")
    .eq("executado", false)
    .lte("agendado_para", new Date().toISOString())
    .order("agendado_para", { ascending: true })
    .limit(50);

  const prioridade: Record<string, number> = {
    feedback_quinzenal_resposta: 1,
    feedback_mensal_resposta: 1,
    pos_feedback_mensal: 1,
    followup_d7: 2,
    followup_d21: 2,
    feedback_quinzenal_link: 3,
    feedback_mensal_link: 3,
  };
  const listaOrdenada = [...((jobs ?? []) as JobRow[])].sort((a, b) => {
    const pa = prioridade[a.tipo] ?? 9;
    const pb = prioridade[b.tipo] ?? 9;
    if (pa !== pb) return pa - pb;
    return a.agendado_para.localeCompare(b.agendado_para);
  });

  let ok = 0; let fail = 0;
  for (const j of listaOrdenada) {
    try {
      const r = await processarJob(j, cfg, variantes);
      if (r.ok) {
        await supabaseAdmin.from("jobs_disparos")
          .update({ executado: true, executado_em: new Date().toISOString(), erro: null, tentativas: (j.tentativas ?? 0) + 1 })
          .eq("id", j.id);
        ok++;
      } else {
        const msg = r.error ?? "Falha desconhecida";
        const terminal = /job cancelado|não suportado|Tipo de job não suportado/i.test(msg);
        await supabaseAdmin.from("jobs_disparos")
          .update({
            erro: msg,
            tentativas: (j.tentativas ?? 0) + 1,
            ...(terminal ? { executado: true, executado_em: new Date().toISOString() } : {}),
          })
          .eq("id", j.id);
        fail++;
      }
    } catch (e) {
      await supabaseAdmin.from("jobs_disparos")
        .update({ erro: e instanceof Error ? e.message : "Exceção", tentativas: (j.tentativas ?? 0) + 1 })
        .eq("id", j.id);
      fail++;
    }
  }

  return { skipped: false, processados: (jobs ?? []).length, ok, fail };
}

/**
 * Dispara jobs específicos AGORA. Ignora MOTOR_ATIVO (uso manual via UI).
 */
export async function dispararJobsAgoraImpl(opts: { ids: string[]; intervaloMs?: number; intervaloMinMs?: number; intervaloMaxMs?: number }) {
  const ids = Array.isArray(opts?.ids) ? opts.ids.filter((x) => typeof x === "string") : [];
  const minMs = typeof opts?.intervaloMinMs === "number" && opts.intervaloMinMs >= 0 ? opts.intervaloMinMs : null;
  const maxMs = typeof opts?.intervaloMaxMs === "number" && opts.intervaloMaxMs >= 0 ? opts.intervaloMaxMs : null;
  const intervaloFixoMs = typeof opts?.intervaloMs === "number" && opts.intervaloMs >= 0 ? opts.intervaloMs : 10_000;
  if (ids.length === 0) return { processados: 0, ok: 0, fail: 0, detalhes: [] as Array<{ id: string; ok: boolean; error: string | null }> };

  const cfg = await getConfigMap([
    "MSG_CONFIRMACAO_ANAMNESE",
    "MSG_LINK_QUINZENAL",
    "MSG_LINK_MENSAL",
    "MSG_POS_FEEDBACK_MENSAL",
    "MSG_POS_ENTREGA_D1",
    "MSG_ANIVERSARIO",
    "FORM_URL_QUINZENAL",
    "FORM_URL_MENSAL",
    "MSG_LEMBRETE_FEEDBACK",
    "APP_BASE_URL",
  ]);
  const variantes = await getVariantesMap([
    "MSG_CONFIRMACAO_ANAMNESE",
    "MSG_LINK_QUINZENAL",
    "MSG_LINK_MENSAL",
    "MSG_POS_FEEDBACK_MENSAL",
    "MSG_POS_ENTREGA_D1",
  ]);

  const { data: jobs } = await supabaseAdmin
    .from("jobs_disparos")
    .select("id, aluno_id, tipo, agendado_para, tentativas, formulario_id")
    .in("id", ids)
    .eq("executado", false);

  let ok = 0; let fail = 0;
  const detalhes: Array<{ id: string; ok: boolean; error: string | null }> = [];
  const lista = (jobs ?? []) as JobRow[];
  for (let i = 0; i < lista.length; i++) {
    const j = lista[i];
    if (i > 0) {
      let wait = intervaloFixoMs;
      if (minMs !== null && maxMs !== null && maxMs >= minMs) {
        wait = Math.floor(minMs + Math.random() * (maxMs - minMs + 1));
      }
      if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    }
    try {
      const r = await processarJob(j, cfg, variantes);
      if (r.ok) {
        await supabaseAdmin.from("jobs_disparos")
          .update({ executado: true, executado_em: new Date().toISOString(), erro: null, tentativas: (j.tentativas ?? 0) + 1 })
          .eq("id", j.id);
        ok++;
        detalhes.push({ id: j.id, ok: true, error: null });
      } else {
        await supabaseAdmin.from("jobs_disparos")
          .update({ erro: r.error ?? "Falha desconhecida", tentativas: (j.tentativas ?? 0) + 1 })
          .eq("id", j.id);
        fail++;
        detalhes.push({ id: j.id, ok: false, error: r.error ?? "Falha desconhecida" });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Exceção";
      await supabaseAdmin.from("jobs_disparos")
        .update({ erro: msg, tentativas: (j.tentativas ?? 0) + 1 })
        .eq("id", j.id);
      fail++;
      detalhes.push({ id: j.id, ok: false, error: msg });
    }
  }

  return { processados: lista.length, ok, fail, detalhes };
}