import { useMemo } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { fmtBRL, MES_LABELS, parseDataLocal, type Transacao } from "@/lib/financeiro";

interface Props {
  transacoes: Transacao[];
  ano: number;
  mes: number;
}

export function EvolucaoFinanceiraCard({ transacoes, ano, mes }: Props) {
  const data = useMemo(() => {
    const arr: { mes: string; receitas: number; despesas: number; saldo: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ano, mes - i, 1);
      const ini = new Date(d.getFullYear(), d.getMonth(), 1);
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const noMes = transacoes.filter((t) => {
        const x = parseDataLocal(t.data_transacao ?? t.competencia);
        if (!x) return false;
        return x >= ini && x <= fim;
      });
      const receitas = noMes.filter((t) => Number(t.valor) >= 0).reduce((s, t) => s + Number(t.valor), 0);
      const despesas = Math.abs(noMes.filter((t) => Number(t.valor) < 0).reduce((s, t) => s + Number(t.valor), 0));
      arr.push({
        mes: `${MES_LABELS[d.getMonth()].slice(0, 3)}/${String(d.getFullYear()).slice(-2)}`,
        receitas,
        despesas,
        saldo: receitas - despesas,
      });
    }
    return arr;
  }, [transacoes, ano, mes]);

  return (
    <div className="fin-card p-0">
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--border-light)" }}>
        <div>
          <h2 className="font-semibold">Evolução financeira</h2>
          <p className="text-xs fin-muted mt-0.5">Últimos 6 meses</p>
        </div>
        <div className="flex items-center gap-3 text-xs fin-muted">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--green)" }} />Receitas</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--red)" }} />Despesas</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--blue)" }} />Saldo</span>
        </div>
      </div>
      <div className="p-4" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="var(--muted-foreground)"
              tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(v: number) => fmtBRL(v)}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ display: "none" }} />
            <Bar dataKey="receitas" name="Receitas" fill="var(--green)" radius={[4, 4, 0, 0]} barSize={18} />
            <Bar dataKey="despesas" name="Despesas" fill="var(--red)" radius={[4, 4, 0, 0]} barSize={18} />
            <Line type="monotone" dataKey="saldo" name="Saldo" stroke="var(--blue)" strokeWidth={2.5} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}