import { createFileRoute } from "@tanstack/react-router";
import { curarEntregasFaltantesImpl } from "@/server/cura-entregas-core.server";
import { checkCronAuth } from "@/server/cron-auth.server";
import { checarBloqueioFimDeSemana } from "@/server/weekend-lock.server";

/**
 * Cron diário: detecta anamneses/feedbacks mensais respondidos nas últimas 72h
 * sem entrega_dia criada e recria a entrega (auto-cura).
 */
export const Route = createFileRoute("/api/public/hooks/cura-entregas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = checkCronAuth(request);
        if (unauth) return unauth;
        const bloq = checarBloqueioFimDeSemana(request, "cura-entregas");
        if (bloq) return bloq;
        try {
          const r = await curarEntregasFaltantesImpl();
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