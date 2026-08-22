import { AlertTriangle, Check, Info } from "lucide-react";
import type { ValidacaoSinal } from "@/lib/dieta";

export function StatusInteligente({ sinais }: { sinais: ValidacaoSinal[] }) {
  if (sinais.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {sinais.map((s, i) => {
        const Icon = s.level === "warn" ? AlertTriangle : s.level === "ok" ? Check : Info;
        const cls =
          s.level === "warn" ? "bg-amber-50 text-amber-700"
          : s.level === "ok" ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-50 text-slate-700";
        return (
          <span key={i} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] ${cls}`}>
            <Icon className="w-3 h-3" /> {s.msg}
          </span>
        );
      })}
    </div>
  );
}
