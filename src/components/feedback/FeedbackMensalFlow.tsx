import { useEffect, useRef, useState } from "react";
import { logarFalhaPublica } from "@/lib/aluno-publico";
import { ArrowLeft, ArrowRight, Camera, Check, Loader2, Send, Star, X } from "lucide-react";
import mpLogo from "@/assets/mp-logo.png";
import exemploFotos from "@/assets/exemplo-fotos-evolucao.png";
import { useServerFn } from "@tanstack/react-start";
import { gerarRespostaFormulario } from "@/server/feedback.functions";
import { notifyFeedbackResponded } from "@/server/notificacoes-feedbacks.functions";
import { criarAlunoPublico } from "@/server/aluno-publico.functions";
import { submeterFormularioPublico } from "@/server/formulario-publico-flow.functions";
import { PhoneDdiInput, splitPhone } from "@/components/publico/PhoneDdiInput";
import { ConfirmarTelefoneModal } from "@/components/publico/ConfirmarTelefoneModal";
import { uploadAnamneseAsset } from "@/lib/anamnese-upload";
import { useAutosaveFormulario, carregarRascunhoServidor } from "@/lib/formulario-autosave";

interface Props {
  formId: string;
  alunoId: string | null;
  token: string;
  onSubmitted: () => Promise<void> | void;
}

type FbData = {
  identificacao: { nome: string; telefone: string; telefone_confirmacao: string; peso_kg: string };
  evolucao: { mudancas_fisico: string; comentarios_externos: string; foco_4_semanas: string };
  treino: { adesao: number | null; dificuldades: string; sentimento: string };
  dieta: {
    adesao: number | null;
    dificuldades_3: string;
    novos_habitos: string;
    manter: string;
    ajustar: string;
    finais_de_semana: string;
    sentimento: string;
  };
  qualidade_vida: { sono: number | null; hidratacao: number | null; intestino_ok: "sim" | "nao" | "" };
  desabafo: string;
  fotos: { frente: string; costas: string; perfil_esquerdo: string };
};

const EMPTY: FbData = {
  identificacao: { nome: "", telefone: "", telefone_confirmacao: "", peso_kg: "" },
  evolucao: { mudancas_fisico: "", comentarios_externos: "", foco_4_semanas: "" },
  treino: { adesao: null, dificuldades: "", sentimento: "" },
  dieta: { adesao: null, dificuldades_3: "", novos_habitos: "", manter: "", ajustar: "", finais_de_semana: "", sentimento: "" },
  qualidade_vida: { sono: null, hidratacao: null, intestino_ok: "" },
  desabafo: "",
  fotos: { frente: "", costas: "", perfil_esquerdo: "" },
};

// 6 páginas principais do brief + 1 bônus opcional de fotos = 7 etapas reais
const STEP_LABELS = [
  "Identificação",
  "Como você tá evoluindo?",
  "Como estão seus treinos?",
  "Como está indo com a dieta?",
  "Qualidade de vida",
  "Sessão desabafo",
  "Fotos de evolução",
];
const TOTAL = STEP_LABELS.length;
const VISIBLE_TOTAL = 6; // numeração mostrada ao usuário

const RED = "#f50000";
const INK = "#0a0a0a";
const BORDER = "#e5e5e5";
const SURFACE = "#ffffff";
const BG = "#f7f7f7";
const MUTED = "#737373";

type SlotKey = "frente" | "costas" | "perfil_esquerdo";

export function FeedbackMensalFlow({ formId, alunoId, token, onSubmitted }: Props) {
  const storageKey = `feedback_mensal:${token}`;
  const gerarRespostaFn = useServerFn(gerarRespostaFormulario);
  const criarAlunoFn = useServerFn(criarAlunoPublico);
  const notifyFn = useServerFn(notifyFeedbackResponded);
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
        if (parsed?.data) {
          setData({
            ...EMPTY,
            ...parsed.data,
            identificacao: { ...EMPTY.identificacao, ...(parsed.data.identificacao || {}) },
            evolucao: { ...EMPTY.evolucao, ...(parsed.data.evolucao || {}) },
            treino: { ...EMPTY.treino, ...(parsed.data.treino || {}) },
            dieta: { ...EMPTY.dieta, ...(parsed.data.dieta || {}) },
            qualidade_vida: { ...EMPTY.qualidade_vida, ...(parsed.data.qualidade_vida || {}) },
            fotos: { ...EMPTY.fotos, ...(parsed.data.fotos || {}) },
          });
        }
        if (typeof parsed?.step === "number") setStep(Math.min(Math.max(parsed.step, 0), TOTAL - 1));
        if (parsed?.started) setStarted(true);
        return;
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
          fotos: { ...EMPTY.fotos, ...(rascunho.data.fotos || {}) },
        });
        if (typeof rascunho.step === "number") setStep(Math.min(Math.max(rascunho.step, 0), TOTAL - 1));
        setStarted(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(storageKey, JSON.stringify({ step, data, started })); } catch {}
  }, [step, data, started, storageKey]);

  useAutosaveFormulario({ formId, token, step, data, enabled: started && !submitted });

  function setBlock<K extends keyof FbData>(block: K, partial: Partial<FbData[K]>) {
    setData((d) => ({ ...d, [block]: { ...(d[block] as any), ...partial } }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (step === 0) {
      const tel = data.identificacao.telefone.trim();
      const peso = data.identificacao.peso_kg.trim().replace(",", ".");
      if (!data.identificacao.nome.trim()) e["id_nome"] = "Obrigatório";
      if (!tel) e["id_tel"] = "Obrigatório";
      else if (!/^\d{10,15}$/.test(tel)) e["id_tel"] = "Confira o telefone: DDD + número (ex: 81 91234-5678).";
      if (!peso) e["id_peso"] = "Obrigatório";
      else if (!/^\d+(\.\d{1,2})?$/.test(peso) || Number(peso) <= 0) e["id_peso"] = "Confira o peso: use ponto ou vírgula (ex: 78,5).";
    }
    if (step === 2) {
      if (!data.treino.adesao) e["tr_ad"] = "Selecione de 1 a 5 estrelas";
    }
    if (step === 3) {
      if (!data.dieta.adesao) e["di_ad"] = "Selecione de 1 a 5 estrelas";
    }
    if (step === 4) {
      if (!data.qualidade_vida.intestino_ok) e["qv_int"] = "Selecione Sim ou Não";
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

    const payload = {
      identificacao: {
        nome_completo: data.identificacao.nome.trim(),
        telefone: data.identificacao.telefone.trim(),
        peso_atual_kg: Number(data.identificacao.peso_kg.replace(",", ".")),
      },
      evolucao: {
        mudancas_fisico: data.evolucao.mudancas_fisico.trim(),
        comentarios_externos: data.evolucao.comentarios_externos.trim(),
        foco_4_semanas: data.evolucao.foco_4_semanas.trim(),
      },
      treino: {
        adesao_estrelas: data.treino.adesao,
        dificuldades: data.treino.dificuldades.trim(),
        sentimento_geral: data.treino.sentimento.trim(),
      },
      dieta: {
        adesao_estrelas: data.dieta.adesao,
        tres_maiores_dificuldades: data.dieta.dificuldades_3.trim(),
        novos_habitos: data.dieta.novos_habitos.trim(),
        manter: data.dieta.manter.trim(),
        ajustar: data.dieta.ajustar.trim(),
        finais_de_semana: data.dieta.finais_de_semana.trim(),
        sentimento_geral: data.dieta.sentimento.trim(),
      },
      qualidade_vida: {
        sono_estrelas: data.qualidade_vida.sono,
        hidratacao_estrelas: data.qualidade_vida.hidratacao,
        intestino_funciona_bem: data.qualidade_vida.intestino_ok,
      },
      sessao_desabafo: data.desabafo.trim(),
      fotos: {
        frente: data.fotos.frente,
        costas: data.fotos.costas,
        perfil_esquerdo: data.fotos.perfil_esquerdo,
      },
    };

    let vinculadoAlunoId: string | null = alunoId ?? null;

    // PASSO 1: garantir aluno vinculado/criado antes de marcar como respondido.
    // Isso evita resposta órfã: depois que respondido=true, a política pública não permite novo update.
    if (!vinculadoAlunoId) {
      try {
        const aluno = await criarAlunoFn({
          data: {
            nome: payload.identificacao.nome_completo,
            telefone: payload.identificacao.telefone,
            peso_kg: payload.identificacao.peso_atual_kg,
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
            etapa: "vincular_ou_criar_aluno_mensal",
            mensagem: msg,
            contexto: { formId, telefone: payload.identificacao.telefone, nome: payload.identificacao.nome_completo },
          });
          return;
        }
      } catch (e: any) {
        const msg = e?.message || String(e);
        setSubmitError(msg || "Não foi possível vincular o aluno.");
        setSubmitting(false);
        await logarFalhaPublica({
          modulo: "feedback_publico",
          etapa: "vincular_ou_criar_aluno_mensal",
          mensagem: msg,
          contexto: { formId, telefone: payload.identificacao.telefone, nome: payload.identificacao.nome_completo },
        });
        return;
      }
    }

    // PASSO 2: salvar resposta via server function (token-validado, service role).
    const submitRes = await submeterFn({
      data: {
        formId,
        token,
        dados: payload as unknown as Record<string, unknown>,
        alunoId: vinculadoAlunoId,
      },
    });
    if (!submitRes.ok) {
      setSubmitError(submitRes.error || "Não foi possível salvar sua resposta. Tente novamente.");
      setSubmitting(false);
      await logarFalhaPublica({
        modulo: "feedback_publico",
        etapa: "salvar_formulario_mensal",
        mensagem: submitRes.error || "submeterFormularioPublico falhou",
        contexto: { formId, telefone: data.identificacao?.telefone },
      });
      return;
    }

    try { localStorage.removeItem(storageKey); } catch {}
    setSubmitted(true);
    setSubmitting(false);
    // Notifica grupo "Respostas de feedbacks" em tempo real (não bloqueia).
    notifyFn({ data: { motivo: "publico:feedback_mensal" } }).catch(() => {});
    // Dispara geração da resposta IA em background (não bloqueia o aluno)
    gerarRespostaFn({ data: { formularioId: formId } })
      .then((res) => {
        if (res?.error) console.error("[feedback_mensal] IA error:", res.error);
        else console.log("[feedback_mensal] IA gerada com sucesso");
      })
      .catch((e) => console.error("[feedback_mensal] IA fetch failed", e));
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
            <h1 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: INK }}>Feedback enviado.</h1>
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
            <h1 className="text-3xl md:text-4xl font-bold mb-5" style={{ color: INK }}>Feedback Mensal | MP TEAM</h1>
            <p className="text-base md:text-lg leading-relaxed mb-10 max-w-xl mx-auto" style={{ color: MUTED }}>
              Esse é o seu espaço pra mandar a real. Quanto mais sinceridade no feedback, mais preciso eu consigo ser nos ajustes.
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
  const visibleStep = Math.min(step + 1, VISIBLE_TOTAL);
  const percent = Math.round(((step + 1) / TOTAL) * 100);

  return (
    <Page>
      <div className="mb-6">
        <Logo />
        <div className="h-1.5 rounded-full overflow-hidden mt-5" style={{ backgroundColor: BORDER }}>
          <div className="h-full transition-all duration-300" style={{ width: `${percent}%`, backgroundColor: RED }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs" style={{ color: MUTED }}>
          <span>
            {step < VISIBLE_TOTAL
              ? <>Página {visibleStep} de {VISIBLE_TOTAL} · {percent}%</>
              : <>Bônus · {percent}%</>}
          </span>
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
          {step === 4 && <Step5 data={data.qualidade_vida} onChange={(p) => setBlock("qualidade_vida", p)} errors={errors} />}
          {step === 5 && <Step6 value={data.desabafo} onChange={(v) => setData((d) => ({ ...d, desabafo: v }))} />}
          {step === 6 && <Step7Fotos token={token} fotos={data.fotos} onChange={(p) => setBlock("fotos", p)} />}
        </div>

        {submitError && (
          <div className="mt-6 p-3 rounded text-sm" style={{ backgroundColor: "#fee", color: RED, border: `1px solid ${RED}` }}>
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
              : <>Avançar <ArrowRight className="w-4 h-4" /></>}
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
    <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider" style={{ backgroundColor: "#fee2e2", color: RED }}>
      {children}
    </span>
  );
}
function StepHeader({ step }: { step: number }) {
  const titles = [
    { t: "Identificação", d: "" },
    { t: "Como você tá evoluindo?", d: "" },
    { t: "Como estão seus treinos?", d: "" },
    { t: "Como está indo com a dieta?", d: "" },
    { t: "Qualidade de vida", d: "" },
    { t: "Sessão desabafo", d: "Última etapa obrigatória." },
    { t: "Fotos de evolução", d: "Etapa bônus — opcional." },
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
              aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
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
        {value ? <span className="ml-2 text-sm font-medium" style={{ color: INK }}>{value}/5</span> : null}
      </div>
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
        <TextInput value={data.nome} onChange={(v) => onChange({ nome: v })} error={errors.id_nome} />
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
      <Field label="Peso atual (kg)" required hint="Use ponto ou vírgula para decimais. Ex: 78.5">
        <TextInput
          value={data.peso_kg}
          onChange={(v) => onChange({ peso_kg: v.replace(/[^\d.,]/g, "") })}
          inputMode="decimal"
          placeholder="78.5"
          error={errors.id_peso}
        />
      </Field>
    </div>
  );
}

function Step2({ data, onChange }: { data: FbData["evolucao"]; onChange: (p: Partial<FbData["evolucao"]>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Quando você se olha no espelho, está percebendo mudanças no seu físico?">
        <TextArea value={data.mudancas_fisico} onChange={(v) => onChange({ mudancas_fisico: v })} />
      </Field>
      <Field label="Alguém de fora comentou algo sobre sua aparência ou transformação?">
        <TextArea value={data.comentarios_externos} onChange={(v) => onChange({ comentarios_externos: v })} />
      </Field>
      <Field label="Qual é o seu foco para as próximas 4 semanas?">
        <TextArea
          value={data.foco_4_semanas}
          onChange={(v) => onChange({ foco_4_semanas: v })}
          placeholder="Ex: reduzir gordura, ganhar volume, melhorar performance"
        />
      </Field>
    </div>
  );
}

function Step3({ data, onChange, errors }: { data: FbData["treino"]; onChange: (p: Partial<FbData["treino"]>) => void; errors: Record<string, string> }) {
  return (
    <div className="space-y-5">
      <Field label="Como tem sido sua adesão à rotina de treinos?" required>
        <StarRating value={data.adesao} onChange={(n) => onChange({ adesao: n })} error={errors.tr_ad} />
      </Field>
      <Field label="Está sentindo dificuldade em algum exercício ou parte do treino?">
        <TextArea value={data.dificuldades} onChange={(v) => onChange({ dificuldades: v })} />
      </Field>
      <Field label="Conta como você está se sentindo com o treino no geral.">
        <TextArea value={data.sentimento} onChange={(v) => onChange({ sentimento: v })} />
      </Field>
    </div>
  );
}

function Step4({ data, onChange, errors }: { data: FbData["dieta"]; onChange: (p: Partial<FbData["dieta"]>) => void; errors: Record<string, string> }) {
  return (
    <div className="space-y-5">
      <Field label="Como tem sido sua adesão ao plano alimentar?" required>
        <StarRating value={data.adesao} onChange={(n) => onChange({ adesao: n })} error={errors.di_ad} />
      </Field>
      <Field label="Quais foram as 3 maiores dificuldades nos últimos dias?">
        <TextArea value={data.dificuldades_3} onChange={(v) => onChange({ dificuldades_3: v })} placeholder="Pode mandar real." />
      </Field>
      <Field label="Conseguiu incluir algum novo hábito ou alimento na rotina?">
        <TextArea value={data.novos_habitos} onChange={(v) => onChange({ novos_habitos: v })} />
      </Field>
      <Field label="O que funcionou bem e você quer manter?">
        <TextArea value={data.manter} onChange={(v) => onChange({ manter: v })} />
      </Field>
      <Field label="O que não funcionou e gostaria de ajustar?">
        <TextArea value={data.ajustar} onChange={(v) => onChange({ ajustar: v })} />
      </Field>
      <Field label="Como foram os finais de semana? Conseguiu manter o plano?">
        <TextArea value={data.finais_de_semana} onChange={(v) => onChange({ finais_de_semana: v })} />
      </Field>
      <Field label="Conta como você tem se sentido com a dieta no geral.">
        <TextArea value={data.sentimento} onChange={(v) => onChange({ sentimento: v })} />
      </Field>
    </div>
  );
}

function Step5({ data, onChange, errors }: { data: FbData["qualidade_vida"]; onChange: (p: Partial<FbData["qualidade_vida"]>) => void; errors: Record<string, string> }) {
  return (
    <div className="space-y-6">
      <Field label="Como tem sido o seu sono?">
        <StarRating value={data.sono} onChange={(n) => onChange({ sono: n })} />
      </Field>
      <Field label="Como tem sido sua hidratação ao longo do dia?">
        <StarRating value={data.hidratacao} onChange={(n) => onChange({ hidratacao: n })} />
      </Field>
      <Field label="Seu intestino tem funcionado bem?" required>
        <YesNoToggle value={data.intestino_ok} onChange={(v) => onChange({ intestino_ok: v })} error={errors.qv_int} />
      </Field>
    </div>
  );
}

function Step6({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed" style={{ color: INK }}>
        Esse espaço é todo seu. Pode abrir o jogo — uma conquista, uma dificuldade, algo que te incomodou. Escreve aqui.
      </p>
      <TextArea value={value} onChange={onChange} placeholder="Escreva à vontade..." rows={8} minH={200} />
    </div>
  );
}

function Step7Fotos({ token, fotos, onChange }: { token: string; fotos: FbData["fotos"]; onChange: (p: Partial<FbData["fotos"]>) => void }) {
  return (
    <div className="space-y-5">
      <div className="rounded-md p-4 text-sm leading-relaxed" style={{ backgroundColor: BG, border: `1px solid ${BORDER}`, color: INK }}>
        Etapa opcional. Se quiser anexar fotos para análise física, siga as orientações abaixo. Caso contrário, basta clicar em <strong>Enviar feedback</strong>.
      </div>
      <div className="rounded-md p-4" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
        <p className="text-sm font-semibold mb-3" style={{ color: INK }}>Veja um exemplo de como tirar suas fotos</p>
        <img
          src={exemploFotos}
          alt="Exemplo de poses: frente, perfil esquerdo e costas"
          className="mx-auto block max-w-md w-full rounded-md border"
          style={{ borderColor: BORDER }}
        />
        <p className="mt-3 text-xs text-center" style={{ color: MUTED }}>
          <strong>Observação:</strong> a foto de perfil deve, obrigatoriamente, ser tirada sempre do lado esquerdo.
        </p>
      </div>
      <ul className="text-sm space-y-1.5" style={{ color: INK }}>
        <li><strong>Posições:</strong> Frente · Costas · Perfil esquerdo</li>
        <li><strong>Roupa:</strong> Biquíni ou sunga. Opção 2: top e shorts com umbigo aparente. Sempre a mesma roupa.</li>
        <li><strong>Local:</strong> mesmo lugar, fundo neutro, sem objetos ao redor.</li>
        <li><strong>Ângulo:</strong> celular na altura do abdômen. Corpo inteiro visível da cabeça até a ponta dos pés. Luz natural.</li>
      </ul>
      <div className="grid grid-cols-3 gap-3">
        <PhotoSlot token={token} slot="frente" label="Frente" url={fotos.frente} onChange={(u) => onChange({ frente: u })} />
        <PhotoSlot token={token} slot="costas" label="Costas" url={fotos.costas} onChange={(u) => onChange({ costas: u })} />
        <PhotoSlot token={token} slot="perfil_esquerdo" label="Perfil esquerdo" url={fotos.perfil_esquerdo} onChange={(u) => onChange({ perfil_esquerdo: u })} />
      </div>
    </div>
  );
}

function PhotoSlot({ token, slot, label, url, onChange }: { token: string; slot: SlotKey; label: string; url: string; onChange: (u: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File | null) {
    if (!file) return;
    setErr(null);
    if (file.size > 10 * 1024 * 1024) { setErr("Máx 10MB"); return; }
    setBusy(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const named = new File([file], `${slot}.${ext}`, { type: file.type || "image/jpeg" });
    const { url, error } = await uploadAnamneseAsset({
      pathPrefix: `feedback_mensal/${token}/fotos/`,
      file: named,
      token,
    });
    if (error || !url) {
      setErr(error || "Falha ao enviar");
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    onChange(url);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="text-center">
      <div className="relative w-full rounded-md overflow-hidden" style={{ border: `1px solid ${BORDER}`, backgroundColor: BG, aspectRatio: "3/4" }}>
        {url ? (
          <>
            <img src={url} alt={label} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-white"
              style={{ backgroundColor: RED }}
              aria-label="Remover"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-xs"
            style={{ color: MUTED }}
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-6 h-6" />}
            <span>{busy ? "Enviando..." : "Adicionar"}</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="mt-1.5 text-xs font-medium" style={{ color: INK }}>{label}</div>
      {err && <div className="text-[11px] mt-1" style={{ color: RED }}>{err}</div>}
    </div>
  );
}
