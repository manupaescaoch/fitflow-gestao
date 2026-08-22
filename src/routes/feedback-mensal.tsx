import { createFileRoute } from "@tanstack/react-router";
import { PublicFormularioPublico } from "@/components/publico/PublicFormularioPublico";

export const Route = createFileRoute("/feedback-mensal")({
  head: () => ({
    meta: [
      { title: "Feedback Mensal | MPTEAM" },
      { name: "description", content: "Envie seu feedback mensal de evolução para a equipe MPTEAM e mantenha sua consultoria atualizada." },
    ],
  }),
  component: FeedbackMensalPublicaPage,
});

function FeedbackMensalPublicaPage() {
  return <PublicFormularioPublico tipo="feedback_mensal" />;
}