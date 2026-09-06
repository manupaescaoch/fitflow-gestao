import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CHAVES_CREDENCIAIS, lerCredencial, invalidarCacheCredenciais } from "./credenciais.server";

function mask(v: string) {
  if (v.length <= 8) return "••••";
  return `${v.slice(0, 4)}••••${v.slice(-4)}`;
}

export const getCredenciais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin
      .from("workflow_config")
      .select("chave, valor")
      .in("chave", CHAVES_CREDENCIAIS as unknown as string[]);
    const salvos = new Map((data ?? []).map((r) => [r.chave, (r.valor ?? "").trim()]));

    const out: Record<string, { configured: boolean; preview: string | null; editavel: boolean }> = {};
    for (const chave of CHAVES_CREDENCIAIS) {
      const valor = (await lerCredencial(chave)) ?? "";
      out[chave] = {
        configured: !!valor,
        preview: valor ? mask(valor) : null,
        editavel: !!salvos.get(chave) || true,
      };
    }
    return out as Record<
      (typeof CHAVES_CREDENCIAIS)[number],
      { configured: boolean; preview: string | null; editavel: boolean }
    >;
  });

const SaveSchema = z.object({
  chave: z.enum(CHAVES_CREDENCIAIS),
  valor: z.string().trim().max(500),
});

export const saveCredencial = createServerFn({ method: "POST" })
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
      throw new Error("Apenas administradores podem alterar as credenciais.");
    }
    const { error } = await supabaseAdmin.from("workflow_config").upsert(
      {
        chave: data.chave,
        valor: data.valor,
        tipo: "secret",
        secao: "conexoes",
        atualizado_por: userId,
      },
      { onConflict: "chave" },
    );
    if (error) throw new Error(error.message);
    invalidarCacheCredenciais();
    return { ok: true as const };
  });
