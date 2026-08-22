import { createFileRoute } from "@tanstack/react-router";
import { Leaf } from "lucide-react";
import { toast } from "sonner";
import { BibliotecaListLayout } from "@/components/biblioteca/BibliotecaListLayout";

export const Route = createFileRoute("/_app/biblioteca/fitoterapicos")({
  head: () => ({ meta: [{ title: "Fitoterápicos — Biblioteca" }] }),
  component: () => (
    <BibliotecaListLayout
      title="Fitoterápicos"
      description="Lista de fitoterápicos cadastrados, com finalidade, dose e orientações."
      icon={Leaf}
      onCreate={() => toast.info("Cadastro de fitoterápico: em breve")}
      createLabel="Novo fitoterápico"
      searchPlaceholder="Buscar fitoterápico por nome…"
      isEmpty
    >
      {null}
    </BibliotecaListLayout>
  ),
});