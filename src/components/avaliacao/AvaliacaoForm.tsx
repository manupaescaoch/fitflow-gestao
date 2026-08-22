import { useEffect, useMemo, useState } from "react";
import { Save, Calculator, AlertCircle } from "lucide-react";
import {
  PROTOCOLO_LABEL,
  type ProtocoloDobras,
  type AssessmentType,
  type BodyCircumferences,
  type SkinfoldMeasurements,
  type AssessmentFull,
  calcularIMC, calcularRCQ, calcularComposicao, calcularAreasBraco,
  saveAssessment,
} from "@/lib/avaliacao-fisica";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Aluno {
  id: string;
  nome: string;
  sexo: string | null;
  data_nascimento: string | null;
  altura_cm: number | null;
  peso_kg: number | null;
}

interface Props {
  alunoId?: string;
  initial?: AssessmentFull | null;
  onSaved?: (id: string) => void;
  onCancel?: () => void;
}

const emptyCirc: BodyCircumferences = {
  shoulder: null, waist: null, abdomen: null, hip: null,
  right_thigh: null, left_thigh: null, right_calf: null, left_calf: null,
  relaxed_right_arm: null, relaxed_left_arm: null,
  contracted_right_arm: null, contracted_left_arm: null,
};

const emptySkin: SkinfoldMeasurements = {
  biceps: null, triceps: null, subscapular: null, suprailiac: null,
  abdominal: null, midaxillary: null, chest: null, thigh: null, medial_calf: null,
};

export function AvaliacaoForm({ alunoId, initial, onSaved, onCancel }: Props) {
  const { crmUser } = useAuth();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [studentId, setStudentId] = useState<string>(alunoId ?? initial?.assessment.student_id ?? "");
  const [date, setDate] = useState<string>(initial?.assessment.assessment_date ?? new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState<AssessmentType>(initial?.assessment.assessment_type ?? "inicial");
  const [evaluatorName, setEvaluatorName] = useState<string>(
    initial?.assessment.evaluator_name ?? crmUser?.nome ?? crmUser?.email ?? ""
  );
  const [protocolo, setProtocolo] = useState<ProtocoloDobras | null>(initial?.assessment.protocolo_dobras ?? "jackson_pollock_3");
  const [notes, setNotes] = useState<string>(initial?.assessment.notes ?? "");
  const [height, setHeight] = useState<number | null>(initial?.assessment.height ?? null);
  const [weight, setWeight] = useState<number | null>(initial?.assessment.weight ?? null);
  const [circ, setCirc] = useState<BodyCircumferences>(initial?.circumferences ?? emptyCirc);
  const [skin, setSkin] = useState<SkinfoldMeasurements>(initial?.skinfolds ?? emptySkin);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("alunos").select("id,nome,sexo,data_nascimento,altura_cm,peso_kg")
      .order("nome").then(({ data }) => setAlunos((data ?? []) as Aluno[]));
  }, []);

  // Detecta tipo automaticamente: se o aluno já tem avaliação, é reavaliação.
  useEffect(() => {
    if (initial || !studentId) return;
    let cancel = false;
    supabase
      .from("physical_assessments")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .then(({ count }) => {
        if (cancel) return;
        setTipo((count ?? 0) > 0 ? "reavaliacao" : "inicial");
      });
    return () => { cancel = true; };
  }, [studentId, initial]);

  const alunoAtual = useMemo(() => alunos.find((a) => a.id === studentId), [alunos, studentId]);

  // Pré-preenche altura/peso a partir do cadastro do aluno se vazios
  useEffect(() => {
    if (!initial && alunoAtual) {
      if (height == null && alunoAtual.altura_cm) setHeight(Number((alunoAtual.altura_cm / 100).toFixed(2)));
      if (weight == null && alunoAtual.peso_kg) setWeight(Number(alunoAtual.peso_kg));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alunoAtual]);

  const calc = useMemo(() => {
    const bmi = calcularIMC(weight, height);
    const rcq = calcularRCQ(circ.waist, circ.hip);
    const ctxSexo: "M" | "F" | null = alunoAtual?.sexo
      ? (alunoAtual.sexo.toLowerCase().startsWith("m") ? "M" : "F")
      : null;
    const comp = calcularComposicao(protocolo, skin, weight, {
      sexo: ctxSexo,
      dataNascimento: alunoAtual?.data_nascimento ?? null,
      dataAvaliacao: date,
    });
    const armR = (circ.relaxed_right_arm != null && circ.relaxed_left_arm != null)
      ? (circ.relaxed_right_arm + circ.relaxed_left_arm) / 2
      : (circ.relaxed_right_arm ?? circ.relaxed_left_arm);
    const areas = calcularAreasBraco(armR ?? null, skin.triceps);
    return { bmi, rcq, comp, areas };
  }, [weight, height, circ, skin, protocolo, alunoAtual, date]);

  async function handleSave() {
    if (!studentId) { toast.error("Selecione o aluno"); return; }
    if (!date) { toast.error("Informe a data"); return; }
    if (!height) { toast.error("Informe a altura"); return; }
    if (!weight) { toast.error("Informe o peso"); return; }

    setSaving(true);
    try {
      const id = await saveAssessment({
        id: initial?.assessment.id,
        student_id: studentId,
        evaluator_id: crmUser?.id ?? null,
        evaluator_name: evaluatorName || null,
        assessment_type: tipo,
        assessment_date: date,
        height,
        weight,
        protocolo_dobras: protocolo,
        notes: notes || null,
        circumferences: circ,
        skinfolds: skin,
        bmi: calc.bmi,
        body_fat_percentage: calc.comp.bodyFatPct,
        lean_mass_percentage: calc.comp.leanMassPct,
        fat_mass_kg: calc.comp.fatMassKg,
        lean_mass_kg: calc.comp.leanMassKg,
        skinfold_sum: calc.comp.somaDobras,
        waist_hip_ratio: calc.rcq,
        arm_muscle_area: calc.areas.armMuscleArea,
        arm_fat_area: calc.areas.armFatArea,
      });
      toast.success("Avaliação salva");
      onSaved?.(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Dados gerais">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Aluno *">
            <select
              value={studentId} onChange={(e) => setStudentId(e.target.value)}
              disabled={!!alunoId || !!initial}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione...</option>
              {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </Field>
          <Field label="Data da avaliação *">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </Field>
          <Field label="Tipo de avaliação">
            <div className="w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              {tipo === "inicial" ? "1ª avaliação física" : "Reavaliação"}
              <span className="ml-2 text-[10px] uppercase tracking-wider">automático</span>
            </div>
          </Field>
          <Field label="Avaliador responsável">
            <input value={evaluatorName} onChange={(e) => setEvaluatorName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </Field>
        </div>
        <Field label="Observações gerais" className="mt-4">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
      </Section>

      <Section title="Dados básicos">
        <div className="grid grid-cols-2 gap-4">
          <NumField label="Altura" suffix="m" value={height} onChange={setHeight} step={0.01} />
          <NumField label="Peso" suffix="kg" value={weight} onChange={setWeight} step={0.1} />
        </div>
      </Section>

      <Section title="Circunferências (cm)">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <NumField label="Ombro" suffix="cm" value={circ.shoulder} onChange={(v) => setCirc({ ...circ, shoulder: v })} />
          <NumField label="Cintura" suffix="cm" value={circ.waist} onChange={(v) => setCirc({ ...circ, waist: v })} />
          <NumField label="Abdômen" suffix="cm" value={circ.abdomen} onChange={(v) => setCirc({ ...circ, abdomen: v })} />
          <NumField label="Quadril" suffix="cm" value={circ.hip} onChange={(v) => setCirc({ ...circ, hip: v })} />
          <NumField label="Coxa direita" suffix="cm" value={circ.right_thigh} onChange={(v) => setCirc({ ...circ, right_thigh: v })} />
          <NumField label="Coxa esquerda" suffix="cm" value={circ.left_thigh} onChange={(v) => setCirc({ ...circ, left_thigh: v })} />
          <NumField label="Panturrilha direita" suffix="cm" value={circ.right_calf} onChange={(v) => setCirc({ ...circ, right_calf: v })} />
          <NumField label="Panturrilha esquerda" suffix="cm" value={circ.left_calf} onChange={(v) => setCirc({ ...circ, left_calf: v })} />
          <NumField label="Braço relax. dir." suffix="cm" value={circ.relaxed_right_arm} onChange={(v) => setCirc({ ...circ, relaxed_right_arm: v })} />
          <NumField label="Braço relax. esq." suffix="cm" value={circ.relaxed_left_arm} onChange={(v) => setCirc({ ...circ, relaxed_left_arm: v })} />
          <NumField label="Braço contr. dir." suffix="cm" value={circ.contracted_right_arm} onChange={(v) => setCirc({ ...circ, contracted_right_arm: v })} />
          <NumField label="Braço contr. esq." suffix="cm" value={circ.contracted_left_arm} onChange={(v) => setCirc({ ...circ, contracted_left_arm: v })} />
        </div>
      </Section>

      <Section title="Dobras cutâneas (mm)">
        <div className="mb-3">
          <Field label="Protocolo de cálculo">
            <select
              value={protocolo ?? ""}
              onChange={(e) => setProtocolo((e.target.value || null) as ProtocoloDobras | null)}
              className="w-full md:w-80 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Não calcular</option>
              {(Object.keys(PROTOCOLO_LABEL) as ProtocoloDobras[]).map((k) => (
                <option key={k} value={k}>{PROTOCOLO_LABEL[k]}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <NumField label="Bíceps" suffix="mm" value={skin.biceps} onChange={(v) => setSkin({ ...skin, biceps: v })} />
          <NumField label="Tríceps" suffix="mm" value={skin.triceps} onChange={(v) => setSkin({ ...skin, triceps: v })} />
          <NumField label="Subescapular" suffix="mm" value={skin.subscapular} onChange={(v) => setSkin({ ...skin, subscapular: v })} />
          <NumField label="Suprailíaca" suffix="mm" value={skin.suprailiac} onChange={(v) => setSkin({ ...skin, suprailiac: v })} />
          <NumField label="Abdominal" suffix="mm" value={skin.abdominal} onChange={(v) => setSkin({ ...skin, abdominal: v })} />
          <NumField label="Axilar média" suffix="mm" value={skin.midaxillary} onChange={(v) => setSkin({ ...skin, midaxillary: v })} />
          <NumField label="Tórax" suffix="mm" value={skin.chest} onChange={(v) => setSkin({ ...skin, chest: v })} />
          <NumField label="Coxa" suffix="mm" value={skin.thigh} onChange={(v) => setSkin({ ...skin, thigh: v })} />
          <NumField label="Panturrilha medial" suffix="mm" value={skin.medial_calf} onChange={(v) => setSkin({ ...skin, medial_calf: v })} />
        </div>
      </Section>

      <Section title="Resultados automáticos" icon={<Calculator className="h-4 w-4" />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Result label="IMC" value={calc.bmi} />
          <Result label="Soma de dobras" value={calc.comp.somaDobras} suffix="mm" />
          <Result label="% Gordura" value={calc.comp.bodyFatPct} suffix="%" />
          <Result label="% Massa magra" value={calc.comp.leanMassPct} suffix="%" />
          <Result label="Massa gorda" value={calc.comp.fatMassKg} suffix="kg" />
          <Result label="Massa magra" value={calc.comp.leanMassKg} suffix="kg" />
          <Result label="RCQ" value={calc.rcq} />
          <Result label="Área muscular braço" value={calc.areas.armMuscleArea} suffix="cm²" />
          <Result label="Área gordura braço" value={calc.areas.armFatArea} suffix="cm²" />
        </div>
        {calc.comp.faltando.length > 0 && (
          <div className="mt-3 flex items-start gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>Faltam para calcular % de gordura: {calc.comp.faltando.join(", ")}.</span>
          </div>
        )}
      </Section>

      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <button onClick={onCancel}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted">
            Cancelar
          </button>
        )}
        <button
          onClick={handleSave} disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar avaliação"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 md:p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        {icon}{title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs text-muted-foreground mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function NumField({
  label, suffix, value, onChange, step = 0.1,
}: { label: string; suffix?: string; value: number | null; onChange: (v: number | null) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground mb-1 block">{label}{suffix ? ` (${suffix})` : ""}</span>
      <input
        type="number" step={step} inputMode="decimal"
        value={value ?? ""} onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm tabular-nums"
      />
    </label>
  );
}

function Result({ label, value, suffix }: { label: string; value: number | null; suffix?: string }) {
  const has = value != null && !isNaN(Number(value));
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</div>
      <div className={`text-sm font-semibold tabular-nums ${has ? "text-foreground" : "text-muted-foreground/60 italic"}`}>
        {has ? `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix ? " " + suffix : ""}` : "não calculado"}
      </div>
    </div>
  );
}