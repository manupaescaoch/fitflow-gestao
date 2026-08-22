import { useEffect, useRef, useState } from "react";
import { DIAS, type DietaPlano } from "@/lib/dieta";

export function PlanoDescricaoCard({
  plano, canEdit, onChange, hideStatus,
}: {
  plano: DietaPlano;
  canEdit: boolean;
  onChange: (patch: Partial<DietaPlano>) => void;
  hideStatus?: boolean;
}) {
  const [descricao, setDescricao] = useState<string>(plano.descricao ?? "");
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setDescricao(plano.descricao ?? ""); }, [plano.id, plano.descricao]);

  function onChangeDescricao(v: string) {
    setDescricao(v);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      onChange({ descricao: v });
    }, 800);
  }

  function toggleDia(d: string) {
    const cur = plano.dias_semana ?? [];
    const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
    onChange({ dias_semana: next });
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Descrição do plano alimentar
        </label>
        <textarea
          value={descricao}
          onChange={(e) => onChangeDescricao(e.target.value)}
          disabled={!canEdit}
          rows={1}
          placeholder="Ex: 2.400 kcal | Cutting fase 1 | PTN 248g | CHO 238g | LIP 53g"
          className="mt-2 w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-sm placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-300 disabled:opacity-70 transition leading-6 overflow-y-auto"
          style={{ height: "40px", maxHeight: "40px" }}
        />
      </div>

      <div>
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Dias da semana</div>
        <div className="flex items-center gap-2">
          {DIAS.map((d) => {
            const active = (plano.dias_semana ?? []).includes(d.v);
            return (
              <button
                key={d.v}
                disabled={!canEdit}
                onClick={() => toggleDia(d.v)}
                className={`w-10 h-10 rounded-xl text-xs font-medium transition ${
                  active
                    ? "bg-primary text-white shadow-sm shadow-rose-100"
                    : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300 hover:text-slate-700"
                } disabled:opacity-60`}
              >
                {d.l}
              </button>
            );
          })}
        </div>
      </div>

      {!hideStatus && (
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</span>
          <select
            value={plano.status}
            disabled={!canEdit}
            onChange={(e) => onChange({ status: e.target.value })}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20"
          >
            <option value="rascunho">Rascunho</option>
            <option value="ativo">Ativo</option>
            <option value="aprovado">Aprovado</option>
          </select>
        </div>
      )}
    </div>
  );
}