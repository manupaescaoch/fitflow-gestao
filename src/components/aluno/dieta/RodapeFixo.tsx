import { useEffect, useState } from "react";
import { Save, FileText, Check, AlertTriangle, Info, Loader2 } from "lucide-react";
import { fmtMacro, type Macros, type ValidacaoSinal } from "@/lib/dieta";

export function RodapeFixo({
  total, sinais, salvando, canEdit, onSalvarRascunho, onSalvarAtivo, modo, totaisManuais,
}: {
  total: Macros;
  sinais: ValidacaoSinal[];
  salvando: boolean;
  canEdit: boolean;
  onSalvarRascunho: () => void;
  onSalvarAtivo: () => void;
  modo?: "calculado" | "texto_livre";
  totaisManuais?: { kcal: number; ptn: number; cho: number; lip: number };
}) {
  const hidden = useScrollDirection();
  const erro = sinais.find((s) => s.level === "warn");
  const ok = sinais.find((s) => s.tipo === "pronto");
  const t = modo === "texto_livre" && totaisManuais ? totaisManuais : total;

  return (
    <div
      className={`sticky bottom-0 left-0 right-0 z-10 transition-transform duration-200 ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="mx-auto max-w-[1400px] bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] px-6 py-3 pb-safe-plus-3 pl-[max(1.5rem,var(--safe-left))] pr-[max(1.5rem,var(--safe-right))] flex items-center gap-6 text-sm">
        <div className="flex items-center gap-6 tabular-nums">
          <Stat label="KCAL" value={fmtMacro(t.kcal)} big />
          <Stat label="PTN" value={fmtMacro(t.ptn) + "g"} c="text-rose-600" />
          <Stat label="CHO" value={fmtMacro(t.cho) + "g"} c="text-violet-600" />
          <Stat label="LIP" value={fmtMacro(t.lip) + "g"} c="text-amber-600" />
        </div>

        <div className="flex-1 hidden md:flex items-center justify-center gap-2 min-w-0">
          {erro ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg truncate">
              <AlertTriangle className="w-3 h-3" /> {erro.msg}
            </span>
          ) : ok ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              <Check className="w-3 h-3" /> {ok.msg}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <Info className="w-3 h-3" /> Adicione refeições para começar
            </span>
          )}
        </div>

        {canEdit && (
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onSalvarRascunho}
              disabled={salvando}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition"
            >
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              Rascunho
            </button>
            <button
              onClick={onSalvarAtivo}
              disabled={salvando}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition shadow-sm"
            >
              <Save className="w-3.5 h-3.5" /> Salvar dieta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, c, big }: { label: string; value: string; c?: string; big?: boolean }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className={`text-[9px] uppercase font-semibold tracking-wider ${c ?? "text-slate-400"}`}>{label}</span>
      <span className={`font-bold text-slate-900 ${big ? "text-lg" : "text-sm"}`}>{value}</span>
    </div>
  );
}

function useScrollDirection() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const cur = window.scrollY;
        if (cur > last + 40 && cur > 120) setHidden(true);
        else if (cur < last - 10) setHidden(false);
        last = cur;
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return hidden;
}
