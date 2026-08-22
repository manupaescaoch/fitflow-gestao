import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAlunoAuth } from "./aluno-middleware";

const SubscriptionSchema = z.object({
  endpoint: z.string().url().min(1).max(2048),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
  user_agent: z.string().max(512).optional().nullable(),
});

/** Salva (ou atualiza) a inscrição de push do aluno autenticado. */
export const salvarPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .inputValidator((input: unknown) => SubscriptionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("aluno_push_subscriptions")
      .upsert(
        {
          aluno_id: context.alunoId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.user_agent ?? null,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
    if (error) {
      console.error("[push] erro ao salvar subscription:", error);
      throw new Error("Falha ao salvar inscrição de notificações");
    }
    return { ok: true as const };
  });

/** Remove a inscrição (logout do push) do endpoint informado. */
export const removerPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .inputValidator((input: unknown) =>
    z.object({ endpoint: z.string().url().min(1).max(2048) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("aluno_push_subscriptions")
      .delete()
      .eq("aluno_id", context.alunoId)
      .eq("endpoint", data.endpoint);
    if (error) {
      console.error("[push] erro ao remover subscription:", error);
      throw new Error("Falha ao remover inscrição de notificações");
    }
    return { ok: true as const };
  });

/** Indica se o aluno autenticado já tem ao menos uma inscrição ativa. */
export const statusPushSubscription = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .handler(async ({ context }) => {
    const { count, error } = await supabaseAdmin
      .from("aluno_push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("aluno_id", context.alunoId);
    if (error) {
      console.error("[push] erro ao consultar status:", error);
      return { inscrito: false, total: 0 };
    }
    return { inscrito: (count ?? 0) > 0, total: count ?? 0 };
  });