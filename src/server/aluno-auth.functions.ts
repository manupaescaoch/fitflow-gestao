import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  
  requireAlunoAuth,
  requireAlunoAuthAllowPending,
} from "./aluno-middleware";
import { getAlunoSessionServer } from "./aluno-session.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { decodeAndValidateImage } from "./image-validation.server";
import {
  digits,
  senhaInicialFromWhatsapp,
  setAlunoCookie,
  loadDashboard,
} from "./aluno-auth-helpers.server";
import { enviarWhatsAppTeste } from "./zapi-send.server";

/** Cria/redefine o acesso do aluno (apenas equipe/admin do CRM). */
export const criarAcessoAluno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ aluno_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verifica que o usuário do CRM é equipe ou admin.
    const { data: ok, error: roleErr } = await supabaseAdmin.rpc(
      "is_equipe_or_admin",
      { _user_id: context.userId },
    );
    if (roleErr || !ok) {
      return { ok: false as const, error: "Sem permissão" };
    }
    const { data: aluno, error } = await supabaseAdmin
      .from("alunos")
      .select("id, whatsapp, nome")
      .eq("id", data.aluno_id)
      .maybeSingle();
    if (error || !aluno) {
      return { ok: false as const, error: "Aluno não encontrado" };
    }
    const senha = senhaInicialFromWhatsapp(aluno.whatsapp);
    if (senha.length < 10) {
      return { ok: false as const, error: "WhatsApp do aluno inválido" };
    }
    const hash = await bcrypt.hash(senha, 10);
    const { error: upErr } = await supabaseAdmin
      .from("alunos_acesso")
      .upsert(
        {
          aluno_id: aluno.id,
          senha_hash: hash,
          deve_trocar_senha: true,
          ultimo_login_em: null,
        },
        { onConflict: "aluno_id" },
      );
    if (upErr) return { ok: false as const, error: upErr.message };
    return { ok: true as const, senha_inicial: senha, nome: aluno.nome };
  });

/**
 * Retorna apenas o status de acesso (sem expor senha_hash).
 * Usado pela UI do CRM para mostrar se aluno tem acesso e último login.
 * Requer usuário autenticado da equipe/admin.
 */
export const getStatusAcessoAluno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ aluno_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: ok } = await supabaseAdmin.rpc("is_equipe_or_admin", {
      _user_id: context.userId,
    });
    if (!ok) return { ok: false as const, error: "Sem permissão" };
    const { data: row } = await supabaseAdmin
      .from("alunos_acesso")
      .select("ultimo_login_em, deve_trocar_senha")
      .eq("aluno_id", data.aluno_id)
      .maybeSingle();
    return {
      ok: true as const,
      has_acesso: !!row,
      ultimo_login_em: row?.ultimo_login_em ?? null,
      deve_trocar_senha: !!row?.deve_trocar_senha,
    };
  });

/** Login do aluno por WhatsApp + senha. */
export const loginAluno = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        whatsapp: z.string().min(8).max(20),
        senha: z.string().min(4).max(64),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const tel = digits(data.whatsapp);
    if (tel.length < 8) return { ok: false as const, error: "WhatsApp inválido" };
    const { data: aluno } = await supabaseAdmin
      .from("alunos")
      .select("id, nome, email, whatsapp, foto_url")
      .filter("whatsapp", "eq", tel)
      .maybeSingle();
    // fallback: comparar por dígitos via RPC se não bateu
    let alunoRow = aluno;
    if (!alunoRow) {
      const { data: rpcRow } = await supabaseAdmin.rpc("buscar_aluno_por_telefone", {
        _telefone: tel,
      });
      const r = Array.isArray(rpcRow) ? rpcRow[0] : rpcRow;
      if (r?.id) {
        const { data: full } = await supabaseAdmin
          .from("alunos")
          .select("id, nome, email, whatsapp, foto_url")
          .eq("id", r.id as string)
          .maybeSingle();
        alunoRow = full ?? null;
      }
    }
    if (!alunoRow) {
      return { ok: false as const, error: "Credenciais inválidas" };
    }
    const { data: acesso } = await supabaseAdmin
      .from("alunos_acesso")
      .select("senha_hash, deve_trocar_senha")
      .eq("aluno_id", alunoRow.id)
      .maybeSingle();
    if (!acesso) {
      return {
        ok: false as const,
        error: "Acesso ainda não liberado. Fale com a equipe.",
      };
    }
    const ok = await bcrypt.compare(data.senha, acesso.senha_hash);
    if (!ok) return { ok: false as const, error: "Credenciais inválidas" };
    await supabaseAdmin
      .from("alunos_acesso")
      .update({ ultimo_login_em: new Date().toISOString() })
      .eq("aluno_id", alunoRow.id);
    await setAlunoCookie(
      {
        id: alunoRow.id,
        nome: alunoRow.nome,
        email: alunoRow.email ?? null,
        whatsapp: alunoRow.whatsapp ?? null,
        foto_url: (alunoRow as any).foto_url ?? null,
      },
      !!acesso.deve_trocar_senha,
    );
    return {
      ok: true as const,
      aluno: {
        id: alunoRow.id,
        nome: alunoRow.nome,
        email: alunoRow.email,
        whatsapp: alunoRow.whatsapp,
        foto_url: (alunoRow as any).foto_url ?? null,
      },
      deve_trocar_senha: !!acesso.deve_trocar_senha,
    };
  });

/** Login do aluno por e-mail OU whatsapp + senha. Usado pelo login unificado. */
export const loginAlunoPorEmail = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        identificador: z.string().min(3).max(120),
        senha: z.string().min(4).max(64),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const id = (data.identificador || "").trim();
    let alunoRow: { id: string; nome: string; email: string | null; whatsapp: string | null; foto_url?: string | null } | null = null;

    // 1) tenta por e-mail (case-insensitive)
    if (id.includes("@")) {
      const { data: byEmail } = await supabaseAdmin
        .from("alunos")
        .select("id, nome, email, whatsapp, foto_url")
        .ilike("email", id)
        .maybeSingle();
      alunoRow = byEmail ?? null;
    }

    // 2) fallback: tenta por whatsapp (apenas dígitos)
    if (!alunoRow) {
      const tel = digits(id);
      if (tel.length >= 8) {
        const { data: byTel } = await supabaseAdmin
          .from("alunos")
          .select("id, nome, email, whatsapp, foto_url")
          .filter("whatsapp", "eq", tel)
          .maybeSingle();
        alunoRow = byTel ?? null;
        if (!alunoRow) {
          const { data: rpcRow } = await supabaseAdmin.rpc("buscar_aluno_por_telefone", {
            _telefone: tel,
          });
          const r = Array.isArray(rpcRow) ? rpcRow[0] : rpcRow;
          if (r?.id) {
            const { data: full } = await supabaseAdmin
              .from("alunos")
              .select("id, nome, email, whatsapp, foto_url")
              .eq("id", r.id as string)
              .maybeSingle();
            alunoRow = full ?? null;
          }
        }
      }
    }

    if (!alunoRow) return { ok: false as const, error: "Credenciais inválidas" };

    const { data: acesso } = await supabaseAdmin
      .from("alunos_acesso")
      .select("senha_hash, deve_trocar_senha")
      .eq("aluno_id", alunoRow.id)
      .maybeSingle();
    if (!acesso) {
      return { ok: false as const, error: "Acesso ainda não liberado. Fale com a equipe." };
    }
    const ok = await bcrypt.compare(data.senha, acesso.senha_hash);
    if (!ok) return { ok: false as const, error: "Credenciais inválidas" };
    await supabaseAdmin
      .from("alunos_acesso")
      .update({ ultimo_login_em: new Date().toISOString() })
      .eq("aluno_id", alunoRow.id);
    await setAlunoCookie(
      {
        id: alunoRow.id,
        nome: alunoRow.nome,
        email: alunoRow.email ?? null,
        whatsapp: alunoRow.whatsapp ?? null,
        foto_url: (alunoRow as any).foto_url ?? null,
      },
      !!acesso.deve_trocar_senha,
    );
    return {
      ok: true as const,
      aluno: {
        id: alunoRow.id,
        nome: alunoRow.nome,
        email: alunoRow.email,
        whatsapp: alunoRow.whatsapp,
        foto_url: (alunoRow as any).foto_url ?? null,
      },
      deve_trocar_senha: !!acesso.deve_trocar_senha,
    };
  });

/** Troca de senha. Exige a senha atual. Usa cookie do aluno. */
export const trocarSenhaAluno = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuthAllowPending])
  .inputValidator((input: unknown) =>
    z
      .object({
        senha_atual: z.string().min(4).max(64),
        nova_senha: z.string().min(6).max(64),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const aluno_id = context.alunoId;
    const { data: acesso } = await supabaseAdmin
      .from("alunos_acesso")
      .select("senha_hash")
      .eq("aluno_id", aluno_id)
      .maybeSingle();
    if (!acesso) return { ok: false as const, error: "Acesso não encontrado" };
    const ok = await bcrypt.compare(data.senha_atual, acesso.senha_hash);
    if (!ok) return { ok: false as const, error: "Senha atual incorreta" };
    const hash = await bcrypt.hash(data.nova_senha, 10);
    const { error } = await supabaseAdmin
      .from("alunos_acesso")
      .update({ senha_hash: hash, deve_trocar_senha: false })
      .eq("aluno_id", aluno_id);
    if (error) return { ok: false as const, error: error.message };
    // Atualiza cookie com flag
    const session = await getAlunoSessionServer();
    await session.update({ ...(session.data ?? {}), deve_trocar_senha: false });
    return { ok: true as const };
  });

/** Logout do aluno: limpa cookie de sessão. */
export const logoutAluno = createServerFn({ method: "POST" }).handler(
  async () => {
    const session = await getAlunoSessionServer();
    await session.clear();
    return { ok: true as const };
  },
);

/**
 * Solicita reset de senha do aluno. Aceita e-mail OU WhatsApp.
 * Sempre retorna `{ ok: true }` para não vazar quais identificadores existem.
 * Se encontrar o aluno, gera senha temporária de 6 dígitos, marca
 * `deve_trocar_senha = true` e envia via WhatsApp (Z-API).
 */
export const solicitarResetSenhaAluno = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        identificador: z.string().min(3).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const id = (data.identificador || "").trim();
    let alunoRow:
      | { id: string; nome: string; whatsapp: string | null }
      | null = null;

    if (id.includes("@")) {
      const { data: byEmail } = await supabaseAdmin
        .from("alunos")
        .select("id, nome, whatsapp")
        .ilike("email", id)
        .maybeSingle();
      alunoRow = byEmail ?? null;
    }
    if (!alunoRow) {
      const tel = digits(id);
      if (tel.length >= 8) {
        const { data: byTel } = await supabaseAdmin
          .from("alunos")
          .select("id, nome, whatsapp")
          .filter("whatsapp", "eq", tel)
          .maybeSingle();
        alunoRow = byTel ?? null;
        if (!alunoRow) {
          const { data: rpcRow } = await supabaseAdmin.rpc(
            "buscar_aluno_por_telefone",
            { _telefone: tel },
          );
          const r = Array.isArray(rpcRow) ? rpcRow[0] : rpcRow;
          if (r?.id) {
            const { data: full } = await supabaseAdmin
              .from("alunos")
              .select("id, nome, whatsapp")
              .eq("id", r.id as string)
              .maybeSingle();
            alunoRow = full ?? null;
          }
        }
      }
    }

    if (!alunoRow || !alunoRow.whatsapp) {
      // Resposta genérica — não confirma nem nega.
      return { ok: true as const };
    }

    // Gera senha temporária de 6 dígitos
    const tempSenha = String(
      Math.floor(100000 + Math.random() * 900000),
    );
    const hash = await bcrypt.hash(tempSenha, 10);
    const { error: upErr } = await supabaseAdmin
      .from("alunos_acesso")
      .upsert(
        {
          aluno_id: alunoRow.id,
          senha_hash: hash,
          deve_trocar_senha: true,
        },
        { onConflict: "aluno_id" },
      );
    if (upErr) {
      // Falha técnica — retorna ok genérico mas loga internamente.
      console.error("[reset-senha] upsert falhou:", upErr.message);
      return { ok: true as const };
    }

    const primeiroNome = (alunoRow.nome || "").split(" ")[0] || "Aluno";
    const mensagem =
      `Olá, ${primeiroNome}! 🔐\n\n` +
      `Recebemos seu pedido de redefinição de senha no app MPTEAM.\n\n` +
      `Sua senha temporária é: *${tempSenha}*\n\n` +
      `Use ela para entrar e o app vai te pedir pra criar uma nova senha em seguida.\n\n` +
      `Se você não solicitou, ignore esta mensagem.`;

    await enviarWhatsAppTeste({
      alunoId: alunoRow.id,
      tipoJob: "reset_senha_aluno",
      mensagem,
    });

    return { ok: true as const };
  });

/** Retorna a sessão atual (cookie) do aluno. */
export const getAlunoMe = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getAlunoSessionServer();
  if (!session.data?.aluno_id) return { ok: false as const };
  // Recarrega dados básicos do banco
  const { data: row } = await supabaseAdmin
    .from("alunos")
    .select("id, nome, email, whatsapp, foto_url")
    .eq("id", session.data.aluno_id)
    .maybeSingle();
  if (!row) {
    await session.clear();
    return { ok: false as const };
  }
  return {
    ok: true as const,
    aluno: {
      id: row.id,
      nome: row.nome,
      email: row.email,
      whatsapp: row.whatsapp,
      foto_url: (row as any).foto_url ?? null,
    },
    deve_trocar_senha: !!session.data.deve_trocar_senha,
  };
});

export type AlunoDashboard = Awaited<ReturnType<typeof loadDashboard>>;

export const getAlunoDashboard = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .handler(async ({ context }) => loadDashboard(context.alunoId));

/** Upload da foto de perfil do aluno (base64). */
export const atualizarFotoAluno = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        file_base64: z.string().min(10),
        content_type: z.string().min(3).max(64),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const aluno_id = context.alunoId;
    const v = decodeAndValidateImage(
      data.file_base64,
      data.content_type,
      5 * 1024 * 1024,
    );
    if (!v.ok) return { ok: false as const, error: v.error };
    const path = `alunos/${aluno_id}/avatar/${crypto.randomUUID()}.${v.ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("aluno-fotos")
      .upload(path, v.buf, { contentType: v.mime, upsert: false });
    if (upErr) return { ok: false as const, error: upErr.message };
    // Bucket privado: armazenamos apenas o path interno; signed URL é gerada sob demanda.
    const url = path;
    const { error: updErr } = await supabaseAdmin
      .from("alunos")
      .update({ foto_url: url })
      .eq("id", aluno_id);
    if (updErr) return { ok: false as const, error: updErr.message };
    // Atualiza cookie
    const session = await getAlunoSessionServer();
    await session.update({ ...(session.data ?? {}), foto_url: url });
    return { ok: true as const, foto_url: url };
  });