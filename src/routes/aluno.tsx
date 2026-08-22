import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { BottomNav } from "@/components/aluno-app/BottomNav";
import { CheckinDiarioModal } from "@/components/aluno-app/CheckinDiarioModal";
import { CheckinSegundaModal } from "@/components/aluno-app/CheckinSegundaModal";
import { getAlunoSession, useAlunoSession } from "@/lib/aluno-session";

export const Route = createFileRoute("/aluno")({
  component: AlunoLayout,
});

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isDesktop;
}

function AlunoLayout() {
  const { session, hydrated } = useAlunoSession();
  const nav = useNavigate();
  const isDesktop = useIsDesktop();
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const isTrocaSenha = pathname === "/aluno/trocar-senha";

  useEffect(() => {
    if (!hydrated) return;
    if (!session) {
      // Fallback robusto pra PWA standalone (iOS), onde nav às vezes não dispara
      try {
        nav({ to: "/login" });
      } catch {}
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
      return;
    }
    const currentSession = getAlunoSession() ?? session;
    if (currentSession.deveTrocarSenha && !isTrocaSenha) {
      nav({ to: "/aluno/trocar-senha" });
    }
  }, [hydrated, session, nav, isTrocaSenha]);

  if (!hydrated || !session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-[#F70906]/20 border-t-[#F70906] animate-spin" />
      </div>
    );
  }

  // Conteúdo do app — mesma estrutura mobile/desktop
  // BottomNav some apenas na tela de troca de senha (forçada no 1º acesso)
  const showBottomNav = !isTrocaSenha;
  const appContent = (
    <div className="relative min-h-[100dvh] bg-[#FAFAFA] text-black">
      <main
        className="mx-auto w-full max-w-md min-h-[100dvh]"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: showBottomNav
            ? "calc(var(--mobile-bottom-nav-h) + env(safe-area-inset-bottom, 0px))"
            : "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <Outlet />
      </main>
      {showBottomNav && <BottomNav />}
      {showBottomNav && <CheckinDiarioModal />}
      {showBottomNav && <CheckinSegundaModal />}
    </div>
  );

  // Em desktop: renderiza num frame estilo mockup pra deixar claro que é mobile-only
  if (isDesktop) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-100 via-white to-rose-50 flex items-center justify-center p-8">
        <div className="flex items-center gap-10 max-w-5xl w-full">
          {/* Aviso lateral */}
          <div className="hidden lg:flex flex-col flex-1 max-w-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F70906]/10 text-[#F70906] px-3 py-1.5 text-xs font-semibold w-fit">
              <Smartphone className="h-3.5 w-3.5" />
              Experiência mobile
            </div>
            <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-zinc-900">
              O app do aluno foi desenhado pro celular.
            </h2>
            <p className="mt-3 text-sm text-zinc-600 leading-relaxed">
              Pra melhor experiência, abra no seu smartphone. Você pode também instalar o MPTEAM
              como app na sua tela inicial.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-zinc-700">
              <li>
                • iOS: toque em <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b>.
              </li>
              <li>
                • Android: menu do navegador → <b>Instalar app</b>.
              </li>
            </ul>
          </div>

          {/* Frame estilo iPhone */}
          <div className="relative mx-auto">
            <div className="relative w-[390px] h-[820px] rounded-[3rem] bg-black p-3 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.45)]">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-b-2xl z-50" />
              <div className="relative w-full h-full rounded-[2.4rem] overflow-hidden bg-[#FAFAFA]">
                <div className="absolute inset-0 overflow-y-auto">{appContent}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return appContent;
}
