import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HistoricoTab, type HistoricoCounts } from "@/components/caixa-saida/HistoricoTab";
import { AtrasadosTab } from "@/components/caixa-saida/AtrasadosTab";
import { LogsTab } from "@/components/caixa-saida/LogsTab";
import { CronJobsTab } from "@/components/caixa-saida/CronJobsTab";
import { Inbox, CalendarClock, AlertTriangle, CheckCircle2, XCircle, Send, FileClock, Timer } from "lucide-react";

export const Route = createFileRoute("/_app/caixa-saida")({
  component: CaixaSaidaPage,
});

type TabKey = "disparos" | "atrasados" | "logs" | "cron";
type StatusFilter = "todos" | "agendado" | "atrasado" | "executado" | "erro";

function CaixaSaidaPage() {
  const [counts, setCounts] = useState<HistoricoCounts | null>(null);
  const [tab, setTab] = useState<TabKey>("disparos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [filterNonce, setFilterNonce] = useState(0);

  function abrirComFiltro(s: StatusFilter) {
    setStatusFilter(s);
    setFilterNonce((n) => n + 1);
    setTab("disparos");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center gap-3">
        <Inbox className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Caixa de Saída</h1>
          <p className="text-sm text-muted-foreground">
            Saúde do motor, disparos, atrasos e logs.
          </p>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Agendados"
          value={counts?.agendado ?? null}
          icon={CalendarClock}
          tone="default"
          onClick={() => abrirComFiltro("agendado")}
        />
        <KpiCard
          label="Atrasados"
          value={counts?.atrasado ?? null}
          icon={AlertTriangle}
          tone={(counts?.atrasado ?? 0) > 0 ? "warn" : "default"}
          onClick={() => abrirComFiltro("atrasado")}
        />
        <KpiCard
          label="Executados"
          value={counts?.executado ?? null}
          icon={CheckCircle2}
          tone="ok"
          onClick={() => abrirComFiltro("executado")}
        />
        <KpiCard
          label="Com erro"
          value={counts?.erro ?? null}
          icon={XCircle}
          tone={(counts?.erro ?? 0) > 0 ? "danger" : "default"}
          onClick={() => abrirComFiltro("erro")}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <TabBtn active={tab === "disparos"} onClick={() => setTab("disparos")} icon={Send} label="Disparos" />
          <TabBtn active={tab === "atrasados"} onClick={() => setTab("atrasados")} icon={AlertTriangle} label="Atrasados / Erros" />
          <TabBtn active={tab === "logs"} onClick={() => setTab("logs")} icon={FileClock} label="Logs de entregas" />
          <TabBtn active={tab === "cron"} onClick={() => setTab("cron")} icon={Timer} label="Cron jobs" />
        </div>
      </div>

      <div>
        {tab === "disparos" && (
          <HistoricoTab
            key={filterNonce}
            initialStatus={statusFilter}
            onCountsChange={setCounts}
          />
        )}
        {tab === "atrasados" && <AtrasadosTab />}
        {tab === "logs" && <LogsTab />}
        {tab === "cron" && <CronJobsTab />}
      </div>
    </div>
  );
}

function KpiCard({
  label, value, icon: Icon, tone, onClick,
}: {
  label: string;
  value: number | null;
  icon: typeof Inbox;
  tone: "default" | "ok" | "warn" | "danger";
  onClick: () => void;
}) {
  const toneCls = {
    default: "border-border",
    ok: "border-emerald-500/40",
    warn: "border-amber-500/40",
    danger: "border-destructive/50",
  }[tone];
  const valueCls = {
    default: "text-foreground",
    ok: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
    danger: "text-destructive",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border bg-card p-4 hover:bg-muted/40 transition ${toneCls}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={`h-4 w-4 ${valueCls}`} />
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${valueCls}`}>
        {value === null ? "—" : value.toLocaleString("pt-BR")}
      </div>
    </button>
  );
}

function TabBtn({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: typeof Inbox; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2 text-sm transition-colors ${
        active
          ? "border-primary text-primary font-semibold"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
