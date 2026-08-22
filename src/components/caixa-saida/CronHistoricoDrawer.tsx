import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { historicoCronJob } from "@/server/cron-monitor.functions";
import { X, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

type Execucao = {
  runid: number;
  start_time: string;
  end_time: string | null;
  status: string;
  return_message: string | null;
  http_status: number | null;
  duracao_ms: number | null;
};

function fmtDur(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
function fmtHora(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

export function CronHistoricoDrawer({ jobname, onClose }: { jobname: string; onClose: () => void }) {
  const fn = useServerFn(historicoCronJob);
  const [rows, setRows] = useState<Execucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const r = await fn({ data: { jobname, limit: 50 } });
        setRows(r.execucoes);
      } catch (e) {
        toast.error("Erro carregando histórico", { description: (e as Error).message });
      } finally {
        setLoading(false);
      }
    })();
  }, [fn, jobname]);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-2xl bg-background border-l border-border h-full overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-border px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{jobname}</h3>
            <p className="text-xs text-muted-foreground">Últimas 50 execuções</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Sem execuções registradas.</div>
          ) : (
            <div className="space-y-1.5">
              {rows.map((r) => {
                const ok = r.status === "succeeded" && (r.http_status == null || (r.http_status >= 200 && r.http_status < 300));
                const open = !!expanded[r.runid];
                return (
                  <div key={r.runid} className={`rounded border ${ok ? "border-border" : "border-destructive/40 bg-destructive/5"}`}>
                    <button
                      onClick={() => setExpanded((p) => ({ ...p, [r.runid]: !open }))}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
                    >
                      {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {ok
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        : <XCircle className="h-4 w-4 text-destructive" />}
                      <span className="text-xs font-mono text-muted-foreground">{fmtHora(r.start_time)}</span>
                      <span className="text-xs ml-auto tabular-nums text-muted-foreground">{fmtDur(r.duracao_ms)}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}>
                        {r.status}{r.http_status ? ` · ${r.http_status}` : ""}
                      </span>
                    </button>
                    {open && (
                      <div className="px-3 py-2 border-t border-border text-xs">
                        <pre className="whitespace-pre-wrap break-words bg-muted/40 p-2 rounded font-mono text-[11px] max-h-80 overflow-auto">
{r.return_message ?? "(sem mensagem de retorno)"}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}