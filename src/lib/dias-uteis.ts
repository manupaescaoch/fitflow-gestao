/**
 * Helpers para regras de "dia útil" usadas em disparos automáticos
 * (ex.: follow-ups d+7 e d+21 não devem ser enviados em sábado/domingo).
 *
 * Importante: o servidor (Worker) roda em UTC, e as comparações em
 * banco já usam `toISOString().slice(0,10)` (data UTC). Por isso aqui
 * usamos `getUTCDay()` para manter a mesma referência de fuso.
 */

/** True para sábado (6) e domingo (0), em UTC. */
export function ehFimDeSemana(d: Date): boolean {
  const dow = d.getUTCDay();
  return dow === 0 || dow === 6;
}

/**
 * Retorna a janela de datas-base (datas de D+0) que devem ser processadas
 * "hoje" para um dado offset de dias (ex.: 7 ou 21).
 *
 * Regras:
 *  - Se hoje é sábado/domingo → null (não dispara nada).
 *  - Se hoje é terça/quarta/quinta/sexta → janela de 1 dia
 *      [hoje - offset, hoje - offset + 1).
 *  - Se hoje é segunda → janela de 3 dias para incluir o que cairia
 *    em sábado e domingo:
 *      [hoje - offset - 2, hoje - offset + 1).
 *
 * As datas retornadas têm hora zerada em UTC.
 */
export function getJanelaDiasUteis(
  hoje: Date,
  offset: number,
): { de: Date; ate: Date } | null {
  if (ehFimDeSemana(hoje)) return null;

  const dow = hoje.getUTCDay(); // 1=seg ... 5=sex
  const diasExtras = dow === 1 ? 2 : 0;

  const ate = new Date(Date.UTC(
    hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate(),
  ));
  ate.setUTCDate(ate.getUTCDate() - offset + 1);

  const de = new Date(ate);
  de.setUTCDate(de.getUTCDate() - 1 - diasExtras);

  return { de, ate };
}