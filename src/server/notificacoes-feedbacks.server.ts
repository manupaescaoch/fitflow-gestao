import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DestinoTipo = "telefone" | "grupo";

export type RespostasFeedbacksConfig = {
  ativo: boolean;
  destinoTipo: DestinoTipo;
  destinoValor: string;
};

const SECAO = "notificacoes_feedbacks";
const KEYS = {
  ativo: "RESPOSTAS_FEEDBACKS_ATIVO",
  tipo: "RESPOSTAS_FEEDBACKS_DESTINO_TIPO",
  valor: "RESPOSTAS_FEEDBACKS_DESTINO_VALOR",
} as const;

export async function lerConfigFeedbacks(): Promise<RespostasFeedbacksConfig> {
  const { data, error } = await supabaseAdmin
    .from("workflow_config")
    .select("chave, valor")
    .eq("secao", SECAO);
  if (error) throw new Error(error.message);
  const map: Record<string, string | null> = {};
  (data ?? []).forEach((r: any) => { map[r.chave] = r.valor; });
  const tipo = (map[KEYS.tipo] ?? "grupo") as DestinoTipo;
  return {
    ativo: (map[KEYS.ativo] ?? "false") === "true",
    destinoTipo: tipo === "telefone" ? "telefone" : "grupo",
    destinoValor: map[KEYS.valor] ?? "",
  };
}

export async function salvarConfigFeedbacks(cfg: RespostasFeedbacksConfig, userId: string | null): Promise<void> {
  const updates: Array<{ chave: string; valor: string }> = [
    { chave: KEYS.ativo, valor: cfg.ativo ? "true" : "false" },
    { chave: KEYS.tipo, valor: cfg.destinoTipo },
    { chave: KEYS.valor, valor: cfg.destinoValor },
  ];
  for (const u of updates) {
    const { error } = await supabaseAdmin
      .from("workflow_config")
      .update({ valor: u.valor, atualizado_por: userId ?? null })
      .eq("chave", u.chave)
      .eq("secao", SECAO);
    if (error) throw new Error(`Falha ao salvar ${u.chave}: ${error.message}`);
  }
}

// ---------- Janela do dia (BRT) ----------
function inicioDiaBRT(now: Date = new Date()): Date {
  // Converte para BRT, zera horas, retorna como UTC equivalente.
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  brt.setUTCHours(0, 0, 0, 0);
  // brt está em "BRT em UTC"; volta para UTC real somando 3h.
  return new Date(brt.getTime() + 3 * 60 * 60 * 1000);
}

export function horaAtualBRT(now: Date = new Date()): string {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const h = String(brt.getUTCHours()).padStart(2, "0");
  const m = String(brt.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function dataBRT(now: Date = new Date()): string {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = brt.getUTCFullYear();
  const m = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brt.getUTCDate()).padStart(2, "0");
  return `${d}/${m}/${y}`;
}

// ---------- Tipos de "entrega" considerados ----------
type TipoEntrega = "feedback_quinzenal" | "feedback_mensal" | "followup_d7" | "followup_d21";
const TIPOS_LINK: Record<string, TipoEntrega> = {
  feedback_quinzenal_link: "feedback_quinzenal",
  feedback_mensal_link: "feedback_mensal",
  followup_d7: "followup_d7",
  followup_d21: "followup_d21",
  feedback_link_lembrete: "feedback_quinzenal",
};
const TIPOS_RESPOSTA: Record<string, TipoEntrega> = {
  feedback_quinzenal_resposta: "feedback_quinzenal",
  feedback_mensal_resposta: "feedback_mensal",
};

function rotuloTipo(t: TipoEntrega): string {
  switch (t) {
    case "feedback_quinzenal": return "Feedback quinzenal";
    case "feedback_mensal": return "Feedback mensal";
    case "followup_d7": return "D+7";
    case "followup_d21": return "D+21";
  }
}

export type SnapshotItem = {
  aluno_id: string | null;
  aluno_nome: string;
  tipo: TipoEntrega;
  status: "enviado" | "erro" | "pendente";
  erro?: string | null;
  resposta?: string | null;
  formulario_id?: string | null;
};

export type SnapshotDia = {
  enviados: SnapshotItem[];   // mensagens (link/lembrete/D+x/devolutiva) enviadas hoje, agrupadas por aluno+tipo
  respondidos: SnapshotItem[]; // formulários respondidos hoje (com conteúdo da devolutiva da IA, se houver)
  pendentes: SnapshotItem[];   // formulários enviados mas ainda sem resposta
};

export async function montarSnapshotHoje(now: Date = new Date(), desde?: Date): Promise<SnapshotDia> {
  const inicio = (desde ?? inicioDiaBRT(now)).toISOString();
  const sb = supabaseAdmin;

  // 1) Mensagens enviadas/erro hoje (links, lembretes, D+x e devolutivas)
  const { data: msgs } = await sb
    .from("mensagens_log")
    .select("aluno_id, tipo_job, status_envio, erro_detalhe, mensagem_enviada, enviado_em")
    .gte("enviado_em", inicio)
    .order("enviado_em", { ascending: true });

  // 2) Formulários respondidos hoje (feedback_quinzenal/mensal)
  const { data: forms } = await sb
    .from("formularios")
    .select("id, aluno_id, tipo, respondido, respondido_em, criado_em")
    .in("tipo", ["feedback_quinzenal", "feedback_mensal"] as any)
    .gte("respondido_em", inicio);

  // 3) Formulários enviados (link disparado) ainda pendentes (criados nos últimos 14 dias)
  const cut = new Date(now.getTime() - 14 * 86400_000).toISOString();
  const { data: pend } = await sb
    .from("formularios")
    .select("id, aluno_id, tipo, respondido, criado_em")
    .in("tipo", ["feedback_quinzenal", "feedback_mensal"] as any)
    .eq("respondido", false)
    .not("aluno_id", "is", null)
    .gte("criado_em", cut);

  // Hidrata nomes
  const ids = new Set<string>();
  (msgs ?? []).forEach((m: any) => m.aluno_id && ids.add(m.aluno_id));
  (forms ?? []).forEach((f: any) => f.aluno_id && ids.add(f.aluno_id));
  (pend ?? []).forEach((f: any) => f.aluno_id && ids.add(f.aluno_id));
  const idArr = Array.from(ids);
  const nomeMap: Record<string, string> = {};
  if (idArr.length) {
    const { data: alunos } = await sb.from("alunos").select("id, nome").in("id", idArr);
    (alunos ?? []).forEach((a: any) => { nomeMap[a.id] = a.nome ?? "—"; });
  }

  // ---- Enviados (links/lembretes/D+x) ----
  const enviadosMap = new Map<string, SnapshotItem>();
  for (const m of (msgs ?? []) as any[]) {
    const tipoEnv = TIPOS_LINK[m.tipo_job];
    if (!tipoEnv) continue;
    const k = `${m.aluno_id ?? "_"}|${tipoEnv}`;
    const cur: SnapshotItem = enviadosMap.get(k) ?? {
      aluno_id: m.aluno_id ?? null,
      aluno_nome: m.aluno_id ? (nomeMap[m.aluno_id] || "—") : "—",
      tipo: tipoEnv,
      status: "pendente",
      erro: null,
    };
    if (m.status_envio === "erro") {
      cur.status = "erro";
      cur.erro = m.erro_detalhe ?? cur.erro ?? null;
    } else if (m.status_envio === "enviado" && cur.status !== "erro") {
      cur.status = "enviado";
    }
    enviadosMap.set(k, cur);
  }

  // ---- Respondidos (com devolutiva da IA enviada hoje) ----
  const respostaPorAluno = new Map<string, { mensagem: string; status: "enviado" | "erro"; erro: string | null }>();
  for (const m of (msgs ?? []) as any[]) {
    const tipoResp = TIPOS_RESPOSTA[m.tipo_job];
    if (!tipoResp || !m.aluno_id) continue;
    const k = `${m.aluno_id}|${tipoResp}`;
    respostaPorAluno.set(k, {
      mensagem: (m.mensagem_enviada ?? "").trim(),
      status: m.status_envio === "erro" ? "erro" : "enviado",
      erro: m.erro_detalhe ?? null,
    });
  }

  const respondidos: SnapshotItem[] = [];
  for (const f of (forms ?? []) as any[]) {
    if (!f.respondido) continue;
    const tipo = f.tipo as TipoEntrega;
    const k = `${f.aluno_id ?? "_"}|${tipo}`;
    const dev = respostaPorAluno.get(k);
    respondidos.push({
      aluno_id: f.aluno_id,
      aluno_nome: f.aluno_id ? (nomeMap[f.aluno_id] || "—") : "—",
      tipo,
      status: dev?.status ?? "pendente",
      erro: dev?.erro ?? null,
      resposta: dev?.mensagem ?? null,
      formulario_id: f.id ?? null,
    });
  }

  // ---- Pendentes (link enviado, sem resposta ainda) ----
  const pendentes: SnapshotItem[] = (pend ?? []).map((f: any) => ({
    aluno_id: f.aluno_id,
    aluno_nome: f.aluno_id ? (nomeMap[f.aluno_id] || "—") : "—",
    tipo: f.tipo as TipoEntrega,
    status: "pendente" as const,
  }));

  const enviados = Array.from(enviadosMap.values()).sort((a, b) => a.aluno_nome.localeCompare(b.aluno_nome, "pt-BR"));
  respondidos.sort((a, b) => a.aluno_nome.localeCompare(b.aluno_nome, "pt-BR"));
  pendentes.sort((a, b) => a.aluno_nome.localeCompare(b.aluno_nome, "pt-BR"));

  return { enviados, respondidos, pendentes };
}

function statusEmoji(s: SnapshotItem["status"]): string {
  if (s === "enviado") return "✅";
  if (s === "erro") return "❌";
  return "⏳";
}

function rotuloStatus(s: SnapshotItem["status"], aluno_id: string | null): string {
  if (s === "enviado") return "enviado";
  if (s === "erro") return "erro";
  if (!aluno_id) return "pendente de identificação";
  return "aguardando resposta";
}

function nomeAluno(it: SnapshotItem): string {
  if (!it.aluno_id || !it.aluno_nome || it.aluno_nome === "—") return "ALUNO NÃO IDENTIFICADO";
  return it.aluno_nome.toLocaleUpperCase("pt-BR");
}

function blocoAluno(it: SnapshotItem, mostrarResposta: boolean): string {
  const linhas = [`*${nomeAluno(it)}*`, `Status: ${rotuloStatus(it.status, it.aluno_id)}`];
  const temResposta = !!(it.resposta && it.resposta.trim());
  if (mostrarResposta && temResposta) {
    const link = it.formulario_id
      ? `https://mpteam-app.com/formularios/${it.formulario_id}/respostas`
      : "não disponível";
    linhas.push(`_Link da resposta:_\n${link}`);
    linhas.push(`_Resposta:_\n${it.resposta!.trim()}`);
  }
  if (it.erro) linhas.push(`Erro: ${it.erro}`);
  return linhas.join("\n");
}

function categorizar(itens: SnapshotItem[]) {
  const enviados: SnapshotItem[] = [];
  const respondidos: SnapshotItem[] = [];
  const pendentes: SnapshotItem[] = [];
  const erros: SnapshotItem[] = [];
  for (const it of itens) {
    if (it.status === "erro") erros.push(it);
    if (it.resposta && it.resposta.trim()) respondidos.push(it);
    else if (it.status === "enviado") enviados.push(it);
    else pendentes.push(it);
  }
  return { enviados, respondidos, pendentes, erros };
}

function listaCategoria(titulo: string, itens: SnapshotItem[], mostrarResposta: boolean): string {
  if (!itens.length) return "";
  const corpo = itens.map((it) => blocoAluno(it, mostrarResposta)).join("\n\n");
  return `*${titulo}* (${itens.length})\n${corpo}`;
}

function secaoTipo(tipo: TipoEntrega, snap: SnapshotDia): string {
  // Junta tudo desse tipo, deduplica por aluno (prioriza resposta > envio > pendente)
  const todos = [...snap.pendentes, ...snap.enviados, ...snap.respondidos]
    .filter((i) => i.tipo === tipo);
  const map = new Map<string, SnapshotItem>();
  todos.forEach((it) => map.set(`${it.aluno_id ?? `noid-${nomeAluno(it)}`}`, it));
  const itens = Array.from(map.values()).sort((a, b) => nomeAluno(a).localeCompare(nomeAluno(b), "pt-BR"));
  const cat = categorizar(itens);
  const mostraResp = tipo === "feedback_quinzenal" || tipo === "feedback_mensal";
  const blocos = [
    listaCategoria("Enviados", cat.enviados, false),
    listaCategoria("Respondidos", cat.respondidos, mostraResp),
    listaCategoria("Pendentes", cat.pendentes, false),
    listaCategoria("Erros", cat.erros, false),
  ].filter((b) => b.length > 0);
  const cabecalho = [
    `━━━━━━━━━━━━━━━`,
    `*${rotuloTipo(tipo).toUpperCase()}*`,
    `Resumo: ✅ ${cat.enviados.length} enviados • 💬 ${cat.respondidos.length} respondidos • ⏳ ${cat.pendentes.length} pendentes • ❌ ${cat.erros.length} erros`,
  ].join("\n");
  const corpo = blocos.length ? blocos.join("\n\n") : "Nenhum feedback encontrado.";
  return `${cabecalho}\n\n${corpo}`;
}

export function formatarSnapshot(snap: SnapshotDia, now: Date = new Date()): string {
  return formatarMensagens(snap, now).join("\n\n━━━━━━━━━━━━━━━\n\n");
}

export function formatarMensagens(snap: SnapshotDia, now: Date = new Date()): string[] {
  const data = dataBRT(now);
  const hora = horaAtualBRT(now);
  const totalEnv = snap.enviados.length;
  const totalResp = snap.respondidos.length;
  const totalPend = snap.pendentes.length;
  const totalErros = [...snap.enviados, ...snap.respondidos].filter((i) => i.status === "erro").length;
  const cabecalho =
    `*RESPOSTAS DE FEEDBACKS — PARTE {n}/3*\n` +
    `_${data} • atualizado às ${hora}_`;
  const resumoGeral =
    `*Resumo geral*\n` +
    `✅ Enviados: ${totalEnv}\n` +
    `💬 Respondidos: ${totalResp}\n` +
    `⏳ Pendentes: ${totalPend}\n` +
    `❌ Erros: ${totalErros}`;

  const msg1 = [
    cabecalho.replace("{n}", "1"),
    "",
    resumoGeral,
    "",
    secaoTipo("followup_d7", snap),
    "",
    secaoTipo("followup_d21", snap),
  ].join("\n");

  const msg2 = [
    cabecalho.replace("{n}", "2"),
    "",
    secaoTipo("feedback_quinzenal", snap),
  ].join("\n");

  const msg3 = [
    cabecalho.replace("{n}", "3"),
    "",
    secaoTipo("feedback_mensal", snap),
    "",
    `━━━━━━━━━━━━━━━`,
    `_Fim do relatório. Respostas exibidas na íntegra._`,
  ].join("\n");

  return [msg1, msg2, msg3];
}

export async function enviarMensagensFeedbacks(
  destinoTipo: DestinoTipo,
  destinoValor: string,
  mensagens: string[],
): Promise<{ ok: boolean; error: string | null; enviadas: number }> {
  let enviadas = 0;
  for (let i = 0; i < mensagens.length; i++) {
    const r = await enviarZapiFeedbacks(destinoTipo, destinoValor, mensagens[i]);
    if (!r.ok) {
      return { ok: false, error: `Falha na parte ${i + 1}: ${r.error}`, enviadas };
    }
    enviadas++;
    if (i < mensagens.length - 1) await new Promise((res) => setTimeout(res, 1200));
  }
  return { ok: true, error: null, enviadas };
}

export async function enviarZapiFeedbacks(destinoTipo: DestinoTipo, destinoValor: string, mensagem: string): Promise<{ ok: boolean; error: string | null; status?: number }> {
  const instance = process.env.ZAPI_INSTANCE_ID || process.env.ZAPI_INSTANCE;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instance || !token || !clientToken) return { ok: false, error: "Z-API não configurada" };
  const phone = destinoTipo === "telefone" ? destinoValor.replace(/\D/g, "") : destinoValor.trim();
  if (!phone) return { ok: false, error: "Destino vazio" };
  const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone, message: mensagem }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, error: `Z-API ${r.status}: ${txt.slice(0, 200)}`, status: r.status };
    }
    return { ok: true, error: null, status: r.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha Z-API" };
  }
}

/**
 * Dispara, em tempo real, o snapshot de respostas de feedbacks para o grupo configurado.
 * Não lança — falhas são apenas logadas no console para não quebrar o fluxo de origem.
 */
export async function dispararSnapshotRespostasFeedbacks(motivo: string): Promise<void> {
  try {
    const cfg = await lerConfigFeedbacks();
    if (!cfg.ativo || !cfg.destinoValor) return;
    const snap = await montarSnapshotHoje();
    if (!snap.enviados.length && !snap.respondidos.length && !snap.pendentes.length) return;
    const msgs = formatarMensagens(snap);
    const r = await enviarMensagensFeedbacks(cfg.destinoTipo, cfg.destinoValor, msgs);
    if (!r.ok) console.error(`[respostas_feedbacks] envio falhou (${motivo}):`, r.error);
  } catch (e) {
    console.error(`[respostas_feedbacks] erro inesperado (${motivo}):`, e);
  }
}