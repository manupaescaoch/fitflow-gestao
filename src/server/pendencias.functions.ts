import { createServerFn } from "@tanstack/react-start";
import { requireAuthOrCron } from "./auth-or-cron.middleware";
import {
  listPendenciasImpl,
  registrarEnvioManualImpl,
  listHistoricoAcoesImpl,
  agendarCiclosAlunosAtivosImpl,
  type PendenciasFiltro,
  type PendenciasResultado,
  type PendenciaItem,
  type TipoPendencia,
  type StatusAtendimento,
} from "./pendencias-core.server";

export type { PendenciasResultado, PendenciaItem, TipoPendencia, StatusAtendimento };

export const listPendenciasComunicacao = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .inputValidator((d: PendenciasFiltro | undefined) => ({
    unidade: d?.unidade ?? null,
    tipo: d?.tipo ?? null,
    status: d?.status ?? null,
    de: d?.de ?? null,
    ate: d?.ate ?? null,
    responsavel: d?.responsavel ?? null,
  }))
  .handler(async ({ data }) => listPendenciasImpl(data));

export const registrarEnvioManualPendencia = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .inputValidator((d: {
    alunoId: string;
    tipo: TipoPendencia;
    dataPrevista?: string | null;
    observacao?: string | null;
    jobId?: string | null;
    acao?: "enviado_manual" | "resolvido";
  }) => {
    if (!d?.alunoId) throw new Error("alunoId obrigatório");
    if (d?.tipo !== "feedback_mensal" && d?.tipo !== "feedback_quinzenal") throw new Error("tipo inválido");
    return {
      alunoId: d.alunoId,
      tipo: d.tipo,
      dataPrevista: d.dataPrevista ?? null,
      observacao: typeof d.observacao === "string" && d.observacao.trim() ? d.observacao.trim() : null,
      jobId: d.jobId ?? null,
      acao: d.acao === "resolvido" ? ("resolvido" as const) : ("enviado_manual" as const),
    };
  })
  .handler(async ({ data, context }) =>
    registrarEnvioManualImpl({ ...data, usuarioId: (context as any)?.userId ?? null }),
  );

export const listHistoricoPendencias = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .handler(async () => listHistoricoAcoesImpl(100));

export const agendarCiclosAlunosAtivos = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .handler(async () => agendarCiclosAlunosAtivosImpl());
