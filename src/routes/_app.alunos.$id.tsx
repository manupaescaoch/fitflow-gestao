import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_LABEL, MODALIDADE_LABEL, fmtDate, fmtDateTime, diasRestantes,
  logStatusChange,
  SERVICO_LABEL,
  type Aluno, type Modalidade, type Status, type ServicoContratado,
} from "@/lib/crm";
import { useAuth } from "@/lib/auth";
import {
  ArrowLeft, CheckCircle2, Clock as ClockIcon, AlertCircle, Save, Home, ChevronRight,
  UtensilsCrossed, Dumbbell, ClipboardList,
  FileText, MessageSquare, Wallet, History,
  User as UserIcon, Copy, Lock, PlusCircle, Camera, Pencil, X,
  MoreVertical, FileDown, Pill as PillIcon, Plus, MoreHorizontal, LayoutGrid,
} from "lucide-react";
import { TreinoTab } from "@/components/aluno/TreinoTab";
import { DietaSection } from "@/components/aluno/dieta/DietaSection";
import { DietaOverview } from "@/components/aluno/dieta/DietaOverview";
import { MensagemNutricionalCard } from "@/components/aluno/dieta/MensagemNutricionalCard";
import { PrescricoesSection } from "@/components/aluno/PrescricoesSection";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import type { DietaHeaderActions } from "@/components/aluno/dieta/DietaCockpit";
import { FotosSection } from "@/components/aluno/FotosSection";
import { AvaliacaoFisicaTab } from "@/components/aluno/AvaliacaoFisicaTab";
import { HistoricoEntregasSection } from "@/components/aluno/HistoricoEntregasSection";
import { Sparkles, Loader2 } from "lucide-react";
import { RespostasLegivel } from "@/components/aluno/RespostasLegivel";
import { useServerFn } from "@tanstack/react-start";
import { gerarRespostaFormulario } from "@/server/feedback.functions";
import { AlertasInteligentes } from "@/components/aluno/dieta/AlertasInteligentes";
import { HistoricoRecenteCard } from "@/components/aluno/dieta/HistoricoRecenteCard";
import { SaudeAlunoCard } from "@/components/aluno/SaudeAlunoCard";
import { ProximasInformacoesCard } from "@/components/aluno/ProximasInformacoesCard";
import { StickyAlunoHeader } from "@/components/aluno/StickyAlunoHeader";
import { AcessoAppCard } from "@/components/aluno/AcessoAppCard";
import { Calendar, Clock, Cake, Ruler, Scale, Activity, MessageCircle } from "lucide-react";
import { usePlanosCatalogo, formatPlanoOption } from "@/lib/planos-catalogo";
import { filtrarFormulariosVisiveis } from "@/lib/formularios-filtro";
import { PerfilDashboard } from "@/components/aluno/perfil-dashboard/PerfilDashboard";
import { AlunoAvatar } from "@/components/aluno/AlunoAvatar";
import { readCache, writeCache } from "@/lib/swr-cache";

const SECTION_KEYS = [
  "perfil","dieta","treino","prescricoes","formularios",
  "fotos","avaliacao","financeiro","historico",
] as const;

export const Route = createFileRoute("/_app/alunos/$id")({
  component: AlunoProfile,
});

type SectionKey =
  | "perfil" | "dieta" | "treino" | "prescricoes" | "formularios"
  | "fotos" | "avaliacao" | "financeiro" | "historico";

const SECTIONS: { key: SectionKey; label: string; icon: any }[] = [
  { key: "perfil", label: "Perfil", icon: UserIcon },
  { key: "dieta", label: "Dieta", icon: UtensilsCrossed },
  { key: "avaliacao", label: "Avaliação Física", icon: Activity },
  { key: "treino", label: "Treino", icon: Dumbbell },
  { key: "formularios", label: "Formulários", icon: ClipboardList },
  { key: "fotos", label: "Fotos", icon: Camera },
  { key: "financeiro", label: "Financeiro", icon: Wallet },
  { key: "historico", label: "Histórico", icon: History },
];

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</span>
      <span className="text-[13px] font-medium text-foreground tabular-nums">{value}</span>
    </span>
  );
}

function formatIdade(nasc: string | null | undefined): string {
  if (!nasc) return "—";
  const s = String(nasc).trim();
  let y = 0, mo = 0, da = 0;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (iso) { y = +iso[1]; mo = +iso[2]; da = +iso[3]; }
  else if (br) { da = +br[1]; mo = +br[2]; y = +br[3]; }
  else { const d = new Date(s); if (isNaN(d.getTime())) return "—"; y = d.getFullYear(); mo = d.getMonth() + 1; da = d.getDate(); }
  const now = new Date();
  let age = now.getFullYear() - y;
  const passou = now.getMonth() + 1 > mo || (now.getMonth() + 1 === mo && now.getDate() >= da);
  if (!passou) age -= 1;
  return age >= 0 && age < 130 ? `${age} anos` : "—";
}

function formatIMC(peso: number | null | undefined, alturaCm: number | null | undefined): string {
  if (!peso || !alturaCm) return "—";
  const m = alturaCm / 100;
  if (m <= 0) return "—";
  return (peso / (m * m)).toFixed(1).replace(".", ",");
}

function AlunoProfile() {
  const { id } = Route.useParams();
  const { canEdit, isAdmin, isConsultor, crmUser } = useAuth();
  const canSeeFinanceiroTab = isAdmin || isConsultor;
  const cacheKey = `aluno-perfil:${id}`;
  const cached = readCache<{ aluno: Aluno | null; forms: any[]; logs: any[]; hist: any[]; jobs: any[]; comunicacoes: any[] }>(cacheKey);
  const [aluno, setAluno] = useState<Aluno | null>(cached?.aluno ?? null);
  const [forms, setForms] = useState<any[]>(cached?.forms ?? []);
  const [logs, setLogs] = useState<any[]>(cached?.logs ?? []);
  const [hist, setHist] = useState<any[]>(cached?.hist ?? []);
  const [jobs, setJobs] = useState<any[]>(cached?.jobs ?? []);
  const [comunicacoes, setComunicacoes] = useState<any[]>(cached?.comunicacoes ?? []);
  const STORAGE_KEY = `aluno:${id}:tab`;
  const HASH_RE = /^#tab=([a-z]+)$/;
  const readInitial = (): SectionKey => {
    if (typeof window === "undefined") return "perfil";
    const m = window.location.hash.match(HASH_RE);
    const fromHash = m?.[1];
    if (fromHash && (SECTION_KEYS as readonly string[]).includes(fromHash)) return fromHash as SectionKey;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && (SECTION_KEYS as readonly string[]).includes(stored)) return stored as SectionKey;
    return "perfil";
  };
  const [active, setActiveState] = useState<SectionKey>(readInitial);
  const setActive = (key: SectionKey) => {
    setActiveState(key);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, key);
      const newHash = key === "perfil" ? "" : `#tab=${key}`;
      const url = window.location.pathname + window.location.search + newHash;
      window.history.replaceState(null, "", url);
    }
  };
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [dietaActions, setDietaActions] = useState<DietaHeaderActions | null>(null);
  const [editPerfilOpen, setEditPerfilOpen] = useState(false);

  useEffect(() => {
    function open() { setEditPerfilOpen(true); }
    window.addEventListener("aluno-open-edit", open);
    return () => window.removeEventListener("aluno-open-edit", open);
  }, []);

  useEffect(() => { void load(); }, [id]);

  // Realtime: refletir mudanças do aluno (ex: foto_url) em todos os cabeçalhos
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`aluno-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "alunos", filter: `id=eq.${id}` },
        (payload) => {
          setAluno((prev) => (prev ? ({ ...prev, ...(payload.new as any) } as Aluno) : (payload.new as Aluno)));
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [id]);

  useEffect(() => {
    if (!addMenuOpen) return;
    function onClick(e: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [addMenuOpen]);

  // Bloquear acesso à seção financeiro para perfis que não podem ver
  useEffect(() => {
    if (active === "financeiro" && !canSeeFinanceiroTab) setActive("perfil");
  }, [active, canSeeFinanceiroTab]);

  const visibleSections = canSeeFinanceiroTab
    ? SECTIONS
    : SECTIONS.filter((s) => s.key !== "financeiro");

  async function load() {
    const [{ data: a }, { data: f }, { data: l }, { data: h }, { data: j }, { data: c }] = await Promise.all([
      supabase.from("alunos").select("*").eq("id", id).single(),
      supabase.from("formularios").select("*").eq("aluno_id", id).order("criado_em", { ascending: false }),
      supabase.from("mensagens_log").select("*").eq("aluno_id", id).order("enviado_em", { ascending: false }),
      supabase.from("historico_status").select("*").eq("aluno_id", id).order("criado_em", { ascending: false }),
      supabase.from("jobs_disparos").select("*").eq("aluno_id", id).order("agendado_para", { ascending: true }),
      supabase.from("comunicacoes" as any).select("*").eq("aluno_id", id).order("enviado_em", { ascending: false }),
    ]);
    const next = {
      aluno: a as Aluno,
      forms: f ?? [], logs: l ?? [], hist: h ?? [], jobs: j ?? [], comunicacoes: (c as any[]) ?? [],
    };
    setAluno(next.aluno);
    setForms(next.forms); setLogs(next.logs); setHist(next.hist); setJobs(next.jobs); setComunicacoes(next.comunicacoes);
    writeCache(cacheKey, next);
  }

  async function changeField<K extends keyof Aluno>(field: K, value: Aluno[K]) {
    if (!aluno) return;
    const old = aluno[field];
    setAluno({ ...aluno, [field]: value });
    const updatePayload: Record<string, any> = { [field]: value };
    // Ao cancelar o aluno, expira o plano imediatamente (plano inativo)
    if (field === "status" && value === "cancelado") {
      updatePayload.data_expiracao = new Date().toISOString();
    }
    const { error } = await supabase.from("alunos").update(updatePayload as any).eq("id", id);
    if (error) { alert(error.message); setAluno({ ...aluno, [field]: old }); return; }
    if (field === "status") {
      await logStatusChange(id, String(old ?? ""), String(value ?? ""), crmUser?.nome ?? crmUser?.email ?? "usuario");
      void load();
    }
  }

  async function confirmarD0() {
    if (!aluno) return;
    const now = new Date();
    const exp = new Date(now.getTime() + (aluno.prazo_dias ?? 30) * 24 * 60 * 60 * 1000);
    const { error } = await supabase.from("alunos").update({
      data_d0: now.toISOString(), data_expiracao: exp.toISOString(), status: "ativo",
    }).eq("id", id);
    if (error) { alert(error.message); return; }
    await logStatusChange(id, aluno.status, "ativo", crmUser?.nome ?? crmUser?.email ?? "usuario");
    await load();
  }

  if (!aluno) return <div className="text-muted-foreground text-sm">Carregando...</div>;

  const dr = diasRestantes(aluno.data_expiracao);
  const statusPill = !aluno.data_d0
    ? { label: "Sem data de início", cls: "bg-muted text-muted-foreground" }
    : dr === null
      ? { label: "—", cls: "bg-muted text-muted-foreground" }
      : dr < 0
        ? { label: "Vencido", cls: "bg-primary/15 text-primary" }
        : dr < 5
          ? { label: `Vencendo em ${dr}d`, cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" }
          : { label: "Em dia", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };

  return (
    <div className="space-y-6">
      {/* Sticky header compacto (aparece ao rolar) */}
      <StickyAlunoHeader
        aluno={aluno}
        statusPill={statusPill}
        forms={forms}
        canEdit={canEdit}
        onWhatsApp={() => {
          const numero = (aluno.whatsapp || "").replace(/\D/g, "");
          window.open(numero ? `https://wa.me/${numero}` : `https://wa.me/`, "_blank", "noopener,noreferrer");
        }}
        onAdicionarFeedback={() => setActive("formularios")}
        onEditar={() => {
          setActive("perfil");
          setTimeout(() => window.dispatchEvent(new CustomEvent("aluno-open-edit")), 50);
        }}
      />

      {/* Mobile top: header + métricas + tabs */}
      <MobileAlunoTopBar
        aluno={aluno}
        statusPill={statusPill}
        canEdit={canEdit}
        onConfirmarD0={!aluno.data_d0 ? confirmarD0 : undefined}
        active={active}
        onChangeTab={setActive}
        visibleSections={visibleSections}
      />

      {/* Saúde do aluno — mobile (logo abaixo do menu/atalhos) */}
      <div className="md:hidden px-3">
        <SaudeAlunoCard alunoId={id} aluno={aluno} />
      </div>

      {/* Breadcrumb premium (desktop only) */}
      <div className="hidden md:flex rounded-2xl bg-card border border-border shadow-sm px-5 py-3 items-center gap-2 text-sm flex-wrap">
        <Link to="/visao-geral" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Visão geral
        </Link>
        <ChevronRight className="h-4 w-4 text-rose-500" />
        <Link to="/alunos" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <Home className="h-4 w-4" />
          Lista de alunos
        </Link>
        <ChevronRight className="h-4 w-4 text-rose-500" />
        <button
          onClick={() => setActive("perfil")}
          className={active === "perfil"
            ? "font-semibold text-foreground"
            : "text-muted-foreground hover:text-foreground"}
        >
          {aluno.nome}
        </button>
        {active !== "perfil" && (
          <>
            <ChevronRight className="h-4 w-4 text-rose-500" />
            <span className="font-semibold text-foreground">
              {SECTIONS.find((s) => s.key === active)?.label}
            </span>
          </>
        )}
      </div>

      {/* Header rico (estilo Dietbox) — exibido apenas na seção Dieta */}
      {active === "dieta" && (
      <div className="hidden md:flex rounded-2xl bg-card border border-border shadow-sm px-5 py-4 items-center gap-4 flex-wrap">
        <AlunoAvatar nome={aluno.nome} fotoUrl={(aluno as any).foto_url} className="h-12 w-12 text-base" />

        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[18px] font-semibold tracking-tight leading-tight text-foreground">{aluno.nome}</h1>
            {aluno.modalidade && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {MODALIDADE_LABEL[aluno.modalidade]}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {STATUS_LABEL[aluno.status]}
            </span>
            {active === "dieta" && dietaActions?.planoStatus && (
              <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                Plano {dietaActions.planoStatus}
              </span>
            )}
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusPill.cls}`}>{statusPill.label}</span>
          </div>

          <div className="flex items-center gap-x-5 gap-y-1 mt-1.5 flex-wrap text-[12px] text-muted-foreground">
            <HeaderMetric label="Idade" value={formatIdade(aluno.data_nascimento)} />
            <HeaderMetric label="Altura" value={aluno.altura_cm ? `${(aluno.altura_cm / 100).toFixed(2).replace(".", ",")} m` : "—"} />
            <HeaderMetric label="Peso" value={aluno.peso_kg ? `${aluno.peso_kg} kg` : "—"} />
            <HeaderMetric label="IMC" value={formatIMC(aluno.peso_kg, aluno.altura_cm)} />
          </div>
        </div>

        {/* Ações contextuais da Dieta */}
        {active === "dieta" && dietaActions?.onGerarIA && (
          <button
            onClick={dietaActions.onGerarIA}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] text-foreground bg-card border border-border hover:bg-muted transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-600" /> Gerar com IA
          </button>
        )}
        {active === "dieta" && dietaActions?.onSalvarDieta && (
          <button
            onClick={dietaActions.onSalvarDieta}
            disabled={!!dietaActions.salvando}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-60 transition shadow-sm"
          >
            {dietaActions.salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Salvar dieta
          </button>
        )}
        {canEdit && !aluno.data_d0 && (
          <button onClick={confirmarD0} className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90">
            <CheckCircle2 className="h-4 w-4" /> Confirmar início
          </button>
        )}
        {canEdit && (
          <div className="relative" ref={addMenuRef}>
            <button
              onClick={() => setAddMenuOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary text-white px-5 py-2.5 text-sm font-semibold shadow-sm transition-colors"
            >
              <PlusCircle className="h-[18px] w-[18px]" />
              Adicionar
            </button>
            {addMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-100 bg-white shadow-lg overflow-hidden z-50">
                <button
                  onClick={() => {
                    setActive("dieta");
                    setAddMenuOpen(false);
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent("aluno-add-action", { detail: { tipo: "dieta" } }));
                    }, 50);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-colors text-left"
                >
                  <UtensilsCrossed className="h-4 w-4" />
                  Dieta
                </button>
                <button
                  onClick={() => {
                    setActive("dieta");
                    setAddMenuOpen(false);
                    setTimeout(() => {
                      window.dispatchEvent(new CustomEvent("aluno-add-action", { detail: { tipo: "prescricao" } }));
                    }, 50);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600 transition-colors text-left"
                >
                  <FileText className="h-4 w-4" />
                  Prescrições
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Body: sidebar + content */}
      <div className="grid gap-4 lg:gap-6 lg:grid-cols-[220px_1fr]">
        {/* Nav mobile: usa MobileAlunoTopBar acima — esta sub-nav fica oculta no mobile */}
        {/* Nav desktop: sidebar lateral */}
        <div className="hidden lg:flex lg:flex-col lg:gap-3 lg:sticky lg:top-4 h-fit">
          <nav className="rounded-xl border border-border bg-card p-2">
            {visibleSections.map((s) => {
              const Icon = s.icon;
              const isActive = active === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setActive(s.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                    isActive
                      ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {s.label}
                </button>
              );
            })}
          </nav>
          <SaudeAlunoCard alunoId={id} aluno={aluno} />
        </div>

        <div className="min-w-0">
          {active === "perfil" && (
            <PerfilDashboard
              aluno={aluno}
              alunoId={id}
              onEditar={() => window.dispatchEvent(new CustomEvent("aluno-open-edit"))}
            />
          )}
          {active === "dieta" && (
            <DietaSection
              alunoId={id}
              aluno={aluno}
              canEdit={canEdit}
              onActionsChange={(a) => setDietaActions(a ?? null)}
            />
          )}
          {active === "treino" && <TreinoTab alunoId={id} nomeAluno={aluno.nome} whatsapp={aluno.whatsapp} />}
          {active === "prescricoes" && <PrescricoesSection alunoId={id} aluno={aluno} canEdit={canEdit} />}
          {active === "formularios" && <FormulariosSection forms={forms} />}
          {active === "fotos" && <FotosSection alunoId={id} />}
          {active === "avaliacao" && <AvaliacaoFisicaTab alunoId={id} />}
          {active === "financeiro" && canSeeFinanceiroTab && (
            <FinanceiroSection
              aluno={aluno}
              dr={dr}
              canEdit={canSeeFinanceiroTab}
              onChange={changeField}
              id={id}
              load={load}
              setAluno={setAluno}
            />
          )}
          {active === "historico" && <HistoricoSection hist={hist} logs={logs} jobs={jobs} aluno={aluno} comunicacoes={comunicacoes} />}
        </div>
      </div>
      {editPerfilOpen && (
        <EditarPerfilModal
          aluno={aluno}
          isAdmin={isAdmin}
          canEdit={canEdit}
          onClose={() => setEditPerfilOpen(false)}
          onChange={changeField}
        />
      )}
    </div>
  );
}

/* ---------- Section components ---------- */

function PerfilSection({
  aluno, statusPill, dr, canEdit, isAdmin, onChange, alunoId, onGo,
}: {
  aluno: Aluno;
  statusPill: { label: string; cls: string };
  dr: number | null;
  canEdit: boolean;
  isAdmin: boolean;
  onChange: <K extends keyof Aluno>(f: K, v: Aluno[K]) => void;
  alunoId: string;
  onGo: (s: SectionKey) => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [obs, setObs] = useState(aluno.observacoes ?? "");
  const [obsSaved, setObsSaved] = useState<string | null>(null);
  const obsTimer = useRef<number | null>(null);

  useEffect(() => {
    function open() { setEditOpen(true); }
    window.addEventListener("aluno-open-edit", open);
    return () => window.removeEventListener("aluno-open-edit", open);
  }, []);

  function changeObs(v: string) {
    setObs(v); setObsSaved(null);
    if (obsTimer.current) window.clearTimeout(obsTimer.current);
    obsTimer.current = window.setTimeout(async () => {
      const { error } = await supabase.from("alunos").update({ observacoes: v }).eq("id", alunoId);
      setObsSaved(error ? `Erro: ${error.message}` : "Salvo");
    }, 800);
  }

  function abrirWhatsApp() {
    const numero = (aluno.whatsapp || "").replace(/\D/g, "");
    const url = numero ? `https://wa.me/${numero}` : `https://wa.me/`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const a = aluno as any;
  const valorFmt = aluno.valor_plano != null
    ? `R$ ${Number(aluno.valor_plano).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
    : "—";
  const ltv = (Number(aluno.valor_plano ?? 0) * (aluno.total_renovacoes + 1))
    .toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Header rico (desktop) */}
      <div className="hidden md:block">
        <PerfilHeaderRico
          aluno={aluno}
          statusPill={statusPill}
          canEdit={canEdit}
          isAdmin={isAdmin}
          onEditar={() => setEditOpen(true)}
          onWhatsApp={abrirWhatsApp}
          onAdicionarFeedback={() => onGo("formularios")}
          onAdicionarFoto={() => onGo("fotos")}
          onAjustarDieta={() => onGo("dieta")}
          onAjustarTreino={() => onGo("treino")}
          onPagamento={isAdmin ? () => onGo("financeiro") : undefined}
        />
      </div>

      {/* Mobile: card "Plano + Ações rápidas", linhas Plano/Prescrição, IA */}
      <div className="md:hidden">
        <MobilePerfilExtras
          aluno={aluno}
          alunoId={alunoId}
          canEdit={canEdit}
          isAdmin={isAdmin}
          onWhatsApp={abrirWhatsApp}
          onAdicionarFeedback={() => onGo("formularios")}
          onAjustarDieta={() => onGo("dieta")}
        />
      </div>

      {/* Faixa de alertas inteligentes */}
      <div className="hidden md:block">
        <AlertasInteligentes alunoId={alunoId} />
      </div>

      {/* Acesso ao app */}
      <AcessoAppCard alunoId={alunoId} />

      {/* Grid 2/3 + 1/3 */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Dados principais e Plano */}
          <div className="grid gap-4 md:grid-cols-2">
            <Section title="Dados principais" icon={UserIcon} iconTone="rose">
              <ul className="text-sm divide-y divide-border">
                <Row label="Nome" value={aluno.nome} />
                <Row label="WhatsApp" value={aluno.whatsapp} />
                <Row label="E-mail" value={aluno.email ?? "—"} />
                <Row label="CPF" value={aluno.cpf ?? "—"} />
                <Row label="Sexo" value={a.sexo ? String(a.sexo).replace(/^./, (c: string) => c.toUpperCase()) : "—"} />
                <Row label="Altura" value={aluno.altura_cm != null ? `${aluno.altura_cm} cm` : "—"} />
                <Row label="Peso atual" value={aluno.peso_kg != null ? `${aluno.peso_kg} kg` : "—"} />
                <Row label="Status" value={STATUS_LABEL[aluno.status]} />
              </ul>
            </Section>

            <Section title="Plano e acompanhamento" icon={Wallet} iconTone="amber">
              <ul className="text-sm divide-y divide-border">
                <Row label="Modalidade" value={aluno.modalidade ? MODALIDADE_LABEL[aluno.modalidade] : "—"} />
                <Row label="Plano" value={aluno.plano ?? "—"} />
                <Row label="Serviço contratado" value={(aluno as any).servico_contratado ? SERVICO_LABEL[(aluno as any).servico_contratado as ServicoContratado] : "—"} />
                {isAdmin && <Row label="Valor" value={valorFmt} />}
                <Row label="Início" value={aluno.data_d0 ? fmtDate(aluno.data_d0) : "Não confirmado"} />
                <Row
                  label="Dias restantes"
                  value={
                    aluno.data_d0 && dr !== null
                      ? (dr >= 0 ? `${dr} dias` : `Vencido há ${Math.abs(dr)} dias`)
                      : "—"
                  }
                />
                <Row label="Renovações" value={String(aluno.total_renovacoes)} />
                {isAdmin && (
                  <Row
                    label="LTV estimado"
                    value={`R$ ${ltv}`}
                    hint={`baseado em ${aluno.total_renovacoes} renovaç${aluno.total_renovacoes === 1 ? "ão" : "ões"}`}
                  />
                )}
              </ul>
            </Section>
          </div>

          {/* Observações internas */}
          <Section title="Observações internas" icon={Pencil} iconTone="violet">
            <textarea
              value={obs}
              onChange={(e) => changeObs(e.target.value)}
              disabled={!canEdit}
              rows={6}
              className="w-full bg-background border border-input rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Anotações privadas sobre o aluno..."
            />
            <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <Save className="h-3 w-3" /> {obsSaved ?? (canEdit ? "Salva automaticamente" : "Somente leitura")}
            </div>
          </Section>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <ProximasInformacoesCard alunoId={alunoId} aluno={aluno} />
          <HistoricoRecenteCard alunoId={alunoId} />
        </div>
      </div>

      {editOpen && (
        <EditarPerfilModal
          aluno={aluno}
          isAdmin={isAdmin}
          canEdit={canEdit}
          onClose={() => setEditOpen(false)}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <li className="py-2 flex items-baseline justify-between gap-3">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className="text-sm text-right">
        {value}
        {hint && <span className="block text-[11px] text-muted-foreground mt-0.5">{hint}</span>}
      </span>
    </li>
  );
}

function PerfilHeaderRico({
  aluno, statusPill, canEdit, isAdmin,
  onEditar, onWhatsApp, onAdicionarFeedback, onAdicionarFoto, onAjustarDieta, onAjustarTreino, onPagamento,
}: {
  aluno: Aluno;
  statusPill: { label: string; cls: string };
  canEdit: boolean;
  isAdmin: boolean;
  onEditar: () => void;
  onWhatsApp: () => void;
  onAdicionarFeedback: () => void;
  onAdicionarFoto: () => void;
  onAjustarDieta: () => void;
  onAjustarTreino: () => void;
  onPagamento?: () => void;
}) {
  const dr = diasRestantes(aluno.data_expiracao);
  const emDia = dr === null || dr > 7;
  const ativo = aluno.status === "ativo" || aluno.status === "renovado";
  const idade = formatIdade(aluno.data_nascimento);
  const imc = formatIMC(aluno.peso_kg, aluno.altura_cm);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-5 flex-wrap">
        {/* Avatar + identidade */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <AlunoAvatar nome={aluno.nome} fotoUrl={(aluno as any).foto_url} className="h-16 w-16 text-xl" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-slate-900 truncate">{aluno.nome}</h2>
              {aluno.modalidade && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                  {MODALIDADE_LABEL[aluno.modalidade]}
                </span>
              )}
              {(aluno as any).servico_contratado && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                  {SERVICO_LABEL[(aluno as any).servico_contratado as ServicoContratado]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs ${ativo ? "text-emerald-700" : "text-slate-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${ativo ? "bg-emerald-500" : "bg-slate-400"}`} />
                {STATUS_LABEL[aluno.status]}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs ${emDia ? "text-emerald-700" : "text-amber-700"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${emDia ? "bg-emerald-500" : "bg-amber-500"}`} />
                {emDia ? "Em dia" : (dr !== null && dr >= 0 ? `Vence em ${dr}d` : `Vencido há ${Math.abs(dr ?? 0)}d`)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusPill.cls}`}>{statusPill.label}</span>
            </div>
            <div className="flex items-center gap-4 mt-3 flex-wrap text-xs">
              <HeaderMini icon={Cake} label="Idade" value={idade} />
              <HeaderMini icon={Ruler} label="Altura" value={aluno.altura_cm ? `${(aluno.altura_cm / 100).toFixed(2).replace(".", ",")} m` : "—"} />
              <HeaderMini icon={Scale} label="Peso" value={aluno.peso_kg ? `${aluno.peso_kg} kg` : "—"} />
              <HeaderMini icon={Activity} label="IMC" value={imc} />
            </div>
          </div>
        </div>

        {/* Datas */}
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-muted-foreground">Início</span>
            <span className="font-medium text-slate-800">{aluno.data_d0 ? fmtDate(aluno.data_d0) : "Não confirmado"}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-muted-foreground">Vencimento</span>
            <span className="font-medium text-slate-800">{aluno.data_expiracao ? fmtDate(aluno.data_expiracao) : "—"}</span>
          </div>
        </div>

        {/* Ações rápidas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-slate-500">Ações rápidas</div>
            {canEdit && (
              <button
                onClick={onEditar}
                className="text-[11px] font-medium text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" /> Editar
              </button>
            )}
          </div>
          <div className={`grid gap-2 ${onPagamento ? "grid-cols-6" : "grid-cols-5"}`}>
            <QuickActionPill icon={MessageCircle} label="WhatsApp" tone="emerald" onClick={onWhatsApp} />
            <QuickActionPill icon={MessageSquare} label="Feedback" tone="violet" onClick={onAdicionarFeedback} />
            <QuickActionPill icon={Camera} label="Foto" tone="sky" onClick={onAdicionarFoto} />
            <QuickActionPill icon={UtensilsCrossed} label="Dieta" tone="rose" onClick={onAjustarDieta} />
            <QuickActionPill icon={Dumbbell} label="Treino" tone="amber" onClick={onAjustarTreino} />
            {onPagamento && <QuickActionPill icon={Wallet} label="Pagto" tone="rose" onClick={onPagamento} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderMini({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</span>
      <span className="text-[13px] font-medium text-slate-800 tabular-nums">{value}</span>
    </span>
  );
}

function QuickActionPill({
  icon: Icon, label, onClick, tone,
}: { icon: any; label: string; onClick: () => void; tone: "emerald" | "violet" | "sky" | "rose" | "amber" }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    sky: "bg-sky-50 text-sky-600",
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors min-w-[64px]"
    >
      <span className={`h-8 w-8 rounded-full flex items-center justify-center ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[10px] font-medium text-slate-600 text-center leading-tight">{label}</span>
    </button>
  );
}


function QuickAction({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:border-primary hover:text-primary transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function EditarPerfilModal({
  aluno, isAdmin, canEdit, onClose, onChange,
}: {
  aluno: Aluno;
  isAdmin: boolean;
  canEdit: boolean;
  onClose: () => void;
  onChange: <K extends keyof Aluno>(f: K, v: Aluno[K]) => void;
}) {
  const a = aluno as any;
  const [form, setForm] = useState({
    nome: aluno.nome,
    whatsapp: aluno.whatsapp,
    email: aluno.email ?? "",
    cpf: aluno.cpf ?? "",
    sexo: (a.sexo as string) ?? "",
    data_nascimento: aluno.data_nascimento ? String(aluno.data_nascimento).slice(0, 10) : "",
    altura_cm: aluno.altura_cm != null ? String(aluno.altura_cm) : "",
    peso_kg: aluno.peso_kg != null ? String(aluno.peso_kg) : "",
    status: aluno.status,
    modalidade: aluno.modalidade ?? "",
    servico_contratado: ((aluno as any).servico_contratado as string) ?? "",
  });
  const [busy, setBusy] = useState(false);

  async function salvar() {
    setBusy(true);
    try {
      if (isAdmin) {
        if (form.nome !== aluno.nome) onChange("nome", form.nome);
        if (form.whatsapp !== aluno.whatsapp) onChange("whatsapp", form.whatsapp);
        if ((form.email || null) !== (aluno.email ?? null)) onChange("email", (form.email || null) as any);
        if ((form.cpf || null) !== (aluno.cpf ?? null)) onChange("cpf", (form.cpf || null) as any);
        if ((form.modalidade || null) !== (aluno.modalidade ?? null)) {
          onChange("modalidade", (form.modalidade || null) as Modalidade);
        }
      }
      // sexo / altura / peso / status: edição permitida para canEdit
      const updates: Record<string, any> = {};
      if ((form.sexo || null) !== (a.sexo ?? null)) updates.sexo = form.sexo || null;
      const novaDtNasc = form.data_nascimento || null;
      if (novaDtNasc !== (aluno.data_nascimento ?? null)) updates.data_nascimento = novaDtNasc;
      const novaAlt = form.altura_cm ? Number(form.altura_cm) : null;
      if (novaAlt !== (aluno.altura_cm ?? null)) updates.altura_cm = novaAlt;
      const novoPeso = form.peso_kg ? Number(form.peso_kg) : null;
      if (novoPeso !== (aluno.peso_kg ?? null)) updates.peso_kg = novoPeso;
      if (isAdmin && (form.servico_contratado || null) !== ((aluno as any).servico_contratado ?? null)) {
        updates.servico_contratado = form.servico_contratado || null;
      }
      if (Object.keys(updates).length > 0) {
        await (supabase as any).from("alunos").update(updates).eq("id", aluno.id);
      }
      if (form.status !== aluno.status) onChange("status", form.status as Status);
      onClose();
      // forçar reload via mudança de status já chama load(); senão recarregar manualmente
      if (Object.keys(updates).length > 0 && form.status === aluno.status) {
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 px-safe" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-card border border-border shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Editar perfil do aluno</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 grid gap-4 sm:grid-cols-2 max-h-[70vh] overflow-y-auto">
          <Field label="Nome">
            <input value={form.nome} disabled={!isAdmin} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input" />
          </Field>
          <Field label="WhatsApp">
            <input value={form.whatsapp} disabled={!isAdmin} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="input" />
          </Field>
          <Field label="E-mail">
            <input value={form.email} disabled={!isAdmin} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
          </Field>
          <Field label="CPF">
            <input value={form.cpf} disabled={!isAdmin} onChange={(e) => setForm({ ...form, cpf: e.target.value })} className="input" />
          </Field>
          <Field label="Sexo">
            <select value={form.sexo} disabled={!canEdit} onChange={(e) => setForm({ ...form, sexo: e.target.value })} className="input">
              <option value="">—</option>
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
              <option value="outro">Outro</option>
            </select>
          </Field>
          <Field label="Data de nascimento">
            <input type="date" value={form.data_nascimento} disabled={!canEdit} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} className="input" />
          </Field>
          <Field label="Altura (cm)">
            <input type="number" step="0.1" value={form.altura_cm} disabled={!canEdit} onChange={(e) => setForm({ ...form, altura_cm: e.target.value })} className="input" />
          </Field>
          <Field label="Peso atual (kg)">
            <input type="number" step="0.1" value={form.peso_kg} disabled={!canEdit} onChange={(e) => setForm({ ...form, peso_kg: e.target.value })} className="input" />
          </Field>
          <Field label="Status">
            <select value={form.status} disabled={!canEdit} onChange={(e) => setForm({ ...form, status: e.target.value as Status })} className="input">
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Modalidade">
            <select value={form.modalidade} disabled={!isAdmin} onChange={(e) => setForm({ ...form, modalidade: e.target.value as Modalidade })} className="input">
              <option value="">—</option>
              <option value="mpteam">MPTEAM</option>
              <option value="mp_elite">MP Elite</option>
              <option value="mp_presencial">MP Presencial</option>
            </select>
          </Field>
          <Field label="Serviço contratado">
            <select value={form.servico_contratado} disabled={!isAdmin} onChange={(e) => setForm({ ...form, servico_contratado: e.target.value })} className="input">
              <option value="">—</option>
              <option value="treino_e_dieta">Treino e dieta</option>
              <option value="dieta">Dieta</option>
              <option value="treino">Treino</option>
            </select>
          </Field>
        </div>
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={busy || !canEdit} className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
        <style>{`.input{width:100%;background:var(--background);border:1px solid var(--input);padding:.5rem .75rem;border-radius:.375rem;font-size:.875rem;color:var(--foreground)} .input:disabled{opacity:.6;cursor:not-allowed}`}</style>
      </div>
    </div>
  );
}

function Section({
  title, action, children, icon: Icon, iconTone,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  icon?: any;
  iconTone?: "rose" | "amber" | "emerald" | "sky" | "violet";
}) {
  const tones: Record<string, string> = {
    rose: "bg-rose-50 text-rose-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    sky: "bg-sky-50 text-sky-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className={`h-8 w-8 rounded-lg flex items-center justify-center ${tones[iconTone ?? "rose"]}`}>
              <Icon className="h-4 w-4" />
            </span>
          )}
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ icon: Icon, title, subtitle, cta }: { icon: any; title: string; subtitle: string; cta: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-12 flex flex-col items-center text-center">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">{subtitle}</p>
      <button disabled className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary/60 text-primary-foreground px-4 py-2 text-sm font-semibold cursor-not-allowed opacity-70">
        <Lock className="h-3.5 w-3.5" /> {cta} <span className="text-[10px] uppercase tracking-wider opacity-80">em breve</span>
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <div className="text-sm">{children}</div>
    </label>
  );
}

const TIPO_LABEL: Record<string, string> = {
  anamnese: "Anamnese",
  feedback_quinzenal: "Feedback Quinzenal",
  feedback_mensal: "Feedback Mensal",
};

const TIPO_BADGE: Record<string, string> = {
  anamnese: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  feedback_quinzenal: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  feedback_mensal: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400",
};

function tipoLabel(t: string) {
  return TIPO_LABEL[t] ?? String(t).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

type FiltroFormulario = "todos" | "anamnese" | "feedback_quinzenal" | "feedback_mensal" | "outros";

function FormulariosSection({ forms }: { forms: any[] }) {
  const [filtro, setFiltro] = useState<FiltroFormulario>("todos");
  const gerarRespostaFn = useServerFn(gerarRespostaFormulario);
  const [iaLoadingId, setIaLoadingId] = useState<string | null>(null);
  const [iaModal, setIaModal] = useState<{ tipo: string; mensagem: string } | null>(null);
  const [iaError, setIaError] = useState<string | null>(null);

  const tiposComIA = new Set(["anamnese", "feedback_mensal", "feedback_quinzenal"]);

  async function gerarIA(formularioId: string, tipo: string) {
    setIaError(null);
    setIaLoadingId(formularioId);
    try {
      const res = await gerarRespostaFn({ data: { formularioId } });
      if (res?.error || !res?.mensagem) {
        setIaError(res?.error ?? "Falha ao gerar resposta");
      } else {
        setIaModal({ tipo, mensagem: res.mensagem });
      }
    } catch (e: any) {
      setIaError(e?.message ?? "Falha ao gerar resposta");
    } finally {
      setIaLoadingId(null);
    }
  }

  const conhecidos = new Set(["anamnese", "feedback_quinzenal", "feedback_mensal"]);
  // Oculta registros que são apenas fotos de avaliação carregadas avulsas.
  // Essas fotos aparecem na aba "Fotos", não na lista de formulários.
  // Regras e testes em src/lib/formularios-filtro.ts.
  const formsVisiveis = filtrarFormulariosVisiveis(forms);

  const counts = {
    todos: formsVisiveis.length,
    anamnese: formsVisiveis.filter((f) => f.tipo === "anamnese").length,
    feedback_quinzenal: formsVisiveis.filter((f) => f.tipo === "feedback_quinzenal").length,
    feedback_mensal: formsVisiveis.filter((f) => f.tipo === "feedback_mensal").length,
    outros: formsVisiveis.filter((f) => !conhecidos.has(f.tipo)).length,
  };

  const filtered = formsVisiveis
    .filter((f) => {
      if (filtro === "todos") return true;
      if (filtro === "outros") return !conhecidos.has(f.tipo);
      return f.tipo === filtro;
    })
    .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

  const chips: { key: FiltroFormulario; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: counts.todos },
    { key: "anamnese", label: "Anamnese", count: counts.anamnese },
    { key: "feedback_quinzenal", label: "Feedback Quinzenal", count: counts.feedback_quinzenal },
    { key: "feedback_mensal", label: "Feedback Mensal", count: counts.feedback_mensal },
  ];
  if (counts.outros > 0) chips.push({ key: "outros", label: "Outros", count: counts.outros });

  if (formsVisiveis.length === 0) {
    return <Empty icon={ClipboardList} title="Sem formulários" subtitle="Nenhuma anamnese ou feedback foi enviado para este aluno." cta="Enviar formulário" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {chips.map((c) => {
          const ativo = filtro === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setFiltro(c.key)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                ativo
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {c.label} <span className="opacity-70">({c.count})</span>
            </button>
          );
        })}
      </div>

      <Section title="Formulários do aluno">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum formulário neste filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 font-medium">Tipo</th>
                  <th className="text-left font-medium">Status</th>
                  <th className="text-left font-medium">Criado em</th>
                  <th className="text-left font-medium">Respondido em</th>
                  <th className="text-left font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => {
                  const url = f.link_publico ?? (typeof window !== "undefined" ? `${window.location.origin}/formularios/${f.token}` : `/formularios/${f.token}`);
                  const respostasUrl = `/formularios/${f.id}/respostas`;
                  const badgeCls = TIPO_BADGE[f.tipo] ?? "bg-muted text-muted-foreground";
                  return (
                    <tr key={f.id} className="border-b border-border/40">
                      <td className="py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeCls}`}>
                          {tipoLabel(f.tipo)}
                        </span>
                      </td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          f.respondido
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                        }`}>
                          {f.respondido ? "Respondido" : "Pendente"}
                        </span>
                      </td>
                      <td className="text-muted-foreground text-xs">{fmtDateTime(f.criado_em)}</td>
                      <td className="text-muted-foreground text-xs">{fmtDateTime(f.respondido_em)}</td>
                      <td>
                        <div className="flex items-center gap-2 flex-wrap">
                          {f.respondido ? (
                            <a
                              href={respostasUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 font-medium"
                            >
                              Ver respostas →
                            </a>
                          ) : (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border hover:bg-muted text-muted-foreground"
                            >
                              Abrir formulário
                            </a>
                          )}
                          <button
                            onClick={() => navigator.clipboard.writeText(url)}
                            className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-border hover:bg-muted text-muted-foreground"
                            title="Copiar link"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          {f.respondido && tiposComIA.has(f.tipo) && (
                            <button
                              onClick={() => gerarIA(f.id, f.tipo)}
                              disabled={iaLoadingId === f.id}
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-primary/40 text-primary hover:bg-primary/5 disabled:opacity-50"
                              title="Gerar resposta IA"
                            >
                              {iaLoadingId === f.id ? (
                                <><Loader2 className="h-3 w-3 animate-spin" /> Gerando...</>
                              ) : (
                                <><Sparkles className="h-3 w-3" /> Gerar resposta IA</>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {iaError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {iaError}
          <button onClick={() => setIaError(null)} className="ml-3 underline text-xs">Fechar</button>
        </div>
      )}

      {iaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 px-safe" onClick={() => setIaModal(null)}>
          <div
            className="bg-card rounded-lg border border-border shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Resposta IA — {tipoLabel(iaModal.tipo)}</h3>
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
  );
}

/* Renderiza dados_resposta de forma legível por blocos quando o JSON está no novo formato. */
/* RespostasLegivel agora vive em src/components/aluno/RespostasLegivel.tsx */

function addDaysISO(iso: string, dias: number): string {
  if (!iso || !dias) return iso;
  const ymd = iso.slice(0, 10);
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  if (Number.isNaN(dt.getTime())) return ymd;
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10);
}

function toYMD(v: string | null | undefined): string {
  if (!v) return "";
  // Aceita "YYYY-MM-DD" ou ISO completo "YYYY-MM-DDTHH:mm:ss..."
  return String(v).slice(0, 10);
}

function FinanceiroSection({
  aluno, dr, canEdit, onChange, id, load, setAluno
}: {
  aluno: Aluno;
  dr: number | null;
  canEdit: boolean;
  onChange: <K extends keyof Aluno>(field: K, value: Aluno[K]) => Promise<void> | void;
  id: string;
  load: () => Promise<void>;
  setAluno: React.Dispatch<React.SetStateAction<Aluno | null>>;
}) {
  const [editing, setEditing] = useState(false);
  const { planos, loading: planosLoading } = usePlanosCatalogo();
  const [planoMode, setPlanoMode] = useState<"catalogo" | "personalizado">("catalogo");
  const [draft, setDraft] = useState({
    plano: aluno.plano ?? "",
    plano_id: "" as string,
    modalidade: (aluno.modalidade ?? null) as Modalidade | null,
    valor_plano: aluno.valor_plano != null ? String(aluno.valor_plano) : "",
    data_compra: toYMD(aluno.data_compra),
    data_d0: toYMD(aluno.data_d0),
    data_expiracao: toYMD(aluno.data_expiracao),
    renovado: aluno.renovado,
    total_renovacoes: aluno.total_renovacoes,
    duracao_dias: 30 as number,
    status: aluno.status as Status,
    observacoes: (aluno.observacoes || "") as string,
  });
  const [saving, setSaving] = useState(false);

  // Recalcula vencimento automaticamente sempre que plano (do catálogo) ou data de início mudar
  useEffect(() => {
    if (!editing) return;
    const planoCat = planos.find((p) => p.id === draft.plano_id);
    if (!planoCat) return;
    const base = draft.data_d0;
    if (!base) return;
    const novaExp = addDaysISO(base, planoCat.duracao_dias);
    if (novaExp !== draft.data_expiracao || draft.duracao_dias !== planoCat.duracao_dias) {
      setDraft((d) => ({ ...d, data_expiracao: novaExp, duracao_dias: planoCat.duracao_dias }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, draft.plano_id, draft.data_d0, planos]);

  function start() {
    // Tenta detectar o plano atual no catálogo casando nome + valor + duração
    const expDias = aluno.data_d0 && aluno.data_expiracao
      ? Math.round((new Date(aluno.data_expiracao).getTime() - new Date(aluno.data_d0).getTime()) / 86_400_000)
      : null;
    const atualNoCatalogo = planos.find((p) =>
      p.nome === (aluno.plano ?? "")
      && (aluno.valor_plano == null || Number(p.valor_padrao) === Number(aluno.valor_plano))
      && (expDias == null || p.duracao_dias === expDias),
    ) ?? planos.find((p) => p.nome === (aluno.plano ?? ""));
    setDraft({
      plano: aluno.plano ?? "",
      plano_id: atualNoCatalogo?.id ?? "",
      modalidade: atualNoCatalogo?.modalidade ?? aluno.modalidade ?? null,
      valor_plano: aluno.valor_plano != null ? String(aluno.valor_plano) : "",
      data_compra: toYMD(aluno.data_compra),
      data_d0: toYMD(aluno.data_d0),
      data_expiracao: toYMD(aluno.data_expiracao),
      renovado: aluno.renovado,
      total_renovacoes: aluno.total_renovacoes,
      duracao_dias: 30,
      status: aluno.status,
      observacoes: aluno.observacoes || "",
    });
    setPlanoMode(atualNoCatalogo || !aluno.plano ? "catalogo" : "personalizado");
    if (atualNoCatalogo) {
      setDraft((d) => ({ ...d, duracao_dias: atualNoCatalogo.duracao_dias }));
    }
    setEditing(true);
  }

  async function salvar() {
    setSaving(true);
    try {
      const valRaw = String(draft.valor_plano).replace(",", ".");
      const valorNum = valRaw.trim() === "" ? null : Number(valRaw);
      const updates: Partial<Aluno> = {
        plano: draft.plano.trim() || null,
        modalidade: (draft.modalidade ?? null) as Aluno["modalidade"],
        valor_plano: (valorNum != null && Number.isFinite(valorNum) ? valorNum : null) as Aluno["valor_plano"],
        data_compra: (draft.data_compra || null) as Aluno["data_compra"],
        data_d0: (draft.data_d0 || null) as Aluno["data_d0"],
        data_expiracao: (draft.data_expiracao || null) as Aluno["data_expiracao"],
        renovado: draft.renovado,
        total_renovacoes: Number(draft.total_renovacoes) || 0,
        status: draft.status,
        observacoes: draft.observacoes,
      };

      setAluno((prev: any) => (prev ? { ...prev, ...updates } : prev));
      const { error } = await supabase.from("alunos").update(updates as any).eq("id", id);
      
      if (error) {
        alert("Erro ao salvar: " + error.message);
        void load();
      } else {
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  const action = canEdit ? (
    editing ? (
      <div className="flex gap-2">
        <button
          onClick={() => setEditing(false)}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" /> Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar
        </button>
      </div>
    ) : (
      <button
        onClick={start}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border hover:bg-muted"
      >
        <Pencil className="h-3.5 w-3.5" /> Editar
      </button>
    )
  ) : undefined;

  const headerInfo = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5" />
        <span>Início</span>
        <span className="font-medium text-foreground">
          {aluno.data_d0 ? fmtDate(aluno.data_d0) : "—"}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        <span>Vencimento</span>
        <span className="font-medium text-foreground">
          {aluno.data_expiracao ? fmtDate(aluno.data_expiracao) : "—"}
        </span>
      </div>
    </div>
  );

  if (!editing) {
    return (
      <Section title="Financeiro" action={action}>
        <div className="mb-4 pb-3 border-b border-border">{headerInfo}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Info label="Modalidade" value={aluno.modalidade ? MODALIDADE_LABEL[aluno.modalidade] : "—"} />
          <Info
            label="Plano"
            value={aluno.plano ?? (aluno.modalidade ? MODALIDADE_LABEL[aluno.modalidade] : "—")}
          />
          <Info
            label="Serviço contratado"
            value={(aluno as any).servico_contratado ? SERVICO_LABEL[(aluno as any).servico_contratado as ServicoContratado] : "—"}
          />
          <Info label="Valor" value={aluno.valor_plano ? `R$ ${Number(aluno.valor_plano).toFixed(2)}` : "—"} />
          <Info label="Data de início" value={fmtDate(aluno.data_d0)} />
          <Info label="Expira em" value={fmtDate(aluno.data_expiracao)} />
          <Info label="Dias restantes" value={dr !== null ? `${dr} dias` : "—"} highlight={dr !== null && dr < 5} />
          <Info label="Renovado" value={aluno.renovado ? "Sim" : "Não"} />
          <Info label="Total de renovações" value={String(aluno.total_renovacoes)} />
        </div>
      </Section>
    );
  }

  return (
    <Section title="Financeiro" action={action}>
      <div className="mb-4 pb-3 border-b border-border">{headerInfo}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        <EditField label="Plano">
          <select
            value={draft.plano_id}
            onChange={(e) => {
              const p = planos.find((x) => x.id === e.target.value);
              if (p) {
                const baseDate = draft.data_d0 || new Date().toISOString().slice(0, 10);
                setDraft({
                  ...draft,
                  plano: p.nome,
                  plano_id: p.id,
                  modalidade: p.modalidade,
                  duracao_dias: p.duracao_dias,
                  data_d0: baseDate,
                  data_expiracao: addDaysISO(baseDate, p.duracao_dias),
                });
              } else {
                setDraft({ ...draft, plano: "", plano_id: "" });
              }
            }}
            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
            disabled={planosLoading}
          >
            <option value="">{planosLoading ? "Carregando…" : "Selecione um plano…"}</option>
            {(["mpteam", "mp_elite", "mp_presencial"] as Modalidade[]).map((m) => {
              const lista = planos.filter((p) => p.modalidade === m);
              if (!lista.length) return null;
              const label = MODALIDADE_LABEL[m];
              return (
                <optgroup key={m} label={label}>
                  {lista.map((p) => (
                    <option key={p.id} value={p.id}>
                      {formatPlanoOption(p)}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </EditField>
        <EditField label="Valor (R$)">
          <input
            type="number"
            step="0.01"
            value={draft.valor_plano ?? ""}
            onChange={(e) => setDraft({ ...draft, valor_plano: e.target.value })}
            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
          />
        </EditField>
        <EditField label="Data de início">
          <input
            type="date"
            value={draft.data_d0 ?? ""}
            onChange={(e) => {
              const novaData = e.target.value;
              setDraft({
                ...draft,
                data_d0: novaData,
                data_expiracao: novaData && draft.duracao_dias
                  ? addDaysISO(novaData, draft.duracao_dias)
                  : draft.data_expiracao,
              });
            }}
            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
          />
        </EditField>
        <EditField label="Expira em">
          <input
            type="date"
            value={draft.data_expiracao ?? ""}
            onChange={(e) => setDraft({ ...draft, data_expiracao: e.target.value })}
            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
          />
        </EditField>
        <EditField label="Status do Aluno">
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}
            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
          >
            {Object.entries(STATUS_LABEL).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </EditField>
        <EditField label="Observações">
          <textarea
            value={draft.observacoes || ""}
            onChange={(e) => setDraft({ ...draft, observacoes: e.target.value })}
            rows={2}
            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
          />
        </EditField>
        <EditField label="Renovado">
          <select
            value={draft.renovado ? "sim" : "nao"}
            onChange={(e) => setDraft({ ...draft, renovado: e.target.value === "sim" })}
            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
          >
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </EditField>
        <EditField label="Total de renovações">
          <input
            type="number"
            min={0}
            value={draft.total_renovacoes}
            onChange={(e) => setDraft({ ...draft, total_renovacoes: Number(e.target.value) })}
            className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background"
          />
        </EditField>
      </div>
    </Section>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-md bg-muted/30 border border-border/50">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Info({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-md bg-muted/30 border border-border/50">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium ${highlight ? "text-primary" : ""}`}>{value}</span>
    </div>
  );
}

function HistoricoSection({ hist, logs, jobs, aluno, comunicacoes }: { hist: any[]; logs: any[]; jobs: any[]; aluno: Aluno; comunicacoes: any[] }) {
  const events = [
    { label: "Compra", date: aluno.data_compra },
    { label: "Anamnese", date: aluno.data_anamnese },
    { label: "Início do plano", date: aluno.data_d0 },
  ];
  const dayJobs = jobs.filter((j) => ["d1","d7","d15_formulario","d21","d30"].includes(j.tipo));

  return (
    <div className="space-y-6">
      <Section title="Linha do tempo">
        <div className="flex flex-wrap gap-3">
          {events.map((e, i) => <Pill key={i} label={e.label} date={e.date} />)}
          {dayJobs.map((j) => (
            <JobPill key={j.id} tipo={j.tipo} executado={j.executado} agendado_para={j.agendado_para} executado_em={j.executado_em} />
          ))}
        </div>
      </Section>

      <ComunicacoesSection comunicacoes={comunicacoes} />

      <Section title="Histórico de status">
        {hist.length === 0 ? <p className="text-xs text-muted-foreground">Sem alterações.</p> : (
          <ul className="space-y-2 text-xs">
            {hist.map((h) => (
              <li key={h.id} className="border-b border-border/40 pb-2 last:border-0">
                <div><span className="text-muted-foreground">{h.status_de ?? "—"} →</span> <span className="font-medium">{h.status_para}</span></div>
                <div className="text-muted-foreground">{h.alterado_por} · {fmtDateTime(h.criado_em)}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Entregas (quem confirmou)">
        <HistoricoEntregasSection alunoId={aluno.id} />
      </Section>

      <Section title="Mensagens enviadas">
        {logs.length === 0 ? <p className="text-xs text-muted-foreground">Nada enviado ainda.</p> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 font-medium">Tipo</th>
                <th className="text-left font-medium">Mensagem</th>
                <th className="text-left font-medium">Status</th>
                <th className="text-left font-medium">Quando</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-border/40">
                  <td className="py-2 text-muted-foreground text-xs">{l.tipo_job}</td>
                  <td className="text-xs">{(l.mensagem_enviada ?? "").slice(0, 80)}</td>
                  <td><span className={l.status_envio === "erro" ? "text-primary text-xs" : "text-muted-foreground text-xs"}>{l.status_envio}</span></td>
                  <td className="text-muted-foreground text-xs">{fmtDateTime(l.enviado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

function Pill({ label, date }: { label: string; date: string | null | undefined }) {
  const done = !!date;
  return (
    <div className={`rounded-md px-3 py-2 text-xs flex flex-col items-center min-w-[110px] border ${done ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
      <span className="font-semibold">{label}</span>
      <span className="text-muted-foreground text-[11px]">{date ? fmtDate(date) : "—"}</span>
    </div>
  );
}
function JobPill({ tipo, executado, agendado_para, executado_em }: { tipo: string; executado: boolean; agendado_para: string; executado_em: string | null }) {
  const overdue = !executado && new Date(agendado_para).getTime() < Date.now();
  const Icon = executado ? CheckCircle2 : overdue ? AlertCircle : Clock;
  const color = executado ? "border-primary/70 text-foreground bg-primary/10" : overdue ? "border-primary text-primary bg-primary/10" : "border-border bg-card text-muted-foreground";
  return (
    <div className={`rounded-md px-3 py-2 text-xs flex flex-col items-center min-w-[110px] border ${color}`}>
      <Icon className="h-3 w-3 mb-1" />
      <span className="font-semibold">{tipo}</span>
      <span className="text-[11px]">{fmtDate(executado_em ?? agendado_para)}</span>
    </div>
  );
}

function statusComunicacaoBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "enviado") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (s === "falha" || s === "erro") return "bg-red-100 text-red-700 border-red-200";
  if (s === "pendente") return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-muted text-muted-foreground border-border";
}

function statusComunicacaoLabel(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "enviado") return "Enviado";
  if (s === "falha" || s === "erro") return "Falha";
  if (s === "pendente") return "Pendente";
  return status || "—";
}

function ComunicacoesSection({ comunicacoes }: { comunicacoes: any[] }) {
  const [aberto, setAberto] = useState<any | null>(null);

  return (
    <Section title="Comunicações automáticas">
      {comunicacoes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">Nenhuma comunicação registrada ainda.</p>
        </div>
      ) : (
        <div className="max-h-[480px] overflow-y-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/30 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Data e hora</th>
                <th className="text-left px-3 py-2 font-medium">Gatilho</th>
                <th className="text-left px-3 py-2 font-medium">Canal</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
                <th className="text-left px-3 py-2 font-medium">Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {comunicacoes.map((c) => {
                const msg = String(c.mensagem ?? "");
                const preview = msg.length > 60 ? msg.slice(0, 60) + "…" : msg;
                return (
                  <tr key={c.id} className="border-t border-border/60 hover:bg-muted/20">
                    <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      {fmtDateTime(c.enviado_em)}
                    </td>
                    <td className="px-3 py-2 text-xs font-medium text-foreground">{c.gatilho || "—"}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 capitalize">
                        {c.canal || "whatsapp"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusComunicacaoBadge(c.status)}`}>
                        {statusComunicacaoLabel(c.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground truncate max-w-[280px]">{preview || "—"}</span>
                        {msg && (
                          <button
                            type="button"
                            onClick={() => setAberto(c)}
                            className="text-primary hover:underline text-xs font-medium shrink-0"
                          >
                            Ver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {aberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 px-safe"
          onClick={() => setAberto(null)}
        >
          <div
            className="bg-card border border-border rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{aberto.gatilho || "Comunicação"}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{fmtDateTime(aberto.enviado_em)}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 capitalize">
                    {aberto.canal || "whatsapp"}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusComunicacaoBadge(aberto.status)}`}>
                    {statusComunicacaoLabel(aberto.status)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAberto(null)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">{aberto.mensagem}</p>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ===========================================================
 * MOBILE COMPONENTS — redesign perfil aluno (≤ md)
 * =========================================================== */

function MobileAlunoTopBar({
  aluno, statusPill, canEdit, onConfirmarD0, active, onChangeTab, visibleSections,
}: {
  aluno: Aluno;
  statusPill: { label: string; cls: string };
  canEdit: boolean;
  onConfirmarD0?: () => void;
  active: SectionKey;
  onChangeTab: (k: SectionKey) => void;
  visibleSections: { key: SectionKey; label: string; icon: any }[];
}) {
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [maisOpen, setMaisOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const idade = formatIdade(aluno.data_nascimento);
  const imc = formatIMC(aluno.peso_kg, aluno.altura_cm);
  const peso = aluno.peso_kg ? `${aluno.peso_kg}` : "—";
  const altura = aluno.altura_cm ? (aluno.altura_cm / 100).toFixed(2).replace(".", ",") : "—";
  const idadeNum = idade.replace(/\D+/g, "") || "—";

  // 4 abas principais + "Mais"
  const mainKeys: SectionKey[] = ["perfil", "dieta", "avaliacao", "treino"];
  const mainTabs = mainKeys
    .map((k) => visibleSections.find((s) => s.key === k))
    .filter(Boolean) as { key: SectionKey; label: string; icon: any }[];
  const otherTabs = visibleSections.filter((s) => !mainKeys.includes(s.key));

  return (
    <div className="md:hidden -mt-3 -mx-3 sm:-mx-4 mb-1">
      {/* Top bar */}
      <div className="px-3 pt-2 pb-3 bg-background flex items-start gap-3">
        <button
          aria-label="Voltar"
          onClick={() => nav({ to: "/alunos" })}
          className="h-10 w-10 shrink-0 rounded-full bg-card border border-border flex items-center justify-center shadow-sm"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[18px] font-semibold leading-tight text-foreground truncate">{aluno.nome}</h1>
            {aluno.modalidade && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium whitespace-nowrap">
                {MODALIDADE_LABEL[aluno.modalidade]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {STATUS_LABEL[aluno.status]}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusPill.cls}`}>{statusPill.label}</span>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            aria-label="Mais opções"
            onClick={() => setMenuOpen((v) => !v)}
            className="h-10 w-10 shrink-0 rounded-full bg-card border border-border flex items-center justify-center shadow-sm"
          >
            <MoreVertical className="h-5 w-5 text-foreground" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-50">
              {canEdit && onConfirmarD0 && (
                <button
                  onClick={() => { setMenuOpen(false); onConfirmarD0(); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-muted text-left"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Confirmar início
                </button>
              )}
              <button
                onClick={() => { setMenuOpen(false); onChangeTab("formularios"); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-muted text-left"
              >
                <ClipboardList className="h-4 w-4" /> Formulários
              </button>
              <button
                onClick={() => { setMenuOpen(false); onChangeTab("fotos"); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-muted text-left"
              >
                <Camera className="h-4 w-4" /> Fotos
              </button>
              <button
                onClick={() => { setMenuOpen(false); onChangeTab("historico"); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-muted text-left"
              >
                <History className="h-4 w-4" /> Histórico
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Métricas card */}
      <div className="mx-3 rounded-2xl border border-border bg-card shadow-sm px-3 py-3 flex items-center gap-2">
        <AlunoAvatar nome={aluno.nome} fotoUrl={(aluno as any).foto_url} className="h-14 w-14 text-base" />
        <MobileMetric icon={Cake} value={idadeNum} unit="anos" label="IDADE" />
        <MobileMetric icon={Scale} value={peso} unit="kg" label="PESO" />
        <MobileMetric icon={Activity} value={imc} unit="IMC" label="IMC" />
        <MobileMetric icon={Ruler} value={altura} unit="m" label="ALTURA" />
      </div>

      {/* Tabs */}
      <div className="mt-3 px-3 border-b border-border">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {mainTabs.map((s) => {
            const Icon = s.icon;
            const isActive = active === s.key;
            return (
              <button
                key={s.key}
                onClick={() => onChangeTab(s.key)}
                className={`shrink-0 inline-flex flex-col items-center gap-1 px-3 pt-2 pb-2.5 -mb-px border-b-2 transition-colors ${
                  isActive
                    ? "border-rose-500 text-rose-600"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-medium">{s.label}</span>
              </button>
            );
          })}
          {otherTabs.length > 0 && (
            <Sheet open={maisOpen} onOpenChange={setMaisOpen}>
              <SheetTrigger asChild>
                <button
                  className={`shrink-0 inline-flex flex-col items-center gap-1 px-3 pt-2 pb-2.5 -mb-px border-b-2 transition-colors ${
                    otherTabs.some((t) => t.key === active)
                      ? "border-rose-500 text-rose-600"
                      : "border-transparent text-muted-foreground"
                  }`}
                >
                  <MoreHorizontal className="h-5 w-5" />
                  <span className="text-[11px] font-medium">Mais</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[70vh] overflow-y-auto pb-safe">
                <div className="px-5 pt-5 pb-2 text-sm font-semibold">Outras seções</div>
                <div className="px-3 pb-4 space-y-1">
                  {otherTabs.map((s) => {
                    const Icon = s.icon;
                    return (
                      <button
                        key={s.key}
                        onClick={() => { setMaisOpen(false); onChangeTab(s.key); }}
                        className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-muted text-left"
                      >
                        <Icon className="h-4 w-4 opacity-80" />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </div>
  );
}

function MobileMetric({ icon: Icon, value, unit, label }: { icon: any; value: string; unit: string; label: string }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mb-1" />
      <div className="leading-none">
        <span className="text-[18px] font-semibold text-foreground tabular-nums">{value}</span>
      </div>
      <span className="text-[10px] text-muted-foreground mt-0.5">{unit}</span>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">{label}</span>
    </div>
  );
}

function MobilePerfilExtras({
  aluno, alunoId, canEdit, isAdmin, onWhatsApp, onAdicionarFeedback, onAjustarDieta,
}: {
  aluno: Aluno;
  alunoId: string;
  canEdit: boolean;
  isAdmin: boolean;
  onWhatsApp: () => void;
  onAdicionarFeedback: () => void;
  onAjustarDieta: () => void;
}) {
  const [view, setView] = useState<"home" | "edit-plano" | "edit-presc">("home");
  const [busyPdf, setBusyPdf] = useState(false);

  async function handleSalvarPdf() {
    if (busyPdf) return;
    setBusyPdf(true);
    try {
      const { data: planos } = await supabase
        .from("dieta_planos").select("*")
        .eq("aluno_id", alunoId).eq("template", false).neq("status", "arquivado")
        .order("atualizado_em", { ascending: false }).limit(1);
      const plano = planos?.[0];
      if (!plano) { alert("Nenhum plano alimentar para exportar."); return; }
      const { exportarPdfDieta } = await import("@/lib/dieta-pdf/gerar");
      const { data: refs } = await supabase.from("dieta_refeicoes").select("*").eq("plano_id", plano.id).order("ordem");
      const refList = (refs ?? []) as any[];
      const ids = refList.map((r) => r.id);
      let itemList: any[] = [];
      const subsByItem = new Map<string, any[]>();
      if (ids.length) {
        const { data: itens } = await supabase.from("dieta_itens").select("*").in("refeicao_id", ids).order("ordem");
        itemList = (itens ?? []) as any[];
        const itemIds = itemList.map((i) => i.id);
        if (itemIds.length) {
          const { data: subs } = await supabase.from("dieta_item_substitutos").select("*").in("item_id", itemIds).order("ordem");
          ((subs ?? []) as any[]).forEach((s) => {
            const arr = subsByItem.get(s.item_id) ?? []; arr.push(s); subsByItem.set(s.item_id, arr);
          });
        }
      }
      const completo = {
        ...plano,
        refeicoes: refList.map((r) => ({
          ...r,
          itens: itemList.filter((i) => i.refeicao_id === r.id).map((i) => ({
            ...i, substitutos: subsByItem.get(i.id) ?? [],
          })),
        })),
      } as any;
      exportarPdfDieta(completo, aluno);
    } catch (e) {
      console.error(e);
      alert("Falha ao gerar PDF");
    } finally {
      setBusyPdf(false);
    }
  }

  if (view === "edit-plano") {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setView("home")}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <DietaSection alunoId={alunoId} aluno={aluno} canEdit={canEdit} />
      </div>
    );
  }

  if (view === "edit-presc") {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setView("home")}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <PrescricoesSection alunoId={alunoId} aluno={aluno} canEdit={canEdit} />
      </div>
    );
  }

  const inicio = aluno.data_d0 ? fmtDate(aluno.data_d0) : "—";
  const venc = aluno.data_expiracao ? fmtDate(aluno.data_expiracao) : "—";
  const dr = diasRestantes(aluno.data_expiracao);
  const emDia = dr === null || dr > 7;

  return (
    <div className="space-y-3 pb-32">
      {/* Card combinado: plano + ações rápidas */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Esquerda: dados do plano */}
          <div className="space-y-2.5">
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] text-muted-foreground">Início</div>
                <div className="text-sm font-medium text-foreground">{inicio}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <div className="text-[11px] text-muted-foreground">Vencimento</div>
                <div className="text-sm font-medium text-foreground">{venc}</div>
              </div>
            </div>
            {aluno.modalidade && (
              <div className="pt-1 flex items-center gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                  {MODALIDADE_LABEL[aluno.modalidade]}
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] text-muted-foreground leading-none">Plano</div>
                  <div className="text-[12px] font-medium text-foreground truncate">{aluno.plano ?? MODALIDADE_LABEL[aluno.modalidade]}</div>
                </div>
              </div>
            )}
            <div className="pt-1 space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[12px] text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {STATUS_LABEL[aluno.status]}
              </div>
              <div className={`inline-flex items-center gap-1.5 text-[12px] ${emDia ? "text-emerald-700" : "text-amber-700"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${emDia ? "bg-emerald-500" : "bg-amber-500"}`} />
                {emDia ? "Em dia" : (dr !== null && dr >= 0 ? `Vence em ${dr}d` : "Vencido")}
              </div>
            </div>
          </div>

          {/* Direita: ações rápidas 2x2 */}
          <div>
            <div className="text-[12px] text-muted-foreground mb-2">Ações rápidas</div>
            <div className="grid grid-cols-2 gap-2">
              <MobileQuickAction icon={MessageCircle} label="WhatsApp" tone="emerald" onClick={onWhatsApp} />
              <MobileQuickAction icon={Sparkles} label="Gerar feedback" tone="violet" onClick={onAdicionarFeedback} />
              <MobileQuickAction icon={Pencil} label="Atualizar dieta" tone="sky" onClick={onAjustarDieta} />
              <MobileQuickAction icon={FileDown} label="Salvar PDF" tone="rose" onClick={handleSalvarPdf} busy={busyPdf} />
            </div>
          </div>
        </div>
      </div>

      {/* Plano alimentar / Prescrições — versão compacta */}
      <DietaOverview
        alunoId={alunoId}
        aluno={aluno}
        canEdit={canEdit}
        compact
        onEditarPlano={() => setView("edit-plano")}
        onEditarPrescricao={() => setView("edit-presc")}
        onCriarPlano={() => setView("edit-plano")}
      />

      {/* Card de gerar ajuste nutricional */}
      <MensagemNutricionalCard
        alunoId={alunoId}
        nomeAluno={aluno.nome}
        whatsapp={aluno.whatsapp}
      />

      {/* Rodapé fixo de ações */}
      <div className="md:hidden fixed left-0 right-0 bottom-0 z-30 bg-background/95 backdrop-blur border-t border-border px-3 py-2 pb-safe-plus-3 pl-safe pr-safe">
        <div className="flex items-center gap-2">
          <button
            onClick={onWhatsApp}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-[13px] font-medium"
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </button>
          <button
            onClick={onAdicionarFeedback}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-violet-50 text-violet-700 text-[13px] font-medium"
          >
            <Sparkles className="h-4 w-4" /> Gerar feedback
          </button>
          <button
            onClick={onAjustarDieta}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-50 text-rose-700 text-[13px] font-medium"
          >
            <Pencil className="h-4 w-4" /> Atualizar
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileQuickAction({
  icon: Icon, label, tone, onClick, busy,
}: { icon: any; label: string; tone: "emerald" | "violet" | "sky" | "rose"; onClick: () => void; busy?: boolean }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    sky: "bg-sky-50 text-sky-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 transition"
    >
      <span className={`h-9 w-9 rounded-full flex items-center justify-center ${tones[tone]}`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </span>
      <span className="text-[11px] font-medium text-slate-700 text-center leading-tight px-1">{label}</span>
    </button>
  );
}
