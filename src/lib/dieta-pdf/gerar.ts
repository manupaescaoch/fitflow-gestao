import jsPDF from "jspdf";
import {
  NUTRICIONISTA,
  ORIENTACOES_GERAIS,
  RODAPE_CUPOM,
} from "./modelo";
import { somaPlano, somaItens, parseRefeicaoObs, parsePlanoDescricao, extrairMacrosDeDescricao, type PlanoCompleto, type RefeicaoCompleta, type DietaItemComSubs } from "@/lib/dieta";
import type { Aluno } from "@/lib/crm";
import logoMP from "@/assets/logo-mp.png";

/** Dados opcionais para a página "Prescrição Nutricional" do PDF. */
export type Prescricao = {
  descricao?: string;
  posologia?: string;
  suplementos?: string[];
  fitoterapicos?: string[];
  observacoes?: string;
};

function temPrescricao(p?: Prescricao): boolean {
  if (!p) return false;
  return Boolean(
    (p.descricao && p.descricao.trim()) ||
    (p.posologia && p.posologia.trim()) ||
    (p.suplementos && p.suplementos.some((s) => s.trim())) ||
    (p.fitoterapicos && p.fitoterapicos.some((s) => s.trim())) ||
    (p.observacoes && p.observacoes.trim()),
  );
}

// Paleta exata do modelo Manu Paes
const RED: [number, number, number] = [237, 28, 36];      // vermelho da marca (header/títulos)
const TEXT: [number, number, number] = [40, 40, 40];      // cinza-escuro corpo
const MUTED: [number, number, number] = [130, 130, 130];  // cinza labels
const CARD_BG: [number, number, number] = [240, 240, 240]; // cinza claro card macros
const CARD_BORDER: [number, number, number] = [220, 220, 220];
const DIVIDER: [number, number, number] = [200, 200, 200];

const MARGIN = 14;
const HEADER_H = 28;

function fmtData(d = new Date()): string {
  return d.toLocaleDateString("pt-BR");
}

function fmtNum(n: number, dec = 1): string {
  return n.toFixed(dec).replace(".", ",");
}

function fmtTotalLinha(t: { kcal: number; ptn: number; cho: number; lip: number }): string {
  return `${Math.round(t.kcal)} kcal | ${fmtNum(t.ptn)}g P / ${fmtNum(t.cho)}g C / ${fmtNum(t.lip)}g G`;
}

/**
 * Converte HTML (vindo do RichTextEditor) em texto plano preservando quebras de linha
 * entre blocos (p, div, br, li, headings). Decodifica entidades HTML comuns.
 * Indispensável para o modo "texto livre" que pode conter marcação rica.
 */
function htmlParaTextoPlano(html: string): string {
  if (!html) return "";
  let s = String(html);
  // Normaliza quebras nativas
  s = s.replace(/\r\n/g, "\n");
  // <br> -> quebra simples
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // Fim de blocos -> quebra dupla (parágrafo)
  s = s.replace(/<\/(p|div|li|h[1-6]|ul|ol|tr|blockquote)>/gi, "\n");
  // Início de <li> -> bullet
  s = s.replace(/<li[^>]*>/gi, "• ");
  // Remove qualquer outra tag
  s = s.replace(/<[^>]+>/g, "");
  // Decodifica entidades comuns
  s = s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  // Compacta múltiplas quebras (>2) e espaços em excesso por linha
  s = s
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}

/** Parseia blocos "Opção N: ... Total: X kcal | Yg P / Zg C / Wg G" do campo observações. */
function parseOpcoesObs(obs: string): { rotulo: string; itens: { nome: string; quantidade: string }[]; totaisLinha: string | null }[] {
  const out: { rotulo: string; itens: { nome: string; quantidade: string }[]; totaisLinha: string | null }[] = [];
  if (!obs) return out;
  // Divide por "Opção N:" mantendo o rótulo
  const partes = obs.split(/(?=^\s*Op[cç][aã]o\s*\d+\s*:)/im);
  for (const parte of partes) {
    const m = parte.match(/^\s*(Op[cç][aã]o\s*\d+)\s*:\s*([\s\S]*)$/i);
    if (!m) continue;
    const rotulo = m[1].replace(/\s+/g, " ").trim();
    const corpo = m[2].trim();
    const linhas = corpo.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let totaisLinha: string | null = null;
    const itens: { nome: string; quantidade: string }[] = [];
    for (const linha of linhas) {
      if (/^total\s*:/i.test(linha)) {
        totaisLinha = linha.replace(/^total\s*:\s*/i, "").trim();
        continue;
      }
      // Separa "Nome — quantidade" pelo último travessão
      const idx = linha.lastIndexOf("—");
      if (idx > 0) {
        itens.push({
          nome: linha.slice(0, idx).trim(),
          quantidade: linha.slice(idx + 1).trim(),
        });
      } else {
        itens.push({ nome: linha, quantidade: "" });
      }
    }
    out.push({ rotulo, itens, totaisLinha });
  }
  return out;
}

/** Agrupa itens da refeição em "opções": Opção 1 = itens principais; Opções 2+ = blocos de substitutos do item-âncora. */
function extrairOpcoes(ref: RefeicaoCompleta): { rotulo: string; itens: { nome: string; quantidade: string }[]; totais: { kcal: number; ptn: number; cho: number; lip: number } }[] {
  const opcoes: ReturnType<typeof extrairOpcoes> = [];

  // Opção 1 = itens principais
  if (ref.itens.length) {
    const totais = somaItens(ref.itens);
    opcoes.push({
      rotulo: "Opção 1",
      itens: ref.itens.map((i) => ({
        nome: i.nome_custom ?? "",
        quantidade: `${fmtNum(Number(i.quantidade), 0)}${i.unidade || "g"}`,
      })),
      totais: { kcal: Number(totais.kcal), ptn: Number(totais.ptn), cho: Number(totais.cho), lip: Number(totais.lip) },
    });
  }

  // Substitutos do primeiro item = blocos das opções 2, 3...
  const ancora = ref.itens[0] as DietaItemComSubs | undefined;
  const subs = ancora?.substitutos ?? [];
  if (subs.length) {
    // Cada "opção alternativa" é um conjunto de subs criados em sequência
    // Aqui agrupamos heuristicamente: se houver "marcador" pelo nome repetir, criamos blocos.
    // Como não temos marcador, dividimos pelos substitutos contínuos (cada N itens forma uma opção).
    // Estratégia simples: cada substituto vira UMA opção alternativa; se o usuário usou várias linhas
    // por opção via aplicarRefeicoesIA, elas estão todas em ordem. Como fallback prático:
    // agrupamos todos juntos como "Opção 2".
    // Para preservar semântica do importador, separamos por "blocos" de mesmo tamanho da opção 1.
    const tamBloco = Math.max(1, ref.itens.length);
    let n = 2;
    for (let i = 0; i < subs.length; i += tamBloco) {
      const bloco = subs.slice(i, i + tamBloco);
      const totais = bloco.reduce(
        (acc, s) => ({
          kcal: acc.kcal + Number(s.kcal),
          ptn: acc.ptn + Number(s.ptn),
          cho: acc.cho + Number(s.cho),
          lip: acc.lip + Number(s.lip),
        }),
        { kcal: 0, ptn: 0, cho: 0, lip: 0 },
      );
      opcoes.push({
        rotulo: `Opção ${n++}`,
        itens: bloco.map((s) => ({
          nome: s.nome_custom ?? "",
          quantidade: `${fmtNum(Number(s.quantidade), 0)}${s.unidade || "g"}`,
        })),
        totais,
      });
    }
  }

  return opcoes;
}

function desenharHeader(doc: jsPDF, pageW: number) {
  // Faixa vermelha
  doc.setFillColor(...RED);
  doc.rect(0, 0, pageW, HEADER_H, "F");

  // Logo à esquerda
  try {
    doc.addImage(logoMP, "PNG", MARGIN, 4, 22, 22);
  } catch {
    /* fallback silencioso */
  }

  // Bloco de contato à direita
  doc.setTextColor(255, 255, 255);
  const rightX = pageW - MARGIN;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(NUTRICIONISTA.nome, rightX, 7, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(NUTRICIONISTA.titulo, rightX, 11.5, { align: "right" });
  doc.text(NUTRICIONISTA.email, rightX, 16, { align: "right" });
  doc.text(`CRN: ${NUTRICIONISTA.crn}   ${NUTRICIONISTA.telefone}`, rightX, 20.5, { align: "right" });
  doc.text(NUTRICIONISTA.site, rightX, 25, { align: "right" });
}

function desenharRodapePagina(doc: jsPDF, pageW: number, pageH: number, num: number, total: number) {
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Página ${num} de ${total}`, pageW - MARGIN, pageH - 8, { align: "right" });
}

function novaPagina(doc: jsPDF, pageW: number): number {
  doc.addPage();
  desenharHeader(doc, pageW);
  return HEADER_H + 8;
}

/** Desenha a página "Prescrição Nutricional". Retorna y final (próxima posição). */
function desenharPaginaPrescricao(
  doc: jsPDF,
  pageW: number,
  pageH: number,
  aluno: Aluno,
  presc: Prescricao,
): void {
  const contentBottom = pageH - 14;
  const contentW = pageW - MARGIN * 2;
  const LINE_H = 4.6;

  let y = novaPagina(doc, pageW);

  // Título
  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PRESCRIÇÃO", pageW / 2, y + 2, { align: "center" });
  const tituloW = doc.getTextWidth("PRESCRIÇÃO");
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.6);
  doc.line(pageW / 2 - tituloW / 2, y + 4, pageW / 2 + tituloW / 2, y + 4);
  y += 12;

  // Linha Paciente | Data
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text(`Paciente: ${aluno.nome ?? "(nome)"}`, MARGIN, y);
  doc.text(`Data: ${fmtData()}`, pageW - MARGIN, y, { align: "right" });
  y += 8;

  const ensureSpace = (h: number) => {
    if (y + h > contentBottom) y = novaPagina(doc, pageW);
  };

  const renderTitulo = (txt: string) => {
    ensureSpace(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...RED);
    doc.text(txt, MARGIN, y);
    y += 5.5;
  };

  const renderParagrafo = (txt: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    const lines = doc.splitTextToSize(txt, contentW);
    for (const line of lines) {
      ensureSpace(LINE_H);
      doc.text(line, MARGIN, y);
      y += LINE_H;
    }
  };

  const renderLista = (itens: string[]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const item of itens) {
      const lines = doc.splitTextToSize(item, contentW - 5);
      ensureSpace(lines.length * LINE_H + 0.8);
      doc.setTextColor(...RED);
      doc.text("•", MARGIN + 1, y);
      doc.setTextColor(...TEXT);
      doc.text(lines, MARGIN + 5, y);
      y += lines.length * LINE_H + 0.8;
    }
  };

  const seccao = (titulo: string, render: () => void) => {
    renderTitulo(titulo);
    render();
    y += 5;
  };

  if (presc.descricao && presc.descricao.trim()) {
    seccao("DESCRIÇÃO", () => renderParagrafo(htmlParaTextoPlano(presc.descricao!.trim())));
  }
  if (presc.posologia && presc.posologia.trim()) {
    seccao("POSOLOGIA", () => renderParagrafo(htmlParaTextoPlano(presc.posologia!.trim())));
  }
  const sup = (presc.suplementos ?? []).map((s) => s.trim()).filter(Boolean);
  if (sup.length) {
    seccao("SUPLEMENTOS", () => renderLista(sup));
  }
  const fito = (presc.fitoterapicos ?? []).map((s) => s.trim()).filter(Boolean);
  if (fito.length) {
    seccao("FITOTERÁPICOS", () => renderLista(fito));
  }
  if (presc.observacoes && presc.observacoes.trim()) {
    seccao("OBSERVAÇÕES", () => renderParagrafo(htmlParaTextoPlano(presc.observacoes!.trim())));
  }

  // Assinatura no rodapé da página atual
  const assinaturaY = pageH - 22;
  if (y < assinaturaY) {
    doc.setDrawColor(...DIVIDER);
    doc.setLineWidth(0.2);
    doc.line(pageW / 2 - 40, assinaturaY - 2, pageW / 2 + 40, assinaturaY - 2);
    doc.setTextColor(...TEXT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(NUTRICIONISTA.nome, pageW / 2, assinaturaY + 2, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(`${NUTRICIONISTA.titulo} — CRN ${NUTRICIONISTA.crn}`, pageW / 2, assinaturaY + 6.5, { align: "center" });
  }
}

export function gerarPdfDieta(plano: PlanoCompleto, aluno: Aluno, prescricao?: Prescricao): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentBottom = pageH - 14; // área útil

  // ============ PÁGINA 1: HEADER ============
  desenharHeader(doc, pageW);

  // Título centralizado
  let y = HEADER_H + 12;
  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("PLANO ALIMENTAR", pageW / 2, y, { align: "center" });
  y += 8;

  // Linha Paciente | Data
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "normal");
  doc.text(`Paciente: ${aluno.nome ?? "(nome)"}`, MARGIN, y);
  doc.text(`Data: ${fmtData()}`, pageW - MARGIN, y, { align: "right" });
  y += 5;
  doc.text(`Dias: ${(plano.dias_semana ?? []).join(", ") || "Todos os dias"}`, MARGIN, y);
  y += 8;

  // Subtítulo "Resumo Nutricional Diário"
  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Resumo Nutricional Diário", MARGIN, y);
  y += 4;

  // Card cinza com 4 colunas
  const cardH = 22;
  const cardW = pageW - MARGIN * 2;
  doc.setFillColor(...CARD_BG);
  doc.setDrawColor(...CARD_BORDER);
  doc.roundedRect(MARGIN, y, cardW, cardH, 2.5, 2.5, "FD");

  const total = somaPlano(plano);
  // Fallback: se a soma das refeições der zero (caso típico de "texto livre"),
  // tenta extrair os totais da descrição manual / do plano.
  const parsedDesc = parsePlanoDescricao(plano.descricao);
  const totaisDesc = parsedDesc.totaisManuais;
  const fromTextDesc = extrairMacrosDeDescricao(parsedDesc.descricao);
  const totalEffective = (Number(total.kcal) + Number(total.ptn) + Number(total.cho) + Number(total.lip)) > 0
    ? { kcal: Number(total.kcal), ptn: Number(total.ptn), cho: Number(total.cho), lip: Number(total.lip) }
    : (totaisDesc.kcal || totaisDesc.ptn || totaisDesc.cho || totaisDesc.lip)
      ? totaisDesc
      : (fromTextDesc ?? { kcal: 0, ptn: 0, cho: 0, lip: 0 });
  const colW = cardW / 4;
  const macros = [
    { v: `${Math.round(Number(totalEffective.kcal))}`, label: "Calorias (kcal)" },
    { v: `${fmtNum(Number(totalEffective.ptn))}g`, label: "Proteína" },
    { v: `${fmtNum(Number(totalEffective.cho))}g`, label: "Carboidratos" },
    { v: `${fmtNum(Number(totalEffective.lip))}g`, label: "Gorduras" },
  ];
  macros.forEach((m, i) => {
    const cx = MARGIN + colW * i + colW / 2;
    doc.setTextColor(...RED);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(m.v, cx, y + 11, { align: "center" });
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(m.label, cx, y + 17, { align: "center" });
  });
  y += cardH + 6;

  // ============ REFEIÇÕES ============
  for (let idx = 0; idx < plano.refeicoes.length; idx++) {
    const ref = plano.refeicoes[idx];
    const parsedObs = parseRefeicaoObs(ref.observacoes);

    // Helpers de cabeçalho/continuação reutilizáveis dentro da iteração
    const horarioRef = ref.horario ? ` • ${ref.horario}` : "";
    const nomeRawRef = (ref.nome ?? "").trim();
    const isGenericoRef = /^refei[cç][aã]o\s*\d+$/i.test(nomeRawRef);
    const tituloBase = isGenericoRef || !nomeRawRef
      ? `Refeição ${idx + 1}${horarioRef}`
      : `Refeição ${idx + 1}: ${nomeRawRef}${horarioRef}`;
    const desenharBarraTitulo = (texto: string, yPos: number): number => {
      const barH = 8;
      doc.setFillColor(...RED);
      doc.roundedRect(MARGIN, yPos, pageW - MARGIN * 2, barH, 1.5, 1.5, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(texto, MARGIN + 3, yPos + 5.6);
      return yPos + barH + 4;
    };
    const novaPaginaComContinuacao = (): number => {
      const ny = novaPagina(doc, pageW);
      return desenharBarraTitulo(`${tituloBase} (continuação)`, ny);
    };

    // ----- MODO TEXTO LIVRE -----
    if (parsedObs.modo === "texto_livre") {
      const barH = 8;
      const headerH = barH + 4;
      const LINE_TL = 4.5;

      // Quebra o conteúdo em "blocos" por parágrafo (separados por linha em branco) — geralmente são as Opções
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const conteudoBruto = htmlParaTextoPlano(parsedObs.conteudo || "");
      const blocos = conteudoBruto.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
      const blocosWrap: string[][] = blocos.map((b) =>
        doc.splitTextToSize(b, pageW - MARGIN * 2 - 4) as string[],
      );

      // Margem mínima: header + 2 linhas do primeiro bloco
      const minHeaderJunto = headerH + Math.min(2, blocosWrap[0]?.length ?? 0) * LINE_TL;
      if (y + minHeaderJunto > contentBottom) y = novaPagina(doc, pageW);

      y = desenharBarraTitulo(tituloBase, y);

      // Renderiza bloco a bloco — cada bloco (ex.: "Opção 1", "Opção 2") tenta ficar inteiro na página
      doc.setTextColor(...TEXT);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (let bi = 0; bi < blocosWrap.length; bi++) {
        const linhas = blocosWrap[bi];
        const alturaBloco = linhas.length * LINE_TL;
        const maxAlturaPagina = contentBottom - (HEADER_H + 8);

        // Só puxa o bloco inteiro para a próxima página se ele for "pequeno"
        // (até ~8 linhas). Blocos grandes quebram naturalmente linha-a-linha.
        if (linhas.length <= 8 && alturaBloco <= maxAlturaPagina && y + alturaBloco > contentBottom) {
          y = novaPaginaComContinuacao();
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(...TEXT);
        }
        for (const ln of linhas) {
          if (y > contentBottom - 6) {
            y = novaPaginaComContinuacao();
            doc.setFont("helvetica", "normal");
            doc.setFontSize(10);
            doc.setTextColor(...TEXT);
          }
          doc.text(ln, MARGIN + 3, y);
          y += LINE_TL;
        }
        // Espaço entre Opções
        if (bi < blocosWrap.length - 1) y += 2;
      }

      const obsL = (parsedObs.observacao ?? "").trim();
      if (obsL) {
        if (y > contentBottom - 10) y = novaPaginaComContinuacao();
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        const obs = doc.splitTextToSize(`Obs: ${htmlParaTextoPlano(obsL)}`, pageW - MARGIN * 2 - 4);
        doc.text(obs, MARGIN + 2, y + 2);
        y += obs.length * 4 + 2;
      }

      y += 1;
      continue;
    }

    const opcoesPrincipais = extrairOpcoes(ref);
    // Opções extras vindas do campo observações (Opção 2, 3, ...)
    const opcoesObs = parseOpcoesObs(ref.observacoes ?? "");
    // Renomeia rótulos para sequência contínua
    type OpcaoRender = { rotulo: string; itens: { nome: string; quantidade: string }[]; totaisLinha: string | null };
    const opcoes: OpcaoRender[] = [];
    for (const op of opcoesPrincipais) {
      opcoes.push({ rotulo: op.rotulo, itens: op.itens, totaisLinha: fmtTotalLinha(op.totais) });
    }
    for (const op of opcoesObs) {
      opcoes.push({ rotulo: op.rotulo, itens: op.itens, totaisLinha: op.totaisLinha });
    }
    if (!opcoes.length) continue;

    // Quebra defensiva mínima: barra do título + ~2 linhas
    if (y > contentBottom - 20) y = novaPagina(doc, pageW);
    y = desenharBarraTitulo(tituloBase, y);

    // Cada opção
    for (let oi = 0; oi < opcoes.length; oi++) {
      const op = opcoes[oi];
      // Mantém junto: rótulo + ~3 itens. Se não couber, vai pra próxima página
      // mas o restante dos itens flui naturalmente (sem espaço em branco).
      const minJunto = 5 + Math.min(3, op.itens.length) * 4.5;
      if (y + minJunto > contentBottom) y = novaPaginaComContinuacao();

      // Rótulo "Opção N" em vermelho
      doc.setTextColor(...RED);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.text(op.rotulo, MARGIN + 2, y);

      // Linha divisória cinza começando após o rótulo (visual sutil do modelo)
      const labelW = doc.getTextWidth(op.rotulo);
      doc.setDrawColor(...DIVIDER);
      doc.setLineWidth(0.2);
      doc.line(MARGIN + 2 + labelW + 4, y - 1, pageW - MARGIN - 2, y - 1);
      y += 5;

      // Itens
      doc.setTextColor(...TEXT);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const it of op.itens) {
        if (y > contentBottom - 6) {
          y = novaPaginaComContinuacao();
          doc.setTextColor(...TEXT);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
        }
        const linha = it.quantidade ? `${it.nome} — ${it.quantidade}` : it.nome;
        doc.text(linha, MARGIN + 5, y);
        y += 4.5;
      }

      // Linha de totais "x kcal | x,xg P / x,xg C / x,xg G" — kcal e macros em itálico negrito
      if (op.totaisLinha) {
        if (y > contentBottom - 6) y = novaPaginaComContinuacao();
        doc.setTextColor(...TEXT);
        doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(10);
        doc.text(op.totaisLinha, MARGIN + 5, y + 1);
        y += 7;
      }
    }

    // Mostra observações apenas se NÃO foram consumidas como opções (texto livre adicional)
    const obsTexto = htmlParaTextoPlano((ref.observacoes ?? "").trim());
    const isApenasTotal = /^total\s*:/i.test(obsTexto);
    const obsConsumida = opcoesObs.length > 0;
    if (obsTexto && !isApenasTotal && !obsConsumida) {
      if (y > contentBottom - 10) y = novaPaginaComContinuacao();
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      const obs = doc.splitTextToSize(`Obs: ${obsTexto}`, pageW - MARGIN * 2 - 4);
      doc.text(obs, MARGIN + 2, y);
      y += obs.length * 4 + 2;
    }

    y += 1;
  }

  // ============ PRESCRIÇÃO NUTRICIONAL (opcional) ============
  if (temPrescricao(prescricao)) {
    desenharPaginaPrescricao(doc, pageW, pageH, aluno, prescricao!);
  }

  // ============ ORIENTAÇÕES GERAIS ============
  y = novaPagina(doc, pageW);
  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ORIENTAÇÕES GERAIS", pageW / 2, y + 2, { align: "center" });
  // Sublinhado decorativo curto sob o título
  const tituloW = doc.getTextWidth("ORIENTAÇÕES GERAIS");
  doc.setDrawColor(...RED);
  doc.setLineWidth(0.6);
  doc.line(pageW / 2 - tituloW / 2, y + 4, pageW / 2 + tituloW / 2, y + 4);
  y += 12;

  const contentW = pageW - MARGIN * 2;
  const LINE_H = 4.6;

  // ---- Sistema de estilos por tipo de bloco ----
  const STYLE = {
    titulo: { font: "bold" as const, size: 11.5, color: RED, gapAfter: 5.5 },
    paragrafo: { font: "normal" as const, size: 10, color: TEXT, gapAfter: 1.5 },
    listaItem: { font: "normal" as const, size: 10, color: TEXT, indent: 5, gapAfter: 0.8 },
    exemploLabel: { font: "bold" as const, size: 10, color: RED, width: 18 },
    exemploTexto: { font: "normal" as const, size: 10, color: TEXT },
    blocoGap: 6,
  };

  type Bloco = (typeof ORIENTACOES_GERAIS)[number];

  const aplicarTitulo = () => {
    doc.setFont("helvetica", STYLE.titulo.font);
    doc.setFontSize(STYLE.titulo.size);
    doc.setTextColor(...STYLE.titulo.color);
  };
  const aplicarParagrafo = () => {
    doc.setFont("helvetica", STYLE.paragrafo.font);
    doc.setFontSize(STYLE.paragrafo.size);
    doc.setTextColor(...STYLE.paragrafo.color);
  };

  /** Quebra um texto com marcadores **negrito** em segmentos { text, bold }. */
  const parseBold = (s: string): { text: string; bold: boolean }[] => {
    const parts: { text: string; bold: boolean }[] = [];
    const re = /\*\*(.+?)\*\*/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parts.push({ text: s.slice(last, m.index), bold: false });
      parts.push({ text: m[1], bold: true });
      last = m.index + m[0].length;
    }
    if (last < s.length) parts.push({ text: s.slice(last), bold: false });
    return parts;
  };

  /**
   * Renderiza um parágrafo com suporte a **negrito** (vermelho) preservando
   * quebra de linha. Retorna a nova posição Y.
   */
  const renderRich = (
    text: string,
    x: number,
    yStart: number,
    maxW: number,
    boldColor: [number, number, number] = RED,
    baseColor: [number, number, number] = TEXT,
  ): number => {
    const segs = parseBold(text);
    let cx = x;
    let cy = yStart;
    const spaceW = doc.getTextWidth(" ");
    for (const seg of segs) {
      doc.setFont("helvetica", seg.bold ? "bold" : "normal");
      doc.setTextColor(...(seg.bold ? boldColor : baseColor));
      const words = seg.text.split(/(\s+)/);
      for (const w of words) {
        if (!w) continue;
        if (/^\s+$/.test(w)) {
          cx += spaceW;
          continue;
        }
        const ww = doc.getTextWidth(w);
        if (cx - x + ww > maxW) {
          cy += LINE_H;
          cx = x;
        }
        doc.text(w, cx, cy);
        cx += ww;
      }
    }
    return cy + LINE_H;
  };

  /** Calcula altura total que o bloco ocupará (para evitar quebras feias). */
  const medirBloco = (b: Bloco): number => {
    let h = STYLE.titulo.gapAfter + 3; // título + respiro
    if (b.tipo === "paragrafo") {
      const lines = doc.splitTextToSize(b.conteudo, contentW);
      h += lines.length * LINE_H;
    } else if (b.tipo === "paragrafo_com_exemplo") {
      const p = doc.splitTextToSize(b.conteudo, contentW);
      const ex = doc.splitTextToSize(b.exemplo, contentW - STYLE.exemploLabel.width - 2);
      h += p.length * LINE_H + STYLE.paragrafo.gapAfter + ex.length * LINE_H;
    } else {
      for (const item of b.itens) {
        const lines = doc.splitTextToSize(item, contentW - STYLE.listaItem.indent);
        h += lines.length * LINE_H + STYLE.listaItem.gapAfter;
      }
    }
    return h + STYLE.blocoGap;
  };

  /** Renderiza um bloco aplicando o estilo correto por tipo. */
  const renderBloco = (b: Bloco): void => {
    // Título (igual em todos os blocos)
    aplicarTitulo();
    doc.text(b.titulo, MARGIN, y);
    y += STYLE.titulo.gapAfter;

    if (b.tipo === "paragrafo") {
      aplicarParagrafo();
      y = renderRich(b.conteudo, MARGIN, y, contentW);
    } else if (b.tipo === "paragrafo_com_exemplo") {
      // Parágrafo principal
      aplicarParagrafo();
      y = renderRich(b.conteudo, MARGIN, y, contentW);
      y += STYLE.paragrafo.gapAfter;
      // Linha "Exemplo: ..."
      doc.setFont("helvetica", STYLE.exemploLabel.font);
      doc.setTextColor(...STYLE.exemploLabel.color);
      doc.text("Exemplo:", MARGIN, y);
      const exX = MARGIN + STYLE.exemploLabel.width;
      y = renderRich(b.exemplo, exX, y, contentW - STYLE.exemploLabel.width - 2);
    } else {
      // Lista com bullet vermelho e hanging indent
      for (const item of b.itens) {
        const lines = doc.splitTextToSize(item, contentW - STYLE.listaItem.indent);
        // Quebra defensiva por item (evita órfão dentro de lista longa)
        if (y + lines.length * LINE_H > contentBottom) {
          y = novaPagina(doc, pageW);
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(STYLE.listaItem.size);
        doc.setTextColor(...RED);
        doc.text("•", MARGIN + 1, y);
        doc.setTextColor(...STYLE.listaItem.color);
        doc.text(lines, MARGIN + STYLE.listaItem.indent, y);
        y += lines.length * LINE_H + STYLE.listaItem.gapAfter;
      }
    }

    y += STYLE.blocoGap;
  };

  for (const bloco of ORIENTACOES_GERAIS) {
    // Mantém título junto do início do conteúdo
    const minH = STYLE.titulo.gapAfter + LINE_H * 2 + 4;
    const blocoH = medirBloco(bloco);
    if (y + Math.min(blocoH, minH + 6) > contentBottom) y = novaPagina(doc, pageW);
    renderBloco(bloco);
  }

  // ============ FECHAMENTO / CUPOM ============
  if (y > contentBottom - 40) y = novaPagina(doc, pageW);
  y += 4;
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(RODAPE_CUPOM.texto, pageW / 2, y, { align: "center" });
  y += 6;
  doc.setTextColor(...RED);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(RODAPE_CUPOM.link, pageW / 2, y, { align: "center" });
  y += 5;
  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`— use o cupom `, pageW / 2 - 12, y, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...RED);
  doc.text(RODAPE_CUPOM.cupom, pageW / 2 - 10, y);
  y += 10;

  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(NUTRICIONISTA.nome, pageW / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text(`${NUTRICIONISTA.titulo} — CRN ${NUTRICIONISTA.crn}`, pageW / 2, y + 5, { align: "center" });

  // Numeração de páginas
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    desenharRodapePagina(doc, pageW, pageH, i, totalPages);
  }

  return doc;
}

export function exportarPdfDieta(plano: PlanoCompleto, aluno: Aluno, prescricao?: Prescricao): void {
  const doc = gerarPdfDieta(plano, aluno, prescricao);
  const slug = (aluno.nome ?? "aluno").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `dieta-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`;
  // Em ambientes sem window (SSR/teste) cai no fallback de baixar direto.
  if (typeof window === "undefined") {
    doc.save(filename);
    return;
  }
  // Dispara prévia paginada — usuário valida fonte/acentos/quebras antes de baixar.
  window.dispatchEvent(
    new CustomEvent("dieta:preview-pdf", { detail: { doc, filename } }),
  );
}