import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TransacoesPage } from "./_app.financeiro.transacoes";
import { ContasPagarPage } from "./_app.financeiro.contas-pagar";

const searchSchema = z.object({
  tab: z.enum(["transacoes", "contas-pagar"]).optional(),
});

export const Route = createFileRoute("/_app/financeiro/despesas")({
  component: DespesasPage,
  validateSearch: (s) => searchSchema.parse(s),
});

function DespesasPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const active = tab ?? "transacoes";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Despesas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Transações lançadas e contas a pagar.
        </p>
      </div>
      <Tabs
        value={active}
        onValueChange={(v) =>
          navigate({
            to: "/financeiro/despesas",
            search: { tab: v as "transacoes" | "contas-pagar" },
          })
        }
      >
        <TabsList>
          <TabsTrigger value="transacoes">Transações</TabsTrigger>
          <TabsTrigger value="contas-pagar">Contas a Pagar</TabsTrigger>
        </TabsList>
        <TabsContent value="transacoes" className="mt-6">
          <TransacoesPage />
        </TabsContent>
        <TabsContent value="contas-pagar" className="mt-6">
          <ContasPagarPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}