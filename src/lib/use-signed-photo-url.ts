import { useEffect, useState } from "react";
import { getSignedPhotoUrls } from "@/server/aluno-fotos.functions";

export type FotoContext =
  | "avatar"
  | "comunidade"
  | "avaliacao"
  | "check_shape"
  | "perfil";

// TTL menor que o do servidor (15 min) para forçar renovação antes de expirar.
const CACHE_TTL_MS = 12 * 60 * 1000;

type CacheEntry = { url: string | null; expiresAt: number };
const cache = new Map<string, CacheEntry>();

type Pending = { resolve: () => void };
const pendingByContext = new Map<FotoContext, Map<string, Pending[]>>();
const flushTimers = new Map<FotoContext, ReturnType<typeof setTimeout>>();

function cacheKey(path: string, context: FotoContext) {
  return `${context}::${path}`;
}

function isValid(entry: CacheEntry | undefined): entry is CacheEntry {
  return !!entry && entry.expiresAt > Date.now();
}

function schedule(context: FotoContext, path: string): Promise<void> {
  let byPath = pendingByContext.get(context);
  if (!byPath) {
    byPath = new Map();
    pendingByContext.set(context, byPath);
  }
  let arr = byPath.get(path);
  if (!arr) {
    arr = [];
    byPath.set(path, arr);
  }
  const p = new Promise<void>((resolve) => arr!.push({ resolve }));

  if (!flushTimers.has(context)) {
    flushTimers.set(
      context,
      setTimeout(async () => {
        flushTimers.delete(context);
        const batch = pendingByContext.get(context);
        if (!batch) return;
        pendingByContext.delete(context);
        const paths = Array.from(batch.keys());
        try {
          const res = await getSignedPhotoUrls({
            data: { paths, context },
          });
          const expiresAt = Date.now() + CACHE_TTL_MS;
          const map = res.ok ? res.map : {};
          for (const path of paths) {
            cache.set(cacheKey(path, context), {
              url: map[path] ?? null,
              expiresAt,
            });
          }
        } catch {
          const expiresAt = Date.now() + 30 * 1000; // tenta de novo em 30s
          for (const path of paths) {
            cache.set(cacheKey(path, context), { url: null, expiresAt });
          }
        } finally {
          for (const [, listeners] of batch) {
            for (const l of listeners) l.resolve();
          }
        }
      }, 25),
    );
  }
  return p;
}

/** Converte URL pública antiga em path; devolve null se for inválido. */
function toPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(
    /\/storage\/v1\/object\/(?:public|sign)\/aluno-fotos\/(.+?)(?:\?|$)/,
  );
  if (m) return m[1];
  if (/^https?:\/\//i.test(s)) return null; // url externa
  return s;
}

/**
 * Resolve uma foto do bucket privado `aluno-fotos` em signed URL.
 * Aceita URL pública antiga (compat) ou path interno.
 * Devolve `null` enquanto carrega ou se não tiver permissão.
 */
export function useSignedPhotoUrl(
  raw: string | null | undefined,
  context: FotoContext,
): string | null {
  const path = toPath(raw);
  const key = path ? cacheKey(path, context) : null;
  const initial = key ? cache.get(key) : undefined;
  const [url, setUrl] = useState<string | null>(
    isValid(initial) ? initial.url : null,
  );

  useEffect(() => {
    let cancelled = false;
    if (!path || !key) {
      setUrl(null);
      return;
    }
    const entry = cache.get(key);
    if (isValid(entry)) {
      setUrl(entry.url);
      return;
    }
    void schedule(context, path).then(() => {
      if (cancelled) return;
      const e = cache.get(key);
      setUrl(e?.url ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [path, key, context]);

  return url;
}

/** Invalida o cache (útil após upload de nova foto). */
export function invalidateSignedPhoto(
  raw: string | null | undefined,
  context?: FotoContext,
) {
  const path = toPath(raw);
  if (!path) {
    if (!context) cache.clear();
    return;
  }
  if (context) {
    cache.delete(cacheKey(path, context));
    return;
  }
  for (const k of Array.from(cache.keys())) {
    if (k.endsWith(`::${path}`)) cache.delete(k);
  }
}
