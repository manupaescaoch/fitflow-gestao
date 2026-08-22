import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, MessageSquare, Camera, CheckCircle2, ChevronRight } from "lucide-react";

type Alerta = {
  id: string;
  icon: any;
  titulo: string;
  detalhe: string;
  tone: "rose" | "violet" | "emerald" | "amber";
};

const TONES: Record<string, string> = {
  rose: "bg-rose-50 text-rose-600",
  violet: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
};

function diasAtras(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function AlertasInteligentes({ alunoId }: { alunoId: string }) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const [{ data: forms }, { data: planos }] = await Promise.all([
        supabase.from("formularios").select("id,tipo,respondido,respondido_em,criado_em")
          .eq("aluno_id", alunoId)
          .in("tipo", ["feedback_quinzenal", "feedback_mensal", "anamnese"])
          .order("criado_em", { ascending: false }),
        supabase.from("dieta_planos").select("atualizado_em")
          .eq("aluno_id", alunoId).eq("template", false)
          .order("atualizado_em", { ascending: false }).limit(1),
      ]);
      if (cancel) return;

      const list: Alerta[] = [];

      // Feedback pendente
      const pend = (forms ?? []).find((f: any) => !f.respondido && (f.tipo === "feedback_quinzenal" || f.tipo === "feedback_mensal"));
      if (pend) {
        const tipoLabel = pend.tipo === "feedback_quinzenal" ? "quinzenal" : "mensal";
        list.push({
          id: "feedback-pend", icon: MessageSquare, tone: "violet",
          titulo: `Feedback ${tipoLabel} pendente`,
          detalhe: `Enviado em ${new Date(pend.criado_em).toLocaleDateString("pt-BR")}`,
        });
      }

      // Última foto (de feedback_mensal/anamnese respondidos com fotos)
      const ultimaFoto = (forms ?? [])
        .filter((f: any) => f.respondido && f.respondido_em)
        .map((f: any) => f.respondido_em as string)[0] ?? null;
      const dFoto = diasAtras(ultimaFoto);
      if (dFoto !== null && dFoto >= 15) {
        list.push({
          id: "fotos", icon: Camera, tone: "rose",
          titulo: `Fotos há ${dFoto} dias sem atualizar`,
          detalhe: `Última: ${new Date(ultimaFoto!).toLocaleDateString("pt-BR")}`,
        });
      }

      // Plano alimentar
      const atualizadoEm = planos?.[0]?.atualizado_em ?? null;
      const dPlano = diasAtras(atualizadoEm);
      if (atualizadoEm) {
        const hojeOuOntem = dPlano !== null && dPlano <= 1;
        list.push({
          id: "plano", icon: CheckCircle2, tone: hojeOuOntem ? "emerald" : "amber",
          titulo: hojeOuOntem ? "Plano alimentar atualizado hoje" : `Plano atualizado há ${dPlano}d`,
          detalhe: new Date(atualizadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
        });
      }

      setAlertas(list);
    })();
    return () => { cancel = true; };
  }, [alunoId]);

  if (!alertas.length) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3 flex-wrap">
      <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 px-2">
        <Bell className="h-3.5 w-3.5 text-rose-500" />
        Alertas inteligentes
      </div>
      <div className="flex-1 flex items-center gap-2 flex-wrap">
        {alertas.map((a) => (
          <div key={a.id} className="inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <span className={`h-7 w-7 rounded-lg flex items-center justify-center ${TONES[a.tone]}`}>
              <a.icon className="h-3.5 w-3.5" />
            </span>
            <div className="leading-tight">
              <div className="text-xs font-medium text-slate-800">{a.titulo}</div>
              <div className="text-[10px] text-muted-foreground">{a.detalhe}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700 px-2">
        Ver todos alertas <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}