import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  lerFormularioPorToken,
  submeterFormularioPublico,
} from "@/server/formulario-publico-flow.functions";
import { AnamneseFlow } from "@/components/anamnese/AnamneseFlow";
import { FeedbackQuinzenalFlow } from "@/components/feedback/FeedbackQuinzenalFlow";
import { FeedbackMensalFlow } from "@/components/feedback/FeedbackMensalFlow";
import { useBranding } from "@/hooks/useBranding";

export const Route = createFileRoute("/formularios/$token")({
  component: PublicForm,
  head: () => ({ meta: [
    { title: "Formulário — FITFLOW" },
    { name: "description", content: "Responda seu formulário de acompanhamento na FITFLOW." },
    { property: "og:title", content: "Formulário — FITFLOW" },
    { property: "og:description", content: "Formulário de acompanhamento FITFLOW." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

type Tipo = "anamnese" | "feedback_quinzenal" | "feedback_mensal" | "check_shape";

interface FormDef { id: string; tipo: Tipo; respondido: boolean; aluno_id: string | null }

const RADIO_EVOL = [
  "Muito satisfeito, percebo mudanças claras",
  "Satisfeito, mas ainda quero melhorar mais",
  "Neutro, não percebi mudanças significativas",
  "Insatisfeito, esperava mais resultados",
];
const RADIO_ADESAO = [
  "100% — não perdi nenhum treino", "75% — perdi poucos treinos",
  "50% — metade dos treinos realizados", "25% — treinei pouco", "Não consegui treinar",
];
const RADIO_DIETA = [
  "100% — segui o plano todos os dias", "75% — pequenas saídas do plano",
  "50% — metade do tempo no plano", "25% — dificuldade grande em seguir", "Não consegui seguir o plano",
];
const RADIO_FDS = ["Mantive o plano normalmente","Fugi um pouco, mas voltei rápido","Fugi bastante e preciso ajustar"];
const RADIO_SONO = ["Durmo bem e acordo descansado","Durmo ok, mas poderia melhorar","Sono ruim, acordo cansado frequentemente"];
const RADIO_AGUA = ["Mais de 3L por dia","Entre 2L e 3L por dia","Entre 1L e 2L por dia","Menos de 1L por dia"];
const RADIO_INTESTINO = ["Sim, funcionando bem todos os dias","Irregular, alguns dias com dificuldade","Não, com bastante dificuldade"];

function PublicForm() {
  const { token } = Route.useParams();
  const lerFn = useServerFn(lerFormularioPorToken);
  const submeterFn = useServerFn(submeterFormularioPublico);
  const [form, setForm] = useState<FormDef | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState(0);
  const [data, setData] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await lerFn({ data: { token } });
      if (!res.ok) { setError("Link inválido."); return; }
      if (res.form.respondido) { setError("Este formulário já foi respondido."); return; }
      setForm(res.form as FormDef);
    })();
  }, [token, lerFn]);

  if (error) return <PublicShell><p className="text-center text-muted-foreground">{error}</p></PublicShell>;
  if (!form) return <PublicShell><p className="text-center text-muted-foreground">Carregando...</p></PublicShell>;
  if (submitted) return <PublicShell><p className="text-center">Resposta enviada. Obrigado!</p></PublicShell>;

  // Anamnese tem fluxo dedicado MPTEAM (12 etapas)
  if (form.tipo === "anamnese") {
    return <AnamneseFlow formId={form.id} alunoId={form.aluno_id} token={token} onSubmitted={async () => {}} />;
  }
  // Feedback Quinzenal tem fluxo dedicado MPTEAM (7 etapas)
  if (form.tipo === "feedback_quinzenal") {
    return <FeedbackQuinzenalFlow formId={form.id} alunoId={form.aluno_id} token={token} onSubmitted={async () => {}} />;
  }
  // Feedback Mensal tem fluxo dedicado MPTEAM (8 etapas)
  if (form.tipo === "feedback_mensal") {
    return <FeedbackMensalFlow formId={form.id} alunoId={form.aluno_id} token={token} onSubmitted={async () => {}} />;
  }

  const sections = SECTIONS[form.tipo];
  const total = sections.length;
  const cur = sections[section];
  const isLast = section === total - 1;

  function setField(name: string, value: any) { setData((d) => ({ ...d, [name]: value })); }

  function validateSection(): string | null {
    for (const f of cur.fields) {
      if (f.required) {
        const v = data[f.name];
        if (v === undefined || v === null || v === "") return `Preencha: ${f.label}`;
      }
    }
    return null;
  }

  async function next() {
    const e = validateSection(); if (e) { alert(e); return; }
    if (!isLast) { setSection((s) => s + 1); window.scrollTo(0, 0); return; }
    await submit();
  }

  async function submit() {
    if (!form) return;
    const res = await submeterFn({
      data: { formId: form.id, token, dados: data, alunoId: form.aluno_id ?? null },
    });
    if (!res.ok) { alert(res.error ?? "Falha ao enviar"); return; }
    setSubmitted(true);
  }

  return (
    <PublicShell>
      <div className="mb-6">
        <div className="h-1 bg-muted rounded overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${((section + 1) / total) * 100}%` }} />
        </div>
        <div className="text-xs text-muted-foreground mt-2">Seção {section + 1} de {total} · {cur.title}</div>
      </div>
      <h2 className="text-xl font-bold mb-6">{cur.title}</h2>
      <div className="space-y-5">
        {cur.fields.map((f) => (
          <FormField key={f.name} field={f} value={data[f.name]} onChange={(v) => setField(f.name, v)} />
        ))}
      </div>
      <div className="flex justify-between mt-8">
        {section > 0 ? (
          <button onClick={() => setSection((s) => s - 1)} className="rounded-md border border-border px-4 py-2 text-sm">Voltar</button>
        ) : <span />}
        <button onClick={next} className="rounded-md bg-primary text-primary-foreground px-5 py-2 text-sm font-semibold hover:bg-primary/90">
          {isLast ? "Enviar" : "Próxima seção"}
        </button>
      </div>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  const branding = useBranding();
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <img src={branding.logo} alt="FITFLOW" className="mx-auto h-16 w-16 object-contain" />
        </div>
        <div className="rounded-lg border border-border bg-card p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}

type Field =
  | { name: string; label: string; hint?: string; type: "text" | "number" | "date" | "textarea" | "email"; required?: boolean }
  | { name: string; label: string; hint?: string; type: "select" | "radio"; options: string[]; required?: boolean };

function FormField({ field, value, onChange }: { field: Field; value: any; onChange: (v: any) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{field.label}{field.required && <span className="text-primary"> *</span>}</label>
      {field.hint && <p className="text-xs text-muted-foreground mb-2">{field.hint}</p>}
      {field.type === "textarea" ? (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3}
          className="w-full bg-background border border-input rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
      ) : field.type === "select" ? (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-background border border-input rounded p-2.5 text-sm">
          <option value="">Selecione...</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === "radio" ? (
        <div className="space-y-2">
          {field.options.map((o) => (
            <label key={o} className="flex items-start gap-2 cursor-pointer text-sm">
              <input type="radio" name={field.name} checked={value === o} onChange={() => onChange(o)} className="mt-1 accent-[var(--primary)]" />
              <span>{o}</span>
            </label>
          ))}
        </div>
      ) : (
        <input type={field.type} value={value ?? ""} onChange={(e) => onChange(field.type === "number" ? (e.target.value ? Number(e.target.value) : "") : e.target.value)}
          className="w-full bg-background border border-input rounded p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
      )}
    </div>
  );
}

const SECTIONS: Record<Tipo, { title: string; fields: Field[] }[]> = {
  anamnese: [
    { title: "Identificação", fields: [
      { name: "nome", label: "Nome completo", type: "text", required: true },
      { name: "nascimento", label: "Data de nascimento", type: "date", required: true },
      { name: "sexo", label: "Sexo", type: "select", options: ["masculino","feminino"], required: true },
      { name: "cidade_estado", label: "Cidade e estado", type: "text" },
      { name: "profissao", label: "Profissão", type: "text" },
    ]},
    { title: "Dados Físicos", fields: [
      { name: "peso", label: "Peso atual (kg)", type: "number", required: true },
      { name: "altura", label: "Altura (cm)", type: "number", required: true },
      { name: "gordura", label: "Percentual de gordura (se souber)", type: "number" },
      { name: "abdominal", label: "Circunferência abdominal (cm)", type: "number" },
    ]},
    { title: "Objetivo", fields: [
      { name: "objetivo", label: "Objetivo principal", type: "select", options: ["hipertrofia","definição","recomposição","saúde e qualidade de vida"], required: true },
      { name: "prazo", label: "Prazo desejado", type: "text" },
      { name: "consultoria_anterior", label: "Já fez consultoria antes?", type: "select", options: ["sim","não"] },
      { name: "consultoria_detalhe", label: "Se sim, o que funcionou e o que não funcionou", type: "textarea" },
    ]},
    { title: "Treino", fields: [
      { name: "experiencia", label: "Nível de experiência", type: "select", options: ["iniciante","intermediário","avançado"] },
      { name: "frequencia", label: "Frequência por semana", type: "select", options: ["0","1","2","3","4","5","6","7"] },
      { name: "tipo_treino", label: "Tipo de treino", type: "select", options: ["musculação","funcional","crossfit","cardio","sem treino","outro"] },
      { name: "horario", label: "Horário preferido", type: "select", options: ["manhã","tarde","noite","variado"] },
      { name: "limitacao", label: "Limitação física ou lesão", type: "textarea" },
    ]},
    { title: "Alimentação", fields: [
      { name: "refeicoes", label: "Refeições por dia", type: "select", options: ["1","2","3","4","5","6+"] },
      { name: "dieta_atual", label: "Faz dieta atualmente?", type: "select", options: ["sim","não"] },
      { name: "dieta_qual", label: "Se sim, qual?", type: "text" },
      { name: "restricoes", label: "Restrições ou alergias", type: "textarea" },
      { name: "nao_come", label: "Alimentos que não come por preferência", type: "textarea" },
      { name: "alcool", label: "Bebida alcoólica", type: "select", options: ["não","eventualmente","fins de semana","frequentemente"] },
      { name: "agua", label: "Água por dia", type: "select", options: ["menos de 1L","1 a 2L","2 a 3L","mais de 3L"] },
    ]},
    { title: "Saúde", fields: [
      { name: "condicao", label: "Condição de saúde diagnosticada", type: "textarea" },
      { name: "medicamento", label: "Medicamento contínuo", type: "textarea" },
      { name: "sono", label: "Qualidade e horas de sono", type: "text" },
      { name: "estresse", label: "Nível de estresse", type: "select", options: ["baixo","moderado","alto","muito alto"] },
    ]},
    { title: "Expectativas", fields: [
      { name: "espera", label: "O que espera da consultoria", type: "textarea", required: true },
      { name: "como_soube", label: "Como ficou sabendo", type: "select", options: ["Instagram","indicação","Google","outro"] },
    ]},
  ],
  feedback_quinzenal: [
    { title: "Identificação", fields: [
      { name: "email", label: "Endereço de e-mail", type: "email", required: true },
      { name: "nome", label: "Nome", type: "text", required: true },
      { name: "peso", label: "Peso atual (kg)", type: "number", required: true },
      { name: "telefone", label: "Telefone com DDI e DDD", hint: "55 + DDD + número, sem espaços ou traços", type: "text", required: true },
    ]},
    { title: "Evolução e Percepção", fields: [
      { name: "evolucao", label: "Como tem se sentido em relação à evolução", hint: "Quando se olha no espelho, está satisfeito com o que vê?", type: "radio", options: RADIO_EVOL, required: true },
      { name: "comentarios_externos", label: "Alguém de fora comentou sobre aparência ou evolução", hint: "Às vezes uma frase de quem não entende de treino mostra o quanto sua transformação está visível.", type: "textarea" },
      { name: "foco", label: "Foco pessoal para as próximas 4 semanas", hint: "Quer reduzir gordura em alguma região, ganhar volume ou melhorar performance?", type: "textarea", required: true },
    ]},
    { title: "Treino", fields: [
      { name: "adesao_treino", label: "Adesão à rotina de treinos", type: "radio", options: RADIO_ADESAO, required: true },
      { name: "dificuldade_treino", label: "Dificuldade em algum exercício ou parte do treino", hint: "Se algo está pegando, conta aqui que ajustamos.", type: "textarea" },
      { name: "sentimento_treino", label: "Como está se sentindo com o treino no geral", hint: "O que está funcionando bem? O que pode melhorar?", type: "textarea" },
    ]},
    { title: "Dieta, Hábitos e Espaço Livre", fields: [
      { name: "adesao_dieta", label: "Adesão à dieta na prática", type: "radio", options: RADIO_DIETA, required: true },
      { name: "fds", label: "Finais de semana", hint: "A rotina mudou muito em relação aos dias de semana?", type: "radio", options: RADIO_FDS },
      { name: "sentimento_dieta", label: "Como está se sentindo com a dieta no geral", type: "textarea" },
      { name: "sono", label: "Sono", hint: "Tem dormido bem? Acorda descansado?", type: "radio", options: RADIO_SONO, required: true },
      { name: "agua", label: "Água", type: "radio", options: RADIO_AGUA, required: true },
      { name: "intestino", label: "Intestino", hint: "Tem ido ao banheiro todos os dias, sem dificuldade?", type: "radio", options: RADIO_INTESTINO, required: true },
      { name: "espaco_livre", label: "Espaço livre", hint: "Se algo te incomodou, ou quer compartilhar uma conquista, escreve aqui.", type: "textarea" },
    ]},
  ],
  feedback_mensal: [],
  check_shape: [
    { title: "Identificação", fields: [
      { name: "nome", label: "Nome completo", type: "text", required: true },
      { name: "peso", label: "Peso atual (kg)", type: "number", required: true },
      { name: "telefone", label: "Telefone com DDI e DDD", type: "text", required: true },
    ]},
    { title: "Evolução e Percepção", fields: [
      { name: "evolucao", label: "Como tem se sentido em relação à evolução", type: "radio", options: RADIO_EVOL, required: true },
      { name: "comentarios_externos", label: "Alguém de fora comentou sobre aparência ou evolução", type: "textarea" },
      { name: "foco", label: "Foco pessoal para as próximas 4 semanas", type: "textarea", required: true },
    ]},
    { title: "Treino", fields: [
      { name: "adesao_treino", label: "Adesão à rotina de treinos", type: "radio", options: RADIO_ADESAO, required: true },
      { name: "dificuldade_treino", label: "Dificuldade em algum exercício ou parte do treino", type: "textarea" },
      { name: "sentimento_treino", label: "Como está se sentindo com o treino no geral", type: "textarea" },
    ]},
    { title: "Dieta", fields: [
      { name: "adesao_dieta", label: "Adesão à dieta na prática", type: "radio", options: RADIO_DIETA, required: true },
      { name: "dificuldades", label: "3 maiores dificuldades dos últimos dias", hint: "Falta de tempo, vontade de besteira... pode mandar real.", type: "textarea" },
      { name: "novos_habitos", label: "Conseguiu incluir algum novo hábito ou alimento", type: "textarea" },
      { name: "manter", label: "Algo que funcionou bem e gostaria de manter", type: "textarea" },
      { name: "ajustar", label: "Algo que não funcionou e gostaria de ajustar", type: "textarea" },
      { name: "fds", label: "Finais de semana", type: "radio", options: RADIO_FDS },
      { name: "sentimento_dieta", label: "Como está se sentindo com a dieta no geral", type: "textarea" },
    ]},
    { title: "Hábitos e Espaço Livre", fields: [
      { name: "sono", label: "Sono", type: "radio", options: RADIO_SONO, required: true },
      { name: "agua", label: "Água", type: "radio", options: RADIO_AGUA, required: true },
      { name: "intestino", label: "Intestino", type: "radio", options: RADIO_INTESTINO, required: true },
      { name: "espaco_livre", label: "Espaço livre", type: "textarea" },
    ]},
  ],
};