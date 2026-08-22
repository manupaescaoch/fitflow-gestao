import type { ReactNode } from "react";

export function MiniMetricasFaixa({ children }: { children: ReactNode }) {
  return (
    <div
      className="fin-card p-0 flex flex-col md:flex-row md:items-stretch divide-y md:divide-y-0 md:divide-x"
      style={{ borderColor: "var(--border-light)" }}
    >
      {children}
    </div>
  );
}