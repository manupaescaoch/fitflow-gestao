import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import type { Aluno } from "@/lib/crm";
import { fmtBRL, statusPagamentoAluno, type StatusPagamento } from "@/lib/financeiro";
import { ExportButtons } from "./ExportButtons";

interface Props { alunos: Aluno[] }

const STATUS_LABEL: Record<StatusPagamento, string> = {
  pago: "Pago", pendente: "Pendente", atrasado: "Atrasado",
};
const STATUS_BG: Record<StatusPagamento, string> = {
  pago: "var(--green-soft)", pendente: "var(--blue-soft)", atrasado: "var(--red-soft)",
};
const STATUS_FG: Record<StatusPagamento, string> = {
  pago: "var(--green)", pendente: "var(--blue)", atrasado: "var(--red)",
};

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-BR");
}

export function PagamentosTab({ alunos }: Props) {
  const [filtro, setFiltro] = useState<"todos" | StatusPagamento>("todos");

  const linhas = useMemo(() => {
    return alunos
      .filter((a) => a.data_expiracao)
      .map((a) => ({
        aluno: a,
        status: statusPagamentoAluno(a.data_expiracao, a.status),
      }))
      .filter((l) => filtro === "todos" || l.status === filtro)
      .sort((a, b) =>
        new Date(a.aluno.data_expiracao!).getTime() - new Date(b.aluno.data_expiracao!).getTime()
      );
  }, [alunos, filtro]);

  const exportRows = linhas.map((l) => [
    fmtDate(l.aluno.data_expiracao), l.aluno.nome, l.aluno.plano ?? "—",
    Number(l.aluno.valor_plano ?? 0).toFixed(2), STATUS_LABEL[l.status],
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5">
          {(["todos", "pendente", "atrasado", "pago"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium ${filtro === f ? "fin-tab-active" : "fin-btn-ghost"}`}
            >
              {f === "todos" ? "Todos" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        <ExportButtons
          filename="pagamentos"
          title="Pagamentos"
          columns={["Vencimento", "Aluno", "Plano", "Valor", "Status"]}
          rows={exportRows}
        />
      </div>

      <div className="overflow-x-auto fin-card p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 text-xs font-medium">Vencimento</th>
              <th className="text-left text-xs font-medium">Referência</th>
              <th className="text-right text-xs font-medium">Valor</th>
              <th className="text-center text-xs font-medium">Status</th>
              <th className="text-right pr-4 text-xs font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.aluno.id} className="border-b last:border-0 hover:bg-[var(--surface-2)]">
                <td className="py-3 px-4">{fmtDate(l.aluno.data_expiracao)}</td>
                <td>
                  <div className="font-medium">{l.aluno.nome}</div>
                  <div className="text-xs fin-muted">{l.aluno.plano ?? "—"}</div>
                </td>
                <td className="text-right font-medium">{fmtBRL(l.aluno.valor_plano)}</td>
                <td className="text-center">
                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: STATUS_BG[l.status], color: STATUS_FG[l.status] }}
                  >
                    {STATUS_LABEL[l.status]}
                  </span>
                </td>
                <td className="text-right pr-4">
                  <Link
                    to="/alunos/$id"
                    params={{ id: l.aluno.id }}
                    className="inline-flex items-center gap-1 text-xs fin-muted hover:text-[var(--text)]"
                  >
                    <ExternalLink className="h-3 w-3" /> Ver
                  </Link>
                </td>
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center fin-muted text-xs">Nenhum pagamento</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}