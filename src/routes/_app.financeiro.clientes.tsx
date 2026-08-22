import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readCache, writeCache } from "@/lib/swr-cache";
import type { Aluno } from "@/lib/crm";
import { churnPct, tempoMedioVidaMeses } from "@/lib/financeiro";
import { MetricCard } from "@/components/financeiro/MetricCard";
import { MesAnoSelector } from "@/components/financeiro/MesAnoSelector";
import {
  Users, CheckCircle2, AlertTriangle, Star, UserCheck, UserX, TrendingDown, Heart,
} from "lucide-react";

export const Route = createFileRoute("/_app/financeiro/clientes")({
  component: ClientesPage,
});

type Categoria = "ativos" | "adimplentes" | "inadimplentes" | "vip" | "personal" | "suspensos";

export function ClientesPage() {
  const cached = readCache<Aluno[]>("fin-clientes");
  const [alunos, setAlunos] = useState<Aluno[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [detalhe, setDetalhe] = useState<Categoria | null>(null);
  const hoje = new Date();
  const [ano, setAno] = useState<number>(hoje.getFullYear());
  const [mes, setMes] = useState<number>(hoje.getMonth());

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("alunos").select("*");
      const list = (data ?? []) as Aluno[];
      setAlunos(list);
      writeCache("fin-clientes", list);
      setLoading(false);
    };
    void load();
    const ch = supabase
      .channel("fin-clientes-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "alunos" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const categorias = useMemo(() => {
    const hojeRef = new Date();
    const ativos = alunos.filter((a) => a.status === "ativo");
    const adimplentes = ativos.filter(
      (a) => a.data_expiracao && new Date(a.data_expiracao) >= hojeRef,
    );
    const inadimplentes = alunos.filter(
      (a) => a.data_expiracao && new Date(a.data_expiracao) < hojeRef &&
        a.status !== "renovado" && a.status !== "cancelado",
    );
    const valores = alunos
      .map((a) => Number(a.valor_plano ?? 0))
      .filter((v) => v > 0)
      .sort((a, b) => b - a);
    const corteVip = valores.length ? valores[Math.floor(valores.length * 0.1)] ?? 0 : 0;
    const vip = ativos.filter((a) => Number(a.valor_plano ?? 0) >= corteVip && corteVip > 0);
    const personal = alunos.filter((a) => a.modalidade === "mp_presencial");
    const inicioMes = new Date(ano, mes, 1);
    const fimMes = new Date(ano, mes + 1, 0, 23, 59, 59);
    const suspensos = alunos.filter(
      (a) => a.status === "cancelado" &&
        new Date(a.atualizado_em) >= inicioMes &&
        new Date(a.atualizado_em) <= fimMes,
    );
    return { ativos, adimplentes, inadimplentes, vip, personal, suspensos };
  }, [alunos, ano, mes]);

  const churn = useMemo(() => churnPct(alunos), [alunos]);
  const tempoVida = useMemo(() => tempoMedioVidaMeses(alunos), [alunos]);

  if (loading) return <div className="fin-muted text-sm">Carregando…</div>;

  const lista = detalhe ? categorias[detalhe] : [];

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Base de clientes</h2>
      <MesAnoSelector ano={ano} mes={mes} onChange={(a, m) => { setAno(a); setMes(m); }} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard icon={Users} label="Ativos" value={String(categorias.ativos.length)}
          accent="green" onDetalhes={() => setDetalhe("ativos")} />
        <MetricCard icon={CheckCircle2} label="Adimplentes" value={String(categorias.adimplentes.length)}
          accent="green" onDetalhes={() => setDetalhe("adimplentes")} />
        <MetricCard icon={AlertTriangle} label="Inadimplentes" value={String(categorias.inadimplentes.length)}
          accent="red" onDetalhes={() => setDetalhe("inadimplentes")} />
        <MetricCard icon={Star} label="VIP" value={String(categorias.vip.length)}
          accent="green" onDetalhes={() => setDetalhe("vip")} />
        <MetricCard icon={UserCheck} label="Personal" value={String(categorias.personal.length)}
          accent="green" onDetalhes={() => setDetalhe("personal")} />
        <MetricCard icon={UserX} label="Suspensos" value={String(categorias.suspensos.length)}
          accent="red" onDetalhes={() => setDetalhe("suspensos")} />
        <MetricCard icon={TrendingDown} label="Evasão (churn)" value={`${churn.toFixed(1)}%`}
          accent="red" />
        <MetricCard icon={Heart} label="Tempo médio de vida" value={`${tempoVida.toFixed(1)} meses`}
          accent="green" />
      </div>

      {detalhe && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 px-safe"
          onClick={() => setDetalhe(null)}>
          <div className="fin-card max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold capitalize">{detalhe} ({lista.length})</h3>
              <button onClick={() => setDetalhe(null)} className="fin-muted text-sm">Fechar</button>
            </div>
            {lista.length === 0 ? (
              <p className="fin-muted text-sm text-center py-6">Nenhum aluno nesta categoria.</p>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--border-light)" }}>
                {lista.map((a) => (
                  <li key={a.id} className="py-2 flex justify-between text-sm">
                    <span>{a.nome}</span>
                    <span className="fin-muted">{a.plano ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}