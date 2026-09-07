import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CHAVES_CREDENCIAIS = [
  "ZAPI_INSTANCE_ID",
  "ZAPI_TOKEN",
  "ZAPI_CLIENT_TOKEN",
  "OPENAI_API_KEY",
  "DAPI_BASE_URL",
  "DAPI_SESSION_ID",
  "DAPI_API_KEY",
] as const;

export const DAPI_BASE_URL_PADRAO = "https://api.d-api.cloud";

export type ChaveCredencial = (typeof CHAVES_CREDENCIAIS)[number];

let cache: { at: number; map: Map<string, string> } | null = null;

async function carregar(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < 15_000) return cache.map;
  const { data } = await supabaseAdmin
    .from("workflow_config")
    .select("chave, valor")
    .in("chave", CHAVES_CREDENCIAIS as unknown as string[]);
  const map = new Map<string, string>();
  for (const r of data ?? []) {
    if (r.valor) map.set(r.chave, r.valor);
  }
  cache = { at: Date.now(), map };
  return map;
}

export function invalidarCacheCredenciais() {
  cache = null;
}

/** Lê credencial: valor salvo na tela de Conexões tem prioridade; senão usa variável de ambiente. */
export async function lerCredencial(chave: ChaveCredencial): Promise<string | null> {
  const map = await carregar();
  const db = map.get(chave)?.trim();
  if (db) return db;
  if (chave === "ZAPI_INSTANCE_ID") {
    return process.env.ZAPI_INSTANCE_ID || process.env.ZAPI_INSTANCE || null;
  }
  return process.env[chave] || null;
}

export async function lerCredenciaisZapi(): Promise<
  { instance: string; token: string; clientToken: string } | null
> {
  const [instance, token, clientToken] = await Promise.all([
    lerCredencial("ZAPI_INSTANCE_ID"),
    lerCredencial("ZAPI_TOKEN"),
    lerCredencial("ZAPI_CLIENT_TOKEN"),
  ]);
  if (!instance || !token || !clientToken) return null;
  return { instance, token, clientToken };
}
