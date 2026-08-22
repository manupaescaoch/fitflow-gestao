import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, X, Camera, Check, ArrowLeft, ArrowRight, Send, Loader2 } from "lucide-react";
import { logarFalhaPublica } from "@/lib/aluno-publico";
import { useServerFn } from "@tanstack/react-start";
import { criarAlunoPublico } from "@/server/aluno-publico.functions";
import { submeterFormularioPublico } from "@/server/formulario-publico-flow.functions";
import mpLogo from "@/assets/mp-logo.png";
import { TimePicker } from "@/components/ui/time-picker";
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

type AnamneseData = {
  dados_pessoais: Record<string, any>;
  historico: Record<string, any>;
  saude: Record<string, any>;
  objetivo: Record<string, any>;
  ergogenicos: Record<string, any>;
  fatores_risco: { pessoal: Record<string, any>; familiar: Record<string, any> };
  treino: Record<string, any>;
  alimentacao: Record<string, any>;
  habitos: Record<string, any>;
  recordatorio: Record<string, { horario: string; comida: string }>;
  fotos: { frente?: string; costas?: string; perfil_esquerdo?: string };
  desabafo: string;
};

const EMPTY: AnamneseData = {
  dados_pessoais: {},
  historico: {},
  saude: { exames_arquivos: [] as { url: string; name: string }[] },
  objetivo: {},
  ergogenicos: {},
  fatores_risco: { pessoal: {}, familiar: {} },
  treino: {},
  alimentacao: {},
  habitos: {},
  recordatorio: {
    cafe_manha: { horario: "", comida: "" },
    lanche_manha: { horario: "", comida: "" },
    almoco: { horario: "", comida: "" },
    lanche_tarde: { horario: "", comida: "" },
    jantar: { horario: "", comida: "" },
    ceia: { horario: "", comida: "" },
  },
  fotos: {},
  desabafo: "",
};

const STEP_LABELS = [
  "Dados pessoais", "Histórico", "Saúde", "Objetivo", "Recursos ergogênicos",
  "Fatores de risco", "Treino", "Rotina e alimentação", "Sono e hábitos",
  "Recordatório alimentar", "Fotos de avaliação", "Desabafo",
];
const TOTAL = STEP_LABELS.length;

const RED = "#f50000";
const INK = "#0a0a0a";
const BORDER = "#e5e5e5";
const SURFACE = "#ffffff";
const BG = "#f7f7f7";
const MUTED = "#737373";

export function AnamneseFlow({ formId, alunoId, token, onSubmitted }: Props) {
  const storageKey = `anamnese:${token}`;
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0); // 0..11
  const [data, setData] = useState<AnamneseData>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confirmandoTel, setConfirmandoTel] = useState(false);
  const criarAlunoFn = useServerFn(criarAlunoPublico);
  const submeterFn = useServerFn(submeterFormularioPublico);

  // restore from localStorage
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.data) setData({ ...EMPTY, ...parsed.data, fatores_risco: { ...EMPTY.fatores_risco, ...(parsed.data.fatores_risco || {}) }, recordatorio: { ...EMPTY.recordatorio, ...(parsed.data.recordatorio || {}) } });
        if (typeof parsed?.step === "number") setStep(Math.min(Math.max(parsed.step, 0), TOTAL - 1));
        if (parsed?.started) setStarted(true);
        return;
      }
    } catch {}
    // sem localStorage → tenta carregar rascunho do servidor (outro dispositivo, etc.)
    (async () => {
      const rascunho = await carregarRascunhoServidor(formId, token);
      if (rascunho?.data) {
        setData({
          ...EMPTY,
          ...rascunho.data,
          fatores_risco: { ...EMPTY.fatores_risco, ...(rascunho.data.fatores_risco || {}) },
          recordatorio: { ...EMPTY.recordatorio, ...(rascunho.data.recordatorio || {}) },
        });
        if (typeof rascunho.step === "number") setStep(Math.min(Math.max(rascunho.step, 0), TOTAL - 1));
        setStarted(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(storageKey, JSON.stringify({ step, data, started })); } catch {}
  }, [step, data, started, storageKey]);

  // autosave server-side (rascunho) — só depois que iniciou e antes de enviar
  useAutosaveFormulario({ formId, token, step, data, enabled: started && !submitted });

  function setBlock<K extends keyof AnamneseData>(block: K, partial: Partial<AnamneseData[K]>) {
    setData((d) => ({ ...d, [block]: { ...(d[block] as any), ...partial } }));
  }
  function setRisco(group: "pessoal" | "familiar", key: string, value: string) {
    setData((d) => ({ ...d, fatores_risco: { ...d.fatores_risco, [group]: { ...d.fatores_risco[group], [key]: value } } }));
  }
  function setRefeicao(key: string, partial: { horario?: string; comida?: string }) {
    setData((d) => ({ ...d, recordatorio: { ...d.recordatorio, [key]: { ...d.recordatorio[key], ...partial } } }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    const dp = data.dados_pessoais;
    const sa = data.saude;
    const er = data.ergogenicos;
    const tr = data.treino;
    const al = data.alimentacao;
    const ha = data.habitos;
    const ob = data.objetivo;
    const fp = data.fatores_risco.pessoal;
    const ff = data.fatores_risco.familiar;
    if (step === 0) {
      if (!dp.nome) e["dp_nome"] = "Obrigatório";
      if (!dp.email) e["dp_email"] = "Obrigatório";
      if (!dp.telefone) e["dp_telefone"] = "Obrigatório";
      else if (!/^\d{10,15}$/.test(String(dp.telefone))) e["dp_telefone"] = "Confira o telefone: DDD + número (ex: 81 91234-5678).";
      if (!dp.nascimento) e["dp_nascimento"] = "Obrigatório";
      if (!dp.genero) e["dp_genero"] = "Obrigatório";
      if (!dp.peso) e["dp_peso"] = "Obrigatório";
      if (!dp.altura) e["dp_altura"] = "Obrigatório";
    }
    if (step === 2) {
      if (!sa.cirurgia) e["sa_cirurgia"] = "Obrigatório";
    }
    if (step === 3) {
      if (!ob.objetivo_principal) e["ob_objetivo"] = "Obrigatório";
    }
    if (step === 4) {
      if (!er.ja_usou_esteroides) e["er_esteroides"] = "Obrigatório";
    }
    if (step === 5) {
      ["fuma","diabetes","sobrepeso","sedentarismo","dislipidemias"].forEach((k) => { if (!fp[k]) e[`fp_${k}`] = "Obrigatório"; });
      ["diabetes","hipertensao","cardiovasculares","derrame","cancer","obesidade"].forEach((k) => { if (!ff[k]) e[`ff_${k}`] = "Obrigatório"; });
    }
    if (step === 6) {
      if (!tr.tempo_treino) e["tr_tempo"] = "Obrigatório";
      if (!tr.modalidade) e["tr_mod"] = "Obrigatório";
      if (!tr.frequencia) e["tr_freq"] = "Obrigatório";
      if (!tr.divisao) e["tr_div"] = "Obrigatório";
    }
    if (step === 7) {
      if (!al.esforco_diario) e["al_esforco"] = "Obrigatório";
      if (!al.refeicoes_dia) e["al_ref"] = "Obrigatório";
      if (!al.descontar_emocoes) e["al_desc"] = "Obrigatório";
      if (!al.alimentos_nao_vive_sem) e["al_sem"] = "Obrigatório";
      if (!al.alimentos_nao_come) e["al_nao"] = "Obrigatório";
    }
    if (step === 8) {
      if (!ha.dorme_bem) e["ha_dorme"] = "Obrigatório";
      if (!ha.acorda_descansado) e["ha_acorda"] = "Obrigatório";
      if (!ha.horas_sono) e["ha_horas"] = "Obrigatório";
      if (!ha.agua_litros) e["ha_agua"] = "Obrigatório";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function next() {
    if (!validate()) {
      // scroll to first error
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
    const nomeAluno = (data.dados_pessoais?.nome as string) || null;
    const tel = data.dados_pessoais?.telefone as string;

    // PASSO 1: tentar criar/encontrar o aluno (não fatal — se falhar, a resposta
    // ainda será gravada sem aluno_id e a equipe resgata pelo log).
    let vinculadoAlunoId: string | null = alunoId ?? null;
    if (!vinculadoAlunoId) {
      try {
        // Server function (service role) — busca por telefone OU cria.
        // Bypassa RLS para evitar falhas em sessões anon/expiradas.
        const novo = await criarAlunoFn({
          data: {
            nome: data.dados_pessoais.nome,
            telefone: tel,
            email: data.dados_pessoais.email ?? null,
            peso_kg: data.dados_pessoais.peso ?? null,
            altura_cm: data.dados_pessoais.altura ?? null,
            sexo: data.dados_pessoais.genero ?? null,
            data_nascimento: data.dados_pessoais.nascimento ?? null,
          },
        });
        if (novo.id) {
          vinculadoAlunoId = novo.id;
        } else {
          await logarFalhaPublica({
            modulo: "anamnese_publica",
            etapa: "criar_aluno",
            mensagem: novo.error || "Falha desconhecida ao criar aluno",
            contexto: { formId, telefone: tel, nome: nomeAluno, email: data.dados_pessoais?.email },
            alunoNome: nomeAluno,
          });
        }
      } catch (e: any) {
        await logarFalhaPublica({
          modulo: "anamnese_publica",
          etapa: "buscar_ou_criar_aluno",
          mensagem: e?.message || String(e),
          contexto: { formId, telefone: tel, nome: nomeAluno },
          alunoNome: nomeAluno,
        });
      }
    } else {
      // Aluno já existia (link tokenizado). Usa a mesma server function só para
      // preencher campos vazios (peso/altura/sexo/nascimento) sem sobrescrever
      // dado já cadastrado.
      try {
        await criarAlunoFn({
          data: {
            nome: data.dados_pessoais.nome,
            telefone: tel,
            email: data.dados_pessoais.email ?? null,
            peso_kg: data.dados_pessoais.peso ?? null,
            altura_cm: data.dados_pessoais.altura ?? null,
            sexo: data.dados_pessoais.genero ?? null,
            data_nascimento: data.dados_pessoais.nascimento ?? null,
          },
        });
      } catch (e: any) {
        await logarFalhaPublica({
          modulo: "anamnese_publica",
          etapa: "preencher_dados_aluno_existente",
          mensagem: e?.message || String(e),
          contexto: { formId, alunoId: vinculadoAlunoId },
          alunoNome: nomeAluno,
        });
      }
    }

    // PASSO 2 (CRÍTICO): submete via server function (token-validado, service role).
    // Faz update do formulário + vincula aluno + status + historico em uma só chamada.
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
        modulo: "anamnese_publica",
        etapa: "salvar_formulario",
        mensagem: submitRes.error || "submeterFormularioPublico falhou",
        contexto: { formId, telefone: tel, nome: nomeAluno },
        alunoNome: nomeAluno,
      });
      return;
    }

    // O envio do WhatsApp pós-anamnese agora é feito server-side dentro de
    // submeterFormularioPublico (server fn já validada por token).

    try { localStorage.removeItem(storageKey); } catch {}
    setSubmitted(true);
    setSubmitting(false);
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
            <h1 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: INK }}>Anamnese enviada com sucesso.</h1>
            <p className="text-base" style={{ color: MUTED }}>
              Em até 3 dias úteis você receberá seu planejamento personalizado via WhatsApp.
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
            <h1 className="text-3xl md:text-4xl font-bold mb-6" style={{ color: INK }}>Bem-vindo(a) ao MPTEAM.</h1>
            <div className="text-base md:text-lg leading-relaxed mb-8 whitespace-pre-line" style={{ color: INK }}>
              {"Treino e dieta personalizados para quem quer resultado de verdade, sem viver no achismo.\n\nAqui você tem estratégia, acompanhamento e ajustes constantes para evoluir com clareza.\n\nResultado vem de direção, constância e responsabilidade."}
            </div>
            <p className="text-sm mb-10" style={{ color: MUTED }}>
              Preencha com calma e sinceridade. Quanto mais detalhes você passar, mais preciso será o seu planejamento.
            </p>
            <button
              onClick={() => { setStarted(true); window.scrollTo({ top: 0 }); }}
              className="inline-flex items-center justify-between gap-6 min-w-[280px] px-8 py-4 rounded-xl text-white font-semibold text-base hover:opacity-95 transition"
              style={{ backgroundColor: RED, boxShadow: `0 10px 30px -8px ${RED}80` }}
            >
              <span>Iniciar anamnese</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </Card>
      </Page>
    );
  }

  const stepLabel = STEP_LABELS[step];
  const isLast = step === TOTAL - 1;
  const isFemale = (data.dados_pessoais.genero || "").toLowerCase() === "feminino";

  return (
    <Page>
      {/* Header com progresso */}
      <div className="mb-6">
        <Logo />
        <div className="h-1.5 rounded-full overflow-hidden mt-5" style={{ backgroundColor: BORDER }}>
          <div className="h-full transition-all duration-300" style={{ width: `${((step + 1) / TOTAL) * 100}%`, backgroundColor: RED }} />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs" style={{ color: MUTED }}>
          <span>Etapa {step + 1} de {TOTAL}</span>
          <span className="font-medium" style={{ color: INK }}>{stepLabel}</span>
        </div>
      </div>

      <Card>
        <Tag>{stepLabel}</Tag>
        <StepHeader step={step} />

        <div className="mt-6">
          {step === 0 && <Step1 data={data.dados_pessoais} onChange={(p) => setBlock("dados_pessoais", p)} errors={errors} />}
          {step === 1 && <Step2 data={data.historico} onChange={(p) => setBlock("historico", p)} />}
          {step === 2 && <Step3 data={data.saude} onChange={(p) => setBlock("saude", p)} errors={errors} isFemale={isFemale} token={token} />}
          {step === 3 && <Step4 data={data.objetivo} onChange={(p) => setBlock("objetivo", p)} errors={errors} />}
          {step === 4 && <Step5 data={data.ergogenicos} onChange={(p) => setBlock("ergogenicos", p)} errors={errors} />}
          {step === 5 && <Step6 data={data.fatores_risco} onChange={setRisco} errors={errors} />}
          {step === 6 && <Step7 data={data.treino} onChange={(p) => setBlock("treino", p)} errors={errors} />}
          {step === 7 && <Step8 data={data.alimentacao} onChange={(p) => setBlock("alimentacao", p)} errors={errors} />}
          {step === 8 && <Step9 data={data.habitos} onChange={(p) => setBlock("habitos", p)} errors={errors} />}
          {step === 9 && <Step10 data={data.recordatorio} onChange={setRefeicao} />}
          {step === 10 && <Step11 data={data.fotos} onChange={(p) => setBlock("fotos", p)} token={token} />}
          {step === 11 && <Step12 value={data.desabafo} onChange={(v) => setData((d) => ({ ...d, desabafo: v }))} />}
        </div>

        {submitError && (
          <div className="mt-6 p-3 rounded text-sm" style={{ backgroundColor: "#fee", color: RED, border: `1px solid ${RED}` }}>
            Erro ao enviar: {submitError}
          </div>
        )}

        {/* Footer */}
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
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</> : isLast ? <>Enviar anamnese <Check className="w-4 h-4" /></> : <>Continuar <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </Card>
      <ConfirmarTelefoneModal
        open={confirmandoTel}
        telefone={data.dados_pessoais.telefone || ""}
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

/* ========== Layout helpers ========== */
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
    { t: "Sobre você", d: "Preciso dessas informações para personalizar toda a sua estratégia." },
    { t: "Experiências anteriores", d: "Entender o que funcionou e o que não funcionou orienta melhor o planejamento." },
    { t: "Histórico de saúde", d: "Informações essenciais para uma prescrição segura e eficiente." },
    { t: "Direção física", d: "Onde você quer chegar. Seja específico — isso define todo o planejamento." },
    { t: "Anabolizantes e suplementação", d: "Informação sigilosa. Necessária para montar um protocolo seguro." },
    { t: "Histórico de saúde e família", d: "Essencial para identificar contraindicações e prioridades clínicas." },
    { t: "Rotina de treino atual", d: "Quero entender de onde você parte para montar algo que você realmente consiga executar." },
    { t: "Como você come e vive", d: "Quanto mais detalhes, mais preciso será o planejamento alimentar." },
    { t: "Sono, digestão e hidratação", d: "" },
    { t: "O que você come hoje", d: "Descreva o mais próximo possível da realidade, incluindo fins de semana se forem diferentes." },
    { t: "Fotos para análise física", d: "" },
    { t: "Espaço livre", d: "" },
  ];
  const cur = titles[step];
  return (
    <div className="mt-4">
      <h2 className="text-2xl md:text-3xl font-bold leading-tight" style={{ color: INK }}>{cur.t}</h2>
      {cur.d && <p className="mt-2 text-sm md:text-base" style={{ color: MUTED }}>{cur.d}</p>}
    </div>
  );
}

/* ========== Inputs ========== */
function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold mb-1.5" style={{ color: INK }}>
      {children}{required && <span style={{ color: RED }}> *</span>}
    </label>
  );
}
function ErrorMsg({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p data-error="true" className="mt-1 text-xs font-medium" style={{ color: RED }}>{msg}</p>;
}
function inputCls(hasError?: boolean) {
  return "w-full px-3.5 py-3 text-base rounded-md outline-none transition";
}
function inputStyle(hasError?: boolean): React.CSSProperties {
  return { backgroundColor: SURFACE, border: `1px solid ${hasError ? RED : BORDER}`, color: INK, fontSize: 16 };
}
function TextInput({ value, onChange, placeholder, type = "text", inputMode, error }: { value: any; onChange: (v: string) => void; placeholder?: string; type?: string; inputMode?: any; error?: string }) {
  return (
    <>
      <input type={type} inputMode={inputMode} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={inputCls()} style={inputStyle(!!error)} />
      <ErrorMsg msg={error} />
    </>
  );
}
function TextArea({ value, onChange, placeholder, rows = 4, error, minH }: { value: any; onChange: (v: string) => void; placeholder?: string; rows?: number; error?: string; minH?: number }) {
  return (
    <>
      <textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={inputCls()} style={{ ...inputStyle(!!error), minHeight: minH, resize: "vertical" }} />
      <ErrorMsg msg={error} />
    </>
  );
}
function Radio({ name, value, onChange, options, error, inline }: { name: string; value: any; onChange: (v: string) => void; options: string[]; error?: string; inline?: boolean }) {
  return (
    <>
      <div className={inline ? "flex flex-wrap gap-2" : "space-y-2"}>
        {options.map((o) => {
          const checked = value === o;
          return (
            <label key={o} className="cursor-pointer">
              <input type="radio" name={name} checked={checked} onChange={() => onChange(o)} className="sr-only" />
              <span
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition"
                style={{
                  backgroundColor: checked ? RED : SURFACE,
                  color: checked ? "#fff" : INK,
                  border: `1px solid ${checked ? RED : BORDER}`,
                }}
              >
                {o}
              </span>
            </label>
          );
        })}
      </div>
      <ErrorMsg msg={error} />
    </>
  );
}
function YesNoCard({ label, value, onChange, error }: { label: string; value: any; onChange: (v: string) => void; error?: string }) {
  return (
    <div className="rounded-md p-3" style={{ border: `1px solid ${error ? RED : BORDER}`, backgroundColor: SURFACE }}>
      <div className="text-sm font-medium mb-2" style={{ color: INK }}>{label}</div>
      <Radio name={`yn-${label}`} value={value} onChange={onChange} options={["Sim", "Não"]} inline />
      <ErrorMsg msg={error} />
    </div>
  );
}
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div><Label required={required}>{label}</Label>{children}</div>;
}
function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

/* ========== Step components ========== */
function Step1({ data, onChange, errors }: { data: any; onChange: (p: any) => void; errors: Record<string, string> }) {
  const [ddi, setDdi] = useState<string>(() => splitPhone(data.telefone || "").ddi);
  return (
    <div className="space-y-4">
      <Field label="Nome completo" required>
        <TextInput value={data.nome} onChange={(v) => onChange({ nome: v })} error={errors.dp_nome} />
      </Field>
      <Field label="E-mail" required>
        <TextInput type="email" inputMode="email" value={data.email} onChange={(v) => onChange({ email: v })} error={errors.dp_email} />
      </Field>
      <PhoneDdiInput
        value={data.telefone || ""}
        onChange={(v) => onChange({ telefone: v })}
        ddi={ddi}
        onDdiChange={setDdi}
        numeroLabel="Telefone com DDD"
        placeholder="Ex: 81999999999"
        error={errors.dp_telefone}
      />
      <div
        className="flex items-start gap-2 rounded-md p-3 text-xs"
        style={{ backgroundColor: "#fef3c7", border: "1px solid #fcd34d", color: "#78350f" }}
      >
        <span aria-hidden>⚠️</span>
        <span>
          <strong>Confirme o número antes de enviar.</strong> Esse WhatsApp será usado para todos os
          seus retornos. Inclua o DDD (ex.: 81) e cheque dígito por dígito.
        </span>
      </div>
      <Grid2>
        <Field label="Data de nascimento" required>
          <TextInput type="date" value={data.nascimento} onChange={(v) => onChange({ nascimento: v })} error={errors.dp_nascimento} />
        </Field>
        <Field label="Com qual gênero você se identifica" required>
          <Radio name="genero" value={data.genero} onChange={(v) => onChange({ genero: v })} options={["Feminino", "Masculino"]} inline error={errors.dp_genero} />
        </Field>
      </Grid2>
      <Grid2>
        <Field label="Peso atual (kg)" required>
          <TextInput type="number" inputMode="decimal" value={data.peso} onChange={(v) => onChange({ peso: v })} error={errors.dp_peso} />
        </Field>
        <Field label="Altura (cm)" required>
          <TextInput type="number" inputMode="numeric" value={data.altura} onChange={(v) => onChange({ altura: v })} error={errors.dp_altura} />
        </Field>
      </Grid2>
      <Field label="Como me conheceu">
        <TextInput value={data.como_conheceu} onChange={(v) => onChange({ como_conheceu: v })} placeholder="Instagram, indicação, Google..." />
      </Field>
      <Field label="Instagram (@)">
        <TextInput value={data.instagram} onChange={(v) => onChange({ instagram: v })} placeholder="@seu_usuario" />
      </Field>
    </div>
  );
}

function Step2({ data, onChange }: { data: any; onChange: (p: any) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Já teve acompanhamento online anteriormente? Como foi?">
        <TextArea value={data.acomp_online} onChange={(v) => onChange({ acomp_online: v })} placeholder="Conte sua experiência..." />
      </Field>
      <Field label="Já teve acompanhamento nutricional? O que funcionou e o que não?">
        <TextArea value={data.acomp_nutri} onChange={(v) => onChange({ acomp_nutri: v })} placeholder="O que deu certo e o que travou..." />
      </Field>
    </div>
  );
}

function Step3({ data, onChange, errors, isFemale, token }: { data: any; onChange: (p: any) => void; errors: Record<string, string>; isFemale: boolean; token: string }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const exames: { url: string; name: string }[] = data.exames_arquivos || [];

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    const novos = [...exames];
    const falhas: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) { alert(`${file.name}: máximo 10MB`); continue; }
      const { url, error } = await uploadAnamneseAsset({
        pathPrefix: `anamnese/${token}/exames/`,
        file,
        token,
      });
      if (error || !url) {
        console.warn(`[anamnese] falha upload exame ${file.name}:`, error);
        falhas.push(file.name);
        continue;
      }
      novos.push({ url, name: file.name });
    }
    onChange({ exames_arquivos: novos });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (falhas.length) {
      alert(
        `Não foi possível enviar: ${falhas.join(", ")}.\nVocê pode tentar novamente ou continuar sem esses anexos.`,
      );
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Possui plano de saúde?">
        <Radio name="plano_saude" value={data.plano_saude} onChange={(v) => onChange({ plano_saude: v })} options={["Sim", "Não"]} inline />
      </Field>
      <Field label="Quando realizou seus últimos exames de sangue?">
        <TextInput value={data.ultimos_exames} onChange={(v) => onChange({ ultimos_exames: v })} placeholder="Ex: há 3 meses, em janeiro/2025..." />
      </Field>
      <div>
        <Label>Exames recentes (PDF, JPG, PNG — até 10MB)</Label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full rounded-md p-5 text-center transition hover:opacity-80"
          style={{ border: `1.5px dashed ${BORDER}`, backgroundColor: BG }}
        >
          {uploading ? <Loader2 className="w-5 h-5 mx-auto animate-spin" style={{ color: RED }} /> : (
            <>
              <Paperclip className="w-5 h-5 mx-auto mb-1.5" style={{ color: RED }} />
              <div className="text-sm font-medium" style={{ color: INK }}>Clique para anexar exames</div>
              <div className="text-xs mt-0.5" style={{ color: MUTED }}>PDF, JPG, PNG — até 10MB</div>
            </>
          )}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
        {exames.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {exames.map((f, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2 rounded text-sm" style={{ border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
                <a href={f.url} target="_blank" rel="noreferrer" className="truncate hover:underline" style={{ color: INK }}>{f.name}</a>
                <button onClick={() => onChange({ exames_arquivos: exames.filter((_, j) => j !== i) })} className="ml-3 p-1 hover:opacity-60" aria-label="Remover">
                  <X className="w-4 h-4" style={{ color: MUTED }} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Field label="Faz uso de medicação contínua? Se sim, quais?">
        <TextArea value={data.medicacao} onChange={(v) => onChange({ medicacao: v })} />
      </Field>
      <Field label="Já realizou alguma cirurgia?" required>
        <Radio name="cirurgia" value={data.cirurgia} onChange={(v) => onChange({ cirurgia: v })} options={["Sim", "Não"]} inline error={errors.sa_cirurgia} />
      </Field>
      {data.cirurgia === "Sim" && (
        <Field label="Qual cirurgia?">
          <TextArea value={data.cirurgia_qual} onChange={(v) => onChange({ cirurgia_qual: v })} placeholder="Descreva a cirurgia e quando foi..." />
        </Field>
      )}
      {isFemale && (
        <Field label="Faz uso de método contraceptivo? Qual?">
          <TextArea value={data.contraceptivo} onChange={(v) => onChange({ contraceptivo: v })} />
        </Field>
      )}
    </div>
  );
}

function Step4({ data, onChange, errors }: { data: any; onChange: (p: any) => void; errors: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <Field label="Qual é o seu objetivo principal?" required>
        <TextArea value={data.objetivo_principal} onChange={(v) => onChange({ objetivo_principal: v })} error={errors.ob_objetivo}
          placeholder="Hipertrofia, emagrecimento, recomposição, performance..." />
      </Field>
      <Field label="Quais grupos musculares você gostaria de priorizar?">
        <TextArea value={data.grupos_prioridade} onChange={(v) => onChange({ grupos_prioridade: v })} rows={2} />
      </Field>
      <div>
        <Label>Pirâmide de preferência</Label>
        <p className="text-sm mb-1" style={{ color: INK }}>
          Descreva o tipo físico que te agrada, seus grupos musculares preferidos e os que você julga como ênfase.
        </p>
        <p className="text-sm italic mb-2" style={{ color: MUTED }}>
          Ex: Gostaria de dar ênfase em quadríceps e glúteo.
        </p>
        <TextArea value={data.piramide} onChange={(v) => onChange({ piramide: v })} placeholder="Descreva suas preferências..." />
      </div>
    </div>
  );
}

function Step5({ data, onChange, errors }: { data: any; onChange: (p: any) => void; errors: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <Field label="Já fez uso de esteroides anabolizantes?" required>
        <Radio name="esteroides" value={data.ja_usou_esteroides} onChange={(v) => onChange({ ja_usou_esteroides: v })} options={["Sim", "Não"]} inline error={errors.er_esteroides} />
      </Field>
      {data.ja_usou_esteroides === "Sim" && (
        <Field label="Descreva histórico, substâncias, tempo de uso, dosagens e padrão de consumo">
          <TextArea value={data.esteroides_historico} onChange={(v) => onChange({ esteroides_historico: v })} rows={5} />
        </Field>
      )}
      <Field label="Pretende fazer uso?">
        <Radio name="pretende" value={data.pretende_usar} onChange={(v) => onChange({ pretende_usar: v })} options={["Sim", "Não", "Talvez"]} inline />
      </Field>
      <Field label="Tem sensibilidade à cafeína?">
        <Radio name="cafeina" value={data.sensibilidade_cafeina} onChange={(v) => onChange({ sensibilidade_cafeina: v })} options={["Sim", "Não"]} inline />
      </Field>
      <Field label="Usa ou já usou pré-treino? Qual?">
        <TextInput value={data.pre_treino} onChange={(v) => onChange({ pre_treino: v })} />
      </Field>
    </div>
  );
}

function Step6({ data, onChange, errors }: { data: any; onChange: (group: "pessoal" | "familiar", k: string, v: string) => void; errors: Record<string, string> }) {
  const pessoais = [
    { key: "fuma", label: "Fuma" },
    { key: "diabetes", label: "Diabetes" },
    { key: "sobrepeso", label: "Sobrepeso ou obesidade" },
    { key: "sedentarismo", label: "Sedentarismo" },
    { key: "dislipidemias", label: "Dislipidemias" },
  ];
  const fam = [
    { key: "diabetes", label: "Diabetes" },
    { key: "hipertensao", label: "Hipertensão" },
    { key: "cardiovasculares", label: "Doenças cardiovasculares" },
    { key: "derrame", label: "Derrame" },
    { key: "cancer", label: "Câncer" },
    { key: "obesidade", label: "Obesidade" },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold mb-3" style={{ color: INK }}>Seus fatores</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pessoais.map((p) => (
            <YesNoCard key={p.key} label={p.label} value={data.pessoal[p.key]} onChange={(v) => onChange("pessoal", p.key, v)} error={errors[`fp_${p.key}`]} />
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold mb-3" style={{ color: INK }}>Histórico familiar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fam.map((p) => (
            <YesNoCard key={p.key} label={p.label} value={data.familiar[p.key]} onChange={(v) => onChange("familiar", p.key, v)} error={errors[`ff_${p.key}`]} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Step7({ data, onChange, errors }: { data: any; onChange: (p: any) => void; errors: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <Field label="Há quanto tempo treina?" required>
        <TextInput value={data.tempo_treino} onChange={(v) => onChange({ tempo_treino: v })} placeholder="Ex: 3 anos" error={errors.tr_tempo} />
      </Field>
      <Field label="Qual modalidade pratica?" required>
        <TextInput value={data.modalidade} onChange={(v) => onChange({ modalidade: v })} placeholder="Musculação, crossfit, funcional..." error={errors.tr_mod} />
      </Field>
      <Grid2>
        <Field label="Quantas vezes/semana pretende treinar?" required>
          <TextInput value={data.frequencia} onChange={(v) => onChange({ frequencia: v })} placeholder="Ex: 5x" error={errors.tr_freq} />
        </Field>
        <Field label="Horário preferido">
          <TextInput value={data.horario} onChange={(v) => onChange({ horario: v })} placeholder="Manhã, tarde, noite..." />
        </Field>
      </Grid2>
      <Field label="Quanto tempo pretende ficar na academia?">
        <TextInput value={data.duracao} onChange={(v) => onChange({ duracao: v })} placeholder="Ex: 1h30" />
      </Field>
      <Field label="Descreva sua divisão de treino atual e outros exercícios que pratica, com frequência, volume e organização" required>
        <TextArea value={data.divisao} onChange={(v) => onChange({ divisao: v })} rows={5} error={errors.tr_div} />
      </Field>
    </div>
  );
}

function Step8({ data, onChange, errors }: { data: any; onChange: (p: any) => void; errors: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <Field label="Como você considera o esforço físico do seu dia a dia?" required>
        <Radio name="esforco" value={data.esforco_diario} onChange={(v) => onChange({ esforco_diario: v })} options={["Leve", "Moderado", "Intenso"]} inline error={errors.al_esforco} />
      </Field>
      <Field label="Tem compulsão por doce ou algum alimento específico?">
        <TextArea value={data.compulsao} onChange={(v) => onChange({ compulsao: v })} rows={2} />
      </Field>
      <Field label="Quantas refeições faz por dia?" required>
        <TextInput type="number" inputMode="numeric" value={data.refeicoes_dia} onChange={(v) => onChange({ refeicoes_dia: v })} error={errors.al_ref} />
      </Field>
      <Field label="Faz uso de suplementos? Quais?">
        <TextArea value={data.suplementos} onChange={(v) => onChange({ suplementos: v })} rows={2} />
      </Field>
      <Field label="Em qual horário sente mais fome?">
        <TextInput value={data.horario_fome} onChange={(v) => onChange({ horario_fome: v })} />
      </Field>
      <Field label="Costuma descontar emoções na comida?" required>
        <Radio name="descontar" value={data.descontar_emocoes} onChange={(v) => onChange({ descontar_emocoes: v })} options={["Sim", "Não", "Às vezes"]} inline error={errors.al_desc} />
      </Field>
      <Field label="Possui intolerância ou alergia alimentar?">
        <TextArea value={data.intolerancia} onChange={(v) => onChange({ intolerancia: v })} rows={2} />
      </Field>
      <Field label="Consegue fazer refeições sólidas em qualquer horário? Se não, explique">
        <TextArea value={data.solidas} onChange={(v) => onChange({ solidas: v })} rows={2} />
      </Field>
      <Field label="Cite 10 alimentos que você não vive sem" required>
        <TextArea value={data.alimentos_nao_vive_sem} onChange={(v) => onChange({ alimentos_nao_vive_sem: v })} rows={3} error={errors.al_sem} />
      </Field>
      <Field label="Cite 5 alimentos que você não consegue comer" required>
        <TextArea value={data.alimentos_nao_come} onChange={(v) => onChange({ alimentos_nao_come: v })} rows={2} error={errors.al_nao} />
      </Field>
    </div>
  );
}

function Step9({ data, onChange, errors }: { data: any; onChange: (p: any) => void; errors: Record<string, string> }) {
  return (
    <div className="space-y-4">
      <Grid2>
        <Field label="Dorme bem?" required>
          <Radio name="dorme" value={data.dorme_bem} onChange={(v) => onChange({ dorme_bem: v })} options={["Sim", "Não"]} inline error={errors.ha_dorme} />
        </Field>
        <Field label="Acorda descansado?" required>
          <Radio name="acorda" value={data.acorda_descansado} onChange={(v) => onChange({ acorda_descansado: v })} options={["Sim", "Não"]} inline error={errors.ha_acorda} />
        </Field>
      </Grid2>
      <Field label="Quantas horas por noite?" required>
        <TextInput type="number" inputMode="numeric" value={data.horas_sono} onChange={(v) => onChange({ horas_sono: v })} error={errors.ha_horas} />
      </Field>
      <Grid2>
        <Field label="Vai ao banheiro todos os dias?">
          <Radio name="banheiro" value={data.banheiro} onChange={(v) => onChange({ banheiro: v })} options={["Sim", "Não"]} inline />
        </Field>
        <Field label="Evacua sem dor ou dificuldade?">
          <Radio name="evacua" value={data.evacua} onChange={(v) => onChange({ evacua: v })} options={["Sim", "Não"]} inline />
        </Field>
      </Grid2>
      <Field label="Quantidade de água por dia (em litros)" required>
        <TextInput value={data.agua_litros} onChange={(v) => onChange({ agua_litros: v })} placeholder="Ex: 2,5L" error={errors.ha_agua} />
      </Field>
      <Field label="Faz uso de bebida alcoólica? Se sim, com qual frequência e qual tipo?">
        <TextArea value={data.alcool} onChange={(v) => onChange({ alcool: v })} rows={2} />
      </Field>
    </div>
  );
}

function Step10({ data, onChange }: { data: Record<string, { horario: string; comida: string }>; onChange: (key: string, p: { horario?: string; comida?: string }) => void }) {
  const refeicoes = [
    { key: "cafe_manha", label: "Café da manhã" },
    { key: "lanche_manha", label: "Lanche da manhã" },
    { key: "almoco", label: "Almoço" },
    { key: "lanche_tarde", label: "Lanche da tarde" },
    { key: "jantar", label: "Jantar" },
    { key: "ceia", label: "Ceia" },
  ];
  return (
    <div className="space-y-3">
      {refeicoes.map((r) => (
        <div key={r.key} className="rounded-md p-4" style={{ border: `1px solid ${BORDER}`, backgroundColor: SURFACE }}>
          <h3 className="text-sm font-bold mb-3" style={{ color: INK }}>{r.label}</h3>
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-3">
            <div>
              <Label>Horário</Label>
              <TimePicker
                value={data[r.key]?.horario || "07:00"}
                onChange={(v) => onChange(r.key, { horario: v })}
              />
            </div>
            <div>
              <Label>O que costuma comer</Label>
              <TextInput value={data[r.key]?.comida} onChange={(v) => onChange(r.key, { comida: v })} placeholder="Descreva..." />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Step11({ data, onChange, token }: { data: any; onChange: (p: any) => void; token: string }) {
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed" style={{ color: INK }}>
        Não estou aqui para te julgar, e sim para te ajudar. O que mais recebo são fotos de avaliação, e nosso único objetivo ao analisá-las é decidir como posso contribuir da melhor forma para sua evolução. Por isso, é essencial que as fotos mostrem o máximo possível do seu físico, permitindo que você também acompanhe sua própria transformação ao longo do processo.
      </p>
      <ul className="space-y-1.5 text-sm" style={{ color: INK }}>
        <li><strong>Posições:</strong> Frente · Costas · Perfil esquerdo</li>
        <li><strong>Roupa:</strong> Biquíni ou sunga. Opção 2: top e shorts com umbigo aparente. Sempre a mesma roupa.</li>
        <li><strong>Local:</strong> mesmo lugar, fundo neutro, sem objetos ao redor.</li>
        <li><strong>Ângulo:</strong> celular na altura do abdômen. Corpo inteiro visível da cabeça aos pés. Luz natural.</li>
      </ul>
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <PhotoSlot label="Frente" slot="frente" url={data.frente} onChange={(url) => onChange({ frente: url })} token={token} />
        <PhotoSlot label="Costas" slot="costas" url={data.costas} onChange={(url) => onChange({ costas: url })} token={token} />
        <PhotoSlot label="Perfil esquerdo" slot="perfil_esquerdo" url={data.perfil_esquerdo} onChange={(url) => onChange({ perfil_esquerdo: url })} token={token} />
      </div>
    </div>
  );
}

function PhotoSlot({ label, slot, url, onChange, token }: { label: string; slot: string; url?: string; onChange: (url: string) => void; token: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  async function handle(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("Máximo 10MB"); return; }
    // Mostra a prévia local imediatamente (independe do upload).
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      setPreviewUrl(dataUrl);
      setImgError(false);
    } catch (e) {
      console.warn("[anamnese] preview local falhou", e);
    }
    setUploading(true);
    const { url: signed, error } = await uploadAnamneseAsset({
      pathPrefix: `anamnese/${token}/fotos/`,
      file: new File([file], `${slot}.${(file.name.split(".").pop() || "jpg").toLowerCase()}`, { type: file.type || "image/jpeg" }),
      token,
    });
    if (error || !signed) {
      console.warn(`[anamnese] falha upload foto ${slot}:`, error);
      alert("Não foi possível enviar a foto agora. Você pode continuar sem ela.");
      setUploading(false);
      setPreviewUrl(null);
      if (ref.current) ref.current.value = "";
      return;
    }
    console.info(`[anamnese] foto ${slot} enviada. signedUrl:`, signed);
    onChange(signed);
    setUploading(false);
    if (ref.current) ref.current.value = "";
  }
  // Mostra primeiro a prévia local (DataURL); se não houver, tenta a signedUrl persistida.
  const displayUrl = previewUrl || url || "";
  const showImage = !!displayUrl && !imgError;
  return (
    <div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full overflow-hidden relative"
        style={{ aspectRatio: "3/4", border: `1.5px ${displayUrl ? "solid" : "dashed"} ${BORDER}`, backgroundColor: showImage ? "#000" : BG, borderRadius: 8 }}
      >
        {uploading ? (
          <Loader2 className="w-6 h-6 animate-spin absolute inset-0 m-auto" style={{ color: RED }} />
        ) : showImage ? (
          <img
            src={displayUrl}
            alt={label}
            className="w-full h-full object-cover"
            onError={() => {
              console.error(`[anamnese] falha ao exibir imagem (${slot}):`, displayUrl);
              setImgError(true);
            }}
          />
        ) : url && imgError ? (
          <div className="flex flex-col items-center justify-center h-full px-2 text-center">
            <Camera className="w-6 h-6 mb-1.5" style={{ color: RED }} />
            <div className="text-[11px] font-medium" style={{ color: INK }}>Foto enviada</div>
            <div className="text-[10px]" style={{ color: MUTED }}>(prévia indisponível)</div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <Camera className="w-6 h-6 mb-1.5" style={{ color: RED }} />
            <div className="text-xs font-medium px-1 text-center" style={{ color: INK }}>{label}</div>
          </div>
        )}
      </button>
      <input ref={ref} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
      {url && (
        <button
          onClick={() => {
            onChange("");
            setPreviewUrl(null);
            setImgError(false);
          }}
          className="text-xs mt-1.5 hover:underline"
          style={{ color: MUTED }}
        >
          Trocar foto
        </button>
      )}
    </div>
  );
}

function Step12({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-base" style={{ color: INK }}>Aqui você é livre para escrever tudo que quiser.</p>
      <p className="text-sm" style={{ color: MUTED }}>Pensamentos, dúvidas, medos, expectativas ou qualquer coisa que gostaria de compartilhar. Ninguém além de mim lê isso.</p>
      <TextArea value={value} onChange={onChange} placeholder="Escreva à vontade..." minH={160} rows={6} />
    </div>
  );
}