import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, AlertTriangle, ClipboardCheck, RefreshCw, ImageOff, KeyRound } from "lucide-react";

type Props = { data: {
  mensagensEnviadas: number; falhasEnvio: number; feedbacksPreenchidos: number;
  renovacoesProximas: number; fotosComProblema: number; alunosResign: number;
} | null; loading: boolean };

const cards = [
  { key: "mensagensEnviadas", label: "Mensagens enviadas", icon: MessageSquare, tone: "text-foreground" },
  { key: "falhasEnvio", label: "Falhas de envio", icon: AlertTriangle, tone: "text-destructive" },
  { key: "feedbacksPreenchidos", label: "Feedbacks preenchidos", icon: ClipboardCheck, tone: "text-foreground" },
  { key: "renovacoesProximas", label: "Renovações próximas (7d)", icon: RefreshCw, tone: "text-amber-600" },
  { key: "fotosComProblema", label: "Fotos com problema", icon: ImageOff, tone: "text-destructive" },
  { key: "alunosResign", label: "Alunos pendentes de re-sign", icon: KeyRound, tone: "text-amber-600" },
] as const;

export function IndicadorCards({ data, loading }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        const v = data ? (data as any)[c.key] : null;
        return (
          <Card key={c.key}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-muted-foreground leading-tight">{c.label}</div>
                <Icon className={`h-4 w-4 ${c.tone}`} />
              </div>
              <div className={`mt-2 text-2xl font-semibold ${c.tone}`}>
                {loading ? "…" : v ?? 0}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
