import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MODULOS_PERMITIDOS = new Set(["anamnese_publica", "feedback_publico"]);

function trunc(s: unknown, max: number): string | null {
  if (s == null) return null;
  const str = typeof s === "string" ? s : String(s);
  const limpo = str.replace(/<[^>]*>/g, "").slice(0, max);
  return limpo || null;
}

function sanitizarContexto(ctx: unknown): Record<string, unknown> {
  if (!ctx || typeof ctx !== "object") return {};
  const proibido = /token|authorization|secret|password|cpf|stack/i;
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of Object.entries(ctx as Record<string, unknown>)) {
    if (n++ >= 20) break;
    if (proibido.test(k)) continue;
    if (v == null) continue;
    if (typeof v === "string") out[k] = v.slice(0, 200);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else out[k] = String(v).slice(0, 200);
  }
  return out;
}

/**
 * Log público sanitizado — usado pelos fluxos anônimos (anamnese/feedback).
 * Nenhum campo livre vem do client além de etapa/mensagem (truncados) e
 * contexto (filtrado). Stack trace, severity e module são fixados no servidor.
 */
export const logarFalhaPublicaServer = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      modulo: string;
      etapa: string;
      mensagem: string;
      contexto?: Record<string, unknown>;
      alunoNome?: string | null;
    }) => {
      if (!data || typeof data !== "object") throw new Error("payload inválido");
      if (!MODULOS_PERMITIDOS.has(data.modulo)) {
        throw new Error("modulo não permitido");
      }
      return {
        modulo: data.modulo as "anamnese_publica" | "feedback_publico",
        etapa: trunc(data.etapa, 80) || "desconhecida",
        mensagem: trunc(data.mensagem, 500) || "erro",
        contexto: sanitizarContexto(data.contexto),
        alunoNome: trunc(data.alunoNome, 80),
      };
    },
  )
  .handler(async ({ data }) => {
    try {
      await supabaseAdmin.from("system_logs").insert({
        event_type: `${data.modulo}.${data.etapa}`,
        module: data.modulo,
        severity: "error",
        description: data.etapa,
        error_message: data.mensagem,
        aluno_nome: data.alunoNome ?? null,
        payload_summary: data.contexto as any,
        status: "aberto",
      });
    } catch (e) {
      console.error("logarFalhaPublicaServer", e);
    }
    return { ok: true };
  });