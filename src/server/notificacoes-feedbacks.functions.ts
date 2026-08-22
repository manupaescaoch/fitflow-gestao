import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  lerConfigFeedbacks, salvarConfigFeedbacks,
  montarSnapshotHoje, formatarSnapshot, formatarMensagens, enviarMensagensFeedbacks,
  type DestinoTipo,
} from "./notificacoes-feedbacks.server";

export const getRespostasFeedbacksConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return await lerConfigFeedbacks();
  });

type SaveInput = {
  ativo: boolean;
  destinoTipo: DestinoTipo;
  destinoValor: string;
};

function validar(d: SaveInput): SaveInput {
  if (typeof d?.ativo !== "boolean") throw new Error("ativo inválido");
  if (d.destinoTipo !== "telefone" && d.destinoTipo !== "grupo") throw new Error("destinoTipo inválido");
  const valor = (d.destinoValor ?? "").trim();
  if (d.ativo && !valor) throw new Error("Informe o destino antes de ativar.");
  if (d.destinoTipo === "telefone" && valor && valor.replace(/\D/g, "").length < 10) {
    throw new Error("Número de telefone inválido. Use DDI+DDD+número.");
  }
  if (d.destinoTipo === "grupo" && valor && valor.length < 6) {
    throw new Error("ID do grupo inválido.");
  }
  return { ativo: d.ativo, destinoTipo: d.destinoTipo, destinoValor: valor };
}

export const saveRespostasFeedbacksConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validar)
  .handler(async ({ data, context }) => {
    await salvarConfigFeedbacks(data, (context as any)?.userId ?? null);
    return { ok: true as const };
  });

export const previewRespostasFeedbacks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const snap = await montarSnapshotHoje();
    const total = snap.enviados.length + snap.respondidos.length + snap.pendentes.length;
    return {
      total,
      mensagem: total ? formatarSnapshot(snap) : null,
    };
  });

export const testarEnvioRespostasFeedbacks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const cfg = await lerConfigFeedbacks();
    if (!cfg.destinoValor) {
      return { ok: false as const, error: "Configure o destino antes de testar." };
    }
    const snap = await montarSnapshotHoje();
    const total = snap.enviados.length + snap.respondidos.length + snap.pendentes.length;
    if (!total) {
      return { ok: false as const, error: "Nenhum evento de feedback no dia. Nada a enviar." };
    }
    const msgs = formatarMensagens(snap);
    const r = await enviarMensagensFeedbacks(cfg.destinoTipo, cfg.destinoValor, msgs);
    if (!r.ok) return { ok: false as const, error: r.error ?? "Falha no envio" };
    return { ok: true as const, total, mensagem: msgs.join("\n\n") };
  });

export const enviarRespostasFeedbacks24h = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const cfg = await lerConfigFeedbacks();
    if (!cfg.destinoValor) {
      return { ok: false as const, error: "Configure o destino antes de enviar." };
    }
    const now = new Date();
    const desde = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const snap = await montarSnapshotHoje(now, desde);
    const total = snap.enviados.length + snap.respondidos.length + snap.pendentes.length;
    if (!total) {
      return { ok: false as const, error: "Nenhum evento de feedback nas últimas 24h." };
    }
    const msgs = formatarMensagens(snap, now);
    const r = await enviarMensagensFeedbacks(cfg.destinoTipo, cfg.destinoValor, msgs);
    if (!r.ok) return { ok: false as const, error: r.error ?? "Falha no envio" };
    return { ok: true as const, total, mensagem: msgs.join("\n\n") };
  });

/**
 * Server function PÚBLICA chamada pelos formulários públicos logo após
 * o aluno enviar a resposta. Dispara o snapshot em tempo real para o grupo.
 * Não retorna detalhes — só "ok" para evitar vazar informação de configuração.
 */
export const notifyFeedbackResponded = createServerFn({ method: "POST" })
  .inputValidator((d: { motivo?: string }) => ({ motivo: typeof d?.motivo === "string" ? d.motivo : "publico" }))
  .handler(async ({ data }) => {
    const { dispararSnapshotRespostasFeedbacks } = await import("./notificacoes-feedbacks.server");
    await dispararSnapshotRespostasFeedbacks(data.motivo);
    return { ok: true as const };
  });