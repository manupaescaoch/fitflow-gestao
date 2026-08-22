import type { RefeicaoIA } from "@/components/aluno/dieta/modals/ImportarTextoModal";

const KEYWORDS = [
  "café", "cafe", "almoço", "almoco", "lanche", "jantar", "ceia",
  "refeição", "refeicao", "pré-treino", "pre-treino", "pré treino", "pre treino",
  "pós-treino", "pos-treino", "pós treino", "pos treino",
  "desjejum", "colação", "colacao", "ceia",
];

const HORARIO_RE = /(\d{1,2})\s*[h:]\s*(\d{0,2})/i;
const OPCAO_RE = /^op[cç][ãa]o\b/i;
const IGNORE_RE = /^(total|totais|macros)\b/i;

function isCabecalhoRefeicao(linha: string): boolean {
  if (linha.length > 60) return false;
  const lower = linha.toLowerCase();
  if (KEYWORDS.some((k) => lower.includes(k))) return true;
  if (HORARIO_RE.test(linha) && linha.split(/\s+/).length <= 8) return true;
  return false;
}

function extrairHorario(linha: string): string | null {
  const m = linha.match(HORARIO_RE);
  if (!m) return null;
  const h = m[1].padStart(2, "0");
  const min = (m[2] || "00").padStart(2, "0");
  return `${h}:${min}`;
}

function limparNomeRefeicao(linha: string): string {
  // Remove horário e separadores comuns no final
  let s = linha.replace(HORARIO_RE, "").trim();
  s = s.replace(/[-—–:]+\s*$/, "").trim();
  s = s.replace(/^\s*[-—–]+/, "").trim();
  return s || linha.trim();
}

export function parseTextoDieta(texto: string): RefeicaoIA[] {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const refeicoes: RefeicaoIA[] = [];
  let atual: RefeicaoIA | null = null;
  // Buffer da opção atual: null = itens principais; array = opção alternativa em construção
  let opcaoAtual: Array<RefeicaoIA["itens"][number]> | null = null;

  function novoItem(nome: string): RefeicaoIA["itens"][number] {
    return { nome, quantidade: 0, unidade: "", kcal: 0, ptn: 0, cho: 0, lip: 0 };
  }

  for (const linha of linhas) {
    if (IGNORE_RE.test(linha)) continue;

    if (isCabecalhoRefeicao(linha)) {
      const horario = extrairHorario(linha);
      const nome = limparNomeRefeicao(linha) || `Refeição ${refeicoes.length + 1}`;
      atual = { nome, horario, observacoes: null, itens: [], opcoes: [] };
      opcaoAtual = null;
      refeicoes.push(atual);
      continue;
    }

    if (!atual) {
      atual = { nome: `Refeição ${refeicoes.length + 1}`, horario: null, observacoes: null, itens: [], opcoes: [] };
      opcaoAtual = null;
      refeicoes.push(atual);
    }

    if (OPCAO_RE.test(linha)) {
      // Primeira "Opção" preenche os itens principais se vazios; demais viram opcoes[]
      if (atual.itens.length === 0 && (!atual.opcoes || atual.opcoes.length === 0)) {
        opcaoAtual = null; // próximos itens vão para itens principais
      } else {
        opcaoAtual = [];
        atual.opcoes!.push(opcaoAtual);
      }
      continue;
    }

    const item = novoItem(linha);
    if (opcaoAtual) opcaoAtual.push(item);
    else atual.itens.push(item);
  }

  // Limpa opcoes vazias
  return refeicoes.map((r) => ({
    ...r,
    opcoes: (r.opcoes ?? []).filter((op) => op.length > 0),
  }));
}
