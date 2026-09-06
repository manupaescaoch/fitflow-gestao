import { createFileRoute } from "@tanstack/react-router";
import { ConfigHeader } from "@/components/configuracoes/ConfigHeader";
import { MotorAutomacoesSection } from "@/components/configuracoes/MotorAutomacoesSection";

export const Route = createFileRoute("/_app/configuracoes/motor")({
  component: MotorPage,
  head: () => ({
    meta: [
      { title: "Motor de Automações | Configurações" },
      { name: "description", content: "Configure o acompanhamento automático dos alunos: ciclo, mensagens fixas, respostas da IA, lembretes e renovação." },
      { property: "og:title", content: "Motor de Automações" },
      { property: "og:description", content: "Controle do acompanhamento automático da consultoria online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MotorPage() {
  return (
    <div className="space-y-6">
      <ConfigHeader
        title="Motor de Automações"
        subtitle="Configure e controle o acompanhamento automático dos alunos, da anamnese à renovação do plano."
      />
      <MotorAutomacoesSection />
    </div>
  );
}
