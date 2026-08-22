import { supabase } from "@/integrations/supabase/client";

// ---- Types matching the new schema ----
export type Food = {
  id: string;
  name: string;
  category: string | null;
  source: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g: number;
  is_fruit: boolean;
  created_by_user: boolean;
};

export type FoodMeasure = {
  id: string;
  food_id: string;
  measure_name: string;          // "Grama", "Unidade", "Porção", etc
  measure_type: string | null;   // "grama" | "unidade" | "porcao" | ...
  grams_equivalent: number;      // gramas por 1 unidade da medida
  display_dropdown: string | null;     // "Unidade (50 g)"
  display_prescription: string | null; // "1 ovo inteiro (50 g)"
  observation: string | null;
  sort_order: number;
  is_default: boolean;
};

export type FruitPortion = {
  id: string;
  food_name: string;
  grams: number;
  reference_kcal: number;
  sort_order: number;
  active: boolean;
};

// Source priority (TACO > TBCA > IBGE > USDA > Meus alimentos)
const SOURCE_RANK: Record<string, number> = {
  TACO: 1, TBCA: 2, IBGE: 3, USDA: 4, "Meus alimentos": 5,
};
export function sourceRank(s: string | null | undefined) {
  if (!s) return 99;
  return SOURCE_RANK[s] ?? 50;
}

// ---- Calculations ----
// Rule: valor_final = valor_100g * grams_equivalent * quantidade / 100
export type Macros = { kcal: number; ptn: number; cho: number; lip: number };

export function calcMacros(food: Food, measure: FoodMeasure, quantidade: number): Macros {
  const totalGrams = (measure.grams_equivalent || 0) * (quantidade || 0);
  const factor = totalGrams / 100;
  return {
    kcal: round1(food.kcal_100g * factor),
    ptn: round1(food.protein_100g * factor),
    cho: round1(food.carbs_100g * factor),
    lip: round1(food.fat_100g * factor),
  };
}

export function totalGrams(measure: FoodMeasure, quantidade: number): number {
  return round1((measure.grams_equivalent || 0) * (quantidade || 0));
}

// Friendly prescription text — alimento primeiro, quantidade/medida depois.
// Exemplos:
// - "Ovo de galinha frito — 2 unidades (100 g)"
// - "Iogurte natural — 1 pote (170 g)"
// - "Maçã — 150 g"
export function buildPrescription(food: Food, measure: FoodMeasure, quantidade: number): string {
  const grams = totalGrams(measure, quantidade);
  const qtd = formatQty(quantidade);
  if (measure.measure_type === "grama") {
    return `${food.name} — ${grams} g`;
  }
  // Limpa qualquer "(50 g)" / "(50g)" do nome da medida para evitar duplicação.
  const medidaLimpa = (measure.measure_name || "")
    .replace(/\s*\(\s*\d+(?:[.,]\d+)?\s*g\s*\)\s*$/i, "")
    .trim();
  const medida = pluralize(medidaLimpa, quantidade);
  return `${food.name} — ${qtd} ${medida} (${grams} g)`;
}

function pluralize(name: string, q: number) {
  if (q <= 1) return name.toLowerCase();
  // crude plural for pt-BR
  const lower = name.toLowerCase();
  if (lower.endsWith("ão")) return lower.slice(0, -2) + "ões";
  if (lower.endsWith("l")) return lower.slice(0, -1) + "is";
  if (lower.endsWith("r") || lower.endsWith("z") || lower.endsWith("s")) return lower + "es";
  return lower + "s";
}

function formatQty(q: number) {
  if (Number.isInteger(q)) return String(q);
  return q.toFixed(2).replace(/\.?0+$/, "");
}

function round1(n: number) { return Math.round(n * 10) / 10; }

// ---- Data access ----
/** Remove acentos, baixa caixa, colapsa espaços. */
export function normalizeText(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchFoods(q: string, limit = 20): Promise<Food[]> {
  const raw = (q || "").trim();
  if (!raw) return [];
  const norm = normalizeText(raw);
  const tokens = norm.split(" ").filter(Boolean);
  if (!tokens.length) return [];

  // Busca acento-insensível usando a coluna `name_normalized` (lowercase + sem acentos),
  // mantida automaticamente por trigger no banco.
  const POOL = 400;
  const { data } = await (supabase as any)
    .from("foods")
    .select("*")
    .ilike("name_normalized", `%${tokens[0]}%`)
    .limit(POOL);
  let pool = (data ?? []) as Food[];

  // Fallback (caso a coluna ainda não esteja populada para algum registro novo).
  if (pool.length === 0) {
    const { data: data2 } = await (supabase as any)
      .from("foods")
      .select("*")
      .ilike("name", `%${raw}%`)
      .limit(POOL);
    pool = (data2 ?? []) as Food[];
  }

  // Filtra: nome normalizado deve conter TODOS os tokens normalizados.
  const matches = pool
    .map((f) => ({ f, n: normalizeText((f as any).name_normalized || f.name) }))
    .filter(({ n }) => tokens.every((t) => n.includes(t)));

  // Ranqueia por relevância:
  // 1) match exato
  // 2) começa com o termo
  // 3) primeiro token aparece como palavra inteira
  // 4) posição do primeiro token (quanto antes, melhor)
  // 5) menor nome (mais específico/limpo)
  // 6) prioridade da fonte
  function score(name: string, source: string | null): number {
    if (name === norm) return 0;
    if (name.startsWith(norm)) return 10;
    const wordRe = new RegExp(`(^|\\s)${escapeRe(tokens[0])}(\\s|$)`);
    if (wordRe.test(name)) return 20;
    const pos = name.indexOf(tokens[0]);
    return 30 + (pos < 0 ? 50 : Math.min(pos, 50)) + sourceRank(source) * 0.1;
  }

  matches.sort((a, b) => {
    const sa = score(a.n, a.f.source);
    const sb = score(b.n, b.f.source);
    if (sa !== sb) return sa - sb;
    const r = sourceRank(a.f.source) - sourceRank(b.f.source);
    if (r !== 0) return r;
    if (a.n.length !== b.n.length) return a.n.length - b.n.length;
    return a.f.name.localeCompare(b.f.name, "pt-BR");
  });

  return matches.slice(0, limit).map((m) => m.f);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function loadMeasures(foodId: string): Promise<FoodMeasure[]> {
  const { data } = await (supabase as any)
    .from("food_measures")
    .select("*")
    .eq("food_id", foodId)
    .order("sort_order", { ascending: true });
  return (data ?? []) as FoodMeasure[];
}

export async function loadFruitPortions(): Promise<FruitPortion[]> {
  const { data } = await (supabase as any)
    .from("fruit_portion_options")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as FruitPortion[];
}

// Resolve fruit kcal-equivalence: a "Porção" of any fruit corresponds to one
// of the 16 standard options. We compute macros from the base fruit at the
// chosen grams, but the UX presents "150 g Maçã" semantics.
export function pickDefaultMeasure(measures: FoodMeasure[]): FoodMeasure | null {
  if (!measures.length) return null;
  return measures.find((m) => m.is_default) ?? measures[0];
}

// ---- Favoritos do nutricionista ----
export type FavoritoSnapshot = {
  alimento_id: string | null;
  nome_custom: string;
  quantidade: number;
  unidade: string;
  kcal: number;
  ptn: number;
  cho: number;
  lip: number;
};

export type Favorito = {
  id: string;
  user_id: string;
  nome: string;
  principal: FavoritoSnapshot;
  substitutos: FavoritoSnapshot[];
  criado_em: string;
};

export async function loadFavoritos(): Promise<Favorito[]> {
  const { data } = await (supabase as any)
    .from("alimento_favoritos")
    .select("*")
    .order("criado_em", { ascending: false });
  return (data ?? []) as Favorito[];
}

export async function saveFavorito(args: {
  nome: string;
  principal: FavoritoSnapshot;
  substitutos: FavoritoSnapshot[];
}): Promise<{ ok: boolean; error?: string }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { ok: false, error: "Usuário não autenticado" };
  const { error } = await (supabase as any).from("alimento_favoritos").insert({
    user_id: uid,
    nome: args.nome,
    principal: args.principal,
    substitutos: args.substitutos,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteFavorito(id: string): Promise<boolean> {
  const { error } = await (supabase as any).from("alimento_favoritos").delete().eq("id", id);
  return !error;
}

export async function renameFavorito(id: string, nome: string): Promise<boolean> {
  const { error } = await (supabase as any)
    .from("alimento_favoritos")
    .update({ nome })
    .eq("id", id);
  return !error;
}
