import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { NUTRICIONISTA } from "./dieta-pdf/modelo";
import { registrarFonteRoboto } from "./dieta-pdf/fontes";
import logoMP from "@/assets/logo-mp.png";
import type {
  PhysicalAssessment,
  BodyCircumferences,
  SkinfoldMeasurements,
} from "@/lib/avaliacao-fisica";

export interface ComparativoColuna {
  a: PhysicalAssessment;
  c: BodyCircumferences | null;
  s: SkinfoldMeasurements | null;
}

interface Aluno { id: string; nome: string }

interface Args {
  aluno: Aluno;
  colunas: ComparativoColuna[]; // ordem cronológica asc
  print?: boolean;
}

type Suffix = "kg" | "%" | "mm" | "cm" | "" | "m";

interface Metric {
  label: string;
  get: (r: ComparativoColuna) => number | null;
  suffix: Suffix;
  decimals?: number;
  /** true = redução é positiva (verde), false = aumento é positivo */
  melhorMenor?: boolean;
}

// ===================== Paleta =====================
const RED: [number, number, number] = [237, 28, 36];
const RED_SOFT_BG: [number, number, number] = [253, 240, 240];
const TEXT: [number, number, number] = [38, 38, 42];
const SUB: [number, number, number] = [115, 115, 120];
const DIVIDER: [number, number, number] = [228, 228, 232];
const GREEN: [number, number, number] = [22, 150, 70];
const ORANGE: [number, number, number] = [220, 90, 35];
const ROW_ALT: [number, number, number] = [249, 250, 251];

const MARGIN = 12;
const HEADER_H = 22;
const FOOTER_RESERVE = 14; // espaço fixo do rodapé

// ===================== Métricas =====================
const PERIMETRIAS: Metric[] = [
  { label: "Ombro", get: (r) => r.c?.shoulder ?? null, suffix: "cm", melhorMenor: false },
  { label: "Cintura", get: (r) => r.c?.waist ?? null, suffix: "cm", melhorMenor: true },
  { label: "Abdômen", get: (r) => r.c?.abdomen ?? null, suffix: "cm", melhorMenor: true },
  { label: "Quadril", get: (r) => r.c?.hip ?? null, suffix: "cm", melhorMenor: true },
  { label: "Braço", get: (r) => mediaPar(r.c?.relaxed_right_arm, r.c?.relaxed_left_arm), suffix: "cm", melhorMenor: false },
  { label: "Coxa", get: (r) => mediaPar(r.c?.right_thigh, r.c?.left_thigh), suffix: "cm" },
  { label: "Panturrilha", get: (r) => mediaPar(r.c?.right_calf, r.c?.left_calf), suffix: "cm" },
];

const DOBRAS: Metric[] = [
  { label: "Tricipital", get: (r) => r.s?.triceps ?? null, suffix: "mm", melhorMenor: true },
  { label: "Bíceps", get: (r) => r.s?.biceps ?? null, suffix: "mm", melhorMenor: true },
  { label: "Subescapular", get: (r) => r.s?.subscapular ?? null, suffix: "mm", melhorMenor: true },
  { label: "Suprailíaca", get: (r) => r.s?.suprailiac ?? null, suffix: "mm", melhorMenor: true },
  { label: "Abdominal", get: (r) => r.s?.abdominal ?? null, suffix: "mm", melhorMenor: true },
  { label: "Axilar média", get: (r) => r.s?.midaxillary ?? null, suffix: "mm", melhorMenor: true },
  { label: "Coxa", get: (r) => r.s?.thigh ?? null, suffix: "mm", melhorMenor: true },
  { label: "Panturrilha medial", get: (r) => r.s?.medial_calf ?? null, suffix: "mm", melhorMenor: true },
];

function mediaPar(a?: number | null, b?: number | null): number | null {
  const va = a ?? null, vb = b ?? null;
  if (va == null && vb == null) return null;
  if (va != null && vb != null) return (va + vb) / 2;
  return (va ?? vb) as number;
}

// ===================== Helpers =====================
function fmtVal(v: number | null, suffix: Suffix, decimals?: number): string {
  if (v == null || isNaN(Number(v))) return "—";
  const d = decimals ?? 2;
  const s = Number(v).toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
  return suffix ? `${s} ${suffix}` : s;
}

function fmtDelta(d: number, suffix: Suffix): string {
  const sign = d > 0 ? "+" : "";
  const num = `${sign}${d.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return suffix ? `${num}${suffix === "%" ? "%" : " " + suffix}` : num;
}

function brDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function brDateFile(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

// ===================== Header / Footer =====================
function desenharHeader(doc: jsPDF, pageW: number) {
  doc.setFillColor(...RED);
  doc.rect(0, 0, pageW, HEADER_H, "F");

  // Logo à esquerda
  try { doc.addImage(logoMP, "PNG", MARGIN, 3, 16, 16); } catch { /* */ }

  // bloco direito: nome em destaque + dados em uma linha enxuta
  const rightX = pageW - MARGIN;
  doc.setTextColor(255, 255, 255);
  doc.setFont("Roboto", "bold");
  doc.setFontSize(10.5);
  doc.text(NUTRICIONISTA.nome, rightX, 8, { align: "right" });
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.5);
  doc.text(`${NUTRICIONISTA.titulo}  •  CRN: ${NUTRICIONISTA.crn}  •  ${NUTRICIONISTA.telefone}`, rightX, 13, { align: "right" });
  doc.text(`${NUTRICIONISTA.email}  •  ${NUTRICIONISTA.site}`, rightX, 17.5, { align: "right" });
}

function desenharRodape(doc: jsPDF, pageW: number, pageH: number, num: number, total: number) {
  doc.setDrawColor(...DIVIDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, pageH - 9, pageW - MARGIN, pageH - 9);

  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...SUB);
  doc.text("Relatório técnico", MARGIN, pageH - 4.5);
  doc.setFont("Roboto", "bold");
  doc.setTextColor(...RED);
  doc.text(" • MPTEAM", MARGIN + 19, pageH - 4.5);

  // Centro: assinatura compacta
  doc.setFont("Roboto", "normal");
  doc.setTextColor(...SUB);
  doc.text(
    `${NUTRICIONISTA.nome} • Responsável técnico • CRN: ${NUTRICIONISTA.crn}`,
    pageW / 2,
    pageH - 4.5,
    { align: "center" },
  );

  // Direita: paginação
  doc.text(`Página ${num} de ${total}`, pageW - MARGIN, pageH - 4.5, { align: "right" });
}

// ===================== Cards =====================
function desenharCard(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  titulo: string,
  inicio: string, fim: string,
  delta: string | null,
  positivo: boolean | null,
) {
  // borda + topo vermelho como acento
  doc.setDrawColor(...DIVIDER);
  doc.setLineWidth(0.3);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  doc.setFillColor(...RED);
  doc.rect(x, y, w, 1.4, "F");

  // título
  doc.setFont("Roboto", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...SUB);
  const tit = titulo.toUpperCase();
  // se ainda assim couber ruim, encurta
  doc.text(tit, x + w / 2, y + 5.5, { align: "center", maxWidth: w - 2 });

  // valores inicial → final (uma linha discreta)
  doc.setFont("Roboto", "normal");
  doc.setFontSize(7.2);
  doc.setTextColor(...TEXT);
  const linhaIniFim = `${inicio}  →  ${fim}`;
  doc.text(linhaIniFim, x + w / 2, y + 11, { align: "center", maxWidth: w - 2 });

  // separador fino
  doc.setDrawColor(...DIVIDER);
  doc.setLineWidth(0.2);
  doc.line(x + 3, y + 13.5, x + w - 3, y + 13.5);

  // delta (destaque)
  const cor: [number, number, number] = positivo === false ? ORANGE : positivo === true ? GREEN : SUB;
  doc.setFont("Roboto", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...cor);
  doc.text(delta ?? "—", x + w / 2, y + 19.5, { align: "center", maxWidth: w - 2 });
}

// ===================== Análise =====================
function gerarAnalise(colunas: ComparativoColuna[]): string {
  const ini = colunas[0];
  const fim = colunas[colunas.length - 1];
  const peso0 = ini.a.weight, pesoF = fim.a.weight;
  const mg0 = ini.a.fat_mass_kg, mgF = fim.a.fat_mass_kg;
  const mm0 = ini.a.lean_mass_kg, mmF = fim.a.lean_mass_kg;
  const sd0 = ini.a.skinfold_sum, sdF = fim.a.skinfold_sum;

  const partes: string[] = [];
  const nome = "O avaliado";

  if (peso0 != null && pesoF != null) {
    const dp = pesoF - peso0;
    if (Math.abs(dp) < 0.05) {
      partes.push(`${nome} manteve o peso corporal estável no período (${fmtVal(peso0, "kg")}).`);
    } else {
      const verbo = dp < 0 ? "redução" : "aumento";
      partes.push(
        `${nome} apresentou ${verbo} do peso corporal no período total, saindo de ${fmtVal(peso0, "kg")} para ${fmtVal(pesoF, "kg")}.`,
      );
    }
  }

  const extras: string[] = [];
  if (mg0 != null && mgF != null && mgF < mg0 - 0.05) extras.push("redução importante da massa gorda");
  if (sd0 != null && sdF != null && sdF < sd0 - 0.5) extras.push("redução expressiva da soma de dobras");
  if (mm0 != null && mmF != null && mmF > mm0 + 0.05) extras.push("aumento de massa magra");

  if (extras.length) {
    partes.push(`Além da ${peso0 != null && pesoF != null && pesoF < peso0 ? "queda no peso" : "evolução do peso"}, houve ${extras.join(", ")}.`);
    partes.push(
      `O resultado indica boa resposta ao estímulo de treino e nutrição, com melhora clara da composição corporal.`,
    );
    partes.push(
      `A próxima fase deve manter o foco na preservação da massa magra, controle da gordura corporal e continuidade da evolução nas perimetrias e dobras cutâneas.`,
    );
  } else if (partes.length === 0) {
    return "Período avaliado registrado com sucesso. Continue acompanhando as métricas nas próximas avaliações para uma análise mais robusta da evolução.";
  }
  return partes.join(" ");
}

// ===================== Main =====================
export async function exportarComparativoPdf({ aluno, colunas, print }: Args): Promise<void> {
  if (colunas.length < 2) return;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registrarFonteRoboto(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;

  desenharHeader(doc, pageW);
  let y = HEADER_H + 6;

  // ===== Título =====
  doc.setFont("Roboto", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(...RED);
  doc.text("COMPARATIVO ANTROPOMÉTRICO", MARGIN, y);
  y += 5.2;

  doc.setFont("Roboto", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...TEXT);
  doc.text(aluno.nome, MARGIN, y);

  const dataIni = brDate(colunas[0].a.assessment_date);
  const dataFim = brDate(colunas[colunas.length - 1].a.assessment_date);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SUB);
  doc.text(`Período analisado: ${dataIni} a ${dataFim}`, pageW - MARGIN, y, { align: "right" });
  y += 5;

  // linha divisória sutil
  doc.setDrawColor(...DIVIDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 4;

  // ===== CARDS DE DESTAQUE =====
  const ini = colunas[0];
  const fim = colunas[colunas.length - 1];
  const cards: { titulo: string; suffix: Suffix; v0: number | null; vF: number | null; melhorMenor: boolean | null; decimals?: number }[] = [
    { titulo: "Altura", suffix: "m", v0: ini.a.height, vF: fim.a.height, melhorMenor: null, decimals: 2 },
    { titulo: "Peso", suffix: "kg", v0: ini.a.weight, vF: fim.a.weight, melhorMenor: true },
    { titulo: "Massa Gorda", suffix: "kg", v0: ini.a.fat_mass_kg, vF: fim.a.fat_mass_kg, melhorMenor: true },
    { titulo: "% M. Gorda", suffix: "%", v0: ini.a.body_fat_percentage, vF: fim.a.body_fat_percentage, melhorMenor: true },
    { titulo: "Massa Magra", suffix: "kg", v0: ini.a.lean_mass_kg, vF: fim.a.lean_mass_kg, melhorMenor: false },
    { titulo: "% M. Magra", suffix: "%", v0: ini.a.lean_mass_percentage, vF: fim.a.lean_mass_percentage, melhorMenor: false },
    { titulo: "Soma Dobras", suffix: "mm", v0: ini.a.skinfold_sum, vF: fim.a.skinfold_sum, melhorMenor: true },
  ];
  const gap = 2.2;
  const cardW = (contentW - gap * 6) / 7;
  const cardH = 23;
  cards.forEach((c, i) => {
    const x = MARGIN + i * (cardW + gap);
    const v0s = fmtVal(c.v0, c.suffix, c.decimals);
    const vFs = fmtVal(c.vF, c.suffix, c.decimals);
    let delta: string | null = null;
    let positivo: boolean | null = null;
    if (c.v0 != null && c.vF != null) {
      const d = c.vF - c.v0;
      if (Math.abs(d) >= 0.005) {
        delta = fmtDelta(d, c.suffix);
        positivo = c.melhorMenor == null ? null : c.melhorMenor ? d < 0 : d > 0;
      } else {
        delta = "—";
      }
    }
    desenharCard(doc, x, y, cardW, cardH, c.titulo, v0s, vFs, delta, positivo);
  });
  y += cardH + 5;

  // ===== TABELAS POR SEÇÃO =====
  function tituloSecao(label: string) {
    doc.setFont("Roboto", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...RED);
    doc.text(label.toUpperCase(), MARGIN, y);
    // pequena barra sob o título
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, y + 1.2, MARGIN + 28, y + 1.2);
    y += 3.5;
  }

  function blocoSecao(
    metricas: Metric[],
    primeiraColLabel: string,
    somaFinal?: { label: string; suffix: Suffix; getter: (c: ComparativoColuna) => number | null },
  ) {
    const visiveis = metricas.filter((m) => colunas.some((c) => m.get(c) != null));
    if (visiveis.length === 0) return;

    const headers = [
      primeiraColLabel.toUpperCase(),
      ...colunas.map((c) => brDate(c.a.assessment_date)),
      "EVOLUÇÃO",
    ];

    type Cell = string | { content: string; styles?: Record<string, unknown> };
    const body: Cell[][] = visiveis.map((m) => {
      const row: Cell[] = [m.label];
      colunas.forEach((c) => row.push(fmtVal(m.get(c), m.suffix, m.decimals)));
      const v0 = m.get(colunas[0]);
      const vF = m.get(colunas[colunas.length - 1]);
      if (v0 != null && vF != null) {
        const d = vF - v0;
        if (Math.abs(d) < 0.005) row.push("—");
        else row.push(fmtDelta(d, m.suffix));
      } else row.push("—");
      return row;
    });

    if (somaFinal) {
      const soma: Cell[] = [
        { content: somaFinal.label, styles: { fontStyle: "bold" } },
      ];
      colunas.forEach((c) =>
        soma.push({ content: fmtVal(somaFinal.getter(c), somaFinal.suffix), styles: { fontStyle: "bold" } }),
      );
      const v0 = somaFinal.getter(colunas[0]);
      const vF = somaFinal.getter(colunas[colunas.length - 1]);
      if (v0 != null && vF != null) {
        const d = vF - v0;
        if (Math.abs(d) < 0.005) soma.push({ content: "—", styles: { fontStyle: "bold" } });
        else soma.push({ content: fmtDelta(d, somaFinal.suffix), styles: { fontStyle: "bold", textColor: d < 0 ? GREEN : ORANGE } });
      } else soma.push({ content: "—", styles: { fontStyle: "bold" } });
      body.push(soma);
    }

    autoTable(doc, {
      startY: y,
      head: [headers],
      body,
      styles: { font: "Roboto", fontSize: 8.5, cellPadding: 1.7, textColor: TEXT, lineColor: DIVIDER, lineWidth: 0.1 },
      headStyles: {
        fillColor: RED,
        textColor: [255, 255, 255],
        halign: "center",
        fontStyle: "bold",
        fontSize: 8.5,
        cellPadding: 2,
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 50, textColor: TEXT, fontStyle: "bold" },
      },
      bodyStyles: { halign: "center" },
      alternateRowStyles: { fillColor: ROW_ALT },
      theme: "plain",
      margin: { left: MARGIN, right: MARGIN, bottom: FOOTER_RESERVE + 4 },
      rowPageBreak: "avoid",
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 0) {
          data.cell.styles.halign = "left";
        }
        if (data.section === "body" && data.column.index === headers.length - 1 && data.row.index < visiveis.length) {
          const m = visiveis[data.row.index];
          const v0 = m.get(colunas[0]);
          const vF = m.get(colunas[colunas.length - 1]);
          if (v0 != null && vF != null) {
            const d = vF - v0;
            if (Math.abs(d) >= 0.005 && m.melhorMenor !== undefined) {
              const bom = m.melhorMenor ? d < 0 : d > 0;
              data.cell.styles.textColor = bom ? GREEN : ORANGE;
              data.cell.styles.fontStyle = "bold";
            } else if (Math.abs(d) < 0.005) {
              data.cell.styles.textColor = SUB;
            }
          }
        }
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }

  // ===== Renderização das seções =====
  // Calcular altura aproximada da análise pra reservar espaço
  const analise = gerarAnalise(colunas);
  const linhasAnalise = doc.splitTextToSize(analise, contentW - 8);
  const blocoAnaliseH = 8 + linhasAnalise.length * 3.6 + 4;

  tituloSecao("Comparação das Perimetrias");
  blocoSecao(PERIMETRIAS, "Perimetria");

  // Antes de desenhar Dobras, ver se cabe (título + ~9 linhas + análise) na página atual
  const alturaDobras = 4 + (DOBRAS.length + 1) * 5.8 + 6;
  const espacoNecessario = alturaDobras + blocoAnaliseH + 4;
  const espacoDisponivel = pageH - FOOTER_RESERVE - y;
  if (espacoNecessario > espacoDisponivel) {
    doc.addPage();
    desenharHeader(doc, pageW);
    y = HEADER_H + 6;
  }

  tituloSecao("Comparação das Dobras");
  blocoSecao(DOBRAS, "Dobra", { label: "Soma de dobras", suffix: "mm", getter: (c) => c.a.skinfold_sum });

  // ===== ANÁLISE DO PERÍODO =====
  if (y + blocoAnaliseH > pageH - FOOTER_RESERVE) {
    doc.addPage();
    desenharHeader(doc, pageW);
    y = HEADER_H + 6;
  }

  doc.setFillColor(...RED_SOFT_BG);
  doc.setDrawColor(...RED_SOFT_BG);
  doc.roundedRect(MARGIN, y, contentW, blocoAnaliseH, 2.5, 2.5, "FD");

  // barra vertical vermelha à esquerda como acento
  doc.setFillColor(...RED);
  doc.rect(MARGIN, y, 1.4, blocoAnaliseH, "F");

  doc.setFont("Roboto", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...RED);
  doc.text("ANÁLISE DO PERÍODO", MARGIN + 5, y + 5);

  doc.setFont("Roboto", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXT);
  doc.text(linhasAnalise, MARGIN + 5, y + 9.5, { lineHeightFactor: 1.35 });

  // ===== Rodapé em todas as páginas =====
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    desenharRodape(doc, pageW, pageH, i, total);
  }

  // ===== Salvar =====
  const slug = aluno.nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const dMin = brDateFile(colunas[0].a.assessment_date);
  const dMax = brDateFile(colunas[colunas.length - 1].a.assessment_date);

  if (print) {
    doc.autoPrint();
    const blobUrl = doc.output("bloburl");
    window.open(blobUrl as unknown as string, "_blank");
  } else {
    doc.save(`comparativo-antropometrico-${slug}-${dMin}-a-${dMax}.pdf`);
  }
}
