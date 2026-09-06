import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import {
  LayoutGrid, Users, BarChart3, Gauge,
  LogOut, DollarSign, Settings, ChevronDown, Menu, MoreHorizontal, BookOpen, MessageSquare, Inbox,
} from "lucide-react";
import { type ReactNode, useState, useEffect } from "react";
import mpLogo from "@/assets/mp-logo.png";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  admin?: boolean;
  children?: { to: string; label: string; exact?: boolean; group?: string }[];
}

const NAV: NavItem[] = [
  { to: "/visao-geral", label: "Visão Geral", icon: LayoutGrid },
  { to: "/dashboard", label: "Dashboard", icon: Gauge, admin: true },
  { to: "/alunos",    label: "Alunos",    icon: Users },
  { to: "/caixa-saida", label: "Caixa de Saída", icon: Inbox, admin: true },
  {
    to: "/biblioteca", label: "Biblioteca", icon: BookOpen,
    children: [
      { to: "/biblioteca", label: "Visão geral", exact: true },
      { to: "/biblioteca/cardapios", label: "Cardápios", group: "Plano alimentar" },
      { to: "/biblioteca/alimentos", label: "Alimentos", group: "Plano alimentar" },
      { to: "/biblioteca/receitas", label: "Receitas", group: "Plano alimentar" },
      { to: "/biblioteca/prescricoes", label: "Modelos de Prescrição", group: "Prescrição" },
      { to: "/biblioteca/suplementos", label: "Suplementos", group: "Prescrição" },
      { to: "/biblioteca/fitoterapicos", label: "Fitoterápicos", group: "Prescrição" },
      { to: "/biblioteca/protocolos", label: "Protocolos", group: "Prescrição" },
    ],
  },
  { to: "/forms", label: "Formulários", icon: ClipboardList },
  { to: "/feedbacks", label: "Feedbacks", icon: MessageSquare, admin: true },
  { to: "/relatorios",label: "Relatórios",icon: BarChart3, admin: true },
  {
    to: "/financeiro", label: "Financeiro", icon: DollarSign, admin: true,
    children: [
      { to: "/financeiro", label: "Dashboard", exact: true },
      { to: "/financeiro/recebimentos", label: "Recebimentos" },
      { to: "/financeiro/despesas", label: "Despesas" },
      { to: "/financeiro/cadastros", label: "Cadastros" },
    ],
  },
  {
    to: "/configuracoes", label: "Configurações", icon: Settings, admin: true,
    children: [
      { to: "/configuracoes/usuarios", label: "Usuários" },
      { to: "/configuracoes/conexoes", label: "Conexões" },
      { to: "/configuracoes/automacoes", label: "Workflows" },
      { to: "/configuracoes/qa", label: "QA" },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { crmUser, isAdmin, signOut } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV.forEach((i) => { if (i.children && loc.pathname.startsWith(i.to)) init[i.to] = true; });
    return init;
  });

  const items = NAV.filter((i) => !i.admin || isAdmin);
  const isImmersive = /^\/alunos\/[^/]+$/.test(loc.pathname);

  const handleLogout = async () => {
    await signOut();
    nav({ to: "/login" });
  };

  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);
  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      NAV.forEach((i) => {
        if (i.children && loc.pathname.startsWith(i.to) && next[i.to] === undefined) {
          next[i.to] = true;
        }
      });
      return next;
    });
  }, [loc.pathname]);

  const renderNavItems = (onClick?: () => void) => (
    <>
      {items.map((item) => {
        const active = loc.pathname.startsWith(item.to);
        const Icon = item.icon;
        if (item.children) {
          const isOpen = expanded[item.to] ?? active;
          return (
            <div key={item.to}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setExpanded((p) => ({ ...p, [item.to]: !isOpen }));
                  if (!active) {
                    nav({ to: item.to });
                    onClick?.();
                  }
                }}
                className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors text-left ${
                  active
                    ? "bg-rose-50 text-rose-600 font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 opacity-90" />
                  {item.label}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="mt-1 ml-7 pl-3 border-l border-border space-y-0.5">
                  {item.children.map((c, idx) => {
                    const childActive = c.exact
                      ? loc.pathname === c.to || loc.pathname === c.to + "/"
                      : loc.pathname.startsWith(c.to);
                    const prevGroup = idx > 0 ? item.children![idx - 1].group : undefined;
                    const showGroup = c.group && c.group !== prevGroup;
                    return (
                      <div key={c.to}>
                        {showGroup && (
                          <div className={`px-3 ${idx === 0 ? "pt-1" : "pt-2"} pb-1 text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground/70`}>
                            {c.group}
                          </div>
                        )}
                        <Link
                          to={c.to}
                          onClick={onClick}
                          className={`block rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                            childActive
                              ? "bg-muted text-rose-600 font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                          }`}
                        >
                          {c.label}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors ${
              active
                ? "bg-rose-50 text-rose-600 font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <Icon className="h-4 w-4 opacity-90" />
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen w-full">
      {!isImmersive && (
      <aside className="hidden md:flex w-[220px] flex-col border-r border-border bg-sidebar">
        <div className="px-5 py-7 border-b border-border">
          <Link to="/visao-geral" className="flex items-center gap-2.5">
            <img src={mpLogo} alt="MP Team" className="h-8 w-8 rounded" />
            <div>
              <div className="text-[15px] font-black tracking-tight text-foreground leading-none">MPTEAM</div>
              <div className="text-[9px] font-medium text-muted-foreground tracking-[0.3em] mt-1">CRM</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-5 space-y-0.5">
          {renderNavItems()}
        </nav>
        <div className="px-3 py-4 border-t border-border">
          <div className="px-2 py-2 mb-2 text-xs">
            <div className="text-foreground font-medium truncate">{crmUser?.nome ?? crmUser?.email}</div>
            <div className="text-muted-foreground capitalize">{crmUser?.perfil}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>
      )}
      <main className="flex-1 min-w-0 max-w-full overflow-x-hidden">
        {!isImmersive && (
          <header className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-background/95 backdrop-blur px-3 py-2.5 pt-[max(0.625rem,var(--safe-top))] pl-[max(0.75rem,var(--safe-left))] pr-[max(0.75rem,var(--safe-right))]">
            <div className="flex items-center gap-2">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    aria-label="Abrir menu"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-muted"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[270px] p-0 flex flex-col">
                  <div className="px-5 py-5 border-b border-border">
                    <Link to="/visao-geral" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
                      <img src={mpLogo} alt="MP Team" className="h-8 w-8 rounded" />
                      <div>
                        <div className="text-[15px] font-black tracking-tight text-foreground leading-none">MPTEAM</div>
                        <div className="text-[9px] font-medium text-muted-foreground tracking-[0.3em] mt-1">CRM</div>
                      </div>
                    </Link>
                  </div>
                  <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
                    {renderNavItems(() => setMobileOpen(false))}
                  </nav>
                  <div className="px-3 py-3 border-t border-border">
                    <div className="px-2 py-2 mb-1 text-xs">
                      <div className="text-foreground font-medium truncate">{crmUser?.nome ?? crmUser?.email}</div>
                      <div className="text-muted-foreground capitalize">{crmUser?.perfil}</div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <LogOut className="h-4 w-4" /> Sair
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
              <Link to="/visao-geral" className="flex items-center gap-2">
                <img src={mpLogo} alt="MP Team" className="h-7 w-7 rounded" />
                <span className="text-base font-black text-foreground">MPTEAM</span>
              </Link>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Sair"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </header>
        )}
        <div className="p-3 pb-mobile-nav sm:p-4 md:p-6 md:pb-6">{children}</div>
        {!isImmersive && (
          <MobileBottomNav
            isAdmin={!!isAdmin}
            currentPath={loc.pathname}
            onLogout={handleLogout}
            userLabel={crmUser?.nome ?? crmUser?.email ?? ""}
            userPerfil={crmUser?.perfil ?? ""}
          />
        )}
      </main>
    </div>
  );
}

/* =====================================================
 * Bottom nav fixa (mobile only)
 * ===================================================== */
function MobileBottomNav({
  isAdmin, currentPath, onLogout, userLabel, userPerfil,
}: {
  isAdmin: boolean;
  currentPath: string;
  onLogout: () => void;
  userLabel: string;
  userPerfil: string;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { setMoreOpen(false); }, [currentPath]);

  const allTabs: { to: string; label: string; icon: typeof LayoutGrid; match: (p: string) => boolean; admin?: boolean }[] = [
    { to: "/visao-geral", label: "Início",     icon: LayoutGrid,  match: (p) => p.startsWith("/visao-geral") },
    { to: "/alunos",      label: "Alunos",     icon: Users,       match: (p) => p.startsWith("/alunos") },
    { to: "/relatorios",  label: "Relatórios", icon: BarChart3,   match: (p) => p.startsWith("/relatorios"), admin: true },
  ];
  const tabs = allTabs.filter((t) => !t.admin || isAdmin);
  const gridCols = tabs.length === 3 ? "grid-cols-4" : "grid-cols-3";

  const moreActive = currentPath.startsWith("/financeiro") || currentPath.startsWith("/configuracoes") || currentPath.startsWith("/feedbacks");

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur pb-safe pl-safe pr-safe"
      aria-label="Navegação principal"
    >
      <ul className={`grid ${gridCols}`}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = t.match(currentPath);
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "opacity-100" : "opacity-80"}`} />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                className={`flex w-full flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  moreActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <MoreHorizontal className="h-5 w-5 opacity-90" />
                <span>Mais</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl p-0 max-h-[80vh] overflow-y-auto pb-safe">
              <div className="px-5 pt-5 pb-3">
                <div className="text-sm font-semibold text-foreground truncate">{userLabel}</div>
                {userPerfil && <div className="text-xs text-muted-foreground capitalize">{userPerfil}</div>}
              </div>
              <div className="px-3 pb-3 space-y-1">
                <MoreLink to="/biblioteca" icon={BookOpen} label="Biblioteca" />
                <MoreLink to="/biblioteca/cardapios" icon={BookOpen} label="Cardápios" indent />
                <MoreLink to="/biblioteca/alimentos" icon={BookOpen} label="Alimentos" indent />
                <MoreLink to="/biblioteca/receitas" icon={BookOpen} label="Receitas" indent />
                <MoreLink to="/biblioteca/prescricoes" icon={BookOpen} label="Modelos de Prescrição" indent />
                <MoreLink to="/biblioteca/suplementos" icon={BookOpen} label="Suplementos" indent />
                <MoreLink to="/biblioteca/fitoterapicos" icon={BookOpen} label="Fitoterápicos" indent />
                <MoreLink to="/biblioteca/protocolos" icon={BookOpen} label="Protocolos" indent />
                {isAdmin && (
                  <>
                    <MoreLink to="/dashboard" icon={Gauge} label="Dashboard" />
                    <MoreLink to="/feedbacks" icon={MessageSquare} label="Feedbacks" />
                    <MoreLink to="/financeiro" icon={DollarSign} label="Financeiro" />
                    <MoreLink to="/financeiro/recebimentos" icon={DollarSign} label="Recebimentos" indent />
                    <MoreLink to="/financeiro/despesas" icon={DollarSign} label="Despesas" indent />
                    <MoreLink to="/financeiro/cadastros" icon={DollarSign} label="Cadastros" indent />
                    <MoreLink to="/configuracoes" icon={Settings} label="Configurações" />
                    <MoreLink to="/configuracoes/usuarios" icon={Settings} label="Usuários" indent />
                    <MoreLink to="/configuracoes/conexoes" icon={Settings} label="Conexões" indent />
                    <MoreLink to="/configuracoes/automacoes" icon={Settings} label="Workflows" indent />
                  </>
                )}
              </div>
              <div className="px-3 pb-5 border-t border-border pt-3">
                <button
                  onClick={onLogout}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" /> Sair
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}

function MoreLink({ to, icon: Icon, label, indent }: { to: string; icon: typeof LayoutGrid; label: string; indent?: boolean }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-md py-2.5 text-sm text-foreground hover:bg-muted ${indent ? "pl-10 pr-3 text-[13px] text-muted-foreground" : "px-3"}`}
    >
      {!indent && <Icon className="h-4 w-4 opacity-80" />}
      <span>{label}</span>
    </Link>
  );
}

export function ModalidadeTag({ m }: { m: Database_Modalidade }) {
  const labels: Record<string, string> = {
    mpteam: "MPTEAM", mp_elite: "MP Elite", mp_presencial: "MP Presencial",
  };
  if (!m) return <span className="text-muted-foreground text-xs">—</span>;
  const colors: Record<string, string> = {
    mpteam: "var(--tag-mpteam)",
    mp_elite: "var(--tag-elite)",
    mp_presencial: "var(--tag-presencial)",
  };
  const textColors: Record<string, string> = {
    mpteam: "#fff",
    mp_elite: "#fff",
    mp_presencial: "#fff",
  };
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none"
      style={{ backgroundColor: colors[m], color: textColors[m] }}
    >
      {labels[m]}
    </span>
  );
}

type Database_Modalidade = "mpteam" | "mp_elite" | "mp_presencial" | null;