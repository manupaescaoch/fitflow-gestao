/**
 * Validação de webhooks Z-API.
 *
 * 1. Se ZAPI_WEBHOOK_SECRET estiver configurado, exige header
 *    `X-Webhook-Token` com match em tempo constante.
 * 2. Caso contrário (compatibilidade), valida que `body.instanceId` bate
 *    com `ZAPI_INSTANCE` configurado — assim payloads forjados de
 *    instâncias arbitrárias são rejeitados.
 * Retorna null se autenticado, ou Response 401.
 */
export function checkZapiWebhookAuth(
  request: Request,
  body: any,
): Response | null {
  const secret = process.env.ZAPI_WEBHOOK_SECRET || "";
  if (secret) {
    const token = request.headers.get("x-webhook-token") || "";
    if (token.length !== secret.length) return unauthorized();
    let diff = 0;
    for (let i = 0; i < token.length; i++) {
      diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
    }
    return diff === 0 ? null : unauthorized();
  }
  const expectedInstance = process.env.ZAPI_INSTANCE || "";
  const got = (body && (body.instanceId || body.instance_id)) || "";
  if (!expectedInstance || !got || String(got) !== expectedInstance) {
    return unauthorized();
  }
  return null;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}