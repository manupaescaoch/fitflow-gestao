import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const listSystemLogs = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string; severity?: string; eventType?: string; module?: string; onlyUnresolved?: boolean; limit?: number }) => d || {})
  .handler(async ({ data }) => {
    let q = supabaseAdmin.from("system_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 300);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.severity) q = q.eq("severity", data.severity);
    if (data.eventType) q = q.eq("event_type", data.eventType);
    if (data.module) q = q.eq("module", data.module);
    if (data.onlyUnresolved) q = q.eq("resolved", false);
    const { data: rows, error } = await q;
    return { rows: rows ?? [], error: error?.message ?? null };
  });

export const marcarLogResolvido = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; notes?: string }) => {
    if (!d?.id) throw new Error("id obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("system_logs").update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      notes: data.notes ?? null,
    }).eq("id", data.id);
    return { ok: !error, error: error?.message ?? null };
  });

export const contarAlertasSign = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async () => {
    const [signFails, photoIssues] = await Promise.all([
      supabaseAdmin.from("system_logs").select("id", { count: "exact", head: true })
        .eq("event_type", "signAnamneseUrls_failed").eq("resolved", false),
      supabaseAdmin.from("photo_audit_logs").select("id", { count: "exact", head: true })
        .in("url_status", ["expirada", "sem_assinatura", "rejeitada", "erro_403", "erro_404"])
        .eq("resolved", false),
    ]);
    return { signFails: signFails.count ?? 0, photoIssues: photoIssues.count ?? 0 };
  });
