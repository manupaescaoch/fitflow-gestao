import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { readCache, writeCache } from "@/lib/swr-cache";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import {
  Plus, Search, AlertTriangle, Clock, CheckCircle2, Wallet, CalendarClock,
} from "lucide-react";
import { fmtBRL, type Transacao } from "@/lib/financeiro";
import { MesAnoSelector } from "@/components/financeiro/MesAnoSelector";
import { NovaTransacaoModal } from "@/components/financeiro/NovaTransacaoModal";
import { AcoesTransacaoMenu } from "@/components/financeiro/AcoesTransacaoMenu";

export const Route = createFileRoute("/_app/financeiro/contas-pagar")({
  component: ContasPagarPage,
});

interface Categoria { id: string; nome: string; tipo: string; cor: string }

type StatusConta = "pago" | "vencida" | "vence_hoje" | "a_vencer";
type FiltroStatus = "todas" | "pendentes" | "vencidas" | "pagas";

const STATUS_COLORS: Record<StatusConta, { bg: string; fg: string; label: string }> = {
  pago:       { bg: "#10B98120", fg: "#10B981", label: "Pago" },
  vencida:    { bg: "#EF444420", fg: "#EF4444", label: "Vencida" },
  vence_hoje: { bg: "#F59E0B20", fg: "#F59E0B", label: "Vence hoje" },
  a_vencer:   { bg: "#6B728020", fg: "#6B7280", label: "A vencer" },
};

function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}

function calcStatus(tx: Transacao, hoje: Date): StatusConta {
  if (tx.data_transacao) return "pago";
  const venc = startOfDay(new Date((tx.competencia ?? "") + "T12:00:00"));
  const h = startOfDay(hoje);
  if (venc.getTime() < h.getTime()) return "vencida";
  if (venc.getTime() === h.getTime()) return "vence_hoje";
  return "a_vencer";
}

export function ContasPagarPage() {
  const { isAdmin } = useAuth();
  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const cached = readCache<{ transacoes: Transacao[]; cats: Categoria[] }>("fin-cp");
  const [transacoes, setTransacoes] = useState<Transacao[]>(cached?.transacoes ?? []);
  const [cats, setCats] = useState<Categoria[]>(cached?.cats ?? []);
  const [loading, setLoading] = useState(!cached);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todas");
  const [filtroCat, setFiltroCat] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transacao | null>(null);

  async function load() {
    const inicioAno = `${hoje.getFullYear()}-01-01`;
    const [txRes, catsRes] = await Promise.all([
      supabase.from("transacoes").select("*").lt("valor", 0).gte("competencia", inicioAno).order("competencia", { ascending: true }),
      supabase.from("financeiro_categorias").select("*").order("nome"),
    ]);
    const tt = (txRes.data ?? []) as Transacao[];
    const cc = (catsRes.data ?? []) as Categoria[];
    setTransacoes(tt); setCats(cc);
    writeCache("fin-cp", { transacoes: tt, cats: cc });
    setLoading(false);
  }
  useEffect(() => {
    void load();
    const ch = supabase
      .channel("fin-cp-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "transacoes" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const catsDespesa = cats.filter((c) => {
    const t = c.tipo?.toLowerCase();
    return t === "despesa" || t === "saida" || t === "saída";
  });

  // KPIs do mês selecionado
  const kpis = useMemo(() => {
    const ini = new Date(ano, mes, 1);
    const fim = new Date(ano, mes + 1, 0, 23, 59, 59);
    const h = startOfDay(hoje);
    const em7 = new Date(h); em7.setDate(em7.getDate() + 7);

    const doMes = transacoes.filter((t) => {
      const c = new Date((t.competencia ?? "") + "T12:00:00");
      return c >= ini && c <= fim;
    });
    const aPagar = doMes.filter((t) => !t.data_transacao);
    const pagas = doMes.filter((t) => !!t.data_transacao);
    const vencidasGeral = transacoes.filter((t) => {
      if (t.data_transacao) return false;
      const c = startOfDay(new Date((t.competencia ?? "") + "T12:00:00"));
      return c.getTime() < h.getTime();
    });
    const vence7 = transacoes.filter((t) => {
      if (t.data_transacao) return false;
      const c = startOfDay(new Date((t.competencia ?? "") + "T12:00:00"));
      return c.getTime() >= h.getTime() && c.getTime() <= startOfDay(em7).getTime();
    });

    const sum = (xs: Transacao[]) => xs.reduce((s, x) => s + Math.abs(Number(x.valor)), 0);
    return {
      aPagar:   { valor: sum(aPagar), qtd: aPagar.length },
      vencidas: { valor: sum(vencidasGeral), qtd: vencidasGeral.length },
      vence7:   { valor: sum(vence7), qtd: vence7.length },
      pagas:    { valor: sum(pagas), qtd: pagas.length },
    };
  }, [transacoes, ano, mes, hoje]);

  // Linhas filtradas + ordenadas
  const linhas = useMemo(() => {
    const ini = new Date(ano, mes, 1);
    const fim = new Date(ano, mes + 1, 0, 23, 59, 59);
    const buscaNorm = busca.trim().toLowerCase();

    const filtrar = transacoes.filter((t) => {
      const c = new Date((t.competencia ?? "") + "T12:00:00");
      if (c < ini || c > fim) return false;
      if (filtroCat !== "todas" && t.categoria_id !== filtroCat) return false;
      const status = calcStatus(t, hoje);
      if (filtroStatus === "pendentes" && status === "pago") return false;
      if (filtroStatus === "vencidas" && status !== "vencida") return false;
      if (filtroStatus === "pagas" && status !== "pago") return false;
      if (buscaNorm && !(t.descricao ?? "").toLowerCase().includes(buscaNorm)) return false;
      return true;
    });

    const rank: Record<StatusConta, number> = { vencida: 0, vence_hoje: 1, a_vencer: 2, pago: 3 };
    return filtrar.sort((a, b) => {
      const sa = calcStatus(a, hoje); const sb = calcStatus(b, hoje);
      if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb];
      const ca = (a.competencia ?? ""); const cb = (b.competencia ?? "");
      return ca.localeCompare(cb);
    });
  }, [transacoes, ano, mes, hoje, filtroStatus, filtroCat, busca]);

  async function togglePagamento(tx: Transacao) {
    const hojeStr = new Date().toISOString().slice(0, 10);
    const novoVal = tx.data_transacao ? null : hojeStr;
    const { error } = await supabase.from("transacoes")
      .update({ data_transacao: novoVal })
      .eq("id", tx.id);
    if (error) { toast.error(error.message); return; }
    toast.success(novoVal ? "Conta marcada como paga." : "Pagamento desfeito.");
    void load();
  }

  async function excluir(tx: Transacao) {
    const { error } = await supabase.from("transacoes").delete().eq("id", tx.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Transação excluída.");
    void load();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas a Pagar</h1>
          <p className="text-sm fin-muted">Gerencie despesas pendentes e fluxo de saída</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setEditingTx(null); setShowModal(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--blue)" }}
          >
            <Plus className="h-4 w-4" /> Nova despesa
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<Wallet className="h-5 w-5" style={{ color: "#3B82F6" }} />}
          label="A pagar no mês"
          valor={kpis.aPagar.valor}
          qtd={kpis.aPagar.qtd}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" style={{ color: "#EF4444" }} />}
          label="Vencidas"
          valor={kpis.vencidas.valor}
          qtd={kpis.vencidas.qtd}
          accent="#EF4444"
        />
        <KpiCard
          icon={<CalendarClock className="h-5 w-5" style={{ color: "#F59E0B" }} />}
          label="Vence em 7 dias"
          valor={kpis.vence7.valor}
          qtd={kpis.vence7.qtd}
          accent="#F59E0B"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5" style={{ color: "#10B981" }} />}
          label="Pago no mês"
          valor={kpis.pagas.valor}
          qtd={kpis.pagas.qtd}
          accent="#10B981"
        />
      </div>

      {/* Filtros + MesAno */}
      <div className="fin-card p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
            className="px-3 py-2 rounded-lg border bg-white text-sm">
            <option value="todas">Todas</option>
            <option value="pendentes">Pendentes</option>
            <option value="vencidas">Vencidas</option>
            <option value="pagas">Pagas</option>
          </select>
          <select value={filtroCat} onChange={(e) => setFiltroCat(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-white text-sm">
            <option value="todas">Todas categorias</option>
            {catsDespesa.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 fin-muted" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar descrição…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border bg-white text-sm" />
          </div>
        </div>
        <MesAnoSelector ano={ano} mes={mes} onChange={(a, m) => { setAno(a); setMes(m); }} />
      </div>

      {/* Tabela */}
      <div className="fin-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border-light)" }}>
                <Th>Vencimento</Th>
                <Th>Descrição</Th>
                <Th>Categoria</Th>
                <Th className="text-right">Valor</Th>
                <Th>Status</Th>
                <Th className="w-10"></Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-10 text-center fin-muted">Carregando…</td></tr>
              ) : linhas.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center fin-muted">
                  Nenhuma conta encontrada para o período.
                </td></tr>
              ) : linhas.map((t) => {
                const status = calcStatus(t, hoje);
                const cat = cats.find((c) => c.id === t.categoria_id);
                const cs = STATUS_COLORS[status];
                const rowBg = status === "vencida" ? "rgba(239, 68, 68, 0.04)" : undefined;
                return (
                  <tr key={t.id} className="border-b hover:bg-gray-50/50"
                    style={{ borderColor: "var(--border-light)", background: rowBg }}>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {fmtData(t.competencia)}
                      {t.data_transacao && (
                        <CheckCircle2 className="inline-block ml-1.5 h-3.5 w-3.5" style={{ color: "#10B981" }} />
                      )}
                    </td>
                    <td className="py-3 px-4">{t.descricao ?? "—"}</td>
                    <td className="py-3 px-4">
                      {cat ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: cat.cor + "20", color: cat.cor }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: cat.cor }} />
                          {cat.nome}
                        </span>
                      ) : <span className="fin-muted">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold" style={{ color: "var(--red)" }}>
                      {fmtBRL(Math.abs(Number(t.valor)))}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: cs.bg, color: cs.fg }}>
                        {status === "vencida" && <AlertTriangle className="h-3 w-3" />}
                        {status === "vence_hoje" && <Clock className="h-3 w-3" />}
                        {cs.label}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {isAdmin && (
                        <AcoesTransacaoMenu
                          extraActions={[
                            {
                              label: t.data_transacao ? "Desfazer pagamento" : "Marcar como pago",
                              onClick: () => void togglePagamento(t),
                            },
                          ]}
                          onEdit={() => { setEditingTx(t); setShowModal(true); }}
                          onDelete={() => excluir(t)}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <NovaTransacaoModal
          transacao={editingTx ?? undefined}
          onClose={() => { setShowModal(false); setEditingTx(null); }}
          onSaved={() => { void load(); }}
        />
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide fin-muted ${className}`}>
      {children}
    </th>
  );
}

function fmtData(c: string | null): string {
  if (!c) return "—";
  const d = new Date(c + "T12:00:00");
  return d.toLocaleDateString("pt-BR");
}

function KpiCard({ icon, label, valor, qtd, accent }: {
  icon: React.ReactNode; label: string; valor: number; qtd: number; accent?: string;
}) {
  return (
    <div className="fin-card p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide fin-muted">{label}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight" style={{ color: accent }}>
        {fmtBRL(valor)}
      </div>
      <div className="text-xs fin-muted mt-0.5">
        {qtd} {qtd === 1 ? "conta" : "contas"}
      </div>
    </div>
  );
}