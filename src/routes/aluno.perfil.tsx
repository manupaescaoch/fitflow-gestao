import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
} from "recharts";
import {
  Camera,
  BadgeCheck,
  Calendar,
  Clock,
  Zap,
  Flame,
  Dumbbell,
  Heart,
  Utensils,
  Moon,
  Smile,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  MessageSquare,
  FileText,
  Sparkles,
  ArrowRight,
  Pencil,
  Image as ImageIcon,
  Phone,
  Mail,
  Crown,
  ClipboardList,
  DollarSign,
  ChevronRight,
  Loader2,
  LogOut,
} from "lucide-react";
import { whatsappSuporteUrl } from "@/lib/mpteam-contatos";
import { useAlunoSession, clearAlunoSession, getAlunoSession, setAlunoSession } from "@/lib/aluno-session";
import { logoutAluno } from "@/server/aluno-auth.functions";
import { useAlunoDashboard } from "@/lib/aluno-dashboard-store";
import { FotosEvolucaoCard } from "@/components/aluno-app/FotosEvolucaoCard";
import { PushNotificationsCard } from "@/components/aluno-app/PushNotificationsCard";
import { useServerFn } from "@tanstack/react-start";
import { useSignedPhotoUrl, invalidateSignedPhoto } from "@/lib/use-signed-photo-url";
import { atualizarFotoAluno } from "@/server/aluno-auth.functions";
import { atualizarUsername } from "@/server/comunidade.functions";
import { AtSign, Check } from "lucide-react";
import { toast } from "sonner";
import { SCORE_META_SEMANAL, somarScoreJanela } from "@/lib/aluno-score";

export const Route = createFileRoute("/aluno/perfil")({
  component: AlunoPerfil,
});

const RED = "var(--primary)";

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}
function shortDate(d?: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function calcAge(d?: string | null) {
  if (!d) return null;
  const b = new Date(d);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a;
}

function AlunoPerfil() {
  const { session } = useAlunoSession();
  const { data, loading, error } = useAlunoDashboard();
  const nav = useNavigate();
  const [tabEvol, setTabEvol] = useState<"peso" | "medidas" | "score" | "aderencia">("peso");
  const uploadFoto = useServerFn(atualizarFotoAluno);
  const salvarUsername = useServerFn(atualizarUsername);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [editandoUser, setEditandoUser] = useState(false);
  const [usernameVal, setUsernameVal] = useState("");
  const [usernameAtual, setUsernameAtual] = useState<string | null>(null);
  const [salvandoUser, setSalvandoUser] = useState(false);

  const aluno = data?.aluno ?? null;
  const avals = data?.avaliacoes ?? [];
  const checkins = data?.checkins ?? [];
  const entregas = data?.entregas ?? [];
  const feedbacks = data?.feedbacks ?? [];
  const transacoes = data?.transacoes ?? [];

  const fotoAtual = fotoUrl ?? aluno?.foto_url ?? null;
  const fotoSigned = useSignedPhotoUrl(fotoAtual, "perfil");
  const username = usernameAtual ?? (aluno as any)?.username ?? null;

  async function handleSalvarUsername() {
    if (!session?.id) return;
    const v = usernameVal.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,24}$/.test(v)) {
      toast.error("Use 3–24 caracteres: letras, números, ponto ou _");
      return;
    }
    setSalvandoUser(true);
    try {
      const r = await salvarUsername({ data: { username: v } });
      if (!r.ok) throw new Error(r.error);
      setUsernameAtual(r.username);
      setEditandoUser(false);
      toast.success("Username atualizado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    } finally {
      setSalvandoUser(false);
    }
  }

  async function handleEscolherFoto(file: File) {
    if (!session?.id) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Imagem maior que 5MB");
    setEnviando(true);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const r = await uploadFoto({
        data: { file_base64: b64, content_type: file.type },
      });
      if (!r.ok) throw new Error(r.error);
      setFotoUrl(r.foto_url);
      invalidateSignedPhoto(r.foto_url);
      const cur = getAlunoSession();
      if (cur) setAlunoSession({ ...cur, avatarUrl: r.foto_url });
      toast.success("Foto atualizada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar foto");
    } finally {
      setEnviando(false);
    }
  }

  const sair = async () => {
    try { await logoutAluno(); } catch { /* ignore */ }
    clearAlunoSession();
    nav({ to: "/login" });
  };

  const nome = (session?.nome ?? aluno?.nome ?? "Aluno").toUpperCase();
  const inicial = nome.charAt(0);
  const dataEntrada = fmtDate(aluno?.data_d0);
  const dataVenc = fmtDate(aluno?.data_expiracao);
  const diasRestantes = aluno?.data_expiracao
    ? Math.max(0, Math.ceil((new Date(aluno.data_expiracao).getTime() - Date.now()) / 86400000))
    : null;
  const idade = calcAge(aluno?.data_nascimento);
  const altura = aluno?.altura_cm ? `${aluno.altura_cm} cm` : "—";
  const ultAval = avals[0];
  const pesoAtualKg = ultAval?.weight ?? aluno?.peso_kg ?? null;
  const imc = ultAval?.bmi ?? (pesoAtualKg && aluno?.altura_cm
    ? Number((Number(pesoAtualKg) / Math.pow(Number(aluno.altura_cm) / 100, 2)).toFixed(1))
    : null);

  // Score: mesma janela usada no dashboard (últimos 7 dias) — fonte única
  // de verdade em src/lib/aluno-score.ts.
  const score = useMemo(() => somarScoreJanela(checkins), [checkins]);
  const scoreMeta = SCORE_META_SEMANAL;
  const scorePerc = Math.min(100, (score / scoreMeta) * 100);
  const hojeStr = new Date().toISOString().slice(0, 10);
  const checkinHoje = checkins.find((c: any) => c.data_checkin === hojeStr);
  const scoreHoje = checkinHoje?.score_gerado ?? 0;
  const faltam = Math.max(0, scoreMeta - score);

  // Sequência (streak): dias consecutivos com check-in até hoje
  const streak = useMemo(() => {
    const set = new Set(checkins.map((c: any) => c.data_checkin));
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      if (set.has(d)) n++;
      else if (i > 0) break;
    }
    return n;
  }, [checkins]);

  // Aderência últimos 7 dias (entregas)
  const ult7 = useMemo(() => {
    const days: string[] = [];
    for (let i = 0; i < 7; i++) days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
    return days;
  }, []);
  const aderencia7 = useMemo(() => {
    const map = new Map(entregas.map((e: any) => [e.data_referencia, e]));
    let dietaOk = 0, treinoOk = 0;
    ult7.forEach((d) => {
      const e: any = map.get(d);
      if (e?.dieta_entregue) dietaOk++;
      if (e?.treino_entregue) treinoOk++;
    });
    return {
      dieta: Math.round((dietaOk / 7) * 100),
      treino: Math.round((treinoOk / 7) * 100),
      geral: Math.round(((dietaOk + treinoOk) / 14) * 100),
    };
  }, [entregas, ult7]);

  // Saúde a partir dos check-ins (médias 7 dias)
  const ult7checkins = checkins.filter((c: any) => ult7.includes(c.data_checkin));
  const avg = (key: string) => {
    const vals = ult7checkins.map((c: any) => c[key]).filter((v: any) => v != null);
    if (!vals.length) return null;
    return vals.reduce((a: number, b: number) => a + Number(b), 0) / vals.length;
  };
  const sonoMed = avg("sono_horas");
  const energMed = avg("energia");
  const humorMed = avg("humor");
  const sonoTrend = ult7.slice().reverse().map((d) => {
    const c: any = checkins.find((c: any) => c.data_checkin === d);
    return c?.sono_horas ?? 0;
  });
  const energTrend = ult7.slice().reverse().map((d) => {
    const c: any = checkins.find((c: any) => c.data_checkin === d);
    return c?.energia ?? 0;
  });
  const humorTrend = ult7.slice().reverse().map((d) => {
    const c: any = checkins.find((c: any) => c.data_checkin === d);
    // humor é 0..4; somamos 1 para que o valor mínimo (0 = "Difícil")
    // não vire 0 e seja confundido com "sem registro" no sparkline.
    return c?.humor != null ? Number(c.humor) + 1 : 0;
  });

  // Evolução de peso a partir das avaliações
  const pesoSerie = useMemo(() => {
    return [...avals]
      .reverse()
      .filter((a: any) => a.weight != null)
      .map((a: any) => ({ d: shortDate(a.assessment_date), v: Number(a.weight) }));
  }, [avals]);
  const pesoAtual = pesoSerie[pesoSerie.length - 1]?.v;
  const pesoIni = pesoSerie[0]?.v;
  const delta = pesoAtual != null && pesoIni != null ? (pesoAtual - pesoIni).toFixed(1) : null;

  // Timeline real
  const timeline = useMemo(() => {
    const items: Array<{ d: string; t: string; s: string; icon: any; color: string; ts: number }> = [];
    checkins.slice(0, 6).forEach((c: any) => {
      items.push({
        d: shortDate(c.data_checkin),
        t: "Check-in diário",
        s: `Score +${c.score_gerado ?? 0}`,
        icon: BadgeCheck,
        color: "#10B981",
        ts: new Date(c.data_checkin).getTime(),
      });
    });
    entregas.slice(0, 6).forEach((e: any) => {
      if (e.treino_entregue) items.push({ d: shortDate(e.data_referencia), t: "Treino entregue", s: "Plano de treino atualizado", icon: Dumbbell, color: "#0F172A", ts: new Date(e.data_referencia).getTime() });
      if (e.dieta_entregue) items.push({ d: shortDate(e.data_referencia), t: "Dieta entregue", s: "Plano alimentar atualizado", icon: Utensils, color: "#F59E0B", ts: new Date(e.data_referencia).getTime() });
    });
    feedbacks.slice(0, 4).forEach((f: any) => {
      items.push({
        d: shortDate(f.respondido_em ?? f.enviado_em),
        t: f.status === "respondido" ? "Feedback respondido" : "Feedback enviado",
        s: f.feedback_templates?.nome ?? "Formulário",
        icon: MessageSquare,
        color: "#0EA5E9",
        ts: new Date(f.respondido_em ?? f.enviado_em).getTime(),
      });
    });
    return items.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [checkins, entregas, feedbacks]);

  // Insights derivados
  const insights = useMemo(() => {
    const arr: Array<{ txt: string; icon: any; color: string; dir: "up" | "down" }> = [];
    if (sonoMed != null && sonoMed < 7) arr.push({ txt: `Sono médio em ${sonoMed.toFixed(1)}h (abaixo de 7h)`, icon: Moon, color: "#F59E0B", dir: "down" });
    if (energMed != null && energMed < 3) arr.push({ txt: "Energia abaixo da média", icon: AlertCircle, color: RED, dir: "down" });
    if (aderencia7.geral >= 80) arr.push({ txt: `Aderência em ${aderencia7.geral}% nos últimos 7 dias`, icon: Sparkles, color: "#10B981", dir: "up" });
    if (streak >= 3) arr.push({ txt: `Sequência de ${streak} dias com check-in`, icon: Flame, color: RED, dir: "up" });
    if (!arr.length) arr.push({ txt: "Sem alertas no momento", icon: Sparkles, color: "#10B981", dir: "up" });
    return arr;
  }, [sonoMed, energMed, aderencia7.geral, streak]);

  const ultPag = transacoes.find((t: any) => t.tipo === "receita");

  // Loading inicial
  if (loading && !data) {
    return (
      <div className="bg-[#F7F7F8] min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-primary animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-[#F7F7F8] min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <AlertCircle className="h-8 w-8 text-primary mx-auto" />
          <p className="mt-2 text-sm text-zinc-600">Não foi possível carregar seu perfil.</p>
          <p className="text-xs text-zinc-400 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F7F7F8] text-[#0F172A]">
      <div className="px-5 pt-5 pb-8 space-y-4">
        {/* HEADER */}
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight leading-none">Meu Perfil</h1>
            <p className="text-[13px] text-zinc-500 mt-1.5">Sua jornada, seu resultado.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={sair}
              aria-label="Sair"
              className="h-10 w-10 rounded-full bg-white border border-black/5 flex items-center justify-center shadow-[0_2px_10px_-4px_rgba(0,0,0,0.08)] active:bg-zinc-50 transition"
            >
              <LogOut className="h-[18px] w-[18px] text-zinc-700" />
            </button>
          </div>
        </header>

        {/* CARD PRINCIPAL */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-white border border-black/5 p-4 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.08)]"
        >
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <div className="h-[88px] w-[88px] rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center text-3xl font-extrabold text-zinc-400 overflow-hidden">
                {fotoSigned ? (
                  <img src={fotoSigned} alt={nome} className="h-full w-full object-cover" />
                ) : (
                  inicial
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleEscolherFoto(f);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={enviando}
                className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-white border border-black/5 flex items-center justify-center shadow disabled:opacity-60"
                aria-label="Trocar foto"
              >
                {enviando ? (
                  <span className="h-3 w-3 rounded-full border-2 border-zinc-300 border-t-primary animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5 text-zinc-600" />
                )}
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-[17px] font-extrabold truncate">{nome}</h2>
                <BadgeCheck className="h-4 w-4 text-primary fill-primary/15 shrink-0" />
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                {editandoUser ? (
                  <>
                    <div className="flex-1 flex items-center gap-1 rounded-lg bg-black/5 px-2 py-1">
                      <AtSign className="h-3 w-3 text-black/40" />
                      <input
                        autoFocus
                        value={usernameVal}
                        onChange={(e) => setUsernameVal(e.target.value.toLowerCase())}
                        maxLength={24}
                        placeholder="seu_username"
                        className="flex-1 bg-transparent text-[12px] outline-none font-medium"
                      />
                    </div>
                    <button
                      onClick={handleSalvarUsername}
                      disabled={salvandoUser}
                      className="h-7 w-7 rounded-lg bg-primary text-white flex items-center justify-center disabled:opacity-60"
                    >
                      {salvandoUser ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setUsernameVal(username ?? "");
                      setEditandoUser(true);
                    }}
                    className="inline-flex items-center gap-1 text-[12px] text-black/55 font-medium hover:text-primary"
                  >
                    <AtSign className="h-3 w-3" />
                    {username || "definir username"}
                    <Pencil className="h-2.5 w-2.5 opacity-60" />
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {aluno?.plano && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 uppercase">
                    {aluno.plano}
                  </span>
                )}
                {aluno?.servico_contratado && (
                  <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-600 text-[10px] font-semibold px-2 py-0.5">
                    {String(aluno.servico_contratado).replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-600">
                <li className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-zinc-400" />
                  <span>
                    <span className="text-zinc-500">Entrada:</span>{" "}
                    <span className="font-semibold text-zinc-800">{dataEntrada}</span>
                  </span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-zinc-400" />
                  <span>
                    <span className="text-zinc-500">Vencimento:</span>{" "}
                    <span className="font-semibold text-zinc-800">{dataVenc}</span>
                    {diasRestantes != null && (
                      <span className="text-zinc-400"> ({diasRestantes} dias)</span>
                    )}
                  </span>
                </li>
              </ul>
              {aluno?.status && (
                <div className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold ${aluno.status === "ativo" ? "text-emerald-600" : "text-zinc-500"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${aluno.status === "ativo" ? "bg-emerald-500" : "bg-zinc-400"}`} />
                  {String(aluno.status).replace(/_/g, " ")}
                </div>
              )}
            </div>
          </div>

          {/* Score */}
          <div className="mt-3 rounded-2xl bg-zinc-50 border border-black/5 p-3">
            <div className="text-[11px] font-semibold text-zinc-500">Score (30 dias)</div>
            <div className="mt-0.5 flex items-end gap-2">
              <Zap className="h-5 w-5 text-amber-500 mb-0.5" />
              <span className="text-[26px] font-extrabold leading-none tabular-nums">
                {score.toLocaleString("pt-BR")}
              </span>
              <span className="text-[12px] text-zinc-500 mb-1">/ {scoreMeta.toLocaleString("pt-BR")}</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-200 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-[#ff5e5c]" style={{ width: `${scorePerc}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="font-bold text-primary">+{scoreHoje} hoje</span>
              <span className="text-zinc-500">Faltam {faltam} para a meta</span>
            </div>
          </div>
        </motion.section>

        {/* PERFORMANCE */}
        <section className="rounded-3xl bg-white border border-black/5 p-3 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.08)]">
          <div className="grid grid-cols-3 gap-2">
            <PerfCell label="Sequência" value={`${streak}`} sub="dias" icon={Flame} color={RED} />
            <PerfCell label="Aderência 7d" value={`${aderencia7.geral}%`} color="#10B981" ring={aderencia7.geral} />
            <PerfCell label="Treino 7d" value={`${aderencia7.treino}%`} icon={Dumbbell} color="#0F172A" />
            <PerfCell label="Dieta 7d" value={`${aderencia7.dieta}%`} icon={Utensils} color="#10B981" />
            <PerfCell label="Check-ins 7d" value={`${ult7checkins.length}/7`} icon={BadgeCheck} color="#0EA5E9" />
            <PerfCell label="IMC" value={imc != null ? String(imc) : "—"} icon={Heart} color={RED} />
          </div>
        </section>

        {/* SAÚDE */}
        <section className="rounded-3xl bg-white border border-black/5 p-4 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold">Saúde do aluno</h3>
            <span className="text-[11px] text-zinc-500">Últimos 7 dias</span>
          </div>
          {ult7checkins.length === 0 ? (
            <EmptyState text="Nenhum check-in realizado ainda." />
          ) : (
            <div className="-mx-1 overflow-x-auto no-scrollbar">
              <div className="flex gap-2 px-1 pb-1">
                <SaudeCard label="Sono médio" value={sonoMed != null ? `${sonoMed.toFixed(1)}h` : "—"} icon={Moon} color="#8B5CF6" trend={sonoTrend} />
                <SaudeCard label="Energia" value={energMed != null ? `${energMed.toFixed(1)} / 5` : "—"} icon={Zap} color="#F59E0B" trend={energTrend} />
                <SaudeCard label="Humor" value={humorMed != null ? `${humorMed.toFixed(1)} / 4` : "—"} icon={Smile} color="#10B981" trend={humorTrend} />
              </div>
            </div>
          )}
        </section>

        {/* EVOLUÇÃO */}
        <section className="rounded-3xl bg-white border border-black/5 p-4 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-bold">Evolução</h3>
            <span className="text-[11px] text-zinc-500">{avals.length} avaliações</span>
          </div>
          <div className="mt-2.5 inline-flex p-0.5 rounded-xl bg-zinc-100 text-[11px] font-semibold">
            {(["peso", "medidas", "score", "aderencia"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTabEvol(t)}
                className={`px-2.5 py-1 rounded-lg transition ${tabEvol === t ? "bg-white text-primary shadow-sm" : "text-zinc-500"}`}
              >
                {t === "peso" && "Peso"}
                {t === "medidas" && "Medidas"}
                {t === "score" && "Score"}
                {t === "aderencia" && "Aderência"}
              </button>
            ))}
          </div>

          {pesoSerie.length === 0 ? (
            <div className="mt-3"><EmptyState text="Nenhuma avaliação cadastrada ainda." /></div>
          ) : (
            <div className="mt-3 relative h-44 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pesoSerie} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="evolFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={RED} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={RED} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} width={28} domain={["dataMin - 1", "dataMax + 1"]} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.06)", fontSize: 11, boxShadow: "0 8px 24px -8px rgba(0,0,0,0.15)" }} formatter={(v: number) => [`${v} kg`, "Peso"]} />
                  <Area type="monotone" dataKey="v" stroke={RED} strokeWidth={2.5} fill="url(#evolFill)" dot={{ r: 3, fill: RED, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
              {pesoAtual != null && (
                <div className="absolute top-2 right-2 rounded-xl bg-primary text-white text-[10px] font-bold px-2 py-1 shadow-lg leading-tight">
                  <div>{pesoAtual} kg</div>
                  {delta && <div className="opacity-80 font-semibold">{Number(delta) > 0 ? "+" : ""}{delta} kg</div>}
                </div>
              )}
            </div>
          )}
        </section>

        {/* FOTOS DE EVOLUÇÃO */}
        <section
          id="fotos-evolucao"
          className="rounded-3xl bg-white border border-black/5 p-4 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.08)] scroll-mt-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold">Fotos de evolução</h3>
          </div>
          {aluno?.id ? (
            <FotosEvolucaoCard alunoId={aluno.id} alunoNome={aluno.nome ?? undefined} />
          ) : (
            <EmptyState text="Carregando…" />
          )}
        </section>

        {/* INSIGHTS IA */}
        <section className="rounded-3xl bg-white border border-black/5 p-4 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-bold">Insights</h3>
              <span className="rounded-md bg-zinc-900 text-white text-[9px] font-bold px-1.5 py-0.5">BETA</span>
            </div>
          </div>
          <ul className="space-y-2.5">
            {insights.map((it, i) => (
              <li key={i} className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${it.color}1A` }}>
                  <it.icon className="h-3.5 w-3.5" style={{ color: it.color }} />
                </div>
                <p className="flex-1 text-[12px] leading-snug text-zinc-700">{it.txt}</p>
                {it.dir === "down" ? <TrendingDown className="h-4 w-4 text-primary" /> : <TrendingUp className="h-4 w-4 text-emerald-500" />}
              </li>
            ))}
          </ul>
        </section>

        {/* TIMELINE */}
        <section className="rounded-3xl bg-white border border-black/5 p-4 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold">Timeline</h3>
          </div>
          {timeline.length === 0 ? (
            <EmptyState text="Nenhuma atividade registrada ainda." />
          ) : (
            <ol className="relative ml-1">
              <div className="absolute left-[14px] top-1 bottom-1 w-px bg-zinc-200" />
              {timeline.map((ev, i) => (
                <li key={i} className="relative pl-9 pb-3 last:pb-0">
                  <div className="absolute left-0 top-0 h-7 w-7 rounded-full flex items-center justify-center border-2 border-white" style={{ backgroundColor: `${ev.color}1A` }}>
                    <ev.icon className="h-3.5 w-3.5" style={{ color: ev.color }} />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-bold text-zinc-400 tabular-nums">{ev.d}</span>
                    <span className="text-[12px] font-bold text-zinc-900">{ev.t}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{ev.s}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* FEEDBACKS */}
        <section className="rounded-3xl bg-white border border-black/5 p-4 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.08)]">
          <h3 className="text-[14px] font-bold mb-3">Feedbacks</h3>
          {feedbacks.length === 0 ? (
            <EmptyState text="Nenhum feedback registrado ainda." />
          ) : (
            <ul className="space-y-2">
              {feedbacks.slice(0, 5).map((f: any) => (
                <li key={f.id} className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-[#0EA5E9]/10 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-[#0EA5E9]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold truncate">{f.feedback_templates?.nome ?? "Feedback"}</div>
                    <div className="text-[11px] text-zinc-500">{shortDate(f.respondido_em ?? f.enviado_em)} · {f.status}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* DIETA */}
        <section className="rounded-3xl bg-white border border-black/5 p-4 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.08)]">
          <h3 className="text-[14px] font-bold mb-3">Dieta</h3>
          {!data?.dieta ? (
            <EmptyState text="Aguardando sua dieta." />
          ) : (
            <div className="text-[12px] text-zinc-700">
              <div className="font-bold">{data.dieta.nome}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                {data.dieta.meta_kcal ? `${data.dieta.meta_kcal} kcal · ` : ""}atualizada {fmtDate(data.dieta.atualizado_em)}
              </div>
            </div>
          )}
        </section>

        {/* INFORMAÇÕES GERAIS */}
        <section className="rounded-3xl bg-white border border-black/5 p-4 shadow-[0_4px_20px_-12px_rgba(0,0,0,0.08)]">
          <h3 className="text-[14px] font-bold mb-3">Informações gerais</h3>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            <Info icon={Phone} label="WhatsApp" value={aluno?.whatsapp ?? session?.whatsapp ?? "—"} />
            <Info icon={Crown} label="Plano" value={aluno?.plano ?? "—"} />
            <Info icon={Mail} label="E-mail" value={aluno?.email ?? session?.email ?? "—"} />
            <Info icon={ClipboardList} label="Modalidade" value={aluno?.modalidade ?? "—"} />
            <Info icon={Dumbbell} label="Serviço" value={aluno?.servico_contratado ? String(aluno.servico_contratado).replace(/_/g, " ") : "—"} />
            <Info icon={DollarSign} label="Valor" value={aluno?.valor_plano != null ? `R$ ${Number(aluno.valor_plano).toFixed(2)}` : "—"} />
            <Info icon={Calendar} label="Idade" value={idade != null ? `${idade} anos` : "—"} />
            <Info icon={Heart} label="Altura" value={altura} />
            <Info icon={Heart} label="Peso atual" value={pesoAtualKg != null ? `${pesoAtualKg} kg` : "—"} />
            <Info icon={Heart} label="IMC" value={imc != null ? String(imc) : "—"} />
            <Info icon={DollarSign} label="Último pagamento" value={ultPag ? `R$ ${Number(ultPag.valor).toFixed(2)} · ${fmtDate(ultPag.data_transacao ?? ultPag.criado_em)}` : "—"} />
            <Info icon={Clock} label="Status" value={aluno?.status ? String(aluno.status).replace(/_/g, " ") : "—"} />
          </div>
        </section>

        {/* AÇÕES RÁPIDAS */}
        <section className="grid grid-cols-2 gap-2">
          {[
            {
              icon: ImageIcon,
              label: "Ver fotos de evolução",
              onClick: () => {
                document.getElementById("fotos-evolucao")?.scrollIntoView({ behavior: "smooth", block: "start" });
              },
            },
            {
              icon: MessageSquare,
              label: "Falar com a equipe",
              onClick: () => {
                const primeiro = (session?.nome ?? aluno?.nome ?? "")
                  .split(" ")[0] || "Aluno";
                const msg = `Olá, equipe MPTEAM! Sou ${primeiro} e preciso de ajuda no app.`;
                window.open(whatsappSuporteUrl(msg), "_blank", "noopener");
              },
            },
            {
              icon: LogOut,
              label: "Sair do app",
              onClick: sair,
            },
          ].map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className="rounded-2xl bg-white border border-black/5 py-3 px-3 flex items-center gap-2 text-[12px] font-semibold text-zinc-800 shadow-[0_2px_10px_-6px_rgba(0,0,0,0.08)] active:bg-zinc-50 transition"
            >
              <a.icon className="h-4 w-4 text-zinc-500" />
              <span className="truncate">{a.label}</span>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-300 ml-auto" />
            </button>
          ))}
        </section>

        {/* NOTIFICAÇÕES PUSH */}
        <PushNotificationsCard />
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 border border-dashed border-zinc-200 py-6 px-4 text-center text-[12px] text-zinc-500">
      {text}
    </div>
  );
}

function SaudeCard({ label, value, icon: Icon, color, trend }: { label: string; value: string; icon: any; color: string; trend: number[] }) {
  return (
    <div className="shrink-0 w-[110px] rounded-2xl bg-zinc-50 border border-black/5 p-2.5 text-center">
      <div className="mx-auto h-8 w-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}1A` }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="mt-1.5 text-[10px] text-zinc-500 font-medium">{label}</div>
      <div className="mt-0.5 text-[13px] font-extrabold tabular-nums">{value}</div>
      <Sparkline data={trend} color={color} />
    </div>
  );
}

type PerfItem = {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  ring?: number;
};

function PerfCell({ label, value, sub, icon: Icon, color, ring }: PerfItem) {
  return (
    <div className="rounded-2xl py-3 px-2 text-center bg-white">
      <div className="text-[10px] text-zinc-500 font-medium leading-tight">{label}</div>
      <div className="mt-1.5 h-9 flex items-center justify-center">
        {typeof ring === "number" ? <CircleProgress value={ring} color={color} /> : Icon ? <Icon className="h-5 w-5" style={{ color }} /> : null}
      </div>
      <div className="mt-1 text-[15px] font-extrabold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] font-semibold" style={{ color }}>{sub}</div>}
    </div>
  );
}

function CircleProgress({ value, color }: { value: number; color: string }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div className="relative h-9 w-9">
      <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#E5E7EB" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[9px] font-extrabold">{value}%</div>
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const d = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-5 -mx-1 mt-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={d} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <div className="h-7 w-7 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-zinc-500" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-zinc-500 font-medium">{label}</div>
        <div className="text-[12px] font-bold text-zinc-900 truncate">{value}</div>
      </div>
    </div>
  );
}
