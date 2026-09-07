import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Zap,
  Flame,
  Droplet,
  Moon,
  Smile,
  Heart,
  ChevronRight,
  Check,
  Bell,
  Utensils,
  Dumbbell,
} from "lucide-react";
import { useAlunoSession } from "@/lib/aluno-session";
import { useAlunoDashboard, triggerAlunoDashboardRefetch } from "@/lib/aluno-dashboard-store";
import { useServerFn } from "@tanstack/react-start";
import { getDietaAluno } from "@/server/aluno-dieta.functions";
import { registrarAgua, toggleAtividade } from "@/server/aluno-kpis.functions";
import { SCORE_DIARIO, SCORE_META_SEMANAL, somarScoreJanela } from "@/lib/aluno-score";

export const Route = createFileRoute("/aluno/")({
  head: () => ({
    meta: [
      { title: "Início — App do Aluno | MPTEAM" },
      { name: "description", content: "Sua página inicial no MPTEAM: score do dia, check-in diário, dieta, treinos e evolução em um só lugar." },
    ],
  }),
  component: AlunoInicio,
});

const RED = "var(--primary)";

function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const safePct = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const off = c - (safePct / 100) * c;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        style={{ transition: "stroke-dashoffset 0.9s ease-out" }}
        transform="rotate(-90 22 22)"
      />
    </svg>
  );
}

function calcSequencia(datas: string[]) {
  if (!datas.length) return 0;
  const set = new Set(datas);
  let d = new Date();
  const hoje = d.toISOString().slice(0, 10);
  if (!set.has(hoje)) d.setDate(d.getDate() - 1);
  let streak = 0;
  for (;;) {
    const k = d.toISOString().slice(0, 10);
    if (set.has(k)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

function humorTexto(h?: number | null) {
  if (h == null) return null;
  if (h >= 4) return "Muito bem";
  if (h === 3) return "Bem";
  if (h === 2) return "Ok";
  if (h === 1) return "Cansado";
  return "Difícil";
}
function energiaTexto(e?: number | null) {
  if (e == null) return null;
  if (e >= 4) return "Alta";
  if (e === 3) return "Boa";
  if (e === 2) return "Média";
  return "Baixa";
}

function AlunoInicio() {
  const { session } = useAlunoSession();
  const primeiroNome = (session?.nome ?? "Aluno").split(" ")[0];
  const { data, loading } = useAlunoDashboard();
  const fetchDieta = useServerFn(getDietaAluno);
  const fnRegistrarAgua = useServerFn(registrarAgua);
  const fnToggleAtividade = useServerFn(toggleAtividade);

  const [refeicoesTotal, setRefeicoesTotal] = useState<number>(0);
  const [metaKcal, setMetaKcal] = useState<number | null>(null);
  const [totalKcal, setTotalKcal] = useState<number | null>(null);
  const [refeicoesKcal, setRefeicoesKcal] = useState<Record<string, number>>({});

  const [scoreToast, setScoreToast] = useState<number | null>(null);
  const aguaMlServer = (data as any)?.agua_ml_hoje ?? 0;
  const [aguaOptimistic, setAguaOptimistic] = useState<number | null>(null);
  useEffect(() => {
    setAguaOptimistic(null);
  }, [aguaMlServer]);
  const aguaMl = aguaOptimistic ?? aguaMlServer;
  const atividadesHoje: Array<{ tipo: string; concluido: boolean }> =
    (data as any)?.atividades_hoje ?? [];
  const cardioDone = atividadesHoje.some((a) => a.tipo === "cardio" && a.concluido);
  const treinoDone = atividadesHoje.some((a) => a.tipo === "treino" && a.concluido);
  const refeicoesFeitas = ((data as any)?.refeicoes_hoje ?? []).length as number;
  const refeicoesHojeIds: string[] = ((data as any)?.refeicoes_hoje ?? [])
    .map((r: any) => r?.refeicao_id)
    .filter((x: any): x is string => !!x);
  const kcalConsumido = refeicoesHojeIds.reduce(
    (s, id) => s + (refeicoesKcal[id] ?? 0),
    0,
  );

  const ajustarAgua = (delta: number) => {
    if (!session?.id) return;
    const base = aguaOptimistic ?? aguaMlServer;
    const novoTotal = Math.max(0, base + delta);
    const realDelta = novoTotal - base;
    if (realDelta === 0) return;
    setAguaOptimistic(novoTotal);
    fnRegistrarAgua({ data: { ml: realDelta } })
      .then(() => triggerAlunoDashboardRefetch())
      .catch(() => setAguaOptimistic(null));
  };
  const marcarAtividade = async (tipo: "cardio" | "treino", concluido: boolean) => {
    if (!session?.id) return;
    await fnToggleAtividade({ data: { tipo, concluido } });
    if (concluido) showScore(tipo === "cardio" ? 15 : 20);
    triggerAlunoDashboardRefetch();
  };

  useEffect(() => {
    if (!session?.id) return;
    let cancel = false;
    fetchDieta()
      .then((r) => {
        if (cancel) return;
        setRefeicoesTotal(r.plano?.refeicoes.length ?? 0);
        setMetaKcal(r.plano?.meta_kcal ?? null);
        const kcalCalc = r.plano?.totais?.kcal ?? 0;
        const kcalDesc = r.plano?.totais_descricao?.kcal ?? 0;
        setTotalKcal(kcalCalc > 0 ? kcalCalc : kcalDesc > 0 ? kcalDesc : null);
        const map: Record<string, number> = {};
        for (const ref of r.plano?.refeicoes ?? []) {
          map[ref.id] = Number(ref.totais?.kcal ?? 0);
        }
        setRefeicoesKcal(map);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [session?.id, fetchDieta]);

  const checkins = data?.checkins ?? [];
  const hojeStr = new Date().toISOString().slice(0, 10);
  const checkinHoje = checkins.find((c: any) => c.data_checkin === hojeStr);
  const sequencia = useMemo(
    () => calcSequencia(checkins.map((c: any) => c.data_checkin)),
    [checkins],
  );

  // Score acumulado da janela (últimos 7 dias). Constantes compartilhadas
  // com a tela de perfil em src/lib/aluno-score.ts.
  const xpHoje = checkinHoje?.score_gerado ?? 0;
  const xpSemana = somarScoreJanela(checkins);
  const xpMetaDia = SCORE_DIARIO;
  const xpMetaSemana = SCORE_META_SEMANAL;
  const pct = Math.min(100, Math.round((xpHoje / xpMetaDia) * 100));
  const xpFalta = Math.max(0, xpMetaDia - xpHoje);

  const sono = checkinHoje?.sono_horas ?? null;
  const sonoMeta = 8;
  const sonoPct = sono ? Math.min(100, Math.round((sono / sonoMeta) * 100)) : 0;
  const humor = humorTexto(checkinHoje?.humor);
  const energia = energiaTexto(checkinHoje?.energia);

  const inicial = (session?.nome ?? "A").trim().charAt(0).toUpperCase();
  const pesoKg = (data?.aluno as any)?.peso_kg ? Number((data?.aluno as any).peso_kg) : null;
  const aguaMetaMl = pesoKg ? Math.round(pesoKg * 35) : null;
  const aguaMetaL = aguaMetaMl ? aguaMetaMl / 1000 : null;
  const aguaAtualL = aguaMl / 1000;
  const aguaPct = aguaMetaMl ? Math.min(100, Math.round((aguaMl / aguaMetaMl) * 100)) : 0;
  const metaKcalRef = metaKcal ?? totalKcal ?? null;
  const kcalConsumidoArred = Math.round(kcalConsumido);
  const kcalLabel = metaKcalRef
    ? `${Math.round(metaKcalRef).toLocaleString("pt-BR")}`
    : kcalConsumidoArred > 0
    ? `${kcalConsumidoArred.toLocaleString("pt-BR")}`
    : "—";
  const kcalSubtitle = metaKcalRef
    ? `kcal do plano`
    : kcalConsumidoArred > 0
    ? "kcal consumidas"
    : "sem meta";

  const dietaPct = refeicoesTotal > 0 ? Math.round((refeicoesFeitas / refeicoesTotal) * 100) : 0;

  const showScore = (v: number) => {
    setScoreToast(v);
    setTimeout(() => setScoreToast(null), 1500);
  };

  const focos = [
    { label: "Check-in", icon: Check, color: RED, done: !!checkinHoje },
    { label: "Sono", icon: Moon, color: "#7B5BFF", done: !!sono },
    { label: "Humor", icon: Smile, color: "#22C55E", done: checkinHoje?.humor != null },
    { label: "Dieta", icon: Utensils, color: "#22C55E", done: false },
  ];
  const focosFeitos = focos.filter((f) => f.done).length;

  return (
    <div className="px-4 pt-1.5 pb-2 space-y-2">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-start justify-between gap-3"
      >
        <div>
          <h1 className="text-[19px] leading-tight font-extrabold tracking-tight">
            Olá, {primeiroNome} <span>👋</span>
          </h1>
          <p className="mt-0.5 text-[11px] text-black/50">Foco. Disciplina. Evolução.</p>
        </div>
        <Link to="/aluno/perfil" className="relative shrink-0" aria-label="Perfil">
          <div className="h-9 w-9 rounded-full bg-primary/10 overflow-hidden ring-1 ring-black/5 flex items-center justify-center">
            {session?.avatarUrl ? (
              <img src={session.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[13px] font-extrabold text-primary">{inicial}</span>
            )}
          </div>
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary ring-2 ring-[#FAFAFA] flex items-center justify-center">
            <Bell className="h-2 w-2 text-white" strokeWidth={3} />
          </span>
        </Link>
      </motion.section>

      {/* XP card */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="rounded-2xl bg-white p-2.5 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.18)] ring-1 ring-black/5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-primary" fill={RED} />
            </div>
            <div className="text-[10px] font-extrabold tracking-[0.18em] text-black">
              SCORE DE HOJE
            </div>
          </div>
          <div className="text-primary font-extrabold text-sm tabular-nums">
            {xpSemana} na semana
          </div>
        </div>

        <div className="mt-2 h-1.5 w-full rounded-full bg-black/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="h-full rounded-full bg-primary"
          />
        </div>

        <div className="mt-1.5 flex items-center justify-between text-[10px]">
          <span className="text-primary font-semibold tabular-nums">
            {xpHoje} / {xpMetaDia} pts
          </span>
          <span className="text-black/45">
            {xpFalta > 0 ? `Faltam ${xpFalta} pts hoje` : "Meta de hoje batida"}
          </span>
        </div>
      </motion.section>

      {/* Sequência */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="rounded-2xl bg-white p-2 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.18)] ring-1 ring-black/5 flex items-center gap-2.5"
      >
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Flame className="h-5 w-5 text-primary" fill={RED} />
        </div>
        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="text-2xl font-extrabold leading-none text-primary tabular-nums">
            {sequencia}
          </span>
          <span className="text-[9px] font-extrabold tracking-widest leading-tight text-black">
            DIAS<br />SEGUIDOS
          </span>
        </div>
        <div className="h-7 w-px bg-black/10 mx-0.5" />
        <p className="text-[10.5px] text-black/70 leading-snug flex-1">
          {sequencia === 0
            ? "Faça seu check-in de hoje pra começar a contagem."
            : "Tu sobe aqui fazendo o básico todo dia."}
        </p>
        <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
      </motion.section>

      {/* Hoje */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-[11px] font-extrabold tracking-[0.2em] text-black">HOJE</h2>
          <Link to="/aluno/perfil" className="text-[11px] font-semibold text-black/60 inline-flex items-center gap-0.5">
            Ver tudo <ChevronRight className="h-3.5 w-3.5 text-primary" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Calorias (total real da dieta) */}
          <MetricCard
            label="Calorias"
            icon={Flame}
            color={RED}
            bg="bg-primary/10"
            value={kcalLabel}
            subtitle={kcalSubtitle}
            ringPct={dietaPct}
            fillIcon
            index={0}
          />
          {/* Água */}
          <AguaCard
            atualL={aguaAtualL}
            metaL={aguaMetaL}
            pct={aguaPct}
            onAdd={() => ajustarAgua(250)}
            onSub={() => ajustarAgua(-250)}
          />
          {/* Sono */}
          <MetricCard
            label="Sono"
            icon={Moon}
            color="#7B5BFF"
            bg="bg-[#7B5BFF]/10"
            value={sono ? `${sono}h` : "—"}
            subtitle={sono ? `/ ${sonoMeta}h` : "sem registro"}
            ringPct={sonoPct}
            index={1}
          />
          {/* Humor */}
          <MetricCard
            label="Humor"
            icon={Smile}
            color="#22C55E"
            bg="bg-[#22C55E]/10"
            value={humor ?? "—"}
            subtitle={humor ? "" : "registre hoje"}
            check={!!humor}
            index={2}
          />
          {/* Energia */}
          <MetricCard
            label="Energia"
            icon={Zap}
            color="#F5B400"
            bg="bg-[#F5B400]/10"
            value={energia ?? "—"}
            subtitle={energia ? "" : "registre hoje"}
            check={!!energia}
            index={3}
          />
          {/* Dieta */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.16 }}
            className="rounded-2xl bg-white p-2.5 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.18)] ring-1 ring-black/5 min-h-[86px] flex flex-col"
          >
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-md bg-[#22C55E]/10 flex items-center justify-center">
                <Utensils className="h-3 w-3 text-[#22C55E]" />
              </div>
              <span className="text-[11px] font-bold text-black">Dieta</span>
            </div>
            <div className="mt-auto pt-2">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] font-extrabold text-black tabular-nums">
                  {refeicoesTotal > 0 ? `${refeicoesFeitas}/${refeicoesTotal}` : "—"}
                </span>
                <span className="text-[10px] font-semibold text-[#22C55E] tabular-nums">
                  {refeicoesTotal > 0 ? `${dietaPct}%` : ""}
                </span>
              </div>
              <div className="text-[9px] text-black/40 mt-0.5">
                {refeicoesTotal > 0 ? "refeições" : "sem plano ativo"}
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-black/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${dietaPct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full bg-[#22C55E]"
                />
              </div>
            </div>
          </motion.div>
          {/* Cardio */}
          <ActionCard
            label="Cardio"
            icon={Heart}
            color={RED}
            bg="bg-primary/10"
            valueLabel="Registre seu cardio"
            buttonLabel="Marcar cardio"
            done={cardioDone}
            onDone={() => marcarAtividade("cardio", !cardioDone)}
            doneLabel="Cardio concluído"
            index={6}
          />
          {/* Treino */}
          <ActionCard
            label="Treino"
            icon={Dumbbell}
            color="#7B5BFF"
            bg="bg-[#7B5BFF]/10"
            valueLabel="Sessão do dia"
            buttonLabel="Treino concluído"
            done={treinoDone}
            onDone={() => marcarAtividade("treino", !treinoDone)}
            doneLabel="Treino concluído"
            index={7}
            glow
          />
        </div>
      </section>

      <AnimatePresence>
        {scoreToast !== null && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 rounded-full bg-black text-white px-4 py-2 text-[13px] font-bold shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]"
          >
            +{scoreToast} Score
          </motion.div>
        )}
      </AnimatePresence>

      {/* Foco de hoje */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        className="rounded-2xl bg-white p-2.5 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.18)] ring-1 ring-black/5"
      >
        <div className="flex gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-extrabold tracking-[0.2em] text-black/50">
              FOCO DE HOJE
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-[26px] leading-none font-extrabold text-black tabular-nums">
                {focosFeitos}/{focos.length}
              </span>
            </div>
            <div className="text-[11px] text-black/55">concluídas</div>
            <div className="mt-2 flex items-center gap-1">
              {focos.map((f, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${f.done ? "bg-primary" : "bg-black/8"}`}
                />
              ))}
            </div>
          </div>

          <div className="w-px bg-black/10" />

          <ul className="flex-1 space-y-1.5">
            {focos.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" style={{ color: f.color }} />
                    <span className="text-[12px] font-semibold text-black">{f.label}</span>
                  </div>
                  {f.done ? (
                    <span className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
                    </span>
                  ) : (
                    <span className="h-4 w-4 rounded-full border-2 border-black/15" />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </motion.section>

      {loading && !data && (
        <p className="text-center text-[11px] text-black/35 font-medium pt-2">
          Carregando seus dados…
        </p>
      )}
    </div>
  );
}

function MetricCard({
  label,
  icon: Icon,
  color,
  bg,
  value,
  subtitle,
  ringPct,
  check,
  fillIcon,
  index,
}: {
  label: string;
  icon: typeof Flame;
  color: string;
  bg: string;
  value: string;
  subtitle?: string;
  ringPct?: number;
  check?: boolean;
  fillIcon?: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.04 * index }}
      className="rounded-2xl bg-white p-2.5 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.18)] ring-1 ring-black/5 min-h-[86px] flex flex-col"
    >
      <div className="flex items-center gap-1.5">
        <div className={`h-5 w-5 rounded-md flex items-center justify-center ${bg}`}>
          <Icon className="h-3 w-3" style={{ color }} fill={fillIcon ? color : "none"} />
        </div>
        <span className="text-[11px] font-bold text-black">{label}</span>
      </div>
      <div className="mt-auto flex items-end justify-between gap-1 pt-2">
        <div className="min-w-0">
          <div className="text-[14px] font-extrabold leading-tight text-black truncate">{value}</div>
          {subtitle && <div className="text-[10px] text-black/40 mt-0.5">{subtitle}</div>}
        </div>
        {check ? (
          <div className="h-7 w-7 rounded-full border-2 border-[#22C55E]/30 bg-[#22C55E]/10 flex items-center justify-center shrink-0">
            <Check className="h-3.5 w-3.5 text-[#22C55E]" strokeWidth={3} />
          </div>
        ) : (
          <Ring pct={ringPct ?? 0} color={color} />
        )}
      </div>
    </motion.div>
  );
}

function AguaCard({
  atualL,
  metaL,
  pct,
  onAdd,
  onSub,
}: {
  atualL: number;
  metaL: number | null;
  pct: number;
  onAdd: () => void;
  onSub: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.04 }}
      className="rounded-2xl bg-white p-2.5 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.18)] ring-1 ring-black/5 min-h-[86px] flex flex-col"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-md flex items-center justify-center bg-[#0EA5E9]/10">
            <Droplet className="h-3 w-3 text-[#0EA5E9]" fill="#0EA5E9" />
          </div>
          <span className="text-[11px] font-bold text-black">Água</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onSub}
            className="h-7 w-7 rounded-full bg-black/5 text-black text-[16px] leading-none font-bold active:scale-90 transition-transform flex items-center justify-center"
            aria-label="Remover 250ml"
          >
            −
          </button>
          <button
            onClick={onAdd}
            className="h-7 w-7 rounded-full bg-[#0EA5E9] text-white text-[16px] leading-none font-bold active:scale-90 transition-transform flex items-center justify-center"
            aria-label="Adicionar 250ml"
          >
            +
          </button>
        </div>
      </div>
      <div className="mt-auto pt-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] font-extrabold leading-tight text-black tabular-nums">
            {atualL.toFixed(1).replace(".", ",")}L
          </span>
          <span className="text-[10px] font-semibold text-[#0EA5E9] tabular-nums">
            {metaL ? `/ ${metaL.toFixed(1).replace(".", ",")}L` : "informe peso"}
          </span>
        </div>
        <div className="text-[9px] text-black/40 mt-0.5">+250ml por toque</div>
        <div className="mt-1.5 h-1.5 w-full rounded-full bg-black/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full bg-[#0EA5E9]"
          />
        </div>
      </div>
    </motion.div>
  );
}

function ActionCard({
  label,
  icon: Icon,
  color,
  bg,
  valueLabel,
  buttonLabel,
  done,
  onDone,
  doneLabel,
  index,
  glow,
}: {
  label: string;
  icon: typeof Flame;
  color: string;
  bg: string;
  valueLabel: string;
  buttonLabel: string;
  done: boolean;
  onDone: () => void;
  doneLabel: string;
  index: number;
  glow?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        boxShadow:
          done && glow
            ? `0 0 0 1px ${color}33, 0 12px 30px -12px ${color}66`
            : "0 8px 24px -16px rgba(0,0,0,0.18)",
      }}
      transition={{ duration: 0.3, delay: 0.04 * index }}
      className="relative rounded-2xl bg-white p-3 ring-1 ring-black/5 min-h-[86px] flex flex-col overflow-hidden"
    >
      <div className="flex items-center gap-1.5">
        <div className={`h-5 w-5 rounded-md flex items-center justify-center ${bg}`}>
          <Icon className="h-3 w-3" style={{ color }} />
        </div>
        <span className="text-[11px] font-bold text-black">{label}</span>
      </div>
      <div className="text-[11px] text-black/55 mt-1.5 truncate">{valueLabel}</div>
      <div className="mt-auto pt-2">
        {done ? (
          <div className="flex items-center gap-1.5 rounded-xl bg-[#22C55E]/10 px-2 py-1.5">
            <span className="h-4 w-4 rounded-full bg-[#22C55E] flex items-center justify-center shrink-0">
              <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
            </span>
            <span className="text-[10px] font-bold text-[#16a34a] truncate">{doneLabel}</span>
          </div>
        ) : (
          <button
            onClick={onDone}
            className="w-full rounded-xl bg-black text-white text-[11px] font-bold py-1.5 active:scale-[0.98] transition"
          >
            {buttonLabel}
          </button>
        )}
      </div>
    </motion.div>
  );
}
