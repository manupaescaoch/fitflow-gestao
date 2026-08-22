import { Sparkles, FileInput, LayoutTemplate, Plus, MoreHorizontal } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const STATUS_STYLE: Record<string, { dot: string; label: string; cls: string }> = {
  rascunho: { dot: "bg-amber-500", label: "Rascunho", cls: "text-amber-700 bg-amber-50" },
  ativo: { dot: "bg-emerald-500", label: "Ativo", cls: "text-emerald-700 bg-emerald-50" },
  aprovado: { dot: "bg-violet-500", label: "Aprovado", cls: "text-violet-700 bg-violet-50" },
};

export function HeaderCompacto({
  status, canEdit,
  onGerarIA, onImportar, onTemplate, onManual,
  onApagarPlano,
  savedAt,
}: {
  status: string;
  canEdit: boolean;
  onGerarIA: () => void;
  onImportar: () => void;
  onTemplate: () => void;
  onManual: () => void;
  onApagarPlano?: () => void;
  savedAt?: Date | null;
}) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.rascunho;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="flex items-center gap-3 min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">Dieta</h2>
        <span className="text-muted-foreground text-sm">·</span>
        <span className="text-sm text-foreground/80">Plano alimentar</span>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
        {savedAt && (
          <span className="text-[11px] text-muted-foreground hidden md:inline">
            Salvo {timeAgo(savedAt)}
          </span>
        )}
      </div>

      {canEdit && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={onGerarIA}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" /> Gerar com IA
          </button>
          <button onClick={onImportar} className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-foreground/80 hover:bg-muted/60 transition">
            <FileInput className="w-3.5 h-3.5" /> Importar
          </button>
          <button onClick={onTemplate} className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-foreground/80 hover:bg-muted/60 transition">
            <LayoutTemplate className="w-3.5 h-3.5" /> Template
          </button>
          <button onClick={onManual} className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-foreground/80 hover:bg-muted/60 transition">
            <Plus className="w-3.5 h-3.5" /> Refeição
          </button>

          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-muted/60 transition"
              aria-label="Mais opções"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {open && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-popover border border-border shadow-lg py-1 z-20">
                <button onClick={onImportar} className="md:hidden w-full text-left px-3 py-2 text-sm hover:bg-muted/60">Importar texto</button>
                <button onClick={onTemplate} className="md:hidden w-full text-left px-3 py-2 text-sm hover:bg-muted/60">Carregar template</button>
                <button onClick={onManual} className="md:hidden w-full text-left px-3 py-2 text-sm hover:bg-muted/60">+ Refeição manual</button>
                {onApagarPlano && (
                  <button onClick={onApagarPlano} className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                    Apagar plano
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 5) return "agora";
  if (s < 60) return `há ${s}s`;
  if (s < 3600) return `há ${Math.floor(s / 60)}min`;
  return `há ${Math.floor(s / 3600)}h`;
}
