import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getDashboardResumoImpl, type DashboardResumo } from "./dashboard-core.server";

export type { DashboardResumo };

export const getDashboardResumo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Acesso restrito a administradores");
    return getDashboardResumoImpl();
  });
