import { createServerFn } from "@tanstack/react-start";
import { requireAuthOrCron } from "./auth-or-cron.middleware";
import { curarEntregasFaltantesImpl } from "./cura-entregas-core.server";

/**
 * Auto-cura: detecta formulários respondidos (anamnese / feedback_mensal) nas
 * últimas 72h que NÃO têm entrega_dia criada na janela esperada (D+3 úteis a
 * partir da data de resposta) e cria a entrega. Idempotente via UNIQUE
 * (aluno_id, data_referencia) em entregas_dia.
 */
export const curarEntregasFaltantes = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .handler(async () => curarEntregasFaltantesImpl());