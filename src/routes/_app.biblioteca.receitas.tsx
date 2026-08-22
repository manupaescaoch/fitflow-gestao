import { createFileRoute } from "@tanstack/react-router";
import { ChefHat } from "lucide-react";
import { toast } from "sonner";
import { BibliotecaListLayout } from "@/components/biblioteca/BibliotecaListLayout";

export const Route = createFileRoute("/_app/biblioteca/receitas")({
  head: () => ({ meta: [{ title: "Receitas — Biblioteca" }] }),
  component: () => (
    <BibliotecaListLayout
      title="Receitas"
      description="Receitas salvas para incluir nos planos alimentares dos alunos."
      icon={ChefHat}
      onCreate={() => toast.info("Criação de receita: em breve")}
      createLabel="Nova receita"
      searchPlaceholder="Buscar receita por nome…"
      isEmpty
    >
      {null}
    </BibliotecaListLayout>
  ),
});