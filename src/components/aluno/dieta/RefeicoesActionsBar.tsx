import { Sparkles, FileInput, Plus, MoreHorizontal, LayoutTemplate, Trash2, FileDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function RefeicoesActionsBar({
  canEdit,
  onAssistenteIA,
  onImportar,
  onAdicionarRefeicao,
  onTemplate,
  onApagarPlano,
  onExportarPdf,
  modoPlano,
}: {
  canEdit: boolean;
  onAssistenteIA: () => void;
  onImportar: () => void;
  onAdicionarRefeicao: () => void;
  onTemplate: () => void;
  onApagarPlano?: () => void;
  onExportarPdf?: () => void;
  modoPlano?: "calculado" | "texto_livre";
}) {
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isLivre = modoPlano === "texto_livre";

  useEffect(() => {
    if (!openMenu) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openMenu]);

  return (
    <div className="flex items-center gap-1.5">
      {(canEdit || onExportarPdf) && (
        <>
          {onExportarPdf && (
            <button
              onClick={onExportarPdf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
              title="Exportar plano em PDF"
            >
              <FileDown className="w-3.5 h-3.5 text-rose-600" /> PDF
            </button>
          )}
          {canEdit && (<>
          <button
            onClick={onAdicionarRefeicao}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-primary text-white hover:bg-primary/90 transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Refeição
          </button>
          {!isLivre && (
            <button
              onClick={onAssistenteIA}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-600" /> Assistente
            </button>
          )}
          <button
            onClick={onImportar}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
          >
            <FileInput className="w-3.5 h-3.5" /> Importar
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpenMenu((v) => !v)}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition"
              aria-label="Mais opções"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {openMenu && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl bg-popover border border-border shadow-lg py-1 z-20">
                {!isLivre && (
                  <button
                    onClick={() => { setOpenMenu(false); onTemplate(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 text-foreground"
                  >
                    <LayoutTemplate className="w-4 h-4" /> Carregar template
                  </button>
                )}
                {onApagarPlano && (
                  <button
                    onClick={() => { setOpenMenu(false); onApagarPlano(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" /> Apagar plano
                  </button>
                )}
              </div>
            )}
          </div>
          </>)}
        </>
      )}
    </div>
  );
}