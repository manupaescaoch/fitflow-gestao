import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import type { PhysicalAssessment } from "@/lib/avaliacao-fisica";

type Metric = "weight" | "body_fat_percentage" | "lean_mass_kg" | "skinfold_sum";

const METRICS: { key: Metric; label: string; color: string; suffix: string }[] = [
  { key: "weight", label: "Peso", color: "hsl(0, 84%, 55%)", suffix: "kg" },
  { key: "body_fat_percentage", label: "% Gordura", color: "hsl(38, 92%, 50%)", suffix: "%" },
  { key: "lean_mass_kg", label: "Massa magra", color: "hsl(160, 84%, 39%)", suffix: "kg" },
  { key: "skinfold_sum", label: "Soma dobras", color: "hsl(217, 91%, 60%)", suffix: "mm" },
];

export function EvolucaoChart({ list }: { list: PhysicalAssessment[] }) {
  const [metric, setMetric] = useState<Metric>("weight");

  const data = useMemo(() => {
    return [...list]
      .sort((a, b) => +new Date(a.assessment_date) - +new Date(b.assessment_date))
      .map((r) => ({
        data: new Date(r.assessment_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        weight: r.weight,
        body_fat_percentage: r.body_fat_percentage,
        lean_mass_kg: r.lean_mass_kg,
        skinfold_sum: r.skinfold_sum,
      }));
  }, [list]);

  const cur = METRICS.find((m) => m.key === metric)!;
  const hasData = data.some((d) => d[metric] != null);

  if (list.length < 2) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h3 className="text-sm font-semibold">Evolução</h3>
        <div className="flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                metric === m.key
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background border-input hover:bg-muted text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {hasData ? (
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="data" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`${v} ${cur.suffix}`, cur.label]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey={metric}
                name={cur.label}
                stroke={cur.color}
                strokeWidth={2.5}
                dot={{ r: 4, fill: cur.color }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">
          Sem dados de {cur.label.toLowerCase()} para plotar.
        </div>
      )}
    </div>
  );
}