import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readCache, writeCache } from "@/lib/swr-cache";
import type { Aluno } from "@/lib/crm";
import {
  fmtBRL, comparePeriodoAnterior, tempoMedioContratoMeses,
  type Transacao,
} from "@/lib/financeiro";
import { MetricCard } from "@/components/financeiro/MetricCard";
import { MesAnoSelector } from "@/components/financeiro/MesAnoSelector";
import {
  FileText, DollarSign, Clock, Wallet, Repeat, Globe,
} from "lucide-react";

export const Route = createFileRoute("/_app/financeiro/vendas")({
  component: VendasPage,
});

export function VendasPage() {
  const cached = readCache<{ alunos: Aluno[]; transacoes: Transacao[] }>("fin-vendas");
  const [alunos, setAlunos] = useState<Aluno[]>(cached?.alunos ?? []);
  const [transacoes, setTransacoes] = useState<Transacao[]>(cached?.transacoes ?? []);
  const [loading, setLoading] = useState(!cached);

  // Período: default mês atual
  const hoje = new Date();
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [mes, setMes] = useState<number>(hoje.getMonth());
  const inicio = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const fim = (() => {
    const f = new Date(ano, mes + 1, 0);
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
  })();

  useEffect(() => {
    const load = async () => {
      const inicioAno = `${hoje.getFullYear()}-01-01`;
      const [tx, al] = await Promise.all([
        supabase.from("transacoes").select("*").gte("competencia", inicioAno),
        supabase.from("alunos").select("*"),
      ]);
      const t = (tx.data ?? []) as Transacao[];
      const a = (al.data ?? []) as Aluno[];
      setTransacoes(t); setAlunos(a);
      writeCache("fin-vendas", { transacoes: t, alunos: a });
      setLoading(false);
    };
    void load();
    const ch = supabase
      .channel("fin-vendas-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "transacoes" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "alunos" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const m = useMemo(() => {
    const ini = new Date(inicio);
    const f = new Date(fim); f.setHours(23, 59, 59);
    const diffMs = f.getTime() - ini.getTime();
    const iniAnt = new Date(ini.getTime() - diffMs - 1);
    const fimAnt = new Date(ini.getTime() - 1);

    const novosPeriodo = alunos.filter((a) => {
      if (!a.data_compra) return false;
      const d = new Date(a.data_compra);
      return d >= ini && d <= f;
    });
    const novosAnt = alunos.filter((a) => {
      if (!a.data_compra) return false;
      const d = new Date(a.data_compra);
      return d >= iniAnt && d <= fimAnt;
    });

    const ticketMedio = novosPeriodo.length
      ? novosPeriodo.reduce((s, a) => s + Number(a.valor_plano ?? 0), 0) / novosPeriodo.length
      : 0;
    const ticketAnt = novosAnt.length
      ? novosAnt.reduce((s, a) => s + Number(a.valor_plano ?? 0), 0) / novosAnt.length
      : 0;

    const tempoContrato = tempoMedioContratoMeses(novosPeriodo);
    const tempoContratoAnt = tempoMedioContratoMeses(novosAnt);

    const txPeriodo = transacoes.filter((t) => {
      const d = new Date(t.competencia);
      return t.tipo === "receita" && d >= ini && d <= f;
    });
    const txAnt = transacoes.filter((t) => {
      const d = new Date(t.competencia);
      return t.tipo === "receita" && d >= iniAnt && d <= fimAnt;
    });

    const manuais = txPeriodo.filter((t) => t.origem === "manual")
      .reduce((s, t) => s + Number(t.valor), 0);
    const manuaisAnt = txAnt.filter((t) => t.origem === "manual")
      .reduce((s, t) => s + Number(t.valor), 0);

    const recorrentes = txPeriodo.filter((t) => t.origem === "kiwify")
      .reduce((s, t) => s + Number(t.valor), 0);
    const recorrentesAnt = txAnt.filter((t) => t.origem === "kiwify")
      .reduce((s, t) => s + Number(t.valor), 0);

    return {
      contratos: novosPeriodo.length,
      contratosAnt: novosAnt.length,
      ticketMedio, ticketAnt,
      tempoContrato, tempoContratoAnt,
      manuais, manuaisAnt,
      recorrentes, recorrentesAnt,
    };
  }, [alunos, transacoes, inicio, fim]);

  if (loading) return <div className="fin-muted text-sm">Carregando…</div>;

  const fmtDelta = (atual: number, ant: number, sufixo = "", prefixo = "") => {
    const c = comparePeriodoAnterior(atual, ant);
    const v = Math.abs(c.delta);
    return {
      texto: `${prefixo}${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${sufixo} ${c.positivo ? "a mais" : "a menos"} que o período anterior`,
      positivo: c.positivo,
    };
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold">Indicadores de vendas</h2>
      </div>
      <MesAnoSelector ano={ano} mes={mes} onChange={(a, m) => { setAno(a); setMes(m); }} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard icon={FileText} label="Contratos vendidos"
          value={String(m.contratos)}
          delta={fmtDelta(m.contratos, m.contratosAnt)} />
        <MetricCard icon={DollarSign} label="Mensal. média dos contratos"
          value={fmtBRL(m.ticketMedio)}
          delta={fmtDelta(m.ticketMedio, m.ticketAnt, "", "R$ ")} />
        <MetricCard icon={Clock} label="Tempo médio de contrato"
          value={`${m.tempoContrato.toFixed(1)} meses`}
          delta={fmtDelta(m.tempoContrato, m.tempoContratoAnt, " meses")} />
        <MetricCard icon={Wallet} label="Total de vendas manuais"
          value={fmtBRL(m.manuais)}
          delta={fmtDelta(m.manuais, m.manuaisAnt, "", "R$ ")} />
        <MetricCard icon={Repeat} label="Total de vendas recorrentes"
          value={fmtBRL(m.recorrentes)}
          delta={fmtDelta(m.recorrentes, m.recorrentesAnt, "", "R$ ")} />
        <MetricCard icon={Globe} label="Total de vendas online"
          value={fmtBRL(0)}
          delta={{ texto: "sem origem online configurada", positivo: true }} />
      </div>
    </div>
  );
}