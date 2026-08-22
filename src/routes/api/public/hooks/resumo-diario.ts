import { createFileRoute } from "@tanstack/react-router";
import {
  lerConfig, calcularAmanhaBRT, horaAtualBRT, dataEhFimDeSemanaISO,
  montarLinhasParaData, formatarMensagem, enviarZapi, logResumo,
} from "@/server/notificacoes-diarias.server";
import { checkCronAuth } from "@/server/cron-auth.server";
import { checarBloqueioFimDeSemana } from "@/server/weekend-lock.server";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/hooks/resumo-diario")({
  server: {
    handlers: {
        POST: async ({ request }) => {
        const unauth = checkCronAuth(request);
        if (unauth) return unauth;
        const bloq = checarBloqueioFimDeSemana(request, "resumo-diario");
        if (bloq) {
          try { await logResumo({ resultado: "fim_de_semana", dataRef: null, detalhes: { motivo: "trava_fim_de_semana" } }); } catch { /* noop */ }
          return bloq;
        }
        try {
          const cfg = await lerConfig();
          if (!cfg.ativo) {
            await logResumo({ resultado: "desativado", dataRef: null, detalhes: { motivo: "automacao_desligada" } });
            return json(200, { skipped: "desativado" });
          }
          // Regra: o resumo mostra sempre as atualizações do dia SEGUINTE.
          // Como não há atualizações em sábado/domingo, não enviamos na sexta
          // (amanhã=sábado) nem no sábado (amanhã=domingo). Domingo à noite
          // envia o resumo de segunda; demais dias úteis enviam o do próximo dia.
          const dataRef = calcularAmanhaBRT();
          if (dataEhFimDeSemanaISO(dataRef)) {
            await logResumo({ resultado: "fim_de_semana", dataRef, detalhes: {} });
            return json(200, { skipped: "fim_de_semana", dataRef });
          }
          // Janela de 30 min após o horário configurado para tolerar atraso do cron.
          // Pode ser ignorada com header x-force-resumo: 1 para envios manuais.
            const forceHeader = request.headers.get("x-force-resumo") ?? "";
            const force = forceHeader === "1" || forceHeader.toLowerCase() === "true";
          if (!force) {
            const agora = horaAtualBRT();
            const [hCfg, mCfg] = cfg.horario.split(":").map(Number);
            const [hNow, mNow] = agora.split(":").map(Number);
            const minutosCfg = hCfg * 60 + mCfg;
            const minutosNow = hNow * 60 + mNow;
            const diff = minutosNow - minutosCfg; // negativo = ainda não na hora
            if (diff < 0 || diff > 30) {
              await logResumo({ resultado: "fora_horario", dataRef: null, detalhes: { agora, configurado: cfg.horario } });
              return json(200, { skipped: "fora_horario", agora, configurado: cfg.horario });
            }
          }
          if (!cfg.destinoValor) {
            await logResumo({ resultado: "erro", dataRef: null, detalhes: { erro: "destino_nao_configurado" } });
            return json(200, { error: "destino_nao_configurado" });
          }

          const linhas = await montarLinhasParaData(dataRef);
          if (!linhas.length) {
            await logResumo({ resultado: "sem_atualizacoes", dataRef, detalhes: {} });
            return json(200, { skipped: "sem_atualizacoes", dataRef });
          }
          const mensagem = formatarMensagem(linhas, dataRef);
          const r = await enviarZapi(cfg.destinoTipo, cfg.destinoValor, mensagem);
          if (!r.ok) {
            await logResumo({
              resultado: "erro",
              dataRef,
              detalhes: { erro: r.error, destinoTipo: cfg.destinoTipo, mensagem },
            });
            return json(502, { ok: false, error: r.error });
          }
          await logResumo({
            resultado: "enviado",
            dataRef,
            detalhes: { total: linhas.length, destinoTipo: cfg.destinoTipo, mensagem },
          });
          return json(200, { ok: true, total: linhas.length, dataRef });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "erro desconhecido";
          try { await logResumo({ resultado: "erro", dataRef: null, detalhes: { erro: msg } }); } catch { /* noop */ }
          return json(500, { ok: false, error: msg });
        }
      },
    },
  },
});
