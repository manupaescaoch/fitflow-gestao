import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock } from "lucide-react";
import { STATUS_LABEL, type Status } from "@/lib/crm";

type Evento = {
  id: string;
  data: string;
  titulo: string;
  autor: string | null;
};

export function HistoricoRecenteCard({ alunoId }: { alunoId: string }) {
  const [eventos, setEventos] = useState<Evento[]>([]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const [{ data: hist }, { data: planos }, { data: forms }] = await Promise.all([
        supabase.from("historico_status").select("id,status_para,alterado_por,criado_em")
          .eq("aluno_id", alunoId).order("criado_em", { ascending: false }).limit(5),
        supabase.from("dieta_planos").select("id,nome,atualizado_em")
          .eq("aluno_id", alunoId).eq("template", false)
          .order("atualizado_em", { ascending: false }).limit(3),
        supabase.from("formularios").select("id,tipo,respondido_em")
          .eq("aluno_id", alunoId).eq("respondido", true)
          .order("respondido_em", { ascending: false }).limit(3),
      ]);
      if (cancel) return;

      const todos: Evento[] = [];
      (hist ?? []).forEach((h: any) => todos.push({
        id: `h-${h.id}`, data: h.criado_em, autor: h.alterado_por,
        titulo: `Status: ${STATUS_LABEL[h.status_para as Status] ?? h.status_para}`,
      }));
      (planos ?? []).forEach((p: any) => todos.push({
        id: `p-${p.id}`, data: p.atualizado_em, autor: null,
        titulo: "Dieta atualizada",
      }));
      (forms ?? []).forEach((f: any) => {
        if (!f.respondido_em) return;
        const lbl = f.tipo === "anamnese" ? "Anamnese recebida"
          : f.tipo === "feedback_quinzenal" ? "Feedback quinzenal recebido"
          : f.tipo === "feedback_mensal" ? "Feedback mensal recebido"
          : "Formulário recebido";
        todos.push({ id: `f-${f.id}`, data: f.respondido_em, autor: null, titulo: lbl });
      });

      todos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setEventos(todos.slice(0, 5));
    })();
    return () => { cancel = true; };
  }, [alunoId]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Clock className="h-4 w-4 text-slate-400" />
          Histórico recente
        </div>
        <button className="text-xs font-medium text-rose-600 hover:text-rose-700">Ver tudo</button>
      </div>
      {eventos.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Nenhum evento registrado</p>
      ) : (
        <ol className="relative pl-5">
          <span className="absolute left-1.5 top-1 bottom-1 w-px bg-slate-200" />
          {eventos.map((e) => {
            const d = new Date(e.data);
            const data = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
            const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            return (
              <li key={e.id} className="relative pb-4 last:pb-0">
                <span className="absolute -left-3.5 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
                <div className="text-[10px] text-muted-foreground tabular-nums">{data} · {hora}</div>
                <div className="text-sm font-medium text-slate-800 leading-tight">{e.titulo}</div>
                {e.autor && <div className="text-[11px] text-muted-foreground">por {e.autor}</div>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}