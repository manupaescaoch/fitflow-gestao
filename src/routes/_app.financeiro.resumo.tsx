import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readCache, writeCache } from "@/lib/swr-cache";
import { useAuth } from "@/lib/auth";
import {
  fmtBRL, fmtCompetencia, ultimas3Competencias,
  crescimentoPct, taxaInadimplencia, MES_LABELS, type Transacao,
} from "@/lib/financeiro";
import type { Aluno, Modalidade } from "@/lib/crm";
import { MODALIDADE_LABEL } from "@/lib/crm";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  DollarSign, Clock, AlertTriangle, TrendingUp, Users, Receipt,
  ArrowUpRight, AlertCircle, ShieldAlert, Activity,
} from "lucide-react";
import { KpiCard } from "@/components/financeiro/KpiCard";
import { MesAnoSelector } from "@/components/financeiro/MesAnoSelector";
import { LancarTransacaoModal } from "@/components/financeiro/LancarTransacaoModal";
import { PagamentosTab } from "@/components/financeiro/PagamentosTab";
import { TransacoesTab } from "@/components/financeiro/TransacoesTab";
import { PlanosTab } from "@/components/financeiro/PlanosTab";
import { ConfiguracoesTab } from "@/components/financeiro/ConfiguracoesTab";
import { ClientesTab } from "@/components/financeiro/ClientesTab";
import { VendasPage } from "./_app.financeiro.vendas";

export const Route = createFileRoute("/_app/financeiro/resumo")({
  component: ResumoPage,
});

type TabKey = "pagamentos" | "transacoes" | "planos" | "config";
type TopTabKey = "clientes" | "vendas" | "financeiro";
const PIE_COLORS = ["#111111", "#DC2626", "#2563EB"];

function ResumoPage() {
  const { isAdmin } = useAuth();
  const cached = readCache<{ alunos: Aluno[]; transacoes: Transacao[] }>("fin-resumo");
  const [alunos, setAlunos] = useState<Aluno[]>(cached?.alunos ?? []);
  const [transacoes, setTransacoes] = useState<Transacao[]>(cached?.transacoes ?? []);
  const [loading, setLoading] = useState(!cached);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<TabKey>("pagamentos");
  const [topTab, setTopTab] = useState<TopTabKey>("clientes");
  const hojeRef = new Date();
  const [ano, setAno] = useState<number>(hojeRef.getFullYear());
  const [mes, setMes] = useState<number>(hojeRef.getMonth());

  async function load() {
    const inicioAno = `${new Date().getFullYear()}-01-01`;
    const [tx, al] = await Promise.all([
      supabase.from("transacoes").select("*").gte("competencia", inicioAno).order("criado_em", { ascending: false }),
      supabase.from("alunos").select("*"),
    ]);
    const t = (tx.data ?? []) as Transacao[];
    const a = (al.data ?? []) as Aluno[];
    setTransacoes(t); setAlunos(a);
    writeCache("fin-resumo", { alunos: a, transacoes: t });
    setLoading(false);
  }
  useEffect(() => {
    void load();
    const ch = supabase
      .channel("fin-resumo-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "transacoes" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "alunos" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const compAtual = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const compAnterior = (() => {
    const d = new Date(ano, mes - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  })();

  const m = useMemo(() => {
    const txMes = transacoes.filter((t) => t.competencia === compAtual && t.tipo === "receita");
    const txAnt = transacoes.filter((t) => t.competencia === compAnterior && t.tipo === "receita");
    const recebido = txMes.reduce((s, t) => s + Number(t.valor), 0);
    const recebidoAnt = txAnt.reduce((s, t) => s + Number(t.valor), 0);
    const ticket = txMes.length ? recebido / txMes.length : 0;

    const ult3 = ultimas3Competencias();
    const tx3 = transacoes.filter((t) => ult3.includes(t.competencia) && t.tipo === "receita");
    let ticket3 = tx3.length ? tx3.reduce((s, t) => s + Number(t.valor), 0) / tx3.length : 0;
    const ativos = alunos.filter((a) => a.status === "ativo");
    if (!ticket3) {
      const cv = ativos.filter((a) => a.valor_plano);
      ticket3 = cv.length ? cv.reduce((s, a) => s + Number(a.valor_plano ?? 0), 0) / cv.length : 0;
    }

    const hoje = new Date();
    const fimMes = new Date(); fimMes.setMonth(fimMes.getMonth() + 1, 0);
    const aReceberAlunos = alunos.filter((a) =>
      a.data_expiracao && a.status !== "renovado" && a.status !== "cancelado" &&
      new Date(a.data_expiracao) >= hoje && new Date(a.data_expiracao) <= fimMes
    );
    const aReceber = aReceberAlunos.reduce((s, a) => s + Number(a.valor_plano ?? 0), 0);

    const inadimplentes = alunos.filter((a) =>
      a.data_expiracao && new Date(a.data_expiracao) < hoje &&
      a.status !== "renovado" && a.status !== "cancelado"
    );
    const valorAtraso = inadimplentes.reduce((s, a) => s + Number(a.valor_plano ?? 0), 0);

    const previsao = ativos.length * ticket3;
    const cresc = crescimentoPct(recebido, recebidoAnt);
    const taxaInad = taxaInadimplencia(inadimplentes.length, ativos.length);

    return { recebido, ticket, ticket3, ativos, aReceber, aReceberAlunos,
      inadimplentes, valorAtraso, previsao, cresc, taxaInad };
  }, [transacoes, alunos, compAtual, compAnterior]);

  const saude = useMemo(() => {
    // Score 0-100 baseado em: recebido/projeção, inadimplência, atraso/recebido
    const cobertura = m.previsao > 0 ? Math.min(1, m.recebido / m.previsao) : 0;
    const penalInad = Math.min(1, m.taxaInad / 25); // 25% inadimplência = penalidade máx
    const penalAtraso = m.recebido > 0 ? Math.min(1, m.valorAtraso / m.recebido) : (m.valorAtraso > 0 ? 1 : 0);
    const score = Math.round(Math.max(0, Math.min(1, cobertura * 0.6 + (1 - penalInad) * 0.25 + (1 - penalAtraso) * 0.15)) * 100);
    let nivel: "Crítica" | "Baixa" | "Moderada" | "Boa";
    let cor: string;
    if (score < 30) { nivel = "Crítica"; cor = "var(--red)"; }
    else if (score < 55) { nivel = "Baixa"; cor = "#EA580C"; }
    else if (score < 80) { nivel = "Moderada"; cor = "var(--amber)"; }
    else { nivel = "Boa"; cor = "var(--green)"; }

    // insight automático
    let insight = "";
    const mesLabel = MES_LABELS[mes];
    if (nivel === "Crítica" || nivel === "Baixa") {
      if (m.taxaInad > 10 && m.valorAtraso > 0) {
        insight = `${mesLabel} apresenta baixa entrada de caixa e alta inadimplência. O foco do mês deve ser recuperação de pagamentos em aberto.`;
      } else if (m.recebido < m.previsao * 0.5) {
        insight = `Recebimento de ${mesLabel} ainda está abaixo da projeção. Acompanhe cobranças do mês para fechar o ciclo.`;
      } else {
        insight = `${mesLabel} demanda atenção: combine ações de cobrança e renovação para recuperar o resultado.`;
      }
    } else if (nivel === "Moderada") {
      insight = `${mesLabel} caminha dentro do esperado. Reduzir a inadimplência pode levar o mês a um resultado forte.`;
    } else {
      insight = `${mesLabel} está saudável: recebimento alinhado à projeção e inadimplência sob controle.`;
    }
    return { score, nivel, cor, insight };
  }, [m, mes]);

  const resumoAnual = useMemo(() => {
    const anoAtual = new Date().getFullYear();
    const tx = transacoes.filter((t) => t.competencia.startsWith(`${anoAtual}-`) && t.tipo === "receita");
    const total = tx.reduce((s, t) => s + Number(t.valor), 0);
    const porMes = new Map<string, number>();
    tx.forEach((t) => porMes.set(t.competencia, (porMes.get(t.competencia) ?? 0) + Number(t.valor)));
    const meses = Array.from(porMes.values());
    const media = meses.length ? total / meses.length : 0;
    const melhor = meses.length ? Math.max(...meses) : 0;
    return { ano: anoAtual, total, media, melhor, totalAlunos: alunos.length };
  }, [transacoes, alunos]);

  const seisMeses = useMemo(() => {
    const meses: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ano, mes - i, 1);
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    }
    let acc = 0;
    return meses.map((c) => {
      const tx = transacoes.filter((t) => t.competencia === c && t.tipo === "receita");
      const recebidoVal = tx.reduce((s, t) => s + Number(t.valor), 0);
      acc += recebidoVal;
      const pendente = c === compAtual ? m.aReceber : 0;
      return { mes: fmtCompetencia(c).slice(0, 3), recebido: recebidoVal, pendente, acumulado: acc };
    });
  }, [transacoes, compAtual, m.aReceber, ano, mes]);

  const distrPlano = useMemo(() => {
    const txMes = transacoes.filter((t) => t.competencia === compAtual && t.tipo === "receita");
    const mods: Modalidade[] = ["mpteam", "mp_elite", "mp_presencial"];
    return mods.map((mod) => {
      const ats = alunos.filter((a) => a.modalidade === mod && a.status === "ativo");
      const tx = txMes.filter((t) => ats.some((a) => a.id === t.aluno_id));
      const valor = tx.reduce((s, t) => s + Number(t.valor), 0);
      return { name: MODALIDADE_LABEL[mod], value: valor };
    }).filter((d) => d.value > 0);
  }, [transacoes, alunos, compAtual]);

  if (loading) return <div className="text-muted-foreground text-sm">Carregando…</div>;

  const crescTxt = `${m.cresc >= 0 ? "+" : ""}${m.cresc.toFixed(1)}% vs mês anterior`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Visão executiva
          </p>
          <h1 className="text-3xl font-bold tracking-tight mt-1">Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            {MES_LABELS[mes]} de {ano} · clientes, vendas e financeiro
          </p>
        </div>
        {topTab === "financeiro" && (
          <MesAnoSelector ano={ano} mes={mes} onChange={(a, mm) => { setAno(a); setMes(mm); }} />
        )}
      </div>

      {/* Abas superiores */}
      <div
        className="flex gap-6 border-b -mt-2"
        style={{ borderColor: "var(--border-light)" }}
      >
        {([
          ["clientes", "Clientes"],
          ["vendas", "Vendas"],
          ["financeiro", "Financeiro"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTopTab(k)}
            className={`relative pb-3 text-base font-medium transition-colors ${
              topTab === k
                ? "text-[var(--text)]"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {label}
            {topTab === k && (
              <span
                className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full"
                style={{ background: "var(--text)" }}
              />
            )}
          </button>
        ))}
      </div>

      {topTab === "clientes" && <ClientesTab alunos={alunos} />}
      {topTab === "vendas" && <VendasPage />}
      {topTab === "financeiro" && (
        <div className="space-y-8">
      {/* KPIs principais — destaque maior */}
      <section className="space-y-3">
        <SectionLabel>Indicadores principais</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <BigKpi
            icon={DollarSign}
            label="Recebido no mês"
            value={fmtBRL(m.recebido)}
            sublabel={crescTxt}
            accent="green"
            trendUp={m.cresc >= 0}
          />
          <BigKpi
            icon={Clock}
            label="A receber"
            value={fmtBRL(m.aReceber)}
            sublabel={`${m.aReceberAlunos.length} cobranças próximas do vencimento`}
            accent="blue"
          />
          <BigKpi
            icon={ShieldAlert}
            label="Inadimplência"
            value={String(m.inadimplentes.length)}
            sublabel={`${fmtBRL(m.valorAtraso)} em atraso`}
            accent="red"
            critical
          />
          <BigKpi
            icon={TrendingUp}
            label="Projeção de receita"
            value={fmtBRL(m.previsao)}
            sublabel="Baseado em ativos × ticket médio"
            accent="indigo"
            projection
          />
        </div>
      </section>

      {/* KPIs secundários */}
      <section className="space-y-3">
        <SectionLabel>Indicadores secundários</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard icon={Users} label="Alunos ativos" value={String(m.ativos.length)} accent="neutral" />
          <KpiCard icon={Receipt} label="Ticket médio" value={fmtBRL(m.ticket)} accent="neutral" />
          <KpiCard
            icon={ArrowUpRight}
            label="Crescimento"
            value={`${m.cresc >= 0 ? "+" : ""}${m.cresc.toFixed(1)}%`}
            accent={m.cresc >= 0 ? "green" : "red"}
            sublabel="vs mês anterior"
          />
          <KpiCard
            icon={AlertCircle}
            label="Taxa de inadimplência"
            value={`${m.taxaInad.toFixed(1)}%`}
            accent={m.taxaInad > 10 ? "red" : "neutral"}
            sublabel={`${m.inadimplentes.length} de ${m.ativos.length} ativos`}
          />
        </div>
      </section>

      {/* Saúde financeira do mês */}
      <SaudeFinanceiraBlock
        mesLabel={MES_LABELS[mes]}
        recebido={m.recebido}
        aReceber={m.aReceber}
        atraso={m.valorAtraso}
        score={saude.score}
        nivel={saude.nivel}
        cor={saude.cor}
        insight={saude.insight}
      />

      {/* Resumo Anual */}
      <ResumoAnualBlock
        ano={resumoAnual.ano}
        total={resumoAnual.total}
        media={resumoAnual.media}
        melhor={resumoAnual.melhor}
        totalAlunos={resumoAnual.totalAlunos}
      />

      {/* Gráficos */}
      <section className="space-y-3">
        <SectionLabel>Análises</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Faturamento — Últimos 6 Meses">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={seisMeses}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="recebido" fill="#16A34A" name="Recebido" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pendente" fill="#DC2626" name="Pendente" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Evolução do Faturamento">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={seisMeses}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Line type="monotone" dataKey="recebido" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Distribuição por Plano">
            {distrPlano.length === 0 ? (
              <p className="fin-muted text-sm py-12 text-center">Sem dados no mês</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={distrPlano} dataKey="value" nameKey="name" outerRadius={75} label>
                    {distrPlano.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtBRL(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Faturamento Acumulado">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={seisMeses}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Line type="monotone" dataKey="acumulado" stroke="#111111" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      {/* Tabs operacionais */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between flex-wrap gap-3 border-b" style={{ borderColor: "var(--border-light)" }}>
          <div className="flex gap-1">
            {([
              ["pagamentos", "Pagamentos"],
              ["transacoes", "Transações"],
              ["planos", "Planos"],
              ["config", "Configurações"],
            ] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === k ? "border-[var(--text)] text-[var(--text)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "pagamentos" && <PagamentosTab alunos={alunos} />}
        {tab === "transacoes" && <TransacoesTab transacoes={transacoes} alunos={alunos} isAdmin={isAdmin} onAdd={() => setShowModal(true)} onChanged={() => void load()} />}
        {tab === "planos" && <PlanosTab alunos={alunos} transacoes={transacoes} />}
        {tab === "config" && <ConfiguracoesTab isAdmin={isAdmin} />}
      </div>
        </div>
      )}

      {showModal && <LancarTransacaoModal onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--text-muted)" }}>
      {children}
    </h2>
  );
}

interface BigKpiProps {
  icon: typeof DollarSign;
  label: string;
  value: string;
  sublabel: string;
  accent: "green" | "blue" | "red" | "indigo";
  trendUp?: boolean;
  critical?: boolean;
  projection?: boolean;
}

const BIG_ACCENT: Record<BigKpiProps["accent"], { fg: string; soft: string; ring: string }> = {
  green:  { fg: "#16A34A", soft: "#DCFCE7", ring: "rgba(22,163,74,0.18)" },
  blue:   { fg: "#2563EB", soft: "#DBEAFE", ring: "rgba(37,99,235,0.18)" },
  red:    { fg: "#DC2626", soft: "#FEE2E2", ring: "rgba(220,38,38,0.22)" },
  indigo: { fg: "#4F46E5", soft: "#E0E7FF", ring: "rgba(79,70,229,0.18)" },
};

function BigKpi({ icon: Icon, label, value, sublabel, accent, critical, projection }: BigKpiProps) {
  const c = BIG_ACCENT[accent];
  return (
    <div
      className="relative rounded-2xl bg-white p-5 transition-shadow hover:shadow-md"
      style={{
        border: critical ? `1.5px solid ${c.fg}` : "1px solid var(--border-light)",
        boxShadow: critical ? `0 1px 0 ${c.ring}, 0 8px 24px -16px ${c.ring}` : undefined,
      }}
    >
      {/* Faixa de cor lateral */}
      <span
        className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full"
        style={{ background: c.fg, opacity: critical ? 1 : 0.85 }}
      />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</p>
            {projection && (
              <span
                className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{ background: c.soft, color: c.fg }}
              >
                Estimativa
              </span>
            )}
          </div>
          <p className="text-[28px] leading-none font-bold tracking-tight truncate" style={{ color: "var(--text)" }}>
            {value}
          </p>
          <p
            className="text-[12px] leading-snug"
            style={{ color: critical ? c.fg : "var(--text-muted)", fontWeight: critical ? 600 : 400 }}
          >
            {sublabel}
          </p>
        </div>
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: c.soft }}
        >
          <Icon className="h-5 w-5" style={{ color: c.fg }} />
        </div>
      </div>
    </div>
  );
}

interface SaudeProps {
  mesLabel: string;
  recebido: number;
  aReceber: number;
  atraso: number;
  score: number;
  nivel: "Crítica" | "Baixa" | "Moderada" | "Boa";
  cor: string;
  insight: string;
}

function SaudeFinanceiraBlock({ mesLabel, recebido, aReceber, atraso, score, nivel, cor, insight }: SaudeProps) {
  return (
    <section className="space-y-3">
      <SectionLabel>Saúde financeira do mês</SectionLabel>
      <div
        className="rounded-2xl p-6 bg-white"
        style={{ border: "1px solid var(--border-light)" }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,1fr,1fr,1.4fr] gap-6 items-stretch">
          <SaudeStat label="Recebido" value={fmtBRL(recebido)} color="var(--green)" />
          <SaudeStat label="A receber" value={fmtBRL(aReceber)} color="var(--blue)" />
          <SaudeStat label="Em atraso" value={fmtBRL(atraso)} color="var(--red)" />
          <div
            className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: "#FAFAFA", border: "1px solid var(--border-light)" }}
          >
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: cor }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Saúde de {mesLabel}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold" style={{ color: cor }}>{nivel}</span>
              <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>{score}/100</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#EEE" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: cor }} />
            </div>
            <p className="text-[12.5px] leading-snug mt-1" style={{ color: "var(--text)" }}>
              {insight}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function SaudeStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col justify-center">
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span className="text-2xl font-bold mt-1.5" style={{ color }}>{value}</span>
    </div>
  );
}

interface ResumoAnualProps {
  ano: number;
  total: number;
  media: number;
  melhor: number;
  totalAlunos: number;
}

function ResumoAnualBlock({ ano, total, media, melhor, totalAlunos }: ResumoAnualProps) {
  return (
    <section className="space-y-3">
      <SectionLabel>Resumo anual</SectionLabel>
      <div
        className="rounded-2xl p-6"
        style={{ background: "#FAFAFA", border: "1px solid var(--border-light)" }}
      >
        <div className="flex items-baseline justify-between mb-5">
          <h3 className="font-semibold text-base">Resultado consolidado {ano}</h3>
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Acumulado do ano
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ResumoMini label="Total faturado" value={fmtBRL(total)} accent="var(--text)" emphasize />
          <ResumoMini label="Média mensal" value={fmtBRL(media)} accent="var(--blue)" />
          <ResumoMini label="Melhor mês" value={fmtBRL(melhor)} accent="var(--green)" />
          <ResumoMini label="Total de alunos" value={String(totalAlunos)} accent="var(--text)" />
        </div>
      </div>
    </section>
  );
}

function ResumoMini({ label, value, accent, emphasize }: { label: string; value: string; accent: string; emphasize?: boolean }) {
  return (
    <div
      className="rounded-xl bg-white p-4"
      style={{ border: "1px solid var(--border-light)" }}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className={`mt-2 font-bold tracking-tight ${emphasize ? "text-2xl" : "text-xl"}`} style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="fin-card">
      <h3 className="font-semibold text-sm mb-4">{title}</h3>
      {children}
    </div>
  );
}
