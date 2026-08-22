import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Lógica pura da auto-cura. Importada tanto pelo serverFn (UI autenticada)
 * quanto pelo hook público /api/public/hooks/cura-entregas (cron).
 */
export async function curarEntregasFaltantesImpl() {
  const desde = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  const { data: forms, error } = await supabaseAdmin
    .from("formularios")
    .select("id, aluno_id, tipo, respondido_em")
    .in("tipo", ["anamnese", "feedback_mensal"])
    .eq("respondido", true)
    .not("aluno_id", "is", null)
    .gte("respondido_em", desde);

  if (error) throw new Error(error.message);

  const criadas: Array<{ aluno_id: string; tipo: string; data_referencia: string }> = [];
  const erros: Array<{ aluno_id: string; erro: string }> = [];

  for (const f of forms ?? []) {
    const alunoId = f.aluno_id as string;
    const respondidoEm = f.respondido_em as string | null;
    if (!respondidoEm) continue;
    const { data: limiteData, error: eCalc } = await supabaseAdmin.rpc(
      "calcular_data_limite_entrega",
      { data_base: respondidoEm.slice(0, 10) },
    );
    if (eCalc || !limiteData) continue;
    const dataRef = limiteData as unknown as string;

    const { data: existente } = await supabaseAdmin
      .from("entregas_dia")
      .select("id")
      .eq("aluno_id", alunoId)
      .eq("data_referencia", dataRef)
      .maybeSingle();
    if (existente) continue;

    const { data: exclusao } = await supabaseAdmin
      .from("entregas_dia_log")
      .select("id")
      .eq("aluno_id", alunoId)
      .eq("data_referencia", dataRef)
      .eq("origem", "manual_exclusao")
      .limit(1)
      .maybeSingle();
    if (exclusao) continue;

    const insertPayload: Record<string, unknown> = {
      aluno_id: alunoId,
      data_referencia: dataRef,
    };
    if (f.tipo === "anamnese") {
      insertPayload.d0_confirmado = true;
      insertPayload.d0_confirmado_em = new Date().toISOString();
      insertPayload.d0_confirmado_por = "auto_cura";
    }

    const { error: eIns } = await supabaseAdmin
      .from("entregas_dia")
      .insert(insertPayload as never);
    if (eIns) {
      erros.push({ aluno_id: alunoId, erro: eIns.message });
      continue;
    }
    criadas.push({ aluno_id: alunoId, tipo: f.tipo as string, data_referencia: dataRef });

    await supabaseAdmin.from("entregas_dia_log").insert({
      aluno_id: alunoId,
      origem: "auto_cura_diaria",
      tipo_evento: f.tipo as string,
      data_referencia: dataRef,
      data_base: respondidoEm.slice(0, 10),
      resultado: "criado_via_cura",
      detalhes: { formulario_id: f.id },
    } as never);
  }

  return { verificadas: forms?.length ?? 0, criadas, erros };
}
