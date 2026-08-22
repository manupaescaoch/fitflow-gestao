import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { readCache, writeCache } from "@/lib/swr-cache";
import { Plus, Search, Activity } from "lucide-react";
import type { PhysicalAssessment } from "@/lib/avaliacao-fisica";
import { fmt } from "@/lib/avaliacao-fisica";

export const Route = createFileRoute("/_app/avaliacao-fisica/")({
  component: AvaliacaoFisicaIndex,
});

interface Row extends PhysicalAssessment {
  aluno_nome?: string;
}

type Filtro = "todas" | "inicial" | "reavaliacao" | "pendentes";

function AvaliacaoFisicaIndex() {
  const nav = useNavigate();
  const cached = readCache<{ rows: Row[]; alunos: { id: string; nome: string; status: string }[] }>("aval-fisica");
  const [rows, setRows] = useState<Row[]>(cached?.rows ?? []);
  const [alunos, setAlunos] = useState<{ id: string; nome: string; status: string }[]>(cached?.alunos ?? []);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const load = async () => {
      const [{ data: a }, { data: al }] = await Promise.all([
        supabase.from("physical_assessments").select("*").order("assessment_date", { ascending: false }),
        supabase.from("alunos").select("id,nome,status"),
      ]);
      const alunosMap = new Map((al ?? []).map((x) => [x.id, x.nome]));
      const enriched = (a ?? []).map((r) => ({ ...r, aluno_nome: alunosMap.get(r.student_id) }));
      const rr = enriched as Row[];
      const aa = (al ?? []) as { id: string; nome: string; status: string }[];
      setRows(rr); setAlunos(aa);
      writeCache("aval-fisica", { rows: rr, alunos: aa });
      setLoading(false);
    };
    void load();
    const ch = supabase
      .channel("aval-fisica-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "physical_assessments" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const mes = rows.filter((r) => {
      const d = new Date(r.assessment_date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    // Pendentes: alunos ativos sem avaliação nos últimos 60 dias
    const limite = new Date(); limite.setDate(limite.getDate() - 60);
    const ultimaPorAluno = new Map<string, Date>();
    rows.forEach((r) => {
      const d = new Date(r.assessment_date);
      const ex = ultimaPorAluno.get(r.student_id);
      if (!ex || d > ex) ultimaPorAluno.set(r.student_id, d);
    });
    const pendentes = alunos.filter((a) => a.status === "ativo")
      .filter((a) => {
        const d = ultimaPorAluno.get(a.id);
        return !d || d < limite;
      }).length;
    // Médias de evolução: comparar 1ª e última avaliação por aluno
    const porAluno = new Map<string, PhysicalAssessment[]>();
    rows.forEach((r) => {
      const arr = porAluno.get(r.student_id) ?? [];
      arr.push(r);
      porAluno.set(r.student_id, arr);
    });
    let somaPeso = 0, nP = 0, somaBf = 0, nB = 0;
    porAluno.forEach((arr) => {
      if (arr.length < 2) return;
      const sorted = [...arr].sort((a, b) => +new Date(a.assessment_date) - +new Date(b.assessment_date));
      const ini = sorted[0], ult = sorted[sorted.length - 1];
      if (ini.weight && ult.weight) { somaPeso += ult.weight - ini.weight; nP++; }
      if (ini.body_fat_percentage && ult.body_fat_percentage) { somaBf += ult.body_fat_percentage - ini.body_fat_percentage; nB++; }
    });
    return {
      total: rows.length, mes, pendentes,
      mediaPeso: nP ? somaPeso / nP : null,
      mediaBf: nB ? somaBf / nB : null,
    };
  }, [rows, alunos]);

  const filtradas = useMemo(() => {
    let r = rows;
    if (filtro === "inicial") r = r.filter((x) => x.assessment_type === "inicial");
    if (filtro === "reavaliacao") r = r.filter((x) => x.assessment_type === "reavaliacao");
    if (busca) {
      const q = busca.toLowerCase();
      r = r.filter((x) => (x.aluno_nome ?? "").toLowerCase().includes(q));
    }
    return r;
  }, [rows, filtro, busca]);

  // Alunos pendentes (modo separado)
  const pendentesList = useMemo(() => {
    const ultimaPorAluno = new Map<string, Date>();
    rows.forEach((r) => {
      const d = new Date(r.assessment_date);
      const ex = ultimaPorAluno.get(r.student_id);
      if (!ex || d > ex) ultimaPorAluno.set(r.student_id, d);
    });
    const limite = new Date(); limite.setDate(limite.getDate() - 60);
    return alunos.filter((a) => a.status === "ativo")
      .filter((a) => {
        const d = ultimaPorAluno.get(a.id);
        return !d || d < limite;
      })
      .filter((a) => !busca || a.nome.toLowerCase().includes(busca.toLowerCase()));
  }, [rows, alunos, busca]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Avaliação Física
          </h1>
          <p className="text-sm text-muted-foreground">Histórico, evolução e composição corporal dos alunos.</p>
        </div>
        <button
          onClick={() => nav({ to: "/avaliacao-fisica/nova" })}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Nova avaliação
        </button>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Total de avaliações" value={String(stats.total)} />
        <Stat label="No mês" value={String(stats.mes)} />
        <Stat label="Alunos pendentes" value={String(stats.pendentes)} />
        <Stat label="Δ peso médio" value={stats.mediaPeso == null ? "—" : `${stats.mediaPeso > 0 ? "+" : ""}${stats.mediaPeso.toFixed(1)} kg`} />
        <Stat label="Δ % gordura médio" value={stats.mediaBf == null ? "—" : `${stats.mediaBf > 0 ? "+" : ""}${stats.mediaBf.toFixed(1)} %`} />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome do aluno..."
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm" />
        </div>
        <FiltroBtn ativo={filtro === "todas"} onClick={() => setFiltro("todas")}>Todas</FiltroBtn>
        <FiltroBtn ativo={filtro === "inicial"} onClick={() => setFiltro("inicial")}>1ª avaliação</FiltroBtn>
        <FiltroBtn ativo={filtro === "reavaliacao"} onClick={() => setFiltro("reavaliacao")}>Reavaliações</FiltroBtn>
        <FiltroBtn ativo={filtro === "pendentes"} onClick={() => setFiltro("pendentes")}>Pendentes</FiltroBtn>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : filtro === "pendentes" ? (
          pendentesList.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum aluno pendente de reavaliação.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left px-4 py-2.5">Aluno</th><th className="text-right px-4 py-2.5">Ação</th></tr>
              </thead>
              <tbody>
                {pendentesList.map((a) => (
                  <tr key={a.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-2.5 font-medium">{a.nome}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link to="/alunos/$id" params={{ id: a.id }} className="text-primary text-xs hover:underline">Abrir aluno</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : filtradas.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma avaliação encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5">Aluno</th>
                <th className="text-left px-4 py-2.5">Data</th>
                <th className="text-left px-4 py-2.5">Tipo</th>
                <th className="text-right px-4 py-2.5">Peso</th>
                <th className="text-right px-4 py-2.5">% Gordura</th>
                <th className="text-right px-4 py-2.5">IMC</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r) => (
                <tr key={r.id}
                  onClick={() => nav({ to: "/avaliacao-fisica/$id", params: { id: r.id } })}
                  className="border-t border-border hover:bg-muted/20 cursor-pointer"
                >
                  <td className="px-4 py-2.5 font-medium">{r.aluno_nome ?? "—"}</td>
                  <td className="px-4 py-2.5">{new Date(r.assessment_date).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${r.assessment_type === "inicial" ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                      {r.assessment_type === "inicial" ? "1ª avaliação" : "Reavaliação"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(r.weight, "kg")}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(r.body_fat_percentage, "%")}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmt(r.bmi)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</div>
      <div className="text-lg font-bold text-foreground tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function FiltroBtn({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${ativo ? "bg-foreground text-background border-foreground" : "bg-background border-input hover:bg-muted text-foreground"}`}
    >{children}</button>
  );
}