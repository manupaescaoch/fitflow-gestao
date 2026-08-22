import { createFileRoute } from "@tanstack/react-router";
import { ConfigHeader } from "@/components/configuracoes/ConfigHeader";
import { ConexoesSection } from "@/components/configuracoes/ConexoesSection";

export const Route = createFileRoute("/_app/configuracoes/conexoes")({
  component: ConexoesPage,
});

function ConexoesPage() {
  return (
    <>
      <ConfigHeader title="Conexões" subtitle="Z-API, OpenAI e links de formulários." />
      <ConexoesSection />
    </>
  );
}