import { X } from "lucide-react";
import { BuscaAlimento, type NovoItemComSubs } from "../BuscaAlimento";

export function AdicionarAlimentoModal({
  open, onClose, onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (item: NovoItemComSubs) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-150 px-safe">
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-card shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h2 className="text-base font-semibold tracking-tight">Adicionar alimento</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/60 transition" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4">
          <BuscaAlimento onAdd={(it) => { onAdd(it); onClose(); }} />
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted/50 transition">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
