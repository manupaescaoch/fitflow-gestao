import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Plus, Trash2 } from "lucide-react";

interface Categoria { id: string; nome: string; tipo: string; cor: string }

interface Props {
  onClose: () => void;
  onChanged: () => void;
}

const CORES = [
  "#6B7280", "#EF4444", "#10B981", "#3B82F6",
  "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4",
];

export function GerenciarCategoriasModal({ onClose, onChanged }: Props) {
  const [cats, setCats] = useState<Categoria[]>([]);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");
  const [cor, setCor] = useState(CORES[0]);
  const [saving, setSaving] = useState(false);

  async function reload() {
    const { data } = await supabase
      .from("financeiro_categorias")
      .select("*")
      .order("nome");
    setCats((data ?? []) as Categoria[]);
  }
  useEffect(() => { void reload(); }, []);

  async function handleCreate() {
    if (!nome.trim()) { toast.error("Informe o nome da categoria."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("financeiro_categorias").insert({
        nome: nome.trim(), tipo, cor,
      });
      if (error) throw error;
      toast.success("Categoria criada.");
      setNome(""); setCor(CORES[0]);
      await reload();
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir esta categoria? Transações vinculadas ficarão sem categoria.")) return;
    const { error } = await supabase.from("financeiro_categorias").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Categoria excluída.");
    await reload();
    onChanged();
  }

  const grupos: Record<string, Categoria[]> = { receita: [], despesa: [] };
  for (const c of cats) {
    const t = c.tipo?.toLowerCase();
    if (t === "receita" || t === "entrada") grupos.receita.push(c);
    else grupos.despesa.push(c);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 overflow-y-auto px-safe">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[560px] my-8">
        <div className="flex items-start gap-3 p-5 border-b" style={{ borderColor: "var(--border-light)" }}>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold leading-tight">Gerenciar Categorias</h2>
            <p className="text-xs fin-muted">Crie e organize categorias de receita e despesa</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-5 w-5 fin-muted" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Form */}
          <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border-light)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide fin-muted">Nova categoria</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setTipo("despesa")}
                className="py-2 rounded-lg border-2 text-xs font-semibold transition"
                style={{
                  borderColor: tipo === "despesa" ? "var(--red)" : "var(--border-light)",
                  background: tipo === "despesa" ? "var(--red)0F" : "transparent",
                  color: tipo === "despesa" ? "var(--red)" : "#6b7280",
                }}>Despesa</button>
              <button type="button" onClick={() => setTipo("receita")}
                className="py-2 rounded-lg border-2 text-xs font-semibold transition"
                style={{
                  borderColor: tipo === "receita" ? "var(--green)" : "var(--border-light)",
                  background: tipo === "receita" ? "var(--green)0F" : "transparent",
                  color: tipo === "receita" ? "var(--green)" : "#6b7280",
                }}>Receita</button>
            </div>
            <input
              value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder="Nome da categoria"
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200"
            />
            <div className="flex items-center gap-2 flex-wrap">
              {CORES.map((c) => (
                <button key={c} type="button" onClick={() => setCor(c)}
                  className="h-7 w-7 rounded-full border-2 transition"
                  style={{
                    background: c,
                    borderColor: cor === c ? "#111" : "transparent",
                  }} />
              ))}
            </div>
            <button onClick={handleCreate} disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--blue)" }}>
              <Plus className="h-4 w-4" /> {saving ? "Salvando…" : "Criar categoria"}
            </button>
          </div>

          {/* Lista */}
          {(["receita", "despesa"] as const).map((g) => (
            <div key={g}>
              <p className="text-[11px] font-semibold uppercase tracking-wide fin-muted mb-2">
                {g === "receita" ? "Receitas" : "Despesas"} ({grupos[g].length})
              </p>
              {grupos[g].length === 0 ? (
                <p className="text-xs fin-muted">Nenhuma categoria cadastrada.</p>
              ) : (
                <ul className="space-y-1">
                  {grupos[g].map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border"
                      style={{ borderColor: "var(--border-light)" }}>
                      <span className="flex items-center gap-2 text-sm min-w-0">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ background: c.cor }} />
                        <span className="truncate">{c.nome}</span>
                      </span>
                      <button onClick={() => handleDelete(c.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end p-5 border-t" style={{ borderColor: "var(--border-light)" }}>
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold border"
            style={{ borderColor: "var(--border-light)" }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}