import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  lerRoteamento, salvarRoteamento, formatarCorpoRoteado, enviarZapiRoteado, bucketMeta,
  lerBloqueioEnviosAlunos, salvarBloqueioEnviosAlunos,
  type RoteamentoBucket, type DestinoTipo,
} from "./roteamento-grupos.server";

function parseBucket(b: unknown): RoteamentoBucket {
  if (b !== "feedbacks_fu" && b !== "respostas_ia") throw new Error("bucket inválido");
  return b;
}

export const getRoteamentoConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bucket: RoteamentoBucket }) => ({ bucket: parseBucket(d?.bucket) }))
  .handler(async ({ data }) => {
    const cfg = await lerRoteamento(data.bucket);
    const meta = bucketMeta(data.bucket);
    return { ...cfg, rotulo: meta.rotulo };
  });

type SaveInput = {
  bucket: RoteamentoBucket;
  ativo: boolean;
  destinoTipo: DestinoTipo;
  destinoValor: string;
};

function validarSave(d: SaveInput): SaveInput {
  const bucket = parseBucket(d?.bucket);
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
  return { bucket, ativo: d.ativo, destinoTipo: d.destinoTipo, destinoValor: valor };
}

export const saveRoteamentoConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validarSave)
  .handler(async ({ data, context }) => {
    await salvarRoteamento(
      data.bucket,
      { ativo: data.ativo, destinoTipo: data.destinoTipo, destinoValor: data.destinoValor },
      (context as any)?.userId ?? null,
    );
    return { ok: true as const };
  });

export const previewRoteamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bucket: RoteamentoBucket }) => ({ bucket: parseBucket(d?.bucket) }))
  .handler(async ({ data }) => {
    const meta = bucketMeta(data.bucket);
    const tipoExemplo = meta.rotulo === "Feedbacks & Follow-ups" ? "feedback_mensal_resposta" : "Resposta IA — Anamnese";
    const mensagem = formatarCorpoRoteado({
      tipoJob: tipoExemplo,
      alunoNome: "Fulano da Silva",
      alunoTelefone: "5511999999999",
      mensagemOriginal: "Exemplo: este é o conteúdo que normalmente seria enviado direto ao aluno.",
    });
    return { mensagem };
  });

export const testarRoteamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bucket: RoteamentoBucket }) => ({ bucket: parseBucket(d?.bucket) }))
  .handler(async ({ data }) => {
    const cfg = await lerRoteamento(data.bucket);
    if (!cfg.destinoValor.trim()) {
      return { ok: false as const, error: "Configure o destino antes de testar." };
    }
    const meta = bucketMeta(data.bucket);
    const mensagem = formatarCorpoRoteado({
      tipoJob: meta.rotulo,
      alunoNome: "Teste MPTEAM",
      alunoTelefone: "5500000000000",
      mensagemOriginal: `Mensagem de teste do roteamento (${meta.rotulo}).`,
    });
    const r = await enviarZapiRoteado(cfg.destinoTipo, cfg.destinoValor, mensagem);
    if (!r.ok) return { ok: false as const, error: r.error ?? "Falha no envio" };
    return { ok: true as const, mensagem };
  });

export const getBloqueioEnviosAlunos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const ativo = await lerBloqueioEnviosAlunos();
    return { ativo };
  });

export const setBloqueioEnviosAlunos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ativo: boolean }) => {
    if (typeof d?.ativo !== "boolean") throw new Error("ativo inválido");
    return { ativo: d.ativo };
  })
  .handler(async ({ data, context }) => {
    await salvarBloqueioEnviosAlunos(data.ativo, (context as any)?.userId ?? null);
    return { ok: true as const };
  });