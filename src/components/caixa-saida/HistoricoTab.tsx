import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { dispararJobsAgora } from "@/server/motor.functions";
import {
  Radio, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Clock, Filter, ExternalLink, Send, AlarmClock, Trash2, MessageCircle,
} from "lucide-react";
import { waMeUrl } from "@/lib/wa-link";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

// Tipos de mensagem disponíveis (devem bater com o enum job_tipo no banco).
const TIPOS_MENSAGEM: Array<{ value: string; label: string }> = [
  { value: "anamnese_confirmacao", label: "Confirmação de anamnese" },
  { value: "followup_d7", label: "Follow-up D+7" },
  { value: "followup_d21", label: "Follow-up D+21" },
  { value: "feedback_quinzenal_link", label: "Check-in Quinzenal" },
  { value: "feedback_mensal_link", label: "Link Feedback Mensal" },
  { value: "feedback_quinzenal_resposta", label: "Resposta IA Quinzenal (histórico)" },
  { value: "feedback_mensal_resposta", label: "Resposta IA Mensal" },
  { value: "pos_feedback_mensal", label: "Pós Feedback Mensal" },
  { value: "feedback_link_lembrete", label: "Lembrete de Feedback" },
  { value: "aniversario", label: "Aniversário" },
  { value: "ia_check_shape", label: "IA Check Shape" },
  { value: "boas_vindas", label: "Boas-vindas" },
];

function labelTipo(tipo: string): string {
  return TIPOS_MENSAGEM.find((t) => t.value === tipo)?.label ?? tipo;
}

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

export type HistoricoCounts = {
  total: number;
  agendado: number;
  atrasado: number;
  executado: number;
  erro: number;
};

export function HistoricoTab({
  initialStatus,
  onCountsChange,
}: {
  initialStatus?: StatusKey;
  onCountsChange?: (c: HistoricoCounts) => void;
} = {}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [alunosMap, setAlunosMap] = useState<Map<string, AlunoMin>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<StatusKey>(initialStatus ?? "todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroData, setFiltroData] = useState<"todas" | "hoje" | "amanha" | "semana" | "personalizado">("todas");
  const [dataCustom, setDataCustom] = useState<string>(""); // YYYY-MM-DD
  const [busca, setBusca] = useState("");
  const [conectado, setConectado] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [disparandoId, setDisparandoId] = useState<string | null>(null);
  const [disparandoLote, setDisparandoLote] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [apagandoId, setApagandoId] = useState<string | null>(null);
  const [apagandoLote, setApagandoLote] = useState(false);
  const [alterandoTipoId, setAlterandoTipoId] = useState<string | null>(null);
  const [confirmarApagar, setConfirmarApagar] = useState<
    | { tipo: "um"; id: string; descricao: string }
    | { tipo: "lote"; ids: string[]; escopo: string }
    | null
  >(null);

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

  function pedirApagarJob(jobId: string) {
    const j = jobs.find((x) => x.id === jobId);
    const aluno = j?.aluno_id ? alunosMap.get(j.aluno_id) : null;
    const descricao = `${labelTipo(j?.tipo ?? "")}${aluno?.nome ? ` • ${aluno.nome}` : ""}`;
    setConfirmarApagar({ tipo: "um", id: jobId, descricao });
  }

  async function apagarJob(jobId: string) {
    setApagandoId(jobId);
    try {
      const { error } = await supabase.from("jobs_disparos").delete().eq("id", jobId);
      if (error) {
        alert("Falha ao apagar: " + error.message);
      } else {
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
        setSelecionados((prev) => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
      }
    } finally {
      setApagandoId(null);
    }
  }

  async function alterarTipoJob(jobId: string, novoTipo: string) {
    setAlterandoTipoId(jobId);
    try {
      const { error } = await supabase
        .from("jobs_disparos")
        .update({ tipo: novoTipo as never })
        .eq("id", jobId);
      if (error) {
        alert("Falha ao alterar tipo: " + error.message);
      } else {
        setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, tipo: novoTipo } : j)));
      }
    } finally {
      setAlterandoTipoId(null);
    }
  }

  function pedirApagarLote() {
    const ids = selecionados.size > 0
      ? filtrados.filter((j) => selecionados.has(j.id)).map((j) => j.id)
      : filtrados.map((j) => j.id);
    if (ids.length === 0) return;
    const escopo = selecionados.size > 0 ? "selecionado(s)" : "filtrado(s)";
    setConfirmarApagar({ tipo: "lote", ids, escopo });
  }

  async function apagarLote(ids: string[]) {
    if (ids.length === 0) return;
    setApagandoLote(true);
    try {
      const { error } = await supabase.from("jobs_disparos").delete().in("id", ids);
      if (error) {
        alert("Falha ao apagar: " + error.message);
      } else {
        const setIds = new Set(ids);
        setJobs((prev) => prev.filter((j) => !setIds.has(j.id)));
        setSelecionados(new Set());
      }
    } finally {
      setApagandoLote(false);
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

  // Tipos que são respostas automáticas da IA — não devem aparecer no filtro,
  // pois são processados automaticamente e não fazem parte de campanhas.
  const TIPOS_IA_AUTOMATICOS = new Set<string>([
    "feedback_quinzenal_resposta",
    "feedback_mensal_resposta",
    "ia_check_shape",
  ]);

  const tipos = useMemo(() => {
    const set = new Set<string>();
    for (const j of jobs) {
      if (TIPOS_IA_AUTOMATICOS.has(j.tipo)) continue;
      set.add(j.tipo);
    }
    return Array.from(set).sort((a, b) => labelTipo(a).localeCompare(labelTipo(b), "pt-BR"));
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
    const filtered = jobs.filter((j) => {
      // Respostas automáticas da IA nunca aparecem na lista de disparos
      if (TIPOS_IA_AUTOMATICOS.has(j.tipo)) return false;
      const st = classifyJob(j);
      if (filtroStatus !== "todos" && st !== filtroStatus) return false;
      if (filtroTipo !== "todos") {
        if (j.tipo !== filtroTipo) return false;
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
    filtered.sort((a, b) => new Date(b.agendado_para).getTime() - new Date(a.agendado_para).getTime());
    return filtered;
  }, [jobs, filtroStatus, filtroTipo, filtroData, dataCustom, busca, alunosMap]);

  const contagem = useMemo(() => {
    const agora = Date.now();
    let agendado = 0, atrasado = 0, executado = 0, erro = 0;
    let total = 0;
    for (const j of jobs) {
      if (TIPOS_IA_AUTOMATICOS.has(j.tipo)) continue;
      total++;
      const st = classifyJob(j, agora);
      if (st === "agendado") agendado++;
      else if (st === "atrasado") atrasado++;
      else if (st === "executado") executado++;
      else if (st === "erro") erro++;
    }
    return { total, agendado, atrasado, executado, erro };
  }, [jobs]);

  useEffect(() => {
    onCountsChange?.(contagem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contagem]);

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
          <button
            onClick={() => pedirApagarLote()}
            disabled={apagandoLote || filtrados.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-background text-destructive px-3 py-1.5 text-sm hover:bg-destructive/10 disabled:opacity-50"
            title={selecionados.size > 0 ? "Apagar apenas os selecionados" : "Apagar todos os filtrados"}
          >
            {apagandoLote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {selecionados.size > 0 ? `Apagar ${selecionados.size} selecionado(s)` : "Apagar filtrados"}
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
                  const elegiveis = filtrados;
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
                      title="Selecionar todos os filtrados"
                    />
                  );
                })()}
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium">Status</th>
              <th className="text-left py-2 px-3 text-xs font-medium">Aluno</th>
              <th className="text-left py-2 px-3 text-xs font-medium">
                <div className="flex flex-col gap-1">
                  <span>Tipo</span>
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                    className="text-xs rounded-md border border-border bg-background px-2 py-1 font-normal"
                    title="Filtrar por tipo"
                  >
                    <option value="todos">Todos</option>
                    {tipos.map((t) => (<option key={t} value={t}>{labelTipo(t)}</option>))}
                  </select>
                </div>
              </th>
              <th className="text-left py-2 px-3 text-xs font-medium">
                <div className="flex flex-col gap-1">
                  <span>Agendado</span>
                  <select
                    value={filtroData}
                    onChange={(e) => setFiltroData(e.target.value as typeof filtroData)}
                    className="text-xs rounded-md border border-border bg-background px-2 py-1 font-normal"
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
                      className="text-xs rounded-md border border-border bg-background px-2 py-1 font-normal"
                    />
                  )}
                </div>
              </th>
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
                    <td className="py-2 px-3">
                      <span className="text-xs text-muted-foreground">{labelTipo(j.tipo)}</span>
                    </td>
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
                        {aluno?.whatsapp && (() => {
                          const url = waMeUrl(aluno.whatsapp, `Olá ${aluno.nome?.split(" ")[0] ?? ""}!`.trim());
                          if (!url) return null;
                          return (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
                              title="Abrir conversa manual no WhatsApp"
                            >
                              <MessageCircle className="h-3 w-3" /> WhatsApp
                            </a>
                          );
                        })()}
                        {aluno && (
                          <Link
                            to="/alunos/$id"
                            params={{ id: aluno.id }}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" /> Ver
                          </Link>
                        )}
                        <button
                          onClick={() => pedirApagarJob(j.id)}
                          disabled={apagandoId === j.id}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          title="Apagar este job da lista"
                        >
                          {apagandoId === j.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Apagar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!confirmarApagar} onOpenChange={(o) => { if (!o) setConfirmarApagar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmarApagar?.tipo === "lote"
                ? `Apagar ${confirmarApagar.ids.length} job(s)?`
                : "Apagar este job?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmarApagar?.tipo === "lote" ? (
                <>
                  Você vai remover <strong>{confirmarApagar.ids.length} job(s) {confirmarApagar.escopo}</strong> da fila de disparos.
                  <br />Essa ação é permanente e não pode ser desfeita.
                </>
              ) : confirmarApagar?.tipo === "um" ? (
                <>
                  <span className="block mb-1">{confirmarApagar.descricao}</span>
                  Essa ação é permanente e não pode ser desfeita.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                const alvo = confirmarApagar;
                setConfirmarApagar(null);
                if (alvo?.tipo === "um") await apagarJob(alvo.id);
                else if (alvo?.tipo === "lote") await apagarLote(alvo.ids);
              }}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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