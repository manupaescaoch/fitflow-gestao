import { useEffect, useState } from "react";
import { X, Loader2, Trash2, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Food } from "@/lib/foods";

type Props = {
  food: Food | null; // null = criando novo
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type Form = {
  name: string;
  category: string;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g: number;
  porcao_g: number;
};

type MeasureRow = {
  id?: string;          // undefined = nova
  measure_name: string;
  measure_type: string; // "grama" | "unidade" | "porcao" | "colher" | etc
  grams_equivalent: number;
  is_default: boolean;
  sort_order: number;
  _delete?: boolean;
};

const empty: Form = {
  name: "",
  category: "",
  kcal_100g: 0,
  protein_100g: 0,
  carbs_100g: 0,
  fat_100g: 0,
  fiber_100g: 0,
  porcao_g: 100,
};

const TIPOS = [
  { value: "porcao", label: "Porção" },
  { value: "unidade", label: "Unidade" },
  { value: "colher_sopa", label: "Colher de sopa" },
  { value: "colher_cha", label: "Colher de chá" },
  { value: "xicara", label: "Xícara" },
  { value: "copo", label: "Copo" },
  { value: "fatia", label: "Fatia" },
  { value: "concha", label: "Concha" },
  { value: "grama", label: "Grama" },
];

export function EditarAlimentoModal({ food, open, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [measures, setMeasures] = useState<MeasureRow[]>([]);
  const isEdit = !!food;

  useEffect(() => {
    if (!open) return;
    if (!food) {
      setForm(empty);
      setMeasures([
        { measure_name: "Porção", measure_type: "porcao", grams_equivalent: 100, is_default: true, sort_order: 0 },
      ]);
      return;
    }
    setForm({
      name: food.name,
      category: food.category ?? "",
      kcal_100g: Number(food.kcal_100g) || 0,
      protein_100g: Number(food.protein_100g) || 0,
      carbs_100g: Number(food.carbs_100g) || 0,
      fat_100g: Number(food.fat_100g) || 0,
      fiber_100g: Number(food.fiber_100g) || 0,
      porcao_g: 100,
    });
    // carrega medidas
    (async () => {
      const { data } = await (supabase as any)
        .from("food_measures")
        .select("id,measure_name,measure_type,grams_equivalent,is_default,sort_order")
        .eq("food_id", food.id)
        .order("sort_order", { ascending: true });
      const list = (data ?? []) as any[];
      if (list.length) {
        setMeasures(
          list.map((m, i) => ({
            id: m.id,
            measure_name: m.measure_name ?? "",
            measure_type: m.measure_type ?? "porcao",
            grams_equivalent: Number(m.grams_equivalent) || 0,
            is_default: !!m.is_default,
            sort_order: m.sort_order ?? i,
          })),
        );
        const def = list.find((m) => m.is_default) ?? list[0];
        setForm((f) => ({ ...f, porcao_g: Number(def?.grams_equivalent) || 100 }));
      } else {
        setMeasures([
          { measure_name: "Porção", measure_type: "porcao", grams_equivalent: 100, is_default: true, sort_order: 0 },
        ]);
      }
    })();
  }, [open, food]);

  if (!open) return null;

  const set = (k: keyof Form, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v: string) => {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  function updateMeasure(idx: number, patch: Partial<MeasureRow>) {
    setMeasures((arr) => arr.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }
  function setDefault(idx: number) {
    setMeasures((arr) => arr.map((m, i) => ({ ...m, is_default: i === idx })));
  }
  function addMeasure() {
    setMeasures((arr) => [
      ...arr,
      {
        measure_name: "",
        measure_type: "unidade",
        grams_equivalent: 0,
        is_default: arr.length === 0,
        sort_order: arr.length,
      },
    ]);
  }
  function removeMeasure(idx: number) {
    setMeasures((arr) => {
      const m = arr[idx];
      if (m.id) {
        // marca para deletar
        return arr.map((x, i) => (i === idx ? { ...x, _delete: true, is_default: false } : x));
      }
      return arr.filter((_, i) => i !== idx);
    });
  }

  async function salvar() {
    if (!form.name.trim()) {
      toast.error("Informe o nome do alimento.");
      return;
    }
    const ativas = measures.filter((m) => !m._delete);
    if (ativas.length === 0) {
      toast.error("Adicione ao menos uma medida.");
      return;
    }
    if (!ativas.some((m) => m.is_default)) {
      toast.error("Marque uma medida como padrão.");
      return;
    }
    for (const m of ativas) {
      if (!m.measure_name.trim()) {
        toast.error("Informe o nome de todas as medidas.");
        return;
      }
      if (!(m.grams_equivalent > 0)) {
        toast.error(`Informe os gramas da medida "${m.measure_name}".`);
        return;
      }
    }
    setSaving(true);
    try {
      let foodId = food?.id;
      const payload = {
        name: form.name.trim(),
        category: form.category.trim() || null,
        source: "Meus alimentos",
        kcal_100g: form.kcal_100g,
        protein_100g: form.protein_100g,
        carbs_100g: form.carbs_100g,
        fat_100g: form.fat_100g,
        fiber_100g: form.fiber_100g,
        created_by_user: true,
      };
      if (isEdit && foodId) {
        const { error } = await (supabase as any).from("foods").update(payload).eq("id", foodId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("foods")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        foodId = data.id;
      }

      // Medidas: deletar removidas, atualizar existentes, inserir novas
      if (foodId) {
        const toDelete = measures.filter((m) => m._delete && m.id).map((m) => m.id!);
        if (toDelete.length) {
          await (supabase as any).from("food_measures").delete().in("id", toDelete);
        }
        let order = 0;
        for (const m of measures) {
          if (m._delete) continue;
          const row = {
            food_id: foodId,
            measure_name: m.measure_name.trim(),
            measure_type: m.measure_type,
            grams_equivalent: m.grams_equivalent,
            is_default: m.is_default,
            sort_order: order++,
          };
          if (m.id) {
            await (supabase as any).from("food_measures").update(row).eq("id", m.id);
          } else {
            await (supabase as any).from("food_measures").insert(row);
          }
        }
      }

      toast.success(isEdit ? "Alimento atualizado." : "Alimento criado.");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function excluir() {
    if (!food) return;
    if (!confirm(`Excluir "${food.name}"? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      const { error } = await (supabase as any).from("foods").delete().eq("id", food.id);
      if (error) throw error;
      toast.success("Alimento excluído.");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {isEdit ? "Editar alimento" : "Novo alimento"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Os valores nutricionais são por 100 g.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-auto">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome" full>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
              />
            </Field>
            <Field label="Categoria" full>
              <input
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
              />
            </Field>
          </div>

          <div className="grid grid-cols-5 gap-2">
            <Field label="Kcal">
              <input
                type="number"
                value={form.kcal_100g}
                onChange={(e) => set("kcal_100g", num(e.target.value))}
                className="w-full px-2 py-2 rounded-md border border-border bg-background text-sm tabular-nums"
              />
            </Field>
            <Field label="Prot (g)">
              <input
                type="number"
                value={form.protein_100g}
                onChange={(e) => set("protein_100g", num(e.target.value))}
                className="w-full px-2 py-2 rounded-md border border-border bg-background text-sm tabular-nums"
              />
            </Field>
            <Field label="Carb (g)">
              <input
                type="number"
                value={form.carbs_100g}
                onChange={(e) => set("carbs_100g", num(e.target.value))}
                className="w-full px-2 py-2 rounded-md border border-border bg-background text-sm tabular-nums"
              />
            </Field>
            <Field label="Gord (g)">
              <input
                type="number"
                value={form.fat_100g}
                onChange={(e) => set("fat_100g", num(e.target.value))}
                className="w-full px-2 py-2 rounded-md border border-border bg-background text-sm tabular-nums"
              />
            </Field>
            <Field label="Fib (g)">
              <input
                type="number"
                value={form.fiber_100g}
                onChange={(e) => set("fiber_100g", num(e.target.value))}
                className="w-full px-2 py-2 rounded-md border border-border bg-background text-sm tabular-nums"
              />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Unidades de medida</h3>
                <p className="text-[11px] text-muted-foreground">
                  Defina porções, unidades, colheres etc. A medida marcada com ★ é a padrão.
                </p>
              </div>
              <button
                onClick={addMeasure}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border text-xs hover:bg-muted"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
            </div>

            <div className="space-y-2">
              {measures.map((m, idx) => {
                if (m._delete) return null;
                return (
                  <div
                    key={m.id ?? `new-${idx}`}
                    className="grid grid-cols-12 gap-2 items-end p-2 rounded-lg border border-border bg-muted/30"
                  >
                    <div className="col-span-1 flex justify-center pb-2">
                      <button
                        type="button"
                        onClick={() => setDefault(idx)}
                        title={m.is_default ? "Padrão" : "Definir como padrão"}
                        className={`p-1 rounded ${m.is_default ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <Star className={`w-4 h-4 ${m.is_default ? "fill-current" : ""}`} />
                      </button>
                    </div>
                    <div className="col-span-4">
                      <span className="block text-[11px] font-medium text-muted-foreground mb-1">Nome</span>
                      <input
                        value={m.measure_name}
                        onChange={(e) => updateMeasure(idx, { measure_name: e.target.value })}
                        placeholder="Ex.: Pote, Unidade"
                        className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm"
                      />
                    </div>
                    <div className="col-span-3">
                      <span className="block text-[11px] font-medium text-muted-foreground mb-1">Tipo</span>
                      <select
                        value={m.measure_type}
                        onChange={(e) => updateMeasure(idx, { measure_type: e.target.value })}
                        className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm"
                      >
                        {TIPOS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <span className="block text-[11px] font-medium text-muted-foreground mb-1">Equivale a (g)</span>
                      <input
                        type="number"
                        value={m.grams_equivalent}
                        onChange={(e) => updateMeasure(idx, { grams_equivalent: num(e.target.value) })}
                        className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm tabular-nums"
                      />
                    </div>
                    <div className="col-span-1 flex justify-center pb-1">
                      <button
                        type="button"
                        onClick={() => removeMeasure(idx)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Remover"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-border shrink-0">
          <div>
            {isEdit && (
              <button
                onClick={excluir}
                disabled={deleting || saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Excluir
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-md border border-border text-sm hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="block text-[11px] font-medium text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}