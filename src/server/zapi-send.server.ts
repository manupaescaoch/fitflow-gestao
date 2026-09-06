import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolverDestinoRoteamento, lerBloqueioEnviosAlunos } from "./roteamento-grupos.server";
import { lerCredenciaisZapi } from "./credenciais.server";

function digits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/**
 * Envia mensagem via Z-API para o WhatsApp REAL do aluno.
 * Loga em mensagens_log com aluno_id, destino e status.
 *
 * Nome mantido por compatibilidade com call sites antigos — não é mais um
 * envio de teste.
 */
export async function enviarWhatsAppTeste(input: {
  alunoId: string;
  tipoJob: string;
  mensagem: string;
}): Promise<{ ok: boolean; error: string | null }> {
  const creds = await lerCredenciaisZapi();
  const instance = creds?.instance;
  const token = creds?.token;
  const clientToken = creds?.clientToken;

  if (!instance || !token || !clientToken) {
    return { ok: false, error: "Z-API não configurada" };
  }

  const { data: aluno } = await supabaseAdmin
    .from("alunos")
    .select("nome, whatsapp")
    .eq("id", input.alunoId)
    .maybeSingle();

  const phoneAluno = digits(aluno?.whatsapp);

  // Verifica se este tipoJob deve ser desviado para um grupo
  const route = await resolverDestinoRoteamento({
    tipoJob: input.tipoJob,
    alunoNome: aluno?.nome ?? null,
    alunoTelefone: phoneAluno || null,
    mensagemOriginal: input.mensagem,
  });

  let phoneDestino: string;
  let corpo: string;
  if (route.override) {
    phoneDestino = route.destinoTipo === "telefone" ? route.destinoValor.replace(/\D/g, "") : route.destinoValor.trim();
    corpo = route.corpo;
  } else {
    // Kill-switch global: se ativo e não há roteamento configurado para este
    // tipoJob, NÃO envia ao aluno. Apenas registra no log como bloqueado.
    const bloqueado = await lerBloqueioEnviosAlunos();
    if (bloqueado) {
      const err = "Envio direto ao aluno bloqueado (kill-switch global)";
      await supabaseAdmin.from("mensagens_log").insert({
        aluno_id: input.alunoId,
        tipo_job: input.tipoJob,
        mensagem_enviada: input.mensagem,
        whatsapp_destino: phoneAluno || null,
        status_envio: "erro" as any,
        erro_detalhe: err,
      });
      return { ok: false, error: err };
    }
    phoneDestino = phoneAluno;
    corpo = input.mensagem;
  }

  if (!phoneDestino || (route.override === false && phoneDestino.length < 10)) {
    const err = "WhatsApp do aluno inválido";
    await supabaseAdmin.from("mensagens_log").insert({
      aluno_id: input.alunoId,
      tipo_job: input.tipoJob,
      mensagem_enviada: input.mensagem,
      whatsapp_destino: phoneAluno || null,
      status_envio: "erro" as any,
      erro_detalhe: err,
    });
    return { ok: false, error: err };
  }

  const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
  let ok = false;
  let err: string | null = null;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone: phoneDestino, message: corpo }),
    });
    const txt = await r.text();
    if (!r.ok) err = `Z-API ${r.status}: ${txt.slice(0, 200)}`;
    else ok = true;
  } catch (e) {
    err = e instanceof Error ? e.message : "Falha Z-API";
  }

  await supabaseAdmin.from("mensagens_log").insert({
    aluno_id: input.alunoId,
    tipo_job: input.tipoJob,
    mensagem_enviada: corpo,
    whatsapp_destino: phoneDestino,
    status_envio: ok ? ("enviado" as any) : ("erro" as any),
    erro_detalhe: err,
  });

  return { ok, error: err };
}

/**
 * Envia texto via Z-API direto para um telefone (sem precisar do alunoId).
 * Útil para webhooks de boas-vindas onde o aluno pode não existir no CRM.
 */
export async function enviarTextoZapiDireto(input: {
  phone: string;
  mensagem: string;
  tipoJob: string;
  alunoId?: string | null;
}): Promise<{ ok: boolean; error: string | null; messageId?: string | null }> {
  const creds = await lerCredenciaisZapi();
  const instance = creds?.instance;
  const token = creds?.token;
  const clientToken = creds?.clientToken;
  if (!instance || !token || !clientToken) {
    return { ok: false, error: "Z-API não configurada" };
  }
  const phoneDestino = digits(input.phone);
  if (!phoneDestino || phoneDestino.length < 8) {
    return { ok: false, error: "Telefone inválido" };
  }
  const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
  let ok = false;
  let err: string | null = null;
  let messageId: string | null = null;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({ phone: phoneDestino, message: input.mensagem }),
    });
    const txt = await r.text();
    if (!r.ok) err = `Z-API ${r.status}: ${txt.slice(0, 200)}`;
    else {
      ok = true;
      try {
        const j = JSON.parse(txt);
        messageId = j?.messageId ?? j?.id ?? j?.zaapId ?? null;
      } catch {
        messageId = null;
      }
    }
  } catch (e) {
    err = e instanceof Error ? e.message : "Falha Z-API";
  }

  await supabaseAdmin.from("mensagens_log").insert({
    aluno_id: input.alunoId ?? null,
    tipo_job: input.tipoJob,
    mensagem_enviada: input.mensagem,
    whatsapp_destino: phoneDestino,
    status_envio: ok ? ("enviado" as any) : ("erro" as any),
    erro_detalhe: err,
  });

  return { ok, error: err, messageId };
}

/**
 * Envia documento (PDF) via Z-API. URL precisa ser publicamente acessível.
 */
export async function enviarDocumentoZapi(input: {
  phone: string;
  documentUrl: string;
  fileName: string;
  caption?: string;
  tipoJob: string;
  alunoId?: string | null;
}): Promise<{ ok: boolean; error: string | null }> {
  const creds = await lerCredenciaisZapi();
  const instance = creds?.instance;
  const token = creds?.token;
  const clientToken = creds?.clientToken;
  if (!instance || !token || !clientToken) {
    return { ok: false, error: "Z-API não configurada" };
  }
  const phoneDestino = digits(input.phone);
  if (!phoneDestino || phoneDestino.length < 10) {
    return { ok: false, error: "Telefone inválido" };
  }
  const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-document/pdf`;
  let ok = false;
  let err: string | null = null;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify({
        phone: phoneDestino,
        document: input.documentUrl,
        fileName: input.fileName,
        caption: input.caption ?? "",
      }),
    });
    const txt = await r.text();
    if (!r.ok) err = `Z-API ${r.status}: ${txt.slice(0, 200)}`;
    else ok = true;
  } catch (e) {
    err = e instanceof Error ? e.message : "Falha Z-API";
  }

  await supabaseAdmin.from("mensagens_log").insert({
    aluno_id: input.alunoId ?? null,
    tipo_job: input.tipoJob,
    mensagem_enviada: `[PDF] ${input.fileName} → ${input.documentUrl}`,
    whatsapp_destino: phoneDestino,
    status_envio: ok ? ("enviado" as any) : ("erro" as any),
    erro_detalhe: err,
  });

  return { ok, error: err };
}

/**
 * Envia mídia (imagem, vídeo, áudio ou documento) via Z-API.
 * URL precisa ser publicamente acessível.
 */
export async function enviarMidiaZapi(input: {
  phone: string;
  tipo: "image" | "video" | "audio" | "document";
  url: string;
  caption?: string;
  fileName?: string;
  mime?: string;
  tipoJob: string;
  alunoId?: string | null;
}): Promise<{ ok: boolean; error: string | null }> {
  const creds = await lerCredenciaisZapi();
  const instance = creds?.instance;
  const token = creds?.token;
  const clientToken = creds?.clientToken;
  if (!instance || !token || !clientToken) {
    return { ok: false, error: "Z-API não configurada" };
  }
  const phoneDestino = digits(input.phone);
  if (!phoneDestino || phoneDestino.length < 8) {
    return { ok: false, error: "Telefone inválido" };
  }

  let endpoint: string;
  let body: Record<string, any>;
  switch (input.tipo) {
    case "image":
      endpoint = `send-image`;
      body = { phone: phoneDestino, image: input.url, caption: input.caption ?? "" };
      break;
    case "video":
      endpoint = `send-video`;
      body = { phone: phoneDestino, video: input.url, caption: input.caption ?? "" };
      break;
    case "audio":
      endpoint = `send-audio`;
      body = { phone: phoneDestino, audio: input.url };
      break;
    case "document": {
      const ext =
        (input.fileName?.split(".").pop() || input.mime?.split("/").pop() || "pdf").toLowerCase();
      endpoint = `send-document/${ext}`;
      body = {
        phone: phoneDestino,
        document: input.url,
        fileName: input.fileName ?? `arquivo.${ext}`,
        caption: input.caption ?? "",
      };
      break;
    }
    default:
      return { ok: false, error: "Tipo de mídia não suportado" };
  }

  const url = `https://api.z-api.io/instances/${instance}/token/${token}/${endpoint}`;
  let ok = false;
  let err: string | null = null;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify(body),
    });
    const txt = await r.text();
    if (!r.ok) err = `Z-API ${r.status}: ${txt.slice(0, 200)}`;
    else ok = true;
  } catch (e) {
    err = e instanceof Error ? e.message : "Falha Z-API";
  }

  await supabaseAdmin.from("mensagens_log").insert({
    aluno_id: input.alunoId ?? null,
    tipo_job: input.tipoJob,
    mensagem_enviada: `[${input.tipo}] ${input.caption ?? input.fileName ?? input.url}`.slice(0, 500),
    whatsapp_destino: phoneDestino,
    status_envio: ok ? ("enviado" as any) : ("erro" as any),
    erro_detalhe: err,
  });

  return { ok, error: err };
}