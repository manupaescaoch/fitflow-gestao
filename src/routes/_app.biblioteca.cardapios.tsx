import { createFileRoute } from "@tanstack/react-router";
import { UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { BibliotecaListLayout } from "@/components/biblioteca/BibliotecaListLayout";

export const Route = createFileRoute("/_app/biblioteca/cardapios")({
  head: () => ({ meta: [{ title: "Cardápios — Biblioteca" }] }),
  component: () => (
    <BibliotecaListLayout
      title="Cardápios"
      description="Modelos de cardápios salvos para reutilizar em novos planejamentos alimentares."
      icon={UtensilsCrossed}
      onCreate={() => toast.info("Criação de cardápio: em breve")}
      createLabel="Novo cardápio"
      searchPlaceholder="Buscar cardápio por nome…"
      isEmpty
    >
      {null}
    </BibliotecaListLayout>
  ),
});