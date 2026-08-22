import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  fmtBRL, MES_LABELS, comparePeriodoAnterior, parseDataLocal, type Transacao,
} from "@/lib/financeiro";
import type { Aluno } from "@/lib/crm";
import { MesAnoSelector } from "@/components/financeiro/MesAnoSelector";
import { MiniMetricasFaixa } from "@/components/financeiro/MiniMetricasFaixa";
import { MiniMetricaRow } from "@/components/financeiro/MiniMetricaRow";
import { NovaTransacaoModal } from "@/components/financeiro/NovaTransacaoModal";
import { DespesasPorCategoriaCard } from "@/components/financeiro/DespesasPorCategoriaCard";
import { EvolucaoFinanceiraCard } from "@/components/financeiro/EvolucaoFinanceiraCard";
import { NovosClientesMesCard } from "@/components/financeiro/NovosClientesMesCard";
import {
  DollarSign, TrendingUp, TrendingDown, Wallet,
  BarChart3, LineChart, Briefcase, UserPlus, Plus, Calendar, FileDown,
} from "lucide-react";
import { useRef } from "react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_app/financeiro/")({
  component: DashboardPage,
});

interface CategoriaRow { id: string; nome: string; cor: string }

function DashboardPage() {
  useAuth();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [cats, setCats] = useState<CategoriaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transacao | null>(null);
  const [exporting, setExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const hojeRef = new Date();
  const [ano, setAno] = useState<number>(hojeRef.getFullYear());
  const [mes, setMes] = useState<number>(hojeRef.getMonth());

  async function load() {
    setLoading(true);
    const inicioAno = `${new Date().getFullYear()}-01-01`;
    const [tx, al, c] = await Promise.all([
      supabase.from("transacoes").select("*")
        .gte("competencia", inicioAno)
        .order("data_transacao", { ascending: false, nullsFirst: false })
        .order("criado_em", { ascending: false }),
      supabase.from("alunos").select("*"),
      supabase.from("financeiro_categorias").select("id,nome,cor"),
    ]);
    setTransacoes((tx.data ?? []) as Transacao[]);
    setAlunos((al.data ?? []) as Aluno[]);
    setCats((c.data ?? []) as CategoriaRow[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  // KPIs do mês
  const kpis = useMemo(() => {
    const inicioMes = new Date(ano, mes, 1);
    const fimMes = new Date(ano, mes + 1, 0, 23, 59, 59);
    const noMes = transacoes.filter((t) => {
      const d = parseDataLocal(t.data_transacao ?? t.competencia);
      if (!d) return false;
      return d >= inicioMes && d <= fimMes;
    });
    const receitas = noMes.filter((t) => Number(t.valor) >= 0)
      .reduce((s, t) => s + Number(t.valor), 0);
    const despesas = noMes.filter((t) => Number(t.valor) < 0)
      .reduce((s, t) => s + Number(t.valor), 0);
    const ativos = alunos.filter((a) => a.status === "ativo").length;
    const novosClientes = alunos.filter((a) => {
      if (!a.data_compra) return false;
      const d = new Date(a.data_compra);
      return d >= inicioMes && d <= fimMes;
    }).length;
    return { receitas, despesas: Math.abs(despesas), saldo: receitas + despesas, ativos, novosClientes };
  }, [transacoes, alunos, ano, mes]);

  // Mês anterior — para comparativos
  const kpisAnt = useMemo(() => {
    const ini = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0, 23, 59, 59);
    const noMes = transacoes.filter((t) => {
      const d = parseDataLocal(t.data_transacao ?? t.competencia);
      if (!d) return false;
      return d >= ini && d <= fim;
    });
    const receitas = noMes.filter((t) => Number(t.valor) >= 0).reduce((s, t) => s + Number(t.valor), 0);
    const despesas = Math.abs(noMes.filter((t) => Number(t.valor) < 0).reduce((s, t) => s + Number(t.valor), 0));
    const nReceitas = noMes.filter((t) => Number(t.valor) >= 0).length;
    const ticket = nReceitas > 0 ? receitas / nReceitas : 0;
    const novosClientes = alunos.filter((a) => {
      if (!a.data_compra) return false;
      const d = new Date(a.data_compra);
      return d >= ini && d <= fim;
    }).length;
    const taxa = kpis.ativos > 0 ? (novosClientes / kpis.ativos) * 100 : 0;
    return { receitas, despesas, ticket, taxa };
  }, [transacoes, alunos, ano, mes, kpis.ativos]);

  const ticketAtual = useMemo(() => {
    const inicioMes = new Date(ano, mes, 1);
    const fimMes = new Date(ano, mes + 1, 0, 23, 59, 59);
    const rec = transacoes.filter((t) => {
      const d = parseDataLocal(t.data_transacao ?? t.competencia);
      if (!d) return false;
      return d >= inicioMes && d <= fimMes && Number(t.valor) >= 0;
    });
    return rec.length > 0 ? kpis.receitas / rec.length : 0;
  }, [transacoes, ano, mes, kpis.receitas]);

  const taxaNovos = kpis.ativos > 0 ? (kpis.novosClientes / kpis.ativos) * 100 : 0;
  const mesAntLabel = `${MES_LABELS[(mes + 11) % 12].slice(0, 3)}/${mes === 0 ? ano - 1 : ano}`;

  // KPIs anuais — faturamento e média mensal
  const anuais = useMemo(() => {
    const noAno = transacoes.filter((t) => {
      const d = parseDataLocal(t.data_transacao ?? t.competencia);
      if (!d) return false;
      return d.getFullYear() === ano && Number(t.valor) >= 0;
    });
    const faturamento = noAno.reduce((s, t) => s + Number(t.valor), 0);
    const mesesComReceita = new Set(
      noAno.map((t) => parseDataLocal(t.data_transacao ?? t.competencia)!.getMonth())
    ).size;
    const media = mesesComReceita > 0 ? faturamento / mesesComReceita : 0;
    return { faturamento, media };
  }, [transacoes, ano]);

  const cmpReceitas = comparePeriodoAnterior(kpis.receitas, kpisAnt.receitas);
  const cmpDespesas = comparePeriodoAnterior(kpis.despesas, kpisAnt.despesas);
  const cmpTicket = comparePeriodoAnterior(ticketAtual, kpisAnt.ticket);
  const cmpTaxa = comparePeriodoAnterior(taxaNovos, kpisAnt.taxa);

  async function exportarPDF() {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      // aguarda 2 frames para o React aplicar o estado (esconder botões)
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      const node = dashboardRef.current;
      const imgData = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      // descobre dimensões reais da imagem para manter proporção
      const img = new Image();
      img.src = imgData;
      await new Promise((r) => { img.onload = () => r(null); });
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (img.height * imgW) / img.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      pdf.save(`dashboard-financeiro-${MES_LABELS[mes]}-${ano}.pdf`);
    } catch (e) {
      console.error("Erro ao exportar PDF:", e);
      alert("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">Carregando…</div>;

  return (
    <div className="space-y-6" ref={dashboardRef}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
          <p className="text-sm fin-muted">{MES_LABELS[mes]} de {ano}</p>
        </div>
        {!exporting && (
          <div className="flex items-center gap-2">
            <button
              onClick={exportarPDF}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 transition border"
              style={{ borderColor: "var(--fin-border, #e5e7eb)", background: "#fff", color: "#111" }}
            >
              <FileDown className="h-4 w-4" /> Exportar PDF
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
              style={{ background: "var(--blue)" }}
            >
              <Plus className="h-4 w-4" /> Nova Transação
            </button>
          </div>
        )}
      </div>
      <MesAnoSelector ano={ano} mes={mes} onChange={(a, mm) => { setAno(a); setMes(mm); }} />

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiBox icon={Wallet} label="Saldo" value={fmtBRL(kpis.saldo)}
          color={kpis.saldo >= 0 ? "var(--green)" : "var(--red)"} />
        <KpiBox icon={TrendingUp} label="Receitas" value={fmtBRL(kpis.receitas)} color="var(--green)" />
        <KpiBox icon={TrendingDown} label="Despesas" value={fmtBRL(kpis.despesas)} color="var(--red)" />
        <KpiBox icon={DollarSign} label="Novos Clientes" value={String(kpis.novosClientes)} color="var(--blue)" />
        <KpiBox icon={Calendar} label={`Faturamento ${ano}`} value={fmtBRL(anuais.faturamento)} color="#3B82F6" />
        <KpiBox icon={BarChart3} label="Média mensal" value={fmtBRL(anuais.media)} color="#8B5CF6" />
      </div>

      {/* Faixa de mini-métricas */}
      <MiniMetricasFaixa>
        <MiniMetricaRow icon={BarChart3} iconColor="#3B82F6"
          label="Receita do mês" value={fmtBRL(kpis.receitas)}
          comparePct={cmpReceitas.pct} comparePeriodo={mesAntLabel} positivo={cmpReceitas.positivo} />
        <MiniMetricaRow icon={LineChart} iconColor="#10B981"
          label="Despesa do mês" value={fmtBRL(kpis.despesas)}
          comparePct={cmpDespesas.pct} comparePeriodo={mesAntLabel} positivo={!cmpDespesas.positivo} />
        <MiniMetricaRow icon={Briefcase} iconColor="#F59E0B"
          label="Ticket médio" value={fmtBRL(ticketAtual)}
          comparePct={cmpTicket.pct} comparePeriodo={mesAntLabel} positivo={cmpTicket.positivo} />
        <MiniMetricaRow icon={UserPlus} iconColor="#8B5CF6"
          label="Taxa de novos clientes" value={`${taxaNovos.toFixed(1)}%`}
          comparePct={cmpTaxa.pct} comparePeriodo={mesAntLabel} positivo={cmpTaxa.positivo} />
      </MiniMetricasFaixa>

      {/* Evolução + Despesas por categoria lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EvolucaoFinanceiraCard transacoes={transacoes} ano={ano} mes={mes} />
        <DespesasPorCategoriaCard
          transacoes={transacoes}
          categorias={cats}
          ano={ano}
          mes={mes}
        />
      </div>
      <NovosClientesMesCard alunos={alunos} ano={ano} mes={mes} />
      {showModal && (
        <NovaTransacaoModal
          onClose={() => setShowModal(false)}
          onSaved={() => { void load(); }}
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

function KpiBox({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string; value: string; color: string;
}) {
  return (
    <div className="fin-card">
      <div className="flex items-center gap-2.5">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full shrink-0"
          style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
        >
          <Icon className="h-4 w-4" style={{ color }} />
        </span>
        <p className="text-xs fin-muted leading-tight">{label}</p>
      </div>
      <p className="text-base font-bold mt-3 break-words" style={{ color }}>{value}</p>
    </div>
  );
}

