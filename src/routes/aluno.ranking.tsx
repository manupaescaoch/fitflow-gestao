import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  TrendingUp,
  Flame,
  Shield,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  HeartPulse,
  MapPin,
  Camera,
  MessageCircle,
  Droplets,
  Crown,
} from "lucide-react";
import { useAlunoSession } from "@/lib/aluno-session";
import { ProfileAvatar } from "@/components/aluno-app/ProfileAvatar";
import { useServerFn } from "@tanstack/react-start";
import { getRanking, type RankingResposta, type RankingItem } from "@/server/ranking.functions";
import { useSignedPhotoUrl } from "@/lib/use-signed-photo-url";

export const Route = createFileRoute("/aluno/ranking")({
  component: AlunoRanking,
});

type Periodo = "semana" | "mes" | "geral";

const ganhosScore = [
  { label: "Check-in diário", score: "+5 Score", icon: CircleCheck },
  { label: "Postar evolução", score: "+20 Score", icon: Camera },
  { label: "Registrar treino", score: "+25 Score", icon: HeartPulse },
  { label: "Sequência diária", score: "Bônus", icon: Flame },
  { label: "Comentar publicação", score: "+10 Score", icon: MessageCircle },
  { label: "Beber água", score: "+5 Score", icon: Droplets },
  { label: "Manter rotina", score: "Constância", icon: MapPin },
];

const PALETAS = [
  "linear-gradient(135deg,#be185d,#ec4899)",
  "linear-gradient(135deg,#1f2937,#4b5563)",
  "linear-gradient(135deg,#92400e,#d97706)",
  "linear-gradient(135deg,#6d28d9,#a78bfa)",
  "linear-gradient(135deg,#0f172a,#334155)",
  "linear-gradient(135deg,#be123c,#f43f5e)",
  "linear-gradient(135deg,#9d174d,#f472b6)",
];
const MEDALHAS = [
  { medal: "#F5B400", base: "#FACC15" },
  { medal: "#C0C0C0", base: "#E5E7EB" },
  { medal: "#CD7F32", base: "#D4A373" },
];

function gradientFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETAS[h % PALETAS.length];
}

function inicial(nome: string) {
  return (nome?.trim()?.[0] ?? "A").toUpperCase();
}

function PodiumAvatar({ p, big }: { p: RankingItem; big: boolean }) {
  const url = useSignedPhotoUrl(p.foto_url, "avatar");
  return (
    <>
      {url ? (
        <img src={url} alt={p.nome} className="h-full w-full object-cover" />
      ) : (
        inicial(p.nome)
      )}
    </>
  );
}

function RowAvatar({ u }: { u: RankingItem }) {
  const url = useSignedPhotoUrl(u.foto_url, "avatar");
  return url ? (
    <img src={url} alt={u.nome} className="h-full w-full object-cover" />
  ) : (
    <>{inicial(u.nome)}</>
  );
}

function formatNum(n: number) {
  return n.toLocaleString("pt-BR");
}

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <ArrowUp className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.8} />;
  if (trend === "down") return <ArrowDown className="h-3.5 w-3.5 text-[#F70906]" strokeWidth={2.8} />;
  return <Minus className="h-3.5 w-3.5 text-black/30" strokeWidth={2.8} />;
}

const ligas = [
  { nome: "Bronze", faixa: "0 – 499 Score", color: "#CD7F32", min: 0 },
  { nome: "Prata", faixa: "500 – 999 Score", color: "#9CA3AF", min: 500 },
  { nome: "Ouro", faixa: "1.000 – 1.999 Score", color: "#F5B400", min: 1000 },
  { nome: "Diamante", faixa: "2.000+ Score", color: "#7C3AED", min: 2000 },
];

function AlunoRanking() {
  const { session } = useAlunoSession();
  const [tab, setTab] = useState<Periodo>("semana");
  const [data, setData] = useState<RankingResposta | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(false);
  const fetchRanking = useServerFn(getRanking);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetchRanking({ data: { periodo: tab, aluno_id: session?.id ?? null } })
      .then((r) => {
        if (!cancel) setData(r);
      })
      .catch(() => {
        if (!cancel) setData({ periodo: tab, top: [], meu: null });
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [tab, session?.id, fetchRanking]);

  const tabs: { id: Periodo; label: string }[] = [
    { id: "semana", label: "Semana" },
    { id: "mes", label: "Mês" },
    { id: "geral", label: "Geral" },
  ];

  const subtitulo =
    tab === "semana"
      ? "Sua performance nos últimos 7 dias."
      : tab === "mes"
        ? "Sua evolução nos últimos 30 dias."
        : "Histórico completo da comunidade.";
  const titulo = tab === "semana" ? "Ranking semanal" : tab === "mes" ? "Ranking mensal" : "Ranking geral";

  const top = data?.top ?? [];
  const top3 = top.slice(0, 3);
  const restante = top.slice(3);
  const meuId = session?.id;
  const meuItem = top.find((t) => t.aluno_id === meuId) ?? null;

  // Garante que o aluno apareça na lista mesmo fora do top
  const lista = useMemo(() => {
    const base = expandido ? restante : restante.slice(0, 5);
    if (meuItem && data?.meu?.posicao && data.meu.posicao > base.length + 3) {
      const jaTem = base.some((b) => b.aluno_id === meuId);
      if (!jaTem) base.push(meuItem);
    }
    return base;
  }, [restante, expandido, meuItem, data?.meu?.posicao, meuId]);

  const meuScore = data?.meu?.score ?? 0;
  const meuPosicao = data?.meu?.posicao;
  const meuLiga = data?.meu?.liga ?? "Sem liga";
  const meuFalta = data?.meu?.falta ?? 0;
  const meuProgresso = data?.meu?.progresso ?? 0;
  const proxLiga = data?.meu?.proximaLiga;
  const sequencia = data?.meu?.sequencia ?? 0;

  return (
    <div className="px-4 pt-3 pb-6 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] leading-tight font-extrabold tracking-tight text-black">Ranking</h1>
          <p className="mt-1 text-[12px] text-black/50 font-medium">Performance, consistência e evolução.</p>
        </div>
        <ProfileAvatar />
      </header>

      <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white ring-1 ring-black/5">
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="relative flex-1 h-9 rounded-xl text-[12.5px] font-bold transition-colors"
              aria-pressed={active}
            >
              {active && (
                <motion.div
                  layoutId="rankingTab"
                  className="absolute inset-0 rounded-xl bg-[#F70906] shadow-[0_4px_14px_-4px_rgba(247,9,6,0.45)]"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className={`relative ${active ? "text-white" : "text-black/65"}`}>{t.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22 }}
          className="space-y-4"
        >
          <div className="px-1">
            <h2 className="text-[15px] font-extrabold text-black tracking-tight">{titulo}</h2>
            <p className="text-[11.5px] text-black/45 font-medium mt-0.5">{subtitulo}</p>
          </div>

          {/* Card principal aluno */}
          <div className="rounded-3xl bg-white ring-1 ring-black/5 shadow-[0_4px_18px_-8px_rgba(0,0,0,0.08)] p-4 space-y-3">
            <div className="flex items-stretch gap-3">
              <div className="h-20 w-20 shrink-0 rounded-2xl bg-[#F70906] flex flex-col items-center justify-center text-white shadow-[0_8px_20px_-8px_rgba(247,9,6,0.6)]">
                <Trophy className="h-4 w-4" strokeWidth={2.4} />
                <div className="text-[20px] font-extrabold leading-none mt-1 tabular-nums">
                  {meuPosicao ? `#${meuPosicao}` : "—"}
                </div>
                <div className="text-[9px] font-semibold opacity-90 mt-0.5">posição</div>
              </div>
              <div className="flex-1 grid grid-cols-3 gap-2">
                <div>
                  <TrendingUp className="h-3.5 w-3.5 text-[#F70906]" strokeWidth={2.4} />
                  <div className="text-[15px] font-extrabold text-black mt-1 leading-none tabular-nums">
                    {formatNum(meuScore)}
                  </div>
                  <div className="text-[9.5px] text-black/45 font-semibold mt-1">Score</div>
                </div>
                <div>
                  <Flame className="h-3.5 w-3.5 text-[#F70906]" strokeWidth={2.4} />
                  <div className="text-[15px] font-extrabold text-black mt-1 leading-none tabular-nums">
                    {sequencia}
                  </div>
                  <div className="text-[9.5px] text-black/45 font-semibold mt-1">dias seguidos</div>
                </div>
                <div>
                  <Shield className="h-3.5 w-3.5 text-[#F5B400]" strokeWidth={2.4} fill="#F5B400" />
                  <div className="text-[12px] font-extrabold text-black mt-1 leading-none">{meuLiga}</div>
                  <div className="text-[9.5px] text-black/45 font-semibold mt-1">Sua liga</div>
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="h-1.5 rounded-full bg-black/8 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${meuProgresso}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full bg-[#F70906]"
                />
              </div>
              <div className="text-center text-[11px] font-semibold">
                {proxLiga ? (
                  <>
                    <span className="text-[#F70906] tabular-nums">{formatNum(meuFalta)} Score</span>{" "}
                    <span className="text-black/50">para {proxLiga}</span>
                  </>
                ) : (
                  <span className="text-black/50">Liga máxima atingida</span>
                )}
              </div>
            </div>
          </div>

          {/* Podium */}
          {loading && top.length === 0 ? (
            <div className="rounded-3xl bg-white ring-1 ring-black/5 p-6 text-center text-[12px] text-black/45 font-medium">
              Carregando ranking…
            </div>
          ) : top.length === 0 ? (
            <div className="rounded-3xl bg-white ring-1 ring-black/5 p-6 text-center text-[12.5px] text-black/55 font-medium">
              Ainda não há pontuação registrada neste período.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 items-end">
                {/* Ordem visual: 2 - 1 - 3 */}
                {[1, 0, 2].map((idx, i) => {
                  const p = top3[idx];
                  if (!p) {
                    return (
                      <div
                        key={`empty-${i}`}
                        className="rounded-3xl bg-white ring-1 ring-black/5 p-3 pt-7 pb-4 flex flex-col items-center opacity-40"
                      >
                        <div className="h-12 w-12 rounded-full bg-black/10" />
                        <div className="mt-2 text-[12px] text-black/40 font-bold">—</div>
                      </div>
                    );
                  }
                  const isFirst = idx === 0;
                  const m = MEDALHAS[idx];
                  return (
                    <div
                      key={p.aluno_id}
                      className={`relative rounded-3xl bg-white ring-1 ring-black/5 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08)] p-3 pt-7 flex flex-col items-center ${
                        isFirst ? "pb-5" : "pb-4"
                      }`}
                    >
                      <div
                        className="absolute -top-3 left-1/2 -translate-x-1/2 h-7 w-7 rounded-full flex items-center justify-center text-white text-[12px] font-extrabold ring-4 ring-[#FAFAFA] shadow"
                        style={{ background: m.medal }}
                      >
                        {isFirst ? <Crown className="h-3.5 w-3.5" fill="white" strokeWidth={0} /> : idx + 1}
                      </div>
                      <div
                        className={`rounded-full overflow-hidden flex items-center justify-center text-white font-extrabold ring-2 ring-white shadow ${
                          isFirst ? "h-16 w-16 text-[18px]" : "h-12 w-12 text-[14px]"
                        }`}
                        style={{ background: gradientFor(p.aluno_id) }}
                      >
                        <PodiumAvatar p={p} big={isFirst} />
                      </div>
                      <div className={`mt-2 font-bold text-black truncate max-w-full ${isFirst ? "text-[14px]" : "text-[12.5px]"}`}>
                        {p.nome.split(" ")[0]}
                      </div>
                      <div className={`font-extrabold text-[#F70906] mt-0.5 tabular-nums ${isFirst ? "text-[12.5px]" : "text-[11.5px]"}`}>
                        {formatNum(p.score)} Score
                      </div>
                      <div
                        className={`absolute -bottom-0 left-2 right-2 rounded-b-3xl ${isFirst ? "h-2" : "h-1.5"}`}
                        style={{ background: m.base }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Lista */}
              {restante.length > 0 && (
                <div className="rounded-3xl bg-white ring-1 ring-black/5 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08)] overflow-hidden">
                  <div className="divide-y divide-black/5">
                    {lista.map((u, i) => {
                      const isMe = u.aluno_id === meuId;
                      const pos = top.findIndex((t) => t.aluno_id === u.aluno_id) + 1;
                      return (
                        <div
                          key={u.aluno_id}
                          className={`flex items-center gap-3 px-4 py-2.5 ${isMe ? "bg-[#F70906]/5" : ""}`}
                        >
                          <span className="text-[13px] font-extrabold text-black/40 w-6 text-center tabular-nums">
                            #{pos}
                          </span>
                          <div
                            className="h-8 w-8 rounded-full text-white flex items-center justify-center font-bold text-[11px] shrink-0 overflow-hidden"
                            style={{ background: gradientFor(u.aluno_id) }}
                          >
                            <RowAvatar u={u} />
                          </div>
                          <span className={`flex-1 text-[13.5px] ${isMe ? "font-extrabold" : "font-bold"} text-black truncate`}>
                            {u.nome}
                          </span>
                          <span className="text-[12.5px] font-bold text-black/70 tabular-nums">
                            {formatNum(u.score)} <span className="text-black/40 font-semibold">Score</span>
                          </span>
                          <TrendIcon trend="flat" />
                        </div>
                      );
                    })}
                  </div>
                  {restante.length > 5 && (
                    <button
                      onClick={() => setExpandido((v) => !v)}
                      className="w-full py-3 flex items-center justify-center gap-1.5 text-[12.5px] font-bold text-[#F70906] border-t border-black/5 active:bg-black/[0.02] transition"
                    >
                      {expandido ? "Ver menos" : "Ver mais"}
                      <ChevronDown className={`h-4 w-4 transition-transform ${expandido ? "rotate-180" : ""}`} strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Como ganhar Score */}
      <div className="rounded-3xl bg-white ring-1 ring-black/5 shadow-[0_2px_14px_-8px_rgba(0,0,0,0.08)] p-4">
        <h3 className="text-[13.5px] font-bold text-black mb-3">Como ganhar Score</h3>
        <div className="space-y-2">
          {ganhosScore.map((g) => {
            const Icon = g.icon;
            return (
              <div key={g.label} className="flex items-center gap-3">
                <div className="h-7 w-7 shrink-0 rounded-lg bg-[#F70906]/8 flex items-center justify-center">
                  <Icon className="h-3.5 w-3.5 text-[#F70906]" strokeWidth={2.4} />
                </div>
                <span className="flex-1 text-[12.5px] font-semibold text-black truncate">{g.label}</span>
                <span className="text-[12px] font-extrabold text-[#F70906] tabular-nums">{g.score}</span>
                <ChevronRight className="h-3.5 w-3.5 text-black/25" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Ligas */}
      <div className="rounded-3xl bg-white ring-1 ring-black/5 shadow-[0_2px_14px_-8px_rgba(0,0,0,0.08)] p-4">
        <h3 className="text-[13.5px] font-bold text-black mb-3">Ligas</h3>
        <div className="space-y-2">
          {ligas.map((l) => {
            const active = meuLiga.toLowerCase().includes(l.nome.toLowerCase());
            return (
              <div
                key={l.nome}
                className={`flex items-center gap-3 rounded-2xl p-2 ${
                  active ? "bg-[#F70906]/6 ring-1 ring-[#F70906]/15" : ""
                }`}
              >
                <div
                  className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center"
                  style={{ background: `${l.color}20` }}
                >
                  <Shield className="h-4 w-4" style={{ color: l.color }} fill={l.color} strokeWidth={1.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[12.5px] font-bold ${active ? "text-[#F70906]" : "text-black"}`}>
                    {l.nome}
                  </div>
                  <div className="text-[11px] text-black/45 font-medium mt-0.5">{l.faixa}</div>
                </div>
                <div
                  className={`h-4 w-4 rounded-full border-2 ${
                    active ? "border-[#F70906] bg-[#F70906]" : "border-black/15 bg-white"
                  }`}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-2 pt-1 text-center">
        <p className="text-[12.5px] text-black/55 font-medium leading-relaxed">
          Quem sobe no ranking não é o mais motivado.<br />
          É o mais <span className="text-[#F70906] font-bold">consistente</span>.
        </p>
      </div>
    </div>
  );
}
