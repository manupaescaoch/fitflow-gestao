import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Phone, MessageCircle, MoreHorizontal, Sparkles, TrendingDown, TrendingUp,
  ArrowUpRight, Flame, Activity, Heart, Dumbbell, UtensilsCrossed,
  ShieldCheck, Pencil, Send, FileText, Wallet, Bell, AlertTriangle,
  CheckCircle2, Moon, Zap, Smile, Droplet, Calendar, Camera,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_LABEL, MODALIDADE_LABEL, fmtDate, diasRestantes, type Aluno,
} from "@/lib/crm";
import { AlunoAvatar } from "@/components/aluno/AlunoAvatar";

/* ============================================================
   PerfilDashboard — Premium SaaS-style profile (light mode)
   Inspired by: Linear, Stripe, Attio, Notion, Apple Health.
   ============================================================ */

const RED = "var(--primary)";

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}
function formatIdade(nasc: string | null | undefined): string {
  if (!nasc) return "—";
  const d = new Date(nasc);
  if (isNaN(+d)) return "—";
  const diff = Date.now() - d.getTime();
  return `${Math.floor(diff / (365.25 * 86400000))} anos`;
}
function formatIMC(peso?: number | null, altCm?: number | null) {
  if (!peso || !altCm) return "—";
  const m = altCm / 100;
  return (peso / (m * m)).toFixed(1).replace(".", ",");
}

export function PerfilDashboard({
  aluno, alunoId, onEditar, onEnviarMensagem,
}: {
  aluno: Aluno;
  alunoId: string;
  onEditar?: () => void;
  onEnviarMensagem?: () => void;
}) {
  const dr = diasRestantes(aluno.data_expiracao);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    media_sono_7d?: number | null;
    media_energia_7d?: number | null;
    media_humor_7d?: number | null;
    total_checkins_7d?: number | null;
  } | null>(null);
  const [aguaPorDia, setAguaPorDia] = useState<Record<string, number>>({});
  const [atividades, setAtividades] = useState<Array<{ data_referencia: string; tipo: string; concluido: boolean }>>([]);
  const [refeicoes, setRefeicoes] = useState<Array<{ data_referencia: string }>>([]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const sb = supabase as any;
      const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const [{ data: ck }, { data: st }, { data: ag }, { data: at }, { data: rf }] = await Promise.all([
        sb
          .from("daily_checkins")
          .select("*")
          .eq("aluno_id", alunoId)
          .order("data_checkin", { ascending: false })
          .limit(30),
        sb
          .from("weekly_checkin_stats")
          .select("*")
          .eq("aluno_id", alunoId)
          .maybeSingle(),
        sb
          .from("aluno_agua_log")
          .select("data_referencia, ml")
          .eq("aluno_id", alunoId)
          .gte("data_referencia", since),
        sb
          .from("aluno_atividades_dia")
          .select("data_referencia, tipo, concluido")
          .eq("aluno_id", alunoId)
          .gte("data_referencia", since),
        sb
          .from("aluno_refeicoes_log")
          .select("data_referencia")
          .eq("aluno_id", alunoId)
          .gte("data_referencia", since),
      ]);
      if (cancel) return;
      setCheckins((ck as any[]) ?? []);
      setStats((st as any) ?? null);
      const aguaMap: Record<string, number> = {};
      ((ag as any[]) ?? []).forEach((r) => {
        aguaMap[r.data_referencia] = (aguaMap[r.data_referencia] ?? 0) + Number(r.ml || 0);
      });
      setAguaPorDia(aguaMap);
      setAtividades((at as any[]) ?? []);
      setRefeicoes((rf as any[]) ?? []);
    })();
    return () => { cancel = true; };
  }, [alunoId]);

  // === KPIs derivados 100% das respostas reais ===
  const hojeStr = new Date().toISOString().slice(0, 10);
  const checkinHoje = checkins.find((c) => c.data_checkin === hojeStr);

  const scoreSemana = checkins
    .filter((c) => {
      const t = new Date(c.data_checkin).getTime();
      return t >= Date.now() - 7 * 86400000;
    })
    .reduce((s, c) => s + (c.score_gerado || 0), 0);
  const scoreHoje = checkinHoje?.score_gerado ?? 0;

  // Sequência de check-ins consecutivos
  const sequencia = (() => {
    const set = new Set(checkins.map((c) => c.data_checkin));
    let d = new Date();
    if (!set.has(hojeStr)) d.setDate(d.getDate() - 1);
    let n = 0;
    while (set.has(d.toISOString().slice(0, 10))) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  })();

  // Aderência 7d = % dos últimos 7 dias com check-in
  const aderencia7 = Math.round(
    (checkins.filter((c) => {
      const t = new Date(c.data_checkin).getTime();
      return t >= Date.now() - 7 * 86400000;
    }).length / 7) * 100,
  );

  // Treino/Cardio 7d = % dos últimos 7 dias com a atividade marcada
  const pctAtividade = (tipo: "treino" | "cardio") => {
    const set = new Set(
      atividades
        .filter((a) => a.tipo === tipo && a.concluido)
        .map((a) => a.data_referencia),
    );
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (set.has(d.toISOString().slice(0, 10))) n++;
    }
    return Math.round((n / 7) * 100);
  };
  const treinoPct = pctAtividade("treino");
  const cardioPct = pctAtividade("cardio");

  // Dieta 7d = média do progresso de refeições (precisa do total de refeições do plano)
  // Sem total disponível aqui, usamos: % dos últimos 7 dias com pelo menos 1 refeição registrada
  const dietaPct = (() => {
    const set = new Set(refeicoes.map((r) => r.data_referencia));
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (set.has(d.toISOString().slice(0, 10))) n++;
    }
    return Math.round((n / 7) * 100);
  })();

  const labelTone = (v: number) =>
    v >= 85 ? "Alta" : v >= 70 ? "Boa" : v >= 50 ? "Média" : v > 0 ? "Baixa" : "Sem dados";

  const riscoAbandono = (() => {
    if (aderencia7 >= 70) return { label: "Baixo", tone: "emerald" as const };
    if (aderencia7 >= 40) return { label: "Moderado", tone: "amber" as const };
    return { label: "Alto", tone: "rose" as const };
  })();

  // Médias 7d para "Saúde do aluno"
  const ult7 = checkins.filter((c) => {
    const t = new Date(c.data_checkin).getTime();
    return t >= Date.now() - 7 * 86400000;
  });
  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const sonoMedia = avg(ult7.map((c) => Number(c.sono_horas)).filter((n) => Number.isFinite(n)));
  const energiaMedia = avg(ult7.map((c) => Number(c.energia)).filter((n) => Number.isFinite(n)));
  const humorMedia = avg(ult7.map((c) => Number(c.humor)).filter((n) => Number.isFinite(n)));
  const aguaMediaMl = (() => {
    let total = 0, dias = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      if (aguaPorDia[k] != null) {
        total += aguaPorDia[k];
        dias++;
      }
    }
    return dias > 0 ? total / dias : null;
  })();
  const treinosFeitos7 = atividades.filter((a) => a.tipo === "treino" && a.concluido).length;
  const cardiosFeitos7 = atividades.filter((a) => a.tipo === "cardio" && a.concluido).length;

  const kpis = {
    scoreSemana, scoreHoje, sequencia, aderencia7, treinoPct, cardioPct, dietaPct,
    riscoAbandono, sonoMedia, energiaMedia, humorMedia, aguaMediaMl,
    treinosFeitos7, cardiosFeitos7, labelTone,
  };

  const onWhatsApp = () => {
    const numero = (aluno.whatsapp || "").replace(/\D/g, "");
    window.open(numero ? `https://wa.me/${numero}` : `https://wa.me/`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-5">
      <AlunoHeroCard aluno={aluno} dr={dr} onWhatsApp={onWhatsApp} onEditar={onEditar} />

      <EvolucaoCard />

      {/* Timeline + Alertas + Check-ins */}
      <div className="grid gap-5 xl:grid-cols-3">
        <TimelineCard />
        <AlertasCard />
        <CheckinsCard checkins={checkins} />
      </div>

      {/* Footer ações */}
      <RodapeAcoes onEditar={onEditar} onEnviarMensagem={onEnviarMensagem} />
    </div>
  );
}


/* ============== Aluno Hero Card ============== */
function AlunoHeroCard({
  aluno, dr, onWhatsApp, onEditar,
}: { aluno: Aluno; dr: number | null; onWhatsApp: () => void; onEditar?: () => void }) {
  return (
    <Card className="p-5">
      <div className="flex gap-5 items-start">
        <AlunoAvatar nome={aluno.nome} fotoUrl={(aluno as any).foto_url} className="h-[96px] w-[96px] text-2xl" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[24px] font-bold tracking-tight text-zinc-900 truncate uppercase">{aluno.nome}</h1>
            <Pill tone="emerald">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {STATUS_LABEL[aluno.status]}
            </Pill>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Pill tone="rose">{(aluno.plano || "MP Elite").toUpperCase()}</Pill>
            {aluno.modalidade && <Pill tone="zinc">{MODALIDADE_LABEL[aluno.modalidade]}</Pill>}
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5 text-[12.5px]">
            <Info icon={<Calendar className="h-3.5 w-3.5" />} label="Entrada" value={fmtDate(aluno.data_d0) ?? "—"} />
            <Info
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Fim do plano"
              value={fmtDate(aluno.data_expiracao) ?? "—"}
              extra={
                dr !== null && aluno.status !== "cancelado" && aluno.status !== "renovado" ? (
                  <span
                    className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md ${
                      dr < 0
                        ? "bg-rose-50 text-rose-600"
                        : dr < 7
                        ? "bg-amber-50 text-amber-700"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {dr < 0 ? `vencido ${Math.abs(dr)}d` : `${dr}d`}
                  </span>
                ) : null
              }
            />
            <Info icon={<Smile className="h-3.5 w-3.5" />} label="Idade" value={formatIdade(aluno.data_nascimento)} />
            <Info icon={<Activity className="h-3.5 w-3.5" />} label="IMC" value={formatIMC(aluno.peso_kg, aluno.altura_cm)} />
            <Info icon={<Activity className="h-3.5 w-3.5" />} label="Altura" value={aluno.altura_cm ? `${(aluno.altura_cm / 100).toFixed(2).replace(".", ",")} m` : "—"} />
            <Info icon={<Activity className="h-3.5 w-3.5" />} label="Peso" value={aluno.peso_kg ? `${aluno.peso_kg} kg` : "—"} />
          </div>
        </div>
      </div>

      {/* Ações horizontais (estilo do mockup) */}
      <div className="mt-4 flex items-center gap-2 flex-wrap">
        <button
          onClick={onWhatsApp}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-[13px] font-semibold shadow-[0_8px_22px_-8px_color-mix(in_oklab,var(--primary)_55%,transparent)] transition active:scale-[0.98]"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </button>
        <button className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-white ring-1 ring-zinc-200 hover:bg-zinc-50 text-[13px] font-semibold text-zinc-800 transition">
          <Phone className="h-4 w-4 text-zinc-500" /> Ligar
        </button>
        <button
          onClick={onEditar}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-white ring-1 ring-zinc-200 hover:bg-zinc-50 text-[13px] font-semibold text-zinc-800 transition"
        >
          <Send className="h-4 w-4 text-zinc-500" /> E-mail
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Mais"
              className="inline-flex items-center justify-center h-11 w-11 rounded-xl bg-white ring-1 ring-zinc-200 hover:bg-zinc-50 text-zinc-700 transition"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEditar} className="cursor-pointer">
              <Pencil className="h-4 w-4 mr-2" /> Editar perfil
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

/* ============== Evolução ============== */
function EvolucaoCard() {
  const [tab, setTab] = useState<"peso" | "medidas" | "score" | "aderencia">("peso");
  const data: Array<{ d: string; v: number }> = [];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <CardTitle title="Evolução" />
        <div className="flex items-center gap-1 bg-zinc-100 rounded-xl p-1">
          {(["peso", "medidas", "score", "aderencia"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 h-7 text-[12px] font-semibold rounded-lg transition ${
                tab === t ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {t === "peso" ? "Peso" : t === "medidas" ? "Medidas" : t === "score" ? "Score" : "Aderência"}
            </button>
          ))}
        </div>
        <select className="text-[12px] font-medium text-zinc-700 bg-zinc-50 ring-1 ring-zinc-200 rounded-lg px-2.5 h-8">
          <option>Últimos 30 dias</option>
          <option>Últimos 90 dias</option>
          <option>Tudo</option>
        </select>
      </div>

      <div className="mt-4 h-[220px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[12px] text-zinc-400">
            Sem dados suficientes para esta visualização.
          </div>
        ) : (
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="evoFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RED} stopOpacity={0.18} />
                <stop offset="100%" stopColor={RED} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#F1F1F4" vertical={false} />
            <XAxis dataKey="d" tick={{ fontSize: 11, fill: "#9A9AA3" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9A9AA3" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #EFEFF2", fontSize: 12 }}
              labelStyle={{ fontWeight: 600, color: "#18181B" }}
              formatter={(v: any) => [`${v} kg`, "Peso"]}
            />
            <Area type="monotone" dataKey="v" stroke={RED} strokeWidth={2.2} fill="url(#evoFill)" dot={{ r: 2.5, fill: RED, strokeWidth: 0 }} activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/* ============== Timeline ============== */
function TimelineCard() {
  const events: Array<{ date: string; title: string; sub: string; icon: any; tone: string }> = [];
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <CardTitle title="Timeline" />
        <button className="text-[11.5px] font-semibold text-rose-600 hover:text-rose-700">Ver tudo</button>
      </div>
      {events.length === 0 && (
        <div className="mt-4 px-3 py-6 text-center text-[12px] text-zinc-400">
          Sem eventos registrados.
        </div>
      )}
      <ul className="mt-4 space-y-3">
        {events.map((e, i) => {
          const Icon = e.icon;
          const tone = e.tone === "emerald" ? "bg-emerald-50 text-emerald-600"
            : e.tone === "violet" ? "bg-violet-50 text-violet-600"
            : e.tone === "amber" ? "bg-amber-50 text-amber-600"
            : "bg-rose-50 text-rose-500";
          return (
            <li key={i} className="flex items-start gap-3">
              <span className={`h-8 w-8 rounded-full ${tone} flex items-center justify-center shrink-0`}>
                <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10.5px] font-semibold text-zinc-400 tabular-nums">{e.date}</div>
                <div className="text-[13px] font-semibold text-zinc-900 leading-tight">{e.title}</div>
                <div className="text-[11.5px] text-zinc-500">{e.sub}</div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ============== Alertas ============== */
function AlertasCard() {
  const items: Array<{ icon: any; tone: string; title: string; sub: string; action: string }> = [];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <CardTitle title="Alertas" />
        <button className="text-[11.5px] font-semibold text-rose-600 hover:text-rose-700">Ver todos</button>
      </div>
      {items.length === 0 && (
        <div className="mt-4 px-3 py-6 text-center text-[12px] text-zinc-400">
          Nenhum alerta no momento.
        </div>
      )}
      <ul className="mt-4 space-y-2.5">
        {items.map((it, i) => {
          const Icon = it.icon;
          const tone = it.tone === "rose" ? "bg-rose-50 text-rose-500"
            : it.tone === "amber" ? "bg-amber-50 text-amber-600"
            : "bg-emerald-50 text-emerald-600";
          const btnTone = it.tone === "emerald"
            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200";
          return (
            <li key={i} className="flex items-center gap-3">
              <span className={`h-9 w-9 rounded-full ${tone} flex items-center justify-center shrink-0`}>
                <Icon className="h-4 w-4" strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-semibold text-zinc-900 leading-tight truncate">{it.title}</div>
                <div className="text-[10.5px] text-zinc-500">{it.sub}</div>
              </div>
              <button className={`text-[11px] font-semibold rounded-lg px-2.5 h-7 transition shrink-0 ${btnTone}`}>{it.action}</button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ============== Check-ins ============== */
function CheckinsCard({ checkins }: { checkins: any[] }) {
  const rows = checkins.slice(0, 7);
  const energiaLabel = (n: number) => ["Muito baixa", "Baixa", "Normal", "Alta", "Muito alta"][n - 1] ?? "—";
  const humorLabel = (n: number) => ["Muito ruim", "Ruim", "Normal", "Bem", "Muito bem"][n] ?? "—";
  const fmtDateBR = (s: string) => new Date(s).toLocaleDateString("pt-BR");
  const fmtSono = (h: number) => {
    const m = Math.round(h * 60);
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <CardTitle title="Últimos check-ins" />
        <button className="text-[11.5px] font-semibold text-rose-600 hover:text-rose-700">Ver todos</button>
      </div>
      <div className="mt-3 -mx-2">
        <div className="grid grid-cols-[1.05fr_0.85fr_0.95fr_1fr_0.6fr] gap-2 px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          <div>Data</div><div>Sono</div><div>Energia</div><div>Humor</div><div className="text-right">Score</div>
        </div>
        {rows.length === 0 && (
          <div className="px-2 py-6 text-center text-[12px] text-zinc-400">
            Nenhum check-in registrado ainda.
          </div>
        )}
        <ul className="space-y-0.5">
          {rows.map((r, i) => (
            <li key={i} className="grid grid-cols-[1.05fr_0.85fr_0.95fr_1fr_0.6fr] gap-2 px-2 py-2 rounded-lg hover:bg-zinc-50 text-[12.5px]">
              <div className="font-semibold text-zinc-900 tabular-nums">{fmtDateBR(r.data_checkin)}</div>
              <div className="inline-flex items-center gap-1 text-zinc-700"><Moon className="h-3 w-3 text-violet-500" />{fmtSono(r.sono_horas)}</div>
              <div className="inline-flex items-center gap-1 text-zinc-700"><Zap className="h-3 w-3 text-amber-500" />{energiaLabel(r.energia)}</div>
              <div className="inline-flex items-center gap-1 text-zinc-700"><Smile className="h-3 w-3 text-emerald-500" />{humorLabel(r.humor)}</div>
              <div className="text-right font-bold text-emerald-600 tabular-nums">+{r.score_gerado || 0}</div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/* ============== Rodapé Ações ============== */
function RodapeAcoes({ onEditar, onEnviarMensagem }: { onEditar?: () => void; onEnviarMensagem?: () => void }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-2">
        <FooterBtn icon={<Pencil className="h-4 w-4" />} label="Editar dados" onClick={onEditar} />
        <FooterBtn icon={<MessageCircle className="h-4 w-4" />} label="Enviar mensagem" onClick={onEnviarMensagem} />
        <FooterBtn icon={<FileText className="h-4 w-4" />} label="Enviar plano" />
        <FooterBtn icon={<Wallet className="h-4 w-4" />} label="Registrar pagamento" />
      </div>
    </Card>
  );
}

/* ============== Primitives ============== */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`bg-white rounded-2xl ring-1 ring-zinc-100 shadow-[0_2px_8px_-4px_rgba(15,15,20,0.04),0_8px_30px_-12px_rgba(15,15,20,0.06)] ${className}`}
    >
      {children}
    </motion.div>
  );
}

function CardTitle({ title }: { title: string }) {
  return <h3 className="text-[14px] font-bold tracking-tight text-zinc-900 uppercase">{title}</h3>;
}

function Pill({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "zinc" | "rose" | "emerald" }) {
  const cls = tone === "rose" ? "bg-rose-50 text-rose-600 ring-rose-100"
    : tone === "emerald" ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
    : "bg-zinc-100 text-zinc-700 ring-zinc-200";
  return <span className={`inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-2 py-0.5 rounded-md ring-1 ${cls}`}>{children}</span>;
}

function Info({ icon, label, value, extra }: { icon: React.ReactNode; label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-zinc-400 shrink-0">{icon}</span>
      <span className="text-zinc-500 shrink-0">{label}:</span>
      <span className="font-semibold text-zinc-900 whitespace-nowrap tabular-nums">{value}</span>
      {extra}
    </div>
  );
}

function ActionIcon({
  children, label, onClick, tone,
}: { children: React.ReactNode; label: string; onClick?: () => void; tone?: "emerald" }) {
  const t = tone === "emerald"
    ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_8px_22px_-8px_rgba(16,185,129,0.55)]"
    : "bg-white ring-1 ring-zinc-200 text-zinc-700 hover:bg-zinc-50";
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`h-10 w-10 rounded-xl flex items-center justify-center transition active:scale-95 ${t}`}>
      {children}
    </button>
  );
}

function KpiBig({ icon, label, value, sub, highlight }: { icon: React.ReactNode; label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ring-1 ${highlight ? "ring-rose-100 bg-gradient-to-b from-rose-50/70 to-white" : "ring-zinc-100 bg-gradient-to-b from-white to-zinc-50/40"}`}>
      <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${highlight ? "text-rose-600" : "text-zinc-500"}`}>
        {icon}{label}
      </div>
      <div className={`mt-1 ${highlight ? "text-[26px]" : "text-[22px]"} font-bold text-zinc-900 tabular-nums leading-none`}>{value}</div>
      <div className="mt-1 text-[10.5px] font-semibold text-emerald-600">{sub}</div>
    </div>
  );
}

function KpiRing({ label, value, sub, icon }: { label: string; value: number; sub: string; icon?: React.ReactNode }) {
  const r = 22, c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div className="rounded-xl p-3 ring-1 ring-zinc-100 bg-white flex flex-col items-center text-center">
      <div className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{icon}{label}</div>
      <div className="relative mt-1.5">
        <svg width="58" height="58" viewBox="0 0 58 58">
          <circle cx="29" cy="29" r={r} stroke="#F1F1F4" strokeWidth="5" fill="none" />
          <circle cx="29" cy="29" r={r} stroke={RED} strokeWidth="5" fill="none"
            strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
            transform="rotate(-90 29 29)" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[12.5px] font-bold text-zinc-900 tabular-nums">{value}%</span>
      </div>
      <div className="mt-0.5 text-[10.5px] font-semibold text-zinc-500">{sub}</div>
    </div>
  );
}

function KpiRisk({ risco }: { risco: { label: string; tone: "emerald" | "amber" | "rose" } }) {
  const colors = risco.tone === "emerald"
    ? { bg: "bg-emerald-50 text-emerald-600", text: "text-emerald-600" }
    : risco.tone === "amber"
    ? { bg: "bg-amber-50 text-amber-600", text: "text-amber-600" }
    : { bg: "bg-rose-50 text-rose-500", text: "text-rose-500" };
  return (
    <div className="rounded-xl p-3 ring-1 ring-zinc-100 bg-white flex flex-col items-center text-center justify-center">
      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Risco abandono</div>
      <span className={`mt-2 h-9 w-9 rounded-full ${colors.bg} flex items-center justify-center`}>
        <ShieldCheck className="h-4 w-4" strokeWidth={2.4} />
      </span>
      <div className={`mt-1 text-[12.5px] font-bold ${colors.text}`}>{risco.label}</div>
    </div>
  );
}

function FooterBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white ring-1 ring-zinc-200 hover:bg-zinc-50 text-[12.5px] font-semibold text-zinc-800 transition">
      {icon}{label}
    </button>
  );
}
