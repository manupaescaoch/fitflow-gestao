import { useEffect, useState } from "react";
import { X, LayoutTemplate, Loader2, Trash2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { DietaPlano } from "@/lib/dieta";
import { toast } from "sonner";

export function TemplateModal({
  open, onClose, onCarregar, onSalvarComoTemplate, canEdit,
}: {
  open: boolean;
  onClose: () => void;
  onCarregar: (planoId: string) => void;
  onSalvarComoTemplate: (nome: string) => Promise<void>;
  canEdit: boolean;
}) {
  const [list, setList] = useState<DietaPlano[]>([]);
  const [loading, setLoading] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("dieta_planos")
      .select("*")
      .eq("template", true)
      .order("criado_em", { ascending: false });
    setList((data ?? []) as DietaPlano[]);
    setLoading(false);
  }

  async function remover(id: string) {
    if (!confirm("Apagar este template?")) return;
    const { error } = await supabase.from("dieta_planos").delete().eq("id", id);
    if (error) { toast.error("Erro ao apagar"); return; }
    toast.success("Template removido");
    void load();
  }

  async function salvar() {
    if (!novoNome.trim()) return;
    setBusy(true);
    try {
      await onSalvarComoTemplate(novoNome.trim());
      toast.success("Template salvo");
      setNovoNome("");
      void load();
    } catch (e) {
      toast.error("Erro ao salvar template");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 px-safe">
      <div className="bg-background w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <LayoutTemplate className="w-4 h-4 text-violet-700" />
          </div>
          <div className="flex-1 text-sm font-semibold">Templates de dieta</div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : list.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">Nenhum template salvo ainda.</div>
          ) : (
            <div className="space-y-1.5">
              {list.map((t) => (
                <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group">
                  <button onClick={() => { onCarregar(t.id); onClose(); }} className="flex-1 text-left">
                    <div className="text-sm font-medium">{t.nome}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t.meta_kcal ? `${t.meta_kcal} kcal · ` : ""}{new Date(t.criado_em).toLocaleDateString("pt-BR")}
                    </div>
                  </button>
                  {canEdit && (
                    <button onClick={() => remover(t.id)} className="p-1.5 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600 opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {canEdit && (
          <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center gap-2">
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Salvar plano atual como template…"
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-rose-300"
            />
            <button
              onClick={salvar}
              disabled={busy || !novoNome.trim()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
