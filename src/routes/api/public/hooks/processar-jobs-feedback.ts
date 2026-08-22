import { createFileRoute } from "@tanstack/react-router";
import { processarJobsRespostaFeedbackImpl } from "@/server/processar-jobs-feedback-core.server";
import { checkCronAuth } from "@/server/cron-auth.server";
import { checarBloqueioFimDeSemana } from "@/server/weekend-lock.server";

export const Route = createFileRoute("/api/public/hooks/processar-jobs-feedback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = checkCronAuth(request);
        if (unauth) return unauth;
        const bloq = checarBloqueioFimDeSemana(request, "processar-jobs-feedback");
        if (bloq) return bloq;
        const result = await processarJobsRespostaFeedbackImpl();
        return new Response(JSON.stringify(result), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
      GET: async ({ request }) => {
        const unauth = checkCronAuth(request);
        if (unauth) return unauth;
        const bloq = checarBloqueioFimDeSemana(request, "processar-jobs-feedback");
        if (bloq) return bloq;
        const result = await processarJobsRespostaFeedbackImpl();
        return new Response(JSON.stringify(result), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});