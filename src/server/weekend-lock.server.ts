/**
 * Trava de fim de semana para jobs de relatórios/notificações.
 *
 * Regra: sábado e domingo (fuso America/Sao_Paulo) NÃO executam.
 * Como o cron roda diariamente, a próxima execução cai naturalmente
 * na segunda-feira no mesmo horário — o job de sáb/dom vira no-op.
 *
 * Uso:
 *   const bloq = checarBloqueioFimDeSemana(request);
 *   if (bloq) return bloq;
 */

export function ehFimDeSemanaBRT(now: Date = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  });
  const wd = fmt.format(now); // "Sat", "Sun", ...
  return wd === "Sat" || wd === "Sun";
}

function proximaSegundaBRT(now: Date = new Date()): string {
  // Retorna ISO (YYYY-MM-DD) da próxima segunda-feira em BRT.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dow = map[wd] ?? 0;
  const add = dow === 0 ? 1 : dow === 6 ? 2 : (8 - dow) % 7;
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + add);
  return base.toISOString().slice(0, 10);
}

/**
 * Retorna Response 200 se hoje for fim de semana em BRT, senão null.
 * Pode ser sobrescrito passando header `x-force-weekend: 1`.
 */
export function checarBloqueioFimDeSemana(
  request: Request,
  jobName?: string,
): Response | null {
  const force = (request.headers.get("x-force-weekend") ?? "").toLowerCase();
  if (force === "1" || force === "true") return null;
  if (!ehFimDeSemanaBRT()) return null;
  const reagendadoPara = proximaSegundaBRT();
  return new Response(
    JSON.stringify({
      skipped: "fim_de_semana",
      job: jobName ?? null,
      reagendadoPara,
      mensagem:
        "Job não executa em sábado/domingo (BRT). Próxima execução: segunda-feira no mesmo horário.",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}