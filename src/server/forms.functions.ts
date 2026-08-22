import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const KEYS = ["FORM_URL_ANAMNESE", "FORM_URL_QUINZENAL", "FORM_URL_MENSAL"] as const;

export const getFormUrls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("workflow_config")
    .select("chave, valor")
    .in("chave", KEYS as unknown as string[]);
  if (error) throw new Error(error.message);
  const map = new Map((data ?? []).map((r) => [r.chave, r.valor ?? ""]));
  return {
    anamnese: map.get("FORM_URL_ANAMNESE") ?? "",
    quinzenal: map.get("FORM_URL_QUINZENAL") ?? "",
    mensal: map.get("FORM_URL_MENSAL") ?? "",
  };
});

const SaveSchema = z.object({
  anamnese: z.string().trim().max(500).refine((v) => v === "" || /^https?:\/\//.test(v), "URL inválida"),
  quinzenal: z.string().trim().max(500).refine((v) => v === "" || /^https?:\/\//.test(v), "URL inválida"),
  mensal: z.string().trim().max(500).refine((v) => v === "" || /^https?:\/\//.test(v), "URL inválida"),
});

export const saveFormUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { data: roleCheck } = await supabase
      .from("usuarios_crm")
      .select("perfil")
      .eq("id", userId)
      .maybeSingle();
    if (roleCheck?.perfil !== "admin") {
      throw new Error("Apenas administradores podem alterar os links dos formulários.");
    }
    const rows = [
      { chave: "FORM_URL_ANAMNESE", valor: data.anamnese, tipo: "text", secao: "formularios", atualizado_por: userId },
      { chave: "FORM_URL_QUINZENAL", valor: data.quinzenal, tipo: "text", secao: "formularios", atualizado_por: userId },
      { chave: "FORM_URL_MENSAL", valor: data.mensal, tipo: "text", secao: "formularios", atualizado_por: userId },
    ];
    const { error } = await supabaseAdmin.from("workflow_config").upsert(rows, { onConflict: "chave" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });