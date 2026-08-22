import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/configuracoes")({
  component: ConfiguracoesLayout,
});

function ConfiguracoesLayout() {
  const { isAdmin } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!isAdmin) nav({ to: "/visao-geral" }); }, [isAdmin, nav]);
  if (!isAdmin) return null;
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Outlet />
    </div>
  );
}