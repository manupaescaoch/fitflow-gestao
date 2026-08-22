import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Aceita duas formas de autenticação:
 *  - Bearer com CRON_SECRET (uso interno pelo pg_cron via /api/public/hooks/*)
 *  - Bearer com JWT de usuário Supabase (uso pelo app autenticado)
 * Qualquer outra requisição é bloqueada (401).
 */
export const requireAuthOrCron = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    const CRON_SECRET = process.env.CRON_SECRET;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Response("Missing Supabase env vars", { status: 500 });
    }

    const request = getRequest();
    const authHeader = request?.headers?.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      throw new Response("Unauthorized", { status: 401 });
    }
    const token = authHeader.slice(7).trim();
    if (!token) throw new Response("Unauthorized", { status: 401 });

    type Ctx = { isCron: boolean; userId: string | null };
    // Cron path: bearer == CRON_SECRET (segredo dedicado, não exposto ao cliente)
    if (CRON_SECRET && safeEqual(token, CRON_SECRET)) {
      const ctx: Ctx = { isCron: true, userId: null };
      return next({ context: ctx });
    }

    // App autenticado: valida JWT do usuário
    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) {
      throw new Response("Unauthorized", { status: 401 });
    }
    const ctx: Ctx = { isCron: false, userId: data.claims.sub };
    return next({ context: ctx });
  },
);

/** Comparação em tempo constante para evitar timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}