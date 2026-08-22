import { useEffect, useState } from "react";
import { X, Star, Trash2, Pencil, Loader2, Check } from "lucide-react";
import { loadFavoritos, deleteFavorito, renameFavorito, type Favorito } from "@/lib/foods";

export function FavoritosModal({
  open, onClose, onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (fav: Favorito) => void;
}) {
  const [favs, setFavs] = useState<Favorito[]>([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setLoading(true);
      setFavs(await loadFavoritos());
      setLoading(false);
    })();
  }, [open]);

  async function handleDelete(id: string) {
    if (!confirm("Apagar este favorito?")) return;
    if (await deleteFavorito(id)) setFavs((p) => p.filter((f) => f.id !== id));
  }

  async function commitRename() {
    if (!editId || !editName.trim()) return;
    if (await renameFavorito(editId, editName.trim())) {
      setFavs((p) => p.map((f) => (f.id === editId ? { ...f, nome: editName.trim() } : f)));
    }
    setEditId(null);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-150 px-safe">
      <div className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-card shadow-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h2 className="text-base font-semibold tracking-tight inline-flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" /> Favoritos
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/60"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="py-10 text-center text-muted-foreground text-sm"><Loader2 className="w-4 h-4 inline animate-spin mr-1" /> Carregando…</div>
          ) : favs.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum favorito ainda. Salve combinações com a estrela ⭐ na busca.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {favs.map((f) => (
                <li key={f.id} className="px-5 py-3 hover:bg-muted/30 transition group">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      {editId === f.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") void commitRename(); if (e.key === "Escape") setEditId(null); }}
                            className="flex-1 px-2 py-1 rounded border border-border text-sm bg-background"
                          />
                          <button onClick={commitRename} className="p-1 rounded hover:bg-emerald-50 text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div className="text-sm font-semibold text-slate-900 truncate">{f.nome}</div>
                      )}
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {f.principal.nome_custom}
                        {f.substitutos.length > 0 && <span> · +{f.substitutos.length} substituto{f.substitutos.length > 1 ? "s" : ""}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button onClick={() => { setEditId(f.id); setEditName(f.nome); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(f.id)} className="p-1.5 rounded hover:bg-rose-50 text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    <button
                      onClick={() => { onPick(f); onClose(); }}
                      className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 shrink-0"
                    >
                      Usar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}