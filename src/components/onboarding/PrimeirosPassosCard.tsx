import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { getZapiStatus } from "@/server/zapi.functions";
import {
  Sparkles, Check, ChevronRight, X, Plug, Users, Wallet,
  ClipboardList, Rocket, Loader2,
} from "lucide-react";

type Passo = {
  id: string;
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
  done: boolean;
  to: string;
  cta: string;
};

const STORAGE_KEY = "mp.onboarding.dismissed";

/**
 * Checklist de primeiro acesso para o nutricionista (admin/equipe).
 * Aparece somente:
 * - se o usuário tem permissão de edição
 * - se nem todos os passos foram concluídos
 * - se o usuário não dispensou manualmente
 */
export function PrimeirosPassosCard() {
  const { canEdit, crmUser } = useAuth();
  const fetchZapi = useServerFn(getZapiStatus);

  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [counts, setCounts] = useState({
    alunos: 0,
    planos: 0,
    pontosContato: 0,
  });
  const [zapiOk, setZapiOk] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  useEffect(() => {
    if (!canEdit) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const [aRes, pRes, pcRes] = await Promise.all([
        supabase.from("alunos").select("id", { count: "exact", head: true }),
        supabase.from("planos_catalogo").select("id", { count: "exact", head: true }),
        supabase.from("pontos_contato").select("id", { count: "exact", head: true }),
      ]);
      let zOk = false;
      try {
        const z = (await fetchZapi()) as Record<string, unknown> | null;
        if (z && typeof z === "object") {
          // Prioridade: allConfigured (formato atual) → connected (futuro/legado)
          // → inferência via subcampos { instance, token, clientToken }.configured
          if (typeof z.allConfigured === "boolean") {
            zOk = z.allConfigured;
          } else if (typeof z.connected === "boolean") {
            zOk = z.connected;
          } else {
            const sub = ["instance", "token", "clientToken"] as const;
            zOk = sub.every((k) => {
              const v = z[k] as { configured?: boolean } | undefined;
              return !!v?.configured;
            });
          }
        }
      } catch {
        // Falha silenciosa: mantém passo como pendente, não bloqueia o card.
        zOk = false;
      }
      if (cancelled) return;
      setCounts({
        alunos: aRes.count ?? 0,
        planos: pRes.count ?? 0,
        pontosContato: pcRes.count ?? 0,
      });
      setZapiOk(zOk);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [canEdit, fetchZapi]);

  const passos: Passo[] = useMemo(() => [
    {
      id: "perfil",
      titulo: "Confirme seu perfil",
      descricao: "Verifique seu nome e e-mail de acesso.",
      icone: <Users className="h-4 w-4" />,
      done: !!crmUser?.nome,
      to: "/configuracoes/usuarios",
      cta: "Abrir usuários",
    },
    {
      id: "zapi",
      titulo: "Conecte o WhatsApp",
      descricao: "Integre a Z-API para envio automático de mensagens.",
      icone: <Plug className="h-4 w-4" />,
      done: zapiOk,
      to: "/configuracoes/conexoes",
      cta: "Configurar conexão",
    },
    {
      id: "planos",
      titulo: "Cadastre seus planos",
      descricao: "Defina valores e prazos dos seus planos comerciais.",
      icone: <Wallet className="h-4 w-4" />,
      done: counts.planos > 0,
      to: "/financeiro/planos",
      cta: "Criar plano",
    },
    {
      id: "pontos",
      titulo: "Revise os pontos de contato",
      descricao: "Mensagens automáticas D+7 / D+21 e follow-ups.",
      icone: <ClipboardList className="h-4 w-4" />,
      done: counts.pontosContato > 0,
      to: "/configuracoes/automacoes",
      cta: "Ver automações",
    },
    {
      id: "aluno",
      titulo: "Adicione seu primeiro aluno",
      descricao: "Cadastre e envie a anamnese para iniciar o acompanhamento.",
      icone: <Rocket className="h-4 w-4" />,
      done: counts.alunos > 0,
      to: "/alunos",
      cta: "Ir para alunos",
    },
  ], [crmUser?.nome, zapiOk, counts]);

  const total = passos.length;
  const concluidos = passos.filter((p) => p.done).length;
  const tudoFeito = concluidos === total;

  if (!canEdit) return null;
  if (dismissed) return null;
  if (loading) return null;
  if (tudoFeito) return null;

  const proximo = passos.find((p) => !p.done);

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-rose-50/60 via-background to-background shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-border/60">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-rose-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-semibold truncate">
              Primeiros passos
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {concluidos}/{total} concluídos
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            Configure o essencial para começar a operar.
          </p>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted"
        >
          {collapsed ? "Expandir" : "Recolher"}
        </button>
        <button
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, "1");
            setDismissed(true);
          }}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          title="Dispensar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Barra de progresso */}
      <div className="h-1.5 bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(concluidos / total) * 100}%` }}
        />
      </div>

      {!collapsed && (
        <ul className="divide-y divide-border/60">
          {passos.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                p.done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {p.done ? <Check className="w-4 h-4" /> : p.icone}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${p.done ? "line-through text-muted-foreground" : ""}`}>
                  {p.titulo}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {p.descricao}
                </div>
              </div>
              {!p.done && (
                <Link
                  to={p.to}
                  className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md shrink-0 ${
                    p.id === proximo?.id
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "bg-muted text-foreground hover:bg-muted/70"
                  }`}
                >
                  {p.cta} <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Loader silencioso reutilizável caso queira reaproveitar */
export function _OnboardingLoader() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> carregando…
    </div>
  );
}