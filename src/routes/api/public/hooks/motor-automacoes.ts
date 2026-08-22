import { createFileRoute } from "@tanstack/react-router";
import { runMotorAutomacoesImpl } from "@/server/motor-core.server";
import { checkCronAuth } from "@/server/cron-auth.server";
import { checarBloqueioFimDeSemana } from "@/server/weekend-lock.server";

/**
 * Endpoint chamado por pg_cron / scheduler externo para rodar o motor
 * de automações. Validação por bearer com o CRON_SECRET (mesmo padrão
 * usado em outros hooks públicos do projeto).
 *
 * Cron NÃO é configurado por padrão — basta chamar este endpoint quando o
 * admin habilitar MOTOR_ATIVO. Para teste manual, passar `?force=1`.
 */
export const Route = createFileRoute("/api/public/hooks/motor-automacoes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = checkCronAuth(request);
        if (unauth) return unauth;
        const bloq = checarBloqueioFimDeSemana(request, "motor-automacoes");
        if (bloq) return bloq;
        const url = new URL(request.url);
        const force = url.searchParams.get("force") === "1";
        try {
          const r = await runMotorAutomacoesImpl({ force });
          return new Response(JSON.stringify(r), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});