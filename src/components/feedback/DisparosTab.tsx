import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { dispararJobsAgora } from "@/server/motor.functions";
import {
  Radio, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Clock, Filter, ExternalLink, Send, AlarmClock,
} from "lucide-react";

type Job = {
  id: string;
  aluno_id: string | null;
  tipo: string;
  agendado_para: string;
  executado: boolean;
  executado_em: string | null;
  tentativas: number;
  erro: string | null;
  criado_em: string;
};

type AlunoMin = { id: string; nome: string; whatsapp: string | null };

type StatusKey = "todos" | "agendado" | "atrasado" | "executado" | "erro";

const STATUS_LABEL: Record<Exclude<StatusKey, "todos">, string> = {
  agendado: "Agendado",
  atrasado: "Atrasado",
  executado: "Executado",
  erro: "Com erro",
};

function classifyJob(j: Job, agora: number = Date.now()): Exclude<StatusKey, "todos"> {
  if (j.erro) return "erro";
  if (j.executado) return "executado";
  if (new Date(j.agendado_para).getTime() < agora - 2 * 60 * 1000) return "atrasado";
  return "agendado";
}

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

export function DisparosTab() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [alunosMap, setAlunosMap] = useState<Map<string, AlunoMin>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<StatusKey>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroData, setFiltroData] = useState<"todas" | "hoje" | "amanha" | "semana" | "personalizado">("todas");
  const [dataCustom, setDataCustom] = useState<string>(""); // YYYY-MM-DD
  const [busca, setBusca] = useState("");
  const [conectado, setConectado] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [disparandoId, setDisparandoId] = useState<string | null>(null);
  const [disparandoLote, setDisparandoLote] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs_disparos")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(500);
    if (!error) setJobs((data ?? []) as Job[]);
    setLoading(false);
  }

  async function dispararAgora(jobId: string) {
    setDisparandoId(jobId);
    try {
      const r = await dispararJobsAgora({ data: { ids: [jobId], intervaloMs: 0 } });
      if (r.fail > 0) {
        const erro = r.detalhes.find((d) => !d.ok)?.error ?? "Falha desconhecida";
        alert("Falha ao disparar: " + erro);
      }
    } catch (e) {
      alert("Erro ao disparar: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDisparandoId(null);
    }
  }

  async function dispararLote() {
    // Se há selecionados, usa eles; senão, usa todos os pendentes filtrados.
    const candidatos = selecionados.size > 0
      ? filtrados.filter((j) => selecionados.has(j.id) && !j.executado)
      : filtrados.filter((j) => !j.executado);
    const ids = candidatos.map((j) => j.id);
    if (ids.length === 0) return;
    const escopo = selecionados.size > 0 ? "selecionados" : "filtrados pendentes";
    const totalSegundos = (ids.length - 1) * 10;
    const tempoStr = totalSegundos >= 60
      ? `~${Math.ceil(totalSegundos / 60)} min`
      : `~${totalSegundos}s`;
    if (!confirm(
      `Disparar ${ids.length} job(s) ${escopo} com intervalo de 10s entre cada envio (tempo total ${tempoStr})?\n\nIsso evita bloqueio do WhatsApp.`
    )) return;
    setDisparandoLote(true);
    try {
      const r = await dispararJobsAgora({ data: { ids, intervaloMs: 10_000 } });
      setSelecionados(new Set());
      if (r.fail > 0) {
        const primeiroErro = r.detalhes.find((d) => !d.ok)?.error ?? "Falha desconhecida";
        alert(`Disparo concluído: ${r.ok} enviado(s), ${r.fail} com falha.\n\nPrimeiro erro: ${primeiroErro}`);
      } else {
        alert(`Disparo concluído: ${r.ok} mensagem(ns) enviada(s) com sucesso.`);
      }
    } catch (e) {
      alert("Erro ao disparar lote: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDisparandoLote(false);
    }
  }

  async function carregarAlunos(ids: string[]) {
    if (ids.length === 0) return;
    const faltando = ids.filter((id) => !alunosMap.has(id));
    if (faltando.length === 0) return;
    const { data } = await supabase
      .from("alunos")
      .select("id, nome, whatsapp")
      .in("id", faltando);
    if (!data) return;
    setAlunosMap((prev) => {
      const next = new Map(prev);
      for (const a of data) next.set(a.id, a as AlunoMin);
      return next;
    });
  }

  useEffect(() => { void carregar(); }, []);

  useEffect(() => {
    const ids = Array.from(new Set(jobs.map((j) => j.aluno_id).filter((x): x is string => !!x)));
    void carregarAlunos(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  // Realtime
  useEffect(() => {
    if (!autoRefresh) return;
    const ch = supabase
      .channel("jobs_disparos_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs_disparos" },
        (payload) => {
          setJobs((prev) => {
            const novo = (payload.new ?? payload.old) as Job;
            if (!novo?.id) return prev;
            if (payload.eventType === "DELETE") {
              return prev.filter((j) => j.id !== novo.id);
            }
            const existe = prev.findIndex((j) => j.id === novo.id);
            if (existe >= 0) {
              const cp = prev.slice();
              cp[existe] = novo;
              return cp;
            }
            return [novo, ...prev].slice(0, 500);
          });
        },
      )
      .subscribe((status) => {
        setConectado(status === "SUBSCRIBED");
      });
    return () => { void supabase.removeChannel(ch); };
  }, [autoRefresh]);

  const tipos = useMemo(() => {
    const set = new Set<string>();
    for (const j of jobs) set.add(j.tipo);
    return Array.from(set).sort();
  }, [jobs]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    // Janela de datas em horário local (Brasília)
    const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x.getTime(); };
    const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x.getTime(); };
    const hoje = new Date();
    let dataMin: number | null = null;
    let dataMax: number | null = null;
    if (filtroData === "hoje") {
      dataMin = startOfDay(hoje); dataMax = endOfDay(hoje);
    } else if (filtroData === "amanha") {
      const a = new Date(hoje); a.setDate(a.getDate() + 1);
      dataMin = startOfDay(a); dataMax = endOfDay(a);
    } else if (filtroData === "semana") {
      const fim = new Date(hoje); fim.setDate(fim.getDate() + 6);
      dataMin = startOfDay(hoje); dataMax = endOfDay(fim);
    } else if (filtroData === "personalizado" && dataCustom) {
      const [y, m, d] = dataCustom.split("-").map(Number);
      const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
      dataMin = startOfDay(dt); dataMax = endOfDay(dt);
    }
    return jobs.filter((j) => {
      const st = classifyJob(j);
      if (filtroStatus !== "todos" && st !== filtroStatus) return false;
      if (filtroTipo !== "todos") {
        if (filtroTipo === "preset:mensal" && j.tipo !== "feedback_mensal_link") return false;
        else if (filtroTipo === "preset:quinzenal" && j.tipo !== "feedback_quinzenal_link") return false;
        else if (filtroTipo === "preset:d7" && j.tipo !== "followup_d7") return false;
        else if (filtroTipo === "preset:d21" && j.tipo !== "followup_d21") return false;
        else if (!filtroTipo.startsWith("preset:") && j.tipo !== filtroTipo) return false;
      }
      if (dataMin !== null && dataMax !== null) {
        const t = new Date(j.agendado_para).getTime();
        if (t < dataMin || t > dataMax) return false;
      }
      if (q) {
        const aluno = j.aluno_id ? alunosMap.get(j.aluno_id) : null;
        const hay = `${aluno?.nome ?? ""} ${aluno?.whatsapp ?? ""} ${j.tipo} ${j.erro ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [jobs, filtroStatus, filtroTipo, filtroData, dataCustom, busca, alunosMap]);

  const contagem = useMemo(() => {
    const agora = Date.now();
    let agendado = 0, atrasado = 0, executado = 0, erro = 0;
    for (const j of jobs) {
      const st = classifyJob(j, agora);
      if (st === "agendado") agendado++;
      else if (st === "atrasado") atrasado++;
      else if (st === "executado") executado++;
      else if (st === "erro") erro++;
    }
    return { total: jobs.length, agendado, atrasado, executado, erro };
  }, [jobs]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Disparos em tempo real
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${conectado ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-muted text-muted-foreground"}`}>
              <Radio className={`h-3 w-3 ${conectado ? "animate-pulse" : ""}`} />
              {conectado ? "ao vivo" : "off"}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Acompanhe os jobs agendados, executados e com erro.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Tempo real
          </label>
          <button
            onClick={() => void dispararLote()}
            disabled={
              disparandoLote ||
              (selecionados.size === 0
                ? filtrados.filter((j) => !j.executado).length === 0
                : filtrados.filter((j) => selecionados.has(j.id) && !j.executado).length === 0)
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-primary bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
            title={selecionados.size > 0 ? "Disparar apenas os selecionados" : "Disparar todos os pendentes filtrados"}
          >
            {disparandoLote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {selecionados.size > 0
              ? `Disparar ${selecionados.size} selecionado(s)`
              : "Disparar filtrados"}
          </button>
          <button
            onClick={() => void carregar()}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiCard label="Total" value={contagem.total} icon={<Filter className="h-4 w-4" />} active={filtroStatus === "todos"} onClick={() => setFiltroStatus("todos")} />
        <KpiCard label="Agendados" value={contagem.agendado} accent="amber" icon={<Clock className="h-4 w-4" />} active={filtroStatus === "agendado"} onClick={() => setFiltroStatus("agendado")} />
        <KpiCard label="Atrasados" value={contagem.atrasado} accent="orange" icon={<AlarmClock className="h-4 w-4" />} active={filtroStatus === "atrasado"} onClick={() => setFiltroStatus("atrasado")} />
        <KpiCard label="Executados" value={contagem.executado} accent="green" icon={<CheckCircle2 className="h-4 w-4" />} active={filtroStatus === "executado"} onClick={() => setFiltroStatus("executado")} />
        <KpiCard label="Com erro" value={contagem.erro} accent="red" icon={<AlertTriangle className="h-4 w-4" />} active={filtroStatus === "erro"} onClick={() => setFiltroStatus("erro")} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {(["todos", "agendado", "atrasado", "executado", "erro"] as StatusKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setFiltroStatus(k)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium border ${
                filtroStatus === k
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              }`}
            >
              {k === "todos" ? "Todos" : STATUS_LABEL[k]}
            </button>
          ))}
        </div>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="text-xs rounded-md border border-border bg-background px-2 py-1.5"
        >
          <option value="todos">Todos os tipos</option>
          <option value="preset:mensal">Feedback mensal</option>
          <option value="preset:quinzenal">Check-in quinzenal</option>
          <option value="preset:d7">Follow-up D+7</option>
          <option value="preset:d21">Follow-up D+21</option>
          <option disabled value="__sep">──────────</option>
          {tipos.map((t) => (<option key={t} value={t}>{t}</option>))}
        </select>
        <select
          value={filtroData}
          onChange={(e) => setFiltroData(e.target.value as typeof filtroData)}
          className="text-xs rounded-md border border-border bg-background px-2 py-1.5"
          title="Filtrar por data agendada"
        >
          <option value="todas">Todas as datas</option>
          <option value="hoje">Hoje</option>
          <option value="amanha">Amanhã</option>
          <option value="semana">Próximos 7 dias</option>
          <option value="personalizado">Data específica…</option>
        </select>
        {filtroData === "personalizado" && (
          <input
            type="date"
            value={dataCustom}
            onChange={(e) => setDataCustom(e.target.value)}
            className="text-xs rounded-md border border-border bg-background px-2 py-1.5"
          />
        )}
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por aluno, telefone, tipo ou erro…"
          className="flex-1 min-w-[200px] text-sm rounded-md border border-border bg-background px-3 py-1.5"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-center py-2 px-2 text-xs font-medium w-8">
                {(() => {
                  const elegiveis = filtrados.filter((j) => !j.executado);
                  const todosMarcados = elegiveis.length > 0 && elegiveis.every((j) => selecionados.has(j.id));
                  const algumMarcado = elegiveis.some((j) => selecionados.has(j.id));
                  return (
                    <input
                      type="checkbox"
                      checked={todosMarcados}
                      ref={(el) => { if (el) el.indeterminate = !todosMarcados && algumMarcado; }}
                      onChange={(e) => {
                        setSelecionados((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) for (const j of elegiveis) next.add(j.id);
                          else for (const j of elegiveis) next.delete(j.id);
                          return next;
                        });
                      }}
                      title="Selecionar todos os pendentes filtrados"
                    />
                  );
                })()}
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium">Status</th>
              <th className="text-left py-2 px-3 text-xs font-medium">Aluno</th>
              <th className="text-left py-2 px-3 text-xs font-medium">Tipo</th>
              <th className="text-left py-2 px-3 text-xs font-medium">Agendado</th>
              <th className="text-left py-2 px-3 text-xs font-medium">Executado</th>
              <th className="text-center py-2 px-3 text-xs font-medium">Tent.</th>
              <th className="text-left py-2 px-3 text-xs font-medium">Erro</th>
              <th className="text-right py-2 px-3 text-xs font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-10 text-center text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin mr-2" />Carregando…</td></tr>
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={9} className="py-10 text-center text-muted-foreground text-xs">Nenhum job encontrado.</td></tr>
            ) : (
              filtrados.map((j) => {
                const st = classifyJob(j);
                const aluno = j.aluno_id ? alunosMap.get(j.aluno_id) : null;
                return (
                  <tr key={j.id} className="border-t border-border hover:bg-muted/30">
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        disabled={j.executado}
                        checked={selecionados.has(j.id)}
                        onChange={(e) => {
                          setSelecionados((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(j.id); else next.delete(j.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="py-2 px-3"><StatusBadge status={st} /></td>
                    <td className="py-2 px-3">
                      <div className="font-medium">{aluno?.nome ?? <span className="text-muted-foreground">—</span>}</div>
                      {aluno?.whatsapp && <div className="text-xs text-muted-foreground font-mono">{aluno.whatsapp}</div>}
                    </td>
                    <td className="py-2 px-3"><span className="text-xs font-mono text-muted-foreground">{j.tipo}</span></td>
                    <td className="py-2 px-3 text-xs">{fmt(j.agendado_para)}</td>
                    <td className="py-2 px-3 text-xs">{fmt(j.executado_em)}</td>
                    <td className="py-2 px-3 text-center text-xs">{j.tentativas}</td>
                    <td className="py-2 px-3">
                      {j.erro ? (
                        <span className="text-xs text-red-600 dark:text-red-400 line-clamp-2 max-w-[260px]" title={j.erro}>{j.erro}</span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {!j.executado && (
                          <button
                            onClick={() => void dispararAgora(j.id)}
                            disabled={disparandoId === j.id}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50"
                            title="Disparar este job agora"
                          >
                            {disparandoId === j.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Disparar
                          </button>
                        )}
                        {aluno && (
                          <Link
                            to="/alunos/$id"
                            params={{ id: aluno.id }}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" /> Ver
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, accent, icon, active, onClick,
}: { label: string; value: number; accent?: "green" | "red" | "amber" | "orange"; icon?: React.ReactNode; active?: boolean; onClick?: () => void }) {
  const cls =
    accent === "green" ? "text-green-700 dark:text-green-300 bg-green-500/10 border-green-500/30"
    : accent === "red" ? "text-red-700 dark:text-red-300 bg-red-500/10 border-red-500/30"
    : accent === "orange" ? "text-orange-700 dark:text-orange-300 bg-orange-500/10 border-orange-500/30"
    : accent === "amber" ? "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30"
    : "bg-card border-border";
  const ring = active ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "";
  const interactive = onClick ? "cursor-pointer hover:opacity-90 transition" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-3 ${cls} ${ring} ${interactive}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium opacity-80">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </button>
  );
}

function StatusBadge({ status }: { status: Exclude<StatusKey, "todos"> }) {
  if (status === "executado") {
    return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-300 font-medium"><CheckCircle2 className="h-3 w-3" />Executado</span>;
  }
  if (status === "erro") {
    return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-700 dark:text-red-300 font-medium"><AlertTriangle className="h-3 w-3" />Erro</span>;
  }
  if (status === "atrasado") {
    return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300 font-medium"><AlarmClock className="h-3 w-3" />Atrasado</span>;
  }
  return <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium"><Clock className="h-3 w-3" />Agendado</span>;
}