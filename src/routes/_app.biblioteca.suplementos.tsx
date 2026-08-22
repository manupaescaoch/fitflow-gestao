import { createFileRoute } from "@tanstack/react-router";
import { Pill } from "lucide-react";
import { toast } from "sonner";
import { BibliotecaListLayout } from "@/components/biblioteca/BibliotecaListLayout";

export const Route = createFileRoute("/_app/biblioteca/suplementos")({
  head: () => ({ meta: [{ title: "Suplementos — Biblioteca" }] }),
  component: () => (
    <BibliotecaListLayout
      title="Suplementos"
      description="Biblioteca de suplementos cadastrados, com dose, forma de uso e observações."
      icon={Pill}
      onCreate={() => toast.info("Cadastro de suplemento: em breve")}
      createLabel="Novo suplemento"
      searchPlaceholder="Buscar suplemento por nome…"
      isEmpty
    >
      {null}
    </BibliotecaListLayout>
  ),
});