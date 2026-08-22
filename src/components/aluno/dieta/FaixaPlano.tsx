import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { DIAS, type DietaPlano } from "@/lib/dieta";

export function FaixaPlano({
  plano, canEdit, onChange,
}: {
  plano: DietaPlano;
  canEdit: boolean;
  onChange: (patch: Partial<DietaPlano>) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<Partial<DietaPlano>>({});

  function start() { setDraft({}); setEdit(true); }
  function save() { onChange(draft); setEdit(false); }
  function cancel() { setDraft({}); setEdit(false); }

  function val<K extends keyof DietaPlano>(k: K): DietaPlano[K] {
    return (draft[k] !== undefined ? draft[k]! : plano[k]) as DietaPlano[K];
  }

  if (!edit) {
    return (
      <div className="flex items-center gap-x-5 gap-y-1 flex-wrap py-2.5 px-1 text-sm">
        <Cell label="Plano" value={plano.nome} bold />
        <Cell label="Dias" value={(plano.dias_semana ?? []).map((d) => DIAS.find((x) => x.v === d)?.l ?? d).join(" ")} />
        <Cell label="Peso ref." value={plano.peso_referencia ? `${plano.peso_referencia} kg` : "—"} />
        <Cell label="Meta" value={plano.meta_kcal ? `${plano.meta_kcal} kcal` : "—"} />
        {plano.observacoes && <Cell label="Obs." value={plano.observacoes} className="max-w-[260px] truncate" />}
        {canEdit && (
          <button onClick={start} className="ml-auto p-1.5 rounded-lg hover:bg-muted/60 transition" aria-label="Editar">
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap py-2.5 px-1 text-sm">
      <input
        value={(val("nome") as string) ?? ""}
        onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
        className="px-2 py-1 rounded-md border border-border bg-background text-sm w-40"
        placeholder="Nome do plano"
      />
      <div className="flex items-center gap-1">
        {DIAS.map((d) => {
          const active = (val("dias_semana") as string[] ?? []).includes(d.v);
          return (
            <button
              key={d.v}
              onClick={() => {
                const cur = (val("dias_semana") as string[]) ?? [];
                const next = active ? cur.filter((x) => x !== d.v) : [...cur, d.v];
                setDraft((dr) => ({ ...dr, dias_semana: next }));
              }}
              className={`w-7 h-7 rounded-md text-xs font-medium transition ${
                active ? "bg-primary text-white" : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              {d.l[0]}
            </button>
          );
        })}
      </div>
      <NumInput label="kg"  value={val("peso_referencia") as number | null} onChange={(n) => setDraft((d) => ({ ...d, peso_referencia: n }))} />
      <NumInput label="kcal" value={val("meta_kcal") as number | null} onChange={(n) => setDraft((d) => ({ ...d, meta_kcal: n }))} />
      <input
        value={(val("observacoes") as string) ?? ""}
        onChange={(e) => setDraft((d) => ({ ...d, observacoes: e.target.value }))}
        className="px-2 py-1 rounded-md border border-border bg-background text-sm flex-1 min-w-[160px]"
        placeholder="Observações"
      />
      <button onClick={save} className="p-1.5 rounded-md bg-primary text-white hover:bg-primary"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={cancel} className="p-1.5 rounded-md hover:bg-muted/60"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function Cell({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className={`flex items-baseline gap-1.5 ${className ?? ""}`}>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={bold ? "font-medium" : ""}>{value || "—"}</span>
    </div>
  );
}

function NumInput({ label, value, onChange }: { label: string; value: number | null; onChange: (n: number | null) => void }) {
  return (
    <div className="inline-flex items-center gap-1.5 border border-border rounded-md px-2 py-1 bg-background">
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-16 outline-none text-sm bg-transparent"
      />
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}
