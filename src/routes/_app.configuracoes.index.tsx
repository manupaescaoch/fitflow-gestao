import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/configuracoes/")({
  beforeLoad: () => {
    throw redirect({ to: "/configuracoes/usuarios" });
  },
});