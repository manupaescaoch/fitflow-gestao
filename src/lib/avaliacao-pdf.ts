import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  type AssessmentFull, type PhysicalAssessment,
  PROTOCOLO_LABEL, fmt,
} from "@/lib/avaliacao-fisica";

interface Aluno { id: string; nome: string; }

interface Args {
  full: AssessmentFull;
  aluno: Aluno;
  anterior: PhysicalAssessment | null;
}

export function exportarAvaliacaoPdf({ full, aluno, anterior }: Args) {
  const { assessment, circumferences, skinfolds } = full;
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // Cabeçalho
  doc.setFillColor(255, 13, 13);
  doc.rect(0, 0, 210, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("MPTEAM", 14, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Avaliação Física", 14, 19);

  // Dados do aluno
  let y = 32;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(aluno.nome, 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `${assessment.assessment_type === "inicial" ? "1ª avaliação física" : "Reavaliação"} • ${new Date(assessment.assessment_date).toLocaleDateString("pt-BR")} • Avaliador: ${assessment.evaluator_name ?? "—"}`,
    14, y,
  );
  y += 8;

  // KPIs principais
  doc.setTextColor(20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Resultados principais", 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Peso", fmt(assessment.weight, "kg")],
      ["Altura", fmt(assessment.height, "m")],
      ["IMC", fmt(assessment.bmi)],
      ["% Gordura", fmt(assessment.body_fat_percentage, "%")],
      ["% Massa magra", fmt(assessment.lean_mass_percentage, "%")],
      ["Massa gorda", fmt(assessment.fat_mass_kg, "kg")],
      ["Massa magra", fmt(assessment.lean_mass_kg, "kg")],
      ["Soma de dobras", fmt(assessment.skinfold_sum, "mm")],
      ["RCQ", fmt(assessment.waist_hip_ratio)],
      ["Protocolo de dobras", assessment.protocolo_dobras ? PROTOCOLO_LABEL[assessment.protocolo_dobras] : "—"],
    ],
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20, halign: "left" },
    columnStyles: { 1: { halign: "right" } },
    theme: "grid",
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Circunferências
  doc.setFont("helvetica", "bold");
  doc.text("Circunferências (cm)", 14, y);
  y += 2;
  autoTable(doc, {
    startY: y + 2,
    head: [["Medida", "cm"]],
    body: [
      ["Ombro", fmt(circumferences?.shoulder, "")],
      ["Cintura", fmt(circumferences?.waist, "")],
      ["Abdômen", fmt(circumferences?.abdomen, "")],
      ["Quadril", fmt(circumferences?.hip, "")],
      ["Coxa direita", fmt(circumferences?.right_thigh, "")],
      ["Coxa esquerda", fmt(circumferences?.left_thigh, "")],
      ["Panturrilha direita", fmt(circumferences?.right_calf, "")],
      ["Panturrilha esquerda", fmt(circumferences?.left_calf, "")],
      ["Braço relax. dir.", fmt(circumferences?.relaxed_right_arm, "")],
      ["Braço relax. esq.", fmt(circumferences?.relaxed_left_arm, "")],
      ["Braço contr. dir.", fmt(circumferences?.contracted_right_arm, "")],
      ["Braço contr. esq.", fmt(circumferences?.contracted_left_arm, "")],
    ],
    styles: { font: "helvetica", fontSize: 9, cellPadding: 1.6 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20 },
    columnStyles: { 1: { halign: "right" } },
    theme: "grid",
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Dobras
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "bold");
  doc.text("Dobras cutâneas (mm)", 14, y);
  autoTable(doc, {
    startY: y + 2,
    head: [["Dobra", "mm"]],
    body: [
      ["Bíceps", fmt(skinfolds?.biceps, "")],
      ["Tríceps", fmt(skinfolds?.triceps, "")],
      ["Subescapular", fmt(skinfolds?.subscapular, "")],
      ["Suprailíaca", fmt(skinfolds?.suprailiac, "")],
      ["Abdominal", fmt(skinfolds?.abdominal, "")],
      ["Axilar média", fmt(skinfolds?.midaxillary, "")],
      ["Tórax", fmt(skinfolds?.chest, "")],
      ["Coxa", fmt(skinfolds?.thigh, "")],
      ["Panturrilha medial", fmt(skinfolds?.medial_calf, "")],
    ],
    styles: { font: "helvetica", fontSize: 9, cellPadding: 1.6 },
    headStyles: { fillColor: [240, 240, 240], textColor: 20 },
    columnStyles: { 1: { halign: "right" } },
    theme: "grid",
    margin: { left: 14, right: 14 },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Comparativo
  if (anterior) {
    if (y > 220) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.text("Comparativo com avaliação anterior", 14, y);
    autoTable(doc, {
      startY: y + 2,
      head: [["Indicador", new Date(anterior.assessment_date).toLocaleDateString("pt-BR"), new Date(assessment.assessment_date).toLocaleDateString("pt-BR"), "Δ"]],
      body: [
        compRow("Peso (kg)", anterior.weight, assessment.weight),
        compRow("IMC", anterior.bmi, assessment.bmi),
        compRow("% Gordura", anterior.body_fat_percentage, assessment.body_fat_percentage),
        compRow("Massa magra (kg)", anterior.lean_mass_kg, assessment.lean_mass_kg),
        compRow("Massa gorda (kg)", anterior.fat_mass_kg, assessment.fat_mass_kg),
        compRow("Soma dobras (mm)", anterior.skinfold_sum, assessment.skinfold_sum),
      ],
      styles: { font: "helvetica", fontSize: 9, cellPadding: 1.6 },
      headStyles: { fillColor: [240, 240, 240], textColor: 20 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      theme: "grid",
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Observações
  if (assessment.notes) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.text("Observações finais", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(assessment.notes, 182);
    doc.text(lines, 14, y);
    y += lines.length * 4 + 4;
  }

  // Rodapé com avaliador
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Avaliador responsável: ${assessment.evaluator_name ?? "—"}`, 14, pageH - 10);
  doc.text(`MPTEAM • Avaliação Física • ${new Date().toLocaleDateString("pt-BR")}`, 196, pageH - 10, { align: "right" });

  const slug = aluno.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  doc.save(`avaliacao-fisica-${slug}-${assessment.assessment_date}.pdf`);
}

function compRow(label: string, a: number | null, b: number | null): (string | number)[] {
  const ant = a == null ? "—" : a.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const cur = b == null ? "—" : b.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  let delta = "—";
  if (a != null && b != null) {
    const d = b - a;
    delta = `${d >= 0 ? "+" : ""}${d.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
  }
  return [label, ant, cur, delta];
}