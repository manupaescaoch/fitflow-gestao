import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAssessmentFull, type AssessmentFull } from "@/lib/avaliacao-fisica";
import { AvaliacaoView } from "@/components/avaliacao/AvaliacaoView";
import { Loader2, ArrowLeft, Home, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/avaliacao-fisica/$id")({
  component: AvaliacaoDetalhePage,
});

function AvaliacaoDetalhePage() {
  const { id } = useParams({ from: "/_app/avaliacao-fisica/$id" });
  const [full, setFull] = useState<AssessmentFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [alunoNome, setAlunoNome] = useState<string>("");

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    getAssessmentFull(id).then((r) => { if (!cancel) { setFull(r); setLoading(false); } });
    return () => { cancel = true; };
  }, [id, tick]);

  useEffect(() => {
    if (!full?.assessment.student_id) return;
    supabase.from("alunos").select("nome").eq("id", full.assessment.student_id).maybeSingle()
      .then(({ data }) => setAlunoNome((data as any)?.nome ?? ""));
  }, [full?.assessment.student_id]);

  if (loading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;
  }
  if (!full) {
    return <div className="p-8 text-sm text-muted-foreground">Avaliação não encontrada.</div>;
  }
  return (
    <div className="container mx-auto py-6 max-w-5xl space-y-6">
      <div className="hidden md:flex rounded-2xl bg-card border border-border shadow-sm px-5 py-3 items-center gap-2 text-sm flex-wrap">
        <Link to="/visao-geral" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Visão geral
        </Link>
        <ChevronRight className="h-4 w-4 text-rose-500" />
        <Link to="/alunos" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <Home className="h-4 w-4" /> Lista de alunos
        </Link>
        {alunoNome && (
          <>
            <ChevronRight className="h-4 w-4 text-rose-500" />
            <Link
              to="/alunos/$id"
              params={{ id: full.assessment.student_id }}
              className="text-muted-foreground hover:text-foreground"
            >
              {alunoNome}
            </Link>
          </>
        )}
        <ChevronRight className="h-4 w-4 text-rose-500" />
        <span className="font-semibold text-foreground">Avaliação Física</span>
      </div>
      <AvaliacaoView full={full} onChanged={() => setTick((t) => t + 1)} />
    </div>
  );
}
