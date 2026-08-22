import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  lerConfig, salvarConfig,
  proximaDataUtilBRT, montarLinhasParaData, formatarMensagem, enviarZapi,
  type DestinoTipo,
} from "./notificacoes-diarias.server";

export const getResumoDiarioConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return await lerConfig();
  });

type SaveInput = {
  ativo: boolean;
  horario: string;
  destinoTipo: DestinoTipo;
  destinoValor: string;
};

function validarSave(d: SaveInput): SaveInput {
  if (typeof d?.ativo !== "boolean") throw new Error("ativo inválido");
  if (typeof d.horario !== "string" || !/^\d{2}:\d{2}$/.test(d.horario)) throw new Error("horário inválido (use HH:MM)");
  if (d.destinoTipo !== "telefone" && d.destinoTipo !== "grupo") throw new Error("destinoTipo inválido");
  const valor = (d.destinoValor ?? "").trim();
  if (d.ativo && !valor) throw new Error("Informe o destino antes de ativar.");
  if (d.destinoTipo === "telefone" && valor && valor.replace(/\D/g, "").length < 10) {
    throw new Error("Número de telefone inválido. Use DDI+DDD+número.");
  }
  if (d.destinoTipo === "grupo" && valor && valor.length < 6) {
    throw new Error("ID do grupo inválido.");
  }
  return { ativo: d.ativo, horario: d.horario, destinoTipo: d.destinoTipo, destinoValor: valor };
}

export const saveResumoDiarioConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validarSave)
  .handler(async ({ data, context }) => {
    await salvarConfig(data, (context as any)?.userId ?? null);
    return { ok: true as const };
  });

export const previewResumoDiario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const dataRef = proximaDataUtilBRT();
    const linhas = await montarLinhasParaData(dataRef);
    return {
      dataRef,
      total: linhas.length,
      mensagem: linhas.length ? formatarMensagem(linhas, dataRef) : null,
    };
  });

export const testarEnvioResumoDiario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const cfg = await lerConfig();
    if (!cfg.destinoValor) {
      return { ok: false as const, error: "Configure o destino antes de testar." };
    }
    const dataRef = proximaDataUtilBRT();
    const linhas = await montarLinhasParaData(dataRef);
    if (!linhas.length) {
      return { ok: false as const, error: "Sem atualizações previstas para o próximo dia útil. Nada a enviar." };
    }
    const mensagem = formatarMensagem(linhas, dataRef);
    const r = await enviarZapi(cfg.destinoTipo, cfg.destinoValor, mensagem);
    if (!r.ok) return { ok: false as const, error: r.error ?? "Falha no envio" };
    return { ok: true as const, total: linhas.length, mensagem };
  });
