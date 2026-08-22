import { useCallback, useEffect, useRef, useState } from "react";
import { useAlunoSession } from "./aluno-session";
import { getAlunoDashboard } from "@/server/aluno-auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { getAlunoSession, setAlunoSession } from "./aluno-session";
import { readCache, writeCache } from "./swr-cache";

const STALE_MS = 60_000; // dados < 60s são considerados frescos

type Dashboard = Awaited<ReturnType<typeof getAlunoDashboard>>;

export function useAlunoDashboard() {
  const { session, hydrated } = useAlunoSession();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refetchRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!hydrated || !session?.id) return;
    const alunoId = session.id;
    const cacheKey = `aluno-dashboard:${alunoId}`;
    const cachedEntry = readCache<{ data: Dashboard; ts: number }>(cacheKey);
    const cached = cachedEntry?.data ?? null;
    const isFresh = !!cachedEntry && Date.now() - cachedEntry.ts < STALE_MS;
    if (cached) {
      setData(cached);
      setLoading(false);
    }
    let cancelled = false;
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchData = async (showLoader = false) => {
      if (showLoader) setLoading(true);
      try {
        const r = await getAlunoDashboard();
        if (!cancelled) {
          setData(r as Dashboard);
          writeCache(cacheKey, { data: r, ts: Date.now() });
          setError(null);
          // Sincroniza avatar na sessão para refletir em todas as páginas
          const fotoUrl = (r as any)?.aluno?.foto_url ?? null;
          const cur = getAlunoSession();
          if (cur && cur.avatarUrl !== fotoUrl) {
            setAlunoSession({ ...cur, avatarUrl: fotoUrl });
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Falha ao carregar");
      } finally {
        if (!cancelled && showLoader) setLoading(false);
      }
    };

    // Se cache está fresco (<60s), pula revalidação inicial para evitar
    // 12 queries a cada navegação entre abas do aluno.
    if (!isFresh) {
      fetchData(!cached);
    }

    // Debounce refetch para múltiplos eventos próximos
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => fetchData(false), 400);
    };
    refetchRef.current = scheduleRefetch;
    const onManual = (e: Event) => {
      // Patch otimista: aplica check-in recém-salvo no cache imediatamente,
      // sem esperar o roundtrip do refetch.
      const detail = (e as CustomEvent).detail as
        | { optimisticCheckin?: any }
        | undefined;
      const checkin = detail?.optimisticCheckin;
      if (checkin && !cancelled) {
        setData((prev) => {
          if (!prev) return prev;
          const list = Array.isArray((prev as any).checkins)
            ? [...(prev as any).checkins]
            : [];
          const idx = list.findIndex(
            (c: any) => c?.data_checkin === checkin.data_checkin,
          );
          if (idx >= 0) list[idx] = { ...list[idx], ...checkin };
          else list.unshift(checkin);
          const next = { ...(prev as any), checkins: list };
          writeCache(cacheKey, { data: next, ts: Date.now() });
          return next as Dashboard;
        });
      }
      scheduleRefetch();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("aluno-dashboard-refetch", onManual);
    }

    const channel = supabase
      .channel(`aluno-perfil-${alunoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transacoes", filter: `aluno_id=eq.${alunoId}` },
        scheduleRefetch
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "entregas_dia", filter: `aluno_id=eq.${alunoId}` },
        scheduleRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "alunos", filter: `id=eq.${alunoId}` },
        scheduleRefetch
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (refetchTimer) clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
      if (typeof window !== "undefined") {
        window.removeEventListener("aluno-dashboard-refetch", onManual);
      }
    };
  }, [hydrated, session?.id]);

  const refetch = useCallback(() => {
    refetchRef.current?.();
  }, []);

  return { data, loading, error, refetch };
}

export function triggerAlunoDashboardRefetch(optimisticCheckin?: {
  data_checkin: string;
  score_gerado?: number | null;
  sono_horas?: number | null;
  qualidade_sono?: number | null;
  energia?: number | null;
  humor?: number | null;
}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("aluno-dashboard-refetch", {
      detail: optimisticCheckin ? { optimisticCheckin } : undefined,
    }),
  );
}