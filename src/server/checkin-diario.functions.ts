import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAlunoAuth } from "./aluno-middleware";

const SCORE_DIARIO = 5;

export const getCheckinHoje = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .handler(async ({ context }) => {
    const hoje = new Date().toISOString().slice(0, 10);
    const sb = supabaseAdmin as any;
    const { data: row, error } = await sb
      .from("daily_checkins")
      .select("*")
      .eq("aluno_id", context.alunoId)
      .eq("data_checkin", hoje)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, checkin: row };
  });

export const salvarCheckinDiario = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sono_horas: z.number().min(0).max(24).nullable().optional(),
        qualidade_sono: z.number().int().min(1).max(5).nullable().optional(),
        energia: z.number().int().min(1).max(5).nullable().optional(),
        humor: z.number().int().min(0).max(4).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const hoje = new Date().toISOString().slice(0, 10);
    const payload = {
      aluno_id: context.alunoId,
      data_checkin: hoje,
      sono_horas: data.sono_horas ?? null,
      qualidade_sono: data.qualidade_sono ?? null,
      energia: data.energia ?? null,
      humor: data.humor ?? null,
      score_gerado: SCORE_DIARIO,
    };
    const sb = supabaseAdmin as any;
    const { data: row, error } = await sb
      .from("daily_checkins")
      .upsert(payload, { onConflict: "aluno_id,data_checkin" })
      .select()
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, checkin: row, score: SCORE_DIARIO };
  });

export const getStatsSemanais = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .handler(async ({ context }) => {
    const sb = supabaseAdmin as any;
    const { data: row, error } = await sb
      .from("weekly_checkin_stats")
      .select("*")
      .eq("aluno_id", context.alunoId)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, stats: row };
  });
