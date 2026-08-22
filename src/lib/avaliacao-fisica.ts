import { supabase } from "@/integrations/supabase/client";

export type AssessmentType = "inicial" | "reavaliacao";
export type ProtocoloDobras =
  | "jackson_pollock_7"
  | "jackson_pollock_3"
  | "faulkner_4"
  | "guedes_3";

export const PROTOCOLO_LABEL: Record<ProtocoloDobras, string> = {
  jackson_pollock_7: "Jackson & Pollock 7 dobras",
  jackson_pollock_3: "Jackson & Pollock 3 dobras",
  faulkner_4: "Faulkner 4 dobras",
  guedes_3: "Guedes 3 dobras",
};

export interface PhysicalAssessment {
  id: string;
  student_id: string;
  evaluator_id: string | null;
  evaluator_name: string | null;
  assessment_type: AssessmentType;
  assessment_date: string;
  height: number | null;
  weight: number | null;
  bmi: number | null;
  body_fat_percentage: number | null;
  lean_mass_percentage: number | null;
  fat_mass_kg: number | null;
  lean_mass_kg: number | null;
  skinfold_sum: number | null;
  waist_hip_ratio: number | null;
  arm_muscle_area: number | null;
  arm_fat_area: number | null;
  protocolo_dobras: ProtocoloDobras | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BodyCircumferences {
  id?: string;
  assessment_id?: string;
  shoulder: number | null;
  waist: number | null;
  abdomen: number | null;
  hip: number | null;
  right_thigh: number | null;
  left_thigh: number | null;
  right_calf: number | null;
  left_calf: number | null;
  relaxed_right_arm: number | null;
  relaxed_left_arm: number | null;
  contracted_right_arm: number | null;
  contracted_left_arm: number | null;
}

export interface SkinfoldMeasurements {
  id?: string;
  assessment_id?: string;
  biceps: number | null;
  triceps: number | null;
  subscapular: number | null;
  suprailiac: number | null;
  abdominal: number | null;
  midaxillary: number | null;
  chest: number | null;
  thigh: number | null;
  medial_calf: number | null;
}

export interface AssessmentFull {
  assessment: PhysicalAssessment;
  circumferences: BodyCircumferences | null;
  skinfolds: SkinfoldMeasurements | null;
}

/* ============================================================
 * Cálculos
 * ============================================================ */

export function calcularIMC(pesoKg: number | null, alturaM: number | null): number | null {
  if (!pesoKg || !alturaM || alturaM <= 0) return null;
  return Number((pesoKg / (alturaM * alturaM)).toFixed(2));
}

export function calcularRCQ(cintura: number | null, quadril: number | null): number | null {
  if (!cintura || !quadril || quadril <= 0) return null;
  return Number((cintura / quadril).toFixed(2));
}

/** Idade em anos a partir de data ISO. */
function calcIdade(nascISO: string | null | undefined, refDate: string): number | null {
  if (!nascISO) return null;
  const n = new Date(nascISO);
  const r = new Date(refDate);
  if (isNaN(n.getTime()) || isNaN(r.getTime())) return null;
  let age = r.getFullYear() - n.getFullYear();
  const passou = r.getMonth() > n.getMonth() || (r.getMonth() === n.getMonth() && r.getDate() >= n.getDate());
  if (!passou) age -= 1;
  return age > 0 && age < 130 ? age : null;
}

/** Densidade -> % gordura via Siri */
function siri(densidade: number): number {
  return ((4.95 / densidade) - 4.5) * 100;
}

export interface ContextoCalculo {
  sexo: "M" | "F" | null;
  dataNascimento: string | null;
  dataAvaliacao: string;
}

export interface ResultadoComposicao {
  somaDobras: number | null;
  bodyFatPct: number | null;
  leanMassPct: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
  protocoloUsado: ProtocoloDobras | null;
  faltando: string[]; // dobras faltando para o protocolo
}

/** Calcula composição corporal a partir das dobras + protocolo. */
export function calcularComposicao(
  protocolo: ProtocoloDobras | null,
  dobras: SkinfoldMeasurements | null,
  pesoKg: number | null,
  ctx: ContextoCalculo,
): ResultadoComposicao {
  const out: ResultadoComposicao = {
    somaDobras: null,
    bodyFatPct: null,
    leanMassPct: null,
    fatMassKg: null,
    leanMassKg: null,
    protocoloUsado: protocolo,
    faltando: [],
  };
  if (!protocolo || !dobras) return out;

  const idade = calcIdade(ctx.dataNascimento, ctx.dataAvaliacao);
  const sexo = ctx.sexo;

  const v = (n: number | null, label: string): number | null => {
    if (n == null || isNaN(n)) { out.faltando.push(label); return null; }
    return n;
  };

  if (protocolo === "faulkner_4") {
    const tr = v(dobras.triceps, "Tríceps");
    const sb = v(dobras.subscapular, "Subescapular");
    const si = v(dobras.suprailiac, "Suprailíaca");
    const ab = v(dobras.abdominal, "Abdominal");
    if (tr == null || sb == null || si == null || ab == null) return out;
    const soma = tr + sb + si + ab;
    out.somaDobras = soma;
    out.bodyFatPct = Number((soma * 0.153 + 5.783).toFixed(2));
  } else if (protocolo === "jackson_pollock_3") {
    if (sexo === "M") {
      const ch = v(dobras.chest, "Tórax");
      const ab = v(dobras.abdominal, "Abdominal");
      const co = v(dobras.thigh, "Coxa");
      if (ch == null || ab == null || co == null) return out;
      const soma = ch + ab + co;
      out.somaDobras = soma;
      if (!idade) { out.faltando.push("Data de nascimento"); return out; }
      const dens = 1.10938 - 0.0008267 * soma + 0.0000016 * soma * soma - 0.0002574 * idade;
      out.bodyFatPct = Number(siri(dens).toFixed(2));
    } else if (sexo === "F") {
      const tr = v(dobras.triceps, "Tríceps");
      const si = v(dobras.suprailiac, "Suprailíaca");
      const co = v(dobras.thigh, "Coxa");
      if (tr == null || si == null || co == null) return out;
      const soma = tr + si + co;
      out.somaDobras = soma;
      if (!idade) { out.faltando.push("Data de nascimento"); return out; }
      const dens = 1.0994921 - 0.0009929 * soma + 0.0000023 * soma * soma - 0.0001392 * idade;
      out.bodyFatPct = Number(siri(dens).toFixed(2));
    } else {
      out.faltando.push("Sexo");
    }
  } else if (protocolo === "jackson_pollock_7") {
    const ch = v(dobras.chest, "Tórax");
    const ax = v(dobras.midaxillary, "Axilar média");
    const tr = v(dobras.triceps, "Tríceps");
    const sb = v(dobras.subscapular, "Subescapular");
    const ab = v(dobras.abdominal, "Abdominal");
    const si = v(dobras.suprailiac, "Suprailíaca");
    const co = v(dobras.thigh, "Coxa");
    if ([ch, ax, tr, sb, ab, si, co].some((x) => x == null)) return out;
    const soma = (ch! + ax! + tr! + sb! + ab! + si! + co!);
    out.somaDobras = soma;
    if (!sexo) { out.faltando.push("Sexo"); return out; }
    if (!idade) { out.faltando.push("Data de nascimento"); return out; }
    let dens: number;
    if (sexo === "M") {
      dens = 1.112 - 0.00043499 * soma + 0.00000055 * soma * soma - 0.00028826 * idade;
    } else {
      dens = 1.097 - 0.00046971 * soma + 0.00000056 * soma * soma - 0.00012828 * idade;
    }
    out.bodyFatPct = Number(siri(dens).toFixed(2));
  } else if (protocolo === "guedes_3") {
    if (sexo === "M") {
      const tr = v(dobras.triceps, "Tríceps");
      const ab = v(dobras.abdominal, "Abdominal");
      const si = v(dobras.suprailiac, "Suprailíaca");
      if (tr == null || ab == null || si == null) return out;
      const soma = tr + ab + si;
      out.somaDobras = soma;
      const dens = 1.17136 - 0.06706 * Math.log10(soma);
      out.bodyFatPct = Number(siri(dens).toFixed(2));
    } else if (sexo === "F") {
      const sb = v(dobras.subscapular, "Subescapular");
      const si = v(dobras.suprailiac, "Suprailíaca");
      const co = v(dobras.thigh, "Coxa");
      if (sb == null || si == null || co == null) return out;
      const soma = sb + si + co;
      out.somaDobras = soma;
      const dens = 1.1665 - 0.0706 * Math.log10(soma);
      out.bodyFatPct = Number(siri(dens).toFixed(2));
    } else {
      out.faltando.push("Sexo");
    }
  }

  if (out.bodyFatPct != null) {
    out.leanMassPct = Number((100 - out.bodyFatPct).toFixed(2));
    if (pesoKg) {
      out.fatMassKg = Number(((pesoKg * out.bodyFatPct) / 100).toFixed(2));
      out.leanMassKg = Number((pesoKg - out.fatMassKg).toFixed(2));
    }
  }

  return out;
}

/** Área muscular e área de gordura do braço (Heymsfield/Frisancho).
 *  - circ_braco_relaxado em cm; tríceps em mm.
 */
export function calcularAreasBraco(
  circRelaxadaCm: number | null,
  tricepsMm: number | null,
): { armMuscleArea: number | null; armFatArea: number | null } {
  if (!circRelaxadaCm || !tricepsMm) {
    return { armMuscleArea: null, armFatArea: null };
  }
  const trCm = tricepsMm / 10;
  const armArea = (circRelaxadaCm * circRelaxadaCm) / (4 * Math.PI);
  const muscleCirc = circRelaxadaCm - Math.PI * trCm;
  const muscleArea = (muscleCirc * muscleCirc) / (4 * Math.PI);
  const fatArea = armArea - muscleArea;
  return {
    armMuscleArea: Number(muscleArea.toFixed(2)),
    armFatArea: Number(Math.max(fatArea, 0).toFixed(2)),
  };
}

/* ============================================================
 * Persistência
 * ============================================================ */

export async function listAssessmentsByStudent(studentId: string): Promise<PhysicalAssessment[]> {
  const { data, error } = await supabase
    .from("physical_assessments")
    .select("*")
    .eq("student_id", studentId)
    .order("assessment_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PhysicalAssessment[];
}

export async function listAllAssessments(): Promise<PhysicalAssessment[]> {
  const { data, error } = await supabase
    .from("physical_assessments")
    .select("*")
    .order("assessment_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PhysicalAssessment[];
}

export async function getAssessmentFull(id: string): Promise<AssessmentFull | null> {
  const { data: a, error: e1 } = await supabase
    .from("physical_assessments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (e1) throw e1;
  if (!a) return null;
  const [{ data: c }, { data: s }] = await Promise.all([
    supabase.from("body_circumferences").select("*").eq("assessment_id", id).maybeSingle(),
    supabase.from("skinfold_measurements").select("*").eq("assessment_id", id).maybeSingle(),
  ]);
  return {
    assessment: a as PhysicalAssessment,
    circumferences: (c as BodyCircumferences) ?? null,
    skinfolds: (s as SkinfoldMeasurements) ?? null,
  };
}

export interface SaveAssessmentInput {
  id?: string;
  student_id: string;
  evaluator_id: string | null;
  evaluator_name: string | null;
  assessment_type: AssessmentType;
  assessment_date: string;
  height: number | null;
  weight: number | null;
  protocolo_dobras: ProtocoloDobras | null;
  notes: string | null;
  circumferences: BodyCircumferences;
  skinfolds: SkinfoldMeasurements;
  // Calculados
  bmi: number | null;
  body_fat_percentage: number | null;
  lean_mass_percentage: number | null;
  fat_mass_kg: number | null;
  lean_mass_kg: number | null;
  skinfold_sum: number | null;
  waist_hip_ratio: number | null;
  arm_muscle_area: number | null;
  arm_fat_area: number | null;
}

export async function saveAssessment(input: SaveAssessmentInput): Promise<string> {
  const base = {
    student_id: input.student_id,
    evaluator_id: input.evaluator_id,
    evaluator_name: input.evaluator_name,
    assessment_type: input.assessment_type,
    assessment_date: input.assessment_date,
    height: input.height,
    weight: input.weight,
    bmi: input.bmi,
    body_fat_percentage: input.body_fat_percentage,
    lean_mass_percentage: input.lean_mass_percentage,
    fat_mass_kg: input.fat_mass_kg,
    lean_mass_kg: input.lean_mass_kg,
    skinfold_sum: input.skinfold_sum,
    waist_hip_ratio: input.waist_hip_ratio,
    arm_muscle_area: input.arm_muscle_area,
    arm_fat_area: input.arm_fat_area,
    protocolo_dobras: input.protocolo_dobras,
    notes: input.notes,
  };

  let assessmentId: string;
  if (input.id) {
    const { error } = await supabase.from("physical_assessments").update(base).eq("id", input.id);
    if (error) throw error;
    assessmentId = input.id;
  } else {
    const { data, error } = await supabase
      .from("physical_assessments")
      .insert(base)
      .select("id")
      .single();
    if (error) throw error;
    assessmentId = data.id;
  }

  // Upsert circumferences
  const cPayload = { ...input.circumferences, assessment_id: assessmentId };
  delete (cPayload as { id?: string }).id;
  const { error: ec } = await supabase
    .from("body_circumferences")
    .upsert(cPayload, { onConflict: "assessment_id" });
  if (ec) throw ec;

  const sPayload = { ...input.skinfolds, assessment_id: assessmentId };
  delete (sPayload as { id?: string }).id;
  const { error: es } = await supabase
    .from("skinfold_measurements")
    .upsert(sPayload, { onConflict: "assessment_id" });
  if (es) throw es;

  return assessmentId;
}

export async function deleteAssessment(id: string): Promise<void> {
  await supabase.from("body_circumferences").delete().eq("assessment_id", id);
  await supabase.from("skinfold_measurements").delete().eq("assessment_id", id);
  const { error } = await supabase.from("physical_assessments").delete().eq("id", id);
  if (error) throw error;
}

export function fmt(n: number | null | undefined, suffix = ""): string {
  if (n == null || isNaN(Number(n))) return "—";
  const v = Number(n);
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}${suffix ? " " + suffix : ""}`;
}

export function diffBadge(prev: number | null, curr: number | null, melhorEhMenor = true): {
  label: string;
  tone: "good" | "warn" | "bad" | "neutral";
} {
  if (prev == null || curr == null) return { label: "—", tone: "neutral" };
  const d = curr - prev;
  if (Math.abs(d) < 0.001) return { label: "0", tone: "neutral" };
  const sinal = d > 0 ? "+" : "";
  const txt = `${sinal}${d.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
  const melhor = melhorEhMenor ? d < 0 : d > 0;
  const piorou = melhorEhMenor ? d > 0 : d < 0;
  if (melhor) return { label: txt, tone: "good" };
  if (piorou) return { label: txt, tone: Math.abs(d) > Math.abs(prev) * 0.05 ? "bad" : "warn" };
  return { label: txt, tone: "neutral" };
}