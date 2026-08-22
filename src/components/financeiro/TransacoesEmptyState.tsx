import { Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";

export function TransacoesEmptyState() {
  return (
    <div className="py-12 flex flex-col items-center justify-center text-center">
      <div
        className="h-14 w-14 rounded-2xl flex items-center justify-center mb-3"
        style={{ background: "var(--border-light)" }}
      >
        <Inbox className="h-7 w-7 fin-muted" />
      </div>
      <p className="text-sm fin-muted mb-1">Nenhuma transação neste mês.</p>
      <Link
        to="/financeiro/transacoes"
        className="text-xs font-semibold"
        style={{ color: "var(--blue)" }}
      >
        Lançar a primeira →
      </Link>
    </div>
  );
}