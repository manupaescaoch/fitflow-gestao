import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Pencil, Trash2, Plus, X, FileDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BibliotecaListLayout } from "@/components/biblioteca/BibliotecaListLayout";
import { RichTextEditor } from "@/components/aluno/dieta/RichTextEditor";
import { htmlToPlainText } from "@/lib/rich-html";
import { exportarPdfPrescricao } from "@/lib/prescricao-pdf";
import type { Aluno } from "@/lib/crm";

export const Route = createFileRoute("/_app/biblioteca/prescricoes")({
  head: () => ({ meta: [{ title: "Modelos de Prescrição — Biblioteca" }] }),
  component: PrescricoesPage,
});

type Modelo = {
  id: string;
  nome: string;
  descricao: string | null;
  posologia: string | null;
  suplementos: string[];
  fitoterapicos: string[];
  observacoes: string | null;
  atualizado_em: string;
};

type ModeloForm = {
  nome: string;
  descricao: string;
  posologia: string;
  suplementos: string[];
  fitoterapicos: string[];
  observacoes: string;
};

function emptyForm(): ModeloForm {
  return {
    nome: "",
    descricao: "",
    posologia: "",
    suplementos: [],
    fitoterapicos: [],
    observacoes: "",
  };
}

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function PrescricoesPage() {
  const [items, setItems] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Modelo | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("prescricao_modelos")
      .select("*")
      .order("atualizado_em", { ascending: false });
    if (error) toast.error("Erro ao carregar modelos");
    setItems(((data ?? []) as any[]).map((r) => ({
      ...r,
      suplementos: Array.isArray(r.suplementos) ? r.suplementos : [],
      fitoterapicos: Array.isArray(r.fitoterapicos) ? r.fitoterapicos : [],
    })));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = normalize(q.trim());
    if (!term) return items;
    return items.filter((m) => normalize(m.nome).includes(term));
  }, [items, q]);

  function handleCreate() {
    setEditing(null);
    setOpen(true);
  }

  function handleEdit(m: Modelo) {
    setEditing(m);
    setOpen(true);
  }

  async function handleDelete(m: Modelo) {
    if (!confirm(`Excluir o modelo "${m.nome}"?`)) return;
    const { error } = await (supabase as any).from("prescricao_modelos").delete().eq("id", m.id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Modelo excluído");
    load();
  }

  async function handleExportPdf(m: Modelo) {
    try {
      const alunoFake = {
        id: m.id,
        nome: "—",
      } as unknown as Aluno;
      await exportarPdfPrescricao(
        {
          titulo: m.nome,
          data: new Date().toISOString().slice(0, 10),
          descricao: m.descricao ?? "",
          posologia: m.posologia ?? "",
          suplementos: m.suplementos ?? [],
          fitoterapicos: m.fitoterapicos ?? [],
          observacoes: m.observacoes ?? "",
        },
        alunoFake,
      );
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar PDF");
    }
  }

  return (
    <>
      <BibliotecaListLayout
        title="Modelos de Prescrição"
        description="Modelos prontos de prescrições alimentares, orientações e estruturas reutilizáveis."
        icon={FileText}
        onCreate={handleCreate}
        createLabel="Novo modelo"
        searchPlaceholder="Buscar modelo por nome…"
        query={q}
        onQueryChange={setQ}
        isEmpty={!loading && filtered.length === 0}
        emptyHint={q ? `Nenhum modelo encontrado para "${q}".` : "Você ainda não possui nenhum modelo de prescrição."}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-border bg-card p-4 hover:shadow-sm transition flex flex-col"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 grid place-items-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h3 className="font-semibold text-foreground truncate">{m.nome}</h3>
                    </div>
                    {m.descricao && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-3">
                        {htmlToPlainText(m.descricao)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                  {m.suplementos.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {m.suplementos.length} suplemento{m.suplementos.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {m.fitoterapicos.length > 0 && (
                    <span className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200">
                      {m.fitoterapicos.length} fitoterápico{m.fitoterapicos.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {m.posologia && (
                    <span className="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                      posologia
                    </span>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-end gap-1">
                  <button
                    onClick={() => handleExportPdf(m)}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md hover:bg-muted text-foreground"
                    title="Exportar modelo em PDF"
                  >
                    <FileDown className="w-3.5 h-3.5 text-rose-600" /> PDF
                  </button>
                  <button
                    onClick={() => handleEdit(m)}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md hover:bg-muted text-foreground"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(m)}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md hover:bg-destructive/10 text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </BibliotecaListLayout>

      {open && (
        <ModeloModal
          initial={editing}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            load();
          }}
        />
      )}
    </>
  );
}

function ModeloModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Modelo | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ModeloForm>(() =>
    initial
      ? {
          nome: initial.nome,
          descricao: initial.descricao ?? "",
          posologia: initial.posologia ?? "",
          suplementos: initial.suplementos ?? [],
          fitoterapicos: initial.fitoterapicos ?? [],
          observacoes: initial.observacoes ?? "",
        }
      : emptyForm(),
  );
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do modelo");
      return;
    }
    setSaving(true);
    const descricaoTexto = htmlToPlainText(form.descricao).trim();
    const payload = {
      nome: form.nome.trim(),
      descricao: descricaoTexto ? form.descricao : null,
      posologia: form.posologia.trim() || null,
      suplementos: form.suplementos.map((s) => s.trim()).filter(Boolean),
      fitoterapicos: form.fitoterapicos.map((s) => s.trim()).filter(Boolean),
      observacoes: form.observacoes.trim() || null,
    };
    const res = initial
      ? await (supabase as any).from("prescricao_modelos").update(payload).eq("id", initial.id)
      : await (supabase as any).from("prescricao_modelos").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error("Erro ao salvar modelo");
      return;
    }
    toast.success(initial ? "Modelo atualizado" : "Modelo criado");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-2xl my-8 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">{initial ? "Editar modelo" : "Novo modelo de prescrição"}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Nome *</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              placeholder="Ex.: Protocolo emagrecimento básico"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
            <div className="mt-1">
              <RichTextEditor
                value={form.descricao}
                onChange={(html) => setForm({ ...form, descricao: html })}
                placeholder="Descreva o modelo, recomendações, observações gerais…"
                minHeight={220}
                maxHeight={320}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              rows={3}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
            />
          </div>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {initial ? "Salvar alterações" : "Criar modelo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ListaEditavel({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [valor, setValor] = useState("");
  function adicionar() {
    const v = valor.trim();
    if (!v) return;
    onChange([...items, v]);
    setValor("");
  }
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="mt-1 flex gap-2">
        <input
          type="text"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
        />
        <button
          type="button"
          onClick={adicionar}
          className="px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted inline-flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Adicionar
        </button>
      </div>
      {items.length > 0 && (
        <ul className="mt-2 space-y-1">
          {items.map((it, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md bg-muted/40 border border-border text-sm"
            >
              <span className="truncate">{it}</span>
              <button
                onClick={() => onChange(items.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive p-1 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}