import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { PreviaPdfModal } from "@/components/dieta/PreviaPdfModal";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
       { title: "FITFLOW" },
       { name: "description", content: "FITFLOW — plataforma de consultoria fitness e nutricional para acompanhar alunos, dietas, treinos e evolução." },
      { name: "author", content: "Lovable" },
      { name: "theme-color", content: "#2563EB" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
       { name: "apple-mobile-web-app-title", content: "FITFLOW" },
      { name: "mobile-web-app-capable", content: "yes" },
       { property: "og:title", content: "FITFLOW" },
       { property: "og:description", content: "FITFLOW — consultoria fitness e nutricional online. Dietas, treinos e evolução." },
      { property: "og:type", content: "website" },
       { property: "og:site_name", content: "FITFLOW" },
      { name: "twitter:card", content: "summary" },
       { name: "twitter:title", content: "FITFLOW" },
       { name: "twitter:description", content: "FITFLOW — consultoria fitness e nutricional online." },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
       { rel: "icon", type: "image/png", href: "/favicon.png" },
       { rel: "apple-touch-icon", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "FITFLOW",
              url: "https://fitflow-gestao.lovable.app",
              logo: "https://fitflow-gestao.lovable.app/favicon.png",
              description: "Consultoria fitness e nutricional online com acompanhamento personalizado de dietas, treinos e evolução.",
            },
            {
              "@type": "WebSite",
              name: "FITFLOW",
              url: "https://fitflow-gestao.lovable.app",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <PreviaPdfModal />
      <Toaster position="top-center" />
    </AuthProvider>
  );
}
