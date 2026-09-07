import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Flame,
  Beef,
  Wheat,
  Droplet,
  ChevronDown,
  ChevronRight,
  Droplets,
  ArrowRight,
  Check,
  Coffee,
  Apple,
  UtensilsCrossed,
  Cookie,
  Moon,
  Utensils,
  Sun,
  Salad,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAlunoSession } from "@/lib/aluno-session";
import { ProfileAvatar } from "@/components/aluno-app/ProfileAvatar";
import { useServerFn } from "@tanstack/react-start";
import {
  getDietaAluno,
  type AlunoDietaPlano,
  type AlunoDietaRefeicao,
  type AlunoDietaItem,
} from "@/server/aluno-dieta.functions";
import { toggleRefeicao } from "@/server/aluno-kpis.functions";
import { useAlunoDashboard } from "@/lib/aluno-dashboard-store";
import { toast } from "sonner";

export const Route = createFileRoute("/aluno/dieta")({
  component: AlunoDieta,
});

function fmtNum(n: number, dig = 0) {
  return Math.round(n * Math.pow(10, dig)) / Math.pow(10, dig);
}

/**
 * Limpa observações vindas do CRM, que podem conter:
 *  - Marcador __PRESCRICAO_JSON__:{...} no início (ignorado)
 *  - HTML "sujo" com <div>, <span style="...">, <br>
 * Retorna HTML simples e seguro para renderização.
 */
function cleanObservacoes(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw);

  // Remove marcador [modo:texto_livre] (ou similar) no início
  s = s.replace(/^\s*\[modo:[^\]]+\]\s*/i, "");

  // Remove bloco __PRESCRICAO_JSON__:{...} se existir
  const jsonIdx = s.indexOf("__PRESCRICAO_JSON__");
  if (jsonIdx !== -1) {
    const braceStart = s.indexOf("{", jsonIdx);
    if (braceStart !== -1) {
      let depth = 0;
      let end = -1;
      for (let i = braceStart; i < s.length; i++) {
        if (s[i] === "{") depth++;
        else if (s[i] === "}") {
          depth--;
          if (depth === 0) { end = i + 1; break; }
        }
      }
      if (end !== -1) {
        try {
          const parsed = JSON.parse(s.slice(braceStart, end));
          if (parsed && typeof parsed.descricao === "string") {
            s = parsed.descricao;
          } else {
            s = s.slice(0, jsonIdx) + s.slice(end);
          }
        } catch {
          s = s.slice(0, jsonIdx) + s.slice(end);
        }
      }
    }
  }

  // Remove atributos style/class
  s = s.replace(/\s(?:style|class)="[^"]*"/gi, "");
  // Converte <div> em quebra de linha
  s = s.replace(/<\/div>/gi, "\n").replace(/<div[^>]*>/gi, "");
  s = s.replace(/<\/p>/gi, "\n").replace(/<p[^>]*>/gi, "");
  s = s.replace(/<br\s*\/?>(\s*)/gi, "\n");
  s = s.replace(/<\/?span[^>]*>/gi, "");
  // Permite só b/strong/i/em
  s = s.replace(/<(?!\/?(b|strong|i|em)\b)[^>]+>/gi, "");

  // Decodifica entidades básicas
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  // Substitui referências antigas pela marca atual
  // Primeiro remove qualquer formatação HTML em torno do link/cupom para reescrever depois
  s = s.replace(
    /<\/?(strong|b|a|span|font)[^>]*>/gi,
    (m) => (/<\/?(strong|b)\b/i.test(m) ? m : ""),
  );
  s = s
    .replace(/Soldiers\s*Nutrition/gi, "FORCE LABZ")
    .replace(/https?:\/\/(www\.)?soldiersnutrition\.com\.br\/?/gi, "WWW.FORCELABZ.COM")
    .replace(/(www\.)?soldiersnutrition\.com\.br\/?/gi, "WWW.FORCELABZ.COM")
    // Normaliza qualquer variação de FORCE LABZ + .com / .com.br para WWW.FORCELABZ.COM
    .replace(
      /(?:https?:\/\/)?(?:www\.)?force\s*labz\.com(?:\.br)?\/?/gi,
      "WWW.FORCELABZ.COM",
    )
    .replace(/\*+/g, "")
    .replace(/MANU\s*PAES/gi, "MANUPAES");

  // Normaliza múltiplas quebras
  s = s.replace(/\n{3,}/g, "\n\n").trim();

  // Destaca títulos (linhas em CAIXA ALTA terminadas com ":" ou "?") em vermelho
  const lines = s.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    // Remove tags inline para detectar título
    const stripped = trimmed.replace(/<\/?(b|strong|i|em)[^>]*>/gi, "").trim();
    const isHeading =
      /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 ,/\-–—():?!"']+[:?!]?$/.test(stripped) &&
      /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(stripped) &&
      stripped.length <= 80 &&
      stripped === stripped.toUpperCase();
    if (isHeading) {
      return `<strong style="color:#F70906;font-weight:800">${stripped}</strong>`;
    }
    // Destaca cupom MANU PAES e link forcelabz
    let l = line
      .replace(
        /MANUPAES/g,
        '<strong style="color:#F70906;font-weight:800">MANUPAES</strong>',
      )
      .replace(
        /WWW\.FORCELABZ\.COM/gi,
        '<a href="https://www.forcelabz.com/" target="_blank" rel="noopener" style="color:#F70906;font-weight:800">WWW.FORCELABZ.COM</a>',
      )
      .replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener" style="color:#F70906;font-weight:800">$1</a>',
      )
      .replace(/FORCE LABZ/g, '<strong>FORCE LABZ</strong>');
    return l;
  });
  return lines.join("<br/>");
}

function iconRefeicao(nome: string) {
  const n = nome.toLowerCase();
  if (/(café|cafe|manh)/.test(n) && !/lanche/.test(n)) return Coffee;
  if (/lanche.*manh|colação|colacao/.test(n)) return Apple;
  if (/almoço|almoco/.test(n)) return UtensilsCrossed;
  if (/lanche.*tarde|pré.?treino|pre.?treino|pós.?treino|pos.?treino/.test(n)) return Cookie;
  if (/jantar|noite/.test(n)) return Moon;
  if (/ceia/.test(n)) return Moon;
  if (/sobremesa|salada/.test(n)) return Salad;
  if (/manh/.test(n)) return Sun;
  return Utensils;
}

function MacroCard({
  value,
  unit,
  Icon,
}: {
  value: string;
  unit: string;
  Icon: typeof Flame;
}) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/5 shadow-[0_2px_10px_-6px_rgba(0,0,0,0.08)] p-3 flex flex-col items-start">
      <div className="h-7 w-7 rounded-lg bg-primary/8 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={2.4} />
      </div>
      <div className="mt-2 text-[20px] leading-none font-extrabold tracking-tight text-black tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold tracking-[0.18em] text-black/45">
        {unit}
      </div>
    </div>
  );
}

function ItemLine({ it }: { it: AlunoDietaItem }) {
  const qtd = it.quantidade > 0 ? `${fmtNum(it.quantidade)}${it.unidade || "g"}` : null;
  return (
    <li className="flex gap-2 text-[12.5px] text-black/75 leading-snug">
      <span className="text-black/30 mt-0.5">•</span>
      <span className="flex-1">
        {it.nome}
        {qtd && <span className="text-black/45"> · {qtd}</span>}
      </span>
    </li>
  );
}

function RefeicaoCard({
  r,
  idx,
  doneInitial,
  onToggle,
}: {
  r: AlunoDietaRefeicao;
  idx: number;
  doneInitial: boolean;
  onToggle: (next: boolean) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(idx === 0);
  const [done, setDone] = useState(doneInitial);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDone(doneInitial);
  }, [doneInitial]);
  const Icon = iconRefeicao(r.nome);
  const temSubs = r.itens.some((i) => i.substitutos.length > 0);
  const isTextoLivre = /^\s*\[modo:texto_livre\]/i.test(r.observacoes ?? "");
  const hideMacros = isTextoLivre && r.totais.kcal === 0 && r.totais.ptn === 0 && r.totais.cho === 0 && r.totais.lip === 0;

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
      className="rounded-2xl bg-white ring-1 ring-black/5 shadow-[0_2px_12px_-6px_rgba(0,0,0,0.08)] overflow-hidden"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3.5 text-left active:bg-black/[0.015] transition-colors"
      >
        <div className="h-10 w-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
          <Icon className="h-[18px] w-[18px] text-primary" strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-bold text-black leading-tight">{r.nome}</h3>
          <p className="text-[11px] text-black/45 font-medium mt-0.5 tabular-nums">
            {r.horario ? `${r.horario} • ` : ""}
            {hideMacros ? "Plano descritivo" : `${fmtNum(r.totais.kcal)} kcal`}
          </p>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="h-4 w-4 text-black/40" strokeWidth={2.4} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3">
              {!hideMacros && (
              <div className="flex items-center gap-2">
                <span className="flex-1 rounded-lg bg-[#2F6BFF]/8 text-center py-1.5">
                  <span className="text-[10px] font-bold text-[#2F6BFF] tracking-wide">P</span>
                  <span className="text-[12px] font-extrabold text-black ml-1 tabular-nums">
                    {fmtNum(r.totais.ptn)}g
                  </span>
                </span>
                <span className="flex-1 rounded-lg bg-[#F5A524]/10 text-center py-1.5">
                  <span className="text-[10px] font-bold text-[#F5A524] tracking-wide">C</span>
                  <span className="text-[12px] font-extrabold text-black ml-1 tabular-nums">
                    {fmtNum(r.totais.cho)}g
                  </span>
                </span>
                <span className="flex-1 rounded-lg bg-[#7C3AED]/8 text-center py-1.5">
                  <span className="text-[10px] font-bold text-[#7C3AED] tracking-wide">G</span>
                  <span className="text-[12px] font-extrabold text-black ml-1 tabular-nums">
                    {fmtNum(r.totais.lip)}g
                  </span>
                </span>
              </div>
              )}

              {r.itens.length === 0 ? (
                isTextoLivre ? null : (
                  <p className="text-[12px] text-black/45 italic px-1">
                    Nenhum item cadastrado nesta refeição.
                  </p>
                )
              ) : (
                <div className="rounded-xl bg-[#FAFAFA] ring-1 ring-black/[0.04] p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="h-4 w-4 rounded-full bg-primary text-white text-[9px] font-extrabold flex items-center justify-center">
                      1
                    </span>
                    <span className="text-[11px] font-extrabold tracking-[0.14em] text-black/70 uppercase">
                      Opção principal
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {r.itens.map((it) => (
                      <ItemLine key={it.id} it={it} />
                    ))}
                  </ul>
                </div>
              )}

              {temSubs && (
                <div className="space-y-2">
                  {r.itens.map((it) =>
                    it.substitutos.length === 0 ? null : (
                      <div
                        key={it.id}
                        className="rounded-xl bg-[#FAFAFA] ring-1 ring-black/[0.04] p-3"
                      >
                        <div className="text-[10.5px] font-extrabold tracking-[0.14em] text-black/55 uppercase mb-1.5">
                          Substituições para {it.nome}
                        </div>
                        <ul className="space-y-1">
                          {it.substitutos.map((s) => (
                            <ItemLine key={s.id} it={s} />
                          ))}
                        </ul>
                      </div>
                    ),
                  )}
                </div>
              )}

              {r.observacoes && (() => {
                const cleaned = cleanObservacoes(r.observacoes);
                if (!cleaned) return null;
                return (
                  <div className="rounded-xl bg-[#FAFAFA] ring-1 ring-black/[0.04] p-3 flex items-start gap-2.5">
                    <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Droplets className="h-3.5 w-3.5 text-primary" strokeWidth={2.4} />
                    </div>
                    <div
                      className="text-[12px] text-black/65 leading-snug pt-0.5 [&_strong]:font-extrabold"
                      dangerouslySetInnerHTML={{ __html: cleaned }}
                    />
                  </div>
                );
              })()}

              <div className="flex items-center gap-2 pt-1">
                <button
                  disabled={saving}
                  onClick={async () => {
                    const next = !done;
                    setDone(next);
                    setSaving(true);
                    try {
                      await onToggle(next);
                      if (next) toast.success("Refeição concluída +5 Score");
                    } catch (e: any) {
                      setDone(!next);
                      toast.error(e?.message || "Não foi possível salvar");
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className={`w-full h-11 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 shadow-[0_6px_20px_-8px_color-mix(in_oklab,var(--primary)_55%,transparent)] active:scale-[0.98] transition ${
                    done ? "bg-black text-white" : "bg-primary text-white"
                  }`}
                >
                  {done ? (
                    <>
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      Concluída
                    </>
                  ) : (
                    <>
                      Concluir refeição
                      <span className="text-[10px] font-extrabold opacity-90 ml-0.5">+5 Score</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SkeletonRow() {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-black/5 p-3.5 flex items-center gap-3 animate-pulse">
      <div className="h-10 w-10 rounded-xl bg-black/5" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-2/3 rounded bg-black/5" />
        <div className="h-2.5 w-1/3 rounded bg-black/5" />
      </div>
    </div>
  );
}

function EmptyDieta() {
  return (
    <div className="rounded-3xl bg-white ring-1 ring-black/5 p-8 text-center shadow-[0_4px_18px_-12px_rgba(0,0,0,0.08)]">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/8 flex items-center justify-center mb-4">
        <Utensils className="h-6 w-6 text-primary" strokeWidth={2} />
      </div>
      <h3 className="text-[16px] font-extrabold text-black tracking-tight">
        Nenhuma dieta ativa
      </h3>
      <p className="mt-1.5 text-[12.5px] text-black/55 font-medium leading-relaxed max-w-[280px] mx-auto">
        Aguardando sua dieta ser liberada pela equipe MPTEAM. Você será notificado assim que estiver pronta.
      </p>
    </div>
  );
}

function AlunoDieta() {
  const { session } = useAlunoSession();
  const fetchDieta = useServerFn(getDietaAluno);
  const toggleFn = useServerFn(toggleRefeicao);
  const { data: dashboard, refetch: refetchDashboard } = useAlunoDashboard();
  const [plano, setPlano] = useState<AlunoDietaPlano | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.id) return;
    let cancel = false;
    setLoading(true);
    fetchDieta()
      .then((r) => {
        if (!cancel) setPlano(r.plano);
      })
      .catch(() => {
        if (!cancel) setPlano(null);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [session?.id, fetchDieta]);

  const macros = useMemo(() => {
    if (!plano) return null;
    const realZero =
      plano.totais.kcal === 0 &&
      plano.totais.ptn === 0 &&
      plano.totais.cho === 0 &&
      plano.totais.lip === 0;
    const t = realZero && plano.totais_descricao ? plano.totais_descricao : plano.totais;
    return [
      { value: fmtNum(t.kcal).toLocaleString("pt-BR"), unit: "KCAL", Icon: Flame },
      { value: `${fmtNum(t.ptn)}g`, unit: "PTN", Icon: Beef },
      { value: `${fmtNum(t.cho)}g`, unit: "CHO", Icon: Wheat },
      { value: `${fmtNum(t.lip)}g`, unit: "LIP", Icon: Droplet },
    ];
  }, [plano]);

  const refeicoesFeitasIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of dashboard?.refeicoes_hoje ?? []) {
      if (r.refeicao_id) ids.add(r.refeicao_id);
    }
    return ids;
  }, [dashboard?.refeicoes_hoje]);

  return (
    <div className="px-4 pt-3 pb-6 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] leading-tight font-extrabold tracking-tight text-black">
            Plano Alimentar
          </h1>
          <p className="mt-1 text-[12px] text-black/50 font-medium truncate">
            {plano
              ? plano.nome
              : loading
                ? "Carregando..."
                : "Aguardando liberação"}
          </p>
        </div>
        <ProfileAvatar />
      </header>

      {loading ? (
        <>
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl bg-white ring-1 ring-black/5 p-3 h-[88px] animate-pulse" />
            ))}
          </div>
          <div className="space-y-2.5">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </>
      ) : !plano ? (
        <EmptyDieta />
      ) : (
        <>
          {macros && (
            <section>
              <div className="flex items-center justify-between px-1 mb-2">
                <h2 className="text-[10px] font-extrabold tracking-[0.2em] text-black/55">
                  MACROS DO DIA
                </h2>
                {plano.meta_kcal && (
                  <span className="text-[11px] font-semibold text-black/40 inline-flex items-center gap-0.5">
                    Meta {fmtNum(plano.meta_kcal).toLocaleString("pt-BR")} kcal
                    <ChevronRight className="h-3 w-3 text-primary" strokeWidth={2.6} />
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {macros.map((m) => (
                  <MacroCard key={m.unit} value={m.value} unit={m.unit} Icon={m.Icon} />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between px-1 mb-2">
              <h2 className="text-[10px] font-extrabold tracking-[0.2em] text-black/55">
                REFEIÇÕES
              </h2>
              <span className="text-[11px] font-semibold text-black/40">
                {plano.refeicoes.length} no dia
              </span>
            </div>
            {plano.refeicoes.length === 0 ? (
              <div className="rounded-2xl bg-white ring-1 ring-black/5 p-6 text-center">
                <p className="text-[12.5px] text-black/55 font-medium">
                  Nenhuma refeição cadastrada neste plano ainda.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {plano.refeicoes.map((r, i) => (
                  <RefeicaoCard
                    key={r.id}
                    r={r}
                    idx={i}
                    doneInitial={refeicoesFeitasIds.has(r.id)}
                    onToggle={async (next) => {
                      if (!session?.id) return;
                      const res = await toggleFn({
                        data: {
                          refeicao_id: r.id,
                          refeicao_nome: r.nome,
                          feito: next,
                        },
                      });
                      if (!res.ok) throw new Error(res.error);
                      refetchDashboard();
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {plano.observacoes && (
            (() => {
              const cleaned = cleanObservacoes(plano.observacoes);
              if (!cleaned) return null;
              return (
                <div className="rounded-2xl bg-white ring-1 ring-black/5 p-4">
                  <h3 className="text-[10px] font-extrabold tracking-[0.2em] text-black/55 mb-3">
                    OBSERVAÇÕES DO PLANO
                  </h3>
                  <div
                    className="text-[12.5px] text-black/70 leading-relaxed space-y-1 [&_b]:font-semibold [&_b]:text-black [&_strong]:font-semibold [&_strong]:text-black"
                    dangerouslySetInnerHTML={{ __html: cleaned }}
                  />
                </div>
              );
            })()
          )}

          <p className="text-center text-[11px] text-black/35 font-medium pt-2">
            Plano personalizado MPTEAM • Atualizado em{" "}
            {new Date(plano.atualizado_em).toLocaleDateString("pt-BR")}
          </p>
        </>
      )}
    </div>
  );
}
