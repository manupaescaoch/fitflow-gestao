import { createFileRoute } from "@tanstack/react-router";
import { processarPayloadBoasVindas } from "./zapi-boas-vindas";
import { checkZapiWebhookAuth } from "@/server/zapi-webhook-auth.server";

// Webhook Z-API "Ao receber mensagem" (On Message Received).
// Apenas dispara o fluxo de boas-vindas. A inbox de conversas em tempo real
// foi removida — caso volte, religar a persistência aqui.

export const Route = createFileRoute("/api/public/hooks/zapi-receive")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any = null;
        try { body = await request.json(); } catch {
          return new Response(JSON.stringify({ ok: true, ignorado: "json-invalido" }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }
        const unauth = checkZapiWebhookAuth(request, body);
        if (unauth) return unauth;
        const work = Promise.allSettled([
          processarPayloadBoasVindas(body).catch((e: unknown) =>
            console.error("[zapi-receive:boas-vindas]", e),
          ),
        ]);
        const ctx = (globalThis as any).__cfCtx ?? (request as any).ctx;
        if (ctx?.waitUntil) ctx.waitUntil(work);
        else await Promise.race([work, new Promise((r) => setTimeout(r, 3500))]);
        return new Response(JSON.stringify({ ok: true, queued: true }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () =>
        new Response(
          JSON.stringify({ ok: true, info: "Webhook Z-API receive. Configure como POST em 'Ao receber mensagem'." }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    },
  },
});