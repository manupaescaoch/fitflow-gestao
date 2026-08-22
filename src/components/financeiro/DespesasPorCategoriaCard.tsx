import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { PieChart as PieIcon, ArrowRight } from "lucide-react";
import { fmtBRL, parseDataLocal, type Transacao } from "@/lib/financeiro";

interface CategoriaRow { id: string; nome: string; cor: string }

interface Props {
  transacoes: Transacao[];
  categorias: CategoriaRow[];
  ano: number;
  mes: number;
}

export function DespesasPorCategoriaCard({ transacoes, categorias, ano, mes }: Props) {
  const dados = useMemo(() => {
    const ini = new Date(ano, mes, 1);
    const fim = new Date(ano, mes + 1, 0, 23, 59, 59);
    const despesas = transacoes.filter((t) => {
      const d = parseDataLocal(t.data_transacao ?? t.competencia);
      if (!d) return false;
      return d >= ini && d <= fim && Number(t.valor) < 0;
    });
    const map = new Map<string, { id: string | null; nome: string; cor: string; valor: number }>();
    for (const t of despesas) {
      const key = t.categoria_id ?? "__sem__";
      const cat = t.categoria_id ? categorias.find((c) => c.id === t.categoria_id) : null;
      const cur = map.get(key) ?? {
        id: t.categoria_id,
        nome: cat?.nome ?? "Sem categoria",
        cor: cat?.cor ?? "#6B7280",
        valor: 0,
      };
      cur.valor += Math.abs(Number(t.valor));
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [transacoes, categorias, ano, mes]);

  const total = dados.reduce((s, d) => s + d.valor, 0);

  return (
    <div className="fin-card p-0 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--border-light)" }}>
        <div>
          <h2 className="font-semibold">Despesas por categoria</h2>
          <p className="text-xs fin-muted mt-0.5">Este mês</p>
        </div>
      </div>
      {dados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center flex-1">
          <PieIcon className="h-10 w-10 text-gray-300 mb-2" />
          <p className="text-sm fin-muted">Sem despesas registradas neste mês.</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 items-center flex-1">
          <div className="relative" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dados}
                  dataKey="valor"
                  nameKey="nome"
                  cx="50%" cy="50%"
                  innerRadius={65} outerRadius={95}
                  paddingAngle={2}
                >
                  {dados.map((d, i) => <Cell key={i} fill={d.cor} />)}
                </Pie>
                <Tooltip
                  formatter={(v: number) => fmtBRL(v)}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase tracking-wide fin-muted">Total</span>
              <span className="text-base font-bold">{fmtBRL(total)}</span>
            </div>
          </div>
          <ul className="space-y-2 max-h-[240px] overflow-y-auto pr-2">
            {dados.map((d, i) => {
              const pct = total > 0 ? (d.valor / total) * 100 : 0;
              return (
                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.cor }} />
                    <span className="truncate">{d.nome}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold">{fmtBRL(d.valor)}</span>
                    <span className="text-xs fin-muted w-12 text-right">{pct.toFixed(1)}%</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="px-4 py-3 border-t" style={{ borderColor: "var(--border-light)" }}>
          <Link
            to="/financeiro/resumo"
            className="inline-flex items-center gap-1 text-xs font-semibold"
            style={{ color: "var(--blue)" }}
          >
            Ver relatório completo <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        </>
      )}
    </div>
  );
}