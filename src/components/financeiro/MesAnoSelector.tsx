import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { MES_LABELS } from "@/lib/financeiro";

interface Props {
  ano: number;
  mes: number; // 0-11
  onChange: (ano: number, mes: number) => void;
}

export function MesAnoSelector({ ano, mes, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="inline-flex items-center gap-2 fin-card py-2 px-3">
        <button
          onClick={() => onChange(ano - 1, mes)}
          className="fin-muted hover:text-foreground"
          aria-label="Ano anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <Calendar className="h-4 w-4 fin-muted" />
        <span className="font-bold text-sm">{ano}</span>
        <button
          onClick={() => onChange(ano + 1, mes)}
          className="fin-muted hover:text-foreground"
          aria-label="Próximo ano"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {MES_LABELS.map((label, i) => {
          const ativo = i === mes;
          return (
            <button
              key={i}
              onClick={() => onChange(ano, i)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={
                ativo
                  ? { background: "var(--blue)", color: "#fff" }
                  : { color: "var(--text-muted)" }
              }
            >
              {label.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
