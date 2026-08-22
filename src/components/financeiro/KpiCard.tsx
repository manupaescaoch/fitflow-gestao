import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  accent?: "green" | "blue" | "red" | "pink" | "amber" | "neutral";
  highlight?: boolean;
}

const ACCENT_BG: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  green: "var(--green-soft)",
  blue: "var(--blue-soft)",
  red: "var(--red-soft)",
  pink: "var(--pink-soft)",
  amber: "var(--amber-soft)",
  neutral: "var(--surface-2)",
};
const ACCENT_FG: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  green: "var(--green)",
  blue: "var(--blue)",
  red: "var(--red)",
  pink: "var(--pink)",
  amber: "var(--amber)",
  neutral: "var(--text)",
};

export function KpiCard({
  icon: Icon,
  label,
  value,
  sublabel,
  accent = "neutral",
  highlight,
}: KpiCardProps) {
  return (
    <div
      className="fin-card relative"
      style={
        highlight
          ? { borderLeft: `4px solid ${ACCENT_FG[accent]}` }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-xs fin-muted">{label}</p>
          <p
            className="text-2xl font-bold tracking-tight truncate"
            style={{ color: ACCENT_FG[accent] }}
          >
            {value}
          </p>
          {sublabel && <p className="text-[11px] fin-muted">{sublabel}</p>}
        </div>
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: ACCENT_BG[accent] }}
        >
          <Icon className="h-4 w-4" style={{ color: ACCENT_FG[accent] }} />
        </div>
      </div>
    </div>
  );
}