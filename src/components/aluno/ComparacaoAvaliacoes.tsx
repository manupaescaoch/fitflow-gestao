import { useEffect, useMemo, useState } from "react";
import { GitCompare, FileDown, Printer, Scale, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  type PhysicalAssessment,
  type BodyCircumferences,
  type SkinfoldMeasurements,
} from "@/lib/avaliacao-fisica";
import { exportarComparativoPdf } from "@/lib/avaliacao-comparativo-pdf";
import { toast } from "sonner";

interface FullRow {
  a: PhysicalAssessment;
  c: BodyCircumferences | null;
  s: SkinfoldMeasurements | null;
}

type Suffix = "kg" | "%" | "mm" | "cm" | "" | "m";

interface MetricDef {
  label: string;
  get: (r: FullRow) => number | null;
  suffix: Suffix;
  melhorMenor?: boolean; // tom de cor: queda é "boa"
  decimals?: number;
}

const COMPOSICAO: MetricDef[] = [
  { label: "Altura", get: (r) => r.a.height, suffix: "m", decimals: 2 },
  { label: "Peso", get: (r) => r.a.weight, suffix: "kg", melhorMenor: true },
  { label: "IMC", get: (r) => r.a.bmi, suffix: "", melhorMenor: true },
  { label: "Massa Gorda", get: (r) => r.a.fat_mass_kg, suffix: "kg", melhorMenor: true },
  { label: "% Massa Gorda", get: (r) => r.a.body_fat_percentage, suffix: "%", melhorMenor: true },
  { label: "Massa Magra", get: (r) => r.a.lean_mass_kg, suffix: "kg", melhorMenor: false },
  { label: "% Massa Magra", get: (r) => r.a.lean_mass_percentage, suffix: "%", melhorMenor: false },
  { label: "Razão cintura/quadril", get: (r) => r.a.waist_hip_ratio, suffix: "", melhorMenor: true },
  { label: "Soma de dobras", get: (r) => r.a.skinfold_sum, suffix: "mm", melhorMenor: true },
  { label: "Área Muscular Braço (AMB)", get: (r) => r.a.arm_muscle_area, suffix: "", melhorMenor: false },
  { label: "Área Gordura Braço (AGB)", get: (r) => r.a.arm_fat_area, suffix: "", melhorMenor: true },
];

const CIRCUNFERENCIAS: MetricDef[] = [
  { label: "Ombro", get: (r) => r.c?.shoulder ?? null, suffix: "cm", melhorMenor: false },
  { label: "Cintura", get: (r) => r.c?.waist ?? null, suffix: "cm", melhorMenor: true },
  { label: "Abdômen", get: (r) => r.c?.abdomen ?? null, suffix: "cm", melhorMenor: true },
  { label: "Quadril", get: (r) => r.c?.hip ?? null, suffix: "cm", melhorMenor: true },
  { label: "Coxa direita", get: (r) => r.c?.right_thigh ?? null, suffix: "cm" },
  { label: "Coxa esquerda", get: (r) => r.c?.left_thigh ?? null, suffix: "cm" },
  { label: "Panturrilha direita", get: (r) => r.c?.right_calf ?? null, suffix: "cm" },
  { label: "Panturrilha esquerda", get: (r) => r.c?.left_calf ?? null, suffix: "cm" },
  { label: "Braço relax. dir.", get: (r) => r.c?.relaxed_right_arm ?? null, suffix: "cm", melhorMenor: false },
  { label: "Braço relax. esq.", get: (r) => r.c?.relaxed_left_arm ?? null, suffix: "cm", melhorMenor: false },
  { label: "Braço contr. dir.", get: (r) => r.c?.contracted_right_arm ?? null, suffix: "cm", melhorMenor: false },
  { label: "Braço contr. esq.", get: (r) => r.c?.contracted_left_arm ?? null, suffix: "cm", melhorMenor: false },
];

const DOBRAS: MetricDef[] = [
  { label: "Bíceps", get: (r) => r.s?.biceps ?? null, suffix: "mm", melhorMenor: true },
  { label: "Tríceps", get: (r) => r.s?.triceps ?? null, suffix: "mm", melhorMenor: true },
  { label: "Subescapular", get: (r) => r.s?.subscapular ?? null, suffix: "mm", melhorMenor: true },
  { label: "Suprailíaca", get: (r) => r.s?.suprailiac ?? null, suffix: "mm", melhorMenor: true },
  { label: "Abdominal", get: (r) => r.s?.abdominal ?? null, suffix: "mm", melhorMenor: true },
  { label: "Axilar média", get: (r) => r.s?.midaxillary ?? null, suffix: "mm", melhorMenor: true },
  { label: "Tórax", get: (r) => r.s?.chest ?? null, suffix: "mm", melhorMenor: true },
  { label: "Coxa", get: (r) => r.s?.thigh ?? null, suffix: "mm", melhorMenor: true },
  { label: "Panturrilha medial", get: (r) => r.s?.medial_calf ?? null, suffix: "mm", melhorMenor: true },
];

export function ComparacaoAvaliacoes({
  list,
  aluno,
}: {
  list: PhysicalAssessment[];
  aluno: { id: string; nome: string } | null;
}) {
  const [aberto, setAberto] = useState(false);
  // Por padrão seleciona as 2 mais recentes (a lista vem em ordem desc)
  const [selecionadas, setSelecionadas] = useState<string[]>(() => {
    if (list.length >= 2) return [list[1].id, list[0].id];
    return list.slice(0, 1).map((r) => r.id);
  });
  const [full, setFull] = useState<Map<string, FullRow>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const faltando = selecionadas.filter((id) => !full.has(id));
    if (faltando.length === 0) return;
    let cancel = false;
    setLoading(true);
    (async () => {
      const novos = new Map(full);
      for (const id of faltando) {
        const base = list.find((r) => r.id === id);
        if (!base) continue;
        const [{ data: c }, { data: s }] = await Promise.all([
          supabase.from("body_circumferences").select("*").eq("assessment_id", id).maybeSingle(),
          supabase.from("skinfold_measurements").select("*").eq("assessment_id", id).maybeSingle(),
        ]);
        novos.set(id, {
          a: base,
          c: (c as BodyCircumferences) ?? null,
          s: (s as SkinfoldMeasurements) ?? null,
        });
      }
      if (!cancel) {
        setFull(novos);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [aberto, selecionadas, list, full]);

  // Avaliações ordenadas por data ascendente para apresentação em colunas
  const colunas = useMemo(() => {
    return selecionadas
      .map((id) => list.find((r) => r.id === id))
      .filter((r): r is PhysicalAssessment => Boolean(r))
      .sort((a, b) => +new Date(a.assessment_date) - +new Date(b.assessment_date))
      .map((r) => full.get(r.id) ?? { a: r, c: null, s: null });
  }, [selecionadas, list, full]);

  function toggle(id: string) {
    setSelecionadas((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev; // máx 4 colunas
      return [...prev, id];
    });
  }

  if (list.length < 2) return null;

  async function gerarPdf(print: boolean) {
    if (!aluno) { toast.error("Aluno não carregado"); return; }
    if (colunas.length < 2) { toast.error("Selecione ao menos 2 avaliações"); return; }
    try {
      await exportarComparativoPdf({ aluno, colunas, print });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar PDF");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-3 p-4">
        <button
          onClick={() => setAberto((v) => !v)}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <GitCompare className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold">Modo comparação</span>
          <span className="text-xs text-muted-foreground hidden sm:inline truncate">
            — compare até 4 avaliações lado a lado
          </span>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              if (!aberto) setAberto(true);
              if (colunas.length < 2) {
                toast.error("Selecione ao menos 2 avaliações para comparar");
                return;
              }
              gerarPdf(false);
            }}
            disabled={!aluno}
            title={
              colunas.length < 2
                ? "Selecione ao menos 2 avaliações"
                : `Baixar PDF (${colunas.length} avaliações)`
            }
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <FileDown className="h-3.5 w-3.5" /> Baixar PDF
          </button>
          <button
            onClick={() => setAberto((v) => !v)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {aberto ? "Ocultar" : "Abrir"}
          </button>
        </div>
      </div>

      {aberto && (
        <div className="border-t border-border p-4 space-y-4">
          {/* Seleção em lista (estilo Dietbox) */}
          <div>
            <div className="text-sm text-muted-foreground mb-3">
              Selecione as antropometrias que você deseja comparar abaixo
              <span className="ml-2 text-[11px] text-muted-foreground/70">
                ({selecionadas.length}/4)
              </span>
            </div>
            <ul className="divide-y divide-border rounded-md border border-border overflow-hidden">
              {list.map((r, idx) => {
                const ativo = selecionadas.includes(r.id);
                const numero = list.length - idx; // mais recente primeiro = maior número
                const disabled = !ativo && selecionadas.length >= 4;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => toggle(r.id)}
                      disabled={disabled}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                        ativo ? "bg-primary/5" : "hover:bg-muted/40"
                      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      <span
                        className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                          ativo
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-input bg-background"
                        }`}
                      >
                        {ativo && <Check className="h-3 w-3" />}
                      </span>
                      <span className="h-7 w-7 rounded-full bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                        <Scale className="h-3.5 w-3.5" />
                      </span>
                      <span className="tabular-nums text-foreground shrink-0">
                        {new Date(r.assessment_date).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="text-muted-foreground flex-1 truncate">
                        — {numero}ª Avaliação Física
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {selecionadas.length < 2 ? (
            <div className="text-xs text-muted-foreground p-4 text-center border border-dashed rounded-md">
              Selecione ao menos 2 avaliações para comparar.
            </div>
          ) : loading && colunas.some((c) => c.c == null && c.s == null) ? (
            <div className="text-xs text-muted-foreground p-4 text-center">Carregando dados…</div>
          ) : (
            <div className="space-y-5">
              <Bloco titulo="Composição corporal" colunas={colunas} metricas={COMPOSICAO} />
              <Bloco titulo="Circunferências" colunas={colunas} metricas={CIRCUNFERENCIAS} />
              <Bloco titulo="Pregas cutâneas" colunas={colunas} metricas={DOBRAS} />

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => gerarPdf(false)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <FileDown className="h-3.5 w-3.5" /> Salvar em PDF
                </button>
                <button
                  onClick={() => gerarPdf(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <Printer className="h-3.5 w-3.5" /> Imprimir
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Bloco({
  titulo,
  colunas,
  metricas,
}: {
  titulo: string;
  colunas: FullRow[];
  metricas: MetricDef[];
}) {
  // Filtra métricas onde TODAS as colunas estão sem valor — evita poluir
  const visiveis = metricas.filter((m) => colunas.some((c) => m.get(c) != null));
  if (visiveis.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">{titulo}</h4>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground sticky left-0 bg-muted/40">Indicador</th>
              {colunas.map((c, i) => (
                <th key={c.a.id} className="text-right px-3 py-2 font-medium">
                  <div>{new Date(c.a.assessment_date).toLocaleDateString("pt-BR")}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">
                    {i === 0 ? "Base" : `${i + 1}ª`}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((m) => (
              <tr key={m.label} className="border-t border-border">
                <td className="px-3 py-2 text-foreground sticky left-0 bg-card">{m.label}</td>
                {colunas.map((c, i) => {
                  const v = m.get(c);
                  const prev = i === 0 ? null : m.get(colunas[i - 1]);
                  return (
                    <td key={c.a.id} className="px-3 py-2 text-right tabular-nums">
                      <div className="font-medium">{fmtMet(v, m.suffix, m.decimals)}</div>
                      {i > 0 && <Diff curr={v} prev={prev} melhorMenor={m.melhorMenor} suffix={m.suffix} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmtMet(v: number | null, suffix: Suffix, decimals?: number): string {
  if (v == null || isNaN(Number(v))) return "—";
  const n = Number(v);
  const d = decimals ?? (suffix === "" ? 2 : suffix === "%" ? 2 : 2);
  const s = n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  return suffix ? `${s} ${suffix}` : s;
}

function Diff({
  curr,
  prev,
  melhorMenor,
  suffix,
}: {
  curr: number | null;
  prev: number | null;
  melhorMenor?: boolean;
  suffix: Suffix;
}) {
  if (curr == null || prev == null) return null;
  const d = curr - prev;
  if (Math.abs(d) < 0.005) {
    return <div className="text-[10px] text-muted-foreground/60">—</div>;
  }
  const sinal = d > 0 ? "+" : "";
  const txt = `${sinal}${d.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix ? " " + suffix : ""}`;
  let cls = "text-muted-foreground";
  if (melhorMenor !== undefined) {
    const bom = melhorMenor ? d < 0 : d > 0;
    cls = bom ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
  }
  return <div className={`text-[10px] font-semibold ${cls}`}>{txt}</div>;
}
