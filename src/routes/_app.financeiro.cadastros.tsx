import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PlanosPage } from "./_app.financeiro.planos";

const searchSchema = z.object({
  tab: z.enum(["planos"]).optional(),
});

export const Route = createFileRoute("/_app/financeiro/cadastros")({
  component: CadastrosPage,
  validateSearch: (s) => searchSchema.parse(s),
});

function CadastrosPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const active = tab ?? "planos";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cadastros</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Planos comerciais oferecidos para os alunos.
        </p>
      </div>
      <Tabs
        value={active}
        onValueChange={(v) =>
          navigate({
            to: "/financeiro/cadastros",
            search: { tab: v as "planos" },
          })
        }
      >
        <TabsList>
          <TabsTrigger value="planos">Planos</TabsTrigger>
        </TabsList>
        <TabsContent value="planos" className="mt-6">
          <PlanosPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}