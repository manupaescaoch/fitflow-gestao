import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAssessmentFull, type AssessmentFull } from "@/lib/avaliacao-fisica";
import { AvaliacaoForm } from "@/components/avaliacao/AvaliacaoForm";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/avaliacao-fisica/$id/editar")({
  component: EditarAvaliacaoPage,
});

function EditarAvaliacaoPage() {
  const { id } = useParams({ from: "/_app/avaliacao-fisica/$id/editar" });
  const nav = useNavigate();
  const [full, setFull] = useState<AssessmentFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    getAssessmentFull(id).then((r) => { if (!cancel) { setFull(r); setLoading(false); } });
    return () => { cancel = true; };
  }, [id]);

  if (loading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>;
  }
  if (!full) {
    return <div className="p-8 text-sm text-muted-foreground">Avaliação não encontrada.</div>;
  }
  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <AvaliacaoForm
        initial={full}
        onSaved={(savedId) => nav({ to: "/avaliacao-fisica/$id", params: { id: savedId } })}
        onCancel={() => nav({ to: "/avaliacao-fisica/$id", params: { id } })}
      />
    </div>
  );
}
