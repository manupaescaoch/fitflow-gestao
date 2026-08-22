import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readCache, writeCache } from "@/lib/swr-cache";
import { useAuth } from "@/lib/auth";
import { fmtBRL, parseDataLocal } from "@/lib/financeiro";
import { parseOFX } from "@/lib/ofx";
import { toast } from "sonner";
import { Upload, Plus, Filter, Tags, Wallet, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { MesAnoSelector } from "@/components/financeiro/MesAnoSelector";
import { LancarTransacaoAvulsaModal } from "@/components/financeiro/LancarTransacaoAvulsaModal";
import { NovaTransacaoModal } from "@/components/financeiro/NovaTransacaoModal";
import { AcoesTransacaoMenu } from "@/components/financeiro/AcoesTransacaoMenu";
import type { Transacao } from "@/lib/financeiro";

export const Route = createFileRoute("/_app/financeiro/transacoes")({
  component: TransacoesPage,
});

interface Categoria {
  id: string; nome: string; tipo: "receita" | "despesa"; cor: string;
}
interface TxRow {
  id: string;
  data_transacao: string | null;
  competencia: string;
  descricao: string | null;
  tipo: string;
  origem: string;
  valor: number;
  banco: string | null;
  fitid: string | null;
  categoria_id: string | null;
}

export function TransacoesPage() {
  const { isAdmin } = useAuth();
  const cached = readCache<{ cats: Categoria[]; txs: TxRow[] }>("fin-tx");
  const [cats, setCats] = useState<Categoria[]>(cached?.cats ?? []);
  const [txs, setTxs] = useState<TxRow[]>(cached?.txs ?? []);
  const [loading, setLoading] = useState(!cached);
  const [filtroTipo, setFiltroTipo] = useState<"" | "receita" | "despesa">("");
  const [filtroCat, setFiltroCat] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [showCatModal, setShowCatModal] = useState(false);
  const [showLancar, setShowLancar] = useState(false);
  const [editingTx, setEditingTx] = useState<Transacao | null>(null);
  const [importando, setImportando] = useState(false);
  const hoje = new Date();
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [mes, setMes] = useState<number>(hoje.getMonth()); // 0-11
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const [c, t] = await Promise.all([
      supabase.from("financeiro_categorias").select("*").order("tipo").order("nome"),
      supabase.from("transacoes").select("id,data_transacao,competencia,descricao,tipo,origem,valor,banco,fitid,categoria_id")
        .order("data_transacao", { ascending: false, nullsFirst: false })
        .order("criado_em", { ascending: false })
        .limit(500),
    ]);
    const cc = (c.data ?? []) as Categoria[];
    const tt = (t.data ?? []) as TxRow[];
    setCats(cc); setTxs(tt);
    writeCache("fin-tx", { cats: cc, txs: tt });
    setLoading(false);
  }
  useEffect(() => {
    void load();
    const ch = supabase
      .channel("fin-tx-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "transacoes" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "financeiro_categorias" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const filtradas = useMemo(() => {
    return txs.filter((t) => {
      const d = parseDataLocal(t.data_transacao ?? t.competencia);
      if (d) {
        if (d.getFullYear() !== ano || d.getMonth() !== mes) return false;
      }
      if (filtroTipo === "receita" && Number(t.valor) < 0) return false;
      if (filtroTipo === "despesa" && Number(t.valor) >= 0) return false;
      if (filtroCat && t.categoria_id !== filtroCat) return false;
      if (busca && !(t.descricao ?? "").toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [txs, filtroTipo, filtroCat, busca, ano, mes]);

  const totais = useMemo(() => {
    const r = filtradas.filter((t) => Number(t.valor) >= 0).reduce((s, t) => s + Number(t.valor), 0);
    const d = filtradas.filter((t) => Number(t.valor) < 0).reduce((s, t) => s + Number(t.valor), 0);
    const qR = filtradas.filter((t) => Number(t.valor) >= 0).length;
    const qD = filtradas.filter((t) => Number(t.valor) < 0).length;
    return { receitas: r, despesas: Math.abs(d), saldo: r + d, qR, qD };
  }, [filtradas]);

  // Saldo do ano todo (independente do mês filtrado)
  const saldoAno = useMemo(() => {
    const noAno = txs.filter((t) => {
      const d = parseDataLocal(t.data_transacao ?? t.competencia);
      return d !== null && d.getFullYear() === ano;
    });
    return noAno.reduce((s, t) => s + Number(t.valor), 0);
  }, [txs, ano]);

  async function handleArquivoOFX(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportando(true);
    try {
      const texto = await file.text();
      const res = parseOFX(texto);
      if (!res.transacoes.length) {
        toast.error("Nenhuma transação encontrada no arquivo OFX.");
        return;
      }
      const banco = res.banco ?? "OFX";
      const rows = res.transacoes.map((t) => ({
        fitid: t.fitid,
        banco,
        data_transacao: t.data,
        competencia: `${t.data.slice(0, 7)}-01`,
        valor: t.valor,
        tipo: t.valor >= 0 ? "receita" : "despesa",
        origem: "ofx",
        descricao: t.descricao,
      }));
      // upsert por (fitid, banco) — duplicados são ignorados
      const { error, count } = await supabase
        .from("transacoes")
        .upsert(rows, { onConflict: "fitid,banco", ignoreDuplicates: true, count: "exact" });
      if (error) { toast.error(error.message); return; }
      toast.success(`${count ?? rows.length} transação(ões) importadas (${rows.length - (count ?? rows.length)} duplicadas ignoradas).`);
      await load();
    } catch (err) {
      toast.error("Falha ao processar OFX: " + (err as Error).message);
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function alterarCategoria(txId: string, catId: string | null) {
    const { error } = await supabase
      .from("transacoes").update({ categoria_id: catId }).eq("id", txId);
    if (error) { toast.error(error.message); return; }
    setTxs((prev) => prev.map((t) => t.id === txId ? { ...t, categoria_id: catId } : t));
  }

  async function excluirTx(txId: string) {
    const { error } = await supabase.from("transacoes").delete().eq("id", txId);
    if (error) { toast.error(error.message); return; }
    toast.success("Transação excluída.");
    await load();
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold">Transações</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowCatModal(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold fin-btn-ghost">
            <Tags className="h-3.5 w-3.5" /> Categorias
          </button>
          <input ref={fileRef} type="file" accept=".ofx,.OFX,application/x-ofx" onChange={handleArquivoOFX} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={importando}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--blue)" }}>
            <Upload className="h-3.5 w-3.5" />
            {importando ? "Importando…" : "Importar OFX"}
          </button>
          <button onClick={() => setShowLancar(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold text-white"
            style={{ background: "var(--text)" }}>
            <Plus className="h-3.5 w-3.5" /> Lançar
          </button>
        </div>
      </div>

      {/* KPIs grandes — Saldo Mês / Saldo Ano / Receitas / Despesas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="fin-card">
          <div className="flex items-start justify-between">
            <p className="text-sm fin-muted">Saldo Mês</p>
            <Wallet className="h-4 w-4 fin-muted" />
          </div>
          <p className="text-3xl font-bold mt-2"
            style={{ color: totais.saldo >= 0 ? "var(--green)" : "var(--red)" }}>
            {totais.saldo < 0 ? "-" : ""}{fmtBRL(Math.abs(totais.saldo))}
          </p>
        </div>
        <div className="fin-card">
          <div className="flex items-start justify-between">
            <p className="text-sm fin-muted">Saldo Ano</p>
            <Calendar className="h-4 w-4 fin-muted" />
          </div>
          <p className="text-3xl font-bold mt-2"
            style={{ color: saldoAno >= 0 ? "var(--green)" : "var(--red)" }}>
            {saldoAno < 0 ? "-" : ""}{fmtBRL(Math.abs(saldoAno))}
          </p>
          <p className="text-xs fin-muted mt-1">Jan - Dez {ano}</p>
        </div>
        <div className="fin-card">
          <div className="flex items-start justify-between">
            <p className="text-sm fin-muted">Receitas</p>
            <TrendingUp className="h-4 w-4" style={{ color: "var(--green)" }} />
          </div>
          <p className="text-3xl font-bold mt-2" style={{ color: "var(--green)" }}>{fmtBRL(totais.receitas)}</p>
          <p className="text-xs fin-muted mt-1">{totais.qR}</p>
        </div>
        <div className="fin-card">
          <div className="flex items-start justify-between">
            <p className="text-sm fin-muted">Despesas</p>
            <TrendingDown className="h-4 w-4" style={{ color: "var(--red)" }} />
          </div>
          <p className="text-3xl font-bold mt-2" style={{ color: "var(--red)" }}>{fmtBRL(totais.despesas)}</p>
          <p className="text-xs fin-muted mt-1">{totais.qD}</p>
        </div>
      </div>

      {/* Seletor de ano + meses */}
      <MesAnoSelector ano={ano} mes={mes} onChange={(a, m) => { setAno(a); setMes(m); }} />

      {/* Filtros */}
      <div className="fin-card flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 fin-muted" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição…"
          className="h-8 px-3 rounded-lg text-xs flex-1 min-w-[180px]" />
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}
          className="h-8 px-2 rounded-lg text-xs">
          <option value="">Todos os tipos</option>
          <option value="receita">Entradas</option>
          <option value="despesa">Saídas</option>
        </select>
        <select value={filtroCat} onChange={(e) => setFiltroCat(e.target.value)}
          className="h-8 px-2 rounded-lg text-xs">
          <option value="">Todas as categorias</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <span className="text-xs fin-muted ml-auto">{filtradas.length} de {txs.length} transações</span>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto fin-card p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 text-xs font-medium">Data</th>
              <th className="text-left text-xs font-medium">Descrição</th>
              <th className="text-left text-xs font-medium">Banco</th>
              <th className="text-left text-xs font-medium">Categoria</th>
              <th className="text-right pr-4 text-xs font-medium">Valor</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="py-8 text-center fin-muted text-xs">Carregando…</td></tr>
            )}
            {!loading && filtradas.slice(0, 200).map((t) => {
              const valor = Number(t.valor);
              const data = t.data_transacao ?? t.competencia;
              const cat = cats.find((c) => c.id === t.categoria_id);
              return (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="py-3 px-4 whitespace-nowrap">{new Date(data).toLocaleDateString("pt-BR")}</td>
                  <td className="max-w-[420px] truncate" title={t.descricao ?? ""}>
                    {t.descricao ?? "—"}
                  </td>
                  <td className="fin-muted text-xs">{t.banco ?? t.origem}</td>
                  <td>
                    <select
                      value={t.categoria_id ?? ""}
                      onChange={(e) => alterarCategoria(t.id, e.target.value || null)}
                      className="h-7 px-2 rounded text-xs max-w-[180px]"
                      style={cat ? { color: cat.cor, borderColor: cat.cor } : undefined}
                    >
                      <option value="">— sem categoria —</option>
                      <optgroup label="Receitas">
                        {cats.filter((c) => c.tipo === "receita").map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Despesas">
                        {cats.filter((c) => c.tipo === "despesa").map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </optgroup>
                    </select>
                  </td>
                  <td className="text-right pr-4 font-semibold whitespace-nowrap"
                    style={{ color: valor < 0 ? "var(--red)" : "var(--green)" }}>
                    {valor >= 0 ? "+" : ""}{fmtBRL(valor)}
                  </td>
                  <td className="py-3 px-2">
                    {isAdmin && (
                      <AcoesTransacaoMenu
                        onEdit={() => setEditingTx(t as unknown as Transacao)}
                        onDelete={() => excluirTx(t.id)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && filtradas.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center fin-muted text-xs">
                Nenhuma transação. Importe um arquivo OFX para começar.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCatModal && (
        <CategoriasModal cats={cats} isAdmin={isAdmin}
          onClose={() => setShowCatModal(false)} onChange={load} />
      )}
      {showLancar && (
        <LancarTransacaoAvulsaModal
          onClose={() => setShowLancar(false)}
          onSaved={load}
        />
      )}
      {editingTx && (
        <NovaTransacaoModal
          transacao={editingTx}
          onClose={() => setEditingTx(null)}
          onSaved={() => { void load(); }}
        />
      )}
    </div>
  );
}

function CategoriasModal({ cats, isAdmin, onClose, onChange }: {
  cats: Categoria[]; isAdmin: boolean; onClose: () => void; onChange: () => void;
}) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [cor, setCor] = useState("#6B7280");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!nome.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("financeiro_categorias")
      .insert({ nome: nome.trim(), tipo, cor });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setNome(""); onChange();
  }
  async function del(id: string) {
    if (!confirm("Excluir categoria? As transações ficarão sem categoria.")) return;
    const { error } = await supabase.from("financeiro_categorias").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    onChange();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 px-safe" onClick={onClose}>
      <div className="fin-card max-w-lg w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Categorias</h3>
          <button onClick={onClose} className="fin-muted text-sm">Fechar</button>
        </div>

        {isAdmin && (
          <div className="flex gap-2 mb-4">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome"
              className="flex-1 h-9 px-3 rounded-lg text-sm" />
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}
              className="h-9 px-2 rounded-lg text-sm">
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </select>
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)}
              className="h-9 w-12 rounded-lg cursor-pointer" />
            <button onClick={add} disabled={saving}
              className="h-9 px-3 rounded-lg text-xs font-semibold text-white"
              style={{ background: "var(--text)" }}>
              <Plus className="h-3.5 w-3.5 inline" /> Add
            </button>
          </div>
        )}

        <ul className="divide-y" style={{ borderColor: "var(--border-light)" }}>
          {cats.map((c) => (
            <li key={c.id} className="py-2 flex items-center gap-3 text-sm">
              <span className="h-3 w-3 rounded-full" style={{ background: c.cor }} />
              <span className="flex-1">{c.nome}</span>
              <span className="text-xs fin-muted capitalize">{c.tipo}</span>
              {isAdmin && (
                <button onClick={() => del(c.id)} className="text-xs" style={{ color: "var(--red)" }}>
                  Excluir
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}