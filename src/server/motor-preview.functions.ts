import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { previewMensagemJobImpl } from "./motor-preview.server";

/**
 * Gera, sem enviar, a mensagem que seria disparada para o aluno num determinado tipo de job.
 * Útil para a UI mostrar uma prévia antes do envio real.
 */

export const previewMensagemJob = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: { alunoId: string; tipo: string; formularioId?: string | null }) => ({
    alunoId: String(data.alunoId),
    tipo: String(data.tipo),
    formularioId: data.formularioId ?? null,
  }))
  .handler(async ({ data }) => previewMensagemJobImpl(data));