import { createFileRoute } from "@tanstack/react-router";
import { ConfigHeader } from "@/components/configuracoes/ConfigHeader";
import { WorkflowSection } from "@/components/configuracoes/WorkflowSection";

export const Route = createFileRoute("/_app/configuracoes/automacoes")({
  component: AutomacoesPage,
});

function AutomacoesPage() {
  return (
    <>
      <ConfigHeader
        title="Workflows"
        subtitle="Configurações dos fluxos de mensagens. Para acompanhar disparos, use a Caixa de Saída."
      />
      <WorkflowSection />
    </>
  );
}