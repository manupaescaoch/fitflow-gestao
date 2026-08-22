import { createFileRoute } from "@tanstack/react-router";
import { PublicFormularioPublico } from "@/components/publico/PublicFormularioPublico";

export const Route = createFileRoute("/anamnese")({
  head: () => ({
    meta: [
      { title: "Anamnese Inicial | MPTEAM" },
      { name: "description", content: "Preencha sua anamnese inicial para a consultoria MPTEAM." },
    ],
  }),
  component: AnamnesePublicaPage,
});

function AnamnesePublicaPage() {
  return <PublicFormularioPublico tipo="anamnese" />;
}