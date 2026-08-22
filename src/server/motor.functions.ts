import { createServerFn } from "@tanstack/react-start";
import { requireAuthOrCron } from "./auth-or-cron.middleware";
import { runMotorAutomacoesImpl, dispararJobsAgoraImpl } from "./motor-core.server";

/**
 * Executa um ciclo do motor. Respeita MOTOR_ATIVO; `force` ignora o flag.
 */
export const runMotorAutomacoes = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .inputValidator((data: { force?: boolean } | undefined) => data ?? {})
  .handler(async ({ data }) => runMotorAutomacoesImpl({ force: data?.force === true }));

/**
 * Dispara uma lista específica de jobs AGORA (uso manual via UI).
 */
export const dispararJobsAgora = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .inputValidator((data: { ids: string[]; intervaloMs?: number; intervaloMinMs?: number; intervaloMaxMs?: number }) => ({
    ids: Array.isArray(data?.ids) ? data.ids.filter((x) => typeof x === "string") : [],
    intervaloMs: typeof data?.intervaloMs === "number" && data.intervaloMs >= 0 ? data.intervaloMs : 10_000,
    intervaloMinMs: typeof data?.intervaloMinMs === "number" && data.intervaloMinMs >= 0 ? data.intervaloMinMs : undefined,
    intervaloMaxMs: typeof data?.intervaloMaxMs === "number" && data.intervaloMaxMs >= 0 ? data.intervaloMaxMs : undefined,
  }))
  .handler(async ({ data }) => dispararJobsAgoraImpl(data));