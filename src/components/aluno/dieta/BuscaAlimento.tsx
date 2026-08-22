import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Loader2, ChevronDown, Check, Star, X, Trash2, Pencil } from "lucide-react";
import {
  searchFoods, loadMeasures, loadFruitPortions, calcMacros, totalGrams,
  buildPrescription, pickDefaultMeasure, saveFavorito,
  type Food, type FoodMeasure, type FruitPortion, type Favorito, type FavoritoSnapshot,
} from "@/lib/foods";
import { FavoritosModal } from "./modals/FavoritosModal";
import { toast } from "sonner";

export type NovoItem = {
  alimento_id: string | null;
  nome_custom: string;
  quantidade: number;
  unidade: string;
  kcal: number; ptn: number; cho: number; lip: number;
};

export type NovoItemComSubs = NovoItem & { substitutos: NovoItem[] };

export function BuscaAlimento({
  onAdd,
  initialSubstitutos,
  initialPrincipal,
  hideFavoritos,
}: {
  /** Called when the user finalizes (principal + optional substitutos). */
  onAdd: (item: NovoItemComSubs) => void;
  initialSubstitutos?: NovoItem[];
  initialPrincipal?: NovoItem;
  hideFavoritos?: boolean;
}) {
  // Search state
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [openList, setOpenList] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Selection state
  const [food, setFood] = useState<Food | null>(null);
  const [measures, setMeasures] = useState<FoodMeasure[]>([]);
  const [measure, setMeasure] = useState<FoodMeasure | null>(null);
  const [qtd, setQtd] = useState<number>(1);

  // Fruit-portion state (when measure_type = "porcao" on a fruit)
  const [fruitPortions, setFruitPortions] = useState<FruitPortion[]>([]);
  const [pickedFruit, setPickedFruit] = useState<FruitPortion | null>(null);

  // Step 2 — substitutos
  const [stage, setStage] = useState<"search" | "subs">(initialPrincipal ? "subs" : "search");
  const [principal, setPrincipal] = useState<NovoItem | null>(initialPrincipal ?? null);
  const [substitutos, setSubstitutos] = useState<NovoItem[]>(initialSubstitutos ?? []);
  const [addingSub, setAddingSub] = useState(false);
  const [openFavs, setOpenFavs] = useState(false);

  // Edição inline da quantidade do principal (no stage "subs")
  const [editPrincQtd, setEditPrincQtd] = useState(false);
  const [principQtdDraft, setPrincQtdDraft] = useState<string>("");

  function startEditPrincQtd() {
    if (!principal) return;
    setPrincQtdDraft(String(principal.quantidade));
    setEditPrincQtd(true);
  }

  function savePrincQtd() {
    if (!principal) { setEditPrincQtd(false); return; }
    const q = Number(principQtdDraft);
    if (!Number.isFinite(q) || q < 0) { setEditPrincQtd(false); return; }
    if (q === principal.quantidade) { setEditPrincQtd(false); return; }
    const fator = principal.quantidade > 0 ? q / principal.quantidade : 1;
    const r = (n: number) => Math.round(n * 10) / 10;
    setPrincipal({
      ...principal,
      quantidade: q,
      kcal: r(principal.kcal * fator),
      ptn: r(principal.ptn * fator),
      cho: r(principal.cho * fator),
      lip: r(principal.lip * fator),
    });
    setEditPrincQtd(false);
  }

  // Search debounce
  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const list = await searchFoods(q, 25);
      setResults(list);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  // Click outside to close list
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenList(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Load measures when food picked
  useEffect(() => {
    if (!food) { setMeasures([]); setMeasure(null); return; }
    void (async () => {
      const ms = await loadMeasures(food.id);
      setMeasures(ms);
      const def = pickDefaultMeasure(ms);
      setMeasure(def);
      setQtd(def?.measure_type === "grama" ? 100 : 1);
    })();
  }, [food]);

  // Load fruit portions if measure is "porcao" on a fruit
  useEffect(() => {
    if (!food?.is_fruit || measure?.measure_type !== "porcao") {
      setFruitPortions([]); setPickedFruit(null); return;
    }
    void (async () => {
      const list = await loadFruitPortions();
      setFruitPortions(list);
    })();
  }, [food, measure]);

  // Live preview macros
  const preview = useMemo(() => {
    if (!food || !measure) return null;
    return { macros: calcMacros(food, measure, qtd), grams: totalGrams(measure, qtd) };
  }, [food, measure, qtd]);

  function pick(f: Food) { setFood(f); setOpenList(false); setQ(""); }

  function resetSelection() {
    setQ(""); setResults([]); setOpenList(false);
    setFood(null); setMeasures([]); setMeasure(null); setQtd(1);
    setFruitPortions([]); setPickedFruit(null);
  }

  function resetAll() {
    resetSelection();
    setStage("search");
    setPrincipal(null);
    setSubstitutos([]);
    setAddingSub(false);
  }

  function buildItem(): NovoItem | null {
    if (!food || !measure) return null;
    const m = calcMacros(food, measure, qtd);
    const grams = totalGrams(measure, qtd);
    let nome = buildPrescription(food, measure, qtd);
    if (pickedFruit) {
      nome = `${pickedFruit.grams} g de ${pickedFruit.food_name}`;
    }
    return {
      alimento_id: null,
      nome_custom: nome,
      quantidade: pickedFruit ? pickedFruit.grams : grams,
      unidade: "g",
      ...m,
    };
  }

  /** From search step: confirm the principal alimento and move to substitutos step. */
  function confirmPrincipal() {
    const it = buildItem();
    if (!it) return;
    setPrincipal(it);
    setStage("subs");
    resetSelection();
  }

  /** From inline-search inside subs step: confirm a single substituto. */
  function confirmSubstituto() {
    const it = buildItem();
    if (!it) return;
    setSubstitutos((prev) => [...prev, it]);
    setAddingSub(false);
    resetSelection();
  }

  function removeSub(idx: number) {
    setSubstitutos((prev) => prev.filter((_, i) => i !== idx));
  }

  function commit() {
    if (!principal) return;
    onAdd({ ...principal, substitutos });
    resetAll();
  }

  async function handleSaveFav() {
    if (!principal) return;
    const nome = window.prompt("Nome do favorito:", principal.nome_custom);
    if (!nome || !nome.trim()) return;
    const snap = (i: NovoItem): FavoritoSnapshot => ({
      alimento_id: i.alimento_id,
      nome_custom: i.nome_custom,
      quantidade: i.quantidade,
      unidade: i.unidade,
      kcal: i.kcal, ptn: i.ptn, cho: i.cho, lip: i.lip,
    });
    const res = await saveFavorito({
      nome: nome.trim(),
      principal: snap(principal),
      substitutos: substitutos.map(snap),
    });
    if (res.ok) toast.success("Favorito salvo");
    else toast.error(res.error ?? "Erro ao salvar favorito");
  }

  function loadFromFav(fav: Favorito) {
    const toItem = (s: FavoritoSnapshot): NovoItem => ({
      alimento_id: s.alimento_id,
      nome_custom: s.nome_custom,
      quantidade: s.quantidade,
      unidade: s.unidade || "g",
      kcal: s.kcal, ptn: s.ptn, cho: s.cho, lip: s.lip,
    });
    setPrincipal(toItem(fav.principal));
    setSubstitutos((fav.substitutos ?? []).map(toItem));
    setStage("subs");
    resetSelection();
  }

  // ====== STAGE: substitutos ======
  if (stage === "subs" && principal) {
    return (
      <>
        <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-3 shadow-sm">
          {/* Principal confirmado */}
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Principal
              </div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">{principal.nome_custom}</div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {editPrincQtd ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      step="0.1"
                      min={0}
                      value={principQtdDraft}
                      onChange={(e) => setPrincQtdDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") savePrincQtd();
                        if (e.key === "Escape") setEditPrincQtd(false);
                      }}
                      autoFocus
                      className="w-20 px-1.5 py-0.5 rounded border border-border text-xs bg-background tabular-nums"
                    />
                    <span className="text-[11px] text-muted-foreground">{principal.unidade}</span>
                    <button
                      onClick={savePrincQtd}
                      className="p-0.5 rounded hover:bg-emerald-50 text-emerald-600"
                      title="Confirmar"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditPrincQtd(false)}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                      title="Cancelar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startEditPrincQtd}
                    className="inline-flex items-center gap-1 text-[11px] tabular-nums px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary transition"
                    title="Ajustar medida"
                  >
                    <span className="font-medium">{principal.quantidade}</span>
                    <span className="text-muted-foreground">{principal.unidade}</span>
                    <Pencil className="w-3 h-3 opacity-60" />
                  </button>
                )}
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  · {Math.round(principal.kcal)} kcal · P {principal.ptn}g · C {principal.cho}g · G {principal.lip}g
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { resetSelection(); setPrincipal(null); setStage("search"); }}
                className="text-[11px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:border-primary hover:text-primary transition"
                title="Trocar alimento"
              >
                Trocar alimento
              </button>
              <button onClick={resetAll} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="Cancelar">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Lista de substitutos */}
          {substitutos.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">Substitutos equivalentes</div>
              {substitutos.map((s, idx) => (
                <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 italic">ou</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-700 truncate">{s.nome_custom}</div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      {Math.round(s.kcal)} kcal · P {s.ptn} · C {s.cho} · G {s.lip}
                    </div>
                  </div>
                  <button onClick={() => removeSub(idx)} className="p-1 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Inline: adicionar substituto */}
          {addingSub ? (
            <div className="rounded-lg bg-muted/30 border border-border p-2 space-y-2">
              <div className="text-[11px] text-muted-foreground font-medium">Buscar substituto…</div>
              {food ? (
                <SelectionEditor
                  food={food}
                  measures={measures}
                  measure={measure}
                  setMeasure={setMeasure}
                  qtd={qtd}
                  setQtd={setQtd}
                  fruitPortions={fruitPortions}
                  pickedFruit={pickedFruit}
                  setPickedFruit={setPickedFruit}
                  preview={preview}
                  onCancel={() => { resetSelection(); setAddingSub(false); }}
                  onConfirm={confirmSubstituto}
                  ctaLabel="Adicionar substituto"
                />
              ) : (
                <SearchInput
                  q={q} setQ={setQ}
                  loading={loading}
                  openList={openList} setOpenList={setOpenList}
                  results={results}
                  ref={ref}
                  onPick={pick}
                />
              )}
            </div>
          ) : (
            <button
              onClick={() => setAddingSub(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-sm text-slate-600 hover:bg-slate-50 hover:border-rose-300 hover:text-rose-600 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar substituto
            </button>
          )}

          {/* Ações finais */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {!hideFavoritos && (
              <button
                onClick={handleSaveFav}
                className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2 py-1 rounded transition"
                title="Salvar como favorito"
              >
                <Star className="w-3.5 h-3.5" /> Salvar como favorito
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={resetAll} className="px-3 py-1.5 rounded text-sm hover:bg-muted">Cancelar</button>
              <button
                onClick={commit}
                className="px-4 py-1.5 rounded bg-primary text-white text-sm font-semibold hover:bg-primary/90"
              >
                Salvar alimento
              </button>
            </div>
          </div>
        </div>
        <FavoritosModal open={openFavs} onClose={() => setOpenFavs(false)} onPick={loadFromFav} />
      </>
    );
  }

  // Render: when a food is selected, the inline editor takes over
  if (food) {
    return (
      <>
        <SelectionEditor
          food={food}
          measures={measures}
          measure={measure}
          setMeasure={setMeasure}
          qtd={qtd}
          setQtd={setQtd}
          fruitPortions={fruitPortions}
          pickedFruit={pickedFruit}
          setPickedFruit={setPickedFruit}
          preview={preview}
          onCancel={resetSelection}
          onConfirm={confirmPrincipal}
          ctaLabel="Adicionar"
        />
        <FavoritosModal open={openFavs} onClose={() => setOpenFavs(false)} onPick={loadFromFav} />
      </>
    );
  }

  // Search input with results dropdown
  return (
    <>
      <div className="space-y-2">
        <SearchInput
          q={q} setQ={setQ}
          loading={loading}
          openList={openList} setOpenList={setOpenList}
          results={results}
          ref={ref}
          onPick={pick}
        />
        {!hideFavoritos && (
          <button
            type="button"
            onClick={() => setOpenFavs(true)}
            className="inline-flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 px-2 py-0.5 rounded transition"
          >
            <Star className="w-3 h-3" /> Carregar favorito
          </button>
        )}
      </div>
      <FavoritosModal open={openFavs} onClose={() => setOpenFavs(false)} onPick={loadFromFav} />
    </>
  );
}

/* ----------------- subcomponents ----------------- */

import { forwardRef } from "react";

type SearchInputProps = {
  q: string; setQ: (s: string) => void;
  loading: boolean;
  openList: boolean; setOpenList: (b: boolean) => void;
  results: Food[];
  onPick: (f: Food) => void;
};

const SearchInput = forwardRef<HTMLDivElement, SearchInputProps>(function SearchInput(
  { q, setQ, loading, openList, setOpenList, results, onPick }, ref,
) {
  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-rose-100 focus-within:border-rose-300 transition shadow-sm">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpenList(true); }}
          onFocus={() => setOpenList(true)}
          placeholder="Digite para buscar um alimento…"
          className="flex-1 outline-none text-sm bg-transparent placeholder:text-slate-400"
        />
        {q && !loading && (
          <button
            type="button"
            onClick={() => { setQ(""); setOpenList(false); }}
            className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Limpar busca"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openList && q.trim() ? "rotate-180" : ""}`} />
      </div>
      {openList && q.trim() && (
        <div className="nice-scroll absolute left-0 right-0 top-full mt-1.5 z-30 rounded-xl bg-white border border-slate-200 shadow-xl max-h-[60vh] min-h-[8rem] overflow-y-auto overscroll-contain py-1">
          {results.length === 0 && !loading ? (
            <div className="px-4 py-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5 text-amber-700 font-semibold mb-0.5">
                <Plus className="w-3.5 h-3.5 rotate-45" /> Nenhum alimento encontrado
              </div>
              <div>Tente outro termo ou verifique a ortografia.</div>
            </div>
          ) : (
            results.map((f) => (
              <button
                key={f.id}
                onClick={() => onPick(f)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-rose-50/60 focus:bg-rose-50/60 outline-none flex items-center justify-between gap-3 group transition"
              >
                <span className="flex items-baseline gap-1.5 min-w-0 flex-1">
                  <span className="truncate text-slate-800 group-hover:text-rose-700 font-medium">{f.name}</span>
                  {f.source && (
                    <span className="shrink-0 text-xs text-slate-400 font-normal">
                      ({f.source})
                    </span>
                  )}
                  {f.is_fruit && (
                    <span className="shrink-0 text-[11px]" title="Fruta">🍎</span>
                  )}
                </span>
                <span className="text-[11px] text-slate-400 tabular-nums shrink-0 group-hover:text-slate-600">
                  {Math.round(f.kcal_100g)} kcal/100g
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
});

function SelectionEditor({
  food, measures, measure, setMeasure, qtd, setQtd,
  fruitPortions, pickedFruit, setPickedFruit, preview,
  onCancel, onConfirm, ctaLabel,
}: {
  food: Food;
  measures: FoodMeasure[];
  measure: FoodMeasure | null;
  setMeasure: (m: FoodMeasure | null) => void;
  qtd: number;
  setQtd: (n: number) => void;
  fruitPortions: FruitPortion[];
  pickedFruit: FruitPortion | null;
  setPickedFruit: (p: FruitPortion | null) => void;
  preview: { macros: { kcal: number; ptn: number; cho: number; lip: number }; grams: number } | null;
  onCancel: () => void;
  onConfirm: () => void;
  ctaLabel: string;
}) {
  const isPorcaoFruta = food.is_fruit && measure?.measure_type === "porcao";
  return (
    <div className="rounded-xl bg-muted/40 border border-border p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <div className="text-xs text-muted-foreground">Alimento</div>
          <div className="text-sm font-medium truncate">{food.name}</div>
          {food.source && (
            <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              {food.source}
            </span>
          )}
        </div>
        <div className="min-w-[170px]">
          <div className="text-xs text-muted-foreground mb-0.5">Medida</div>
          <div className="relative">
            <select
              value={measure?.id ?? ""}
              onChange={(e) => {
                const m = measures.find((x) => x.id === e.target.value) ?? null;
                setMeasure(m);
                setQtd(m?.measure_type === "grama" ? 100 : 1);
                setPickedFruit(null);
              }}
              className="w-full appearance-none px-2.5 py-1.5 pr-7 rounded border border-border text-sm bg-background max-h-48"
            >
              {measures.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_dropdown ?? m.measure_name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        {!isPorcaoFruta && (
          <div className="w-24">
            <div className="text-xs text-muted-foreground mb-0.5">Qtd.</div>
            <input
              type="number"
              step="0.1"
              min={0}
              value={qtd}
              onChange={(e) => setQtd(Number(e.target.value) || 0)}
              onKeyDown={(e) => { if (e.key === "Enter") onConfirm(); if (e.key === "Escape") onCancel(); }}
              className="w-full px-2 py-1.5 rounded border border-border text-sm bg-background tabular-nums"
              autoFocus
            />
          </div>
        )}
      </div>
      {isPorcaoFruta && (
        <div className="rounded-lg bg-background border border-border p-2.5">
          <div className="text-xs text-muted-foreground mb-1.5">
            Cada porção de fruta (76 kcal) corresponde a uma das opções abaixo:
          </div>
          <div className="max-h-44 overflow-auto rounded border border-border divide-y divide-border">
            {fruitPortions.map((fp) => {
              const active = pickedFruit?.id === fp.id;
              return (
                <button
                  key={fp.id}
                  onClick={() => setPickedFruit(fp)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-muted/60 ${active ? "bg-rose-50" : ""}`}
                >
                  <span className="flex items-center gap-2">
                    {active && <Check className="w-3.5 h-3.5 text-rose-600" />}
                    <span className="tabular-nums">{fp.grams} g</span>
                    <span>{fp.food_name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">≈ {fp.reference_kcal} kcal</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {preview && (
        <div className="flex items-center gap-3 flex-wrap text-xs tabular-nums px-1">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-semibold">{pickedFruit ? pickedFruit.grams : preview.grams} g</span>
          <span className="px-1.5 py-0.5 rounded bg-foreground/5 font-medium">
            {Math.round(pickedFruit ? pickedFruit.reference_kcal : preview.macros.kcal)} kcal
          </span>
          {!pickedFruit && (
            <>
              <span><b className="text-emerald-600">P</b> {preview.macros.ptn}g</span>
              <span><b className="text-amber-600">C</b> {preview.macros.cho}g</span>
              <span><b className="text-violet-600">G</b> {preview.macros.lip}g</span>
            </>
          )}
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 rounded text-sm hover:bg-muted">Cancelar</button>
        <button
          onClick={onConfirm}
          disabled={isPorcaoFruta && !pickedFruit}
          className="px-4 py-1.5 rounded bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
