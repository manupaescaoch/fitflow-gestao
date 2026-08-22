import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { requireAlunoAuth } from "./aluno-middleware";

function hojeStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Registra (ou subtrai) consumo de água em ml. */
export const registrarAgua = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ml: z.number().int().refine((v) => v !== 0, "ml não pode ser 0"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.from("aluno_agua_log").insert({
      aluno_id: context.alunoId,
      data_referencia: hojeStr(),
      ml: data.ml,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Marca/desmarca cardio ou treino concluído no dia. */
export const toggleAtividade = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tipo: z.enum(["cardio", "treino"]),
        concluido: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("aluno_atividades_dia")
      .upsert(
        {
          aluno_id: context.alunoId,
          data_referencia: hojeStr(),
          tipo: data.tipo,
          concluido: data.concluido,
        },
        { onConflict: "aluno_id,data_referencia,tipo" },
      );
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Marca/desmarca refeição feita. */
export const toggleRefeicao = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        refeicao_id: z.string().uuid().nullable().optional(),
        refeicao_nome: z.string().optional(),
        feito: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const aluno_id = context.alunoId;
    const data_ref = hojeStr();
    if (data.feito) {
      const { error } = await supabaseAdmin
        .from("aluno_refeicoes_log")
        .upsert(
          {
            aluno_id,
            data_referencia: data_ref,
            refeicao_id: data.refeicao_id ?? null,
            refeicao_nome: data.refeicao_nome ?? null,
          },
          { onConflict: "aluno_id,data_referencia,refeicao_id" },
        );
      if (error) return { ok: false as const, error: error.message };
    } else {
      const q = supabaseAdmin
        .from("aluno_refeicoes_log")
        .delete()
        .eq("aluno_id", aluno_id)
        .eq("data_referencia", data_ref);
      if (data.refeicao_id) q.eq("refeicao_id", data.refeicao_id);
      const { error } = await q;
      if (error) return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });