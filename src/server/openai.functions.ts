import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function mask(v: string) {
  if (v.length <= 8) return "••••";
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
}

export const getOpenAIStatus = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async () => {
  const key = process.env.OPENAI_API_KEY;
  return {
    apiKey: { configured: !!key, preview: key ? mask(key) : null },
    allConfigured: !!key,
  };
});

export const testOpenAIConnection = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async () => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false as const, error: "OPENAI_API_KEY não configurado." };
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 401) return { ok: false as const, error: "Chave inválida (401)." };
      if (res.status === 429) return { ok: false as const, error: "Limite excedido (429)." };
      return { ok: false as const, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }
    let modelCount = 0;
    try {
      const json = JSON.parse(text) as { data?: unknown[] };
      modelCount = Array.isArray(json.data) ? json.data.length : 0;
    } catch { /* ignore */ }
    return { ok: true as const, modelCount, defaultModel: "gpt-4o" };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
});