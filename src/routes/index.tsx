import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "FITFLOW — Gestão de alunos" },
    { name: "description", content: "Acesse a plataforma FITFLOW para acompanhar alunos, treinos e dietas." },
    { property: "og:title", content: "FITFLOW — Gestão de alunos" },
    { property: "og:description", content: "Gestão e acompanhamento de alunos na FITFLOW." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/visao-geral" });
  },
});
