import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { enviarWhatsAppTeste } from "./zapi-send.server";
import { MSG_ANAMNESE_RECEBIDA } from "./mensagens-fixas";
import { normalizarTelefoneBR, telefoneValido } from "@/lib/telefone";

/**
 * Server fns para o fluxo de formulários públicos (anamnese, feedback
 * quinzenal/mensal, check shape). Toda a operação é validada por TOKEN —
 * o usuário anônimo nunca lê/escreve direto na tabela `formularios`.
 */

const TipoSchema = z.enum([
  "anamnese",
  "feedback_quinzenal",
  "feedback_mensal",
  "check_shape",
]);

const TipoFeedbackSchema = z.enum(["feedback_quinzenal", "feedback_mensal"]);

/** Cria um novo formulário público (anamnese ou feedback aberto). */
export const iniciarFormularioPublico = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ tipo: TipoSchema, token: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const { data: row, error } = await supabaseAdmin
        .from("formularios")
        .insert({
          tipo: data.tipo,
          token: data.token,
          aluno_id: null,
          origem: "publico",
          respondido: false,
        })
        .select("id")
        .single();
      if (error || !row) {
        console.error("[iniciarFormularioPublico] insert error", error);
        return { ok: false as const, error: error?.message || "Falha ao iniciar formulário" };
      }
      return { ok: true as const, id: row.id, token: data.token };
    } catch (e) {
      console.error("[iniciarFormularioPublico] throw", e);
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      return { ok: false as const, error: msg };
    }
  });

/**
 * Recupera (ou cria) um formulário público de feedback vinculado ao aluno
 * identificado pelo telefone. Usado em links públicos compartilhados (ex:
 * /feedback-mensal) onde o aluno se identifica digitando o WhatsApp.
 *
 * Se já existir um formulário pendente do mesmo tipo para o aluno, devolve
 * o token existente (autosave persiste). Se não existir, cria um novo já
 * vinculado. Se o telefone não corresponder a nenhum aluno cadastrado,
 * retorna ok=false com motivo, sem criar nada.
 */
export const iniciarFormularioPorTelefone = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      tipo: TipoFeedbackSchema,
      telefone: z.string().min(8).max(32),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const canonico = normalizarTelefoneBR(data.telefone);
    if (!telefoneValido(canonico)) {
      return {
        ok: false as const,
        error:
          "Confira o telefone digitado. Precisa ter DDD + número (ex: 81 91234-5678).",
      };
    }

    // 1) Resolve aluno pelo telefone (mesma lógica da função SQL existente).
    const { data: alunoMatch, error: rpcErr } = await supabaseAdmin.rpc(
      "buscar_aluno_por_telefone",
      { _telefone: canonico },
    );
    if (rpcErr) {
      console.error("[iniciarFormularioPorTelefone] rpc error", rpcErr);
      return {
        ok: false as const,
        error:
          "Não conseguimos consultar seu cadastro agora. Tente de novo em alguns instantes.",
      };
    }
    const aluno = Array.isArray(alunoMatch) ? alunoMatch[0] : alunoMatch;
    if (!aluno?.id) {
      return {
        ok: false as const,
        error:
          "Não encontramos esse WhatsApp no cadastro. Confira se digitou o mesmo número usado na anamnese — ou fale com a equipe MPTEAM.",
      };
    }

    // 2) Reaproveita formulário pendente (mais recente) do mesmo tipo.
    const { data: pendente } = await supabaseAdmin
      .from("formularios")
      .select("id, token")
      .eq("aluno_id", aluno.id)
      .eq("tipo", data.tipo)
      .eq("respondido", false)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendente?.id && pendente?.token) {
      return {
        ok: true as const,
        id: pendente.id,
        token: pendente.token,
        alunoNome: aluno.nome ?? null,
        alunoId: aluno.id as string,
        reutilizado: true,
      };
    }

    // 3) Cria novo formulário já vinculado.
    const novoToken =
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const { data: row, error } = await supabaseAdmin
      .from("formularios")
      .insert({
        tipo: data.tipo,
        token: novoToken,
        aluno_id: aluno.id,
        origem: "publico",
        respondido: false,
      })
      .select("id")
      .single();
    if (error || !row) {
      console.error("[iniciarFormularioPorTelefone] insert error", error);
      return { ok: false as const, error: error?.message || "Falha ao iniciar formulário" };
    }

    return {
      ok: true as const,
      id: row.id,
      token: novoToken,
      alunoNome: aluno.nome ?? null,
      alunoId: aluno.id as string,
      reutilizado: false,
    };
  });

/** Lê metadados mínimos do formulário pelo token. Não retorna `dados_resposta`. */
export const lerFormularioPorToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { data: f } = await supabaseAdmin
      .from("formularios")
      .select("id, tipo, respondido, aluno_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!f) return { ok: false as const, error: "Link inválido" };
    return { ok: true as const, form: f };
  });

/** Verifica se um formulário ainda está pendente (por id + token). */
export const checarFormularioPendente = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ formId: z.string().uuid(), token: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: f } = await supabaseAdmin
      .from("formularios")
      .select("id, respondido")
      .eq("id", data.formId)
      .eq("token", data.token)
      .maybeSingle();
    if (!f) return { ok: false as const };
    return { ok: true as const, respondido: !!f.respondido };
  });

/** Carrega o rascunho server-side (apenas se o token bater e ainda não respondido). */
export const carregarRascunhoFormulario = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ formId: z.string().uuid(), token: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("formularios")
      .select("dados_resposta, respondido")
      .eq("id", data.formId)
      .eq("token", data.token)
      .maybeSingle();
    if (!row || row.respondido) return { ok: false as const };
    const dr: any = row.dados_resposta;
    if (!dr || !dr._draft || !dr.data) return { ok: false as const };
    return {
      ok: true as const,
      step: typeof dr._step === "number" ? dr._step : 0,
      data: dr.data,
    };
  });

/** Salva rascunho parcial (autosave) validando token + respondido=false. */
export const salvarRascunhoFormulario = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      formId: z.string().uuid(),
      token: z.string().min(8).max(128),
      step: z.number().int().min(0).max(50),
      data: z.unknown(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const payload = {
      _draft: true,
      _step: data.step,
      _saved_at: new Date().toISOString(),
      data: data.data,
    };
    const { error } = await supabaseAdmin
      .from("formularios")
      .update({ dados_resposta: payload as any })
      .eq("id", data.formId)
      .eq("token", data.token)
      .eq("respondido", false);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/**
 * Submete a resposta final do formulário (qualquer tipo). Atualiza o registro
 * em `formularios`, vincula opcionalmente um aluno_id e dispara as ações
 * downstream (status do aluno, jobs de IA). Tudo validado por token.
 */
export const submeterFormularioPublico = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      formId: z.string().uuid(),
      token: z.string().min(8).max(128),
      dados: z.record(z.string(), z.unknown()),
      alunoId: z.string().uuid().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    // Carrega tipo e estado atual
    const { data: form } = await supabaseAdmin
      .from("formularios")
      .select("id, tipo, respondido, aluno_id")
      .eq("id", data.formId)
      .eq("token", data.token)
      .maybeSingle();
    if (!form) return { ok: false as const, error: "Formulário não encontrado" };
    if (form.respondido) return { ok: false as const, error: "Formulário já respondido" };

    const now = new Date().toISOString();
    const alunoId = (data.alunoId ?? form.aluno_id) || null;

    const update: Record<string, unknown> = {
      respondido: true,
      respondido_em: now,
      dados_resposta: data.dados,
    };
    if (alunoId) update.aluno_id = alunoId;

    const { error: upErr } = await (supabaseAdmin as any)
      .from("formularios")
      .update(update)
      .eq("id", data.formId)
      .eq("token", data.token)
      .eq("respondido", false);
    if (upErr) return { ok: false as const, error: upErr.message };

    // Ações downstream (não fatais)
    if (alunoId) {
      try {
        if (form.tipo === "anamnese") {
          await supabaseAdmin
            .from("alunos")
            .update({ data_anamnese: now, status: "anamnese_recebida" })
            .eq("id", alunoId);
          await (supabaseAdmin as any)
            .from("historico_status")
            .insert({
              aluno_id: alunoId,
              status_de: "aguardando_anamnese",
              status_para: "anamnese_recebida",
              alterado_por: "sistema",
            });
          // Envio imediato da mensagem de boas-vindas pós-anamnese
          try {
            const { data: aluno } = await supabaseAdmin
              .from("alunos")
              .select("nome")
              .eq("id", alunoId)
              .maybeSingle();
            await enviarWhatsAppTeste({
              alunoId,
              tipoJob: "anamnese_recebida",
              mensagem: MSG_ANAMNESE_RECEBIDA(aluno?.nome ?? ""),
            });
          } catch (e) {
            console.error("[submeterFormularioPublico] envio whatsapp anamnese", e);
          }
        } else if (form.tipo === "check_shape") {
          await supabaseAdmin
            .from("alunos")
            .update({ status: "aguardando_renovacao" })
            .eq("id", alunoId);
          await (supabaseAdmin as any)
            .from("historico_status")
            .insert({
              aluno_id: alunoId,
              status_de: null,
              status_para: "aguardando_renovacao",
              alterado_por: "sistema",
            });
          await (supabaseAdmin as any)
            .from("jobs_disparos")
            .insert({
              aluno_id: alunoId,
              tipo: "ia_check_shape",
              agendado_para: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            });
        } else if (form.tipo === "feedback_quinzenal") {
          await (supabaseAdmin as any)
            .from("jobs_disparos")
            .insert({
              aluno_id: alunoId,
              tipo: "ia_feedback_quinzenal",
              agendado_para: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            });
        }
      } catch (e) {
        console.error("[submeterFormularioPublico] downstream error", e);
      }
    }

    return { ok: true as const, alunoId };
  });

/** Vincula um aluno_id a um formulário (após criar/encontrar o aluno). */
export const vincularAlunoFormulario = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      formId: z.string().uuid(),
      token: z.string().min(8).max(128),
      alunoId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("formularios")
      .update({ aluno_id: data.alunoId })
      .eq("id", data.formId)
      .eq("token", data.token);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });