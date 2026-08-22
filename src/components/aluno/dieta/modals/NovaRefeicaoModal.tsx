import { useEffect, useState } from "react";
import { X, Save, Loader2, FolderOpen, Bookmark, Search, FileText, Trash2, Plus, Pencil } from "lucide-react";
import { serializeRefeicaoObs } from "@/lib/dieta";
import { RichTextEditor } from "../RichTextEditor";
import { TimePicker } from "@/components/ui/time-picker";
import { type NovoItemComSubs } from "../BuscaAlimento";
import { AdicionarAlimentoModal } from "./AdicionarAlimentoModal";
import { EditarAlimentoFullModal } from "./EditarAlimentoFullModal";
import { toast } from "sonner";

export type NovaRefeicaoPayload = {
  nome: string;
  horario: string | null;
  observacoes: string | null;
  itens?: NovoItemComSubs[];
};

export function NovaRefeicaoModal({
  open, onClose, onSalvar,
  defaultHorario, defaultNome,
  defaultAba,
  defaultObs,
  defaultItensHtml,
  defaultItens,
  mode = "create",
}: {
  open: boolean;
  onClose: () => void;
  onSalvar: (payload: NovaRefeicaoPayload) => Promise<void> | void;
  defaultHorario?: string;
  defaultNome?: string;
  /** Aba inicial. Padrão: "estruturado" (busca de alimentos). */
  defaultAba?: "estruturado" | "texto_livre";
  defaultObs?: string;
  defaultItensHtml?: string;
  defaultItens?: NovoItemComSubs[];
  /** "edit" altera título e botões para edição completa de uma refeição existente. */
  mode?: "create" | "edit";
}) {
  const [nome, setNome] = useState(defaultNome ?? "Refeição 1");
  const [horario, setHorario] = useState(defaultHorario ?? "07:00");
  const [obs, setObs] = useState(defaultObs ?? "");
  const [itensHtml, setItensHtml] = useState(defaultItensHtml ?? "");
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<"estruturado" | "texto_livre">(defaultAba ?? "estruturado");
  const [itensEstruturados, setItensEstruturados] = useState<NovoItemComSubs[]>(defaultItens ?? []);
  const [openAddAlimento, setOpenAddAlimento] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);

  function resetForm() {
    setNome(defaultNome ?? "Refeição 1");
    setHorario(defaultHorario ?? "07:00");
    setObs(defaultObs ?? "");
    setItensHtml(defaultItensHtml ?? "");
    setItensEstruturados(defaultItens ?? []);
    setAba(defaultAba ?? "estruturado");
  }

  useEffect(() => {
    if (open) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultNome, defaultHorario, defaultObs, defaultItensHtml, defaultItens]);

  const itensTexto = itensHtml.replace(/<[^>]*>/g, "").trim();
  const podeSalvar =
    nome.trim().length > 0 &&
    !!horario &&
    !salvando &&
    (aba === "estruturado" ? itensEstruturados.length > 0 : itensTexto.length > 0);

  const totaisEstruturados = itensEstruturados.reduce(
    (acc, it) => ({
      kcal: acc.kcal + (it.kcal || 0),
      ptn: acc.ptn + (it.ptn || 0),
      cho: acc.cho + (it.cho || 0),
      lip: acc.lip + (it.lip || 0),
    }),
    { kcal: 0, ptn: 0, cho: 0, lip: 0 },
  );

  async function handleSalvar(close: boolean) {
    if (!podeSalvar) {
      if (!nome.trim()) toast.error("Informe a descrição da refeição");
      else if (!horario) toast.error("Informe o horário da refeição");
      else if (aba === "estruturado") toast.error("Adicione ao menos um alimento");
      else toast.error("Preencha o texto livre da refeição");
      return;
    }
    setSalvando(true);
    try {
      if (aba === "estruturado") {
        await onSalvar({
          nome: nome.trim(),
          horario: horario || null,
          observacoes: serializeRefeicaoObs("estruturado", "", obs.trim()),
          itens: itensEstruturados,
        });
      } else {
        await onSalvar({
          nome: nome.trim(),
          horario: horario || null,
          observacoes: serializeRefeicaoObs("texto_livre", itensHtml, obs.trim()),
        });
      }
      if (close) onClose();
      else resetForm();
    } catch (e: any) {
      console.error("[Dieta] erro ao salvar refeição no modal", e);
      toast.error(e?.message ?? "Erro ao salvar refeição");
    } finally {
      setSalvando(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-150 px-safe">
        <div className="w-full max-w-3xl h-[min(82vh,640px)] flex flex-col rounded-2xl bg-card shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border bg-card">
            <h2 className="text-lg font-semibold tracking-tight">{mode === "edit" ? "Editar refeição" : "Adicionar refeição"}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/60 transition" aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
            {/* Ações topo */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition shadow-sm"
                >
                  <FolderOpen className="w-3.5 h-3.5" /> Carregar refeição
                </button>
                <button
                  type="button"
                  disabled={aba === "texto_livre" ? itensTexto.length === 0 : itensEstruturados.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-sm font-medium text-foreground/80 hover:bg-muted/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Bookmark className="w-3.5 h-3.5" /> Salvar como modelo
                </button>
              </div>
            </div>

            {/* Horário + Descrição */}
            <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700">
                  Horário <span className="text-rose-500">*</span>
                </label>
                <div className="mt-1.5">
                  <TimePicker value={horario} onChange={setHorario} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">
                  Descrição <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Digite ou selecione"
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-background text-sm focus:ring-2 focus:ring-rose-100 focus:border-rose-300 outline-none"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  É possível digitar a descrição da refeição, caso não ache na lista
                </p>
              </div>
            </div>

            {/* Alimentos: tabs (Lista de alimentos / Texto livre) */}
            <div>
              <label className="text-xs font-medium text-slate-700">
                Alimentos <span className="text-rose-500">*</span>
              </label>

              {/* Tabs */}
              <div className="mt-1.5 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setAba("estruturado")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    aba === "estruturado"
                      ? "bg-white text-rose-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Search className="w-3.5 h-3.5" /> Lista de alimentos
                </button>
                <button
                  type="button"
                  onClick={() => setAba("texto_livre")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    aba === "texto_livre"
                      ? "bg-white text-rose-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Texto livre
                </button>
              </div>

              <div className="mt-2">
                {aba === "estruturado" ? (
                  <div className="space-y-2">
                    {itensEstruturados.length === 0 ? (
                      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-sm text-slate-500">Nenhum alimento adicionado ainda</span>
                        <button
                          type="button"
                          onClick={() => setOpenAddAlimento(true)}
                          className="text-sm font-semibold text-rose-600 hover:text-rose-700 hover:underline transition"
                        >
                          Adicionar alimento
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                        {itensEstruturados.map((it, idx) => (
                          <div key={idx} className="flex items-start gap-2 px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-slate-800 truncate">{it.nome_custom}</div>
                              <div className="text-[11px] text-muted-foreground tabular-nums">
                                {Math.round(it.kcal)} kcal · P {it.ptn}g · C {it.cho}g · G {it.lip}g
                                {it.substitutos.length > 0 && (
                                  <span className="ml-1 text-slate-400">
                                    · {it.substitutos.length} substituto{it.substitutos.length > 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setItensEstruturados((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="p-1 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600"
                              aria-label="Remover"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditIdx(idx)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              aria-label="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center justify-between px-3 py-2 bg-slate-50/60">
                          <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
                            Total da refeição
                          </span>
                          <span className="text-[11px] tabular-nums text-slate-700">
                            {Math.round(totaisEstruturados.kcal)} kcal · P {totaisEstruturados.ptn.toFixed(1)}g · C{" "}
                            {totaisEstruturados.cho.toFixed(1)}g · G {totaisEstruturados.lip.toFixed(1)}g
                          </span>
                        </div>
                      </div>
                    )}

                    {itensEstruturados.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setOpenAddAlimento(true)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-sm text-slate-600 hover:bg-slate-50 hover:border-rose-300 hover:text-rose-600 transition"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar alimento
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <RichTextEditor
                      value={itensHtml}
                      onChange={setItensHtml}
                      placeholder="Ex.: 2 fatias de pão integral, 1 ovo mexido, 200ml café com leite..."
                      minHeight={140}
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Liste os alimentos da refeição em texto livre. Use a barra de formatação para organizar.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Observação */}
            <div>
              <label className="text-xs font-medium text-slate-700">Observação</label>
              <textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Notas opcionais para esta refeição…"
                rows={3}
                className="mt-1.5 w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-background text-sm focus:ring-2 focus:ring-rose-100 focus:border-rose-300 outline-none resize-none"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                As observações estarão disponíveis para o paciente no aplicativo do MPTEAM.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-card">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition"
            >
              Cancelar
            </button>
            {mode === "create" && (
              <button
                onClick={() => handleSalvar(false)}
                disabled={!podeSalvar}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-rose-600 text-rose-600 text-sm font-semibold hover:bg-rose-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Salvar e Continuar
              </button>
            )}
            <button
              onClick={() => handleSalvar(true)}
              disabled={!podeSalvar}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {mode === "edit" ? "Salvar alterações" : "Salvar e Fechar"}
            </button>
          </div>
        </div>
        <AdicionarAlimentoModal
          open={openAddAlimento}
          onClose={() => setOpenAddAlimento(false)}
          onAdd={(it) => setItensEstruturados((prev) => [...prev, it])}
        />
        {editIdx !== null && itensEstruturados[editIdx] && (
          <EditarAlimentoFullModal
            open={editIdx !== null}
            onClose={() => setEditIdx(null)}
            initialPrincipal={itensEstruturados[editIdx]}
            initialSubstitutos={itensEstruturados[editIdx].substitutos}
            onReplace={(novo) => {
              setItensEstruturados((prev) => prev.map((p, i) => (i === editIdx ? novo : p)));
              setEditIdx(null);
            }}
          />
        )}
    </div>
  );
}
