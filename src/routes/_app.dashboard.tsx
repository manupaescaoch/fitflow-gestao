import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, Users, UserPlus, RotateCcw, ClipboardList, FileWarning, Send, CheckCircle2, AlertTriangle, Clock, Percent, Hourglass } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getDashboardResumo, type DashboardResumo } from "@/server/dashboard.functions";
import { MODALIDADE_LABEL, fmtDate, fmtDateTime } from "@/lib/crm";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardGuard,
  head: () => ({
    meta: [
      { title: "Dashboard Administrativo | MPTEAM CRM" },
      { name: "description", content: "Painel administrativo com alunos ativos, planejamentos atrasados e status dos feedbacks da MPTEAM." },
      { property: "og:title", content: "Dashboard Administrativo | MPTEAM CRM" },
      { property: "og:description", content: "Indicadores gerais de alunos, entregas e feedbacks da MPTEAM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DashboardGuard() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !isAdmin) nav({ to: "/visao-geral" });
  }, [loading, isAdmin, nav]);
  if (loading || !isAdmin) return null;
  return <DashboardPage />;
}

function Kpi({
  icon: Icon, label, value, sub, tone = "default",
}: {
  icon: typeof Users; label: string; value: string | number; sub?: string;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  const toneClass =
    tone === "danger" ? "text-destructive"
    : tone === "warning" ? "text-amber-600"
    : tone === "success" ? "text-emerald-600"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs text-muted-foreground leading-tight">{label}</div>
          <Icon className={`h-4 w-4 ${toneClass}`} />
        </div>
        <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
        {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const fetchResumo = useServerFn(getDashboardResumo);
  const [data, setData] = useState<DashboardResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setData(await fetchResumo());
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar dashboard");
    } finally {
      setLoading(false);
    }
  }, [fetchResumo]);

  useEffect(() => { void load(); }, [load]);

  const v = (n?: number) => (loading && !data ? "…" : n ?? 0);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard Administrativo</h1>
          <p className="text-sm text-muted-foreground">
            Visão consolidada de alunos, entregas e feedbacks
            {data && ` · atualizado em ${fmtDateTime(data.atualizadoEm)}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </header>

      {erro && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">{erro}</CardContent>
        </Card>
      )}

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={Users} label="Alunos ativos" value={v(data?.alunosAtivos)} />
        <Kpi icon={UserPlus} label="Novos alunos (30d)" value={v(data?.novosAlunos30d)} tone="success" />
        <Kpi icon={RotateCcw} label="Renovações em 7 dias" value={v(data?.renovacoes7d)} tone="warning" />
        <Kpi icon={Hourglass} label="Aguardando anamnese" value={v(data?.aguardandoAnamnese)} />
        <Kpi icon={ClipboardList} label="Em produção" value={v(data?.emProducao)} />
        <Kpi
          icon={FileWarning}
          label="Planejamentos atrasados"
          value={v(data?.planejamentosAtrasados)}
          tone={data && data.planejamentosAtrasados > 0 ? "danger" : "default"}
          sub="Dieta ou treino não entregues"
        />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={Send} label="Feedbacks enviados (30d)" value={v(data?.feedbacksEnviados30d)} />
        <Kpi icon={CheckCircle2} label="Feedbacks preenchidos (30d)" value={v(data?.feedbacksPreenchidos30d)} tone="success" />
        <Kpi icon={Percent} label="Taxa de resposta" value={data ? `${data.taxaResposta}%` : "…"} />
        <Kpi
          icon={AlertTriangle}
          label="Feedbacks atrasados"
          value={v(data?.feedbacksAtrasados)}
          tone={data && data.feedbacksAtrasados > 0 ? "danger" : "default"}
          sub={data ? `${data.feedbacksAtrasadosMensais} mensais · ${data.feedbacksAtrasadosQuinzenais} quinzenais` : undefined}
        />
        <Kpi
          icon={AlertTriangle}
          label="Falhas de envio (7d)"
          value={v(data?.falhasEnvio7d)}
          tone={data && data.falhasEnvio7d > 0 ? "danger" : "default"}
        />
        <Kpi
          icon={Clock}
          label="Jobs pendentes atrasados"
          value={v(data?.jobsPendentesAtrasados)}
          tone={data && data.jobsPendentesAtrasados > 0 ? "warning" : "default"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Planejamentos atrasados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && !data && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {data && data.planejamentosAtrasadosLista.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma entrega pendente fora do prazo. 🎉</p>
            )}
            {data?.planejamentosAtrasadosLista.map((p) => (
              <Link
                key={`${p.aluno_id}-${p.data_referencia}`}
                to="/alunos/$id"
                params={{ id: p.aluno_id }}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.aluno_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Referência {fmtDate(p.data_referencia)} · {p.dias_atraso} dia(s) de atraso
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {p.falta_dieta && <Badge variant="destructive">Dieta</Badge>}
                  {p.falta_treino && <Badge variant="destructive">Treino</Badge>}
                </div>
              </Link>
            ))}
            {data && data.planejamentosAtrasados > data.planejamentosAtrasadosLista.length && (
              <p className="text-xs text-muted-foreground">
                +{data.planejamentosAtrasados - data.planejamentosAtrasadosLista.length} outros atrasos
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Alunos ativos por modalidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && !data && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {data?.alunosPorModalidade.map((m) => {
              const total = data.alunosAtivos || 1;
              const pct = Math.round((m.total / total) * 100);
              const label = (MODALIDADE_LABEL as Record<string, string>)[m.label] ?? "Sem modalidade";
              return (
                <div key={m.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{label}</span>
                    <span className="font-medium">{m.total} <span className="text-muted-foreground text-xs">({pct}%)</span></span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {data && data.alunosPorModalidade.length === 0 && (
              <p className="text-sm text-muted-foreground">Sem alunos ativos.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
