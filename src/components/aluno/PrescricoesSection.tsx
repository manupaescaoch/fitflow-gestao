import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Plus, Save, Trash2, Loader2, FileDown, FileInput, X, Search, MessageCircle, Printer, Eye, Pencil } from "lucide-react";
import { exportarPdfPrescricao } from "@/lib/prescricao-pdf";
import type { Aluno } from "@/lib/crm";
import { RichTextEditor } from "@/components/aluno/dieta/RichTextEditor";
import { normalizeRich, sanitizeRichHtml } from "@/lib/rich-html";

type Prescricao = {
  id: string;
  aluno_id: string;
  titulo: string | null;
  data: string | null;
  descricao: string | null;
  posologia: string | null;
  suplementos: string[];
  fitoterapicos: string[];
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
};

type ModeloPrescricao = {
  id: string;
  nome: string;
  descricao: string | null;
  posologia: string | null;
  suplementos: string[];
  fitoterapicos: string[];
  observacoes: string | null;
};

type Draft = Omit<Prescricao, "id" | "aluno_id" | "criado_em" | "atualizado_em">;

function emptyDraft(aluno: Aluno): Draft {
  return {
    titulo: `Prescrição para ${aluno.nome}`,
    data: new Date().toISOString().slice(0, 10),
    descricao: "",
    posologia: "",
    suplementos: [],
    fitoterapicos: [],
    observacoes: "",
  };
}

function hasContentDraft(d: Draft): boolean {
  return Boolean(
    (d.titulo && d.titulo.trim()) ||
    (d.descricao && d.descricao.trim()) ||
    (d.posologia && d.posologia.trim()) ||
    d.suplementos.some((s) => s.trim()) ||
    d.fitoterapicos.some((s) => s.trim()) ||
    (d.observacoes && d.observacoes.trim())
  );
}

export function PrescricoesSection({ alunoId, aluno, canEdit }: { alunoId: string; aluno: Aluno; canEdit: boolean }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Prescricao[]>([]);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const [visualizar, setVisualizar] = useState<Prescricao | null>(null);
  const [busyPdfId, setBusyPdfId] = useState<string | null>(null);

  useEffect(() => { void carregar(); }, [alunoId]);

  async function carregar() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("prescricoes")
      .select("*")
      .eq("aluno_id", alunoId)
      .order("atualizado_em", { ascending: false });
    if (error) {
      console.error("[Prescrições] erro ao carregar", error);
      toast.error(error?.message ?? "Erro ao carregar prescrições");
    }
    setItems(((data ?? []) as any[]).map((r) => ({
      id: r.id,
      aluno_id: r.aluno_id,
      titulo: r.titulo,
      data: r.data,
      descricao: r.descricao,
      posologia: r.posologia,
      suplementos: Array.isArray(r.suplementos) ? r.suplementos : [],
      fitoterapicos: Array.isArray(r.fitoterapicos) ? r.fitoterapicos : [],
      observacoes: r.observacoes,
      criado_em: r.criado_em,
      atualizado_em: r.atualizado_em,
    })));
    setLoading(false);
  }

  function nova() {
    setEditing({ id: null, draft: emptyDraft(aluno) });
  }

  function editar(p: Prescricao) {
    setEditing({
      id: p.id,
      draft: {
        titulo: p.titulo,
        data: p.data,
        descricao: p.descricao,
        posologia: p.posologia,
        suplementos: [...p.suplementos],
        fitoterapicos: [...p.fitoterapicos],
        observacoes: p.observacoes,
      },
    });
  }

  async function salvar() {
    if (!editing) return;
    if (!hasContentDraft(editing.draft)) { toast.error("Preencha pelo menos um campo"); return; }
    if (!editing.draft.titulo?.trim()) { toast.error("Informe o título da prescrição"); return; }
    setSalvando(true);
    const payload = {
      aluno_id: alunoId,
      titulo: editing.draft.titulo,
      data: editing.draft.data,
      descricao: editing.draft.descricao,
      posologia: editing.draft.posologia,
      suplementos: editing.draft.suplementos.filter((s) => s.trim()),
      fitoterapicos: editing.draft.fitoterapicos.filter((s) => s.trim()),
      observacoes: editing.draft.observacoes,
    };
    let error;
    if (editing.id) {
      ({ error } = await (supabase as any).from("prescricoes").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await (supabase as any).from("prescricoes").insert(payload));
    }
    setSalvando(false);
    if (error) {
      console.error("[Prescrições] erro ao salvar", error, { editingId: editing.id, payload });
      toast.error(error?.message ?? "Erro ao salvar prescrição");
      return;
    }
    toast.success(editing.id ? "Prescrição atualizada" : "Prescrição salva");
    setEditing(null);
    void carregar();
  }

  async function excluir(p: Prescricao) {
    if (!confirm("Excluir esta prescrição?")) return;
    const { error } = await (supabase as any).from("prescricoes").delete().eq("id", p.id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Prescrição removida");
    void carregar();
  }

  function aplicarModelo(m: ModeloPrescricao) {
    if (!editing) return;
    setEditing({
      id: editing.id,
      draft: {
        ...editing.draft,
        descricao: m.descricao ?? "",
        posologia: m.posologia ?? "",
        suplementos: Array.isArray(m.suplementos) ? [...m.suplementos] : [],
        fitoterapicos: Array.isArray(m.fitoterapicos) ? [...m.fitoterapicos] : [],
        observacoes: m.observacoes ?? "",
      },
    });
    setImportarOpen(false);
    toast.success(`Modelo "${m.nome}" aplicado`);
  }

  async function handleSalvarPdf(p: Prescricao) {
    if (busyPdfId) return;
    setBusyPdfId(p.id);
    try {
      await exportarPdfPrescricao(
        {
          titulo: p.titulo ?? undefined,
          data: p.data ?? undefined,
          descricao: p.descricao ?? "",
          posologia: p.posologia ?? "",
          suplementos: p.suplementos,
          fitoterapicos: p.fitoterapicos,
          observacoes: p.observacoes ?? "",
        } as any,
        aluno,
      );
      toast.success("PDF gerado");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar PDF");
    } finally {
      setBusyPdfId(null);
    }
  }

  function handleWhatsApp() {
    const num = (aluno.whatsapp ?? "").replace(/\D+/g, "");
    if (!num) { toast.error("Aluno sem WhatsApp"); return; }
    const msg = encodeURIComponent(`Olá ${aluno.nome.split(" ")[0]}, segue sua prescrição nutricional atualizada.`);
    window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
      </div>
    );
  }

  // Modo edição
  if (editing) {
    const d = editing.draft;
    return (
      <>
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-bold">{editing.id ? "Editar prescrição" : "Nova prescrição"}</h2>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={() => setImportarOpen(true)}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted"
                >
                  <FileInput className="h-4 w-4" /> Importar de modelo
                </button>
              )}
              <button
                onClick={() => setEditing(null)}
                className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-primary hover:bg-primary text-white font-semibold disabled:opacity-50"
              >
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Título">
              <input
                type="text"
                value={d.titulo ?? ""}
                onChange={(e) => setEditing({ ...editing, draft: { ...d, titulo: e.target.value } })}
                placeholder="Prescrição para..."
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
              />
            </Field>
            <Field label="Data">
              <input
                type="date"
                value={d.data ?? ""}
                onChange={(e) => setEditing({ ...editing, draft: { ...d, data: e.target.value } })}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
              />
            </Field>
          </div>

          <Field label="Descrição">
            <RichTextEditor
              value={d.descricao ?? ""}
              onChange={(html) => setEditing({ ...editing, draft: { ...d, descricao: html } })}
              placeholder="Texto principal da prescrição..."
              minHeight={140}
            />
          </Field>

          <Field label="Observações">
            <RichTextEditor
              value={d.observacoes ?? ""}
              onChange={(html) => setEditing({ ...editing, draft: { ...d, observacoes: html } })}
              placeholder="Observações adicionais..."
              minHeight={110}
            />
          </Field>
        </div>
        {importarOpen && (
          <ImportarModeloModal
            onClose={() => setImportarOpen(false)}
            onSelect={aplicarModelo}
          />
        )}
      </>
    );
  }

  // Estado vazio
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-base font-semibold">Nenhuma prescrição</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Crie quantas prescrições nutricionais quiser para este aluno.
        </p>
        {canEdit && (
          <button
            onClick={nova}
            className="inline-flex items-center gap-2 rounded-md bg-primary hover:bg-primary text-white px-4 py-2 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" /> Adicionar prescrição
          </button>
        )}
      </div>
    );
  }

  // Lista
  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Prescrições <span className="text-sm font-normal text-muted-foreground">({items.length})</span></h2>
          {canEdit && (
            <button
              onClick={nova}
              className="inline-flex items-center gap-2 rounded-md bg-primary hover:bg-primary text-white px-3 py-2 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" /> Nova prescrição
            </button>
          )}
        </div>

        {items.map((p) => (
          <div key={p.id} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-slate-700 shrink-0" />
                <h3 className="text-sm font-semibold text-slate-800 truncate">
                  {p.titulo || "Prescrição nutricional"}
                </h3>
                {p.data && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    · {new Date(`${p.data}T00:00:00`).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <ActionBtn icon={Eye} label="Visualizar" onClick={() => setVisualizar(p)} />
                <ActionBtn icon={FileDown} label="PDF" onClick={() => handleSalvarPdf(p)} busy={busyPdfId === p.id} />
                <ActionBtn icon={MessageCircle} label="WhatsApp" onClick={handleWhatsApp} />
                {canEdit && (
                  <>
                    <button
                      onClick={() => editar(p)}
                      className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted ml-1"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => excluir(p)}
                      className="text-sm px-2.5 py-1.5 rounded-md border border-border hover:bg-muted text-rose-600"
                      title="Excluir prescrição"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="p-5 space-y-4">
              <Block titulo="Descrição" texto={p.descricao ?? ""} />
              <Block titulo="Posologia" texto={p.posologia ?? ""} />
              <Lista titulo="Suplementos" itens={p.suplementos} />
              <Lista titulo="Fitoterápicos" itens={p.fitoterapicos} />
              <Block titulo="Observações" texto={p.observacoes ?? ""} />
            </div>
          </div>
        ))}
      </div>

      {visualizar && (
        <PrescricaoVisualizarModal
          presc={visualizar}
          aluno={aluno}
          onClose={() => setVisualizar(null)}
        />
      )}
    </>
  );
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function ImportarModeloModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (m: ModeloPrescricao) => void;
}) {
  const [items, setItems] = useState<ModeloPrescricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from("prescricao_modelos")
        .select("*")
        .order("nome", { ascending: true });
      if (error) toast.error("Erro ao carregar modelos");
      setItems(((data ?? []) as any[]).map((r) => ({
        id: r.id,
        nome: r.nome,
        descricao: r.descricao,
        posologia: r.posologia,
        suplementos: Array.isArray(r.suplementos) ? r.suplementos : [],
        fitoterapicos: Array.isArray(r.fitoterapicos) ? r.fitoterapicos : [],
        observacoes: r.observacoes,
      })));
      setLoading(false);
    })();
  }, []);

  const term = normalize(q.trim());
  const filtered = term ? items.filter((m) => normalize(m.nome).includes(term)) : items;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">Importar modelo de prescrição</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Selecione um modelo da biblioteca para aplicar.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar modelo por nome…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
        </div>
        <div className="overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {q ? `Nenhum modelo encontrado para "${q}".` : "Nenhum modelo cadastrado. Crie modelos em Biblioteca → Prescrições."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={() => onSelect(m)}
                    className="w-full text-left px-3 py-3 rounded-lg hover:bg-muted/60 transition flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 grid place-items-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{m.nome}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                        {m.suplementos.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {m.suplementos.length} sup.
                          </span>
                        )}
                        {m.fitoterapicos.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">
                            {m.fitoterapicos.length} fito.
                          </span>
                        )}
                        {m.posologia && (
                          <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">posologia</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Block({ titulo, texto }: { titulo: string; texto?: string }) {
  if (!texto || !texto.trim()) return null;
  const html = sanitizeRichHtml(normalizeRich(texto));
  return (
    <div>
      <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wide mb-1.5">{titulo}</h3>
      <div
        className="prose prose-sm max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function Lista({ titulo, itens }: { titulo: string; itens?: string[] }) {
  const filtrados = (itens ?? []).filter((i) => i.trim());
  if (!filtrados.length) return null;
  return (
    <div>
      <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wide mb-1.5">{titulo}</h3>
      <ul className="text-sm space-y-1">
        {filtrados.map((i, idx) => (
          <li key={idx} className="flex gap-2"><span className="text-rose-500">•</span><span>{i}</span></li>
        ))}
      </ul>
    </div>
  );
}

function ListaEdit({
  label, placeholder, itens, onChange,
}: {
  label: string;
  placeholder: string;
  itens: string[];
  onChange: (itens: string[]) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
        <button
          type="button"
          onClick={() => onChange([...itens, ""])}
          className="text-xs inline-flex items-center gap-1 text-rose-600 hover:text-rose-700"
        >
          <Plus className="h-3 w-3" /> Adicionar
        </button>
      </div>
      {itens.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Nenhum item.</p>
      )}
      <div className="space-y-2">
        {itens.map((it, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={it}
              onChange={(e) => {
                const next = [...itens];
                next[idx] = e.target.value;
                onChange(next);
              }}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm"
            />
            <button
              type="button"
              onClick={() => onChange(itens.filter((_, i) => i !== idx))}
              className="p-2 rounded-md hover:bg-muted text-muted-foreground"
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionBtn({
  icon: Icon, label, onClick, busy,
}: { icon: any; label: string; onClick: () => void; busy?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function PrescricaoVisualizarModal({
  presc, aluno, onClose,
}: { presc: Prescricao; aluno: Aluno; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 print:static print:bg-transparent print:p-0">
      <div className="bg-white text-slate-900 rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col print:max-h-none print:max-w-none print:rounded-none print:shadow-none">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 print:hidden">
          <h2 className="text-lg font-bold">Visualizar prescrição</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" /> Imprimir
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-8 space-y-5 print:overflow-visible">
          <div className="border-b border-slate-200 pb-4">
            <h1 className="text-2xl font-bold">{presc.titulo || "Prescrição nutricional"}</h1>
            <p className="text-sm text-slate-600 mt-1">
              {aluno.nome}
              {presc.data && ` · ${new Date(`${presc.data}T00:00:00`).toLocaleDateString("pt-BR")}`}
            </p>
          </div>
          <Block titulo="Descrição" texto={presc.descricao ?? ""} />
          <Block titulo="Posologia" texto={presc.posologia ?? ""} />
          <Lista titulo="Suplementos" itens={presc.suplementos} />
          <Lista titulo="Fitoterápicos" itens={presc.fitoterapicos} />
          <Block titulo="Observações" texto={presc.observacoes ?? ""} />
        </div>
      </div>
    </div>
  );
}
