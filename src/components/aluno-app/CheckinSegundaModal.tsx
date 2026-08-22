import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Sparkles, ArrowRight } from "lucide-react";

const STORAGE_KEY = "mpteam:checkin-segunda";
const RED = "#F70906";

const alimentacaoOpts = ["Excelente", "Boa", "Saí um pouco", "Chutei o balde"];
const exageroOpts = ["Não", "Um pouco", "Sim"];
const sonoOpts = ["Muito mal", "Mal", "Ok", "Bem", "Excelente"];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function isMonday() {
  return new Date().getDay() === 1;
}

type Resposta = {
  titulo: string;
  texto: string;
};

function gerarResposta(alim: number, exa: number): Resposta {
  if (alim === 3 || exa === 2) {
    return {
      titulo: "Sem culpa. Foco no recomeço.",
      texto:
        "Uma refeição não destrói teu shape. Mas abandonar a semana destrói. Bora fazer o básico hoje.",
    };
  }
  if (alim === 2 || exa === 1) {
    return {
      titulo: "Saiu um pouco. Tudo bem.",
      texto:
        "Final de semana é vida real. Agora aperta o básico nos próximos 5 dias e a semana se ajeita.",
    };
  }
  return {
    titulo: "Boa. Manteve a linha.",
    texto:
      "Agora repete o básico mais 7 dias. Consistência é o que separa quem evolui de quem só treina.",
  };
}

export function CheckinSegundaModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "resposta">("form");

  const [alimentacao, setAlimentacao] = useState<number | null>(null);
  const [exagero, setExagero] = useState<number | null>(null);
  const [sono, setSono] = useState<number | null>(null);
  const [energia, setEnergia] = useState(3);
  const [foco, setFoco] = useState("");

  const [savedToast, setSavedToast] = useState(false);
  const [resposta, setResposta] = useState<Resposta | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMonday()) return;
    const last = localStorage.getItem(STORAGE_KEY);
    if (last !== todayKey()) {
      const t = setTimeout(() => setOpen(true), 450);
      return () => clearTimeout(t);
    }
  }, []);

  function close(saved: boolean) {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, todayKey());
    }
    setOpen(false);
    setStep("form");
    if (saved) {
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2400);
    }
  }

  function salvar() {
    setResposta(gerarResposta(alimentacao ?? 1, exagero ?? 0));
    setStep("resposta");
  }

  const podeSalvar = alimentacao !== null && exagero !== null && sono !== null;

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
              className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-[0_-10px_60px_-10px_rgba(0,0,0,0.25)] max-h-[92dvh] overflow-y-auto"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3 flex items-start justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F70906]/10 text-[#F70906] px-2.5 py-1 text-[10px] font-extrabold tracking-[0.16em] uppercase">
                    Check-in semanal
                  </div>
                  <h2 className="mt-2 text-[24px] leading-tight font-extrabold tracking-tight text-black">
                    Segunda começou.
                  </h2>
                  <p className="mt-1 text-[12.5px] text-black/55 font-medium">
                    O final de semana passou. Agora volta pro controle.
                  </p>
                </div>
                <button
                  onClick={() => close(false)}
                  className="h-8 w-8 rounded-full bg-black/5 flex items-center justify-center text-black/55 active:scale-95 transition shrink-0"
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" strokeWidth={2.6} />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {step === "form" ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-5 space-y-5 pb-5"
                  >
                    {/* Alimentação */}
                    <PillGroup
                      emoji="🍔"
                      title="Alimentação"
                      subtitle="Como foi tua alimentação?"
                      options={alimentacaoOpts}
                      value={alimentacao}
                      onChange={setAlimentacao}
                    />

                    {/* Exageros */}
                    <PillGroup
                      emoji="🍺"
                      title="Exageros"
                      subtitle="Teve exagero?"
                      options={exageroOpts}
                      value={exagero}
                      onChange={setExagero}
                    />

                    {/* Sono */}
                    <PillGroup
                      emoji="😴"
                      title="Sono"
                      subtitle="Como você descansou?"
                      options={sonoOpts}
                      value={sono}
                      onChange={setSono}
                    />

                    {/* Energia hoje */}
                    <section className="border-t border-black/5 pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-7 w-7 rounded-full bg-black/[0.04] flex items-center justify-center text-[14px]">
                            ⚡
                          </span>
                          <h3 className="text-[14px] font-bold text-black">Energia hoje</h3>
                        </div>
                        <span className="text-[18px] font-extrabold text-black tabular-nums">
                          {energia}
                          <span className="text-black/30 text-[12px] font-bold">/5</span>
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={energia}
                        onChange={(e) => setEnergia(Number(e.target.value))}
                        className="mt-3 w-full appearance-none h-1.5 rounded-full bg-black/8
                          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5
                          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                          [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#F70906]
                          [&::-webkit-slider-thumb]:shadow"
                        style={{
                          background: `linear-gradient(to right, ${RED} 0%, ${RED} ${((energia - 1) / 4) * 100}%, rgba(0,0,0,0.08) ${((energia - 1) / 4) * 100}%, rgba(0,0,0,0.08) 100%)`,
                        }}
                      />
                    </section>

                    {/* Foco da semana */}
                    <section className="border-t border-black/5 pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="h-7 w-7 rounded-full bg-black/[0.04] flex items-center justify-center text-[14px]">
                          🎯
                        </span>
                        <h3 className="text-[14px] font-bold text-black">Foco da semana</h3>
                      </div>
                      <input
                        type="text"
                        value={foco}
                        onChange={(e) => setFoco(e.target.value)}
                        placeholder="O que você quer fazer melhor essa semana?"
                        className="w-full h-11 px-3.5 rounded-xl bg-black/[0.03] ring-1 ring-black/5 text-[13px] text-black placeholder:text-black/35 font-medium focus:outline-none focus:ring-2 focus:ring-[#F70906]/40 transition"
                      />
                    </section>
                  </motion.div>
                ) : (
                  <motion.div
                    key="resposta"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="px-5 pb-5"
                  >
                    <div className="rounded-3xl bg-[#FAFAFA] ring-1 ring-black/[0.05] p-5">
                      <div className="h-10 w-10 rounded-2xl bg-[#F70906]/10 flex items-center justify-center mb-3">
                        <Sparkles className="h-5 w-5 text-[#F70906]" strokeWidth={2.4} />
                      </div>
                      <h3 className="text-[18px] font-extrabold text-black tracking-tight leading-tight">
                        {resposta?.titulo}
                      </h3>
                      <p className="mt-2 text-[13.5px] text-black/65 font-medium leading-relaxed">
                        {resposta?.texto}
                      </p>
                    </div>
                    {foco.trim() && (
                      <div className="mt-3 rounded-2xl bg-white ring-1 ring-black/5 p-4">
                        <div className="text-[10px] font-extrabold tracking-[0.2em] text-black/45 uppercase mb-1">
                          Seu foco
                        </div>
                        <p className="text-[13px] font-bold text-black leading-snug">
                          🎯 {foco}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer */}
              <div className="px-5 pb-5 pt-2 border-t border-black/5 flex items-center gap-3 bg-white">
                {step === "form" ? (
                  <>
                    <button
                      onClick={() => close(false)}
                      className="px-5 h-12 text-[14px] font-bold text-black/60 active:scale-[0.98] transition"
                    >
                      Pular
                    </button>
                    <button
                      onClick={salvar}
                      disabled={!podeSalvar}
                      className="flex-1 h-12 rounded-2xl bg-[#F70906] text-white text-[14px] font-bold shadow-[0_8px_22px_-8px_rgba(247,9,6,0.6)] active:scale-[0.98] transition disabled:opacity-40 disabled:shadow-none"
                    >
                      Salvar
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => close(true)}
                    className="flex-1 h-12 rounded-2xl bg-[#F70906] text-white text-[14px] font-bold shadow-[0_8px_22px_-8px_rgba(247,9,6,0.6)] active:scale-[0.98] transition inline-flex items-center justify-center gap-2"
                  >
                    Começar a semana
                    <ArrowRight className="h-4 w-4" strokeWidth={2.8} />
                  </button>
                )}
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
              <div className="text-[13px] font-extrabold text-emerald-600">+10 Score</div>
              <div className="text-[10.5px] text-black/55 font-medium">Semana resetada!</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function PillGroup({
  emoji,
  title,
  subtitle,
  options,
  value,
  onChange,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  options: string[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <section className="border-t border-black/5 pt-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="h-7 w-7 rounded-full bg-black/[0.04] flex items-center justify-center text-[14px]">
          {emoji}
        </span>
        <h3 className="text-[14px] font-bold text-black">{title}</h3>
      </div>
      <p className="text-[12px] text-black/45 font-medium ml-9 mb-2.5">{subtitle}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((label, i) => {
          const active = value === i;
          return (
            <button
              key={i}
              onClick={() => onChange(i)}
              className={`px-3.5 h-9 rounded-full text-[12.5px] font-bold transition active:scale-[0.97] ${
                active
                  ? "bg-[#F70906] text-white shadow-[0_6px_16px_-6px_rgba(247,9,6,0.55)]"
                  : "bg-black/[0.04] text-black/70 ring-1 ring-black/[0.04]"
              }`}
              aria-pressed={active}
            >
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
