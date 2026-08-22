import { createFileRoute } from "@tanstack/react-router";
import { enviarResumoFeedbacksPendentesGrupoImpl } from "@/server/resumo-feedbacks-grupo.server";
import { checkCronAuth } from "@/server/cron-auth.server";
import { checarBloqueioFimDeSemana } from "@/server/weekend-lock.server";

/**
 * Cron: envia ao grupo de Feedbacks & Follow-ups o resumo de feedbacks
 * sem resposta há 3+ dias. Idempotente — apenas notifica.
 */
export const Route = createFileRoute("/api/public/hooks/resumo-feedbacks-grupo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = checkCronAuth(request);
        if (unauth) return unauth;
        const bloq = checarBloqueioFimDeSemana(request, "resumo-feedbacks-grupo");
        if (bloq) return bloq;
        try {
          const r = await enviarResumoFeedbacksPendentesGrupoImpl();
          return new Response(JSON.stringify(r), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "erro" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});