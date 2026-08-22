import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Modalidade = Database["public"]["Enums"]["aluno_modalidade"];
export type Status = Database["public"]["Enums"]["aluno_status"];
export type ServicoContratado = Database["public"]["Enums"]["aluno_servico"];
export type JobTipo = Database["public"]["Enums"]["job_tipo"];
export type FormularioTipo = Database["public"]["Enums"]["formulario_tipo"];
export type Aluno = Database["public"]["Tables"]["alunos"]["Row"];

export const MODALIDADE_LABEL: Record<Modalidade, string> = {
  mpteam: "MPTEAM",
  mp_elite: "MP Elite",
  mp_presencial: "MP Presencial",
};

export const SERVICO_LABEL: Record<ServicoContratado, string> = {
  treino_e_dieta: "Treino e dieta",
  dieta: "Dieta",
  treino: "Treino",
};

export const STATUS_LABEL: Record<Status, string> = {
  aguardando_anamnese: "Aguardando Anamnese",
  anamnese_recebida: "Anamnese Recebida",
  em_producao: "Em Produção",
  ativo: "Ativo",
  aguardando_renovacao: "Aguardando Renovação",
  renovado: "Renovado",
  cancelado: "Cancelado",
};

export const KANBAN_COLUMNS: Status[] = [
  "aguardando_anamnese",
  "anamnese_recebida",
  "em_producao",
  "ativo",
  "aguardando_renovacao",
];

export function modalidadeColor(m: Modalidade | null): string {
  switch (m) {
    case "mpteam": return "var(--tag-mpteam)";
    case "mp_elite": return "var(--tag-elite)";
    case "mp_presencial": return "var(--tag-presencial)";
    default: return "var(--muted)";
  }
}

export function diasRestantes(dataExpiracao: string | null): number | null {
  if (!dataExpiracao) return null;
  const ms = new Date(dataExpiracao).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}
export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export async function logStatusChange(
  alunoId: string, statusDe: string | null, statusPara: string, alteradoPor: string,
) {
  await supabase.from("historico_status").insert({
    aluno_id: alunoId, status_de: statusDe, status_para: statusPara, alterado_por: alteradoPor,
  });
}

/** Schedules an array of jobs at fixed offsets from baseDate. */
export async function scheduleJobs(
  alunoId: string,
  jobs: { tipo: JobTipo; offsetMs: number }[],
  baseDate = new Date(),
) {
  const rows = jobs.map((j) => ({
    aluno_id: alunoId,
    tipo: j.tipo,
    agendado_para: new Date(baseDate.getTime() + j.offsetMs).toISOString(),
  }));
  await supabase.from("jobs_disparos").insert(rows);
}

export const DAY = 24 * 60 * 60 * 1000;

export async function createAnamneseAndIntroJobs(alunoId: string) {
  // Create anamnese formulario with public link
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { data: form, error } = await supabase
    .from("formularios")
    .insert({ aluno_id: alunoId, tipo: "anamnese" })
    .select("token")
    .single();
  if (error || !form) throw error ?? new Error("Falha ao criar anamnese");
  const link = `${origin}/formularios/${form.token}`;
  await supabase.from("formularios").update({ link_publico: link }).eq("token", form.token);
  // Boas-vindas e envio do link de anamnese são tratados pelo webhook
  // /api/public/hooks/zapi-boas-vindas (motor novo). Não agendamos mais
  // jobs legacy `boas_vindas` / `link_anamnese`.
  return link;
}

// scheduleD0Jobs removida — o agendamento pós-D0 é feito automaticamente
// pelo trigger `trg_agendar_apos_entrega` em `entregas_dia`, que chama
// `agendar_jobs_apos_entrega` (pos_entrega_d1, followup_d7,
// feedback_quinzenal_link, followup_d21, feedback_mensal_link).

export function csvFromRows(rows: Record<string, unknown>[], headers: string[]): string {
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const head = headers.join(",");
  const body = rows.map((r) => headers.map((h) => escape(r[h])).join(",")).join("\n");
  return `${head}\n${body}`;
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}