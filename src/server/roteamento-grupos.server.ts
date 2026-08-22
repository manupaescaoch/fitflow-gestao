import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DestinoTipo = "telefone" | "grupo";
export type RoteamentoBucket = "feedbacks_fu" | "respostas_ia";

export type RoteamentoConfig = {
  ativo: boolean;
  destinoTipo: DestinoTipo;
  destinoValor: string;
};

type BucketMeta = {
  secao: string;
  keys: { ativo: string; tipo: string; valor: string };
  /** Tipos de job (mensagens_log.tipo_job) que este bucket intercepta. */
  tiposJob: ReadonlyArray<string>;
  /** Aceita também tipos que começam com este prefixo (case-insensitive). */
  tiposJobPrefix?: ReadonlyArray<string>;
  rotulo: string;
};

const BUCKETS: Record<RoteamentoBucket, BucketMeta> = {
  feedbacks_fu: {
    secao: "roteamento_feedbacks_fu",
    keys: {
      ativo: "ROTEAMENTO_FEEDBACKS_FU_ATIVO",
      tipo: "ROTEAMENTO_FEEDBACKS_FU_DESTINO_TIPO",
      valor: "ROTEAMENTO_FEEDBACKS_FU_DESTINO_VALOR",
    },
    // Todas as mensagens deste bucket são destinadas ao aluno e NUNCA podem
    // ser desviadas para grupo — ver TIPOS_ALUNO_DIRETO abaixo. Mantemos o
    // bucket registrado para compatibilidade da UI, sem tipos ativos.
    tiposJob: [],
    rotulo: "Feedbacks & Follow-ups",
  },
  respostas_ia: {
    secao: "roteamento_respostas_ia",
    keys: {
      ativo: "ROTEAMENTO_RESPOSTAS_IA_ATIVO",
      tipo: "ROTEAMENTO_RESPOSTAS_IA_DESTINO_TIPO",
      valor: "ROTEAMENTO_RESPOSTAS_IA_DESTINO_VALOR",
    },
    tiposJob: [],
    tiposJobPrefix: [],
    rotulo: "Respostas de Anamnese & Feedbacks",
  },
};

/**
 * Tipos de job (e prefixos) que representam mensagens ao aluno e, por regra
 * de segurança, JAMAIS podem ser redirecionadas para um grupo — mesmo que
 * uma configuração de roteamento seja reativada por engano.
 */
export const TIPOS_ALUNO_DIRETO: ReadonlyArray<string> = [
  "feedback_quinzenal_resposta",
  "feedback_mensal_resposta",
  "pos_feedback_mensal",
  "feedback_quinzenal_link",
  "feedback_mensal_link",
  "feedback_link_lembrete",
  "followup_d7",
  "followup_d21",
  "pos_entrega_d1",
  "anamnese_confirmacao",
  "anamnese_recebida",
  "ia_aprovada",
  "ia_check_shape",
  "aniversario",
  "novo_aluno_admin",
  "cobranca_renovacao",
];

export const PREFIXOS_ALUNO_DIRETO: ReadonlyArray<string> = ["resposta ia", "feedback_"];

export function deveEnviarDiretoAoAluno(tipoJob: string | null | undefined): boolean {
  if (!tipoJob) return false;
  const t = tipoJob.trim().toLowerCase();
  if (TIPOS_ALUNO_DIRETO.some((x) => x.toLowerCase() === t)) return true;
  if (PREFIXOS_ALUNO_DIRETO.some((p) => t.startsWith(p))) return true;
  return false;
}

export function bucketMeta(bucket: RoteamentoBucket): BucketMeta {
  return BUCKETS[bucket];
}

export function bucketParaTipoJob(tipoJob: string | null | undefined): RoteamentoBucket | null {
  if (!tipoJob) return null;
  const t = tipoJob.trim();
  for (const [key, meta] of Object.entries(BUCKETS) as Array<[RoteamentoBucket, BucketMeta]>) {
    if (meta.tiposJob.includes(t)) return key;
    if (meta.tiposJobPrefix?.some((p) => t.toLowerCase().startsWith(p.toLowerCase()))) return key;
  }
  return null;
}

export async function lerRoteamento(bucket: RoteamentoBucket): Promise<RoteamentoConfig> {
  const meta = BUCKETS[bucket];
  const { data, error } = await supabaseAdmin
    .from("workflow_config")
    .select("chave, valor")
    .eq("secao", meta.secao);
  if (error) throw new Error(error.message);
  const map: Record<string, string | null> = {};
  (data ?? []).forEach((r: any) => { map[r.chave] = r.valor; });
  const tipo = (map[meta.keys.tipo] ?? "grupo") as DestinoTipo;
  return {
    ativo: (map[meta.keys.ativo] ?? "false") === "true",
    destinoTipo: tipo === "telefone" ? "telefone" : "grupo",
    destinoValor: map[meta.keys.valor] ?? "",
  };
}

export async function salvarRoteamento(bucket: RoteamentoBucket, cfg: RoteamentoConfig, userId: string | null): Promise<void> {
  const meta = BUCKETS[bucket];
  const updates = [
    { chave: meta.keys.ativo, valor: cfg.ativo ? "true" : "false" },
    { chave: meta.keys.tipo, valor: cfg.destinoTipo },
    { chave: meta.keys.valor, valor: cfg.destinoValor },
  ];
  for (const u of updates) {
    const { error } = await supabaseAdmin
      .from("workflow_config")
      .update({ valor: u.valor, atualizado_por: userId ?? null })
      .eq("chave", u.chave)
      .eq("secao", meta.secao);
    if (error) throw new Error(`Falha ao salvar ${u.chave}: ${error.message}`);
  }
}

const BLOQUEIO_KEY = "BLOQUEIO_ENVIOS_ALUNOS_ATIVO";
const BLOQUEIO_SECAO = "bloqueio_envios_alunos";

export async function lerBloqueioEnviosAlunos(): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("workflow_config")
    .select("valor")
    .eq("chave", BLOQUEIO_KEY)
    .maybeSingle();
  if (error) return false;
  return (data?.valor ?? "false") === "true";
}

export async function salvarBloqueioEnviosAlunos(ativo: boolean, userId: string | null): Promise<void> {
  const { error } = await supabaseAdmin
    .from("workflow_config")
    .update({ valor: ativo ? "true" : "false", atualizado_por: userId ?? null })
    .eq("chave", BLOQUEIO_KEY)
    .eq("secao", BLOQUEIO_SECAO);
  if (error) throw new Error(error.message);
}

/**
 * Resolve para qual destino (grupo ou aluno) uma mensagem deve ir.
 * Quando o bucket está ativo e com destino configurado, retorna o destino
 * de grupo + corpo formatado com nome/telefone/mensagem original.
 */
export async function resolverDestinoRoteamento(args: {
  tipoJob: string;
  alunoNome: string | null;
  alunoTelefone: string | null;
  mensagemOriginal: string;
}): Promise<
  | { override: false }
  | { override: true; destinoTipo: DestinoTipo; destinoValor: string; corpo: string; bucket: RoteamentoBucket }
> {
  // TRAVA DURA: mensagens de aluno (feedbacks, FU, respostas de anamnese e
  // resposta IA) nunca podem ser desviadas para grupo, independentemente do
  // que estiver salvo em workflow_config.
  if (deveEnviarDiretoAoAluno(args.tipoJob)) return { override: false };
  const bucket = bucketParaTipoJob(args.tipoJob);
  if (!bucket) return { override: false };
  const cfg = await lerRoteamento(bucket);
  if (!cfg.ativo || !cfg.destinoValor.trim()) return { override: false };
  const corpo = formatarCorpoRoteado({
    tipoJob: args.tipoJob,
    alunoNome: args.alunoNome,
    alunoTelefone: args.alunoTelefone,
    mensagemOriginal: args.mensagemOriginal,
  });
  return {
    override: true,
    destinoTipo: cfg.destinoTipo,
    destinoValor: cfg.destinoValor.trim(),
    corpo,
    bucket,
  };
}

export function formatarCorpoRoteado(args: {
  tipoJob: string;
  alunoNome: string | null;
  alunoTelefone: string | null;
  mensagemOriginal: string;
}): string {
  const nome = (args.alunoNome ?? "").trim() || "(sem nome)";
  const tel = (args.alunoTelefone ?? "").trim() || "(sem telefone)";
  return [
    `*Aluno:* ${nome}`,
    `*Telefone:* ${tel}`,
    `*Tipo:* ${args.tipoJob}`,
    "",
    args.mensagemOriginal,
  ].join("\n");
}

export async function enviarZapiRoteado(destinoTipo: DestinoTipo, destinoValor: string, mensagem: string): Promise<{ ok: boolean; error: string | null }> {
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
      return { ok: false, error: `Z-API ${r.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha Z-API" };
  }
}