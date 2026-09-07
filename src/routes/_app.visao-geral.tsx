import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ModalidadeTag } from "@/components/AppShell";
import { fmtDate } from "@/lib/crm";
import {
  ChevronLeft, ChevronRight, Check, AlertCircle, X, Calendar as CalIcon,
  Package, Flag, MessageSquare, Camera, RefreshCw, Plus, Send, Eye, MessageCircle, Filter,
  Sparkles, Loader2, Copy, ClipboardList, Apple, Dumbbell, User as UserIcon, Clock,
  MoreVertical, Trash2, CalendarDays,
} from "lucide-react";
const AddAlunoModal = lazy(() =>
  import("./_app.alunos.index").then((m) => ({ default: m.AddAlunoModal })),
);
import { useServerFn } from "@tanstack/react-start";
import { gerarMensagemPontoContato, enviarPontoContatoZapi } from "@/server/pontos-contato.functions";
import { registrarDesfazerEntrega } from "@/server/entregas.functions";
import { gerarRespostaFormulario } from "@/server/feedback.functions";
import { listZapiGroups, type ZapiGroup } from "@/server/zapi.functions";
import { previewResumoDia, enviarResumoDiaGrupo } from "@/server/resumo-grupo.functions";
import { toast } from "sonner";
import { useSignedAnamneseUrls } from "@/lib/use-signed-anamnese-urls";
import { RenovacoesUrgentesCard } from "@/components/visao-geral/RenovacoesUrgentesCard";
import { FeedbacksSemRespostaCard } from "@/components/visao-geral/FeedbacksSemRespostaCard";


function abrirJanelaPreparandoWhatsApp(): Window | null {
  const janela = window.open("", "_blank");
  if (!janela) return null;
  janela.opener = null;
  try {
    janela.document.write(`<!doctype html><html><head><title>Preparando WhatsApp</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f8fafc;color:#0f172a}.box{text-align:center;padding:24px}.dot{width:36px;height:36px;border:4px solid #d1fae5;border-top-color:#059669;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="box"><div class="dot"></div><strong>Preparando WhatsApp…</strong><p>A conversa será aberta em instantes.</p></div></body></html>`);
    janela.document.close();
  } catch {
    // Se o navegador bloquear escrita no popup, ainda tentamos redirecionar a aba aberta.
  }
  return janela;
}

function abrirWhatsAppUrl(url: string, janelaExistente?: Window | null) {
  if (janelaExistente && !janelaExistente.closed) {
    janelaExistente.location.href = url;
    return;
  }
  const janela = window.open(url, "_blank");
  if (janela) {
    janela.opener = null;
    return;
  }
  window.location.href = url;
}

function fecharJanelaPreparando(janela: Window | null) {
  try {
    if (janela && !janela.closed) janela.close();
  } catch {
    // Alguns navegadores não permitem fechar; nesse caso apenas seguimos com o toast.
  }
}

function FotoSlotVisao({ url, label }: { url: string; label: string }) {
  const { resolve } = useSignedAnamneseUrls([url]);
  const finalUrl = resolve(url);
  return (
    <div className="text-center">
      {finalUrl ? (
        <a href={finalUrl} target="_blank" rel="noreferrer">
          <img src={finalUrl} alt={label} className="w-full rounded border border-border object-cover" style={{ aspectRatio: "3/4" }} />
        </a>
      ) : (
        <div className="w-full rounded border border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground" style={{ aspectRatio: "3/4" }}>—</div>
      )}
      <div className="text-[11px] mt-1 text-muted-foreground">{label}</div>
    </div>
  );
}

export const Route = createFileRoute("/_app/visao-geral")({
  head: () => ({
    meta: [
      { title: "Visão Geral — MPTEAM" },
      { name: "description", content: "Painel da equipe MPTEAM: indicadores de alunos, feedbacks pendentes, renovações e ações do dia." },
    ],
  }),
  component: VisaoGeralPage,
});

type Modalidade = "mpteam" | "mp_elite" | "mp_presencial" | null;

interface AlunoMin { id: string; nome: string; modalidade: Modalidade; data_anamnese: string | null; whatsapp: string; plano: string | null; status?: string | null }
interface Entrega {
  id: string; aluno_id: string; data_referencia: string;
  dieta_entregue: boolean; treino_entregue: boolean; d0_confirmado: boolean;
  dieta_entregue_em: string | null; treino_entregue_em: string | null;
  d0_confirmado_em: string | null;
  dieta_entregue_por: string | null; treino_entregue_por: string | null;
  d0_confirmado_por: string | null;
  aluno: AlunoMin | null;
}
interface JobRow { id: string; aluno_id: string | null; tipo: string; executado: boolean; executado_em: string | null; agendado_para: string; formulario_id?: string | null }
interface FormRow { id: string; aluno_id: string | null; tipo: string; respondido: boolean; respondido_em: string | null; dados_resposta: unknown; confirmado_equipe: boolean }
interface AgendamentoRow {
  id: string;
  aluno_id: string;
  template_id: string;
  periodicidade: string;
  proximo_envio_em: string | null;
  ultimo_envio_em: string | null;
  ativo: boolean;
  aluno: { id: string; nome: string; modalidade: Modalidade } | null;
}
interface MensagemLogRow {
  id: string;
  aluno_id: string | null;
  tipo_job: string | null;
  mensagem_enviada: string | null;
  whatsapp_destino: string | null;
  status_envio: string | null;
  erro_detalhe: string | null;
  enviado_em: string;
}
interface PontoContatoRow {
  id: string;
  nome: string;
  prompt_tipo: string;
  gatilho_valor: number;
  ativo: boolean;
}
interface AlunoAtivoRow {
  id: string;
  nome: string;
  modalidade: Modalidade;
  whatsapp: string;
  data_d0: string | null;
  data_expiracao: string | null;
  status: string;
  primeira_entrega_em: string | null;
}

const EVENT_COLORS = {
  entrega: "var(--primary)",
  d0: "#22c55e",
  feedback: "#3b82f6",
  checkshape: "#f59e0b",
  ponto_contato: "#a855f7",
  renovacao: "#a855f7",
} as const;

const EVENT_LABELS: Record<keyof typeof EVENT_COLORS, string> = {
  entrega: "Protocolo a entregar (até a data)",
  d0: "Início do plano do aluno",
  feedback: "Feedback quinzenal — envio agendado",
  checkshape: "Feedback mensal — envio agendado",
  ponto_contato: "Ponto de contato D+7 / D+21",
  renovacao: "Renovação",
};

function todayISO() { return new Date().toISOString().slice(0, 10); }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function sameDay(a: string, b: string) { return a.slice(0, 10) === b.slice(0, 10); }

function VisaoGeralPage() {
  const { crmUser, isAdmin } = useAuth();
  const canEdit = isAdmin || crmUser?.perfil === "equipe";
  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    if (typeof window === "undefined") return startOfMonth(new Date());
    const saved = sessionStorage.getItem("visaoGeral.monthCursor");
    if (saved) {
      const d = new Date(saved);
      if (!isNaN(d.getTime())) return startOfMonth(d);
    }
    return startOfMonth(new Date());
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("visaoGeral.selectedDay");
  });
  const [showAdd, setShowAdd] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem("visaoGeral.monthCursor", monthCursor.toISOString());
  }, [monthCursor]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedDay) sessionStorage.setItem("visaoGeral.selectedDay", selectedDay);
    else sessionStorage.removeItem("visaoGeral.selectedDay");
  }, [selectedDay]);

  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [entregasAtrasadasGlobal, setEntregasAtrasadasGlobal] = useState<Entrega[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [formularios, setFormularios] = useState<FormRow[]>([]);
  const [jobsFeedbackHoje, setJobsFeedbackHoje] = useState<JobRow[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoRow[]>([]);
  const [agendamentosHoje, setAgendamentosHoje] = useState<AgendamentoRow[]>([]);
  const [renovacoes, setRenovacoes] = useState<{ aluno_id: string; criado_em: string; aluno: AlunoMin | null }[]>([]);
  const [alunosD0, setAlunosD0] = useState<{ id: string; nome: string; data_d0: string; modalidade: Modalidade }[]>([]);
  const [alunosAtivos, setAlunosAtivos] = useState<AlunoAtivoRow[]>([]);
  const [mensagensLogMes, setMensagensLogMes] = useState<MensagemLogRow[]>([]);
  const [pontosContato, setPontosContato] = useState<PontoContatoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const today = todayISO();

  useEffect(() => {
    void load();
    // realtime
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void load(), 800);
    };
    const ch = supabase
      .channel("visao-geral")
      .on("postgres_changes", { event: "*", schema: "public", table: "entregas_dia" }, debouncedLoad)
      .subscribe();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthCursor.getTime()]);

  async function load(opts?: { silent?: boolean }) {
    if (!opts?.silent) setLoading(true);
    const startISO = monthStart.toISOString();
    const endISO = new Date(monthEnd.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
    const startDate = monthStart.toISOString().slice(0, 10);
    const endDate = monthEnd.toISOString().slice(0, 10);

    // Janela de entregas: do início do mês até +7 dias após o fim
    const entStart = startDate;
    const entEnd = new Date(monthEnd.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

    // FASE 1 — essenciais para o primeiro paint (calendário + atividades de hoje)
    const [entRes, alunosD0Res, agHojeRes, jobRes] = await Promise.all([
      supabase.from("entregas_dia").select("*, aluno:alunos(id, nome, modalidade, data_anamnese, whatsapp, plano, status)")
        .gte("data_referencia", entStart).lte("data_referencia", entEnd)
        .order("data_referencia", { ascending: true }),
      supabase.from("alunos").select("id, nome, data_d0, modalidade")
        .gte("data_d0", startISO).lte("data_d0", endISO).not("data_d0", "is", null),
      supabase.from("feedback_agendamentos")
        .select("id, aluno_id, template_id, periodicidade, proximo_envio_em, ultimo_envio_em, ativo, aluno:alunos(id, nome, modalidade)")
        .eq("ativo", true)
        .gte("proximo_envio_em", todayStart.toISOString())
        .lte("proximo_envio_em", todayEnd.toISOString()),
      supabase.from("jobs_disparos").select("id, aluno_id, tipo, executado, executado_em, agendado_para")
        .gte("executado_em", startISO).lte("executado_em", endISO).eq("executado", true),
    ]);

    setEntregas((entRes.data ?? []) as unknown as Entrega[]);

    // Atrasadas globais: tudo antes de hoje sem dieta+treino entregues, independente do mês
    void (async () => {
      const { data: atr } = await supabase
        .from("entregas_dia")
        .select("*, aluno:alunos(id, nome, modalidade, data_anamnese, whatsapp, plano, status)")
        .lt("data_referencia", today)
        .or("dieta_entregue.eq.false,treino_entregue.eq.false")
        .order("data_referencia", { ascending: true })
        .limit(500);
      setEntregasAtrasadasGlobal((atr ?? []) as unknown as Entrega[]);
    })();
    setAlunosD0((alunosD0Res.data ?? []) as { id: string; nome: string; data_d0: string; modalidade: Modalidade }[]);
    setAgendamentosHoje((agHojeRes.data ?? []) as unknown as AgendamentoRow[]);
    setJobs((jobRes.data ?? []) as JobRow[]);

    void startDate; void endDate;
    setLoading(false);

    // FASE 2 — secundárias (não bloqueiam o paint)
    void (async () => {
      const [formRes, histRes, fbJobsRes, agRes, ativosRes, msgLogRes, pcRes] = await Promise.all([
        supabase.from("formularios").select("id, aluno_id, tipo, respondido, respondido_em, dados_resposta, confirmado_equipe")
          .eq("respondido", true).gte("respondido_em", startISO).lte("respondido_em", endISO),
        supabase.from("historico_status").select("aluno_id, criado_em, aluno:alunos(id, nome, modalidade, data_anamnese, whatsapp)")
          .eq("status_para", "renovado").gte("criado_em", startISO).lte("criado_em", endISO),
        supabase.from("jobs_disparos")
          .select("id, aluno_id, tipo, executado, executado_em, agendado_para, formulario_id")
          .in("tipo", [
            "d15_formulario",
            "d30",
            "feedback_quinzenal_link",
            "feedback_mensal_link",
            "feedback_link_lembrete",
            "followup_d7",
            "followup_d21",
            "pos_entrega_d1",
          ])
          .eq("executado", false)
          .lte("agendado_para", todayEnd.toISOString()),
        supabase.from("feedback_agendamentos")
          .select("id, aluno_id, template_id, periodicidade, proximo_envio_em, ultimo_envio_em, ativo, aluno:alunos(id, nome, modalidade)")
          .eq("ativo", true)
          .gte("proximo_envio_em", startISO).lte("proximo_envio_em", endISO),
        supabase.from("alunos")
          .select("id, nome, modalidade, whatsapp, data_d0, data_expiracao, status")
          .in("status", ["ativo", "anamnese_recebida", "em_producao", "renovado", "aguardando_renovacao", "cancelado"]),
        supabase.from("mensagens_log")
          .select("id, aluno_id, tipo_job, mensagem_enviada, whatsapp_destino, status_envio, erro_detalhe, enviado_em")
          .gte("enviado_em", startISO).lte("enviado_em", endISO)
          .order("enviado_em", { ascending: false })
          .limit(200),
        supabase.from("pontos_contato")
          .select("id, nome, prompt_tipo, gatilho_valor, ativo")
          .eq("ativo", true)
          .in("prompt_tipo", ["followup_d7", "followup_d21"]),
      ]);

      setFormularios((formRes.data ?? []) as FormRow[]);
      setJobsFeedbackHoje((fbJobsRes.data ?? []) as JobRow[]);
      setAgendamentos((agRes.data ?? []) as unknown as AgendamentoRow[]);
      setRenovacoes((histRes.data ?? []) as unknown as { aluno_id: string; criado_em: string; aluno: AlunoMin | null }[]);

      const ativosRaw = (ativosRes.data ?? []) as Omit<AlunoAtivoRow, "primeira_entrega_em">[];
      const ativoIds = ativosRaw.map((a) => a.id);
      const primeiraEntregaMap = new Map<string, string>();
      if (ativoIds.length > 0) {
        const { data: entAll } = await supabase.from("entregas_dia")
          .select("aluno_id, dieta_entregue_em, treino_entregue_em")
          .in("aluno_id", ativoIds)
          .or("dieta_entregue.eq.true,treino_entregue.eq.true");
        (entAll ?? []).forEach((e: { aluno_id: string; dieta_entregue_em: string | null; treino_entregue_em: string | null }) => {
          const candidates = [e.dieta_entregue_em, e.treino_entregue_em].filter(Boolean) as string[];
          if (candidates.length === 0) return;
          const min = candidates.reduce((a, b) => (a < b ? a : b));
          const cur = primeiraEntregaMap.get(e.aluno_id);
          if (!cur || min < cur) primeiraEntregaMap.set(e.aluno_id, min);
        });
      }
      setAlunosAtivos(ativosRaw.map((a) => ({ ...a, primeira_entrega_em: primeiraEntregaMap.get(a.id) ?? null })));
      setMensagensLogMes((msgLogRes.data ?? []) as MensagemLogRow[]);
      setPontosContato((pcRes.data ?? []) as PontoContatoRow[]);
    })();
  }

  // Eventos por dia para o calendário
  const eventsByDay = useMemo(() => {
    const map = new Map<string, Set<keyof typeof EVENT_COLORS>>();
    const add = (d: string, k: keyof typeof EVENT_COLORS) => {
      const key = d.slice(0, 10);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(k);
    };
    entregas.forEach((e) => {
      const d = new Date(e.data_referencia);
      if (d >= monthStart && d <= monthEnd) add(e.data_referencia, "entrega");
    });
    alunosD0.forEach((a) => add(a.data_d0, "d0"));
    jobs.forEach((j) => {
      if (!j.executado_em) return;
      if (j.tipo === "d15_formulario") add(j.executado_em, "feedback");
      if (j.tipo === "d30") add(j.executado_em, "checkshape");
    });
    agendamentos.forEach((a) => {
      if (!a.proximo_envio_em) return;
      const d = new Date(a.proximo_envio_em);
      if (d >= monthStart && d <= monthEnd) {
        add(a.proximo_envio_em, a.periodicidade === "quinzenal" ? "feedback" : "checkshape");
      }
    });
    renovacoes.forEach((r) => add(r.criado_em, "renovacao"));
    // Renovações previstas (data_expiracao dentro do mês)
    alunosAtivos.forEach((a) => {
      if (!a.data_expiracao) return;
      const d = new Date(a.data_expiracao);
      if (d >= monthStart && d <= monthEnd) add(a.data_expiracao, "renovacao");
    });
    // Pontos de contato D+7 / D+21 baseados em primeira_entrega_em
    alunosAtivos.forEach((a) => {
      if (!a.primeira_entrega_em) return;
      pontosContato.forEach((pc) => {
        const base = new Date(a.primeira_entrega_em!);
        const target = new Date(base.getTime() + pc.gatilho_valor * 24 * 60 * 60 * 1000);
        if (target >= monthStart && target <= monthEnd) {
          add(target.toISOString(), "ponto_contato");
        }
      });
    });
    return map;
  }, [entregas, alunosD0, jobs, agendamentos, renovacoes, alunosAtivos, pontosContato, monthStart, monthEnd]);

  // Não exibir entregas de alunos cancelados ou já renovados — eles não
  // pertencem mais ao fluxo de atualização do dia.
  const isAtivoFluxo = (e: Entrega) =>
    e.aluno?.status !== "cancelado" && e.aluno?.status !== "renovado";
  const pendentesHoje = entregas.filter((e) =>
    sameDay(e.data_referencia, today) && !(e.dieta_entregue && e.treino_entregue) && isAtivoFluxo(e),
  );
  const concluidosHoje = entregas.filter((e) =>
    sameDay(e.data_referencia, today) && e.dieta_entregue && e.treino_entregue && isAtivoFluxo(e),
  );
  const atrasadas = useMemo(() => {
    const map = new Map<string, Entrega>();
    [...entregas, ...entregasAtrasadasGlobal].forEach((e) => {
      if (
        e.data_referencia < today &&
        !(e.dieta_entregue && e.treino_entregue) &&
        e.aluno?.status !== "cancelado" &&
        e.aluno?.status !== "renovado"
      ) {
        map.set(e.id, e);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.data_referencia.localeCompare(b.data_referencia));
  }, [entregas, entregasAtrasadasGlobal, today]);

  // Patch otimista de uma entrega — evita recarregar tudo ao confirmar dieta/treino/D0
  const patchEntrega = (id: string, partial: Partial<Entrega>) => {
    setEntregas((prev) => prev.map((e) => (e.id === id ? { ...e, ...partial } : e)));
    setEntregasAtrasadasGlobal((prev) => prev.map((e) => (e.id === id ? { ...e, ...partial } : e)));
  };

  // Dia ativo das "Atividades do Dia" — segue selectedDay quando existir, senão hoje
  const activeDay = selectedDay ?? today;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Painel operacional do dia</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold hover:opacity-90 shrink-0"
          >
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Adicionar aluno</span><span className="sm:hidden">Novo</span>
          </button>
        )}
      </div>

      {showAdd && (
        <Suspense fallback={null}>
          <AddAlunoModal
            onClose={() => setShowAdd(false)}
            onSaved={(id) => {
              setShowAdd(false);
              void navigate({ to: "/alunos/$id", params: { id } });
            }}
          />
        </Suspense>
      )}

      {loading ? (
        <VisaoGeralSkeleton />
      ) : (
        <>
        {isAdmin && <RenovacoesUrgentesCard />}
        
        <FeedbacksSemRespostaCard />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Coluna esquerda: calendário ~35% (4/12) */}
          <div className="lg:col-span-4 space-y-3">
            <CalendarPanel
              cursor={monthCursor}
              setCursor={setMonthCursor}
              eventsByDay={eventsByDay}
              selectedDay={selectedDay}
              setSelectedDay={setSelectedDay}
            />
            
            {selectedDay && (
              <DayDetails
                day={selectedDay}
                entregas={entregas}
                jobs={jobs}
                agendamentos={agendamentos}
                renovacoes={renovacoes}
                alunosD0={alunosD0}
                onClose={() => setSelectedDay(null)}
              />
            )}
          </div>

          {/* Coluna direita: atualizações ~65% (8/12) */}
          <div className="lg:col-span-8 space-y-5">
            {atrasadas.length > 0 && (
              <AtrasadasBlock
                atrasadas={atrasadas}
                canEdit={canEdit}
                isAdmin={isAdmin}
                userLabel={crmUser?.nome ?? crmUser?.email ?? "equipe"}
                onChanged={() => load({ silent: true })}
                onPatchEntrega={patchEntrega}
              />
            )}
            <AtualizacoesBlock
              pendentes={pendentesHoje}
              concluidos={concluidosHoje}
              canEdit={canEdit}
              isAdmin={isAdmin}
              userLabel={crmUser?.nome ?? crmUser?.email ?? "equipe"}
              onChanged={() => load({ silent: true })}
              onPatchEntrega={patchEntrega}
            />
            <AtividadesDoDiaBlock
              day={activeDay}
              entregas={entregas}
              formularios={formularios}
              agendamentos={agendamentos}
              jobsFeedbackHoje={jobsFeedbackHoje}
              mensagensLog={mensagensLogMes}
              alunosAtivos={alunosAtivos}
              pontosContato={pontosContato}
              canEdit={canEdit}
              userLabel={crmUser?.nome ?? crmUser?.email ?? "equipe"}
              onChanged={() => load({ silent: true })}
            />
            <ProximasAtualizacoesBlock
              entregas={entregas}
              formularios={formularios}
              agendamentos={agendamentos}
              mensagensLog={mensagensLogMes}
              alunosAtivos={alunosAtivos}
              pontosContato={pontosContato}
              canEdit={canEdit}
              userLabel={crmUser?.nome ?? crmUser?.email ?? "equipe"}
              onChanged={() => load({ silent: true })}
            />
          </div>
        </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Calendário ---------------- */
function CalendarPanel({
  cursor, setCursor, eventsByDay, selectedDay, setSelectedDay,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  eventsByDay: Map<string, Set<keyof typeof EVENT_COLORS>>;
  selectedDay: string | null;
  setSelectedDay: (d: string | null) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = first.getDay(); // 0=Dom
  const daysInMonth = last.getDate();
  const todayKey = todayISO();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setCursor(new Date(year, month - 1, 1))}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground"
          aria-label="Mês anterior"
        ><ChevronLeft className="h-4 w-4" /></button>
        <div className="flex items-center gap-2">
          <CalIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold capitalize">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="px-2 py-1 text-xs rounded hover:bg-accent text-muted-foreground"
          >Hoje</button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground"
            aria-label="Próximo mês"
          ><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-[10px] text-muted-foreground mb-0.5">
        {["D","S","T","Q","Q","S","S"].map((d, i) => (
          <div key={i} className="text-center font-medium py-0.5">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const events = eventsByDay.get(key);
          const isToday = key === todayKey;
          const isSelected = selectedDay === key;
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(isSelected ? null : key)}
              className={`relative aspect-square flex flex-col items-center justify-center rounded text-xs transition-colors ${
                isSelected
                  ? "bg-primary/20 text-primary font-semibold ring-1 ring-primary"
                  : isToday
                  ? "bg-accent text-foreground font-semibold"
                  : "hover:bg-accent text-foreground"
              }`}
            >
              <span>{d.getDate()}</span>
              {events && events.size > 0 && (
                <div className="absolute bottom-0.5 flex gap-0.5">
                  {Array.from(events).slice(0, 5).map((k) => (
                    <span key={k} title={EVENT_LABELS[k]} className="h-1 w-1 rounded-full" style={{ backgroundColor: EVENT_COLORS[k] }} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}


function DayDetails({
  day, entregas, jobs, agendamentos, renovacoes, alunosD0, onClose,
}: {
  day: string;
  entregas: Entrega[];
  jobs: JobRow[];
  agendamentos: AgendamentoRow[];
  renovacoes: { aluno_id: string; criado_em: string; aluno: AlunoMin | null }[];
  alunosD0: { id: string; nome: string; data_d0: string; modalidade: Modalidade }[];
  onClose: () => void;
}) {
  const items: { tipo: string; nome: string; color: string }[] = [];
  entregas.filter((e) => sameDay(e.data_referencia, day)).forEach((e) => {
    items.push({ tipo: "Protocolo a entregar", nome: e.aluno?.nome ?? "—", color: EVENT_COLORS.entrega });
  });
  alunosD0.filter((a) => sameDay(a.data_d0, day)).forEach((a) => {
    items.push({ tipo: "Início do plano do aluno", nome: a.nome, color: EVENT_COLORS.d0 });
  });
  jobs.filter((j) => j.executado_em && sameDay(j.executado_em, day) && j.tipo === "d15_formulario")
    .forEach(() => items.push({ tipo: "Feedback quinzenal — envio agendado", nome: "—", color: EVENT_COLORS.feedback }));
  jobs.filter((j) => j.executado_em && sameDay(j.executado_em, day) && j.tipo === "d30")
    .forEach(() => items.push({ tipo: "Feedback mensal — envio agendado", nome: "—", color: EVENT_COLORS.checkshape }));
  agendamentos.filter((a) => a.proximo_envio_em && sameDay(a.proximo_envio_em, day)).forEach((a) => {
    const isQuinzenal = a.periodicidade === "quinzenal";
    items.push({
      tipo: isQuinzenal ? "Feedback quinzenal — envio agendado" : "Feedback mensal — envio agendado",
      nome: a.aluno?.nome ?? "—",
      color: isQuinzenal ? EVENT_COLORS.feedback : EVENT_COLORS.checkshape,
    });
  });
  renovacoes.filter((r) => sameDay(r.criado_em, day)).forEach((r) => {
    items.push({ tipo: "Renovação", nome: r.aluno?.nome ?? "—", color: EVENT_COLORS.renovacao });
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">{new Date(day + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">Sem eventos neste dia</div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: it.color }} />
              <span className="text-muted-foreground">{it.tipo}:</span>
              <span className="text-foreground">{it.nome}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Bloco 1: Atualizações do Dia ---------------- */
function AtualizacoesBlock({
  pendentes, concluidos, canEdit, isAdmin, userLabel, onChanged, onPatchEntrega,
}: {
  pendentes: Entrega[];
  concluidos: Entrega[];
  canEdit: boolean;
  isAdmin: boolean;
  userLabel: string;
  onChanged: () => void;
  onPatchEntrega: (id: string, partial: Partial<Entrega>) => void;
}) {
  const [showConcluidos, setShowConcluidos] = useState(false);
  const [openEnviar, setOpenEnviar] = useState(false);
  const hojeRaw = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const hoje = hojeRaw.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bDe\b/g, "De");
  const totalHoje = pendentes.length + concluidos.length;
  return (
    <section className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-bold tracking-tight">Atualizações do Dia</h2>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">{hoje}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
            <CalIcon className="h-3 w-3" />
            <span className="font-medium">{totalHoje} {totalHoje === 1 ? "atualização hoje" : "atualizações hoje"}</span>
          </div>
          <button
            onClick={() => setOpenEnviar(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary hover:bg-primary/90 text-white text-[11px] font-medium px-2.5 py-1"
            title="Enviar resumo no grupo do WhatsApp"
          >
            <Send className="h-3 w-3" />
            Enviar no grupo
          </button>
        </div>
      </div>
      {pendentes.length === 0 ? (
        <div className="text-xs text-muted-foreground py-3">Nenhuma entrega pendente para hoje</div>
      ) : (
        <div className="space-y-2">
          {pendentes.map((e) => (
            <EntregaCard key={e.id} entrega={e} canEdit={canEdit} isAdmin={isAdmin} userLabel={userLabel} onChanged={onChanged} onPatchEntrega={onPatchEntrega} />
          ))}
        </div>
      )}

      {concluidos.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={() => setShowConcluidos((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Check className="h-3.5 w-3.5 text-green-500" />
            Concluídos hoje ({concluidos.length})
            <ChevronRight className={`h-3 w-3 transition-transform ${showConcluidos ? "rotate-90" : ""}`} />
          </button>
          {showConcluidos && (
            <div className="mt-2 space-y-2">
              {concluidos.map((e) => (
                <EntregaCard key={e.id} entrega={e} canEdit={false} isAdmin={isAdmin} userLabel={userLabel} onChanged={onChanged} onPatchEntrega={onPatchEntrega} concluido />
              ))}
            </div>
          )}
        </div>
      )}
      {openEnviar && <EnviarResumoGrupoModal onClose={() => setOpenEnviar(false)} />}
    </section>
  );
}

function EnviarResumoGrupoModal({ onClose }: { onClose: () => void }) {
  const listGroupsFn = useServerFn(listZapiGroups);
  const previewFn = useServerFn(previewResumoDia);
  const enviarFn = useServerFn(enviarResumoDiaGrupo);
  const [groups, setGroups] = useState<ZapiGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [filtro, setFiltro] = useState("");
  const [mensagem, setMensagem] = useState<string>("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [resG, resP] = await Promise.all([listGroupsFn(), previewFn()]);
        if (resG.ok) {
          setGroups(resG.groups);
        } else {
          setError(resG.error);
        }
        setMensagem(resP.mensagem);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, [listGroupsFn, previewFn]);

  const filtrados = groups.filter((g) => g.name.toLowerCase().includes(filtro.toLowerCase()));

  async function handleEnviar() {
    if (!selected) { toast.error("Selecione um grupo"); return; }
    setEnviando(true);
    try {
      const res = await enviarFn({ data: { groupId: selected } });
      if (res.ok) {
        toast.success("Resumo enviado ao grupo");
        onClose();
      } else {
        toast.error(res.error || "Falha ao enviar");
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold">Enviar resumo no grupo</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          {loading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>}
          {error && <div className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded p-3">{error}</div>}
          {!loading && !error && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Grupo do WhatsApp</label>
                <input
                  placeholder="Filtrar grupo…"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="w-full mb-2 px-3 py-2 text-sm rounded-md border border-border bg-background"
                />
                <div className="w-full max-h-64 overflow-y-auto rounded-md border border-border bg-background divide-y divide-border">
                  {filtrados.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum grupo encontrado</div>
                  ) : (
                    filtrados.map((g) => {
                      const isSel = selected === g.id;
                      return (
                        <button
                          type="button"
                          key={g.id}
                          onClick={() => setSelected(g.id)}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${isSel ? "bg-primary/10 text-foreground" : "hover:bg-muted"}`}
                        >
                          <span className="truncate">{g.name}</span>
                          {isSel && <span className="text-primary text-xs font-semibold">✓</span>}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Prévia da mensagem</label>
                <pre className="text-xs whitespace-pre-wrap bg-muted/40 border border-border rounded-md p-3 max-h-60 overflow-y-auto font-sans">{mensagem}</pre>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted">Cancelar</button>
          <button
            onClick={handleEnviar}
            disabled={enviando || loading || !selected}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary hover:bg-primary/90 text-white disabled:opacity-50"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

function EntregaCard({
  entrega, canEdit, isAdmin, userLabel, onChanged, onPatchEntrega, atrasada, concluido,
}: {
  entrega: Entrega; canEdit: boolean; isAdmin?: boolean; userLabel: string; onChanged: () => void;
  onPatchEntrega?: (id: string, partial: Partial<Entrega>) => void;
  atrasada?: boolean; concluido?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const registrarDesfazerFn = useServerFn(registrarDesfazerEntrega);
  const a = entrega.aluno;
  const diasAtraso = atrasada
    ? Math.floor((Date.now() - new Date(entrega.data_referencia + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const diasDesdeAnamnese = a?.data_anamnese
    ? Math.floor((Date.now() - new Date(a.data_anamnese).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  async function toggle(field: "dieta_entregue" | "treino_entregue" | "d0_confirmado") {
    if (!canEdit || busy) return;
    const newVal = !entrega[field];
    if (!newVal) {
      const labelMap = { dieta_entregue: "dieta", treino_entregue: "treino", d0_confirmado: "início (D0)" };
      const ok = window.confirm(`Desfazer entrega de ${labelMap[field]}? A ação será registrada.`);
      if (!ok) return;
    }
    setBusy(field);
    const stamp = newVal ? new Date().toISOString() : null;
    const por = newVal ? userLabel : null;
    let payload: Record<string, unknown> = {};
    if (field === "dieta_entregue") payload = { dieta_entregue: newVal, dieta_entregue_em: stamp, dieta_entregue_por: por };
    if (field === "treino_entregue") payload = { treino_entregue: newVal, treino_entregue_em: stamp, treino_entregue_por: por };
    if (field === "d0_confirmado") payload = { d0_confirmado: newVal, d0_confirmado_em: stamp, d0_confirmado_por: por };
    // Patch otimista local — atualiza só o card sem recarregar a tela
    if (onPatchEntrega) onPatchEntrega(entrega.id, payload as Partial<Entrega>);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("entregas_dia").update(payload as any).eq("id", entrega.id);
    if (!newVal) {
      try {
        await registrarDesfazerFn({
          data: {
            entregaId: entrega.id,
            campo: field,
            anteriorEm: entrega[`${field}_em` as "dieta_entregue_em" | "treino_entregue_em" | "d0_confirmado_em"] ?? null,
            anteriorPor: entrega[`${field}_por` as "dieta_entregue_por" | "treino_entregue_por" | "d0_confirmado_por"] ?? null,
          },
        });
      } catch (e) {
        // log best effort — não bloqueia a UI
        console.error("Falha ao registrar desfazer", e);
      }
    }
    setBusy(null);
    if (!onPatchEntrega) onChanged();
  }

  const meta: string[] = [];
  if (a?.data_anamnese) {
    meta.push(`Anamnese ${fmtDate(a.data_anamnese)}`);
    if (diasDesdeAnamnese !== null) meta.push(`${diasDesdeAnamnese}d atrás`);
  }
  if (atrasada) meta.push(`${diasAtraso} ${diasAtraso === 1 ? "dia" : "dias"} em atraso`);

  return (
    <EntregaRow
      aluno={a}
      meta={meta.join(" · ")}
      dietaChecked={entrega.dieta_entregue}
      treinoChecked={entrega.treino_entregue}
      disabledDieta={!canEdit || busy === "dieta_entregue" || !!concluido}
      disabledTreino={!canEdit || busy === "treino_entregue" || !!concluido}
      onToggleDieta={() => toggle("dieta_entregue")}
      onToggleTreino={() => toggle("treino_entregue")}
      dietaPor={entrega.dieta_entregue_por}
      dietaEm={entrega.dieta_entregue_em}
      treinoPor={entrega.treino_entregue_por}
      treinoEm={entrega.treino_entregue_em}
      atrasada={!!atrasada}
      diasAtraso={diasAtraso}
      adminMenu={isAdmin ? (
        <AdminEntregaMenu
          entregaId={entrega.id}
          alunoId={entrega.aluno_id}
          alunoNome={a?.nome ?? null}
          dataReferencia={entrega.data_referencia}
          onChanged={onChanged}
        />
      ) : null}
    />
  );
}

function AdminEntregaMenu({
  entregaId, alunoId, alunoNome, dataReferencia, onChanged,
}: {
  entregaId: string;
  alunoId: string;
  alunoNome: string | null;
  dataReferencia: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showMover, setShowMover] = useState(false);
  const [novaData, setNovaData] = useState(dataReferencia);
  const [busy, setBusy] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function abrir() {
    const el = btnRef.current;
    if (!el) { setOpen(true); return; }
    const r = el.getBoundingClientRect();
    const menuWidth = 208; // w-52
    setPos({
      top: r.bottom + 6,
      left: Math.max(8, r.right - menuWidth),
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  async function excluir() {
    const nome = alunoNome ?? "este aluno";
    if (!window.confirm(`Excluir a atualização de "${nome}" do dia ${dataReferencia.split("-").reverse().join("/")}?\n\nEssa ação remove o registro daquela data. O aluno permanece no sistema.`)) return;
    setBusy(true);
    // Registra exclusão manual ANTES do delete para que a auto-cura não recrie depois.
    await supabase.from("entregas_dia_log").insert({
      aluno_id: alunoId,
      aluno_nome: alunoNome,
      origem: "manual_exclusao",
      tipo_evento: "excluir_entrega",
      data_referencia: dataReferencia,
      resultado: "excluido",
      detalhes: { entrega_id: entregaId },
    } as never);
    const { error } = await supabase.from("entregas_dia").delete().eq("id", entregaId);
    setBusy(false);
    setOpen(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Atualização excluída do dia");
    onChanged();
  }

  async function mover() {
    if (!novaData) { toast.error("Escolha uma data"); return; }
    if (novaData === dataReferencia) { setShowMover(false); return; }
    setBusy(true);
    const { error } = await supabase
      .from("entregas_dia")
      .update({ data_referencia: novaData })
      .eq("id", entregaId);
    setBusy(false);
    if (error) {
      if (error.code === "23505") {
        toast.error("Já existe uma atualização desse aluno nessa data.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    setShowMover(false);
    setOpen(false);
    toast.success(`Movida para ${novaData.split("-").reverse().join("/")}`);
    onChanged();
  }

  return (
    <>
      <div onClick={(e) => e.stopPropagation()}>
        <button
          ref={btnRef}
          type="button"
          onClick={() => (open ? setOpen(false) : abrir())}
          disabled={busy}
          className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border bg-card hover:bg-muted disabled:opacity-50"
          title="Ações de administrador"
          aria-label="Ações"
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        {open && pos && (
          <div
            className="fixed z-[100] w-52 rounded-lg border border-border bg-card shadow-lg py-1"
            style={{ top: pos.top, left: pos.left }}
          >
            <button
              type="button"
              onClick={() => { setShowMover(true); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted inline-flex items-center gap-2"
            >
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              Mover para outro dia
            </button>
            <button
              type="button"
              onClick={() => void excluir()}
              className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Excluir do dia
            </button>
          </div>
        )}
      </div>

      {showMover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowMover(false)}>
          <div className="bg-card rounded-xl border border-border w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-base font-semibold">Mover atualização</h3>
              <button onClick={() => setShowMover(false)} className="p-1 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {alunoNome ?? "Aluno"} — atualmente em <span className="font-medium text-foreground">{dataReferencia.split("-").reverse().join("/")}</span>
              </p>
              <label className="block">
                <span className="text-xs text-muted-foreground mb-1 block">Nova data</span>
                <input
                  type="date"
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
              <button onClick={() => setShowMover(false)} className="px-3 py-2 text-sm rounded-md border border-border hover:bg-muted">Cancelar</button>
              <button
                onClick={() => void mover()}
                disabled={busy || !novaData}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md bg-primary hover:bg-primary/90 text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                Mover
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function EntregaRow({
  aluno, meta, dietaChecked, treinoChecked, disabledDieta, disabledTreino,
  onToggleDieta, onToggleTreino, atrasada, diasAtraso,
  dietaPor, dietaEm, treinoPor, treinoEm,
  adminMenu,
}: {
  aluno: AlunoMin | null;
  meta?: string;
  dietaChecked: boolean; treinoChecked: boolean;
  disabledDieta: boolean; disabledTreino: boolean;
  onToggleDieta: () => void; onToggleTreino: () => void;
  dietaPor?: string | null; dietaEm?: string | null;
  treinoPor?: string | null; treinoEm?: string | null;
  atrasada?: boolean;
  diasAtraso?: number;
  adminMenu?: React.ReactNode;
}) {
  const ambos = dietaChecked && treinoChecked;
  return (
    <div className="relative rounded-xl border border-border bg-card pl-3.5 pr-3 py-2.5 overflow-hidden shadow-sm">
      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-primary" />
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="shrink-0 h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <ClipboardList className="h-4 w-4 text-primary" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          {aluno?.id ? (
            <Link
              to="/alunos/$id"
              params={{ id: aluno.id }}
              className={`block text-sm font-semibold tracking-tight hover:underline hover:text-primary transition-colors break-words leading-tight ${ambos ? "line-through text-muted-foreground" : "text-foreground"}`}
            >
              {aluno.nome}
            </Link>
          ) : (
            <span className="block text-sm font-semibold tracking-tight text-foreground">—</span>
          )}
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
            <ModalidadeTag m={aluno?.modalidade ?? null} />
            {aluno?.plano && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary">
                {aluno.plano}
              </span>
            )}
            {(aluno?.modalidade === "mpteam" || aluno?.modalidade === "mp_elite") && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                ONLINE
              </span>
            )}
            {aluno?.modalidade === "mp_presencial" && (
              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700">
                PRESENCIAL
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">Entregar protocolo</span>
            {atrasada && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
                <AlertCircle className="h-2.5 w-2.5" />
                {diasAtraso ?? 0} {(diasAtraso ?? 0) === 1 ? "dia" : "dias"} em atraso
              </span>
            )}
          </div>
          {meta && <div className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{meta}</div>}
        </div>
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <PillCheck label="Dieta"  icon={Apple}    checked={dietaChecked}  disabled={disabledDieta}  onClick={onToggleDieta}  por={dietaPor}  em={dietaEm} />
          <PillCheck label="Treino" icon={Dumbbell} checked={treinoChecked} disabled={disabledTreino} onClick={onToggleTreino} por={treinoPor}  em={treinoEm} />
        </div>
        {adminMenu && <div className="shrink-0">{adminMenu}</div>}
      </div>
      <div className="mt-2 flex sm:hidden items-center gap-1.5 flex-wrap">
        <PillCheck label="Dieta"  icon={Apple}    checked={dietaChecked}  disabled={disabledDieta}  onClick={onToggleDieta}  por={dietaPor}  em={dietaEm} />
        <PillCheck label="Treino" icon={Dumbbell} checked={treinoChecked} disabled={disabledTreino} onClick={onToggleTreino} por={treinoPor}  em={treinoEm} />
      </div>
    </div>
  );
}

function PillCheck({
  label, icon: Icon, checked, disabled, onClick, por, em,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  checked: boolean; disabled: boolean; onClick: () => void;
  por?: string | null; em?: string | null;
}) {
  let title: string;
  if (checked) {
    if (por && em) {
      const quando = new Date(em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      title = `Confirmado por ${por} · ${quando}\nClique para desfazer`;
    } else if (por) {
      title = `Confirmado por ${por}\nClique para desfazer`;
    } else {
      title = "Confirmado (autor não registrado)\nClique para desfazer";
    }
  } else {
    title = `Marcar ${label.toLowerCase()} como entregue`;
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={`${label} ${checked ? "entregue" : "pendente"}`}
      className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium transition-all ${
        checked
          ? "bg-primary text-white border border-primary hover:bg-primary"
          : "bg-card border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : <Icon className="h-3 w-3" strokeWidth={1.8} />}
      {label}
    </button>
  );
}

function TaskRow({
  title, meta, checked, disabled, onClick, atrasada,
}: {
  title: string; meta?: string; checked: boolean; disabled: boolean;
  onClick: () => void; atrasada?: boolean;
}) {
  const barColor = atrasada ? "bg-primary" : "bg-primary/70";
  return (
    <div className="relative flex items-center gap-3 rounded-2xl border border-border bg-card pl-4 pr-3 py-3 overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${barColor}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${checked ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {title}
        </div>
        {meta && <div className="text-xs text-muted-foreground truncate mt-0.5">{meta}</div>}
      </div>
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={checked ? "Desmarcar" : "Marcar como concluído"}
        className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center transition-all ${
          checked
            ? "bg-primary text-white hover:bg-primary"
            : "border border-muted-foreground/40 text-muted-foreground hover:border-foreground hover:text-foreground"
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <Check className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

/* ---------------- Bloco 2: Atividades do Dia ---------------- */

type AtividadeCategoria = "feedback" | "ponto_contato" | "entrega" | "renovacao";
type AtividadeStatus = "pendente" | "agendado" | "atrasado" | "confirmado";

interface Atividade {
  key: string;
  categoria: AtividadeCategoria;
  tipoLabel: string;
  status: AtividadeStatus;
  alunoId: string;
  alunoNome: string;
  modalidade: Modalidade;
  whatsapp: string | null;
  cor: string;
  // payload referencial para o modal/ações
  entrega?: Entrega;
  formulario?: FormRow;
  agendamento?: AgendamentoRow;
  pontoContatoId?: string;
  promptTipo?: string;
  ultimaMensagem?: MensagemLogRow;
}

const STATUS_LABEL: Record<AtividadeStatus, string> = {
  pendente: "Pendente",
  agendado: "Agendado",
  atrasado: "Atrasado",
  confirmado: "Confirmado",
};

function statusClasses(s: AtividadeStatus): string {
  switch (s) {
    case "confirmado":
      return "bg-emerald-50 text-emerald-600 border border-emerald-200";
    case "agendado":
      return "bg-blue-50 text-blue-600 border border-blue-200";
    case "atrasado":
      return "bg-primary/10 text-primary border border-primary/30";
    case "pendente":
    default:
      return "bg-orange-50 text-orange-500 border border-orange-200";
  }
}

const FILTROS = [
  { id: "todas", label: "Todas" },
  { id: "feedbacks", label: "Feedbacks" },
  { id: "pontos", label: "Pontos de contato" },
  { id: "entregas", label: "Entregas" },
  { id: "renovacoes", label: "Renovações" },
  { id: "pendentes", label: "Pendentes" },
] as const;
type FiltroId = typeof FILTROS[number]["id"];

function AtividadesDoDiaBlock({
  day, entregas, formularios, agendamentos, jobsFeedbackHoje, mensagensLog,
  alunosAtivos, pontosContato, canEdit, userLabel, onChanged,
}: {
  day: string;
  entregas: Entrega[];
  formularios: FormRow[];
  agendamentos: AgendamentoRow[];
  jobsFeedbackHoje: JobRow[];
  mensagensLog: MensagemLogRow[];
  alunosAtivos: AlunoAtivoRow[];
  pontosContato: PontoContatoRow[];
  canEdit: boolean; userLabel: string; onChanged: () => void;
}) {
  const [filtro, setFiltro] = useState<FiltroId>("todas");
  const [aberta, setAberta] = useState<Atividade | null>(null);

  const atividades: Atividade[] = useMemo(
    () => buildAtividadesParaDia({
      day, entregas, formularios, agendamentos, jobsFeedbackHoje,
      mensagensLog, alunosAtivos, pontosContato,
    }),
    [day, entregas, formularios, agendamentos, jobsFeedbackHoje, alunosAtivos, pontosContato, mensagensLog],
  );

  const filtradas = useMemo(() => {
    if (filtro === "todas") return atividades.filter((a) => a.status !== "atrasado");
    if (filtro === "feedbacks") return atividades.filter((a) => a.categoria === "feedback" && a.status !== "atrasado");
    if (filtro === "pontos") return atividades.filter((a) => a.categoria === "ponto_contato" && a.status !== "atrasado");
    if (filtro === "entregas") return atividades.filter((a) => a.categoria === "entrega" && a.status !== "atrasado");
    if (filtro === "renovacoes") return atividades.filter((a) => a.categoria === "renovacao" && a.status !== "atrasado");
    if (filtro === "pendentes") return atividades.filter((a) => a.status === "pendente" || a.status === "agendado");
    return atividades;
  }, [atividades, filtro]);

  const dayDateRaw = new Date(day + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const dayDate = dayDateRaw.replace(/\b\w/g, (c) => c.toUpperCase());
  const dayShort = formatDataCurta(day);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Atividades do Dia</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{dayDate}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shrink-0">
          <CalIcon className="h-3.5 w-3.5" />
          <span className="font-medium">{filtradas.length} {filtradas.length === 1 ? "atividade hoje" : "atividades hoje"}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
        <button className="shrink-0 h-9 w-9 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Filtros">
          <Filter className="h-3.5 w-3.5" />
        </button>
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
              filtro === f.id
                ? "bg-primary text-white"
                : "bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma atividade para esse filtro</div>
      ) : (
        <ul className="space-y-2">
          {filtradas.map((at) => (
            <li key={at.key}>
              <AtividadeItem at={at} dataLabel={dayShort} onClick={() => setAberta(at)} />
            </li>
          ))}
        </ul>
      )}

      {aberta && (
        <AtividadeDetalheModal
          atividade={aberta}
          onClose={() => setAberta(null)}
          canEdit={canEdit}
          userLabel={userLabel}
          onChanged={() => { onChanged(); setAberta(null); }}
        />
      )}
    </section>
  );
}

/* ---------------- Helpers compartilhados de Atividades ---------------- */

function formatDataCurta(day: string): string {
  const d = new Date(day + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatDataLonga(day: string): string {
  const d = new Date(day + "T00:00:00");
  const raw = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  return raw.replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildAtividadesParaDia({
  day, entregas, formularios, agendamentos, jobsFeedbackHoje,
  mensagensLog, alunosAtivos, pontosContato,
}: {
  day: string;
  entregas: Entrega[];
  formularios: FormRow[];
  agendamentos: AgendamentoRow[];
  jobsFeedbackHoje: JobRow[];
  mensagensLog: MensagemLogRow[];
  alunosAtivos: AlunoAtivoRow[];
  pontosContato: PontoContatoRow[];
}): Atividade[] {
  const alunosMap = new Map<string, AlunoAtivoRow>();
  alunosAtivos.forEach((a) => alunosMap.set(a.id, a));

  function ultimaMsg(alunoId: string, tipoJob: string | string[]) {
    const tipos = Array.isArray(tipoJob) ? tipoJob : [tipoJob];
    return mensagensLog.find((m) => m.aluno_id === alunoId && m.tipo_job && tipos.includes(m.tipo_job)) ?? undefined;
  }

  const out: Atividade[] = [];
  const todayKey = todayISO();

  // 1) Entregas
  entregas.filter((e) => sameDay(e.data_referencia, day)).forEach((e) => {
      const a = e.aluno;
      const completa = e.dieta_entregue && e.treino_entregue;
      let status: AtividadeStatus = "pendente";
      if (completa) status = "confirmado";
      else if (e.data_referencia < todayKey) status = "atrasado";
      out.push({
        key: `ent-${e.id}`,
        categoria: "entrega",
        tipoLabel: "Entrega de Protocolo",
        status,
        alunoId: e.aluno_id,
        alunoNome: a?.nome ?? "—",
        modalidade: a?.modalidade ?? null,
        whatsapp: a?.whatsapp ?? null,
        cor: EVENT_COLORS.entrega,
        entrega: e,
      });
    });

  // 2) Feedbacks respondidos / agendados / jobs
  formularios
      .filter((f) => f.respondido_em && sameDay(f.respondido_em, day) && (f.tipo === "feedback_quinzenal" || f.tipo === "feedback_mensal" || f.tipo === "check_shape"))
      .forEach((f) => {
        const a = f.aluno_id ? alunosMap.get(f.aluno_id) : null;
        const isQuinzenal = f.tipo === "feedback_quinzenal";
        const tipoLog = isQuinzenal ? "feedback_quinzenal_resposta" : "feedback_mensal_resposta";
        const respIA = f.aluno_id ? ultimaMsg(f.aluno_id, [tipoLog]) : undefined;
        const respondidoH = new Date(f.respondido_em!).getTime();
        const horas = (Date.now() - respondidoH) / (1000 * 60 * 60);
        const status: AtividadeStatus = "confirmado";
        void respIA; void horas;
        out.push({
          key: `form-${f.id}`,
          categoria: "feedback",
          tipoLabel: isQuinzenal ? "Feedback Quinzenal" : "Feedback Mensal",
          status,
          alunoId: f.aluno_id ?? "",
          alunoNome: a?.nome ?? "—",
          modalidade: a?.modalidade ?? null,
          whatsapp: a?.whatsapp ?? null,
          cor: isQuinzenal ? EVENT_COLORS.feedback : EVENT_COLORS.checkshape,
          formulario: f,
          ultimaMensagem: respIA,
        });
      });

  agendamentos
      .filter((ag) => ag.proximo_envio_em && sameDay(ag.proximo_envio_em, day))
      .forEach((ag) => {
        const isQuinzenal = ag.periodicidade === "quinzenal";
        const enviadoHoje = !!ag.ultimo_envio_em && sameDay(ag.ultimo_envio_em, day);
        const jaResp = formularios.some((f) =>
          f.aluno_id === ag.aluno_id && f.respondido_em && sameDay(f.respondido_em, day)
          && ((isQuinzenal && f.tipo === "feedback_quinzenal") || (!isQuinzenal && (f.tipo === "feedback_mensal" || f.tipo === "check_shape")))
        );
        if (jaResp) return;
        const status: AtividadeStatus = enviadoHoje ? "confirmado" : (day < todayISO() ? "atrasado" : "pendente");
        const a = ag.aluno;
        const formMaisRecente = formularios
          .filter((f) => f.aluno_id === ag.aluno_id && f.respondido && f.dados_resposta
            && ((isQuinzenal && f.tipo === "feedback_quinzenal") || (!isQuinzenal && (f.tipo === "feedback_mensal" || f.tipo === "check_shape"))))
          .sort((x, y) => (y.respondido_em ?? "").localeCompare(x.respondido_em ?? ""))[0];
        const tipoLog = isQuinzenal ? "feedback_quinzenal_resposta" : "feedback_mensal_resposta";
        const respIA = ag.aluno_id ? ultimaMsg(ag.aluno_id, [tipoLog]) : undefined;
        out.push({
          key: `ag-${ag.id}`,
          categoria: "feedback",
          tipoLabel: isQuinzenal ? "Feedback Quinzenal" : "Feedback Mensal",
          status,
          alunoId: ag.aluno_id,
          alunoNome: a?.nome ?? "—",
          modalidade: a?.modalidade ?? null,
          whatsapp: alunosMap.get(ag.aluno_id)?.whatsapp ?? null,
          cor: isQuinzenal ? EVENT_COLORS.feedback : EVENT_COLORS.checkshape,
          agendamento: ag,
          formulario: formMaisRecente,
          ultimaMensagem: respIA,
        });
      });

  if (sameDay(day, todayISO())) {
      jobsFeedbackHoje.forEach((j) => {
        if (!j.aluno_id) return;
        const a = alunosMap.get(j.aluno_id);
        const isMensal = j.tipo === "d30" || j.tipo === "feedback_mensal_link";
        const isPontoContato = j.tipo === "followup_d7" || j.tipo === "followup_d21" || j.tipo === "pos_entrega_d1";
        const isLembrete = j.tipo === "feedback_link_lembrete";
        const status: AtividadeStatus = j.executado ? "confirmado" : (j.agendado_para < new Date().toISOString() ? "pendente" : "agendado");
        out.push({
          key: `job-${j.id}`,
          categoria: isPontoContato ? "ponto_contato" : "feedback",
          tipoLabel: isPontoContato
            ? (j.tipo === "followup_d21" ? "Ponto de Contato D+21" : j.tipo === "followup_d7" ? "Ponto de Contato D+7" : "Pós-entrega D+1")
            : isLembrete
              ? "Lembrete de Feedback"
              : isMensal ? "Feedback Mensal" : "Feedback Quinzenal",
          status,
          alunoId: j.aluno_id,
          alunoNome: a?.nome ?? "—",
          modalidade: a?.modalidade ?? null,
          whatsapp: a?.whatsapp ?? null,
          cor: isPontoContato ? EVENT_COLORS.ponto_contato : isMensal ? EVENT_COLORS.checkshape : EVENT_COLORS.feedback,
          promptTipo: isPontoContato ? j.tipo : undefined,
        });
      });
    }

  // 3) Pontos de contato
  alunosAtivos.forEach((a) => {
      if (!a.primeira_entrega_em) return;
      pontosContato.forEach((pc) => {
        const base = new Date(a.primeira_entrega_em!);
        const target = new Date(base.getTime() + pc.gatilho_valor * 24 * 60 * 60 * 1000);
        const targetKey = target.toISOString().slice(0, 10);
        if (targetKey !== day) return;
        const log = ultimaMsg(a.id, pc.prompt_tipo);
        let status: AtividadeStatus = "agendado";
        if (log) {
          if (log.status_envio === "enviado") status = "confirmado";
          else if (log.status_envio === "erro") status = "atrasado";
        } else if (targetKey < todayISO()) {
          status = "atrasado";
        }
        out.push({
          key: `pc-${pc.id}-${a.id}`,
          categoria: "ponto_contato",
          tipoLabel: pc.prompt_tipo === "followup_d7" ? "Ponto de Contato D+7" : "Ponto de Contato D+21",
          status,
          alunoId: a.id,
          alunoNome: a.nome,
          modalidade: a.modalidade,
          whatsapp: a.whatsapp,
          cor: EVENT_COLORS.ponto_contato,
          pontoContatoId: pc.id,
          promptTipo: pc.prompt_tipo,
          ultimaMensagem: log,
        });
      });
    });

  // 4) Renovações
  alunosAtivos.forEach((a) => {
      if (!a.data_expiracao) return;
      if (!sameDay(a.data_expiracao, day)) return;
      const venceu = a.data_expiracao < new Date().toISOString();
      const status: AtividadeStatus = venceu ? "atrasado" : "pendente";
      out.push({
        key: `ren-${a.id}`,
        categoria: "renovacao",
        tipoLabel: "Renovação",
        status,
        alunoId: a.id,
        alunoNome: a.nome,
        modalidade: a.modalidade,
        whatsapp: a.whatsapp,
        cor: EVENT_COLORS.renovacao,
      });
    });

  return out;
}

function AtividadeItem({ at, dataLabel, onClick }: { at: Atividade; dataLabel: string; onClick: () => void }) {
  const fone = (at.whatsapp || "").replace(/\D/g, "");
  const showWa =
    !!fone && (at.categoria === "feedback" || at.categoria === "ponto_contato");
  const waText =
    at.categoria === "feedback"
      ? `Olá ${at.alunoNome.split(" ")[0]}, tudo bem? Passando aqui sobre o seu ${at.tipoLabel.toLowerCase()}. 💪`
      : `Olá ${at.alunoNome.split(" ")[0]}, tudo bem? Passando para fazer um check com você. 💪`;
  const waUrl = showWa ? `https://wa.me/${fone}?text=${encodeURIComponent(waText)}` : null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className="w-full text-left relative flex items-center gap-2.5 sm:gap-3 rounded-xl border border-border bg-card pl-3.5 pr-3 py-2.5 overflow-hidden hover:bg-accent/40 transition-colors shadow-sm cursor-pointer"
    >
      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ backgroundColor: at.cor }} />
      <div className="shrink-0 h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${at.cor}1A` }}>
        <UserIcon className="h-4 w-4" style={{ color: at.cor }} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="block text-sm font-semibold tracking-tight text-foreground break-words leading-tight">
          {at.alunoNome}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
          <ModalidadeTag m={at.modalidade} />
          <span className="text-[11px] text-muted-foreground">{at.tipoLabel}</span>
          <span className="text-muted-foreground/50 text-[11px]">·</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
            <CalIcon className="h-2.5 w-2.5" />{dataLabel}
          </span>
        </div>
      </div>
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Enviar WhatsApp"
          aria-label="Enviar WhatsApp"
          className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 shrink-0"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </a>
      )}
      <span className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[11px] font-medium shrink-0 ${statusClasses(at.status)}`}>
        {at.status === "confirmado"
          ? <Check className="h-3 w-3" strokeWidth={3} />
          : <Clock className="h-3 w-3" />}
        {STATUS_LABEL[at.status]}
      </span>
    </div>
  );
}

/* ---------------- Bloco: Próximas Atualizações (próximos 7 dias) ---------------- */
function ProximasAtualizacoesBlock({
  entregas, formularios, agendamentos, mensagensLog,
  alunosAtivos, pontosContato, canEdit, userLabel, onChanged,
}: {
  entregas: Entrega[];
  formularios: FormRow[];
  agendamentos: AgendamentoRow[];
  mensagensLog: MensagemLogRow[];
  alunosAtivos: AlunoAtivoRow[];
  pontosContato: PontoContatoRow[];
  canEdit: boolean; userLabel: string; onChanged: () => void;
}) {
  const [aberta, setAberta] = useState<Atividade | null>(null);
  const [diasMostrados, setDiasMostrados] = useState(7);

  const grupos = useMemo(() => {
    const todayKey = todayISO();
    const out: { day: string; atividades: Atividade[] }[] = [];
    for (let i = 1; i <= diasMostrados; i++) {
      const d = new Date(todayKey + "T00:00:00");
      d.setDate(d.getDate() + i);
      const dayKey = d.toISOString().slice(0, 10);
      const atividades = buildAtividadesParaDia({
        day: dayKey, entregas, formularios, agendamentos,
        jobsFeedbackHoje: [], mensagensLog, alunosAtivos, pontosContato,
      });
      if (atividades.length > 0) out.push({ day: dayKey, atividades });
    }
    return out;
  }, [diasMostrados, entregas, formularios, agendamentos, mensagensLog, alunosAtivos, pontosContato]);

  const total = grupos.reduce((acc, g) => acc + g.atividades.length, 0);

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Próximas Atualizações</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Atividades dos próximos {diasMostrados} dias</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground shrink-0">
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="font-medium">{total} {total === 1 ? "atividade" : "atividades"}</span>
        </div>
      </div>

      {grupos.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma atividade nos próximos dias</div>
      ) : (
        <div className="space-y-5">
          {grupos.map((g) => (
            <div key={g.day}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-bold text-foreground">{formatDataLonga(g.day)}</h3>
                <span className="text-xs text-muted-foreground">· {g.atividades.length}</span>
              </div>
              <ul className="space-y-2">
                {g.atividades.map((at) => (
                  <li key={`${g.day}-${at.key}`}>
                    <AtividadeItem at={at} dataLabel={formatDataCurta(g.day)} onClick={() => setAberta(at)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {diasMostrados < 30 && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setDiasMostrados((d) => Math.min(d + 7, 30))}
            className="text-xs font-semibold text-primary hover:opacity-80"
          >
            Carregar mais dias
          </button>
        </div>
      )}

      {aberta && (
        <AtividadeDetalheModal
          atividade={aberta}
          onClose={() => setAberta(null)}
          canEdit={canEdit}
          userLabel={userLabel}
          onChanged={() => { onChanged(); setAberta(null); }}
        />
      )}
    </section>
  );
}

function AtividadeDetalheModal({
  atividade, onClose, canEdit, userLabel, onChanged,
}: {
  atividade: Atividade;
  onClose: () => void;
  canEdit: boolean;
  userLabel: string;
  onChanged: () => void;
}) {
  const enviarPC = useServerFn(enviarPontoContatoZapi);
  const gerarPC = useServerFn(gerarMensagemPontoContato);
  const gerarRespostaFn = useServerFn(gerarRespostaFormulario);
  const [busy, setBusy] = useState<string | null>(null);
  const [showResposta, setShowResposta] = useState(false);
  const [iaModal, setIaModal] = useState<{ tipo: string; mensagem: string } | null>(null);
  const [iaError, setIaError] = useState<string | null>(null);

  const TIPOS_IA = new Set(["anamnese", "feedback_mensal", "feedback_quinzenal"]);

  async function handleGerarIA() {
    if (!atividade.formulario) return;
    setIaError(null);
    setBusy("ia");
    try {
      const r = await gerarRespostaFn({ data: { formularioId: atividade.formulario.id } });
      if (r?.error || !r?.mensagem) {
        setIaError(r?.error ?? "Falha ao gerar resposta");
      } else {
        setIaModal({ tipo: atividade.formulario.tipo, mensagem: r.mensagem });
      }
    } catch (e) {
      setIaError(e instanceof Error ? e.message : "Falha ao gerar resposta");
    } finally {
      setBusy(null);
    }
  }

  const fone = (atividade.whatsapp || "").replace(/\D/g, "");
  const waUrl = fone ? `https://wa.me/${fone}` : null;

  async function handleReenviar() {
    if (!atividade.pontoContatoId || !atividade.alunoId) return;
    setBusy("reenviar");
    try {
      const r = await enviarPC({ data: { pontoId: atividade.pontoContatoId, alunoId: atividade.alunoId } });
      if (r.ok) {
        toast.success("Mensagem reenviada via WhatsApp");
        onChanged();
      } else {
        toast.error(r.error ?? "Falha ao enviar");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setBusy(null);
    }
  }

  async function handleGerarPreview() {
    if (!atividade.pontoContatoId) return;
    const janelaWhatsApp = waUrl ? abrirJanelaPreparandoWhatsApp() : null;
    setBusy("preview");
    try {
      const r = await gerarPC({ data: { pontoId: atividade.pontoContatoId, alunoId: atividade.alunoId } });
      if (r.mensagem && waUrl) {
        abrirWhatsAppUrl(`${waUrl}?text=${encodeURIComponent(r.mensagem)}`, janelaWhatsApp);
      } else if (r.error) {
        fecharJanelaPreparando(janelaWhatsApp);
        toast.error(r.error);
      } else {
        fecharJanelaPreparando(janelaWhatsApp);
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleMarcarResolvido(field: "dieta_entregue" | "treino_entregue") {
    if (!atividade.entrega) return;
    setBusy(field);
    const stamp = new Date().toISOString();
    const payload: Record<string, unknown> = field === "dieta_entregue"
      ? { dieta_entregue: true, dieta_entregue_em: stamp, dieta_entregue_por: userLabel }
      : { treino_entregue: true, treino_entregue_em: stamp, treino_entregue_por: userLabel };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("entregas_dia").update(payload as any).eq("id", atividade.entrega.id);
    setBusy(null);
    toast.success("Atividade marcada como entregue");
    onChanged();
  }

  // Última mensagem
  const ultMsg = atividade.ultimaMensagem;
  const dataPrevista = atividade.entrega?.data_referencia
    ?? atividade.formulario?.respondido_em
    ?? atividade.agendamento?.proximo_envio_em
    ?? null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-stretch justify-end px-safe" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border-l border-border h-full overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold">{atividade.alunoNome}</h3>
              <ModalidadeTag m={atividade.modalidade} />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{atividade.tipoLabel}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground">Status</div>
              <span className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full font-semibold mt-1 ${statusClasses(atividade.status)}`}>
                {STATUS_LABEL[atividade.status]}
              </span>
            </div>
            <div>
              <div className="text-muted-foreground">Data prevista</div>
              <div className="text-foreground font-medium mt-1">{dataPrevista ? fmtDate(dataPrevista) : "—"}</div>
            </div>
          </div>

          {ultMsg?.mensagem_enviada && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Última mensagem enviada</h4>
              <p className="text-xs whitespace-pre-wrap text-foreground">{ultMsg.mensagem_enviada}</p>
              <p className="text-[10px] text-muted-foreground mt-2">{fmtDate(ultMsg.enviado_em)} · {ultMsg.status_envio ?? "—"}</p>
            </div>
          )}

          <div className="space-y-2">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full h-10 rounded-md bg-primary text-white text-sm font-semibold hover:bg-primary"
              >
                <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
              </a>
            )}

            {atividade.categoria === "ponto_contato" && canEdit && (
              <>
                <button
                  onClick={handleReenviar}
                  disabled={busy !== null}
                  className="flex items-center justify-center gap-2 w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                >
                  <Send className="h-4 w-4" /> {busy === "reenviar" ? "Enviando..." : "Reenviar pela IA + Z-API"}
                </button>
                <button
                  onClick={handleGerarPreview}
                  disabled={busy !== null || !waUrl}
                  className="flex items-center justify-center gap-2 w-full h-10 rounded-md border border-border text-sm font-medium hover:bg-accent disabled:opacity-60"
                >
                  <Eye className="h-4 w-4" /> {busy === "preview" ? "Gerando..." : "Gerar prévia e abrir WhatsApp"}
                </button>
              </>
            )}

            {atividade.categoria === "entrega" && canEdit && atividade.entrega && (
              <div className="space-y-2">
                <button
                  onClick={() => handleMarcarResolvido("dieta_entregue")}
                  disabled={atividade.entrega.dieta_entregue || busy !== null}
                  className="flex items-center justify-center gap-2 w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                >
                  <Check className="h-4 w-4" /> {atividade.entrega.dieta_entregue ? "Dieta já entregue" : "Marcar dieta entregue"}
                </button>
                <button
                  onClick={() => handleMarcarResolvido("treino_entregue")}
                  disabled={atividade.entrega.treino_entregue || busy !== null}
                  className="flex items-center justify-center gap-2 w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                >
                  <Check className="h-4 w-4" /> {atividade.entrega.treino_entregue ? "Treino já entregue" : "Marcar treino entregue"}
                </button>
              </div>
            )}

            {atividade.categoria === "feedback" && atividade.formulario && (
              <>
                {Boolean(atividade.formulario.dados_resposta) && (
                  <a
                    href={`/formularios/${atividade.formulario.id}/respostas`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full h-10 rounded-md border border-border text-sm font-medium hover:bg-accent"
                  >
                    <Eye className="h-4 w-4" /> Visualizar resposta
                  </a>
                )}
                {atividade.formulario.respondido && TIPOS_IA.has(atividade.formulario.tipo) && (
                  <button
                    onClick={handleGerarIA}
                    disabled={busy !== null}
                    className="flex items-center justify-center gap-2 w-full h-10 rounded-md border border-primary/40 text-primary hover:bg-primary/5 text-sm font-semibold disabled:opacity-60"
                  >
                    {busy === "ia" ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> Gerar resposta com IA</>
                    )}
                  </button>
                )}
                {iaError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {iaError}
                    <button onClick={() => setIaError(null)} className="ml-2 underline">Fechar</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {showResposta && atividade.formulario && (
          <RespostaModal
            form={atividade.formulario}
            alunoNome={atividade.alunoNome}
            onClose={() => setShowResposta(false)}
          />
        )}

        {iaModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 px-safe" onClick={() => setIaModal(null)}>
            <div
              className="bg-card rounded-lg border border-border shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Resposta IA — {atividade.tipoLabel}</h3>
                </div>
                <button onClick={() => setIaModal(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-5 py-4 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                {iaModal.mensagem}
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
                <button
                  onClick={() => navigator.clipboard.writeText(iaModal.mensagem)}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted"
                >
                  <Copy className="h-3 w-3" /> Copiar
                </button>
                {waUrl && (
                  <a
                    href={`https://wa.me/${fone}?text=${encodeURIComponent(iaModal.mensagem)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    <MessageCircle className="h-3 w-3" /> Enviar no WhatsApp
                  </a>
                )}
                <button
                  onClick={() => setIaModal(null)}
                  className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RespostaModal({ form, alunoNome, onClose }: { form: FormRow; alunoNome: string; onClose: () => void }) {
  const dados = form.dados_resposta as Record<string, unknown> | null;
  const isFbQuinzenal = form.tipo === "feedback_quinzenal" && dados && typeof dados === "object" &&
    ((dados as any).identificacao || (dados as any).evolucao || (dados as any).recuperacao);
  const isFbMensal = form.tipo === "feedback_mensal" && dados && typeof dados === "object" &&
    ((dados as any).identificacao || (dados as any).evolucao || (dados as any).recuperacao || (dados as any).fotos);
  const FB_LABELS: Record<string, { titulo: string; campos: Record<string, string> }> = {
    identificacao: { titulo: "Identificação", campos: { nome: "Nome", telefone: "Telefone", peso_atual_kg: "Peso atual (kg)" } },
    evolucao: { titulo: "Evolução e percepção", campos: { sentimento: "Como tem se sentido", espelho: "Espelho", mudancas_fisico: "Mudanças no físico", comentarios_externos: "Comentários externos" } },
    foco_4_semanas: { titulo: "Foco 4 semanas", campos: { foco: "Foco" } },
    treino: { titulo: "Treino", campos: { adesao: "Adesão", dificuldades: "Dificuldades", sentimento: "Como se sente" } },
    dieta: { titulo: "Dieta", campos: { adesao: "Adesão", finais_de_semana: "Finais de semana", sentimento: "Como se sente" } },
    recuperacao: { titulo: "Recuperação", campos: { sono: "Sono", agua: "Água", intestino: "Intestino" } },
  };
  const FB_MENSAL_LABELS: Record<string, { titulo: string; campos: Record<string, string> }> = {
    identificacao: { titulo: "Identificação", campos: { nome: "Nome", telefone: "Telefone" } },
    evolucao: { titulo: "Evolução e percepção", campos: { sentimento: "Como tem se sentido", espelho: "Espelho", mudancas_fisico: "Mudanças no físico", comentarios_externos: "Comentários externos" } },
    foco_4_semanas: { titulo: "Foco 4 semanas", campos: { foco: "Foco" } },
    treino: { titulo: "Treino", campos: { adesao: "Adesão", dificuldades: "Dificuldades", sentimento: "Como se sente" } },
    dieta: { titulo: "Dieta", campos: { adesao: "Adesão", dificuldades_3: "3 maiores dificuldades", novos_habitos: "Novos hábitos", manter: "Manter", ajustar: "Ajustar", finais_de_semana: "Finais de semana", sentimento: "Como se sente" } },
    recuperacao: { titulo: "Recuperação", campos: { sono: "Sono", descanso: "Descanso ao acordar", agua: "Água", intestino: "Intestino" } },
  };
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 px-safe">
      <div className="w-full max-w-2xl bg-card border border-border rounded-lg p-5 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">{alunoNome}</h3>
            <p className="text-xs text-muted-foreground">{form.tipo}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        {!dados ? (
          <div className="text-sm text-muted-foreground">Sem dados</div>
        ) : isFbQuinzenal ? (
          <div className="space-y-4">
            {Object.entries(FB_LABELS).map(([blockKey, def]) => {
              const block = (dados as any)[blockKey];
              if (!block || typeof block !== "object") return null;
              return (
                <div key={blockKey} className="rounded-md border border-border bg-muted/30 p-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{def.titulo}</h4>
                  <dl className="space-y-2">
                    {Object.entries(def.campos).map(([fk, fl]) => {
                      const v = block[fk];
                      if (v === undefined || v === null || v === "") return null;
                      return (
                        <div key={fk}>
                          <dt className="text-[11px] font-medium text-muted-foreground">{fl}</dt>
                          <dd className="text-sm whitespace-pre-wrap">{String(v)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              );
            })}
            {typeof (dados as any).espaco_livre === "string" && (dados as any).espaco_livre.trim() && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Espaço livre</h4>
                <p className="text-sm whitespace-pre-wrap">{(dados as any).espaco_livre}</p>
              </div>
            )}
          </div>
        ) : isFbMensal ? (
          <div className="space-y-4">
            {Object.entries(FB_MENSAL_LABELS).map(([blockKey, def]) => {
              const block = (dados as any)[blockKey];
              if (!block || typeof block !== "object") return null;
              return (
                <div key={blockKey} className="rounded-md border border-border bg-muted/30 p-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{def.titulo}</h4>
                  <dl className="space-y-2">
                    {Object.entries(def.campos).map(([fk, fl]) => {
                      const v = block[fk];
                      if (v === undefined || v === null || v === "") return null;
                      return (
                        <div key={fk}>
                          <dt className="text-[11px] font-medium text-muted-foreground">{fl}</dt>
                          <dd className="text-sm whitespace-pre-wrap">{String(v)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              );
            })}
            {(dados as any).fotos && typeof (dados as any).fotos === "object" && (
              ((dados as any).fotos.frente || (dados as any).fotos.costas || (dados as any).fotos.perfil_esquerdo) && (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Fotos de avaliação</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {(["frente", "costas", "perfil_esquerdo"] as const).map((slot) => {
                      const url = (dados as any).fotos[slot] as string | undefined;
                      const label = slot === "perfil_esquerdo" ? "Perfil esq." : slot === "costas" ? "Costas" : "Frente";
                      return <FotoSlotVisao key={slot} url={url || ""} label={label} />;
                    })}
                  </div>
                </div>
              )
            )}
            {typeof (dados as any).espaco_livre === "string" && (dados as any).espaco_livre.trim() && (
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Espaço livre</h4>
                <p className="text-sm whitespace-pre-wrap">{(dados as any).espaco_livre}</p>
              </div>
            )}
          </div>
        ) : (
          <dl className="space-y-3">
            {Object.entries(dados).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.replace(/_/g, " ")}</dt>
                <dd className="text-sm text-foreground whitespace-pre-wrap">{typeof v === "string" ? v : JSON.stringify(v, null, 2)}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

/* ---------------- Bloco 3: Atrasadas ---------------- */
function AtrasadasBlock({
  atrasadas, canEdit, isAdmin, userLabel, onChanged, onPatchEntrega,
}: {
  atrasadas: Entrega[]; canEdit: boolean; isAdmin: boolean; userLabel: string; onChanged: () => void;
  onPatchEntrega: (id: string, partial: Partial<Entrega>) => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Atrasadas</h2>
          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2.5 rounded-full bg-primary text-white text-xs font-bold">{atrasadas.length}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-primary shrink-0">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="font-medium">requer atenção</span>
        </div>
      </div>
      <div className="space-y-3">
        {atrasadas.map((e) => (
          <EntregaCard key={e.id} entrega={e} canEdit={canEdit} isAdmin={isAdmin} userLabel={userLabel} onChanged={onChanged} onPatchEntrega={onPatchEntrega} atrasada />
        ))}
      </div>
    </section>
  );
}

function VisaoGeralSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-pulse">
      <div className="lg:col-span-2 space-y-3">
        <div className="h-72 rounded-lg bg-muted/50" />
        <div className="h-12 rounded-lg bg-muted/40" />
      </div>
      <div className="lg:col-span-3 space-y-4">
        <div className="h-32 rounded-lg bg-muted/50" />
        <div className="h-48 rounded-lg bg-muted/40" />
        <div className="h-48 rounded-lg bg-muted/30" />
      </div>
    </div>
  );
}
