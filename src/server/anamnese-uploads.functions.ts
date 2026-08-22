import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

const BUCKET = "anamnese-uploads";
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10; // 10 anos
const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const RESIGN_TTL = 60 * 60 * 24 * 7; // 7 dias para signed URLs geradas on-demand

const ALLOWED_PREFIXES = [
  "anamnese/",
  "feedback_mensal/",
  "feedback_quinzenal/",
  "avaliacoes/",
  "avaliacao-shape/",
];

// Prefixos que pertencem ao fluxo público de formulário (validados por token).
const PUBLIC_TOKEN_PREFIXES: Array<{ prefix: string; tipo: string }> = [
  { prefix: "anamnese/", tipo: "anamnese" },
  { prefix: "feedback_mensal/", tipo: "feedback_mensal" },
  { prefix: "feedback_quinzenal/", tipo: "feedback_quinzenal" },
];

// Apenas estes content-types são aceitos no upload.
const ALLOWED_CONTENT_TYPES = new Set<string>([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

function sanitizeExt(ext: string | undefined | null): string {
  const e = (ext || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!e) return "bin";
  return e.slice(0, 6);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Verifica se a request veio de um usuário CRM autenticado.
 * Retorna o user id se válido, ou null caso contrário.
 */
async function verifyCrmAuth(): Promise<string | null> {
  try {
    const authHeader = getRequestHeader("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return null;
    const sb = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await sb.auth.getClaims(token);
    if (error || !data?.claims?.sub) return null;
    const uid = data.claims.sub as string;
    const { data: crm } = await supabaseAdmin
      .from("usuarios_crm")
      .select("id, ativo")
      .eq("id", uid)
      .maybeSingle();
    if (!crm || !crm.ativo) return null;
    return uid;
  } catch {
    return null;
  }
}

/**
 * Valida se o token corresponde a um formulário existente e ainda não respondido,
 * e se o prefixo solicitado é compatível com o tipo do formulário.
 * Retorna ok=true quando válido.
 */
async function verifyPublicToken(
  token: string | undefined | null,
  prefix: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (!token || typeof token !== "string") return { ok: false, reason: "token ausente" };
  const cleanToken = token.trim();
  if (cleanToken.length < 8 || cleanToken.length > 200) return { ok: false, reason: "token inválido" };

  const match = PUBLIC_TOKEN_PREFIXES.find((p) => prefix.startsWith(p.prefix));
  if (!match) return { ok: false, reason: "prefixo público inválido" };

  // O caminho público deve ser exatamente "<prefixo>/<token>/..." para evitar
  // que um token válido seja usado para gravar em pasta de outro formulário.
  const expected = `${match.prefix}${cleanToken}/`;
  if (!prefix.startsWith(expected)) {
    return { ok: false, reason: "token não corresponde ao caminho" };
  }

  const { data: form, error } = await supabaseAdmin
    .from("formularios")
    .select("id, tipo, respondido")
    .eq("token", cleanToken)
    .maybeSingle();
  if (error || !form) return { ok: false, reason: "formulário inexistente" };
  if (form.respondido) return { ok: false, reason: "formulário já respondido" };
  if (form.tipo !== match.tipo) return { ok: false, reason: "tipo do formulário não bate com o caminho" };

  return { ok: true };
}

/**
 * Upload seguro para o bucket anamnese-uploads.
 * Aceita arquivo em base64 vindo do navegador (aluno público OU equipe autenticada).
 * Identidade obrigatória: JWT de usuário CRM autenticado OU token público válido
 * de um formulário ainda não respondido. Sem identidade -> 401.
 * Retorna uma URL assinada de longa duração para visualização posterior.
 */
export const uploadAnamneseFile = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      pathPrefix: string;
      filename: string;
      contentType: string;
      base64: string;
      token?: string;
    }) => {
      if (!data || typeof data !== "object") throw new Error("payload inválido");
      if (!data.pathPrefix || typeof data.pathPrefix !== "string") {
        throw new Error("pathPrefix obrigatório");
      }
      if (!data.filename || typeof data.filename !== "string") {
        throw new Error("filename obrigatório");
      }
      if (!data.contentType || typeof data.contentType !== "string") {
        throw new Error("contentType obrigatório");
      }
      if (!data.base64 || typeof data.base64 !== "string") {
        throw new Error("base64 obrigatório");
      }
      const prefix = data.pathPrefix.replace(/^\/+/, "").replace(/\.\./g, "");
      if (!ALLOWED_PREFIXES.some((p) => prefix.startsWith(p))) {
        throw new Error("pathPrefix não permitido");
      }
      return {
        pathPrefix: prefix,
        filename: data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80),
        contentType: data.contentType,
        base64: data.base64,
        token: typeof data.token === "string" ? data.token.trim().slice(0, 200) : undefined,
      };
    },
  )
  .handler(async ({ data }) => {
    try {
      // 1) IDENTIDADE: aceita CRM autenticado OU token público válido.
      const crmUserId = await verifyCrmAuth();
      let isPublicTokenAuth = false;
      if (!crmUserId) {
        const tk = await verifyPublicToken(data.token, data.pathPrefix);
        if (!tk.ok) {
          console.warn("[uploadAnamneseFile] auth failed:", tk.reason || "sem credenciais");
          return { url: null, error: "Não autorizado" };
        }
        isPublicTokenAuth = true;
      } else {
        // CRM não pode usar prefixos públicos para forjar arquivos de fluxo público
        // sem token válido — força que prefixos públicos exijam token também.
        const isPublicPrefix = PUBLIC_TOKEN_PREFIXES.some((p) =>
          data.pathPrefix.startsWith(p.prefix),
        );
        if (isPublicPrefix) {
          const tk = await verifyPublicToken(data.token, data.pathPrefix);
          if (!tk.ok) {
            console.warn("[uploadAnamneseFile] CRM em prefixo público sem token válido:", tk.reason);
            return { url: null, error: "Token de formulário inválido" };
          }
        }
      }

      // 2) Content-type permitido
      const ctNorm = (data.contentType || "").toLowerCase().split(";")[0].trim();
      if (!ALLOWED_CONTENT_TYPES.has(ctNorm)) {
        return { url: null, error: "Tipo de arquivo não permitido" };
      }

      const buf = Buffer.from(data.base64, "base64");
      if (!buf.length) {
        return { url: null, error: "Arquivo vazio" };
      }
      if (buf.length > MAX_BYTES) {
        return { url: null, error: "Arquivo maior que 20MB" };
      }

      const dotIdx = data.filename.lastIndexOf(".");
      const ext = sanitizeExt(dotIdx >= 0 ? data.filename.slice(dotIdx + 1) : "");

      // Nome de arquivo determinado pelo SERVIDOR (UUID + timestamp).
      // O nome enviado pelo cliente é ignorado para evitar overwrite/path traversal.
      const uuid =
        typeof crypto !== "undefined" && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : `${Date.now()}-${randomSuffix()}-${randomSuffix()}`;
      const finalPath = `${data.pathPrefix}${uuid}.${ext}`;

      const { error: upErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(finalPath, buf, {
          contentType: data.contentType || "application/octet-stream",
          upsert: false, // bloqueia overwrite
        });
      if (upErr) {
        console.error("[uploadAnamneseFile] upload error", upErr);
        return { url: null, error: upErr.message || "Falha ao subir arquivo" };
      }

      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(finalPath, SIGNED_URL_TTL);
      if (signErr || !signed?.signedUrl) {
        console.error("[uploadAnamneseFile] sign error", signErr);
        return { url: null, error: signErr?.message || "Falha ao gerar URL" };
      }

      try {
        const u = new URL(signed.signedUrl);
        console.info(
          `[uploadAnamneseFile] ok auth=${crmUserId ? "crm" : "public_token"} host=${u.host} path=${u.pathname}`,
        );
      } catch {
        console.info("[uploadAnamneseFile] ok (url parse falhou)");
      }

      return { url: signed.signedUrl, error: null };
    } catch (e: any) {
      console.error("[uploadAnamneseFile] exception", e);
      return { url: null, error: e?.message || "Erro inesperado" };
    }
  });

/**
 * Extrai o path do objeto a partir de uma URL pública, signed ou de um path puro
 * do bucket anamnese-uploads. Retorna null se não pertencer ao bucket.
 */
function extractObjectPath(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // path puro (não começa com http)
  if (!/^https?:\/\//i.test(trimmed)) {
    const clean = trimmed.replace(/^\/+/, "").replace(/\.\./g, "");
    return clean || null;
  }

  try {
    const u = new URL(trimmed);
    const marker = `/storage/v1/object/`;
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    let rest = u.pathname.slice(idx + marker.length);
    // formatos: public/<bucket>/<path>, sign/<bucket>/<path>, authenticated/<bucket>/<path>
    const parts = rest.split("/");
    if (parts.length < 3) return null;
    const [, bucket, ...pathParts] = parts;
    if (bucket !== BUCKET) return null;
    const path = pathParts.join("/").replace(/\.\./g, "");
    return path || null;
  } catch {
    return null;
  }
}

/**
 * Recebe uma lista de URLs (públicas ou assinadas) ou paths do bucket
 * anamnese-uploads e devolve um mapa { urlOriginal -> signedUrl | null }.
 * Usado pelo frontend para exibir fotos de evolução, mesmo as antigas
 * salvas como URL pública (bucket é privado).
 */
export const signAnamneseUrls = createServerFn({ method: "POST" })
  .inputValidator((data: { urls: string[] }) => {
    if (!data || !Array.isArray(data.urls)) {
      throw new Error("urls obrigatório (array)");
    }
    return { urls: data.urls.filter((u) => typeof u === "string" && u.trim().length > 0).slice(0, 100) };
  })
  .handler(async ({ data }) => {
    const result: Record<string, string | null> = {};
    if (!data.urls.length) return { map: result, error: null as string | null };
    console.info(`[signAnamneseUrls] in: ${data.urls.length} urls`);

    // url original -> path
    const pathByUrl = new Map<string, string>();
    const uniquePaths = new Set<string>();
    for (const original of data.urls) {
      const path = extractObjectPath(original);
      if (path) {
        pathByUrl.set(original, path);
        uniquePaths.add(path);
      } else {
        result[original] = null;
      }
    }

    if (uniquePaths.size === 0) {
      return { map: result, error: null };
    }

    try {
      const paths = Array.from(uniquePaths);
      console.info(`[signAnamneseUrls] resolving ${paths.length} unique paths`);
      const { data: signedList, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrls(paths, RESIGN_TTL);

      if (error) {
        console.error("[signAnamneseUrls] createSignedUrls error", error);
        try {
          await supabaseAdmin.from("system_logs").insert({
            event_type: "signAnamneseUrls_failed",
            module: "anamnese-uploads",
            severity: "error",
            description: "Falha ao gerar signed URLs para fotos",
            error_message: error.message || String(error),
            payload_summary: { paths_count: paths.length, sample_paths: paths.slice(0, 5) },
            resolved: false,
          });
        } catch (logErr) {
          console.error("[signAnamneseUrls] failed logging system error", logErr);
        }
        for (const original of data.urls) {
          if (!(original in result)) result[original] = null;
        }
        return { map: result, error: error.message };
      }

      const signedByPath = new Map<string, string | null>();
      for (const item of signedList || []) {
        signedByPath.set(item.path || "", item.error ? null : item.signedUrl || null);
      }

      for (const original of data.urls) {
        if (original in result) continue;
        const path = pathByUrl.get(original);
        result[original] = path ? signedByPath.get(path) ?? null : null;
      }

      return { map: result, error: null };
    } catch (e: any) {
      console.error("[signAnamneseUrls] exception", e);
      try {
        await supabaseAdmin.from("system_logs").insert({
          event_type: "signAnamneseUrls_failed",
          module: "anamnese-uploads",
          severity: "critical",
          description: "Exceção ao gerar signed URLs para fotos",
          error_message: e?.message || String(e),
          stack_trace: e?.stack || null,
          payload_summary: { urls_count: data.urls.length },
          resolved: false,
        });
      } catch (logErr) {
        console.error("[signAnamneseUrls] failed logging system exception", logErr);
      }
      for (const original of data.urls) {
        if (!(original in result)) result[original] = null;
      }
      return { map: result, error: e?.message || "Erro inesperado" };
    }
  });
