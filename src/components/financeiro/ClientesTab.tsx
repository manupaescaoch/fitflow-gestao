import { useMemo } from "react";
import {
  Users, UserCheck, UserX, Clock4, RotateCw, UserPlus,
  TrendingDown, CalendarClock,
} from "lucide-react";
import { KpiCard } from "./KpiCard";
import type { Aluno } from "@/lib/crm";

interface Props {
  alunos: Aluno[];
}

export function ClientesTab({ alunos }: Props) {
  const m = useMemo(() => {
    const hoje = new Date();
    const isExpirado = (a: Aluno) =>
      a.data_expiracao ? new Date(a.data_expiracao) < hoje : false;

    const ativos = alunos.filter((a) => a.status === "ativo");
    const adimplentes = ativos.filter((a) => !isExpirado(a));
    const inadimplentes = alunos.filter(
      (a) =>
        isExpirado(a) &&
        a.status !== "renovado" &&
        (a.status as string) !== "cancelado",
    );
    const aguardandoRenovacao = alunos.filter(
      (a) => a.status === "aguardando_renovacao",
    );
    const onboarding = alunos.filter((a) =>
      ["aguardando_anamnese", "anamnese_recebida", "em_producao"].includes(
        a.status as string,
      ),
    );
    const renovados = alunos.filter((a) => a.renovado === true);

    // Tempo médio de vida (em meses) dos alunos com data_d0
    const comD0 = alunos.filter((a) => a.data_d0);
    const mediaMeses = comD0.length
      ? comD0.reduce((s, a) => {
          const dias =
            (hoje.getTime() - new Date(a.data_d0!).getTime()) /
            (1000 * 60 * 60 * 24);
          return s + dias / 30;
        }, 0) / comD0.length
      : 0;

    // Evasão (churn): inadimplentes / (ativos + inadimplentes)
    const baseChurn = ativos.length + inadimplentes.length;
    const churnPct = baseChurn ? (inadimplentes.length / baseChurn) * 100 : 0;

    // Vencendo nos próximos 7 dias (atenção)
    const proxVenc = ativos.filter((a) => {
      if (!a.data_expiracao) return false;
      const exp = new Date(a.data_expiracao);
      const diff = (exp.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    });

    // Distribuição por modalidade
    const porModalidade = {
      mpteam: ativos.filter((a) => a.modalidade === "mpteam").length,
      mp_elite: ativos.filter((a) => a.modalidade === "mp_elite").length,
      mp_presencial: ativos.filter((a) => a.modalidade === "mp_presencial").length,
    };

    return {
      ativos: ativos.length,
      adimplentes: adimplentes.length,
      inadimplentes: inadimplentes.length,
      aguardandoRenovacao: aguardandoRenovacao.length,
      onboarding: onboarding.length,
      renovados: renovados.length,
      mediaMeses,
      churnPct,
      proxVenc: proxVenc.length,
      porModalidade,
    };
  }, [alunos]);

  return (
    <div className="space-y-8">
      {/* KPIs principais */}
      <section className="space-y-3">
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--text-muted)" }}
        >
          Visão geral de clientes
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <KpiCard
            icon={Users}
            label="Ativos"
            value={String(m.ativos)}
            accent="green"
            highlight
          />
          <KpiCard
            icon={UserCheck}
            label="Adimplentes"
            value={String(m.adimplentes)}
            sublabel="ativos com plano em dia"
            accent="green"
          />
          <KpiCard
            icon={UserX}
            label="Inadimplentes"
            value={String(m.inadimplentes)}
            sublabel="plano vencido"
            accent="red"
            highlight
          />
          <KpiCard
            icon={CalendarClock}
            label="Vencem em 7 dias"
            value={String(m.proxVenc)}
            sublabel="cobranças próximas"
            accent="amber"
          />
        </div>
      </section>

      {/* KPIs de fluxo / ciclo */}
      <section className="space-y-3">
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--text-muted)" }}
        >
          Ciclo de vida
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <KpiCard
            icon={UserPlus}
            label="Em onboarding"
            value={String(m.onboarding)}
            sublabel="anamnese / produção"
            accent="blue"
          />
          <KpiCard
            icon={Clock4}
            label="Aguardando renovação"
            value={String(m.aguardandoRenovacao)}
            accent="amber"
          />
          <KpiCard
            icon={RotateCw}
            label="Renovados"
            value={String(m.renovados)}
            sublabel="histórico total"
            accent="green"
          />
          <KpiCard
            icon={TrendingDown}
            label="Evasão (churn)"
            value={`${m.churnPct.toFixed(1)}%`}
            sublabel="vencidos / base"
            accent={m.churnPct > 15 ? "red" : "neutral"}
          />
        </div>
      </section>

      {/* Tempo médio + distribuição por modalidade */}
      <section className="space-y-3">
        <h2
          className="text-[11px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--text-muted)" }}
        >
          Distribuição
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="fin-card">
            <p className="text-xs fin-muted">Tempo médio de vida</p>
            <p className="text-3xl font-bold tracking-tight mt-1">
              {m.mediaMeses.toFixed(1)}{" "}
              <span className="text-base font-medium fin-muted">meses</span>
            </p>
            <p className="text-[11px] fin-muted mt-1">
              média desde o início do plano
            </p>
          </div>

          <div className="fin-card md:col-span-2">
            <p className="text-xs fin-muted mb-3">Ativos por modalidade</p>
            <div className="space-y-2">
              {(
                [
                  ["MPTEAM", m.porModalidade.mpteam, "var(--blue)"],
                  ["MP Elite", m.porModalidade.mp_elite, "var(--pink)"],
                  ["MP Presencial", m.porModalidade.mp_presencial, "var(--red)"],
                ] as [string, number, string][]
              ).map(([label, val, color]) => {
                const max = Math.max(
                  m.porModalidade.mpteam,
                  m.porModalidade.mp_elite,
                  m.porModalidade.mp_presencial,
                  1,
                );
                const pct = (val / max) * 100;
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span>{label}</span>
                      <span className="font-semibold">{val}</span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}