import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { AvaliacaoForm } from "@/components/avaliacao/AvaliacaoForm";

const search = z.object({ aluno: z.string().optional() });

export const Route = createFileRoute("/_app/avaliacao-fisica/nova")({
  validateSearch: search,
  component: NovaAvaliacaoPage,
});

function NovaAvaliacaoPage() {
  const nav = useNavigate();
  const { aluno } = useSearch({ from: "/_app/avaliacao-fisica/nova" });
  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <AvaliacaoForm
        alunoId={aluno}
        onSaved={(id) => nav({ to: "/avaliacao-fisica/$id", params: { id } })}
        onCancel={() => nav({ to: "/avaliacao-fisica" })}
      />
    </div>
  );
}
