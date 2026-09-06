import { createFileRoute } from "@tanstack/react-router";
import { ConfigHeader } from "@/components/configuracoes/ConfigHeader";
import { PersonalizarSection } from "@/components/configuracoes/PersonalizarSection";

export const Route = createFileRoute("/_app/configuracoes/personalizar")({
  component: PersonalizarPage,
  head: () => ({
    meta: [
      { title: "Personalizar | Configurações" },
      { name: "description", content: "Altere o nome e a logo do sistema exibidos no menu e no topo das páginas." },
      { property: "og:title", content: "Personalizar o sistema" },
      { property: "og:description", content: "Nome e logo do sistema em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PersonalizarPage() {
  return (
    <div className="space-y-6">
      <ConfigHeader
        title="Personalizar"
        subtitle="Defina o nome e a logo que identificam o sistema."
      />
      <PersonalizarSection />
    </div>
  );
}
