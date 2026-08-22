import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "anamnese-uploads";
const RESIGN_TTL = 60 * 60 * 24 * 7;

function extractObjectPath(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    const clean = trimmed.replace(/^\/+/, "").replace(/\.\./g, "");
    return clean || null;
  }
  try {
    const u = new URL(trimmed);
    const marker = `/storage/v1/object/`;
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    const rest = u.pathname.slice(idx + marker.length);
    const parts = rest.split("/");
    if (parts.length < 3) return null;
    const [, bucket, ...pathParts] = parts;
    if (bucket !== BUCKET) return null;
    return pathParts.join("/").replace(/\.\./g, "") || null;
  } catch {
    return null;
  }
}

export const listPhotoAudit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: {
    from?: string; to?: string; alunoId?: string; photoType?: string;
    source?: string; urlStatus?: string; onlyErrors?: boolean;
    onlyResign?: boolean; search?: string; limit?: number;
  }) => d || {})
  .handler(async ({ data }) => {
    let q = supabaseAdmin.from("photo_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 300);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.alunoId) q = q.eq("aluno_id", data.alunoId);
    if (data.photoType) q = q.eq("photo_type", data.photoType);
    if (data.source) q = q.eq("source", data.source);
    if (data.urlStatus) q = q.eq("url_status", data.urlStatus);
    if (data.onlyErrors) q = q.in("url_status", ["expirada", "rejeitada", "sem_assinatura", "erro_403", "erro_404", "invalida"]);
    if (data.onlyResign) q = q.eq("needs_resign", true);
    const { data: rows, error } = await q;
    if (error) return { rows: [], cards: { ativas: 0, expiradas: 0, rejeitadas: 0, sem_assinatura: 0, alunos_resign: 0 }, error: error.message };

    const filtered = data.search
      ? (rows ?? []).filter((r) => (r.aluno_nome || "").toLowerCase().includes(data.search!.toLowerCase()))
      : rows ?? [];

    // cards (sobre o conjunto carregado)
    const cards = {
      ativas: filtered.filter((r) => r.url_status === "ativa").length,
      expiradas: filtered.filter((r) => r.url_status === "expirada").length,
      rejeitadas: filtered.filter((r) => r.url_status === "rejeitada").length,
      sem_assinatura: filtered.filter((r) => r.url_status === "sem_assinatura").length,
      alunos_resign: new Set(filtered.filter((r) => r.needs_resign && !r.resolved).map((r) => r.aluno_id)).size,
    };
    return { rows: filtered, cards, error: null };
  });

export const reassinarUrl = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { logId: string }) => {
    if (!d?.logId) throw new Error("logId obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const { data: log } = await supabaseAdmin.from("photo_audit_logs").select("*").eq("id", data.logId).maybeSingle();
    if (!log) return { ok: false, error: "Registro não encontrado", signedUrl: null };
    const path = extractObjectPath(log.original_url || log.signed_url || "");
    if (!path) {
      await supabaseAdmin.from("photo_audit_logs").update({
        url_status: "invalida", error_reason: "URL não pertence ao bucket",
        last_sign_attempt_at: new Date().toISOString(),
        sign_attempts: (log.sign_attempts ?? 0) + 1,
      }).eq("id", data.logId);
      return { ok: false, error: "URL não pertence ao bucket", signedUrl: null };
    }
    const { data: signed, error: signErr } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, RESIGN_TTL);
    const now = new Date().toISOString();
    if (signErr || !signed?.signedUrl) {
      await supabaseAdmin.from("photo_audit_logs").update({
        url_status: "rejeitada", error_reason: signErr?.message || "Falha ao assinar",
        last_sign_attempt_at: now, sign_attempts: (log.sign_attempts ?? 0) + 1, needs_resign: true,
      }).eq("id", data.logId);
      return { ok: false, error: signErr?.message || "Falha ao assinar", signedUrl: null };
    }
    await supabaseAdmin.from("photo_audit_logs").update({
      url_status: "ativa", signed_url: signed.signedUrl, error_reason: null,
      last_sign_attempt_at: now, sign_attempts: (log.sign_attempts ?? 0) + 1,
      needs_resign: false, resolved: true, resolved_at: now,
    }).eq("id", data.logId);
    return { ok: true, error: null, signedUrl: signed.signedUrl };
  });

export const marcarFotoResolvida = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; notes?: string }) => {
    if (!d?.id) throw new Error("id obrigatório");
    return d;
  })
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("photo_audit_logs").update({
      resolved: true, needs_resign: false,
      resolved_at: new Date().toISOString(),
      notes: data.notes ?? null,
    }).eq("id", data.id);
    return { ok: !error, error: error?.message ?? null };
  });

/**
 * Varre os formularios recentes, extrai todas as URLs de fotos do dados_resposta
 * e cria/atualiza um registro em photo_audit_logs por (formulario_id, url).
 * Tenta assinar cada path; classifica o status conforme resultado.
 */
export const varrerFotosFormularios = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { dias?: number }) => ({ dias: d?.dias ?? 90 }))
  .handler(async ({ data }) => {
    const since = new Date(Date.now() - data.dias * 86400_000).toISOString();
    const { data: forms, error } = await supabaseAdmin
      .from("formularios")
      .select("id, aluno_id, tipo, dados_resposta, recebido_em")
      .eq("respondido", true)
      .gte("recebido_em", since)
      .limit(500);
    if (error) return { processed: 0, error: error.message };

    // hidrata nomes
    const ids = Array.from(new Set((forms ?? []).map((f) => f.aluno_id).filter(Boolean))) as string[];
    const { data: alunos } = ids.length
      ? await supabaseAdmin.from("alunos").select("id, nome").in("id", ids)
      : { data: [] as any[] };
    const nomeMap = Object.fromEntries((alunos ?? []).map((a: any) => [a.id, a.nome]));

    type Item = { aluno_id: string | null; aluno_nome: string | null; formulario_id: string; photo_type: string; source: string; original_url: string };
    const items: Item[] = [];
    for (const f of forms ?? []) {
      const fotos = (f.dados_resposta as any)?.fotos;
      if (!fotos || typeof fotos !== "object") continue;
      const source = f.tipo === "anamnese" ? "anamnese" : f.tipo === "feedback_mensal" ? "feedback_mensal" : "feedback_quinzenal";
      for (const [key, val] of Object.entries(fotos)) {
        if (Array.isArray(val)) {
          for (const v of val) {
            if (typeof v === "string" && v) items.push({ aluno_id: f.aluno_id, aluno_nome: nomeMap[f.aluno_id ?? ""] ?? null, formulario_id: f.id, photo_type: key, source, original_url: v });
          }
        } else if (typeof val === "string" && val) {
          items.push({ aluno_id: f.aluno_id, aluno_nome: nomeMap[f.aluno_id ?? ""] ?? null, formulario_id: f.id, photo_type: key, source, original_url: val });
        }
      }
    }

    if (!items.length) return { processed: 0, error: null };

    // Tenta assinar todos os paths
    const pathByItem = items.map((it) => ({ it, path: extractObjectPath(it.original_url) }));
    const uniquePaths = Array.from(new Set(pathByItem.map((p) => p.path).filter(Boolean) as string[]));
    let signedMap = new Map<string, string | null>();
    if (uniquePaths.length) {
      const { data: signedList } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(uniquePaths, RESIGN_TTL);
      for (const s of signedList ?? []) signedMap.set(s.path || "", s.error ? null : s.signedUrl || null);
    }

    const now = new Date().toISOString();
    let processed = 0;
    for (const { it, path } of pathByItem) {
      let url_status = "pendente";
      let error_reason: string | null = null;
      let signed_url: string | null = null;
      let needs_resign = false;
      let resolved = false;
      if (!path) {
        url_status = "invalida"; error_reason = "URL não pertence ao bucket"; needs_resign = false;
      } else {
        const s = signedMap.get(path);
        if (s) { url_status = "ativa"; signed_url = s; resolved = true; }
        else { url_status = "sem_assinatura"; error_reason = "Não foi possível assinar"; needs_resign = true; }
      }
      await supabaseAdmin.from("photo_audit_logs").upsert({
        aluno_id: it.aluno_id, aluno_nome: it.aluno_nome, formulario_id: it.formulario_id,
        photo_type: it.photo_type, source: it.source, original_url: it.original_url,
        signed_url, url_status, error_reason,
        last_sign_attempt_at: now, needs_resign, resolved, resolved_at: resolved ? now : null,
      }, { onConflict: "formulario_id,original_url" });
      processed++;
    }
    return { processed, error: null };
  });
