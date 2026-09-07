import { useEffect, useState } from "react";
import { logarFalhaPublica } from "@/lib/aluno-publico";
import { ArrowLeft, ArrowRight, Check, Loader2, Send, Star } from "lucide-react";
import mpLogo from "@/assets/mp-logo.png";
import { useServerFn } from "@tanstack/react-start";
import { gerarRespostaFormulario } from "@/server/feedback.functions";
import { notifyFeedbackResponded } from "@/server/notificacoes-feedbacks.functions";
import { criarAlunoPublico } from "@/server/aluno-publico.functions";
import { submeterFormularioPublico } from "@/server/formulario-publico-flow.functions";
import { PhoneDdiInput, splitPhone } from "@/components/publico/PhoneDdiInput";
import { ConfirmarTelefoneModal } from "@/components/publico/ConfirmarTelefoneModal";
import { useAutosaveFormulario, carregarRascunhoServidor } from "@/lib/formulario-autosave";

interface Props {
  formId: string;
  alunoId: string | null;
  token: string;
  onSubmitted: () => Promise<void> | void;
}

type FbData = {
  identificacao: {
    nome_completo: string;
    telefone: string;
    confirmar_telefone: string;
    peso_atual_kg: string;
  };
  evolucao: {
    mudancas_espelho: string;
    comentarios_externos: string;
    foco_4_semanas: string;
  };
  treino: {
    adesao_treino: number | null;
    dificuldades: string;
    sentimento_geral: string;
  };
  dieta: {
    adesao_dieta: number | null;
    finais_de_semana: string;
    sentimento_geral: string;
  };
  qualidade_vida: {
    sono: number | null;
    hidratacao: number | null;
    intestino_ok: "sim" | "nao" | "";
  };
  desabafo: string;
};

const EMPTY: FbData = {
  identificacao: { nome_completo: "", telefone: "", confirmar_telefone: "", peso_atual_kg: "" },
  evolucao: { mudancas_espelho: "", comentarios_externos: "", foco_4_semanas: "" },
  treino: { adesao_treino: null, dificuldades: "", sentimento_geral: "" },
  dieta: { adesao_dieta: null, finais_de_semana: "", sentimento_geral: "" },
  qualidade_vida: { sono: null, hidratacao: null, intestino_ok: "" },
  desabafo: "",
};

const STEP_LABELS = [
  "Identificação",
  "Como você tá evoluindo?",
  "Treino",
  "Dieta",
  "Quase lá",
  "Sessão desabafo",
];
const TOTAL = STEP_LABELS.length;

const RED = "var(--primary)";
const INK = "#0a0a0a";
const BORDER = "#e5e5e5";
const SURFACE = "#ffffff";
const BG = "#f7f7f7";
const MUTED = "#737373";
const STORAGE_VERSION = 2;

const STAR_LABELS = ["Muito ruim", "Ruim", "Regular", "Bom", "Muito bom"];

export function FeedbackQuinzenalFlow({ formId, alunoId, token, onSubmitted }: Props) {
  const storageKey = `feedback_quinzenal:${token}`;
  const gerarRespostaFn = useServerFn(gerarRespostaFormulario);
  const notifyFn = useServerFn(notifyFeedbackResponded);
  const criarAlunoFn = useServerFn(criarAlunoPublico);
  const submeterFn = useServerFn(submeterFormularioPublico);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FbData>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confirmandoTel, setConfirmandoTel] = useState(false);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?._v === STORAGE_VERSION && parsed?.data) {
          setData({
            ...EMPTY,
            ...parsed.data,
            identificacao: { ...EMPTY.identificacao, ...(parsed.data.identificacao || {}) },
            evolucao: { ...EMPTY.evolucao, ...(parsed.data.evolucao || {}) },
            treino: { ...EMPTY.treino, ...(parsed.data.treino || {}) },
            dieta: { ...EMPTY.dieta, ...(parsed.data.dieta || {}) },
            qualidade_vida: { ...EMPTY.qualidade_vida, ...(parsed.data.qualidade_vida || {}) },
          });
          if (typeof parsed?.step === "number") setStep(Math.min(Math.max(parsed.step, 0), TOTAL - 1));
          if (parsed?.started) setStarted(true);
          return;
        } else {
          try { localStorage.removeItem(storageKey); } catch {}
        }
      }
    } catch {}
    (async () => {
      const rascunho = await carregarRascunhoServidor(formId, token);
      if (rascunho?.data) {
        setData({
          ...EMPTY,
          ...rascunho.data,
          identificacao: { ...EMPTY.identificacao, ...(rascunho.data.identificacao || {}) },
          evolucao: { ...EMPTY.evolucao, ...(rascunho.data.evolucao || {}) },
          treino: { ...EMPTY.treino, ...(rascunho.data.treino || {}) },
          dieta: { ...EMPTY.dieta, ...(rascunho.data.dieta || {}) },
          qualidade_vida: { ...EMPTY.qualidade_vida, ...(rascunho.data.qualidade_vida || {}) },
        });
        if (typeof rascunho.step === "number") setStep(Math.min(Math.max(rascunho.step, 0), TOTAL - 1));
        setStarted(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(storageKey, JSON.stringify({ _v: STORAGE_VERSION, step, data, started })); } catch {}
  }, [step, data, started, storageKey]);

  useAutosaveFormulario({ formId, token, step, data, enabled: started && !submitted });

  function setBlock<K extends keyof FbData>(block: K, partial: Partial<FbData[K]>) {
    setData((d) => ({ ...d, [block]: { ...(d[block] as any), ...partial } }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!data.identificacao.nome_completo.trim()) e["id_nome"] = "Obrigatório";
      const tel = data.identificacao.telefone.trim();
      if (!tel) e["id_tel"] = "Obrigatório";
      else if (!/^\d{10,15}$/.test(tel)) e["id_tel"] = "Confira o telefone: DDD + número (ex: 81 91234-5678).";
      if (!String(data.identificacao.peso_atual_kg).trim()) e["id_peso"] = "Obrigatório";
    }
    if (step === 2) {
      if (!data.treino.adesao_treino || data.treino.adesao_treino < 1) e["tr_ad"] = "Selecione de 1 a 5";
    }
    if (step === 3) {
      if (!data.dieta.adesao_dieta || data.dieta.adesao_dieta < 1) e["di_ad"] = "Selecione de 1 a 5";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function next() {
    if (!validate()) {
      setTimeout(() => {
        const el = document.querySelector("[data-error='true']");
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    if (step < TOTAL - 1) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setConfirmandoTel(true);
    }
  }
  function back() {
    if (step === 0) { setStarted(false); return; }
    setStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    let vinculadoAlunoId: string | null = alunoId ?? null;

    // PASSO 1: garantir aluno vinculado/criado antes de marcar como respondido.
    // Isso evita resposta órfã: depois que respondido=true, a política pública não permite novo update.
    if (!vinculadoAlunoId) {
      try {
        const aluno = await criarAlunoFn({
          data: {
            nome: data.identificacao.nome_completo.trim(),
            telefone: data.identificacao.telefone.trim(),
            peso_kg: data.identificacao.peso_atual_kg,
          },
        });
        if (aluno.id) {
          vinculadoAlunoId = aluno.id;
        } else {
          const msg = aluno.error || "Não foi possível criar ou vincular o aluno pelo telefone.";
          setSubmitError(msg);
          setSubmitting(false);
          await logarFalhaPublica({
            modulo: "feedback_publico",
            etapa: "vincular_ou_criar_aluno_quinzenal",
            mensagem: msg,
            contexto: { formId, telefone: data.identificacao?.telefone, nome: data.identificacao?.nome_completo },
          });
          return;
        }
      } catch (e: any) {
        const msg = e?.message || String(e);
        setSubmitError(msg || "Não foi possível vincular o aluno.");
        setSubmitting(false);
        await logarFalhaPublica({
          modulo: "feedback_publico",
          etapa: "vincular_ou_criar_aluno_quinzenal",
          mensagem: msg,
          contexto: { formId, telefone: data.identificacao?.telefone, nome: data.identificacao?.nome_completo },
        });
        return;
      }
    }

    // PASSO 2: salvar resposta via server function (token-validado, service role).
    // O handler já agenda o job ia_feedback_quinzenal quando o aluno é vinculado.
    const submitRes = await submeterFn({
      data: {
        formId,
        token,
        dados: data as unknown as Record<string, unknown>,
        alunoId: vinculadoAlunoId,
      },
    });
    if (!submitRes.ok) {
      setSubmitError(submitRes.error || "Não foi possível salvar sua resposta. Tente novamente.");
      setSubmitting(false);
      await logarFalhaPublica({
        modulo: "feedback_publico",
        etapa: "salvar_formulario_quinzenal",
        mensagem: submitRes.error || "submeterFormularioPublico falhou",
        contexto: { formId, telefone: data.identificacao?.telefone },
      });
      return;
    }

    try { localStorage.removeItem(storageKey); } catch {}
    setSubmitted(true);
    setSubmitting(false);
    // Notifica grupo "Respostas de feedbacks" em tempo real (não bloqueia).
    notifyFn({ data: { motivo: "publico:feedback_quinzenal" } }).catch(() => {});
    // Dispara geração da resposta IA em background
    gerarRespostaFn({ data: { formularioId: formId } })
      .then((res) => {
        if (res?.error) console.error("[feedback_quinzenal] IA error:", res.error);
        else console.log("[feedback_quinzenal] IA gerada com sucesso");
      })
      .catch((e) => console.error("[feedback_quinzenal] IA fetch failed", e));
    await onSubmitted();
  }

  if (submitted) {
    return (
      <Page>
        <Card>
          <div className="text-center py-10">
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: RED }}>
              <Check className="w-9 h-9 text-white" strokeWidth={3} />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: INK }}>Feedback recebido.</h1>
            <p className="text-base" style={{ color: MUTED }}>
              Em breve sua equipe MPTEAM entra em contato.
            </p>
          </div>
        </Card>
      </Page>
    );
  }

  if (!started) {
    return (
      <Page>
        <Card>
          <div className="text-center py-8 md:py-12">
            <Logo big />
            <h1 className="text-3xl md:text-4xl font-bold mb-5" style={{ color: INK }}>Feedback Quinzenal | MP TEAM</h1>
            <p className="text-base md:text-lg leading-relaxed mb-10 max-w-xl mx-auto" style={{ color: MUTED }}>
              Esse feedback é pra entender com clareza como seu corpo e sua rotina estão respondendo.
              Seja direto, sincero e detalhista. É isso que me dá base pra ajustar certo.
            </p>
            <button
              onClick={() => { setStarted(true); window.scrollTo({ top: 0 }); }}
              className="inline-flex items-center justify-between gap-6 min-w-[280px] px-8 py-4 rounded-xl text-white font-semibold text-base hover:opacity-95 transition"
              style={{ backgroundColor: RED, boxShadow: `0 10px 30px -8px ${RED}80` }}
            >
              <span>Iniciar feedback</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </Card>
      </Page>
    );
  }

  const stepLabel = STEP_LABELS[step];
  const isLast = step === TOTAL - 1;

  return (
    <Page>
      <div className="mb-6">
        <Logo />
        <div className="h-1.5 rounded-full overflow-hidden mt-5" style={{ backgroundColor: BORDER }}>
          <div className="h-full transition-all duration-300" style={{ width: `${((step + 1) / TOTAL) * 100}%`, backgroundColor: RED }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs" style={{ color: MUTED }}>
          <span>Etapa {step + 1} de {TOTAL} · {Math.round(((step + 1) / TOTAL) * 100)}%</span>
          <span className="font-medium" style={{ color: INK }}>{stepLabel}</span>
        </div>
      </div>

      <Card>
        <Tag>{stepLabel}</Tag>
        <StepHeader step={step} />

        <div className="mt-6">
          {step === 0 && <Step1 data={data.identificacao} onChange={(p) => setBlock("identificacao", p)} errors={errors} />}
          {step === 1 && <Step2 data={data.evolucao} onChange={(p) => setBlock("evolucao", p)} />}
          {step === 2 && <Step3 data={data.treino} onChange={(p) => setBlock("treino", p)} errors={errors} />}
          {step === 3 && <Step4 data={data.dieta} onChange={(p) => setBlock("dieta", p)} errors={errors} />}
          {step === 4 && <Step5 data={data.qualidade_vida} onChange={(p) => setBlock("qualidade_vida", p)} />}
          {step === 5 && <Step6 value={data.desabafo} onChange={(v) => setData((d) => ({ ...d, desabafo: v }))} />}
        </div>

        {submitError && (
          <div className="mt-6 p-3 rounded text-sm" style={{ backgroundColor: "color-mix(in oklab, var(--primary) 10%, white)", color: RED, border: `1px solid ${RED}` }}>
            Erro ao enviar: {submitError}
          </div>
        )}

        <div className="flex items-center justify-between mt-10 pt-6 border-t" style={{ borderColor: BORDER }}>
          <button
            onClick={back}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium hover:opacity-70"
            style={{ color: INK }}
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <button
            onClick={next}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            style={{ backgroundColor: RED }}
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              : isLast ? <>Enviar feedback <Send className="w-4 h-4" /></>
              : <>Continuar <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </Card>
      <ConfirmarTelefoneModal
        open={confirmandoTel}
        telefone={data.identificacao.telefone}
        enviando={submitting}
        onConfirmar={async () => {
          await submit();
          setConfirmandoTel(false);
        }}
        onEditar={() => {
          setConfirmandoTel(false);
          setStep(0);
          window.scrollTo({ top: 0, behavior: "smooth" });
          setTimeout(() => {
            const el = document.querySelector<HTMLInputElement>("input[type='tel']");
            el?.focus();
          }, 100);
        }}
      />
    </Page>
  );
}

/* ===== Layout helpers ===== */
function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-8 md:py-10" style={{ backgroundColor: BG, color: INK, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="max-w-2xl mx-auto">{children}</div>
    </div>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg p-6 md:p-8" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>{children}</div>;
}
function Logo({ big = false }: { big?: boolean }) {
  return (
    <div className={`flex justify-center ${big ? "mb-8" : ""}`}>
      <img
        src={mpLogo}
        alt="MP TEAM Consultoria"
        className={big ? "h-20 md:h-24 w-auto" : "h-10 w-auto"}
        loading="eager"
      />
    </div>
  );
}
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider" style={{ backgroundColor: "color-mix(in oklab, var(--primary) 12%, white)", color: RED }}>
      {children}
    </span>
  );
}
function StepHeader({ step }: { step: number }) {
  const titles = [
    { t: "Quem está enviando", d: "" },
    { t: "Como você tá evoluindo?", d: "" },
    { t: "Como estão seus treinos?", d: "Me conta como foi sua experiência com os treinos nesse período." },
    { t: "Como está indo com a dieta?", d: "Quero saber como você se sentiu com o plano alimentar nesses últimos dias." },
    { t: "Quase lá.", d: "Sono, hidratação e intestino — pra fechar o quadro." },
    { t: "Sessão desabafo", d: "Última etapa. Bora fechar isso direito." },
  ];
  const cur = titles[step];
  return (
    <div className="mt-4">
      <h2 className="text-2xl md:text-3xl font-bold leading-tight" style={{ color: INK }}>{cur.t}</h2>
      {cur.d && <p className="mt-2 text-sm md:text-base" style={{ color: MUTED }}>{cur.d}</p>}
    </div>
  );
}

/* ===== Inputs ===== */
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold mb-1.5" style={{ color: INK }}>
      {children}{required && <span style={{ color: RED }}> *</span>}
    </label>
  );
}
function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs mb-1.5" style={{ color: MUTED }}>{children}</p>;
}
function ErrorMsg({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p data-error="true" className="mt-1 text-xs font-medium" style={{ color: RED }}>{msg}</p>;
}
function inputStyle(hasError?: boolean): React.CSSProperties {
  return { backgroundColor: SURFACE, border: `1px solid ${hasError ? RED : BORDER}`, color: INK, fontSize: 16 };
}
function TextInput({ value, onChange, placeholder, type = "text", inputMode, error }: { value: any; onChange: (v: string) => void; placeholder?: string; type?: string; inputMode?: any; error?: string }) {
  return (
    <>
      <input type={type} inputMode={inputMode} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3.5 py-3 text-base rounded-md outline-none transition" style={inputStyle(!!error)} />
      <ErrorMsg msg={error} />
    </>
  );
}
function PhoneInput({ value, onChange, placeholder, error }: { value: string; onChange: (v: string) => void; placeholder?: string; error?: string }) {
  return (
    <>
      <input
        type="tel"
        inputMode="numeric"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        placeholder={placeholder}
        className="w-full px-3.5 py-3 text-base rounded-md outline-none transition"
        style={inputStyle(!!error)}
      />
      <ErrorMsg msg={error} />
    </>
  );
}
function TextArea({ value, onChange, placeholder, rows = 4, error, minH }: { value: any; onChange: (v: string) => void; placeholder?: string; rows?: number; error?: string; minH?: number }) {
  return (
    <>
      <textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3.5 py-3 text-base rounded-md outline-none transition" style={{ ...inputStyle(!!error), minHeight: minH, resize: "vertical" }} />
      <ErrorMsg msg={error} />
    </>
  );
}
function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      {hint && <Hint>{hint}</Hint>}
      {children}
    </div>
  );
}

function StarRating({ value, onChange, error }: { value: number | null; onChange: (n: number) => void; error?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value ?? 0;
  const legendIndex = active >= 1 ? active - 1 : null;
  return (
    <div>
      <div className="flex items-center gap-2" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= active;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} ${STAR_LABELS[n - 1]}`}
              className="p-1 rounded hover:scale-110 transition-transform"
            >
              <Star
                className="w-9 h-9"
                style={{ color: filled ? RED : BORDER, fill: filled ? RED : "transparent" }}
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </div>
      {legendIndex !== null ? (
        <div className="mt-1.5 text-sm font-semibold" style={{ color: RED }}>
          {STAR_LABELS[legendIndex]} <span className="ml-1 text-xs font-normal" style={{ color: MUTED }}>({active}/5)</span>
        </div>
      ) : (
        <div className="mt-1.5 flex items-center justify-between text-[11px]" style={{ color: MUTED }}>
          <span>Muito ruim</span>
          <span>Muito bom</span>
        </div>
      )}
      <ErrorMsg msg={error} />
    </div>
  );
}

function YesNoToggle({ value, onChange, error }: { value: "sim" | "nao" | ""; onChange: (v: "sim" | "nao") => void; error?: string }) {
  const opt = (v: "sim" | "nao", label: string) => {
    const active = value === v;
    return (
      <button
        key={v}
        type="button"
        onClick={() => onChange(v)}
        className="flex-1 px-5 py-3 rounded-md text-sm font-semibold transition"
        style={{
          backgroundColor: active ? RED : SURFACE,
          color: active ? "#fff" : INK,
          border: `1px solid ${active ? RED : BORDER}`,
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div>
      <div className="flex gap-3">{opt("sim", "Sim")}{opt("nao", "Não")}</div>
      <ErrorMsg msg={error} />
    </div>
  );
}

/* ===== Steps ===== */
function Step1({ data, onChange, errors }: { data: FbData["identificacao"]; onChange: (p: Partial<FbData["identificacao"]>) => void; errors: Record<string, string> }) {
  const [ddi, setDdi] = useState<string>(() => splitPhone(data.telefone).ddi);
  return (
    <div className="space-y-4">
      <Field label="Nome completo" required>
        <TextInput value={data.nome_completo} onChange={(v) => onChange({ nome_completo: v })} error={errors.id_nome} />
      </Field>
      <PhoneDdiInput
        value={data.telefone}
        onChange={(v) => onChange({ telefone: v })}
        ddi={ddi}
        onDdiChange={setDdi}
        numeroLabel="Telefone com DDD"
        placeholder="Ex: 81999999999"
        error={errors.id_tel}
      />
      <div
        className="flex items-start gap-2 rounded-md p-3 text-xs"
        style={{ backgroundColor: "#fef3c7", border: "1px solid #fcd34d", color: "#78350f" }}
      >
        <span aria-hidden>⚠️</span>
        <span>
          <strong>Confirme o número antes de enviar.</strong> Esse WhatsApp identifica seu cadastro —
          inclua o DDD (ex.: 81) e confira dígito por dígito.
        </span>
      </div>
      <Field label="Peso atual (kg)" required>
        <TextInput value={data.peso_atual_kg} onChange={(v) => onChange({ peso_atual_kg: v })} inputMode="decimal" placeholder="Ex.: 78.5" error={errors.id_peso} />
      </Field>
    </div>
  );
}
function Step2({ data, onChange }: { data: FbData["evolucao"]; onChange: (p: Partial<FbData["evolucao"]>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Quando você se olha no espelho, está percebendo mudanças no seu físico?">
        <TextArea value={data.mudancas_espelho} onChange={(v) => onChange({ mudancas_espelho: v })} placeholder="Onde notou mais mudança? Onde menos?" />
      </Field>
      <Field label="Alguém de fora comentou algo sobre sua aparência ou transformação?">
        <TextArea value={data.comentarios_externos} onChange={(v) => onChange({ comentarios_externos: v })} />
      </Field>
      <Field label="Qual é o seu foco para as próximas 4 semanas?">
        <TextArea value={data.foco_4_semanas} onChange={(v) => onChange({ foco_4_semanas: v })} placeholder="Ex.: reduzir gordura, ganhar volume, melhorar performance" />
      </Field>
    </div>
  );
}
function Step3({ data, onChange, errors }: { data: FbData["treino"]; onChange: (p: Partial<FbData["treino"]>) => void; errors: Record<string, string> }) {
  return (
    <div className="space-y-5">
      <Field label="Como tem sido sua adesão à rotina de treinos?" required>
        <StarRating value={data.adesao_treino} onChange={(n) => onChange({ adesao_treino: n })} error={errors.tr_ad} />
      </Field>
      <Field label="Está sentindo dificuldade em algum exercício ou parte do treino?">
        <TextArea value={data.dificuldades} onChange={(v) => onChange({ dificuldades: v })} placeholder="Se algo está pegando, conta aqui que ajustamos." />
      </Field>
      <Field label="Conta como você está se sentindo com o treino no geral.">
        <TextArea value={data.sentimento_geral} onChange={(v) => onChange({ sentimento_geral: v })} />
      </Field>
    </div>
  );
}
function Step4({ data, onChange, errors }: { data: FbData["dieta"]; onChange: (p: Partial<FbData["dieta"]>) => void; errors: Record<string, string> }) {
  return (
    <div className="space-y-5">
      <Field label="Como tem sido sua adesão ao plano alimentar?" required>
        <StarRating value={data.adesao_dieta} onChange={(n) => onChange({ adesao_dieta: n })} error={errors.di_ad} />
      </Field>
      <Field label="Como foram os finais de semana? Conseguiu manter o plano?">
        <TextArea value={data.finais_de_semana} onChange={(v) => onChange({ finais_de_semana: v })} />
      </Field>
      <Field label="Conta como você tem se sentido com a dieta no geral.">
        <TextArea value={data.sentimento_geral} onChange={(v) => onChange({ sentimento_geral: v })} />
      </Field>
    </div>
  );
}
function Step5({ data, onChange }: { data: FbData["qualidade_vida"]; onChange: (p: Partial<FbData["qualidade_vida"]>) => void }) {
  return (
    <div className="space-y-5">
      <Field label="Como tem sido o seu sono?">
        <StarRating value={data.sono} onChange={(n) => onChange({ sono: n })} />
      </Field>
      <Field label="Como tem sido sua hidratação ao longo do dia?">
        <StarRating value={data.hidratacao} onChange={(n) => onChange({ hidratacao: n })} />
      </Field>
      <Field label="Seu intestino tem funcionado bem?">
        <YesNoToggle value={data.intestino_ok} onChange={(v) => onChange({ intestino_ok: v })} />
      </Field>
    </div>
  );
}
function Step6({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: MUTED }}>
        Esse espaço é todo seu. Pode abrir o jogo — uma conquista, uma dificuldade, algo que te incomodou. Escreve aqui.
      </p>
      <TextArea value={value} onChange={onChange} placeholder="Escreva à vontade..." rows={6} minH={180} />
    </div>
  );
}
