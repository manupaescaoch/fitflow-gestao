import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { Transacao } from "@/lib/financeiro";
import { GerenciarCategoriasModal } from "./GerenciarCategoriasModal";
import {
  X, DollarSign, ArrowDownRight, ArrowUpRight, RefreshCw, Layers, Settings,
} from "lucide-react";

interface CategoriaRow { id: string; nome: string; tipo: string; cor: string }

interface Props {
  onClose: () => void;
  onSaved: () => void;
  transacao?: Transacao;
}

const PAGAMENTOS = ["Pix", "Dinheiro", "Cartão de Crédito", "Cartão de Débito", "Boleto", "Transferência"];

function parseValor(s: string): number {
  if (!s) return 0;
  const norm = s.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = Number(norm);
  return isNaN(n) ? 0 : n;
}

export function NovaTransacaoModal({ onClose, onSaved, transacao }: Props) {
  const { crmUser } = useAuth();
  const isEdit = !!transacao;
  const initialTipo: "despesa" | "receita" =
    transacao && Number(transacao.valor) < 0 ? "despesa" : "receita";
  const [tipo, setTipo] = useState<"despesa" | "receita">(initialTipo);
  const [descricao, setDescricao] = useState(transacao?.descricao ?? "");
  const [valor, setValor] = useState(
    transacao ? String(Math.abs(Number(transacao.valor))).replace(".", ",") : ""
  );
  const [categoriaId, setCategoriaId] = useState(transacao?.categoria_id ?? "");
  const [data, setData] = useState(
    transacao?.data_transacao ?? transacao?.competencia ?? new Date().toISOString().slice(0, 10)
  );
  const [pagamento, setPagamento] = useState(transacao?.referencia ?? "");
  const [banco, setBanco] = useState(transacao?.banco ?? "");
  const [recorrente, setRecorrente] = useState(false);
  const [parcelado, setParcelado] = useState(false);
  const [parcelas, setParcelas] = useState(2);
  const [cats, setCats] = useState<CategoriaRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [showCats, setShowCats] = useState(false);

  async function loadCats() {
    const { data } = await supabase.from("financeiro_categorias").select("*").order("nome");
    setCats((data ?? []) as CategoriaRow[]);
  }
  useEffect(() => { void loadCats(); }, []);

  const categoriasFiltradas = cats.filter((c) => {
    const t = c.tipo?.toLowerCase();
    if (tipo === "despesa") return t === "despesa" || t === "saida" || t === "saída";
    return t === "receita" || t === "entrada";
  });

  async function handleSalvar() {
    const v = parseValor(valor);
    if (!descricao.trim()) { toast.error("Informe a descrição."); return; }
    if (v <= 0) { toast.error("Informe um valor válido."); return; }
    if (!categoriaId) { toast.error("Selecione uma categoria."); return; }

    const valorBase = tipo === "despesa" ? -Math.abs(v) : Math.abs(v);
    const dt = new Date(data + "T12:00:00");
    const baseDescricao = recorrente && !parcelado ? `${descricao.trim()} [Recorrente]` : descricao.trim();

    setSaving(true);
    try {
      // Modo edição: update simples
      if (isEdit && transacao) {
        const comp = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-01`;
        const { error } = await supabase.from("transacoes").update({
          descricao: descricao.trim(),
          valor: valorBase,
          competencia: comp,
          data_transacao: data,
          categoria_id: categoriaId,
          referencia: pagamento || null,
          banco: banco || null,
        }).eq("id", transacao.id);
        if (error) throw error;
        toast.success("Transação atualizada.");
        onSaved(); onClose();
        return;
      }

      const rows: TablesInsert<"transacoes">[] = [];

      if (parcelado && parcelas >= 2) {
        const valorParc = Number((valorBase / parcelas).toFixed(2));
        for (let i = 0; i < parcelas; i++) {
          const d = new Date(dt.getFullYear(), dt.getMonth() + i, dt.getDate());
          const comp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
          rows.push({
            descricao: `${descricao.trim()} (${i + 1}/${parcelas})`,
            valor: valorParc,
            competencia: comp,
            data_transacao: i === 0 ? data : null,
            categoria_id: categoriaId,
            referencia: pagamento || null,
            banco: banco || null,
            origem: "manual",
            tipo: "receita",
            criado_por: crmUser?.id ?? null,
          });
        }
      } else {
        const comp = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-01`;
        rows.push({
          descricao: baseDescricao,
          valor: valorBase,
          competencia: comp,
          data_transacao: data,
          categoria_id: categoriaId,
          referencia: pagamento || null,
          banco: banco || null,
          origem: "manual",
          tipo: "receita",
          criado_por: crmUser?.id ?? null,
        });
      }

      const { error } = await supabase.from("transacoes").insert(rows);
      if (error) throw error;
      toast.success(rows.length > 1 ? `${rows.length} parcelas lançadas.` : "Transação lançada.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const corTipo = tipo === "despesa" ? "var(--red)" : "var(--green)";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto px-safe">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[640px] my-8">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b" style={{ borderColor: "var(--border-light)" }}>
          <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--border-light)" }}>
            <DollarSign className="h-5 w-5 fin-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold leading-tight">
              {isEdit ? "Editar Transação" : "Nova Transação"}
            </h2>
            <p className="text-xs fin-muted">
              {isEdit ? "Atualize os dados da transação" : "Adicione receita ou despesa"}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="h-5 w-5 fin-muted" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Toggle Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setTipo("despesa"); setCategoriaId(""); }}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition"
              style={{
                borderColor: tipo === "despesa" ? "var(--red)" : "var(--border-light)",
                background: tipo === "despesa" ? "var(--red)" + "0F" : "transparent",
                color: tipo === "despesa" ? "var(--red)" : "var(--muted-foreground, #6b7280)",
              }}
            >
              <ArrowDownRight className="h-4 w-4" /> Despesa
            </button>
            <button
              type="button"
              onClick={() => { setTipo("receita"); setCategoriaId(""); }}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition"
              style={{
                borderColor: tipo === "receita" ? "var(--green)" : "var(--border-light)",
                background: tipo === "receita" ? "var(--green)" + "0F" : "transparent",
                color: tipo === "receita" ? "var(--green)" : "var(--muted-foreground, #6b7280)",
              }}
            >
              <ArrowUpRight className="h-4 w-4" /> Receita
            </button>
          </div>

          {/* Grid 2 cols */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Descrição">
              <input value={descricao} onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Almoço" className={inputCls} />
            </Field>
            <Field label="Valor (R$)">
              <input value={valor} onChange={(e) => setValor(e.target.value)}
                inputMode="decimal" placeholder="0,00" className={inputCls}
                style={{ color: corTipo, fontWeight: 600 }} />
            </Field>

            <Field label="Categoria *">
              <div className="flex gap-2">
                <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={inputCls}>
                  <option value="">— Selecione —</option>
                  {categoriasFiltradas.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowCats(true)}
                  title="Gerenciar categorias"
                  className="px-2.5 rounded-lg border bg-white hover:bg-gray-50 shrink-0"
                  style={{ borderColor: "var(--border-light)" }}>
                  <Settings className="h-4 w-4 fin-muted" />
                </button>
              </div>
            </Field>
            <Field label="Data">
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
            </Field>

            <Field label="Pagamento">
              <select value={pagamento} onChange={(e) => setPagamento(e.target.value)} className={inputCls}>
                <option value="">— Selecione —</option>
                {PAGAMENTOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Banco">
              <input value={banco} onChange={(e) => setBanco(e.target.value)}
                placeholder="Nenhum banco" className={inputCls} />
            </Field>
          </div>

          {/* Checkboxes — escondidos em modo edição */}
          {!isEdit && (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer p-3 rounded-xl border"
              style={{ borderColor: "var(--border-light)" }}>
              <input type="checkbox" checked={recorrente}
                onChange={(e) => { setRecorrente(e.target.checked); if (e.target.checked) setParcelado(false); }} />
              <RefreshCw className="h-4 w-4 fin-muted" /> Recorrente
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer p-3 rounded-xl border"
              style={{ borderColor: "var(--border-light)" }}>
              <input type="checkbox" checked={parcelado}
                onChange={(e) => { setParcelado(e.target.checked); if (e.target.checked) setRecorrente(false); }} />
              <Layers className="h-4 w-4 fin-muted" /> Parcelado
            </label>
          </div>
          )}

          {!isEdit && parcelado && (
            <Field label="Nº de parcelas">
              <input type="number" min={2} max={24} value={parcelas}
                onChange={(e) => setParcelas(Math.max(2, Math.min(24, Number(e.target.value) || 2)))}
                className={inputCls} />
            </Field>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-5 border-t" style={{ borderColor: "var(--border-light)" }}>
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold fin-muted hover:underline">
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--blue)" }}>
            {saving ? "Salvando…" : isEdit ? "Atualizar" : "Salvar"}
          </button>
        </div>
      </div>
      {showCats && (
        <GerenciarCategoriasModal
          onClose={() => setShowCats(false)}
          onChanged={() => { void loadCats(); }}
        />
      )}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2.5 rounded-lg border bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide fin-muted mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
