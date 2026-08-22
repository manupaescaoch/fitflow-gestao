import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enviarWhatsAppTeste } from "./zapi-send.server";
import { MSG_ANAMNESE_RECEBIDA } from "./mensagens-fixas";
import { requireAuthOrCron } from "./auth-or-cron.middleware";
import { processarJobsRespostaFeedbackImpl } from "./processar-jobs-feedback-core.server";

// ---------------------------------------------------------------------------
// Anamnese — envio imediato após resposta
// ---------------------------------------------------------------------------
export const notificarAnamneseRespondida = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .inputValidator((data: { formularioId: string }) =>
    z.object({ formularioId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { data: form } = await supabaseAdmin
      .from("formularios")
      .select("id, aluno_id, tipo, respondido")
      .eq("id", data.formularioId)
      .maybeSingle();
    if (!form) return { ok: false, error: "Formulário não encontrado" };
    if (form.tipo !== "anamnese") return { ok: false, error: "Tipo inválido" };
    if (!form.aluno_id) return { ok: false, error: "Sem aluno vinculado" };

    const { data: aluno } = await supabaseAdmin
      .from("alunos")
      .select("nome")
      .eq("id", form.aluno_id)
      .maybeSingle();

    const mensagem = MSG_ANAMNESE_RECEBIDA(aluno?.nome ?? "");
    const r = await enviarWhatsAppTeste({
      alunoId: form.aluno_id,
      tipoJob: "anamnese_recebida",
      mensagem,
    });
    return r;
  });

// ---------------------------------------------------------------------------
// Processador de jobs de resposta de feedback (2h após preenchimento)
// Lê jobs_disparos vencidos dos tipos:
//   - feedback_quinzenal_resposta  → IA prompt feedback_quinzenal
//   - feedback_mensal_resposta     → IA prompt feedback_mensal
//   - pos_feedback_mensal          → mensagem fixa do prazo
// ---------------------------------------------------------------------------

export const processarJobsRespostaFeedback = createServerFn({ method: "POST" })
  .middleware([requireAuthOrCron])
  .handler(async () => processarJobsRespostaFeedbackImpl());
