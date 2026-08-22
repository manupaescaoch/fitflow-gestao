import { useEffect } from "react";
import { X, Printer } from "lucide-react";
import { fmtMacro, somaPlano, somaRefeicao, parseRefeicaoObs, type PlanoCompleto } from "@/lib/dieta";

export function DietaVisualizarModal({
  open, onClose, plano, nomeAluno,
}: {
  open: boolean;
  onClose: () => void;
  plano: PlanoCompleto | null;
  nomeAluno: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !plano) return null;
  const total = somaPlano(plano);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 print:bg-white print:p-0 print:static px-safe">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col print:rounded-none print:shadow-none print:max-h-none print:max-w-none">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 print:hidden">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Visualizar plano alimentar</h2>
            <p className="text-xs text-slate-500">{nomeAluno}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </button>
            <button onClick={onClose} className="p-2 rounded-md hover:bg-slate-100" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-6 space-y-5 print:overflow-visible">
          <div className="hidden print:block mb-4">
            <h1 className="text-xl font-bold">{plano.nome}</h1>
            <p className="text-sm text-slate-600">{nomeAluno}</p>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 grid grid-cols-4 gap-3 text-center">
            <Stat label="Kcal" value={fmtMacro(total.kcal)} />
            <Stat label="Proteína" value={`${fmtMacro(total.ptn)}g`} />
            <Stat label="Carbo" value={`${fmtMacro(total.cho)}g`} />
            <Stat label="Gordura" value={`${fmtMacro(total.lip)}g`} />
          </div>

          {plano.refeicoes.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">Nenhuma refeição cadastrada.</p>
          )}

          {plano.refeicoes.map((r) => {
            const parsed = parseRefeicaoObs(r.observacoes);
            const isLivre = parsed.modo === "texto_livre";
            const s = somaRefeicao(r);
            return (
              <div key={r.id} className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{r.nome}</h3>
                    {r.horario && <p className="text-xs text-slate-500">{r.horario}</p>}
                  </div>
                  {isLivre ? (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                      texto livre
                    </span>
                  ) : (
                    <div className="text-xs text-slate-600">
                      {fmtMacro(s.kcal)} kcal · P {fmtMacro(s.ptn)} · C {fmtMacro(s.cho)} · G {fmtMacro(s.lip)}
                    </div>
                  )}
                </div>
                {isLivre ? (
                  <>
                    <pre className="px-4 py-3 text-sm text-slate-800 font-mono whitespace-pre-wrap">{parsed.conteudo}</pre>
                    {parsed.observacao && (
                      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-600 italic">
                        {parsed.observacao}
                      </div>
                    )}
                  </>
                ) : (
                <>
                <div className="divide-y divide-slate-100">
                  {r.itens.length === 0 && (
                    <p className="px-4 py-3 text-xs text-slate-400 italic">Sem itens.</p>
                  )}
                  {r.itens.map((it) => (
                    <div key={it.id} className="px-4 py-2 flex items-center justify-between text-sm">
                      <div className="min-w-0">
                        <p className="text-slate-800 truncate">{it.nome_custom ?? "Item"}</p>
                        {it.substitutos.length > 0 && (
                          <p className="text-[11px] text-slate-400 truncate">
                            ou {it.substitutos.map((s) => s.nome_custom).filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 whitespace-nowrap pl-3">
                        {it.quantidade}{it.unidade} · {fmtMacro(Number(it.kcal))} kcal
                      </div>
                    </div>
                  ))}
                </div>
                {r.observacoes && (
                  <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-600 italic">
                    {r.observacoes}
                  </div>
                )}
                </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-base font-bold text-slate-900 mt-0.5">{value}</p>
    </div>
  );
}