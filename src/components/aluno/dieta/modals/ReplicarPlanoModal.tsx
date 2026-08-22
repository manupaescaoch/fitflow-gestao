import { useEffect, useMemo, useState } from "react";
import { X, Users, Loader2, Search, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { clonarPlano } from "@/lib/dieta-clone";

type AlunoLite = { id: string; nome: string; whatsapp: string | null; status: string | null };

export function ReplicarPlanoModal({
  open, onClose, planoId, alunoOrigemId, criadoPor,
}: {
  open: boolean;
  onClose: () => void;
  planoId: string | null;
  alunoOrigemId: string;
  criadoPor?: string | null;
}) {
  const [list, setList] = useState<AlunoLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQuery(""); setSelecionado(null);
    void load();
  }, [open]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("alunos")
      .select("id, nome, whatsapp, status")
      .neq("id", alunoOrigemId)
      .order("nome", { ascending: true })
      .limit(500);
    setList((data ?? []) as AlunoLite[]);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) =>
      a.nome.toLowerCase().includes(q) || (a.whatsapp ?? "").includes(q)
    );
  }, [list, query]);

  async function replicar() {
    if (!planoId || !selecionado) return;
    setBusy(true);
    try {
      await clonarPlano({
        origemPlanoId: planoId,
        destino: { tipo: "aluno", alunoId: selecionado },
        criadoPor: criadoPor ?? null,
      });
      const dest = list.find((a) => a.id === selecionado);
      toast.success(`Plano replicado para ${dest?.nome ?? "aluno"}`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao replicar plano");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
            <Users className="w-4 h-4 text-sky-700" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">Replicar plano para aluno</div>
            <div className="text-[11px] text-muted-foreground">Cria uma cópia como rascunho no destino.</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar aluno por nome ou WhatsApp…"
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-sky-300"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground py-10 text-center">Nenhum aluno encontrado.</div>
          ) : (
            <div className="space-y-1">
              {filtered.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelecionado(a.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selecionado === a.id ? "bg-sky-50 ring-1 ring-sky-300" : "hover:bg-muted/60"
                  }`}
                >
                  <div className="font-medium text-slate-800">{a.nome}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {a.whatsapp ?? "sem WhatsApp"}{a.status ? ` · ${a.status}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-sm hover:bg-muted">Cancelar</button>
          <button
            onClick={replicar}
            disabled={busy || !selecionado}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
            Replicar
          </button>
        </div>
      </div>
    </div>
  );
}