import { type ReactNode, useState } from "react";
import { Search, Plus, type LucideIcon } from "lucide-react";

export function BibliotecaListLayout({
  title,
  description,
  icon: Icon,
  onCreate,
  createLabel = "Novo item",
  searchPlaceholder = "Buscar por nome…",
  query,
  onQueryChange,
  filters,
  isEmpty,
  emptyHint = "Você ainda não possui nenhum item salvo nesta biblioteca.",
  children,
  titleBadge,
  headerActions,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  onCreate?: () => void;
  createLabel?: string;
  searchPlaceholder?: string;
  query?: string;
  onQueryChange?: (v: string) => void;
  /** Filtros opcionais (ex.: chips por categoria) renderizados abaixo da busca. */
  filters?: ReactNode;
  /** Quando true, renderiza o estado vazio em vez dos children. */
  isEmpty?: boolean;
  emptyHint?: string;
  children: ReactNode;
  /** Badge ao lado do título (ex.: total de itens). */
  titleBadge?: ReactNode;
  /** Ações extras no header (ex.: "Baixar CSV"), renderizadas antes do CTA. */
  headerActions?: ReactNode;
}) {
  const [internalQ, setInternalQ] = useState("");
  const q = query ?? internalQ;
  const setQ = onQueryChange ?? setInternalQ;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="hidden sm:grid w-11 h-11 place-items-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
              {titleBadge}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {(onCreate || headerActions) && (
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}
            {onCreate && (
              <button
                onClick={onCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                {createLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-card focus-within:ring-2 focus-within:ring-rose-100 focus-within:border-rose-300 transition">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 outline-none bg-transparent text-sm placeholder:text-muted-foreground"
          />
        </div>
        {filters}
      </div>

      {/* Body */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-border bg-muted/20">
          <div className="w-14 h-14 grid place-items-center rounded-2xl bg-rose-50 text-rose-500 mb-4">
            <Icon className="w-6 h-6" />
          </div>
          <p className="text-sm text-foreground font-medium max-w-sm">{emptyHint}</p>
          {onCreate && (
            <button
              onClick={onCreate}
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Criar primeiro item
            </button>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  );
}