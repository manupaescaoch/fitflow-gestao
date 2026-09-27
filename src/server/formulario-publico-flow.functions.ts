import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { enviarWhatsAppTeste, enviarTextoZapiDireto } from "./zapi-send.server";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { MSG_ANAMNESE_RECEBIDA } from "./mensagens-fixas";
import { normalizarTelefoneBR, telefoneValido } from "@/lib/telefone";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

/** Solicita um código ao WhatsApp cadastrado antes de liberar um feedback. */
export const iniciarFormularioPorTelefone = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ tipo: TipoFeedbackSchema, telefone: z.string().min(8).max(32) }).parse(input),
  )
  .handler(async ({ data }) => {
    const telefone = normalizarTelefoneBR(data.telefone);
    if (!telefoneValido(telefone)) return { ok: false as const, error: "Telefone inválido" };
    const { data: match } = await supabaseAdmin.rpc("buscar_aluno_por_telefone", { _telefone: telefone });
    const aluno = Array.isArray(match) ? match[0] : match;
    // Não revele se o número está cadastrado.
    if (!aluno?.id) return { ok: true as const, challengeId: randomUUID() };
    const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabaseAdmin.from("formulario_verificacoes")
      .select("id", { count: "exact", head: true })
      .eq("aluno_id", aluno.id).gte("criado_em", desde);
    if (countError || (count ?? 0) >= 3) {
      return { ok: false as const, error: "Aguarde antes de solicitar outro código." };
    }
    const codigo = String(randomInt(100000, 1000000));
    const salt = randomUUID();
    const hash = createHash("sha256").update(`${salt}:${codigo}`).digest("hex");
    const { data: desafio, error } = await supabaseAdmin.from("formulario_verificacoes")
      .insert({ aluno_id: aluno.id, tipo: data.tipo, codigo_hash: hash,
        salt, expira_em: new Date(Date.now() + 10 * 60 * 1000).toISOString() })
      .select("id").single();
    if (error || !desafio) return { ok: false as const, error: "Não foi possível enviar o código." };
    const envio = await enviarTextoZapiDireto({ phone: `55${telefone}`,
      alunoId: aluno.id, tipoJob: "codigo_formulario",
      mensagem: `Seu código para acessar o formulário é ${codigo}. Válido por 10 minutos.` });
    if (!envio.ok) {
      await supabaseAdmin.from("formulario_verificacoes").delete().eq("id", desafio.id);
      return { ok: false as const, error: "Não foi possível enviar o código." };
    }
    return { ok: true as const, challengeId: desafio.id };
  });

/** Troca um código válido, de uso único, pelo token do formulário. */
export const confirmarCodigoFormulario = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    challengeId: z.string().uuid(), codigo: z.string().regex(/^\d{6}$/),
  }).parse(input))
  .handler(async ({ data }) => {
    const { data: desafio } = await supabaseAdmin.from("formulario_verificacoes")
      .select("id, aluno_id, tipo, codigo_hash, salt, tentativas, expira_em, usado_em")
      .eq("id", data.challengeId).maybeSingle();
    if (!desafio || desafio.usado_em || desafio.tentativas >= 5 ||
        new Date(desafio.expira_em).getTime() < Date.now()) {
      return { ok: false as const, error: "Código inválido ou expirado." };
    }
    // Reserve uma tentativa de forma atômica antes de conferir o código.
    const { data: tentativa } = await supabaseAdmin.from("formulario_verificacoes")
      .update({ tentativas: desafio.tentativas + 1 }).eq("id", desafio.id)
      .eq("tentativas", desafio.tentativas).is("usado_em", null)
      .gt("expira_em", new Date().toISOString()).select("id").maybeSingle();
    if (!tentativa) return { ok: false as const, error: "Código inválido ou expirado." };
    const hash = createHash("sha256").update(`${desafio.salt}:${data.codigo}`).digest("hex");
    if (hash !== desafio.codigo_hash) {
      return { ok: false as const, error: "Código inválido ou expirado." };
    }
    const { data: claimed } = await supabaseAdmin.from("formulario_verificacoes")
      .update({ usado_em: new Date().toISOString() }).eq("id", desafio.id)
      .is("usado_em", null).gt("expira_em", new Date().toISOString())
      .select("id").maybeSingle();
    if (!claimed) return { ok: false as const, error: "Código inválido ou expirado." };
    const { data: aluno } = await supabaseAdmin.from("alunos")
      .select("nome").eq("id", desafio.aluno_id).maybeSingle();
    let { data: form } = await supabaseAdmin.from("formularios")
      .select("id, token").eq("aluno_id", desafio.aluno_id)
      .eq("tipo", desafio.tipo).eq("respondido", false)
      .order("criado_em", { ascending: false }).limit(1).maybeSingle();
    if (!form) {
      const novo = await supabaseAdmin.from("formularios").insert({
        tipo: desafio.tipo, token: randomUUID(), aluno_id: desafio.aluno_id,
        origem: "publico", respondido: false,
      }).select("id, token").single();
      form = novo.data;
    }
    if (!form) return { ok: false as const, error: "Não foi possível abrir o formulário." };
    return { ok: true as const, id: form.id, token: form.token,
      alunoId: desafio.aluno_id, alunoNome: aluno?.nome ?? null };
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
    // O token autoriza somente o formulário ao qual foi emitido. O cliente
    // não pode trocar o aluno associado e acionar jobs/status de outra pessoa.
    if (form.aluno_id && data.alunoId && data.alunoId !== form.aluno_id) {
      return { ok: false as const, error: "Aluno não corresponde ao formulário" };
    }
    let alunoId = form.aluno_id || null;
    if (!alunoId && data.alunoId) {
      // Formulários abertos vinculam pelo telefone preenchido, conferido no
      // servidor. Nunca confie somente no UUID fornecido pelo navegador.
      const dadosPessoais = data.dados.dados_pessoais as Record<string, unknown> | undefined;
      const telefone = dadosPessoais?.telefone ?? data.dados.telefone;
      const canonico = normalizarTelefoneBR(String(telefone ?? ""));
      if (!telefoneValido(canonico)) {
        return { ok: false as const, error: "Telefone inválido" };
      }
      const { data: alunoMatch } = await supabaseAdmin.rpc("buscar_aluno_por_telefone", {
        _telefone: canonico,
      });
      const aluno = Array.isArray(alunoMatch) ? alunoMatch[0] : alunoMatch;
      if (aluno?.id !== data.alunoId) {
        return { ok: false as const, error: "Aluno não corresponde ao telefone informado" };
      }
      alunoId = aluno.id;
    }

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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      formId: z.string().uuid(),
      token: z.string().min(8).max(128),
      alunoId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: permitido } = await supabaseAdmin.rpc("is_equipe_or_admin", {
      _user_id: context.userId,
    });
    if (!permitido) return { ok: false as const, error: "Sem permissão" };
    const { error } = await supabaseAdmin
      .from("formularios")
      .update({ aluno_id: data.alunoId })
      .eq("id", data.formId)
      .eq("token", data.token);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
