import type { Database } from "@/integrations/supabase/types";

export type DietaPlano = Database["public"]["Tables"]["dieta_planos"]["Row"];
export type DietaRefeicao = Database["public"]["Tables"]["dieta_refeicoes"]["Row"];
export type DietaItem = Database["public"]["Tables"]["dieta_itens"]["Row"];
export type Alimento = Database["public"]["Tables"]["alimentos"]["Row"];

/** Substituto de um item de refeição (alternativa equivalente). */
export type ItemSub = {
  id: string;
  item_id: string;
  alimento_id: string | null;
  nome_custom: string | null;
  quantidade: number;
  unidade: string;
  kcal: number;
  ptn: number;
  cho: number;
  lip: number;
  ordem: number;
  criado_em?: string;
};

export type DietaItemComSubs = DietaItem & { substitutos: ItemSub[] };
export type RefeicaoCompleta = DietaRefeicao & { itens: DietaItemComSubs[] };
export type PlanoCompleto = DietaPlano & { refeicoes: RefeicaoCompleta[] };

export type Macros = { kcal: number; ptn: number; cho: number; lip: number };

export const ZERO: Macros = { kcal: 0, ptn: 0, cho: 0, lip: 0 };

export const DIAS = [
  { v: "seg", l: "Seg" }, { v: "ter", l: "Ter" }, { v: "qua", l: "Qua" },
  { v: "qui", l: "Qui" }, { v: "sex", l: "Sex" }, { v: "sab", l: "Sáb" }, { v: "dom", l: "Dom" },
] as const;

/** Calcula macros a partir de um alimento (por 100g) e quantidade em g/ml. */
export function calcMacrosFromAlimento(a: Alimento, quantidade: number): Macros {
  const f = quantidade / 100;
  return {
    kcal: round1(a.kcal_100 * f),
    ptn: round1(a.ptn_100 * f),
    cho: round1(a.cho_100 * f),
    lip: round1(a.lip_100 * f),
  };
}

export function somaItens(itens: DietaItem[]): Macros {
  return itens.reduce<Macros>(
    (acc, i) => ({
      kcal: acc.kcal + Number(i.kcal || 0),
      ptn: acc.ptn + Number(i.ptn || 0),
      cho: acc.cho + Number(i.cho || 0),
      lip: acc.lip + Number(i.lip || 0),
    }),
    { ...ZERO },
  );
}

export function somaRefeicao(r: RefeicaoCompleta): Macros {
  return somaItens(r.itens);
}

export function somaPlano(p: PlanoCompleto): Macros {
  return p.refeicoes.reduce<Macros>(
    (acc, r) => {
      // Refeições em modo "texto livre" não contam nas somas
      if (parseRefeicaoObs(r.observacoes).modo === "texto_livre") return acc;
      const s = somaRefeicao(r);
      return {
        kcal: acc.kcal + s.kcal,
        ptn: acc.ptn + s.ptn,
        cho: acc.cho + s.cho,
        lip: acc.lip + s.lip,
      };
    },
    { ...ZERO },
  );
}

export type ValidacaoSinal = {
  tipo: "incompleta" | "nao_validado" | "fora_meta" | "pronto";
  msg: string;
  level: "warn" | "info" | "ok";
};

export function validarPlano(p: PlanoCompleto): ValidacaoSinal[] {
  const out: ValidacaoSinal[] = [];
  const vazias = p.refeicoes.filter(
    (r) => r.itens.length === 0 && parseRefeicaoObs(r.observacoes).modo !== "texto_livre",
  ).length;
  if (vazias > 0) out.push({ tipo: "incompleta", msg: `${vazias} refeição(ões) sem itens`, level: "warn" });
  const naoVal = p.refeicoes.flatMap((r) => r.itens).filter((i) => !i.alimento_id).length;
  if (p.meta_kcal) {
    const total = somaPlano(p).kcal;
    const desvio = Math.abs(total - p.meta_kcal) / p.meta_kcal;
    if (desvio > 0.12) out.push({ tipo: "fora_meta", msg: `Macros ${(desvio * 100).toFixed(0)}% fora da meta`, level: "warn" });
  }
  if (out.length === 0 && p.refeicoes.length > 0 && naoVal === 0) {
    out.push({ tipo: "pronto", msg: "Pronto para salvar", level: "ok" });
  }
  return out;
}

export function fmtMacro(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function gPerKg(total: number, peso: number | null | undefined): string {
  if (!peso || peso <= 0) return "—";
  return (total / peso).toFixed(2);
}

/* ---------------- Texto livre por refeição ---------------- */

const PREFIXO_TEXTO_LIVRE = "[modo:texto_livre]";
const SEP_OBS = "---obs---";

export type RefeicaoObsParsed = {
  modo: "estruturado" | "texto_livre";
  conteudo: string;
  observacao: string;
};

export function parseRefeicaoObs(obs: string | null | undefined): RefeicaoObsParsed {
  const raw = (obs ?? "").trim();
  if (!raw.startsWith(PREFIXO_TEXTO_LIVRE)) {
    return { modo: "estruturado", conteudo: "", observacao: raw };
  }
  const semPrefixo = raw.slice(PREFIXO_TEXTO_LIVRE.length).replace(/^\r?\n/, "");
  const idx = semPrefixo.indexOf(SEP_OBS);
  if (idx === -1) {
    return { modo: "texto_livre", conteudo: semPrefixo, observacao: "" };
  }
  const conteudo = semPrefixo.slice(0, idx).replace(/\r?\n$/, "");
  const observacao = semPrefixo.slice(idx + SEP_OBS.length).replace(/^\r?\n/, "");
  return { modo: "texto_livre", conteudo, observacao };
}

export function serializeRefeicaoObs(modo: "estruturado" | "texto_livre", conteudo: string, observacao: string): string | null {
  if (modo === "estruturado") {
    const v = (observacao ?? "").trim();
    return v.length ? v : null;
  }
  return `${PREFIXO_TEXTO_LIVRE}\n${conteudo ?? ""}\n${SEP_OBS}\n${observacao ?? ""}`;
}

/* ---------------- Modo do plano (calculado vs texto livre) ---------------- */

const PREFIXO_PLANO_LIVRE = "[modo:texto_livre]";
const SEP_PLANO = "---";
const TOTAIS_RE = /^kcal=(-?\d+(?:\.\d+)?);ptn=(-?\d+(?:\.\d+)?);cho=(-?\d+(?:\.\d+)?);lip=(-?\d+(?:\.\d+)?)$/;

export type ModoPlano = "calculado" | "texto_livre";
export type TotaisManuais = { kcal: number; ptn: number; cho: number; lip: number };

export type PlanoDescricaoParsed = {
  modo: ModoPlano;
  descricao: string;
  totaisManuais: TotaisManuais;
};

export function parsePlanoDescricao(d: string | null | undefined): PlanoDescricaoParsed {
  const raw = (d ?? "").trim();
  if (!raw.startsWith(PREFIXO_PLANO_LIVRE)) {
    return { modo: "calculado", descricao: raw, totaisManuais: { kcal: 0, ptn: 0, cho: 0, lip: 0 } };
  }
  const semPrefixo = raw.slice(PREFIXO_PLANO_LIVRE.length).replace(/^\r?\n/, "");
  // Primeira linha pode conter os totais
  const firstNl = semPrefixo.indexOf("\n");
  let totaisLine = "";
  let resto = semPrefixo;
  if (firstNl !== -1) {
    totaisLine = semPrefixo.slice(0, firstNl).trim();
    resto = semPrefixo.slice(firstNl + 1);
  } else {
    totaisLine = semPrefixo.trim();
    resto = "";
  }
  const m = totaisLine.match(TOTAIS_RE);
  const totaisManuais: TotaisManuais = m
    ? { kcal: Number(m[1]), ptn: Number(m[2]), cho: Number(m[3]), lip: Number(m[4]) }
    : { kcal: 0, ptn: 0, cho: 0, lip: 0 };
  // Se a primeira linha não bateu, devolve tudo como descrição
  if (!m) {
    return { modo: "texto_livre", descricao: semPrefixo.replace(/^\r?\n/, "").trim(), totaisManuais };
  }
  // Espera separador "---" antes da descrição original
  const idxSep = resto.indexOf(SEP_PLANO);
  const descricao = idxSep === -1
    ? resto.trim()
    : resto.slice(idxSep + SEP_PLANO.length).replace(/^\r?\n/, "").trim();
  return { modo: "texto_livre", descricao, totaisManuais };
}

export function serializePlanoDescricao(modo: ModoPlano, descricao: string, totais?: TotaisManuais): string | null {
  if (modo === "calculado") {
    const v = (descricao ?? "").trim();
    return v.length ? v : null;
  }
  const t = totais ?? { kcal: 0, ptn: 0, cho: 0, lip: 0 };
  const totaisLine = `kcal=${t.kcal};ptn=${t.ptn};cho=${t.cho};lip=${t.lip}`;
  return `${PREFIXO_PLANO_LIVRE}\n${totaisLine}\n${SEP_PLANO}\n${(descricao ?? "").trim()}`;
}

/**
 * Tenta extrair os totais de macros (kcal, ptn, cho, lip) diretamente do texto
 * livre da descrição do plano. Retorna `null` se nada for detectável.
 * Reconhece padrões comuns como:
 *  - "1362 kcal", "1.362 kcal", "1,362 kcal"
 *  - "134g P" / "134.0g P" / "P 134g" / "134g PTN" / "Proteína 134g"
 *  - idem para CHO (C/Carb/Carboidrato) e LIP (G/Gordura)
 */
export function extrairMacrosDeDescricao(desc: string | null | undefined): TotaisManuais | null {
  const raw = (desc ?? "").trim();
  if (!raw) return null;
  const txt = raw.replace(/\s+/g, " ");

  // kcal: aceita 1.362, 1,362 ou 1362 + "kcal" (em qualquer caixa)
  const kcalMatch = txt.match(/(\d{1,3}(?:[.,]\d{3})*|\d+)(?:[.,]\d+)?\s*kcal\b/i);
  let kcal = 0;
  if (kcalMatch) {
    const num = kcalMatch[1].replace(/[.,]/g, "");
    kcal = Number(num) || 0;
  }

  // Macros: tenta "<num>g <letra>" e "<letra> <num>g"
  // letras possíveis: P|PTN|Proteina, C|CHO|Carb|Carboidrato, G|LIP|Gordura
  const grupos: Array<{ key: keyof TotaisManuais; pat: RegExp[] }> = [
    {
      key: "ptn",
      pat: [
        /(\d+(?:[.,]\d+)?)\s*g\s*(?:p\b|ptn\b|prote[íi]na?s?)/i,
        /(?:p\b|ptn\b|prote[íi]na?s?)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*g/i,
      ],
    },
    {
      key: "cho",
      pat: [
        /(\d+(?:[.,]\d+)?)\s*g\s*(?:c\b|cho\b|carb(?:o(?:idratos?)?)?)/i,
        /(?:c\b|cho\b|carb(?:o(?:idratos?)?)?)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*g/i,
      ],
    },
    {
      key: "lip",
      pat: [
        /(\d+(?:[.,]\d+)?)\s*g\s*(?:g\b|lip\b|gordura?s?)/i,
        /(?:lip\b|gordura?s?)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*g/i,
      ],
    },
  ];
  const out: TotaisManuais = { kcal, ptn: 0, cho: 0, lip: 0 };
  let achou = !!kcalMatch;
  for (const g of grupos) {
    for (const re of g.pat) {
      const m = txt.match(re);
      if (m) {
        out[g.key] = Number(m[1].replace(",", ".")) || 0;
        achou = true;
        break;
      }
    }
  }
  return achou ? out : null;
}

/* ---------------- parseDietDescription ---------------- */

export type MacroParsed = {
  grams: number;
  gPerKg: number | null;
  percentage: number;
};

export type DietDescriptionParsed = {
  calories: number;
  protein: MacroParsed;
  carbs: MacroParsed;
  fats: MacroParsed;
};

const EMPTY_MACRO: MacroParsed = { grams: 0, gPerKg: null, percentage: 0 };

/**
 * Lê a descrição livre da dieta e extrai kcal totais e macros (g, g/kg, %).
 * Aceita formatos como:
 *   "2.400 kcal | PTN 248g (3,1 g/kg) | CHO 238g | LIP 53g"
 *   "1500kcal - Proteína 120g - Carboidrato 180g - Gordura 50g"
 *   "P: 134g (1.8g/kg)  C: 200g  G: 60g"
 */
export function parseDietDescription(
  description: string | null | undefined,
  studentWeight?: number | null,
): DietDescriptionParsed {
  const raw = (description ?? "").trim();
  const out: DietDescriptionParsed = {
    calories: 0,
    protein: { ...EMPTY_MACRO },
    carbs: { ...EMPTY_MACRO },
    fats: { ...EMPTY_MACRO },
  };
  if (!raw) return out;

  const txt = raw.replace(/\s+/g, " ");
  const peso = studentWeight && studentWeight > 0 ? studentWeight : null;

  // 1) kcal total
  const kcalMatch = txt.match(/(\d{1,3}(?:[.,]\d{3})*|\d+)(?:[.,]\d+)?\s*kcal\b/i);
  if (kcalMatch) {
    const num = kcalMatch[1].replace(/[.,]/g, "");
    out.calories = Number(num) || 0;
  }

  // 2) macros: gramas + opcional (X g/kg)
  const grupos: Array<{ key: "protein" | "carbs" | "fats"; pat: RegExp[] }> = [
    {
      key: "protein",
      pat: [
        /(?:p\b|ptn\b|prote[íi]na?s?)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*g(?:\s*\(\s*(\d+(?:[.,]\d+)?)\s*g\s*\/\s*kg\s*\))?/i,
        /(\d+(?:[.,]\d+)?)\s*g\s*(?:p\b|ptn\b|prote[íi]na?s?)(?:\s*\(\s*(\d+(?:[.,]\d+)?)\s*g\s*\/\s*kg\s*\))?/i,
      ],
    },
    {
      key: "carbs",
      pat: [
        /(?:c\b|cho\b|carb(?:o(?:idratos?)?)?)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*g(?:\s*\(\s*(\d+(?:[.,]\d+)?)\s*g\s*\/\s*kg\s*\))?/i,
        /(\d+(?:[.,]\d+)?)\s*g\s*(?:c\b|cho\b|carb(?:o(?:idratos?)?)?)(?:\s*\(\s*(\d+(?:[.,]\d+)?)\s*g\s*\/\s*kg\s*\))?/i,
      ],
    },
    {
      key: "fats",
      pat: [
        /(?:lip\b|gordura?s?)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*g(?:\s*\(\s*(\d+(?:[.,]\d+)?)\s*g\s*\/\s*kg\s*\))?/i,
        /(\d+(?:[.,]\d+)?)\s*g\s*(?:g\b|lip\b|gordura?s?)(?:\s*\(\s*(\d+(?:[.,]\d+)?)\s*g\s*\/\s*kg\s*\))?/i,
      ],
    },
  ];

  for (const g of grupos) {
    for (const re of g.pat) {
      const m = txt.match(re);
      if (m) {
        const gramas = Number(m[1].replace(",", ".")) || 0;
        const gkgTexto = m[2] ? Number(m[2].replace(",", ".")) : null;
        out[g.key] = {
          grams: gramas,
          gPerKg: gkgTexto ?? (peso ? round2(gramas / peso) : null),
          percentage: 0,
        };
        break;
      }
    }
  }

  // 4) calcular kcal se não veio no texto
  const kcalPtn = out.protein.grams * 4;
  const kcalCho = out.carbs.grams * 4;
  const kcalLip = out.fats.grams * 9;
  const kcalCalc = kcalPtn + kcalCho + kcalLip;
  if (out.calories === 0 && kcalCalc > 0) {
    out.calories = Math.round(kcalCalc);
  }

  // 5) percentuais calóricos (sobre soma dos macros)
  const base = kcalCalc > 0 ? kcalCalc : 1;
  if (out.protein.grams > 0) out.protein.percentage = Math.round((kcalPtn / base) * 100);
  if (out.carbs.grams > 0) out.carbs.percentage = Math.round((kcalCho / base) * 100);
  if (out.fats.grams > 0) out.fats.percentage = Math.round((kcalLip / base) * 100);

  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
