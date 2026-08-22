import { useState } from "react";
import { Pencil, Trash2, Check, X, AlertCircle } from "lucide-react";
import type { DietaItem, DietaItemComSubs } from "@/lib/dieta";
import { fmtMacro } from "@/lib/dieta";
import type { NovoItem, NovoItemComSubs } from "./BuscaAlimento";
import { EditarAlimentoActionsModal } from "./modals/EditarAlimentoActionsModal";
import { EditarAlimentoFullModal } from "./modals/EditarAlimentoFullModal";

export function ItemAlimentoRow({
  item, canEdit, onUpdate, onDelete, onReplace,
}: {
  item: DietaItemComSubs;
  canEdit: boolean;
  onUpdate: (patch: Partial<DietaItem>) => void;
  onDelete: () => void;
  onReplace?: (novo: NovoItemComSubs) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [qtd, setQtd] = useState<string>(String(item.quantidade));

  function save() {
    const q = Number(qtd);
    if (!Number.isFinite(q) || q < 0) { setEdit(false); return; }
    if (q === item.quantidade) { setEdit(false); return; }
    const fator = item.quantidade > 0 ? q / item.quantidade : 1;
    onUpdate({
      quantidade: q,
      kcal: round(item.kcal * fator),
      ptn: round(item.ptn * fator),
      cho: round(item.cho * fator),
      lip: round(item.lip * fator),
    });
    setEdit(false);
  }

  const nome = item.nome_custom ?? "Alimento";
  const naoValidado = !item.alimento_id;
  const subs = item.substitutos ?? [];

  const initialPrincipal: NovoItem = {
    alimento_id: item.alimento_id,
    nome_custom: item.nome_custom ?? "Alimento",
    quantidade: item.quantidade,
    unidade: item.unidade,
    kcal: item.kcal, ptn: item.ptn, cho: item.cho, lip: item.lip,
  };
  const initialSubstitutos: NovoItem[] = subs.map((s) => ({
    alimento_id: s.alimento_id,
    nome_custom: s.nome_custom ?? "Alimento",
    quantidade: s.quantidade,
    unidade: s.unidade,
    kcal: s.kcal, ptn: s.ptn, cho: s.cho, lip: s.lip,
  }));

  return (
    <>
    <div className="group flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-muted/40 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900">{nome}</span>
          {naoValidado && (
            <span title="Alimento não validado (texto livre)" className="inline-flex items-center">
              <AlertCircle className="w-3 h-3 text-amber-500" />
            </span>
          )}
          {subs.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 text-sm">
              <span className="text-[10px] italic font-semibold text-slate-400">ou</span>
              <span className="text-slate-500">{s.nome_custom ?? "Alimento"}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {edit ? (
          <>
            <input
              type="number"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEdit(false); }}
              className="w-16 px-1.5 py-0.5 rounded border border-border text-sm bg-background tabular-nums"
            />
            <span className="text-xs text-muted-foreground">{item.unidade}</span>
            <button onClick={save} className="p-1 rounded hover:bg-emerald-50 text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
            <button onClick={() => { setEdit(false); setQtd(String(item.quantidade)); }} className="p-1 rounded hover:bg-muted"><X className="w-3.5 h-3.5" /></button>
          </>
        ) : (
          <span className="text-sm tabular-nums text-foreground/80 w-20 text-right">
            {fmtMacro(item.quantidade)} <span className="text-xs text-muted-foreground">{item.unidade}</span>
          </span>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-3 text-xs tabular-nums text-muted-foreground shrink-0">
        <span className="w-14 text-right text-foreground/80 font-medium">{fmtMacro(item.kcal)} kcal</span>
        <span className="w-12 text-right"><b className="text-emerald-600 font-semibold">P</b> {fmtMacro(item.ptn)}</span>
        <span className="w-12 text-right"><b className="text-amber-600 font-semibold">C</b> {fmtMacro(item.cho)}</span>
        <span className="w-12 text-right"><b className="text-violet-600 font-semibold">G</b> {fmtMacro(item.lip)}</span>
      </div>

      {canEdit && !edit && (
        <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition shrink-0">
          <button
            onClick={() => (onReplace ? setActionsOpen(true) : setEdit(true))}
            title={onReplace ? "Editar alimento" : "Editar quantidade"}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { if (window.confirm("Remover este alimento da refeição?")) onDelete(); }}
            className="p-1.5 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
    {onReplace && (
      <>
        <EditarAlimentoActionsModal
          open={actionsOpen}
          onClose={() => setActionsOpen(false)}
          item={item}
          onEdit={() => { setActionsOpen(false); setFullOpen(true); }}
          onDelete={() => { setActionsOpen(false); onDelete(); }}
        />
        <EditarAlimentoFullModal
          open={fullOpen}
          onClose={() => setFullOpen(false)}
          initialPrincipal={initialPrincipal}
          initialSubstitutos={initialSubstitutos}
          onReplace={(novo) => onReplace(novo)}
        />
      </>
    )}
    </>
  );
}

function round(n: number) { return Math.round(n * 10) / 10; }
