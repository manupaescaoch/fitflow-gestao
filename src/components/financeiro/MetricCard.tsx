import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: { texto: string; positivo: boolean } | null;
  accent?: "green" | "red" | "neutral";
  onDetalhes?: () => void;
}

const COLOR: Record<NonNullable<Props["accent"]>, string> = {
  green: "var(--green)",
  red: "var(--red)",
  neutral: "var(--text)",
};

export function MetricCard({ icon: Icon, label, value, delta, accent = "green", onDetalhes }: Props) {
  return (
    <div className="fin-card flex flex-col gap-2">
      <div className="flex items-center gap-2 fin-muted text-xs uppercase tracking-wide">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <div className="text-4xl font-bold tracking-tight" style={{ color: COLOR[accent] }}>
        {value}
      </div>
      {delta && (
        <div className="text-[11px] fin-muted uppercase tracking-wide">
          {delta.positivo ? "↑" : "↓"} {delta.texto}
        </div>
      )}
      {onDetalhes && (
        <button
          onClick={onDetalhes}
          className="text-xs font-medium mt-1 self-start hover:underline"
          style={{ color: "var(--blue)" }}
        >
          Detalhes →
        </button>
      )}
    </div>
  );
}