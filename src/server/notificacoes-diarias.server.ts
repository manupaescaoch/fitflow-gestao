import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DestinoTipo = "telefone" | "grupo";

export type ResumoConfig = {
  ativo: boolean;
  horario: string; // HH:MM
  destinoTipo: DestinoTipo;
  destinoValor: string;
};

const SECAO = "notificacoes_diarias";
const KEYS = {
  ativo: "RESUMO_DIARIO_ATIVO",
  horario: "RESUMO_DIARIO_HORARIO",
  tipo: "RESUMO_DIARIO_DESTINO_TIPO",
  valor: "RESUMO_DIARIO_DESTINO_VALOR",
} as const;

export async function lerConfig(): Promise<ResumoConfig> {
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
    horario: (map[KEYS.horario] ?? "21:00").slice(0, 5),
    destinoTipo: tipo === "telefone" ? "telefone" : "grupo",
    destinoValor: map[KEYS.valor] ?? "",
  };
}

export async function salvarConfig(cfg: ResumoConfig, userId: string | null): Promise<void> {
  const updates: Array<{ chave: string; valor: string }> = [
    { chave: KEYS.ativo, valor: cfg.ativo ? "true" : "false" },
    { chave: KEYS.horario, valor: cfg.horario },
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

// Calcula a data de "amanhã" no fuso America/Sao_Paulo (offset -03:00, sem DST atualmente).
export function calcularAmanhaBRT(now: Date = new Date()): string {
  // BRT = UTC-3
  const utc = now.getTime();
  const brt = new Date(utc - 3 * 60 * 60 * 1000);
  brt.setUTCDate(brt.getUTCDate() + 1);
  const y = brt.getUTCFullYear();
  const m = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** True se `now` cai em sábado/domingo no fuso BRT (UTC-3). */
export function ehFimDeSemanaBRT(now: Date = new Date()): boolean {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const dow = brt.getUTCDay(); // 0=dom, 6=sab
  return dow === 0 || dow === 6;
}

/**
 * Próximo dia útil (seg-sex) em BRT como YYYY-MM-DD.
 * Se `now` for sexta → segunda. Se `now` for sábado → segunda. Se domingo → segunda.
 * Dia útil normal → dia seguinte.
 */
export function proximaDataUtilBRT(now: Date = new Date()): string {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  brt.setUTCDate(brt.getUTCDate() + 1);
  while (brt.getUTCDay() === 0 || brt.getUTCDay() === 6) {
    brt.setUTCDate(brt.getUTCDate() + 1);
  }
  const y = brt.getUTCFullYear();
  const m = String(brt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(brt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** True se a string YYYY-MM-DD representa sábado ou domingo. */
export function dataEhFimDeSemanaISO(iso: string): boolean {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const dow = dt.getUTCDay();
  return dow === 0 || dow === 6;
}
const dataEhFimDeSemana = dataEhFimDeSemanaISO;

export function horaAtualBRT(now: Date = new Date()): string {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const h = String(brt.getUTCHours()).padStart(2, "0");
  const m = String(brt.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export type LinhaResumo = { aluno_id: string; nome: string; rotulo: "TREINO E DIETA" | "SÓ TREINO" | "SÓ DIETA"; plano: string | null; data_referencia: string; atrasado: boolean };

export async function montarLinhasParaData(dataRef: string): Promise<LinhaResumo[]> {
  const { data: entregas, error } = await supabaseAdmin
    .from("entregas_dia")
    .select("aluno_id, dieta_entregue, treino_entregue, data_referencia")
    .lte("data_referencia", dataRef);
  if (error) throw new Error(error.message);

  const pendentes = (entregas ?? []).filter((e: any) => !e.dieta_entregue || !e.treino_entregue);
  if (!pendentes.length) return [];

  const ids = Array.from(new Set(pendentes.map((e: any) => e.aluno_id))) as string[];
  const { data: alunos } = await supabaseAdmin
    .from("alunos")
    .select("id, nome, servico_contratado, plano")
    .in("id", ids);
  const alunoMap = new Map<string, { nome: string; servico: string | null; plano: string | null }>();
  (alunos ?? []).forEach((a: any) => alunoMap.set(a.id, { nome: a.nome, servico: (a as any).servico_contratado ?? null, plano: a.plano ?? null }));

  // Agrupa por aluno: une os flags pendentes.
  type Acc = { dietaPend: boolean; treinoPend: boolean; dataMin: string };
  const acc = new Map<string, Acc>();
  for (const e of pendentes as any[]) {
    const cur = acc.get(e.aluno_id) ?? { dietaPend: false, treinoPend: false, dataMin: e.data_referencia };
    if (!e.dieta_entregue) cur.dietaPend = true;
    if (!e.treino_entregue) cur.treinoPend = true;
    if (e.data_referencia < cur.dataMin) cur.dataMin = e.data_referencia;
    acc.set(e.aluno_id, cur);
  }

  const linhas: LinhaResumo[] = [];
  for (const [alunoId, st] of acc) {
    const info = alunoMap.get(alunoId);
    if (!info) continue;
    const servico = info.servico;
    let rotulo: LinhaResumo["rotulo"];
    if (servico === "treino") rotulo = "SÓ TREINO";
    else if (servico === "dieta") rotulo = "SÓ DIETA";
    else {
      // treino_e_dieta ou null → considera o que está pendente
      if (st.dietaPend && st.treinoPend) rotulo = "TREINO E DIETA";
      else if (st.treinoPend) rotulo = "SÓ TREINO";
      else rotulo = "SÓ DIETA";
    }
    // Se a data caiu em sábado/domingo (dados legados), normaliza para a
    // próxima segunda apenas em memória — sem alterar o banco.
    const dataExibida = dataEhFimDeSemana(st.dataMin)
      ? proximaSegundaISO(st.dataMin)
      : st.dataMin;
    linhas.push({
      aluno_id: alunoId,
      nome: info.nome,
      rotulo,
      plano: info.plano,
      data_referencia: dataExibida,
      // Datas caindo em sábado/domingo são apenas reagendadas para segunda —
      // não devem aparecer como atrasadas no resumo.
      atrasado: dataExibida < dataRef,
    });
  }
  // ordem alfabética para previsibilidade
  linhas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return linhas;
}

/** Retorna YYYY-MM-DD da próxima segunda-feira ≥ dataISO. */
function proximaSegundaISO(dataISO: string): string {
  const [y, m, d] = dataISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  while (dt.getUTCDay() !== 1) dt.setUTCDate(dt.getUTCDate() + 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

const DIAS_SEMANA = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"] as const;

function tituloProximaSecao(dataRef: string, now: Date = new Date()): string {
  // "amanhã" só quando dataRef é literalmente o dia seguinte em BRT.
  const amanhaISO = (() => {
    const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    brt.setUTCDate(brt.getUTCDate() + 1);
    const y = brt.getUTCFullYear();
    const m = String(brt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(brt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  })();
  const [y, m, d] = dataRef.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  const ddmm = `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
  if (dataRef === amanhaISO) return `*ATUALIZAÇÕES DE AMANHÃ (${ddmm})*`;
  const nomeDia = DIAS_SEMANA[dt.getUTCDay()];
  return `*ATUALIZAÇÕES DE ${nomeDia} (${ddmm})*`;
}

export function formatarMensagem(linhas: LinhaResumo[], dataRef?: string): string {
  const atrasados = linhas.filter((l) => l.atrasado);
  const amanha = linhas.filter((l) => !l.atrasado);
  const total = linhas.length;
  const fmt = (l: LinhaResumo, i: number) => {
    const plano = l.plano ? ` — ${l.plano}` : "";
    const data = l.atrasado ? ` (venc. ${l.data_referencia.split("-").reverse().join("/")})` : "";
    return `${i + 1}. ${(l.nome ?? "").toLocaleUpperCase("pt-BR")}${plano} | ${l.rotulo}${data}`;
  };
  const partes: string[] = [];
  if (atrasados.length) {
    partes.push(`*⚠️ ATRASADOS*\n${atrasados.map(fmt).join("\n")}`);
  }
  if (amanha.length) {
    const titulo = dataRef ? tituloProximaSecao(dataRef) : "*ATUALIZAÇÕES DE AMANHÃ*";
    partes.push(`${titulo}\n${amanha.map(fmt).join("\n")}`);
  }
  const sufixo = `Total: ${total} ${total === 1 ? "aluno para atualizar" : "alunos para atualizar"}`;
  const horaEnvio = horaAtualBRT();
  return `*RESUMO DIÁRIO*\n_Enviado às ${horaEnvio}_\n\n${partes.join("\n\n")}\n\n${sufixo}`;
}

export async function enviarZapi(destinoTipo: DestinoTipo, destinoValor: string, mensagem: string): Promise<{ ok: boolean; error: string | null; status?: number }> {
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

export async function logResumo(params: {
  resultado: "enviado" | "sem_atualizacoes" | "desativado" | "erro" | "fora_horario" | "fim_de_semana";
  dataRef: string | null;
  detalhes: Record<string, unknown>;
}): Promise<void> {
  await supabaseAdmin.from("entregas_dia_log").insert({
    aluno_id: null,
    aluno_nome: null,
    origem: "resumo_diario",
    tipo_evento: "envio_grupo",
    data_referencia: params.dataRef,
    data_base: null,
    resultado: params.resultado,
    detalhes: params.detalhes as any,
  });
}
