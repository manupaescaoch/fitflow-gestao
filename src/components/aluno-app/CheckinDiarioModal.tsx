import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { X, Moon, Zap, Sparkles } from "lucide-react";
import { useAlunoSession } from "@/lib/aluno-session";
import { triggerAlunoDashboardRefetch } from "@/lib/aluno-dashboard-store";
import {
  getCheckinHoje,
  salvarCheckinDiario,
} from "@/server/checkin-diario.functions";

const STORAGE_KEY = "mpteam:checkin-diario";
const RED = "#F70906";

const sonoLabels = ["Péssimo", "Ruim", "Ok", "Bom", "Excelente"];
const energiaLabels = ["Muito baixa", "Baixa", "Normal", "Alta", "Muito alta"];
const humorEmojis = ["😭", "😕", "😐", "🙂", "😎"];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function CheckinDiarioModal() {
  const { session } = useAlunoSession();
  const [open, setOpen] = useState(false);
  const [horas, setHoras] = useState(7);
  const [qualidade, setQualidade] = useState<number | null>(3);
  const [energia, setEnergia] = useState<number | null>(3);
  const [humor, setHumor] = useState<number | null>(2);
  const [savedToast, setSavedToast] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const getHoje = useServerFn(getCheckinHoje);
  const salvar = useServerFn(salvarCheckinDiario);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!session?.id) return;
    // Segunda-feira: check-in contextual próprio
    if (new Date().getDay() === 1) return;

    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached === todayKey()) return;

    let cancel = false;
    (async () => {
      try {
        const res = await getHoje();
        if (cancel) return;
        if (res.ok && res.checkin) {
          localStorage.setItem(STORAGE_KEY, todayKey());
          return;
        }
        setTimeout(() => !cancel && setOpen(true), 450);
      } catch {
        setTimeout(() => !cancel && setOpen(true), 450);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [session?.id, getHoje]);

  function closePular() {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, todayKey());
    }
    setOpen(false);
  }

  async function handleSalvar() {
    if (!session?.id || saving) return;
    setSaving(true);
    setErro(null);
    try {
      const res = await salvar({
        data: {
          sono_horas: horas,
          qualidade_sono: qualidade !== null ? qualidade + 1 : null,
          energia: energia !== null ? energia + 1 : null,
          humor: humor,
        },
      });
      if (!res.ok) {
        setErro(res.error || "Erro ao salvar");
        setSaving(false);
        return;
      }
      localStorage.setItem(STORAGE_KEY, todayKey());
      setOpen(false);
      setSavedToast(true);
      triggerAlunoDashboardRefetch(res.checkin ?? undefined);
      setTimeout(() => setSavedToast(false), 2200);
    } catch (e: any) {
      setErro(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 60, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-[0_-10px_60px_-10px_rgba(0,0,0,0.25)] max-h-[88dvh] overflow-y-auto"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              {/* Header */}
              <div className="px-4 pt-4 pb-2 flex items-start justify-between">
                <div>
                  <h2 className="text-[20px] leading-tight font-extrabold tracking-tight text-black">
                    Bom dia <span>☀️</span>
                  </h2>
                  <p className="mt-0.5 text-[11.5px] text-black/50 font-medium">
                    Seu shape entrega como você viveu ontem.
                  </p>
                </div>
                <button
                  onClick={closePular}
                  className="h-7 w-7 rounded-full bg-black/5 flex items-center justify-center text-black/55 active:scale-95 transition"
                  aria-label="Fechar"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.6} />
                </button>
              </div>

              <div className="px-4 space-y-3.5 pb-4">
                {/* Horas de sono */}
                <section className="border-t border-black/5 pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-black/[0.04] flex items-center justify-center text-[12px]">
                        😴
                      </span>
                      <h3 className="text-[13px] font-bold text-black">Horas de sono</h3>
                    </div>
                    <span className="text-[16px] font-extrabold text-black tabular-nums">
                      {horas}h
                    </span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={9}
                    step={1}
                    value={horas}
                    onChange={(e) => setHoras(Number(e.target.value))}
                    className="mt-2 w-full appearance-none h-1.5 rounded-full bg-black/8 accent-[#F70906]
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                      [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#F70906]
                      [&::-webkit-slider-thumb]:shadow"
                    style={{
                      background: `linear-gradient(to right, ${RED} 0%, ${RED} ${((horas - 3) / 6) * 100}%, rgba(0,0,0,0.08) ${((horas - 3) / 6) * 100}%, rgba(0,0,0,0.08) 100%)`,
                    }}
                  />
                  <div className="mt-1 flex justify-between text-[9.5px] text-black/40 font-medium">
                    <span>3h</span>
                    <span>6h</span>
                    <span>9h</span>
                  </div>
                </section>

                <ScalePicker
                  emoji={<Moon className="h-3 w-3 text-black/55" />}
                  title="Qualidade do sono"
                  labels={sonoLabels}
                  value={qualidade}
                  onChange={setQualidade}
                />

                <ScalePicker
                  emoji={<Zap className="h-3 w-3 text-[#F5A524]" fill="#F5A524" />}
                  title="Energia"
                  labels={energiaLabels}
                  value={energia}
                  onChange={setEnergia}
                />

                {/* Humor */}
                <section className="border-t border-black/5 pt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-6 w-6 rounded-full bg-black/[0.04] flex items-center justify-center text-[12px]">
                      🙂
                    </span>
                    <h3 className="text-[13px] font-bold text-black">Humor</h3>
                  </div>
                  <div className="flex items-center justify-between">
                    {humorEmojis.map((e, i) => {
                      const active = humor === i;
                      return (
                        <button
                          key={i}
                          onClick={() => setHumor(i)}
                          className={`h-10 w-10 rounded-full flex items-center justify-center text-[19px] transition-all active:scale-95 ${
                            active
                              ? "bg-white ring-2 ring-[#F70906] shadow-[0_0_0_4px_rgba(247,9,6,0.08)]"
                              : "bg-black/[0.04]"
                          }`}
                          aria-pressed={active}
                        >
                          {e}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {erro && (
                  <p className="text-[11px] text-[#F70906] font-semibold text-center">
                    {erro}
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 pb-4 pt-2 border-t border-black/5 flex items-center gap-3 bg-white">
                <button
                  onClick={closePular}
                  disabled={saving}
                  className="px-4 h-11 text-[13px] font-bold text-black/60 active:scale-[0.98] transition disabled:opacity-50"
                >
                  Pular
                </button>
                <button
                  onClick={handleSalvar}
                  disabled={saving}
                  className="flex-1 h-11 rounded-2xl bg-[#F70906] text-white text-[13px] font-bold shadow-[0_8px_22px_-8px_rgba(247,9,6,0.6)] active:scale-[0.98] transition disabled:opacity-60"
                >
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {savedToast && (
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--mobile-bottom-nav-h,60px)+env(safe-area-inset-bottom,0px)+16px)] z-[110] flex items-center gap-2.5 rounded-full bg-white px-4 py-2.5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)] ring-1 ring-black/5"
          >
            <span className="h-7 w-7 rounded-full bg-emerald-500/12 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.6} />
            </span>
            <div className="leading-tight">
              <div className="text-[13px] font-extrabold text-emerald-600">+5 Score</div>
              <div className="text-[10.5px] text-black/55 font-medium">Check-in concluído!</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ScalePicker({
  emoji,
  title,
  labels,
  value,
  onChange,
}: {
  emoji: React.ReactNode;
  title: string;
  labels: string[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <section className="border-t border-black/5 pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-black/[0.04] flex items-center justify-center">
            {emoji}
          </span>
          <h3 className="text-[13px] font-bold text-black">{title}</h3>
        </div>
        <span className="text-[11.5px] font-semibold text-black/55">
          {value !== null ? labels[value] : ""}
        </span>
      </div>
      <div className="flex items-start justify-between">
        {labels.map((label, i) => {
          const active = value === i;
          return (
            <button
              key={i}
              onClick={() => onChange(i)}
              className="flex flex-col items-center gap-1 active:scale-95 transition"
              aria-pressed={active}
            >
              <span
                className={`h-9 w-9 rounded-full flex items-center justify-center text-[12.5px] font-extrabold transition-all ${
                  active
                    ? "bg-[#F70906] text-white shadow-[0_8px_18px_-6px_rgba(247,9,6,0.55)]"
                    : "bg-black/[0.04] text-black/70"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-[9.5px] font-semibold ${
                  active ? "text-[#F70906]" : "text-black/45"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
