import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { requireAlunoAuth } from "./aluno-middleware";
import { decodeAndValidateImage } from "./image-validation.server";

export type FeedPost = {
  id: string;
  aluno_id: string;
  nome: string;
  username: string | null;
  foto_perfil: string | null;
  foto_url: string;
  legenda: string | null;
  created_at: string;
  likes: number;
  liked_by_me: boolean;
};

async function buildFeed(viewerId: string | null) {
  const { data: posts, error } = await supabaseAdmin
    .from("community_posts")
    .select("id, aluno_id, foto_url, legenda, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  if (!posts || posts.length === 0) return [] as FeedPost[];

  const alunoIds = Array.from(new Set(posts.map((p) => p.aluno_id)));
  const postIds = posts.map((p) => p.id);

  const [{ data: alunos }, { data: likes }, myLikes] = await Promise.all([
    supabaseAdmin
      .from("alunos")
      .select("id, nome, username, foto_url")
      .in("id", alunoIds),
    supabaseAdmin
      .from("community_likes")
      .select("post_id")
      .in("post_id", postIds),
    viewerId
      ? supabaseAdmin
          .from("community_likes")
          .select("post_id")
          .eq("aluno_id", viewerId)
          .in("post_id", postIds)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
  ]);

  const alunoMap = new Map((alunos ?? []).map((a: any) => [a.id as string, a]));
  const likeCount = new Map<string, number>();
  for (const l of likes ?? []) {
    likeCount.set((l as any).post_id, (likeCount.get((l as any).post_id) ?? 0) + 1);
  }
  const mine = new Set(((myLikes as any).data ?? []).map((l: any) => l.post_id));

  return posts.map((p) => {
    const a = alunoMap.get(p.aluno_id) as any;
    return {
      id: p.id,
      aluno_id: p.aluno_id,
      nome: a?.nome ?? "Aluno",
      username: a?.username ?? null,
      foto_perfil: a?.foto_url ?? null,
      foto_url: p.foto_url,
      legenda: p.legenda ?? null,
      created_at: p.created_at,
      likes: likeCount.get(p.id) ?? 0,
      liked_by_me: mine.has(p.id),
    } as FeedPost;
  });
}

export const listarFeed = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .handler(async ({ context }) => buildFeed(context.alunoId));

export const criarPost = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        file_base64: z.string().min(20),
        content_type: z.string().min(3).max(64),
        legenda: z.string().max(500).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const aluno_id = context.alunoId;
    const v = decodeAndValidateImage(
      data.file_base64,
      data.content_type,
      8 * 1024 * 1024,
    );
    if (!v.ok) return { ok: false as const, error: v.error };
    const path = `comunidade/${aluno_id}/${crypto.randomUUID()}.${v.ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("aluno-fotos")
      .upload(path, v.buf, { contentType: v.mime, upsert: false });
    if (upErr) return { ok: false as const, error: upErr.message };
    const { data: post, error } = await supabaseAdmin
      .from("community_posts")
      .insert({
        aluno_id,
        foto_url: path,
        legenda: data.legenda ?? null,
      })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, post_id: post!.id };
  });

export const togglarLike = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        post_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const aluno_id = context.alunoId;
    const { data: existing } = await supabaseAdmin
      .from("community_likes")
      .select("post_id")
      .eq("post_id", data.post_id)
      .eq("aluno_id", aluno_id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin
        .from("community_likes")
        .delete()
        .eq("post_id", data.post_id)
        .eq("aluno_id", aluno_id);
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, liked: false };
    }
    const { error } = await supabaseAdmin
      .from("community_likes")
      .insert({ post_id: data.post_id, aluno_id });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, liked: true };
  });

export const apagarPost = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .inputValidator((input: unknown) =>
    z.object({ post_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("community_posts")
      .delete()
      .eq("id", data.post_id)
      .eq("aluno_id", context.alunoId);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const atualizarUsername = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        username: z
          .string()
          .min(3)
          .max(24)
          .regex(/^[a-z0-9._]+$/i, "Use letras, números, ponto ou _"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const aluno_id = context.alunoId;
    const handle = data.username.toLowerCase();
    const { data: existing } = await supabaseAdmin
      .from("alunos")
      .select("id")
      .ilike("username", handle)
      .neq("id", aluno_id)
      .maybeSingle();
    if (existing) return { ok: false as const, error: "Username já em uso" };
    const { error } = await supabaseAdmin
      .from("alunos")
      .update({ username: handle })
      .eq("id", aluno_id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, username: handle };
  });