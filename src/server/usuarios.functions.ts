import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

type Perfil = Database["public"]["Enums"]["app_role"];

const CriarUsuarioInput = z.object({
  email: z.string().trim().email().max(255),
  nome: z.string().trim().min(1).max(120),
  telefone: z
    .string()
    .trim()
    .min(10, "Telefone deve incluir DDD")
    .max(20)
    .regex(/[0-9]/, "Telefone inválido"),
  perfil: z.enum(["admin", "equipe", "consultor", "visualizador"]),
});

const EditarUsuarioInput = z.object({
  id: z.string().uuid(),
  nome: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  telefone: z.string().trim().min(10).max(20),
  perfil: z.enum(["admin", "equipe", "consultor", "visualizador"]),
  resetar_senha: z.boolean().optional(),
});

const ExcluirUsuarioInput = z.object({
  id: z.string().uuid(),
});

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("SUPABASE_URL não configurado");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurado");
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const criarUsuarioCRM = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CriarUsuarioInput.parse(input))
  .handler(async ({ data, context }) => {
    // Verifica se o caller é admin
    const { data: caller, error: cErr } = await context.supabase
      .from("usuarios_crm")
      .select("perfil, ativo")
      .eq("id", context.userId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!caller || !caller.ativo || caller.perfil !== "admin") {
      throw new Error("Apenas administradores podem criar usuários.");
    }

    const admin = getAdminClient();

    // Senha padrão = telefone (somente dígitos), mínimo 8 caracteres
    const passwordFromPhone = data.telefone.replace(/\D/g, "");
    if (passwordFromPhone.length < 8) {
      throw new Error("Telefone precisa ter pelo menos 8 dígitos para virar senha.");
    }

    // Cria o usuário no Auth (já confirmado para entrar direto)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: data.email,
      password: passwordFromPhone,
      email_confirm: true,
      user_metadata: { nome: data.nome, telefone: data.telefone },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Falha ao criar usuário no Auth.");
    }

    const newId = created.user.id;

    // Garante registro em usuarios_crm com o perfil escolhido (sobrescreve o default do trigger)
    const { error: upErr } = await admin
      .from("usuarios_crm")
      .upsert(
        ({
          id: newId,
          email: data.email,
          nome: data.nome,
          telefone: data.telefone,
          perfil: data.perfil as Perfil,
          ativo: true,
        }) as never,
        { onConflict: "id" },
      );
    if (upErr) {
      // rollback: remove usuário do Auth se falhar a inserção do perfil
      await admin.auth.admin.deleteUser(newId);
      throw new Error(upErr.message);
    }

    return { ok: true, id: newId };
  });

async function assertCallerIsAdmin(context: { supabase: ReturnType<typeof createClient<Database>>; userId: string }) {
  const { data: caller, error } = await context.supabase
    .from("usuarios_crm")
    .select("perfil, ativo")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!caller || !caller.ativo || caller.perfil !== "admin") {
    throw new Error("Apenas administradores podem executar esta ação.");
  }
}

export const editarUsuarioCRM = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EditarUsuarioInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context);
    const admin = getAdminClient();

    // Atualiza Auth (email + metadata + senha opcional)
    const updatePayload: { email?: string; password?: string; user_metadata?: Record<string, unknown> } = {
      email: data.email,
      user_metadata: { nome: data.nome, telefone: data.telefone },
    };
    if (data.resetar_senha) {
      const digits = data.telefone.replace(/\D/g, "");
      if (digits.length < 8) throw new Error("Telefone precisa ter pelo menos 8 dígitos para virar senha.");
      updatePayload.password = digits;
    }
    const { error: authErr } = await admin.auth.admin.updateUserById(data.id, updatePayload);
    if (authErr) throw new Error(authErr.message);

    const { error: upErr } = await admin
      .from("usuarios_crm")
      .update(({
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        perfil: data.perfil as Perfil,
      }) as never)
      .eq("id", data.id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true };
  });

export const excluirUsuarioCRM = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExcluirUsuarioInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCallerIsAdmin(context);
    if (data.id === context.userId) {
      throw new Error("Você não pode excluir seu próprio usuário.");
    }
    const admin = getAdminClient();
    // Remove perfil CRM primeiro (não bloqueia se já não existir)
    await admin.from("usuarios_crm").delete().eq("id", data.id);
    const { error } = await admin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });