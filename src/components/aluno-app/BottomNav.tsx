import { Link, useRouterState } from "@tanstack/react-router";
import { Home, UtensilsCrossed, Repeat2, Users, Trophy } from "lucide-react";
import { motion } from "framer-motion";

type Item = { to: string; label: string; icon: typeof Home; exact?: boolean };
const items: Item[] = [
  { to: "/aluno", label: "Início", icon: Home, exact: true },
  { to: "/aluno/dieta", label: "Dieta", icon: UtensilsCrossed },
  { to: "/aluno/trocas", label: "Trocas", icon: Repeat2 },
  { to: "/aluno/comunidade", label: "Comunidade", icon: Users },
  { to: "/aluno/ranking", label: "Ranking", icon: Trophy },
];

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-black/5"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto max-w-md px-2 pt-1 pb-1 flex items-stretch justify-between">
        {items.map((it) => {
          const active = it.exact ? path === it.to : path.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className="relative flex-1 min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-2xl active:scale-95 transition-transform"
              aria-label={it.label}
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <motion.div
                  layoutId="bottomNavBubble"
                  className="absolute inset-x-1.5 inset-y-1 bg-[#F70906]/10 rounded-2xl"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon
                className={`relative h-[22px] w-[22px] transition-colors ${
                  active ? "text-[#F70906]" : "text-black/55"
                }`}
                strokeWidth={active ? 2.6 : 2}
              />
              <span
                className={`relative text-[10px] font-semibold tracking-tight transition-colors ${
                  active ? "text-[#F70906]" : "text-black/55"
                }`}
              >
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
