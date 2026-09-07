import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useEffect, useRef, useState } from "react";
import type { Macros } from "@/lib/dieta";

const COLORS = {
  ptn: "var(--primary)",
  cho: "#7C3AED",
  lip: "#F59E0B",
  empty: "#F1F5F9",
};

export function ResumoNutrientesCard({
  total, peso, vazio, alertasCount, onAlertaClick,
  editavel, valoresManuais, onChangeManuais, fonte,
}: {
  total: Macros;
  peso: number | null | undefined;
  vazio: boolean;
  alertasCount?: number;
  onAlertaClick?: () => void;
  editavel?: boolean;
  valoresManuais?: { kcal: number; ptn: number; cho: number; lip: number };
  onChangeManuais?: (patch: Partial<{ kcal: number; ptn: number; cho: number; lip: number }>) => void;
  fonte?: "descricao" | "manual";
}) {
  // Estado local para inputs (debounced para o pai)
  const [local, setLocal] = useState(valoresManuais ?? { kcal: 0, ptn: 0, cho: 0, lip: 0 });
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (valoresManuais) setLocal(valoresManuais);
  }, [valoresManuais?.kcal, valoresManuais?.ptn, valoresManuais?.cho, valoresManuais?.lip]);

  function updateLocal(patch: Partial<{ kcal: number; ptn: number; cho: number; lip: number }>) {
    const novos = { ...local, ...patch };
    setLocal(novos);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => onChangeManuais?.(patch), 600);
  }

  // No modo editável usamos os valores manuais (locais); no modo padrão usamos o total calculado
  const efetivo = editavel ? local : total;
  // % calórico (4kcal/g PTN+CHO; 9kcal/g LIP)
  const kcalPtn = efetivo.ptn * 4;
  const kcalCho = efetivo.cho * 4;
  const kcalLip = efetivo.lip * 9;
  const somaCal = kcalPtn + kcalCho + kcalLip || 1;

  const totalZero = (efetivo.ptn + efetivo.cho + efetivo.lip + efetivo.kcal) === 0;
  const showEmpty = editavel ? totalZero : vazio;
  const data = showEmpty ? [{ name: "vazio", value: 1, color: COLORS.empty }] : [
    { name: "PTN", value: kcalPtn, color: COLORS.ptn },
    { name: "CHO", value: kcalCho, color: COLORS.cho },
    { name: "LIP", value: kcalLip, color: COLORS.lip },
  ];

  const pesoOk = !!peso && peso > 0;
  const gkg = (g: number) => (pesoOk ? (g / (peso as number)).toFixed(2).replace(".", ",") : "—");
  const pct = (k: number) => showEmpty ? "—" : `${Math.round((k / somaCal) * 100)}%`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white border border-slate-200/70 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Resumo de nutrientes
          </div>
          {fonte === "descricao" ? (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-semibold">
              da descrição
            </span>
          ) : editavel && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
              manual
            </span>
          )}
        </div>

        <div className="relative h-52 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={68}
                outerRadius={96}
                paddingAngle={showEmpty ? 0 : 4}
                stroke="none"
                isAnimationActive={false}
              >
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Kcal totais</div>
              {editavel && onChangeManuais ? (
                <input
                  type="number"
                  inputMode="numeric"
                  value={local.kcal || ""}
                  onChange={(e) => updateLocal({ kcal: Number(e.target.value) || 0 })}
                  placeholder="0"
                  className="pointer-events-auto w-24 text-center text-3xl font-bold text-slate-900 tabular-nums leading-tight mt-1 bg-transparent border-b-2 border-slate-200 focus:border-rose-500 outline-none"
                />
              ) : (
                <div className="text-3xl font-bold text-slate-900 tabular-nums leading-tight mt-1">
                  {showEmpty ? "—" : Math.round(efetivo.kcal).toLocaleString("pt-BR")}
                </div>
              )}
            </div>
          </div>
        </div>

        <table className="mt-5 w-full text-sm tabular-nums">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
              <th className="text-left pb-2"></th>
              <th className="text-right pb-2">g/kg</th>
              <th className="text-right pb-2">Total</th>
              <th className="text-right pb-2">%</th>
            </tr>
          </thead>
          <tbody>
            <Row
              label="PTN" color={COLORS.ptn} gkg={gkg(efetivo.ptn)}
              total={showEmpty ? "—" : `${Math.round(efetivo.ptn)} g`} pct={pct(kcalPtn)}
              editavel={editavel} value={local.ptn ?? 0}
              onChange={(v) => updateLocal({ ptn: v })}
            />
            <Row
              label="CHO" color={COLORS.cho} gkg={gkg(efetivo.cho)}
              total={showEmpty ? "—" : `${Math.round(efetivo.cho)} g`} pct={pct(kcalCho)}
              editavel={editavel} value={local.cho ?? 0}
              onChange={(v) => updateLocal({ cho: v })}
            />
            <Row
              label="LIP" color={COLORS.lip} gkg={gkg(efetivo.lip)}
              total={showEmpty ? "—" : `${Math.round(efetivo.lip)} g`} pct={pct(kcalLip)}
              editavel={editavel} value={local.lip ?? 0}
              onChange={(v) => updateLocal({ lip: v })}
            />
          </tbody>
        </table>

        {!pesoOk && !showEmpty && (
          <div className="mt-4 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Defina o peso do aluno para calcular g/kg.
          </div>
        )}
        {fonte === "descricao" ? (
          <div className="mt-4 text-[11px] text-sky-700 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
            Lido automaticamente da descrição do plano alimentar.
          </div>
        ) : editavel && (
          <div className="mt-4 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            Modo texto livre · totais preenchidos manualmente.
          </div>
        )}
      </div>

    </div>
  );
}

function Row({ label, color, gkg, total, pct, editavel, value, onChange }: {
  label: string; color: string; gkg: string; total: string; pct: string;
  editavel?: boolean; value?: number; onChange?: (v: number) => void;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2.5">
        <span className="inline-flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <span className="font-semibold text-slate-700 text-[13px]">{label}</span>
        </span>
      </td>
      <td className="py-2.5 text-right text-slate-500 text-[13px]">{gkg}</td>
      <td className="py-2.5 text-right font-semibold text-slate-900 text-[13px]">
        {editavel && onChange ? (
          <input
            type="number"
            inputMode="numeric"
            value={value || ""}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            placeholder="0"
            className="w-16 text-right bg-transparent border-b border-slate-200 focus:border-rose-500 outline-none tabular-nums"
          />
        ) : (
          total
        )}
        {editavel && <span className="ml-1 text-slate-400 text-[11px]">g</span>}
      </td>
      <td className="py-2.5 text-right text-slate-500 text-[13px]">{pct}</td>
    </tr>
  );
}