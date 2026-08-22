import { createFileRoute } from "@tanstack/react-router";
import { dispararJobsAgoraImpl } from "@/server/motor-core.server";
import { checkCronAuth } from "@/server/cron-auth.server";

/**
 * Dispara uma lista específica de jobs AGORA com intervalo configurável.
 * Body JSON: { ids: string[], intervaloMinMs?: number, intervaloMaxMs?: number, intervaloMs?: number }
 */
export const Route = createFileRoute("/api/public/hooks/disparar-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = checkCronAuth(request);
        if (unauth) return unauth;
        try {
          const body = (await request.json().catch(() => ({}))) as {
            ids?: string[];
            intervaloMs?: number;
            intervaloMinMs?: number;
            intervaloMaxMs?: number;
          };
          const r = await dispararJobsAgoraImpl({
            ids: Array.isArray(body?.ids) ? body.ids : [],
            intervaloMs: body?.intervaloMs,
            intervaloMinMs: body?.intervaloMinMs,
            intervaloMaxMs: body?.intervaloMaxMs,
          });
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