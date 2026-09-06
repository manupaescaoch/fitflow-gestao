import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODULES = [
  "Visão Geral",
  "Alunos",
  "Caixa de Saída",
  "Formulários",
  "Feedbacks",
  "Relatórios",
  "Financeiro",
  "Configurações",
] as const;

const PROFILES = ["admin", "equipe", "consultor", "visualizador"] as const;

const SavePermissoesInput = z.object({
  permissoes: z.array(
    z.object({
      modulo: z.enum(MODULES),
      perfil: z.enum(PROFILES),
      ativo: z.boolean(),
    })
  ),
});

async function ensureAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("usuarios_crm")
    .select("perfil, ativo")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.ativo || data.perfil !== "admin") {
    throw new Error("Apenas administradores podem gerenciar permissões.");
  }
}

export const listPermissoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("permissoes_modulos")
      .select("modulo, perfil, ativo")
      .order("modulo", { ascending: true })
      .order("perfil", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      permissoes: (data ?? []) as { modulo: string; perfil: string; ativo: boolean }[],
      modulos: MODULES as unknown as string[],
      perfis: PROFILES as unknown as string[],
    };
  });

export const savePermissoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SavePermissoesInput.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);

    const rows = data.permissoes.map((p) => ({
      modulo: p.modulo,
      perfil: p.perfil,
      ativo: p.ativo,
    }));

    const { error } = await context.supabase
      .from("permissoes_modulos")
      .upsert(rows, { onConflict: "modulo,perfil" });

    if (error) throw new Error(error.message);
    return { ok: true };
  });
