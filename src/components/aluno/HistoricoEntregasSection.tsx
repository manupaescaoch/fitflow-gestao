import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listarHistoricoEntregasAluno, type EntregaHistorico } from "@/server/entregas.functions";
import { Check } from "lucide-react";

function fmtDateTime(s: string | null | undefined) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return s; }
}
function fmtDateOnly(s: string) {
  try { return new Date(s + "T00:00:00").toLocaleDateString("pt-BR"); } catch { return s; }
}

function Cell({ done, por, em }: { done: boolean; por: string | null; em: string | null }) {
  if (!done) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
      <div className="leading-tight">
        <div className="font-medium">{por ?? <span className="text-muted-foreground italic">sem registro</span>}</div>
        {em && <div className="text-muted-foreground text-[11px]">{fmtDateTime(em)}</div>}
      </div>
    </div>
  );
}

type LogRow = {
  id: string; criado_em: string; origem: string; tipo_evento: string;
  resultado: string; data_referencia: string | null;
  detalhes: Record<string, unknown> | null;
};

export function HistoricoEntregasSection({ alunoId }: { alunoId: string }) {
  const [rows, setRows] = useState<EntregaHistorico[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const fn = useServerFn(listarHistoricoEntregasAluno);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fn({ data: { alunoId } }).then((r) => {
      if (cancelled) return;
      setRows(r.entregas);
      setLogs(r.logs as LogRow[]);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [alunoId, fn]);

  if (loading) return <p className="text-xs text-muted-foreground">Carregando histórico de entregas…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold mb-2">Histórico de entregas</h4>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma entrega registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 font-medium">Data ref.</th>
                  <th className="text-left font-medium">Dieta</th>
                  <th className="text-left font-medium">Treino</th>
                  <th className="text-left font-medium">D0</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 align-top">
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDateOnly(r.data_referencia)}</td>
                    <td className="py-2"><Cell done={r.dieta_entregue} por={r.dieta_entregue_por} em={r.dieta_entregue_em} /></td>
                    <td className="py-2"><Cell done={r.treino_entregue} por={r.treino_entregue_por} em={r.treino_entregue_em} /></td>
                    <td className="py-2"><Cell done={r.d0_confirmado} por={r.d0_confirmado_por} em={r.d0_confirmado_em} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Eventos recentes</h4>
          <ul className="space-y-1.5 text-xs">
            {logs.map((l) => {
              const det = (l.detalhes ?? {}) as { por?: string; anterior_por?: string };
              return (
                <li key={l.id} className="border-b border-border/40 pb-1.5 last:border-0">
                  <span className="font-medium">{l.tipo_evento}</span>
                  <span className="text-muted-foreground"> · {l.resultado}</span>
                  {det.por && <span className="text-muted-foreground"> · por {det.por}</span>}
                  {det.anterior_por && <span className="text-muted-foreground"> (era de {det.anterior_por})</span>}
                  <div className="text-muted-foreground text-[11px]">{fmtDateTime(l.criado_em)} · {l.origem}</div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}