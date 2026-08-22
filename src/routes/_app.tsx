import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { loading, session, crmUser, isAdmin } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (!loading && !session) nav({ to: "/login" });
  }, [loading, session, nav]);

  // Bloqueia rotas admin-only para não-admins
  useEffect(() => {
    if (loading || !crmUser) return;
    const adminOnly = ["/financeiro", "/configuracoes", "/admin", "/dashboard"];
    const blocked = adminOnly.some((p) => loc.pathname.startsWith(p));
    if (blocked && !isAdmin) nav({ to: "/visao-geral" });
  }, [loading, crmUser, isAdmin, loc.pathname, nav]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>;
  }
  if (!session) return null;

  if (!crmUser) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold mb-2">Conta sem perfil no CRM</h2>
          <p className="text-sm text-muted-foreground mb-4">Sua conta foi criada mas não está associada a um perfil. Se um administrador já liberou seu acesso, saia e entre novamente.</p>
          <button
            onClick={async () => { await supabase.auth.signOut(); nav({ to: "/login" }); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Sair e entrar novamente
          </button>
        </div>
      </div>
    );
  }

  return <AppShell><Outlet /></AppShell>;
}