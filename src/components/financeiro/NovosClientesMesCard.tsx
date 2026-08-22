import { useMemo } from "react";
import { UserPlus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { Aluno } from "@/lib/crm";
import { MODALIDADE_LABEL, fmtDate } from "@/lib/crm";
import { fmtBRL } from "@/lib/financeiro";

export function NovosClientesMesCard({
  alunos, ano, mes,
}: {
  alunos: Aluno[]; ano: number; mes: number;
}) {
  const lista = useMemo(() => {
    const ini = new Date(ano, mes, 1).getTime();
    const fim = new Date(ano, mes + 1, 0, 23, 59, 59).getTime();
    return alunos
      .filter((a) => {
        if (!a.data_compra) return false;
        const t = new Date(a.data_compra).getTime();
        return t >= ini && t <= fim;
      })
      .sort((a, b) =>
        new Date(b.data_compra!).getTime() - new Date(a.data_compra!).getTime(),
      );
  }, [alunos, ano, mes]);

  const total = lista.reduce((s, a) => s + Number(a.valor_plano ?? 0), 0);

  return (
    <div className="fin-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--blue) 12%, transparent)" }}
          >
            <UserPlus className="h-4 w-4" style={{ color: "var(--blue)" }} />
          </span>
          <div>
            <h3 className="text-sm font-semibold">Novos clientes do mês</h3>
            <p className="text-xs fin-muted">
              {lista.length} {lista.length === 1 ? "venda" : "vendas"} · {fmtBRL(total)}
            </p>
          </div>
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="text-sm fin-muted py-6 text-center">
          Nenhum aluno comprou neste mês ainda.
        </p>
      ) : (
        <div className="overflow-x-auto -mx-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs fin-muted border-b" style={{ borderColor: "var(--fin-border, #e5e7eb)" }}>
                <th className="px-3 py-2 font-medium">Aluno</th>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Modalidade</th>
                <th className="px-3 py-2 font-medium">Plano</th>
                <th className="px-3 py-2 font-medium text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id} className="border-b last:border-0" style={{ borderColor: "var(--fin-border, #e5e7eb)" }}>
                  <td className="px-3 py-2">
                    <Link
                      to="/alunos/$id"
                      params={{ id: a.id }}
                      className="hover:underline font-medium"
                    >
                      {a.nome}
                    </Link>
                  </td>
                  <td className="px-3 py-2 fin-muted whitespace-nowrap">{fmtDate(a.data_compra)}</td>
                  <td className="px-3 py-2 fin-muted whitespace-nowrap">
                    {a.modalidade ? MODALIDADE_LABEL[a.modalidade] : "—"}
                  </td>
                  <td className="px-3 py-2">{a.plano ?? "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
                    {a.valor_plano ? fmtBRL(Number(a.valor_plano)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}