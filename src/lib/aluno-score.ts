/** Constantes de pontuação do aluno — fonte única de verdade. */

/** Pontos atribuídos por check-in diário. Deve casar com `SCORE_DIARIO`
 *  em src/server/checkin-diario.functions.ts. */
export const SCORE_DIARIO = 5;

/** Janela usada nas telas (dashboard e perfil) para somar pontos. */
export const SCORE_JANELA_DIAS = 7;

/** Meta semanal = pontuação máxima possível na janela. */
export const SCORE_META_SEMANAL = SCORE_DIARIO * SCORE_JANELA_DIAS;

/** Soma `score_gerado` dos check-ins dentro da janela (default: 7 dias). */
export function somarScoreJanela(
  checkins: Array<{ data_checkin?: string | null; score_gerado?: number | null }>,
  dias: number = SCORE_JANELA_DIAS,
): number {
  const limite = Date.now() - dias * 86400000;
  return checkins.reduce((s, c) => {
    if (!c?.data_checkin) return s;
    const t = new Date(c.data_checkin).getTime();
    if (Number.isNaN(t) || t < limite) return s;
    return s + Number(c.score_gerado ?? 0);
  }, 0);
}