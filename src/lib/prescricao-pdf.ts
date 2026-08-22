import jsPDF from "jspdf";
import QRCode from "qrcode";
import { NUTRICIONISTA } from "./dieta-pdf/modelo";
import type { PrescricaoCompleta } from "./prescricao";
import type { Aluno } from "./crm";
import { isHtml } from "./rich-html";
import logoMP from "@/assets/logo-mp.png";
import { registrarFonteRoboto } from "./dieta-pdf/fontes";

const RED: [number, number, number] = [237, 28, 36];
const TEXT: [number, number, number] = [40, 40, 40];
const MUTED: [number, number, number] = [130, 130, 130];
const DIVIDER: [number, number, number] = [200, 200, 200];

const MARGIN = 22;
const HEADER_H = 34;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function fmtDataExtenso(iso?: string): string {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function fmtGeradoEm(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} às ${hh}:${mi}`;
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function desenharHeader(doc: jsPDF, pageW: number) {
  doc.setFillColor(...RED);
  doc.rect(0, 0, pageW, HEADER_H, "F");

  // Bloco de contato à direita
  doc.setTextColor(255, 255, 255);
  const rightX = pageW - MARGIN;
  doc.setFont("Roboto", "bold");
  doc.setFontSize(13);
  doc.text(NUTRICIONISTA.nome, rightX, 11, { align: "right" });
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9);
  doc.text(NUTRICIONISTA.titulo, rightX, 16, { align: "right" });
  doc.text(NUTRICIONISTA.email, rightX, 21, { align: "right" });
  doc.text(`CRN: ${NUTRICIONISTA.crn}`, rightX, 26, { align: "right" });

  // Logo à esquerda
  try {
    doc.addImage(logoMP, "PNG", MARGIN, 5, 24, 24);
  } catch {
    /* fallback silencioso */
  }
}

function desenharRodape(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  num: number,
  total: number,
) {
  doc.setDrawColor(...DIVIDER);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, pageH - 14, pageW - MARGIN, pageH - 14);
  doc.setFont("Roboto", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(`Gerado em: ${fmtGeradoEm()}`, MARGIN, pageH - 9);
  doc.text(`Página ${num} de ${total}`, pageW - MARGIN, pageH - 9, { align: "right" });
}

export async function gerarPdfPrescricao(
  presc: PrescricaoCompleta,
  aluno: Aluno,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registrarFonteRoboto(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN * 2;
  const contentBottom = pageH - 18;
  const LINE_H = 5.0;

  // ============ PÁGINA 1 ============
  desenharHeader(doc, pageW);
  let y = HEADER_H + 14;

  // Título PRESCRIÇÃO
  doc.setFont("Roboto", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...RED);
  doc.text("PRESCRIÇÃO", pageW / 2, y, { align: "center" });
  y += 10;

  // Linha Paciente / Data
  doc.setFont("Roboto", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text(`Paciente: ${aluno.nome ?? "(nome)"}`, MARGIN, y);
  doc.text(`Data: ${fmtDataExtenso(presc.data)}`, pageW - MARGIN, y, { align: "right" });
  y += 4;
  doc.setDrawColor(...DIVIDER);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, pageW - MARGIN, y);
  y += 8;

  const ensureSpace = (h: number) => {
    if (y + h > contentBottom) {
      doc.addPage();
      desenharHeader(doc, pageW);
      y = HEADER_H + 14;
    }
  };

  const renderTitulo = (txt: string) => {
    ensureSpace(10);
    doc.setFont("Roboto", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...RED);
    doc.text(txt, MARGIN, y);
    y += 6;
  };

  const renderParagrafo = (txt: string) => {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...TEXT);
    // dividir em parágrafos por linhas em branco
    const paragrafos = txt.split(/\n\s*\n/);
    for (const par of paragrafos) {
      const linhas = par.split("\n").filter((l) => l.trim().length > 0);
      if (!linhas.length) continue;
      for (const linha of linhas) {
        const wrapped = doc.splitTextToSize(linha, contentW);
        ensureSpace(wrapped.length * LINE_H);
        doc.text(wrapped, MARGIN, y);
        y += wrapped.length * LINE_H;
      }
      y += 2;
    }
  };

  type Run = {
    text: string;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    size: number; // pt
    isBullet?: boolean;
    breakBefore?: boolean;
  };

  const SIZE_MAP: Record<string, number> = {
    "11px": 9,
    "9px": 9,
    "small": 9,
    "13px": 10.5,
    "14px": 10.5,
    "medium": 10.5,
    "16px": 13,
    "18px": 13,
    "large": 13,
    "20px": 16,
    "22px": 16,
    "24px": 16,
    "x-large": 16,
  };

  function pxToPt(spec: string): number | null {
    const v = spec.trim().toLowerCase().replace(/\s+/g, "");
    if (SIZE_MAP[v] != null) return SIZE_MAP[v];
    const m = v.match(/^(\d+(?:\.\d+)?)px$/);
    if (m) {
      const px = parseFloat(m[1]);
      if (px <= 11) return 9;
      if (px <= 14) return 10.5;
      if (px <= 18) return 13;
      return 16;
    }
    return null;
  }

  function walkHtml(
    node: Node,
    inherited: { bold: boolean; italic: boolean; underline: boolean; size: number },
    runs: Run[],
  ) {
    if (node.nodeType === 3) {
      const text = (node.textContent ?? "").replace(/\s+/g, " ");
      if (!text) return;
      runs.push({ text, ...inherited });
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName.toUpperCase();
    let next = { ...inherited };
    if (tag === "B" || tag === "STRONG") next.bold = true;
    if (tag === "I" || tag === "EM") next.italic = true;
    if (tag === "U") next.underline = true;
    if (tag === "SPAN" || tag === "P" || tag === "DIV" || tag === "LI") {
      const style = el.getAttribute("style") ?? "";
      const fs = style.match(/font-size:\s*([^;]+)/i);
      if (fs) {
        const pt = pxToPt(fs[1]);
        if (pt) next.size = pt;
      }
      const fw = style.match(/font-weight:\s*(bold|[5-9]00)/i);
      if (fw) next.bold = true;
    }
    const blockBreak = tag === "P" || tag === "DIV" || tag === "BR";
    if (tag === "BR") {
      runs.push({ text: "", bold: next.bold, italic: next.italic, underline: next.underline, size: next.size, breakBefore: true });
      return;
    }
    if (tag === "LI") {
      runs.push({ text: "", ...next, isBullet: true, breakBefore: true });
      el.childNodes.forEach((c) => walkHtml(c, next, runs));
      return;
    }
    if (blockBreak && runs.length > 0) {
      runs.push({ text: "", ...next, breakBefore: true });
    }
    el.childNodes.forEach((c) => walkHtml(c, next, runs));
    if (blockBreak) {
      runs.push({ text: "", ...next, breakBefore: true });
    }
  }

  function fontStyle(bold: boolean, italic: boolean): "normal" | "bold" | "italic" | "bolditalic" {
    if (bold && italic) return "bolditalic";
    if (bold) return "bold";
    if (italic) return "italic";
    return "normal";
  }

  const renderHtmlRich = (html: string) => {
    const dom = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const root = dom.body.firstElementChild;
    if (!root) return;
    const runs: Run[] = [];
    root.childNodes.forEach((c) =>
      walkHtml(c, { bold: false, italic: false, underline: false, size: 10.5 }, runs),
    );

    // Render line-by-line: collect runs into "lines"
    type LineRun = { text: string; bold: boolean; italic: boolean; underline: boolean; size: number };
    const lines: { runs: LineRun[]; bullet: boolean; firstOfBlock: boolean; blankAfter: boolean }[] = [];
    let cur: { runs: LineRun[]; bullet: boolean; firstOfBlock: boolean; blankAfter: boolean } | null = null;
    let nextIsFirst = true;
    let pendingBullet = false;
    let consecutiveBreaks = 0;

    function pushLine() {
      if (cur && cur.runs.length > 0) lines.push(cur);
      cur = null;
    }

    for (const r of runs) {
      if (r.breakBefore) {
        if (cur && cur.runs.length > 0) {
          pushLine();
          consecutiveBreaks = 1;
        } else {
          // empty break = blank line / paragraph separator
          consecutiveBreaks += 1;
          if (lines.length > 0 && consecutiveBreaks >= 2) {
            lines[lines.length - 1].blankAfter = true;
          }
        }
        nextIsFirst = true;
        if (r.isBullet) pendingBullet = true;
        continue;
      }
      if (!cur) {
        cur = { runs: [], bullet: pendingBullet, firstOfBlock: nextIsFirst, blankAfter: false };
        pendingBullet = false;
        nextIsFirst = false;
        consecutiveBreaks = 0;
      }
      if (r.text) cur.runs.push({ text: r.text, bold: r.bold, italic: r.italic, underline: r.underline, size: r.size });
    }
    pushLine();

    if (lines.length === 0) return;
    lines[0].firstOfBlock = true;
    // A line right after a blank-line gap should be treated as a new block (gets ">" prefix)
    for (let i = 1; i < lines.length; i++) {
      if (lines[i - 1].blankAfter) lines[i].firstOfBlock = true;
    }

    const bulletIndent = 5;
    for (const line of lines) {
      // Merge adjacent runs with identical formatting to avoid odd spacing
      // from per-character width measurement on accented characters.
      const merged: LineRun[] = [];
      for (const r of line.runs) {
        const last = merged[merged.length - 1];
        if (
          last &&
          last.bold === r.bold &&
          last.italic === r.italic &&
          last.underline === r.underline &&
          last.size === r.size
        ) {
          last.text += r.text;
        } else {
          merged.push({ ...r });
        }
      }

      const maxSize = Math.max(...merged.map((r) => r.size), 10.5);
      const lineH = maxSize * 0.45;
      const leftPad = line.bullet ? bulletIndent : 0;
      const startX = MARGIN + leftPad;

      // Single-run fast path (the common case): wrap the text properly so
      // accented words don't get broken across runs.
      if (merged.length === 1) {
        const r = merged[0];
        doc.setFont("Roboto", fontStyle(r.bold, r.italic));
        doc.setFontSize(r.size);
        doc.setTextColor(...TEXT);
        const wrapped = doc.splitTextToSize(r.text, contentW - leftPad);
        ensureSpace(wrapped.length * lineH);
        if (line.bullet) {
          doc.setTextColor(...RED);
          doc.setFont("Roboto", "bold");
          doc.setFontSize(r.size);
          doc.text("–", MARGIN, y);
          doc.setTextColor(...TEXT);
          doc.setFont("Roboto", fontStyle(r.bold, r.italic));
        }
        for (let i = 0; i < wrapped.length; i++) {
          if (i > 0) y += lineH;
          doc.text(wrapped[i], startX, y);
          if (r.underline) {
            const w = doc.getTextWidth(wrapped[i]);
            doc.setDrawColor(...TEXT);
            doc.setLineWidth(0.2);
            doc.line(startX, y + 0.8, startX + w, y + 0.8);
          }
        }
        y += lineH;
        if (line.blankAfter) y += lineH * 0.5;
        continue;
      }

      // Multi-run line: render runs sequentially with simple word wrap.
      ensureSpace(lineH + 1);
      if (line.bullet) {
        doc.setTextColor(...RED);
        doc.setFont("Roboto", "bold");
        doc.setFontSize(maxSize);
        doc.text("–", MARGIN, y);
      }
      let x = startX;
      for (const r of merged) {
        doc.setFont("Roboto", fontStyle(r.bold, r.italic));
        doc.setFontSize(r.size);
        doc.setTextColor(...TEXT);
        const words = r.text.split(/(\s+)/);
        for (const word of words) {
          if (!word) continue;
          const w = doc.getTextWidth(word);
          if (x + w > MARGIN + contentW && word.trim()) {
            y += lineH;
            ensureSpace(lineH);
            x = startX;
            if (!word.trim()) continue;
          }
          doc.text(word, x, y);
          if (r.underline && word.trim()) {
            doc.setDrawColor(...TEXT);
            doc.setLineWidth(0.2);
            doc.line(x, y + 0.8, x + w, y + 0.8);
          }
          x += w;
        }
      }
      y += lineH;
      if (line.blankAfter) y += lineH * 0.5;
    }
    y += 2;
  };

  const renderRichOuPara = (txt: string) => {
    if (isHtml(txt)) renderHtmlRich(txt);
    else renderParagrafo(txt);
  };

  const renderLista = (itens: string[]) => {
    doc.setFont("Roboto", "normal");
    doc.setFontSize(10.5);
    for (const item of itens) {
      const lines = doc.splitTextToSize(item, contentW - 5);
      ensureSpace(lines.length * LINE_H + 1);
      doc.setTextColor(...RED);
      doc.setFont("Roboto", "bold");
      doc.text("–", MARGIN, y);
      doc.setFont("Roboto", "normal");
      doc.setTextColor(...TEXT);
      doc.text(lines, MARGIN + 5, y);
      y += lines.length * LINE_H + 1;
    }
  };

  const seccao = (titulo: string, render: () => void) => {
    renderTitulo(titulo);
    render();
    y += 4;
  };

  if (presc.descricao && presc.descricao.trim()) {
    seccao("Descrição", () => renderRichOuPara(presc.descricao!.trim()));
  }
  if (presc.posologia && presc.posologia.trim()) {
    seccao("Posologia", () => renderRichOuPara(presc.posologia!.trim()));
  }
  const sup = (presc.suplementos ?? []).map((s) => s.trim()).filter(Boolean);
  if (sup.length) seccao("Suplementos", () => renderLista(sup));
  const fito = (presc.fitoterapicos ?? []).map((s) => s.trim()).filter(Boolean);
  if (fito.length) seccao("Fitoterápicos", () => renderLista(fito));
  if (presc.observacoes && presc.observacoes.trim()) {
    seccao("Observações", () => renderRichOuPara(presc.observacoes!.trim()));
  }

  // Assinatura no rodapé da última página de conteúdo
  const assinaturaY = pageH - 40;
  if (y < assinaturaY - 4) {
    doc.setDrawColor(...DIVIDER);
    doc.setLineWidth(0.2);
    doc.line(pageW / 2 - 35, assinaturaY, pageW / 2 + 35, assinaturaY);
    doc.setFont("Roboto", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT);
    doc.text(NUTRICIONISTA.nome, pageW / 2, assinaturaY + 5, { align: "center" });
    doc.setFont("Roboto", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`CRN ${NUTRICIONISTA.crn}`, pageW / 2, assinaturaY + 10, { align: "center" });
    doc.text("CREF 011507 G-PE", pageW / 2, assinaturaY + 14.5, { align: "center" });
  }

  // ============ PÁGINA 2 — Verificação Digital ============
  doc.addPage();
  desenharHeader(doc, pageW);
  let y2 = HEADER_H + 24;

  doc.setFont("Roboto", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...TEXT);
  doc.text("Verificação Digital", pageW / 2, y2, { align: "center" });
  y2 += 14;

  // QR Code
  const url = `https://mpteam-crm.lovable.app/alunos/${aluno.id}`;
  try {
    const dataUrl = await QRCode.toDataURL(url, { margin: 1, width: 400 });
    const qrSize = 55;
    doc.addImage(dataUrl, "PNG", pageW / 2 - qrSize / 2, y2, qrSize, qrSize);
    y2 += qrSize + 10;
  } catch {
    y2 += 10;
  }

  doc.setFont("Roboto", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const txt1 = "Escaneie o QR Code acima para visualizar o documento online.";
  const txt2 = "Em caso de divergências, contate o profissional responsável.";
  doc.text(txt1, pageW / 2, y2, { align: "center" });
  y2 += 5.5;
  doc.text(txt2, pageW / 2, y2, { align: "center" });
  y2 += 16;

  doc.setFont("Roboto", "bold");
  doc.setFontSize(12);
  doc.text(NUTRICIONISTA.nome, pageW / 2, y2, { align: "center" });
  y2 += 5.5;
  doc.setFont("Roboto", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(NUTRICIONISTA.email, pageW / 2, y2, { align: "center" });

  // Rodapés com numeração final
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    desenharRodape(doc, pageW, pageH, i, total);
  }

  return doc;
}

export async function exportarPdfPrescricao(
  presc: PrescricaoCompleta,
  aluno: Aluno,
): Promise<void> {
  const doc = await gerarPdfPrescricao(presc, aluno);
  const data = presc.data ?? new Date().toISOString().slice(0, 10);
  const nome = slugify(aluno.nome ?? "aluno");
  doc.save(`prescricao-${nome}-${data}.pdf`);
}