import { describe, it, expect } from "vitest";
import { gerarPdfDieta } from "./gerar";
import type { PlanoCompleto, RefeicaoCompleta } from "@/lib/dieta";
import type { Aluno } from "@/lib/crm";

/**
 * Lê os comandos PDF de uma página específica do jsPDF
 * (jsPDF expõe `internal.pages` como array indexado a partir de 1).
 */
function dumpPagina(doc: ReturnType<typeof gerarPdfDieta>, n: number): string {
  // @ts-expect-error - acesso a campo interno do jsPDF
  const pages = doc.internal.pages as (string[] | string)[];
  const p = pages[n];
  return Array.isArray(p) ? p.join("\n") : String(p ?? "");
}

function dumpTodasPaginas(doc: ReturnType<typeof gerarPdfDieta>): string[] {
  const total = doc.getNumberOfPages();
  const out: string[] = [];
  for (let i = 1; i <= total; i++) out.push(dumpPagina(doc, i));
  return out;
}

/** Retorna true se o dump da página contiver o trecho de texto (jsPDF escreve via Tj). */
function paginaContem(dump: string, trecho: string): boolean {
  // O jsPDF escreve texto como `(texto) Tj` — basta verificar substring crua.
  return dump.includes(trecho);
}

const ALUNO: Aluno = {
  id: "test-id",
  nome: "Aluno Teste",
  whatsapp: "11999999999",
} as unknown as Aluno;

/** Cria uma refeição "estruturada" com N itens (cada um cabe em 1 linha). */
function refeicaoComN(idx: number, n: number, titulo = "Refeição Longa"): RefeicaoCompleta {
  const itens = Array.from({ length: n }, (_, i) => ({
    id: `it-${idx}-${i}`,
    refeicao_id: `r-${idx}`,
    alimento_id: null,
    nome_custom: `Alimento ${i + 1} da refeição ${idx + 1}`,
    quantidade: 100,
    unidade: "g",
    kcal: 100,
    ptn: 10,
    cho: 15,
    lip: 2,
    ordem: i,
    criado_em: new Date().toISOString(),
    substitutos: [],
  }));
  return {
    id: `r-${idx}`,
    plano_id: "plano-1",
    nome: titulo,
    horario: "12:00",
    ordem: idx,
    observacoes: null,
    criado_em: new Date().toISOString(),
    itens,
  } as unknown as RefeicaoCompleta;
}

/** Cria refeição em modo texto livre com `linhas` parágrafos longos. */
function refeicaoTextoLivre(idx: number, linhas: number): RefeicaoCompleta {
  // Marca de texto livre vem do parseRefeicaoObs; usa o prefixo conhecido.
  // Reaproveitamos a função real para gerar o formato exato.
  const blocos = Array.from(
    { length: linhas },
    (_, i) => `Opção ${i + 1}: arroz integral 100g, frango grelhado 150g, salada à vontade — total aproximado 450 kcal`,
  ).join("\n\n");
  return {
    id: `rtl-${idx}`,
    plano_id: "plano-1",
    nome: "Refeição TL",
    horario: "13:00",
    ordem: idx,
    observacoes: `__livre__\n${blocos}`,
    criado_em: new Date().toISOString(),
    itens: [],
  } as unknown as RefeicaoCompleta;
}

describe("gerarPdfDieta — paginação e título de continuação", () => {
  it("repete a barra 'Refeição N (continuação)' na página 2 ao quebrar refeição estruturada longa", () => {
    // Refeição com itens suficientes para garantir overflow para a 2ª página
    const plano: PlanoCompleto = {
      id: "plano-1",
      aluno_id: "test-id",
      nome: "Plano teste",
      descricao: "3000 kcal | 200g P | 300g C | 80g G",
      dias_semana: ["seg", "ter", "qua", "qui", "sex"],
      status: "ativo",
      template: false,
      cho_g_kg: null,
      ptn_g_kg: null,
      lip_g_kg: null,
      meta_kcal: 3000,
      peso_referencia: 80,
      observacoes: null,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      criado_por: null,
      refeicoes: [refeicaoComN(0, 80, "Café da manhã reforçado")],
    } as unknown as PlanoCompleto;

    const doc = gerarPdfDieta(plano, ALUNO);
    const total = doc.getNumberOfPages();
    expect(total).toBeGreaterThanOrEqual(2);

    const pag2 = dumpPagina(doc, 2);
    // Deve aparecer a barra de continuação com o nome correto
    expect(paginaContem(pag2, "(continua")).toBe(true);
    expect(paginaContem(pag2, "Refei")).toBe(true);
  });

  it("repete a barra 'Refeição N (continuação)' ao quebrar refeição em modo texto livre", () => {
    const plano: PlanoCompleto = {
      id: "plano-1",
      aluno_id: "test-id",
      nome: "Plano teste",
      descricao: null,
      dias_semana: ["seg"],
      status: "ativo",
      template: false,
      cho_g_kg: null,
      ptn_g_kg: null,
      lip_g_kg: null,
      meta_kcal: null,
      peso_referencia: null,
      observacoes: null,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      criado_por: null,
      refeicoes: [refeicaoTextoLivre(0, 50)],
    } as unknown as PlanoCompleto;

    const doc = gerarPdfDieta(plano, ALUNO);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    const pag2 = dumpPagina(doc, 2);
    expect(paginaContem(pag2, "(continua")).toBe(true);
  });

  it("não deixa grandes espaços em branco no fim da página antes de quebrar", () => {
    // Plano com refeição longa que força quebra
    const plano: PlanoCompleto = {
      id: "plano-1",
      aluno_id: "test-id",
      nome: "Plano teste",
      descricao: null,
      dias_semana: ["seg"],
      status: "ativo",
      template: false,
      cho_g_kg: null,
      ptn_g_kg: null,
      lip_g_kg: null,
      meta_kcal: null,
      peso_referencia: null,
      observacoes: null,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      criado_por: null,
      refeicoes: [refeicaoComN(0, 60, "Almoço")],
    } as unknown as PlanoCompleto;

    const doc = gerarPdfDieta(plano, ALUNO);
    const dumps = dumpTodasPaginas(doc);
    // Encontra a maior coordenada Y (em mm) usada por comandos de texto na página 1.
    // jsPDF emite coordenadas em pontos via "x y Td" antes de cada Tj.
    const pag1 = dumps[0];
    const pageHeightPt = doc.internal.pageSize.getHeight() * (72 / 25.4); // mm → pt
    // Captura Y de comandos `... x y Td` (texto posicionado).
    const tdRe = /([\d.]+)\s+([\d.]+)\s+Td/g;
    let m: RegExpExecArray | null;
    let menorY = pageHeightPt; // jsPDF inverte: menor Y = mais embaixo
    while ((m = tdRe.exec(pag1)) !== null) {
      const yPt = Number(m[2]);
      if (yPt < menorY) menorY = yPt;
    }
    // O conteúdo deve chegar próximo do fim da página útil
    // (rodapé fica em ~pageH-8mm ≈ 22.7pt). Aceita até 80pt (~28mm) de folga.
    const folgaPt = menorY; // distância da última linha até o pé da página
    expect(folgaPt).toBeLessThan(80);
  });
});