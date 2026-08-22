import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  value: string;
  comparePct?: number;
  comparePeriodo?: string;
  positivo?: boolean;
}

export function MiniMetricaRow({
  icon: Icon,
  iconColor,
  label,
  value,
  comparePct,
  comparePeriodo,
  positivo,
}: Props) {
  const showCompare = comparePct !== undefined && comparePeriodo;
  const deltaColor = positivo ? "var(--green)" : "var(--red)";
  return (
    <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconColor + "1A" }}
      >
        <Icon className="h-5 w-5" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs fin-muted truncate">{label}</p>
        <p className="text-lg font-bold leading-tight truncate">{value}</p>
        {showCompare && (
          <p className="text-[11px] mt-0.5">
            <span style={{ color: deltaColor, fontWeight: 600 }}>
              {comparePct! >= 0 ? "+" : ""}
              {comparePct!.toFixed(1)}%
            </span>{" "}
            <span className="fin-muted">vs {comparePeriodo}</span>
          </p>
        )}
      </div>
    </div>
  );
}