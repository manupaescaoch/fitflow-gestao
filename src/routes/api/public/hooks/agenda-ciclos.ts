import { createFileRoute } from "@tanstack/react-router";
import { checkCronAuth } from "@/server/cron-auth.server";
import { checarBloqueioFimDeSemana } from "@/server/weekend-lock.server";
import { agendarCiclosAlunosAtivosImpl } from "@/server/pendencias-core.server";

/**
 * Cron diário: garante o agendamento do check-in quinzenal (15d) e do
 * feedback mensal (30d) para TODO aluno ativo, independentemente da cadeia
 * de entregas/respostas. Evita que alunos fiquem sem acompanhamento.
 */
export const Route = createFileRoute("/api/public/hooks/agenda-ciclos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = checkCronAuth(request);
        if (unauth) return unauth;
        const bloq = checarBloqueioFimDeSemana(request, "agenda-ciclos");
        if (bloq) return bloq;
        try {
          const r = await agendarCiclosAlunosAtivosImpl();
          return new Response(JSON.stringify(r), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "erro" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
