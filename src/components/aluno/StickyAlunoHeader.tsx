import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageCircle, MessageSquare, Pencil, Calendar, Clock,
  UtensilsCrossed, Wallet,
} from "lucide-react";
import { MODALIDADE_LABEL, fmtDate, diasRestantes, type Aluno } from "@/lib/crm";
import { AlunoAvatar } from "@/components/aluno/AlunoAvatar";

type Props = {
  aluno: Aluno;
  statusPill: { label: string; cls: string };
  forms: any[];
  canEdit: boolean;
  onWhatsApp: () => void;
  onAdicionarFeedback: () => void;
  onEditar: () => void;
};

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function curtaData(iso: string | null | undefined): string {
  if (!iso) return "—";
  try { return fmtDate(iso); } catch { return "—"; }
}

export function StickyAlunoHeader({
  aluno, statusPill, forms, canEdit, onWhatsApp, onAdicionarFeedback, onEditar,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [ultimaEntrega, setUltimaEntrega] = useState<string | null>(null);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 220);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const [{ data: msgsT }, { data: planos }] = await Promise.all([
        supabase.from("mensagens_treino").select("criado_em")
          .eq("aluno_id", aluno.id).order("criado_em", { ascending: false }).limit(1),
        supabase.from("dieta_planos").select("atualizado_em")
          .eq("aluno_id", aluno.id).eq("template", false)
          .order("atualizado_em", { ascending: false }).limit(1),
      ]);
      if (cancel) return;
      const a = msgsT?.[0]?.criado_em ?? null;
      const b = planos?.[0]?.atualizado_em ?? null;
      const last = [a, b].filter(Boolean).sort((x, y) => new Date(y!).getTime() - new Date(x!).getTime())[0] ?? null;
      setUltimaEntrega(last);
    })();
    return () => { cancel = true; };
  }, [aluno.id]);

  const dr = diasRestantes(aluno.data_expiracao);
  const diasLabel = !aluno.data_d0
    ? "Sem início"
    : dr === null ? "—"
    : dr < 0 ? `Vencido há ${Math.abs(dr)}d`
    : `${dr}d para vencer`;

  const ultimoFeedback = (forms ?? [])
    .filter((f) => (f.tipo === "feedback_mensal" || f.tipo === "feedback_quinzenal") && f.respondido)
    .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())[0];

  return (
    <div
      aria-hidden={!visible}
      className={`fixed top-0 left-0 right-0 z-40 border-b border-border bg-card/95 backdrop-blur-md shadow-sm transition-transform duration-200 ${
        visible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5 py-2.5 flex items-center gap-3">
        {/* Identidade */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <AlunoAvatar nome={aluno.nome} fotoUrl={(aluno as any).foto_url} className="h-8 w-8 text-[12px]" />
          <div className="min-w-0 max-w-[180px] sm:max-w-[240px]">
            <div className="text-[13px] font-semibold text-foreground truncate leading-tight">{aluno.nome}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {aluno.modalidade && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium whitespace-nowrap">
                  {MODALIDADE_LABEL[aluno.modalidade]}
                </span>
              )}
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${statusPill.cls}`}>
                {statusPill.label}
              </span>
            </div>
          </div>
        </div>

        {/* KPIs (chips) — desktop visíveis, mobile scroll horizontal */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <KpiChip icon={Clock} label="Vencimento" value={diasLabel} tone={
            !aluno.data_d0 ? "muted"
            : dr !== null && dr < 0 ? "rose"
            : dr !== null && dr < 7 ? "amber"
            : "emerald"
          } />
          <KpiChip icon={MessageSquare} label="Feedback" value={ultimoFeedback ? curtaData(ultimoFeedback.criado_em) : "—"} tone="violet" />
          <KpiChip icon={UtensilsCrossed} label="Entrega" value={curtaData(ultimaEntrega)} tone="sky" />
          <KpiChip icon={Wallet} label="Pagto" value={statusPill.label} tone={
            !aluno.data_d0 ? "muted"
            : dr !== null && dr < 0 ? "rose"
            : dr !== null && dr < 7 ? "amber"
            : "emerald"
          } />
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ActionBtn icon={MessageCircle} label="WhatsApp" tone="emerald" onClick={onWhatsApp} />
          <ActionBtn icon={MessageSquare} label="Feedback" tone="violet" onClick={onAdicionarFeedback} />
          {canEdit && <ActionBtn icon={Pencil} label="Editar" tone="rose" onClick={onEditar} />}
        </div>
      </div>
    </div>
  );
}

function KpiChip({
  icon: Icon, label, value, tone,
}: { icon: any; label: string; value: string; tone: "emerald" | "amber" | "rose" | "sky" | "violet" | "muted" }) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-100",
    amber: "text-amber-700 bg-amber-50 border-amber-100",
    rose: "text-rose-700 bg-rose-50 border-rose-100",
    sky: "text-sky-700 bg-sky-50 border-sky-100",
    violet: "text-violet-700 bg-violet-50 border-violet-100",
    muted: "text-muted-foreground bg-muted border-border",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full border whitespace-nowrap ${tones[tone]}`}>
      <Icon className="h-3 w-3" />
      <span className="text-[9px] uppercase tracking-wider opacity-70">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

function ActionBtn({
  icon: Icon, label, tone, onClick,
}: { icon: any; label: string; tone: "emerald" | "violet" | "rose"; onClick: () => void }) {
  const tones: Record<string, string> = {
    emerald: "text-emerald-700 hover:bg-emerald-50 border-emerald-200",
    violet: "text-violet-700 hover:bg-violet-50 border-violet-200",
    rose: "text-rose-700 hover:bg-rose-50 border-rose-200",
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-lg border bg-card transition-colors ${tones[tone]}`}
      aria-label={label}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}