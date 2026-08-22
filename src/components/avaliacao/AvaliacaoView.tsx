import { useEffect, useState } from "react";
import {
  type AssessmentFull, type PhysicalAssessment,
  PROTOCOLO_LABEL, fmt, listAssessmentsByStudent, deleteAssessment,
  calcularComposicao,
} from "@/lib/avaliacao-fisica";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Copy, FileDown, MessageCircle, Sparkles, Loader2, Trash2, Camera, Upload, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { gerarFeedbackAvaliacao } from "@/server/avaliacao-fisica.functions";
import { gerarAvaliacaoShape } from "@/server/avaliacao-shape.functions";
import { uploadAnamneseAsset } from "@/lib/anamnese-upload";
import { toast } from "sonner";
import { exportarAvaliacaoPdf } from "@/lib/avaliacao-pdf";
import { EvolucaoChart } from "@/components/aluno/EvolucaoChart";

interface Props {
  full: AssessmentFull;
  onChanged?: () => void;
}

interface Aluno {
  id: string; nome: string; whatsapp: string | null;
  sexo: string | null; data_nascimento: string | null;
}

export function AvaliacaoView({ full }: Props) {
  const nav = useNavigate();
  const { assessment: assessmentRaw, circumferences, skinfolds } = full;
  const [assessment, setAssessment] = useState<PhysicalAssessment>(assessmentRaw);
  const [aluno, setAluno] = useState<Aluno | null>(null);
  const [anterior, setAnterior] = useState<PhysicalAssessment | null>(null);
  const [historico, setHistorico] = useState<PhysicalAssessment[]>([]);
  const [feedback, setFeedback] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [openWa, setOpenWa] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const gerar = useServerFn(gerarFeedbackAvaliacao);
  const gerarShape = useServerFn(gerarAvaliacaoShape);
  const [openShape, setOpenShape] = useState(false);

  useEffect(() => {
    supabase.from("alunos").select("id,nome,whatsapp,sexo,data_nascimento")
      .eq("id", assessment.student_id).maybeSingle()
      .then(({ data }) => setAluno(data as Aluno | null));
    listAssessmentsByStudent(assessment.student_id).then((all) => {
      setHistorico(all);
      const prev = all.find((a) => a.id !== assessment.id
        && new Date(a.assessment_date) <= new Date(assessment.assessment_date));
      setAnterior(prev ?? null);
    });
  }, [assessment.student_id, assessment.id, assessment.assessment_date]);

  // Auto-recálculo: se temos dobras + protocolo + sexo + nascimento mas o
  // body_fat_percentage está nulo (ou divergiu), recalcula e regrava.
  useEffect(() => {
    if (!aluno || !skinfolds || !assessment.protocolo_dobras) return;
    const ctxSexo: "M" | "F" | null = aluno.sexo
      ? (aluno.sexo.toLowerCase().startsWith("m") ? "M" : "F")
      : null;
    const comp = calcularComposicao(
      assessment.protocolo_dobras as any,
      skinfolds,
      assessment.weight ?? null,
      { sexo: ctxSexo, dataNascimento: aluno.data_nascimento, dataAvaliacao: assessment.assessment_date },
    );
    if (comp.bodyFatPct == null) return;
    const atual = assessment.body_fat_percentage;
    if (atual != null && Math.abs(Number(atual) - comp.bodyFatPct) < 0.05) return;
    void supabase.from("physical_assessments").update({
      body_fat_percentage: comp.bodyFatPct,
      lean_mass_percentage: comp.leanMassPct,
      fat_mass_kg: comp.fatMassKg,
      lean_mass_kg: comp.leanMassKg,
      skinfold_sum: comp.somaDobras,
    }).eq("id", assessment.id).then(({ error }) => {
      if (error) { toast.error("Erro ao atualizar % gordura: " + error.message); return; }
      setAssessment((a) => ({
        ...a,
        body_fat_percentage: comp.bodyFatPct,
        lean_mass_percentage: comp.leanMassPct,
        fat_mass_kg: comp.fatMassKg,
        lean_mass_kg: comp.leanMassKg,
        skinfold_sum: comp.somaDobras,
      }));
      toast.success("% gordura recalculada");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aluno?.id, aluno?.sexo, aluno?.data_nascimento, skinfolds, assessment.id, assessment.protocolo_dobras]);

  async function handleDuplicar() {
    const { data, error } = await supabase.from("physical_assessments").insert({
      student_id: assessment.student_id,
      assessment_type: "reavaliacao",
      assessment_date: new Date().toISOString().slice(0, 10),
      height: assessment.height,
      weight: assessment.weight,
      protocolo_dobras: assessment.protocolo_dobras,
      evaluator_name: assessment.evaluator_name,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    if (circumferences) {
      const c = { ...circumferences } as Partial<typeof circumferences> & { id?: string; assessment_id?: string };
      delete c.id;
      await supabase.from("body_circumferences").insert({ ...c, assessment_id: data.id });
    }
    if (skinfolds) {
      const s = { ...skinfolds } as Partial<typeof skinfolds> & { id?: string; assessment_id?: string };
      delete s.id;
      await supabase.from("skinfold_measurements").insert({ ...s, assessment_id: data.id });
    }
    toast.success("Reavaliação criada");
    nav({ to: "/avaliacao-fisica/$id/editar", params: { id: data.id } });
  }

  async function handleGerarFeedback() {
    if (!aluno) return;
    setLoadingAi(true);
    try {
      const res = await gerar({
        data: {
          alunoNome: aluno.nome,
          tipoAvaliacao: assessment.assessment_type as "inicial" | "reavaliacao",
          observacoes: assessment.notes,
          dadosAtual: {
            peso: assessment.weight, bf: assessment.body_fat_percentage,
            massaMagra: assessment.lean_mass_kg, cintura: circumferences?.waist ?? null,
            abdomen: circumferences?.abdomen ?? null, quadril: circumferences?.hip ?? null,
            somaDobras: assessment.skinfold_sum, imc: assessment.bmi,
          },
          dadosAnterior: anterior ? {
            peso: anterior.weight, bf: anterior.body_fat_percentage,
            massaMagra: anterior.lean_mass_kg, cintura: null, abdomen: null, quadril: null,
            somaDobras: anterior.skinfold_sum, imc: anterior.bmi,
          } : null,
        },
      });
      if (!res.ok) { toast.error(res.error); return; }
      setFeedback(res.mensagem);
      toast.success("Feedback gerado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar");
    } finally {
      setLoadingAi(false);
    }
  }

  function handlePdf() {
    if (!aluno) return;
    exportarAvaliacaoPdf({ full, aluno, anterior });
  }

  async function handleExcluir() {
    setDeleting(true);
    try {
      await deleteAssessment(assessment.id);
      toast.success("Avaliação excluída");
      nav({ to: "/avaliacao-fisica" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
      setDeleting(false);
    }
  }

  function buildWaMessage(): string {
    const nome = (aluno?.nome ?? "").trim().split(/\s+/)[0] ?? "";
    return `Fala, ${nome}. Tua avaliação física foi atualizada no sistema. Já deixei o resumo com os principais dados e direcionamentos para o próximo ciclo. Dá uma olhada com calma e segue o plano conforme ajustado.\n\n` +
      `Peso: ${fmt(assessment.weight, "kg")}\n` +
      `IMC: ${fmt(assessment.bmi)}\n` +
      `% Gordura: ${fmt(assessment.body_fat_percentage, "%")}\n` +
      `Massa magra: ${fmt(assessment.lean_mass_kg, "kg")}\n` +
      `Cintura: ${fmt(circumferences?.waist, "cm")}`;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {assessment.assessment_type === "inicial" ? "1ª Avaliação Física" : "Reavaliação"}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{aluno?.nome ?? "—"}</h1>
          <div className="text-sm text-muted-foreground">
            {new Date(assessment.assessment_date).toLocaleDateString("pt-BR")} • Avaliador: {assessment.evaluator_name ?? "—"}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn icon={<Pencil className="h-4 w-4" />} onClick={() => nav({ to: "/avaliacao-fisica/$id/editar", params: { id: assessment.id } })}>Editar</Btn>
          <Btn icon={<Copy className="h-4 w-4" />} onClick={handleDuplicar}>Duplicar</Btn>
          <Btn icon={<FileDown className="h-4 w-4" />} onClick={handlePdf}>PDF</Btn>
          <Btn icon={<MessageCircle className="h-4 w-4" />} onClick={() => setOpenWa(true)} variant="primary">WhatsApp</Btn>
          <Btn icon={<Camera className="h-4 w-4" />} onClick={() => setOpenShape(true)} variant="primary">Avaliação de Shape</Btn>
          <Btn icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDel(true)} variant="danger">Excluir</Btn>
        </div>
      </div>

      {/* Indicadores principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Kpi label="Peso" value={fmt(assessment.weight, "kg")} />
        <Kpi label="Altura" value={fmt(assessment.height, "m")} />
        <Kpi label="IMC" value={fmt(assessment.bmi)} />
        <Kpi label="% Gordura" value={fmt(assessment.body_fat_percentage, "%")} />
        <Kpi label="Massa magra" value={fmt(assessment.lean_mass_kg, "kg")} />
        <Kpi label="Massa gorda" value={fmt(assessment.fat_mass_kg, "kg")} />
      </div>

      <EvolucaoChart list={historico} />

      {/* Tabelas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Circunferências (cm)">
          <Tabela rows={[
            ["Ombro", circumferences?.shoulder],
            ["Cintura", circumferences?.waist],
            ["Abdômen", circumferences?.abdomen],
            ["Quadril", circumferences?.hip],
            ["Coxa D", circumferences?.right_thigh],
            ["Coxa E", circumferences?.left_thigh],
            ["Panturrilha D", circumferences?.right_calf],
            ["Panturrilha E", circumferences?.left_calf],
            ["Braço relax. D", circumferences?.relaxed_right_arm],
            ["Braço relax. E", circumferences?.relaxed_left_arm],
            ["Braço contr. D", circumferences?.contracted_right_arm],
            ["Braço contr. E", circumferences?.contracted_left_arm],
          ]} suffix="cm" />
        </Card>
        <Card title={`Dobras cutâneas (mm) — ${assessment.protocolo_dobras ? PROTOCOLO_LABEL[assessment.protocolo_dobras] : "sem protocolo"}`}>
          <Tabela rows={[
            ["Bíceps", skinfolds?.biceps],
            ["Tríceps", skinfolds?.triceps],
            ["Subescapular", skinfolds?.subscapular],
            ["Suprailíaca", skinfolds?.suprailiac],
            ["Abdominal", skinfolds?.abdominal],
            ["Axilar média", skinfolds?.midaxillary],
            ["Tórax", skinfolds?.chest],
            ["Coxa", skinfolds?.thigh],
            ["Panturrilha medial", skinfolds?.medial_calf],
          ]} suffix="mm" />
          <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
            <span>Soma de dobras</span>
            <span className="font-semibold text-foreground tabular-nums">{fmt(assessment.skinfold_sum, "mm")}</span>
          </div>
        </Card>
      </div>

      {/* Resultados extras */}
      <Card title="Resultados calculados">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniKpi label="RCQ" value={fmt(assessment.waist_hip_ratio)} />
          <MiniKpi label="Área muscular braço" value={fmt(assessment.arm_muscle_area, "cm²")} />
          <MiniKpi label="Área gordura braço" value={fmt(assessment.arm_fat_area, "cm²")} />
          <MiniKpi label="% Massa magra" value={fmt(assessment.lean_mass_percentage, "%")} />
        </div>
      </Card>

      {assessment.notes && (
        <Card title="Observações do avaliador">
          <p className="text-sm text-foreground whitespace-pre-wrap">{assessment.notes}</p>
        </Card>
      )}

      {/* Feedback IA */}
      <Card title="Feedback para o aluno">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs text-muted-foreground">Gera um texto curto no tom Manu Paes com base nos números desta avaliação.</p>
          <button
            onClick={handleGerarFeedback} disabled={loadingAi}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
          >
            {loadingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {loadingAi ? "Gerando..." : "Gerar feedback"}
          </button>
        </div>
        {feedback ? (
          <div className="rounded-md bg-muted/40 border border-border p-3 text-sm whitespace-pre-wrap text-foreground">
            {feedback}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground italic">Nenhum feedback gerado ainda.</div>
        )}
      </Card>

      {openWa && aluno && (
        <WhatsAppModal aluno={aluno} mensagem={buildWaMessage()} onClose={() => setOpenWa(false)} />
      )}

      {openShape && aluno && (
        <AvaliacaoShapeModal
          aluno={aluno}
          onClose={() => setOpenShape(false)}
          onGerar={(urls, observacoes) =>
            gerarShape({ data: { alunoId: aluno.id, imagensUrls: urls, observacoes } })
          }
        />
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => !deleting && setConfirmDel(false)}>
          <div className="w-full max-w-sm rounded-lg bg-card border border-border p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-2">Excluir avaliação?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Esta ação não pode ser desfeita. Os dados de circunferências e dobras desta avaliação também serão removidos.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(false)} disabled={deleting}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleExcluir} disabled={deleting}
                className="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50">
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Btn({ children, icon, onClick, variant = "default" }: {
  children: React.ReactNode; icon?: React.ReactNode; onClick: () => void; variant?: "default" | "primary" | "danger";
}) {
  const cls = variant === "primary"
    ? "bg-primary text-primary-foreground hover:bg-primary/90"
    : variant === "danger"
    ? "border border-destructive/30 text-destructive bg-background hover:bg-destructive/10"
    : "border border-input bg-background hover:bg-muted";
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${cls}`}>
      {icon}{children}
    </button>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</div>
      <div className="text-base font-semibold text-foreground tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</div>
      <div className="text-sm font-semibold text-foreground tabular-nums">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Tabela({ rows, suffix }: { rows: [string, number | null | undefined][]; suffix: string }) {
  return (
    <div className="divide-y divide-border">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between py-1.5 text-sm">
          <span className="text-muted-foreground">{k}</span>
          <span className="font-medium text-foreground tabular-nums">{fmt(v ?? null, suffix)}</span>
        </div>
      ))}
    </div>
  );
}

function WhatsAppModal({ aluno, mensagem, onClose }: { aluno: Aluno; mensagem: string; onClose: () => void }) {
  const [msg, setMsg] = useState(mensagem);
  const phone = (aluno.whatsapp ?? "").replace(/\D/g, "");
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-card border border-border p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-3">Enviar pelo WhatsApp</h3>
        <div className="text-xs text-muted-foreground mb-3">Para: {aluno.whatsapp ?? "(sem número)"}</div>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={8}
          className="w-full rounded-md border border-input bg-background p-2 text-sm" />
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted">Cancelar</button>
          <a href={url} target="_blank" rel="noreferrer"
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Abrir WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

function AvaliacaoShapeModal({
  aluno,
  onClose,
  onGerar,
}: {
  aluno: Aluno;
  onClose: () => void;
  onGerar: (urls: string[], observacoes?: string) => Promise<{ mensagem: string | null; error: string | null }>;
}) {
  const [files, setFiles] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<string>("");

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        const r = await uploadAnamneseAsset({
          pathPrefix: `avaliacao-shape/${aluno.id}`,
          file,
        });
        if (r.error || !r.url) {
          toast.error(r.error || "Falha no upload");
        } else {
          setFiles((prev) => [...prev, { url: r.url!, name: file.name }]);
        }
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleGerar() {
    if (files.length === 0) { toast.error("Envie pelo menos uma foto"); return; }
    setLoading(true);
    try {
      const r = await onGerar(files.map((f) => f.url), observacoes.trim() || undefined);
      if (!r.mensagem) { toast.error(r.error || "Erro ao gerar"); return; }
      setResultado(r.mensagem);
      toast.success("Avaliação de shape gerada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar");
    } finally {
      setLoading(false);
    }
  }

  function copiar() {
    navigator.clipboard.writeText(resultado);
    toast.success("Copiado");
  }

  const phone = (aluno.whatsapp ?? "").replace(/\D/g, "");
  const waUrl = resultado && phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(resultado)}`
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-card border border-border p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Avaliação de Shape — {aluno.nome}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Envie fotos de frente, lado e costas. A IA analisa shape, proporção e postura no padrão Manu Paes.
        </p>

        <label className="flex items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted/30 px-3 py-6 text-sm cursor-pointer hover:bg-muted/50">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Enviando..." : "Selecionar fotos"}
          <input type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
        </label>

        {files.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {files.map((f, i) => (
              <div key={i} className="relative group rounded-md overflow-hidden border border-border bg-muted/30">
                <img src={f.url} alt={f.name} className="w-full h-24 object-cover" />
                <button
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1 opacity-0 group-hover:opacity-100 transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Observações da equipe (opcional)"
          rows={3}
          className="w-full mt-3 rounded-md border border-input bg-background p-2 text-sm"
        />

        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-muted">Fechar</button>
          <button
            onClick={handleGerar}
            disabled={loading || uploading || files.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {loading ? "Gerando..." : "Gerar avaliação"}
          </button>
        </div>

        {resultado && (
          <div className="mt-4">
            <div className="rounded-md bg-muted/40 border border-border p-3 text-sm whitespace-pre-wrap text-foreground max-h-[40vh] overflow-y-auto">
              {resultado}
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={copiar} className="rounded-md border border-input bg-background px-3 py-1.5 text-xs hover:bg-muted">Copiar</button>
              {waUrl && (
                <a href={waUrl} target="_blank" rel="noreferrer"
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                  Abrir WhatsApp
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}