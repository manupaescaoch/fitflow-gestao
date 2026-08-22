import { useState } from "react";
import { X, FileInput, Loader2, Check, FileText } from "lucide-react";

export type RefeicaoIA = {
  nome: string;
  horario?: string | null;
  observacoes?: string | null;
  itens: Array<{ nome: string; quantidade: number; unidade: string; kcal: number; ptn: number; cho: number; lip: number }>;
  /** Opções alternativas equivalentes (substitutos). Cada opção é uma lista completa. */
  opcoes?: Array<Array<{ nome: string; quantidade: number; unidade: string; kcal: number; ptn: number; cho: number; lip: number }>>;
};

export function ImportarTextoModal({
  open, onClose, onAnalisar, onAplicar, onAplicarTextoLivre, busy, preview,
}: {
  open: boolean;
  onClose: () => void;
  onAnalisar: (texto: string) => void;
  onAplicar: (refeicoes: RefeicaoIA[]) => void;
  onAplicarTextoLivre?: (texto: string) => void;
  busy: boolean;
  preview: RefeicaoIA[] | null;
}) {
  const [texto, setTexto] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 px-safe">
      <div className="bg-background w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <FileInput className="w-4 h-4 text-slate-700" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">Importar dieta via texto</div>
            <div className="text-[11px] text-muted-foreground">Cole o plano e importamos exatamente como está, sem alterar</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 flex-1 overflow-hidden">
          <div className="border-r border-border p-4 overflow-auto">
            <label className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Texto original</label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={`Ex.:\n\nCafé da manhã - 7h\n2 ovos mexidos\n1 fatia de pão\n200ml café\n\nAlmoço - 12h\n150g frango\n100g arroz\n80g feijão\n…`}
              className="w-full min-h-[280px] text-sm p-3 rounded-lg border border-border bg-muted/20 outline-none focus:bg-background focus:border-rose-300 font-mono"
            />
            <button
              onClick={() => onAnalisar(texto)}
              disabled={busy || texto.trim().length < 10}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Processar texto
            </button>
          </div>

          <div className="p-4 overflow-auto bg-muted/10">
            <label className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Preview estruturado</label>
            {!preview ? (
              <div className="text-xs text-muted-foreground py-8 text-center">
                {busy ? "Analisando…" : "Cole o texto e clique em Analisar para ver a estrutura."}
              </div>
            ) : (
              <div className="space-y-2">
                {preview.map((r, i) => {
                  const opcoes = r.opcoes ?? [];
                  return (
                    <div key={i} className="rounded-lg bg-background border border-border p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{r.nome}</span>
                          {r.horario && <span className="text-[11px] text-muted-foreground">{r.horario}</span>}
                          {opcoes.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                              {opcoes.length + 1} opções
                            </span>
                          )}
                        </div>
                      </div>
                      <OpcaoBloco rotulo="Opção 1" itens={r.itens} />
                      {opcoes.map((op, k) => (
                        <OpcaoBloco key={k} rotulo={`Opção ${k + 2}`} itens={op} />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-muted/20">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm hover:bg-muted">Cancelar</button>
          {onAplicarTextoLivre && (
            <button
              onClick={() => onAplicarTextoLivre(texto)}
              disabled={busy || texto.trim().length < 10}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              title="Cria uma refeição por bloco preservando o texto colado, sem cálculo"
            >
              <FileText className="w-3.5 h-3.5" /> Aplicar como texto livre
            </button>
          )}
          <button
            onClick={() => preview && onAplicar(preview)}
            disabled={!preview || busy}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" /> Aplicar estruturado
          </button>
        </div>
      </div>
    </div>
  );
}

function OpcaoBloco({ rotulo, itens }: {
  rotulo: string;
  itens: Array<{ nome: string; quantidade: number; unidade: string; kcal: number; ptn: number; cho: number; lip: number }>;
}) {
  return (
    <div className="mt-2 rounded-md border border-slate-100 bg-slate-50/40 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
        {rotulo}
      </div>
      <div className="space-y-0.5 text-xs">
        {itens.map((it, j) => (
          <div key={j} className="truncate">{it.nome}</div>
        ))}
      </div>
    </div>
  );
}
