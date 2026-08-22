import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Dumbbell, UtensilsCrossed, MessageSquare, Wallet } from "lucide-react";
import type { Aluno } from "@/lib/crm";
import { diasRestantes } from "@/lib/crm";

type StatusLevel = "ok" | "warn" | "bad";
type Item = { icon: any; label: string; status: string; level: StatusLevel };

const LEVEL_DOT: Record<StatusLevel, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
};
const LEVEL_TXT: Record<StatusLevel, string> = {
  ok: "text-emerald-700",
  warn: "text-amber-700",
  bad: "text-rose-700",
};

function diasAtras(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function SaudeAlunoCard({ alunoId, aluno }: { alunoId: string; aluno: Aluno }) {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [acao, setAcao] = useState<string | null>(null);
  const [overall, setOverall] = useState<StatusLevel>("ok");

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const [{ data: planos }, { data: forms }, { data: msgsTreino }] = await Promise.all([
        supabase.from("dieta_planos").select("atualizado_em")
          .eq("aluno_id", alunoId).eq("template", false)
          .order("atualizado_em", { ascending: false }).limit(1),
        supabase.from("formularios").select("tipo,respondido,criado_em")
          .eq("aluno_id", alunoId)
          .in("tipo", ["feedback_quinzenal", "feedback_mensal"])
          .order("criado_em", { ascending: false }).limit(5),
        supabase.from("mensagens_treino").select("criado_em")
          .eq("aluno_id", alunoId)
          .order("criado_em", { ascending: false }).limit(1),
      ]);
      if (cancel) return;

      // Treino
      const dTreino = diasAtras(msgsTreino?.[0]?.criado_em ?? null);
      const treino: Item = dTreino === null
        ? { icon: Dumbbell, label: "Treino", status: "Sem registro", level: "warn" }
        : dTreino > 30
          ? { icon: Dumbbell, label: "Treino", status: "Atrasado", level: "bad" }
          : { icon: Dumbbell, label: "Treino", status: "Em dia", level: "ok" };

      // Dieta
      const dDieta = diasAtras(planos?.[0]?.atualizado_em ?? null);
      const dieta: Item = dDieta === null
        ? { icon: UtensilsCrossed, label: "Dieta", status: "Sem plano", level: "bad" }
        : dDieta > 30
          ? { icon: UtensilsCrossed, label: "Dieta", status: "Atrasada", level: "warn" }
          : { icon: UtensilsCrossed, label: "Dieta", status: "Em dia", level: "ok" };

      // Feedback
      const pend = (forms ?? []).find((f: any) => !f.respondido);
      const feedback: Item = pend
        ? { icon: MessageSquare, label: "Feedback", status: "Pendente", level: "warn" }
        : { icon: MessageSquare, label: "Feedback", status: "Em dia", level: "ok" };

      // Pagamento
      const dr = diasRestantes(aluno.data_expiracao);
      const pagamento: Item = !aluno.data_d0
        ? { icon: Wallet, label: "Pagamento", status: "Sem início", level: "warn" }
        : dr === null
          ? { icon: Wallet, label: "Pagamento", status: "—", level: "warn" }
          : dr < 0
            ? { icon: Wallet, label: "Pagamento", status: "Vencido", level: "bad" }
            : dr < 7
              ? { icon: Wallet, label: "Pagamento", status: "Vence em breve", level: "warn" }
              : { icon: Wallet, label: "Pagamento", status: "Em dia", level: "ok" };

      const list = [treino, dieta, feedback, pagamento];
      setItens(list);

      const hasBad = list.some((i) => i.level === "bad");
      const hasWarn = list.some((i) => i.level === "warn");
      setOverall(hasBad ? "bad" : hasWarn ? "warn" : "ok");

      const acoes: string[] = [];
      if (dieta.level !== "ok") acoes.push("Atualizar dieta");
      if (feedback.level !== "ok") acoes.push("cobrar feedback");
      if (pagamento.level === "bad") acoes.push("cobrar pagamento");
      if (treino.level === "bad") acoes.push("revisar treino");
      setAcao(acoes.length ? acoes.join(" e ").replace(/^./, (c) => c.toUpperCase()) : null);
    })();
    return () => { cancel = true; };
  }, [alunoId, aluno.data_expiracao, aluno.data_d0]);

  if (!itens) return null;

  const badgeCls =
    overall === "bad" ? "bg-rose-100 text-rose-700"
    : overall === "warn" ? "bg-amber-100 text-amber-700"
    : "bg-emerald-100 text-emerald-700";
  const badgeLabel =
    overall === "bad" ? "Crítico" : overall === "warn" ? "Atenção" : "Tudo certo";

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-border">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Heart className="h-4 w-4 text-rose-500" /> Saúde do aluno
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeCls}`}>
          {badgeLabel}
        </span>
      </div>
      <ul className="divide-y divide-border">
        {itens.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.label} className="px-3 py-2 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-[13px] text-foreground">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                {it.label}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${LEVEL_TXT[it.level]}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${LEVEL_DOT[it.level]}`} />
                {it.status}
              </span>
            </li>
          );
        })}
      </ul>
      {acao && (
        <div className="px-3 py-2 border-t border-border bg-muted/30">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ação sugerida</div>
          <div className="text-[12px] text-foreground font-medium leading-snug">{acao}</div>
        </div>
      )}
    </div>
  );
}
