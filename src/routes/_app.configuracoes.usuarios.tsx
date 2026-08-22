import { createFileRoute } from "@tanstack/react-router";
import { ConfigHeader } from "@/components/configuracoes/ConfigHeader";
import { UsuariosSection } from "@/components/configuracoes/UsuariosSection";

export const Route = createFileRoute("/_app/configuracoes/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  return (
    <>
      <ConfigHeader title="Usuários" subtitle="Gestão de usuários do CRM." />
      <UsuariosSection />
    </>
  );
}