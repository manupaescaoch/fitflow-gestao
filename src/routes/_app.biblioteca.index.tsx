import { createFileRoute } from "@tanstack/react-router";
import {
  BookOpen, UtensilsCrossed, Apple, ChefHat,
  FileText, Pill, Leaf,
} from "lucide-react";
import { BibliotecaCard } from "@/components/biblioteca/BibliotecaCard";

export const Route = createFileRoute("/_app/biblioteca/")({
  head: () => ({
    meta: [
      { title: "Biblioteca — MPTEAM" },
      { name: "description", content: "Acesse e gerencie suas opções salvas de planos, alimentos, prescrições e protocolos." },
    ],
  }),
  component: BibliotecaIndex,
});

const PLANO_ALIMENTAR = [
  {
    to: "/biblioteca/cardapios",
    title: "Cardápios",
    description: "Modelos de cardápios salvos para reutilizar em novos planejamentos alimentares.",
    icon: UtensilsCrossed,
    tone: "orange" as const,
  },
  {
    to: "/biblioteca/alimentos",
    title: "Alimentos",
    description: "Base de alimentos cadastrados com informações nutricionais, porções e medidas caseiras.",
    icon: Apple,
    tone: "emerald" as const,
  },
  {
    to: "/biblioteca/receitas",
    title: "Receitas",
    description: "Receitas salvas para incluir nos planos alimentares dos alunos.",
    icon: ChefHat,
    tone: "amber" as const,
  },
];

const PRESCRICAO = [
  {
    to: "/biblioteca/prescricoes",
    title: "Modelos de Prescrição",
    description: "Modelos prontos de prescrições alimentares, orientações e estruturas reutilizáveis.",
    icon: FileText,
    tone: "rose" as const,
  },
  {
    to: "/biblioteca/suplementos",
    title: "Suplementos",
    description: "Biblioteca de suplementos cadastrados, com dose, forma de uso e observações.",
    icon: Pill,
    tone: "indigo" as const,
  },
  {
    to: "/biblioteca/fitoterapicos",
    title: "Fitoterápicos",
    description: "Lista de fitoterápicos cadastrados, com finalidade, dose e orientações.",
    icon: Leaf,
    tone: "emerald" as const,
  },
];

function BibliotecaIndex() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="hidden sm:grid w-11 h-11 place-items-center rounded-xl bg-rose-50 text-rose-600 shrink-0">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Biblioteca</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Acesse e gerencie suas opções salvas de planos, alimentos, prescrições e protocolos.
          </p>
        </div>
      </div>

      {/* Plano Alimentar */}
      <section className="space-y-3">
        <SectionHeader label="Plano Alimentar" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLANO_ALIMENTAR.map((c) => (
            <BibliotecaCard key={c.to} {...c} />
          ))}
        </div>
      </section>

      {/* Prescrição */}
      <section className="space-y-3">
        <SectionHeader label="Prescrição" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PRESCRICAO.map((c) => (
            <BibliotecaCard key={c.to} {...c} />
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-[11px] font-bold tracking-[0.18em] uppercase text-muted-foreground">{label}</h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}