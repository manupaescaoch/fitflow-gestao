import { createFileRoute } from "@tanstack/react-router";
import { gerarLembretesFeedbackPendentesImpl } from "@/server/feedback-lembretes-core.server";
import { checkCronAuth } from "@/server/cron-auth.server";
import { checarBloqueioFimDeSemana } from "@/server/weekend-lock.server";

/**
 * Cron diário: gera jobs feedback_link_lembrete para formulários enviados há
 * 3+ dias e ainda sem resposta. Os jobs serão executados pelo motor.
 */
export const Route = createFileRoute("/api/public/hooks/feedback-lembretes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = checkCronAuth(request);
        if (unauth) return unauth;
        const bloq = checarBloqueioFimDeSemana(request, "feedback-lembretes");
        if (bloq) return bloq;
        try {
          const r = await gerarLembretesFeedbackPendentesImpl();
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