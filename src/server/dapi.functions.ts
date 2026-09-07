import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lerCredencial, DAPI_BASE_URL_PADRAO } from "./credenciais.server";

function mask(v: string) {
  if (v.length <= 8) return "••••";
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
}

async function dapiCreds() {
  const [baseUrl, sessionId, apiKey] = await Promise.all([
    lerCredencial("DAPI_BASE_URL"),
    lerCredencial("DAPI_SESSION_ID"),
    lerCredencial("DAPI_API_KEY"),
  ]);
  const base = (baseUrl || DAPI_BASE_URL_PADRAO).replace(/\/+$/, "");
  if (!sessionId || !apiKey) return null;
  return { base, sessionId, apiKey };
}

export const getDapiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const [baseUrl, sessionId, apiKey] = await Promise.all([
      lerCredencial("DAPI_BASE_URL"),
      lerCredencial("DAPI_SESSION_ID"),
      lerCredencial("DAPI_API_KEY"),
    ]);
    const base = baseUrl || DAPI_BASE_URL_PADRAO;
    return {
      baseUrl: { configured: !!base, preview: base },
      sessionId: { configured: !!sessionId, preview: sessionId ?? null },
      apiKey: { configured: !!apiKey, preview: apiKey ? mask(apiKey) : null },
      allConfigured: !!(base && sessionId && apiKey),
    };
  });

/** Consulta os dados/status da sessão na D-API. */
export const testDapiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const c = await dapiCreds();
    if (!c) return { ok: false as const, error: "Informe Session ID e API Key da D-API." };
    try {
      const res = await fetch(`${c.base}/api/v1/sessions/${encodeURIComponent(c.sessionId)}`, {
        method: "GET",
        headers: { Authorization: c.apiKey, "Content-Type": "application/json" },
      });
      const text = await res.text();
      if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}: ${text.slice(0, 400)}` };
      let parsed: Record<string, unknown> | null = null;
      try { parsed = JSON.parse(text) as Record<string, unknown>; } catch { /* not json */ }
      const flat = JSON.stringify(parsed ?? text).toLowerCase();
      const connected = /"status":"(connected|open|working)"/.test(flat) || /"connected":true/.test(flat);
      return { ok: true as const, connected, raw: text };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Erro desconhecido" };
    }
  });

/** Cria (ou inicia) a sessão e retorna o QR code para leitura no celular. */
export const connectDapi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const c = await dapiCreds();
    if (!c) return { ok: false as const, error: "Informe Session ID e API Key da D-API." };
    const headers = { Authorization: c.apiKey, "Content-Type": "application/json" };
    try {
      // 1) cria ou inicia a sessão (idempotente)
      await fetch(`${c.base}/api/v1/sessions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ sessionId: c.sessionId, type: "unofficial" }),
      }).catch(() => null);

      // 2) já conectado?
      const st = await fetch(`${c.base}/api/v1/sessions/${encodeURIComponent(c.sessionId)}`, { headers });
      const stText = await st.text();
      if (st.ok && /"status":"(connected|open|working)"/i.test(stText)) {
        return { ok: true as const, alreadyConnected: true as const, qr: null };
      }

      // 3) QR como imagem PNG
      const qrRes = await fetch(
        `${c.base}/api/v1/sessions/${encodeURIComponent(c.sessionId)}/qr?image=1`,
        { headers: { Authorization: c.apiKey } },
      );
      if (!qrRes.ok) {
        const t = await qrRes.text();
        return { ok: false as const, error: `HTTP ${qrRes.status}: ${t.slice(0, 400)}` };
      }
      const ct = qrRes.headers.get("content-type") ?? "";
      if (ct.includes("image")) {
        const buf = await qrRes.arrayBuffer();
        const b64 = Buffer.from(buf).toString("base64");
        return { ok: true as const, alreadyConnected: false as const, qr: `data:image/png;base64,${b64}` };
      }
      // fallback: JSON com o QR
      const txt = await qrRes.text();
      let obj: Record<string, unknown> | null = null;
      try { obj = JSON.parse(txt) as Record<string, unknown>; } catch { /* ignore */ }
      const cand = obj
        ? ((obj["qrcode"] ?? obj["qr"] ?? obj["base64"] ??
            (obj["data"] as Record<string, unknown> | undefined)?.["qrcode"]) as string | undefined)
        : undefined;
      if (typeof cand === "string" && cand.startsWith("data:image")) {
        return { ok: true as const, alreadyConnected: false as const, qr: cand };
      }
      if (typeof cand === "string" && cand.length > 40) {
        return { ok: true as const, alreadyConnected: false as const, qr: `data:image/png;base64,${cand}` };
      }
      return { ok: false as const, error: `Resposta inesperada da D-API: ${txt.slice(0, 300)}` };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Erro desconhecido" };
    }
  });

/** Desconecta o número removendo a sessão na D-API. */
export const disconnectDapi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const c = await dapiCreds();
    if (!c) return { ok: false as const, error: "Informe Session ID e API Key da D-API." };
    try {
      const res = await fetch(`${c.base}/api/v1/sessions/${encodeURIComponent(c.sessionId)}`, {
        method: "DELETE",
        headers: { Authorization: c.apiKey },
      });
      const text = await res.text();
      if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}: ${text.slice(0, 400)}` };
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Erro desconhecido" };
    }
  });
