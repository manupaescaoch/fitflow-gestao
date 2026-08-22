import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { getAlunoSessionServer } from "./aluno-session.server";

const BUCKET = "aluno-fotos";
const TTL_SECONDS = 900; // 15 min

const ContextSchema = z.enum([
  "avatar",
  "comunidade",
  "avaliacao",
  "check_shape",
  "perfil",
]);

type Ctx = z.infer<typeof ContextSchema>;

/** Converte uma URL pública antiga para path interno, ou devolve o próprio path. */
function normalizePath(raw: string): string | null {
  if (typeof raw !== "string") return null;
  let p = raw.trim();
  if (!p) return null;
  // URL pública antiga -> extrai sufixo
  const m = p.match(/\/storage\/v1\/object\/(?:public|sign)\/aluno-fotos\/(.+?)(?:\?|$)/);
  if (m) p = m[1];
  // Bloqueia URL absoluta de outros domínios
  if (/^https?:\/\//i.test(p)) return null;
  // path traversal
  if (p.includes("..") || p.includes("\\") || p.startsWith("/")) return null;
  if (!/^[A-Za-z0-9_\-./]+$/.test(p)) return null;
  return p;
}

async function resolveCaller(): Promise<
  | { kind: "aluno"; alunoId: string }
  | { kind: "equipe"; userId: string }
  | null
> {
  // 1) Sessão custom do aluno (cookie)
  try {
    const session = await getAlunoSessionServer();
    const alunoId = session.data?.aluno_id;
    if (alunoId) return { kind: "aluno", alunoId };
  } catch {
    // ignore
  }
  // 2) Equipe via Supabase Auth (Bearer)
  try {
    const req = getRequest();
    const auth = req?.headers?.get("authorization");
    if (!auth?.startsWith("Bearer ")) return null;
    const token = auth.slice("Bearer ".length).trim();
    if (!token) return null;
    const sb = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await sb.auth.getClaims(token);
    const userId = data?.claims?.sub;
    if (error || !userId) return null;
    const { data: ok } = await supabaseAdmin.rpc("is_equipe_or_admin", {
      _user_id: userId,
    });
    if (!ok) return null;
    return { kind: "equipe", userId };
  } catch {
    return null;
  }
}

function prefixOk(path: string, context: Ctx, alunoId?: string): boolean {
  // Prefixos esperados; tolerante a paths legados em `<aluno_id>/<arquivo>`.
  if (context === "comunidade") {
    return path.startsWith("posts/") || path.startsWith("comunidade/");
  }
  if (context === "avaliacao" || context === "check_shape") {
    if (!alunoId) return path.startsWith("avaliacoes/") || path.startsWith("alunos/");
    return (
      path.startsWith(`avaliacoes/${alunoId}/`) ||
      path.startsWith(`alunos/${alunoId}/`)
    );
  }
  // avatar / perfil: aceita layouts legados (`<aluno_id>/...`) e novos.
  return true;
}

async function autorizar(
  path: string,
  context: Ctx,
  caller: NonNullable<Awaited<ReturnType<typeof resolveCaller>>>,
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  if (caller.kind === "equipe") return { ok: true };

  // Aluno
  if (context === "comunidade") {
    return prefixOk(path, context) ? { ok: true } : { ok: false, motivo: "prefixo_invalido" };
  }
  if (context === "avaliacao" || context === "check_shape") {
    return prefixOk(path, context, caller.alunoId)
      ? { ok: true }
      : { ok: false, motivo: "fora_do_escopo" };
  }
  // avatar / perfil: o aluno logado pode ver avatares de qualquer aluno
  // (necessário pra ranking/comunidade/feed). Recusa apenas se o prefixo
  // bater em `avaliacoes/` (foto sensível travestida de avatar).
  if (path.startsWith("avaliacoes/")) {
    return { ok: false, motivo: "foto_sensivel" };
  }
  return { ok: true };
}

async function logAcesso(args: {
  caller: Awaited<ReturnType<typeof resolveCaller>>;
  context: Ctx;
  path: string;
  status: "autorizado" | "bloqueado";
  motivo?: string;
}) {
  try {
    const aluno_id =
      args.caller?.kind === "aluno" ? args.caller.alunoId : null;
    await supabaseAdmin.from("agente_logs").insert({
      tipo: "foto_acesso",
      aluno_id,
      metadata: {
        contexto: args.context,
        status: args.status,
        motivo: args.motivo ?? null,
        path_prefixo: args.path.split("/").slice(0, 2).join("/"),
        origem: args.caller?.kind === "equipe" ? "crm" : "portal_aluno",
        user_id: args.caller?.kind === "equipe" ? args.caller.userId : null,
      },
    });
  } catch {
    /* não falhar a chamada por causa do log */
  }
}

export const getSignedPhotoUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        path: z.string().min(1).max(500),
        context: ContextSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const path = normalizePath(data.path);
    if (!path) return { ok: false as const, error: "path inválido" };

    const caller = await resolveCaller();
    if (!caller) {
      await logAcesso({ caller: null, context: data.context, path, status: "bloqueado", motivo: "sem_sessao" });
      return { ok: false as const, error: "Não autenticado" };
    }

    const perm = await autorizar(path, data.context, caller);
    if (!perm.ok) {
      await logAcesso({ caller, context: data.context, path, status: "bloqueado", motivo: perm.motivo });
      return { ok: false as const, error: "Sem permissão" };
    }

    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, TTL_SECONDS);
    if (error || !signed?.signedUrl) {
      await logAcesso({ caller, context: data.context, path, status: "bloqueado", motivo: "erro_signed" });
      return { ok: false as const, error: error?.message ?? "Falha ao gerar URL" };
    }

    await logAcesso({ caller, context: data.context, path, status: "autorizado" });
    return { ok: true as const, url: signed.signedUrl, expires_in: TTL_SECONDS };
  });

/** Batch: resolve várias paths de uma vez (mesmo contexto). */
export const getSignedPhotoUrls = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        paths: z.array(z.string().min(1).max(500)).min(1).max(60),
        context: ContextSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const caller = await resolveCaller();
    if (!caller) return { ok: false as const, error: "Não autenticado" };

    const map: Record<string, string | null> = {};
    await Promise.all(
      data.paths.map(async (raw) => {
        const path = normalizePath(raw);
        if (!path) {
          map[raw] = null;
          return;
        }
        const perm = await autorizar(path, data.context, caller);
        if (!perm.ok) {
          map[raw] = null;
          return;
        }
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(path, TTL_SECONDS);
        map[raw] = signed?.signedUrl ?? null;
      }),
    );
    return { ok: true as const, map, expires_in: TTL_SECONDS };
  });
