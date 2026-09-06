import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lerCredenciaisZapi } from "./credenciais.server";

export const getZapiStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const creds = await lerCredenciaisZapi();
  const instance = creds?.instance;
  const token = creds?.token;
  const clientToken = creds?.clientToken;
  return {
    instance: { configured: !!instance, preview: instance ? mask(instance) : null },
    token: { configured: !!token, preview: token ? mask(token) : null },
    clientToken: { configured: !!clientToken, preview: clientToken ? mask(clientToken) : null },
    allConfigured: !!(instance && token && clientToken),
  };
});

export const testZapiConnection = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async () => {
  const creds = await lerCredenciaisZapi();
  const instance = creds?.instance;
  const token = creds?.token;
  const clientToken = creds?.clientToken;
  if (!instance || !token || !clientToken) {
    return { ok: false, error: "Credenciais Z-API não configuradas." };
  }
  try {
    const url = `https://api.z-api.io/instances/${instance}/token/${token}/status`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "Client-Token": clientToken, "Content-Type": "application/json" },
    });
    const text = await res.text();
    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(text) as Record<string, unknown>; } catch { /* not json */ }
    if (!res.ok) {
      return { ok: false as const, error: `HTTP ${res.status}: ${text}` };
    }
    const connected = parsed !== null && parsed.connected === true;
    return { ok: true as const, connected, raw: text };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
});

function zapiCreds() {
  const creds = await lerCredenciaisZapi();
  const instance = creds?.instance;
  const token = creds?.token;
  const clientToken = creds?.clientToken;
  if (!instance || !token || !clientToken) return null;
  return { instance, token, clientToken };
}

/** Gera QR code (base64) para conectar o WhatsApp à instância Z-API. */
export const connectZapi = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async () => {
  const c = await zapiCreds();
  if (!c) return { ok: false as const, error: "Credenciais Z-API não configuradas." };
  try {
    const headers = { "Client-Token": c.clientToken, "Content-Type": "application/json" };
    const base = `https://api.z-api.io/instances/${c.instance}/token/${c.token}`;
    // Já conectado?
    const st = await fetch(`${base}/status`, { method: "GET", headers });
    const stTxt = await st.text();
    try {
      const stJson = JSON.parse(stTxt) as Record<string, unknown>;
      if (stJson.connected === true) return { ok: true as const, alreadyConnected: true, qr: null };
    } catch { /* ignore */ }
    const res = await fetch(`${base}/qr-code/image`, { method: "GET", headers });
    const text = await res.text();
    if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    let qr: string | null = null;
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      qr = (parsed.value as string) ?? (parsed.qrcode as string) ?? null;
    } catch { /* not json */ }
    if (!qr) return { ok: false as const, error: "QR code indisponível na resposta da Z-API." };
    const dataUrl = qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`;
    return { ok: true as const, alreadyConnected: false, qr: dataUrl };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
});

/** Desconecta o WhatsApp da instância Z-API. */
export const disconnectZapi = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async () => {
  const c = await zapiCreds();
  if (!c) return { ok: false as const, error: "Credenciais Z-API não configuradas." };
  try {
    const url = `https://api.z-api.io/instances/${c.instance}/token/${c.token}/disconnect`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "Client-Token": c.clientToken, "Content-Type": "application/json" },
    });
    const text = await res.text();
    if (!res.ok) return { ok: false as const, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
});

function mask(v: string) {
  if (v.length <= 6) return "••••";
  return `${v.slice(0, 3)}••••${v.slice(-3)}`;
}

export type ZapiGroup = { id: string; name: string };

export const listZapiGroups = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async (): Promise<{ ok: true; groups: ZapiGroup[] } | { ok: false; error: string }> => {
  const creds = await lerCredenciaisZapi();
  const instance = creds?.instance;
  const token = creds?.token;
  const clientToken = creds?.clientToken;
  if (!instance || !token || !clientToken) {
    return { ok: false, error: "Credenciais Z-API não configuradas." };
  }
  try {
    const headers = { "Client-Token": clientToken, "Content-Type": "application/json" };
    const base = `https://api.z-api.io/instances/${instance}/token/${token}`;
    const groups: ZapiGroup[] = [];
    const seen = new Set<string>();
    // Paginate /chats and filter group entries (isGroup === true or id endswith @g.us)
    for (let page = 1; page <= 20; page++) {
      const res = await fetch(`${base}/chats?page=${page}&pageSize=100`, { method: "GET", headers });
      if (!res.ok) {
        const txt = await res.text();
        return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 300)}` };
      }
      const data = (await res.json()) as unknown;
      const arr = Array.isArray(data) ? data : [];
      if (arr.length === 0) break;
      for (const item of arr as Array<Record<string, unknown>>) {
        const phone = (item.phone as string) || (item.id as string) || "";
        const isGroup = item.isGroup === true || phone.endsWith("@g.us") || phone.includes("-");
        if (!isGroup || !phone) continue;
        const id = phone.endsWith("@g.us") ? phone : `${phone}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const name = (item.name as string) || (item.notify as string) || (item.shortName as string) || id;
        groups.push({ id, name });
      }
      if (arr.length < 100) break;
    }
    groups.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return { ok: true, groups };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
});