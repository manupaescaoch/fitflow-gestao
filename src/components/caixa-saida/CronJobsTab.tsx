import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listarCronJobs,
  dispararCronJobAgora,
  type CronJobRow,
  type CronKpis,
} from "@/server/cron-monitor.functions";
import { CronHistoricoDrawer } from "./CronHistoricoDrawer";
import {
  RefreshCw, Play, History, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

function fmtRel(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const min = Math.floor(abs / 60_000);
  const h = Math.floor(min / 60);
  const d = Math.floor(h / 24);
  const label =
    d > 0 ? `${d}d` :
    h > 0 ? `${h}h` :
    min > 0 ? `${min}min` : `${Math.floor(abs / 1000)}s`;
  return diff >= 0 ? `há ${label}` : `em ${label}`;
}
function fmtDur(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
function fmtHora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function CronJobsTab() {
  const fnListar = useServerFn(listarCronJobs);
  const fnDisparar = useServerFn(dispararCronJobAgora);
  const [jobs, setJobs] = useState<CronJobRow[]>([]);
  const [kpis, setKpis] = useState<CronKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fnListar();
      setJobs(r.jobs);
      setKpis(r.kpis);
    } catch (e) {
      toast.error("Erro carregando cron jobs", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [fnListar]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  async function dispararAgora(jobname: string) {
    setRunning(jobname);
    try {
      const r = await fnDisparar({ data: { jobname } });
      if (r.ok) toast.success(`${jobname} executado`);
      else toast.error(`Falha em ${jobname}`, { description: r.erro });
      setTimeout(() => void load(), 1500);
    } catch (e) {
      toast.error("Erro disparando job", { description: (e as Error).message });
    } finally {
      setRunning(null);
    }
  }

  function statusBadge(j: CronJobRow) {
    if (!j.ultima) return <span className="text-xs text-muted-foreground">nunca rodou</span>;
    const s = j.ultima.status;
    const http = j.ultima.http_status;
    const ok = s === "succeeded" && (http == null || (http >= 200 && http < 300));
    if (ok) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> {s}{http ? ` · ${http}` : ""}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <XCircle className="h-3.5 w-3.5" /> {s}{http ? ` · ${http}` : ""}
      </span>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard
          label="Execuções OK (24h)"
          value={kpis?.ok_24h ?? null}
          icon={CheckCircle2}
          tone="ok"
        />
        <KpiCard
          label="Falhas (24h)"
          value={kpis?.fail_24h ?? null}
          icon={XCircle}
          tone={(kpis?.fail_24h ?? 0) > 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Última falha"
          stringValue={
            kpis?.ultima_falha_em
              ? `${kpis.ultima_falha_jobname} · ${fmtRel(kpis.ultima_falha_em)}`
              : "nenhuma"
          }
          icon={AlertTriangle}
          tone={kpis?.ultima_falha_em ? "warn" : "default"}
          onClick={kpis?.ultima_falha_jobname ? () => setDrawer(kpis.ultima_falha_jobname!) : undefined}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {jobs.length} jobs agendados · atualiza a cada 30s
        </p>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Job</th>
              <th className="text-left px-3 py-2">Agendamento</th>
              <th className="text-left px-3 py-2">Última execução</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Duração</th>
              <th className="text-left px-3 py-2">Próxima</th>
              <th className="text-right px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && jobs.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando…
              </td></tr>
            )}
            {jobs.map((j) => {
              const u = j.ultima;
              const isFail = !!u && (u.status !== "succeeded" || (u.http_status != null && (u.http_status < 200 || u.http_status >= 300)));
              return (
                <tr
                  key={j.jobid}
                  className={`border-t border-border ${isFail ? "bg-destructive/5" : ""}`}
                >
                  <td className="px-3 py-2 font-medium">
                    {j.jobname}
                    {!j.active && <span className="ml-2 text-xs text-muted-foreground">(inativo)</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{j.schedule}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div>{fmtRel(u?.start_time ?? null)}</div>
                    <div className="text-xs text-muted-foreground">{fmtHora(u?.start_time ?? null)}</div>
                  </td>
                  <td className="px-3 py-2">{statusBadge(j)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtDur(u?.duracao_ms ?? null)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {fmtRel(j.proxima)}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => void dispararAgora(j.jobname)}
                      disabled={running === j.jobname}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-border hover:bg-muted disabled:opacity-50"
                      title="Executar agora"
                    >
                      {running === j.jobname
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Play className="h-3 w-3" />} Rodar
                    </button>
                    <button
                      onClick={() => setDrawer(j.jobname)}
                      className="ml-1 inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-border hover:bg-muted"
                      title="Ver histórico"
                    >
                      <History className="h-3 w-3" /> Histórico
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && jobs.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Nenhum cron job agendado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {drawer && (
        <CronHistoricoDrawer jobname={drawer} onClose={() => setDrawer(null)} />
      )}
    </div>
  );
}

function KpiCard({
  label, value, stringValue, icon: Icon, tone, onClick,
}: {
  label: string;
  value?: number | null;
  stringValue?: string;
  icon: typeof CheckCircle2;
  tone: "default" | "ok" | "warn" | "danger";
  onClick?: () => void;
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
  const Content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className={`h-4 w-4 ${valueCls}`} />
      </div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${valueCls}`}>
        {stringValue !== undefined
          ? <span className="text-base font-semibold">{stringValue}</span>
          : (value == null ? "—" : value.toLocaleString("pt-BR"))}
      </div>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`text-left rounded-lg border bg-card p-4 hover:bg-muted/40 transition ${toneCls}`}>
        {Content}
      </button>
    );
  }
  return <div className={`rounded-lg border bg-card p-4 ${toneCls}`}>{Content}</div>;
}