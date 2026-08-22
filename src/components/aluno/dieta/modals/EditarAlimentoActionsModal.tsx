import { X, Pencil, Trash2 } from "lucide-react";
import type { DietaItemComSubs } from "@/lib/dieta";
import { fmtMacro } from "@/lib/dieta";

export function EditarAlimentoActionsModal({
  open, onClose, item, onEdit, onDelete,
}: {
  open: boolean;
  onClose: () => void;
  item: DietaItemComSubs;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!open) return null;
  const subs = item.substitutos ?? [];
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-150 px-safe">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h2 className="text-base font-semibold tracking-tight">Editar alimento</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/60 transition" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <div className="text-sm font-semibold text-slate-900">{item.nome_custom ?? "Alimento"}</div>
            <div className="mt-1 text-xs tabular-nums text-muted-foreground">
              {fmtMacro(item.quantidade)} {item.unidade} · {fmtMacro(item.kcal)} kcal · P {fmtMacro(item.ptn)} · C {fmtMacro(item.cho)} · G {fmtMacro(item.lip)}
            </div>
            {subs.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/60">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">Substitutos</div>
                <ul className="text-xs text-slate-600 space-y-0.5">
                  {subs.map((s) => (
                    <li key={s.id}>ou {s.nome_custom ?? "Alimento"}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">O que você deseja fazer?</p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={() => {
              if (window.confirm("Remover este alimento da refeição?")) onDelete();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 text-sm text-rose-600 hover:bg-rose-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </button>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition"
          >
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
        </div>
      </div>
    </div>
  );
}