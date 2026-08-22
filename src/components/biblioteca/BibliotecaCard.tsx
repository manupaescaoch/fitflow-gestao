import { Link } from "@tanstack/react-router";
import { ArrowRight, type LucideIcon } from "lucide-react";

export function BibliotecaCard({
  to,
  title,
  description,
  icon: Icon,
  tone,
}: {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Cor do tile do ícone, ex: "rose" | "amber" | "emerald" | "indigo" | "sky" | "violet" | "orange" */
  tone?: "rose" | "amber" | "emerald" | "indigo" | "sky" | "violet" | "orange";
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    rose: { bg: "bg-rose-50", fg: "text-rose-600" },
    amber: { bg: "bg-amber-50", fg: "text-amber-600" },
    emerald: { bg: "bg-emerald-50", fg: "text-emerald-600" },
    indigo: { bg: "bg-indigo-50", fg: "text-indigo-600" },
    sky: { bg: "bg-sky-50", fg: "text-sky-600" },
    violet: { bg: "bg-violet-50", fg: "text-violet-600" },
    orange: { bg: "bg-orange-50", fg: "text-orange-600" },
  };
  const t = tones[tone ?? "rose"];
  return (
    <Link
      to={to}
      aria-label={title}
      className="group relative flex items-start gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5 hover:border-rose-200 hover:shadow-sm transition"
    >
      <div className={`shrink-0 w-10 h-10 rounded-xl grid place-items-center ${t.bg}`}>
        <Icon className={`w-5 h-5 ${t.fg}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
          <ArrowRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-rose-500 group-hover:translate-x-0.5 transition shrink-0" />
        </div>
        <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground line-clamp-2">{description}</p>
      </div>
    </Link>
  );
}