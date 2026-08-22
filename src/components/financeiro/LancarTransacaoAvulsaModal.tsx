import { useEffect, useState } from "react";
import { X, History, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { fmtBRL, parseDataLocal, type Transacao } from "@/lib/financeiro";
import { NovaTransacaoModal } from "@/components/financeiro/NovaTransacaoModal";

interface Categoria { id: string; nome: string; tipo: "receita" | "despesa"; cor: string }

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function LancarTransacaoAvulsaModal({ onClose, onSaved }: Props) {
  const { crmUser, isAdmin } = useAuth();
  const [cats, setCats] = useState<Categoria[]>([]);
  const hoje = new Date().toISOString().slice(0, 10);
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hoje);
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [saving, setSaving] = useState(false);
  const [historico, setHistorico] = useState<Transacao[]>([]);
  const [editando, setEditando] = useState<Transacao | null>(null);

  useEffect(() => {
    void supabase.from("financeiro_categorias").select("*").order("nome")
      .then(({ data }) => setCats((data ?? []) as Categoria[]));
  }, []);

  async function carregarHistorico() {
    const { data } = await supabase
      .from("transacoes")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(10);
    setHistorico((data ?? []) as Transacao[]);
  }

  useEffect(() => {
    void carregarHistorico();
    const ch = supabase
      .channel("fin-tx-hist-modal")
      .on("postgres_changes", { event: "*", schema: "public", table: "transacoes" }, () => {
        void carregarHistorico();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  async function salvar() {
    const num = Number(valor.replace(",", "."));
    if (!num || isNaN(num)) { toast.error("Valor inválido"); return; }
    const valorFinal = tipo === "despesa" ? -Math.abs(num) : Math.abs(num);
    setSaving(true);
    const { error } = await supabase.from("transacoes").insert({
      tipo,
      origem: "manual",
      valor: valorFinal,
      data_transacao: data,
      competencia: `${data.slice(0, 7)}-01`,
      descricao: descricao || null,
      categoria_id: categoriaId || null,
      criado_por: crmUser?.nome ?? crmUser?.email ?? "sistema",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Transação lançada");
    // Limpa o formulário para agilizar lançamentos em sequência
    setValor("");
    setDescricao("");
    setCategoriaId("");
    await carregarHistorico();
    onSaved();
  }

  const catsFiltradas = cats.filter((c) => c.tipo === tipo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 px-safe" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 text-[#111] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Lançar transação</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { setTipo("receita"); setCategoriaId(""); }}
            className="h-10 rounded-lg text-sm font-semibold border-2 transition-colors"
            style={tipo === "receita"
              ? { background: "var(--green)", color: "#fff", borderColor: "var(--green)" }
              : { borderColor: "#e5e7eb", color: "#374151" }}>
            Receita
          </button>
          <button onClick={() => { setTipo("despesa"); setCategoriaId(""); }}
            className="h-10 rounded-lg text-sm font-semibold border-2 transition-colors"
            style={tipo === "despesa"
              ? { background: "var(--red)", color: "#fff", borderColor: "var(--red)" }
              : { borderColor: "#e5e7eb", color: "#374151" }}>
            Despesa
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Valor (R$)</label>
            <input value={valor} onChange={(e) => setValor(e.target.value)}
              placeholder="0,00" className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Categoria</label>
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}
            className="w-full h-9 px-2 rounded-lg border border-gray-200 text-sm">
            <option value="">— sem categoria —</option>
            {catsFiltradas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Descrição</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
            placeholder="Opcional" className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm" />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 h-10 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
            Fechar
          </button>
          <button onClick={salvar} disabled={saving}
            className="flex-1 h-10 rounded-lg bg-black text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>

        {/* Histórico dos últimos lançamentos */}
        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <History className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold">Últimos lançamentos</h3>
          </div>
          {historico.length === 0 ? (
            <p className="text-xs text-gray-500 py-3">Nenhum lançamento registrado ainda.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {historico.map((t) => {
                const dTx = parseDataLocal(t.data_transacao ?? t.competencia);
                const dataTx = dTx ? dTx.toLocaleDateString("pt-BR") : "—";
                const criado = t.criado_em
                  ? new Date(t.criado_em).toLocaleString("pt-BR", {
                      day: "2-digit", month: "2-digit", year: "2-digit",
                      hour: "2-digit", minute: "2-digit",
                    })
                  : "—";
                const v = Number(t.valor);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setEditando(t)}
                      disabled={!isAdmin}
                      className="w-full text-left py-2 flex items-center gap-3 hover:bg-gray-50 rounded-md px-1 disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-700 whitespace-nowrap">{dataTx}</span>
                          <span className="text-sm truncate" title={t.descricao ?? ""}>
                            {t.descricao ?? <span className="text-gray-400 italic">sem descrição</span>}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">Lançado em {criado}</p>
                      </div>
                      <span
                        className="text-sm font-semibold whitespace-nowrap"
                        style={{ color: v < 0 ? "var(--red)" : "var(--green)" }}
                      >
                        {v >= 0 ? "+" : ""}{fmtBRL(v)}
                      </span>
                      {isAdmin && <Pencil className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {editando && (
        <NovaTransacaoModal
          transacao={editando}
          onClose={() => setEditando(null)}
          onSaved={() => { void carregarHistorico(); onSaved(); }}
        />
      )}
    </div>
  );
}
