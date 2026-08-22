import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Apple, Loader2, Download, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { searchFoods, type Food } from "@/lib/foods";
import { BibliotecaListLayout } from "@/components/biblioteca/BibliotecaListLayout";
import { EditarAlimentoModal } from "@/components/biblioteca/EditarAlimentoModal";

export const Route = createFileRoute("/_app/biblioteca/alimentos")({
  head: () => ({ meta: [{ title: "Alimentos — Biblioteca" }] }),
  component: AlimentosPage,
});

const SOURCE_STYLES: Record<string, string> = {
  TACO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  TBCA: "bg-sky-50 text-sky-700 border-sky-200",
  IBGE: "bg-amber-50 text-amber-700 border-amber-200",
  USDA: "bg-violet-50 text-violet-700 border-violet-200",
  "Meus alimentos": "bg-rose-50 text-rose-700 border-rose-200",
};

type DefaultPortion = { grams: number };

async function loadDefaultPortions(foodIds: string[]): Promise<Record<string, DefaultPortion>> {
  if (!foodIds.length) return {};
  const { data } = await (supabase as any)
    .from("food_measures")
    .select("food_id,grams_equivalent,is_default,sort_order,measure_type")
    .in("food_id", foodIds)
    .order("sort_order", { ascending: true });
  const map: Record<string, DefaultPortion> = {};
  for (const m of (data ?? []) as any[]) {
    if (map[m.food_id]) continue;
    if (m.is_default || !map[m.food_id]) {
      map[m.food_id] = { grams: Number(m.grams_equivalent) || 100 };
    }
  }
  return map;
}

async function loadAllFoods(limit = 50): Promise<Food[]> {
  const { data } = await (supabase as any)
    .from("foods")
    .select("*")
    .order("name", { ascending: true })
    .limit(limit);
  return (data ?? []) as Food[];
}

async function countFoods(): Promise<number> {
  const { count } = await (supabase as any)
    .from("foods")
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

function fmt(n: number, d = 1) {
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(d);
}

function AlimentosPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Food[]>([]);
  const [portions, setPortions] = useState<Record<string, DefaultPortion>>({});
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState<number | null>(null);
  const [editing, setEditing] = useState<Food | null>(null);
  const [creating, setCreating] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    countFoods().then(setTotal).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const term = q.trim();
      const list = term ? await searchFoods(term, 50) : await loadAllFoods(50);
      if (!alive) return;
      setItems(list);
      const p = await loadDefaultPortions(list.map((f) => f.id));
      if (!alive) return;
      setPortions(p);
      setLoading(false);
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, reloadKey]);

  const refresh = useCallback(() => {
    setReloadKey((k) => k + 1);
    countFoods().then(setTotal).catch(() => {});
  }, []);

  const isEmpty = !loading && items.length === 0;

  const rows = useMemo(
    () =>
      items.map((f) => {
        const grams = portions[f.id]?.grams ?? 100;
        const factor = grams / 100;
        return {
          f,
          grams,
          per100: {
            kcal: Math.round(f.kcal_100g),
            p: f.protein_100g,
            c: f.carbs_100g,
            g: f.fat_100g,
            fib: f.fiber_100g,
          },
          perPort: {
            kcal: Math.round(f.kcal_100g * factor),
            p: f.protein_100g * factor,
            c: f.carbs_100g * factor,
            g: f.fat_100g * factor,
            fib: f.fiber_100g * factor,
          },
        };
      }),
    [items, portions],
  );

  return (
    <BibliotecaListLayout
      title="Base de Alimentos"
      description="Alimentos cadastrados com informações nutricionais, porções e medidas caseiras."
      icon={Apple}
      onCreate={() => setCreating(true)}
      createLabel="Novo alimento"
      searchPlaceholder="Buscar alimento…"
      query={q}
      onQueryChange={setQ}
      isEmpty={isEmpty}
      emptyHint={q ? `Nenhum alimento encontrado para "${q}".` : "Você ainda não possui nenhum alimento cadastrado."}
      titleBadge={
        total !== null && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-foreground/80 text-xs font-semibold tabular-nums">
            {total.toLocaleString("pt-BR")}
          </span>
        )
      }
      headerActions={
        <button
          onClick={() => toast.info("Exportar CSV: em breve")}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition"
        >
          <Download className="w-4 h-4" />
          Baixar CSV
        </button>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="font-medium px-4 py-3 sticky left-0 bg-card">Alimento</th>
                  <th className="font-medium px-3 py-3">Fonte</th>
                  <th className="font-medium px-2 py-3 text-center" colSpan={5}>
                    Por 100g
                  </th>
                  <th className="font-medium px-3 py-3 text-center">Porção (g)</th>
                  <th className="font-medium px-2 py-3 text-center" colSpan={5}>
                    Por porção
                  </th>
                </tr>
                <tr className="text-[11px] text-muted-foreground border-b border-border">
                  <th className="px-4 pb-2 sticky left-0 bg-card" />
                  <th className="px-3 pb-2" />
                  <th className="px-2 pb-2 text-right">Kcal</th>
                  <th className="px-2 pb-2 text-right">P</th>
                  <th className="px-2 pb-2 text-right">C</th>
                  <th className="px-2 pb-2 text-right">G</th>
                  <th className="px-2 pb-2 text-right">F</th>
                  <th className="px-3 pb-2 text-right" />
                  <th className="px-2 pb-2 text-right">Kcal</th>
                  <th className="px-2 pb-2 text-right">P</th>
                  <th className="px-2 pb-2 text-right">C</th>
                  <th className="px-2 pb-2 text-right">G</th>
                  <th className="px-2 pb-2 text-right">F</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ f, grams, per100, perPort }) => {
                  const sourceClass =
                    (f.source && SOURCE_STYLES[f.source]) ||
                    "bg-muted text-muted-foreground border-border";
                  const editable = f.source === "Meus alimentos" || f.created_by_user;
                  return (
                    <tr
                      key={f.id}
                      className={`hover:bg-muted/40 transition ${editable ? "cursor-pointer" : ""}`}
                      onClick={() => editable && setEditing(f)}
                      title={editable ? "Clique para editar" : undefined}
                    >
                      <td className="px-4 py-3 sticky left-0 bg-card group-hover:bg-muted/40">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center shrink-0">
                            <Apple className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                              {f.name}
                              {editable && (
                                <Pencil className="w-3 h-3 text-muted-foreground/70" />
                              )}
                            </div>
                            {f.category && (
                              <div className="text-[11px] text-muted-foreground truncate">
                                {f.category}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {f.source && (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${sourceClass}`}
                          >
                            {f.source}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums font-medium">{per100.kcal}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{fmt(per100.p)}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{fmt(per100.c)}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{fmt(per100.g)}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{fmt(per100.fib)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                        {grams}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums font-medium">{perPort.kcal}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{fmt(perPort.p)}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{fmt(perPort.c)}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{fmt(perPort.g)}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{fmt(perPort.fib)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EditarAlimentoModal
        food={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
      <EditarAlimentoModal
        food={null}
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={refresh}
      />
    </BibliotecaListLayout>
  );
}
