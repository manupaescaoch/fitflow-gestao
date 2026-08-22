import type { Database } from "@/integrations/supabase/types";

export type Transacao = Database["public"]["Tables"]["transacoes"]["Row"];
export type TransacaoTipo = "receita" | "estorno" | "ajuste";
export type TransacaoOrigem = "kiwify" | "manual";

export const MES_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function fmtBRL(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Faz parse de uma string de data (formato "YYYY-MM-DD" ou ISO completo) como
 * data LOCAL — evita o bug de timezone em que "2026-02-01" é interpretado como
 * UTC midnight e vira 31/jan no fuso BRT (UTC-3).
 */
export function parseDataLocal(s: string | null | undefined): Date | null {
  if (!s) return null;
  // Pega apenas a parte da data (YYYY-MM-DD), ignorando hora/timezone do ISO
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return new Date(s);
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d));
}

export function competenciaAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function competenciaFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function fmtCompetencia(c: string): string {
  const [y, m] = c.split("-");
  return `${MES_LABELS[Number(m) - 1]}/${y}`;
}

export function ultimas3Competencias(): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 1; i <= 3; i++) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(competenciaFromDate(x));
  }
  return out;
}

export function ultimosNMeses(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(competenciaFromDate(x));
  }
  return out;
}

export function diasAtraso(dataExp: string | null): number {
  if (!dataExp) return 0;
  const ms = Date.now() - new Date(dataExp).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function ltvAluno(valorPlano: number | null, totalRenovacoes: number): number {
  return Number(valorPlano ?? 0) * (totalRenovacoes + 1);
}

export function crescimentoPct(atual: number, anterior: number): number {
  if (!anterior) return atual > 0 ? 100 : 0;
  return ((atual - anterior) / anterior) * 100;
}

export function taxaInadimplencia(inadimplentes: number, ativos: number): number {
  if (!ativos) return 0;
  return (inadimplentes / ativos) * 100;
}

/** Compara dois valores e retorna delta absoluto + percentual. */
export function comparePeriodoAnterior(atual: number, anterior: number) {
  const delta = atual - anterior;
  const pct = anterior ? (delta / anterior) * 100 : (atual > 0 ? 100 : 0);
  return { delta, pct, positivo: delta >= 0 };
}

/** Tempo médio de contrato em meses, baseado em data_compra → data_expiracao. */
export function tempoMedioContratoMeses(
  alunos: Array<{ data_compra: string | null; data_expiracao: string | null }>,
): number {
  const validos = alunos.filter((a) => a.data_compra && a.data_expiracao);
  if (!validos.length) return 0;
  const total = validos.reduce((s, a) => {
    const inicio = new Date(a.data_compra!).getTime();
    const fim = new Date(a.data_expiracao!).getTime();
    const meses = (fim - inicio) / (1000 * 60 * 60 * 24 * 30);
    return s + Math.max(0, meses);
  }, 0);
  return total / validos.length;
}

/** Tempo médio de vida do aluno em meses (data_compra → hoje ou cancelamento). */
export function tempoMedioVidaMeses(
  alunos: Array<{ data_compra: string | null; status: string; atualizado_em: string }>,
): number {
  const validos = alunos.filter((a) => a.data_compra);
  if (!validos.length) return 0;
  const hoje = Date.now();
  const total = validos.reduce((s, a) => {
    const inicio = new Date(a.data_compra!).getTime();
    const fim = a.status === "cancelado" ? new Date(a.atualizado_em).getTime() : hoje;
    return s + Math.max(0, (fim - inicio) / (1000 * 60 * 60 * 24 * 30));
  }, 0);
  return total / validos.length;
}

/** Churn % no mês corrente: cancelados no mês ÷ ativos no início do mês. */
export function churnPct(
  alunos: Array<{ status: string; atualizado_em: string; criado_em: string }>,
): number {
  const inicioMes = new Date();
  inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
  const cancelados = alunos.filter(
    (a) => a.status === "cancelado" && new Date(a.atualizado_em) >= inicioMes,
  ).length;
  const ativosInicio = alunos.filter(
    (a) => new Date(a.criado_em) < inicioMes &&
      !(a.status === "cancelado" && new Date(a.atualizado_em) < inicioMes),
  ).length;
  if (!ativosInicio) return 0;
  return (cancelados / ativosInicio) * 100;
}

export type StatusPagamento = "pago" | "pendente" | "atrasado";

export function statusPagamentoAluno(
  dataExpiracao: string | null,
  status: string,
): StatusPagamento {
  if (status === "renovado") return "pago";
  if (!dataExpiracao) return "pendente";
  const exp = new Date(dataExpiracao);
  const hoje = new Date();
  if (exp < hoje) return "atrasado";
  return "pendente";
}