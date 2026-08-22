import { useMemo } from "react";
import type { Aluno, Modalidade } from "@/lib/crm";
import { MODALIDADE_LABEL } from "@/lib/crm";
import { fmtBRL, type Transacao, competenciaAtual } from "@/lib/financeiro";
import { ExportButtons } from "./ExportButtons";

interface Props { alunos: Aluno[]; transacoes: Transacao[] }

export function PlanosTab({ alunos, transacoes }: Props) {
  const dados = useMemo(() => {
    const comp = competenciaAtual();
    const txMes = transacoes.filter((t) => t.competencia === comp && t.tipo === "receita");
    const ativos = alunos.filter((a) => a.status === "ativo");
    const mods: Modalidade[] = ["mpteam", "mp_elite", "mp_presencial"];
    const totalGeral = txMes.reduce((s, t) => s + Number(t.valor), 0);
    return mods.map((m) => {
      const at = ativos.filter((a) => a.modalidade === m);
      const tx = txMes.filter((t) => at.some((a) => a.id === t.aluno_id));
      const receita = tx.reduce((s, t) => s + Number(t.valor), 0);
      const ticket = tx.length ? receita / tx.length : 0;
      const pct = totalGeral ? (receita / totalGeral) * 100 : 0;
      return { mod: m, ativos: at.length, receita, ticket, pct };
    });
  }, [alunos, transacoes]);

  const totalGeral = dados.reduce((s, d) => s + d.receita, 0);
  const totalAtivos = dados.reduce((s, d) => s + d.ativos, 0);

  const exportRows = dados.map((d) => [
    MODALIDADE_LABEL[d.mod], d.ativos,
    d.receita.toFixed(2), d.ticket.toFixed(2), `${d.pct.toFixed(1)}%`,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons filename="planos" title="Planos"
          columns={["Modalidade", "Ativos", "Receita", "Ticket", "% Total"]} rows={exportRows} />
      </div>
      <div className="overflow-x-auto fin-card p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 text-xs font-medium">Modalidade</th>
              <th className="text-right text-xs font-medium">Alunos ativos</th>
              <th className="text-right text-xs font-medium">Receita do mês</th>
              <th className="text-right text-xs font-medium">Ticket médio</th>
              <th className="text-right pr-4 text-xs font-medium">% do total</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((d) => (
              <tr key={d.mod} className="border-b last:border-0">
                <td className="py-3 px-4 font-medium">{MODALIDADE_LABEL[d.mod]}</td>
                <td className="text-right">{d.ativos}</td>
                <td className="text-right">{fmtBRL(d.receita)}</td>
                <td className="text-right">{fmtBRL(d.ticket)}</td>
                <td className="text-right pr-4">{d.pct.toFixed(1)}%</td>
              </tr>
            ))}
            <tr className="font-bold bg-[var(--surface-2)]">
              <td className="py-3 px-4">Total</td>
              <td className="text-right">{totalAtivos}</td>
              <td className="text-right">{fmtBRL(totalGeral)}</td>
              <td className="text-right">—</td>
              <td className="text-right pr-4">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}