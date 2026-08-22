import { useEffect, useMemo, useState } from "react";
import { signAnamneseUrls } from "@/server/anamnese-uploads.functions";

// Cache em memória, por sessão. Evita re-assinar a mesma URL várias vezes.
const cache = new Map<string, string | null>();
const pendingResolvers = new Map<string, Array<() => void>>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Detecta signed URLs do Supabase Storage que ainda estão dentro da validade.
 * O token tem payload base64url JSON com `exp` (unix seconds).
 * Se ainda for válido por >24h, podemos usar a URL como veio (sem re-assinar).
 */
function isSignedUrlAindaValida(url: string): boolean {
  try {
    if (!url.includes("/storage/v1/object/sign/")) return false;
    const u = new URL(url);
    const token = u.searchParams.get("token");
    if (!token) return false;
    const parts = token.split(".");
    if (parts.length < 2) return false;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = payload.length % 4 ? "=".repeat(4 - (payload.length % 4)) : "";
    const json = JSON.parse(atob(payload + pad));
    if (typeof json?.exp !== "number") return false;
    const nowSec = Math.floor(Date.now() / 1000);
    return json.exp - nowSec > 60 * 60 * 24; // >24h
  } catch {
    return false;
  }
}

function scheduleFetch(urls: string[]): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const url of urls) {
    if (cache.has(url)) continue;
    let bucket = pendingResolvers.get(url);
    if (!bucket) {
      bucket = [];
      pendingResolvers.set(url, bucket);
    }
    promises.push(new Promise<void>((res) => bucket!.push(res)));
  }

  if (flushTimer == null && pendingResolvers.size > 0) {
    flushTimer = setTimeout(async () => {
      flushTimer = null;
      const batch = Array.from(pendingResolvers.keys());
      const resolvers = batch.map((u) => pendingResolvers.get(u) || []);
      pendingResolvers.clear();
      try {
        const res = await signAnamneseUrls({ data: { urls: batch } });
        const map = res?.map || {};
        for (const u of batch) cache.set(u, map[u] ?? null);
      } catch (e) {
        console.error("[useSignedAnamneseUrls] erro", e);
        for (const u of batch) cache.set(u, null);
      } finally {
        for (const arr of resolvers) for (const r of arr) r();
      }
    }, 30);
  }

  return Promise.all(promises).then(() => undefined);
}

/**
 * Recebe uma lista de URLs (públicas, assinadas ou paths) do bucket
 * anamnese-uploads e devolve um resolvedor que retorna a signed URL fresca.
 * URLs que não pertencem ao bucket são devolvidas como vieram (fallback).
 */
export function useSignedAnamneseUrls(urls: Array<string | null | undefined>) {
  const list = useMemo(
    () =>
      Array.from(
        new Set(
          (urls || [])
            .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
            // URLs já assinadas e válidas não precisam de round-trip ao servidor
            .filter((u) => !isSignedUrlAindaValida(u)),
        ),
      ),
    // serialize para estabilidade entre renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify((urls || []).filter(Boolean))],
  );

  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const missing = list.filter((u) => !cache.has(u));
    if (missing.length === 0) return;

    setLoading(true);
    void scheduleFetch(missing).then(() => {
      if (!cancelled) {
        setLoading(false);
        setTick((t) => t + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [list]);

  function resolve(url: string | null | undefined): string {
    if (!url) return "";
    // Signed URL ainda válida: usa direto, evita falha de re-assinamento
    if (isSignedUrlAindaValida(url)) return url;
    const ehBucket = url.includes("anamnese-uploads");
    // data URL, http externo, ou path puro: tenta resolver se for do bucket
    if (!ehBucket && !/^[a-z0-9_/\-.]+$/i.test(url)) {
      return url;
    }
    if (cache.has(url)) {
      const signed = cache.get(url);
      // Se o cache marcou como null mas é uma URL pública do bucket privado,
      // devolver a URL original NÃO funciona (404). Devolve "" para o componente
      // mostrar fallback "imagem indisponível".
      if (signed) return signed;
      if (ehBucket && url.includes("/object/public/")) return "";
      return url;
    }
    return url; // ainda carregando
  }

  // tick é referenciado para forçar re-render quando o cache muda
  void tick;
  return { resolve, loading };
}