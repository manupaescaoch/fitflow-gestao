import { Sparkles, FileInput, LayoutTemplate, Plus, FileText } from "lucide-react";

export function EmptyState({
  onGerarIA, onImportar, onTemplate, onManual, canEdit, variant,
}: {
  onGerarIA: () => void;
  onImportar: () => void;
  onTemplate: () => void;
  onManual: () => void;
  canEdit: boolean;
  variant?: "calculado" | "texto_livre";
}) {
  const isLivre = variant === "texto_livre";
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {isLivre ? (
        <>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center mb-5 shadow-sm">
            <FileText className="w-7 h-7 text-amber-600" />
          </div>
          <h3 className="text-2xl font-semibold tracking-tight mb-2">Comece colando ou digitando seu plano</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-7">
            Cada refeição é uma caixa de texto. Cole opções 1/2/3 prontas. Os totais de macros são preenchidos manualmente no resumo.
          </p>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 flex items-center justify-center mb-5 shadow-sm">
            <Sparkles className="w-7 h-7 text-rose-600" />
          </div>
          <h3 className="text-2xl font-semibold tracking-tight mb-2">Comece com IA em 30s</h3>
          <p className="text-muted-foreground text-sm max-w-md mb-7">
            O MP DIET monta um plano personalizado a partir do objetivo, peso e estratégia nutricional.
            Você ajusta o que precisar.
          </p>
        </>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {!isLivre && (
            <button
              onClick={onGerarIA}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition shadow-sm"
            >
              <Sparkles className="w-4 h-4" /> Gerar com MP DIET
            </button>
          )}
          {isLivre && (
            <button onClick={onImportar} className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-border text-sm hover:bg-muted/50 transition">
              <FileInput className="w-4 h-4" /> Importar texto
            </button>
          )}
          {!isLivre && (
            <button onClick={onTemplate} className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-border text-sm hover:bg-muted/50 transition">
              <LayoutTemplate className="w-4 h-4" /> Template
            </button>
          )}
          <button onClick={onManual} className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border text-sm transition ${isLivre ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100" : "border-border hover:bg-muted/50"}`}>
            <Plus className="w-4 h-4" /> {isLivre ? "Refeição texto livre" : "Refeição manual"}
          </button>
        </div>
      )}
    </div>
  );
}
