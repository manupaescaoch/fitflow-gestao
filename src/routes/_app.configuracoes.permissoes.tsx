import { createFileRoute } from "@tanstack/react-router";
import { ConfigHeader } from "@/components/configuracoes/ConfigHeader";
import { PermissoesSection } from "@/components/configuracoes/PermissoesSection";

export const Route = createFileRoute("/_app/configuracoes/permissoes")({
  component: PermissoesPage,
});

function PermissoesPage() {
  return (
    <>
      <ConfigHeader
        title="Permissões"
        subtitle="Controle quais perfis acessam cada módulo do sistema."
      />
      <PermissoesSection />
    </>
  );
}
