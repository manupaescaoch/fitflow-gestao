/**
 * Regra: primeiro feedback mensal = mês seguinte ao início, no dia do
 * "Vencimento" (= dia do mês de `data_compra`). Se o dia não existir no mês
 * alvo (ex: 31 em fevereiro), usa o último dia válido do mês.
 */
export function calcularPrimeiroFeedbackMensal(dataInicio: Date): Date {
  const dia = dataInicio.getDate();
  const ano = dataInicio.getFullYear();
  const mes = dataInicio.getMonth();

  // mês seguinte (Date normaliza ano automaticamente quando mes === 11)
  const mesAlvo = mes + 1;

  // Último dia do mês alvo: dia 0 do mês seguinte
  const ultimoDia = new Date(ano, mesAlvo + 1, 0).getDate();
  const diaFinal = Math.min(dia, ultimoDia);

  // Preserva hora/minuto da data de início para evitar problemas de fuso
  const result = new Date(ano, mesAlvo, diaFinal,
    dataInicio.getHours(), dataInicio.getMinutes(), dataInicio.getSeconds());
  return result;
}

export type AlunoParaRegra = { status: string | null; data_compra: string | null };
export type AgendamentoParaRegra = { periodicidade: string };

export function deveAplicarRegraMensal(
  aluno: AlunoParaRegra,
  agendamento: AgendamentoParaRegra,
): boolean {
  return (
    aluno.status === "ativo" &&
    agendamento.periodicidade === "mensal" &&
    !!aluno.data_compra
  );
}