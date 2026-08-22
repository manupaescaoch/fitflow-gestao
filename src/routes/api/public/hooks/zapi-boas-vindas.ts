import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  enviarDocumentoZapi,
  enviarTextoZapiDireto,
} from "@/server/zapi-send.server";
import { createHash } from "crypto";
import { checkZapiWebhookAuth } from "@/server/zapi-webhook-auth.server";

const PDF_URL = "https://mpteam-app.com/pdfs/seja-bem-vindo-mpteam.pdf";
const PDF_FILENAME = "Seja Bem-Vindo - MPTEAM.pdf";
const TIPO_JOB = "boas_vindas_webhook";

const MSG_2 = `Bem-vindo ao MPTEAM. 🚀

Antes de qualquer coisa:
leia o PDF que acabei de enviar.

Do início ao fim. Sem pular.

Esse documento é o mapa do seu processo,
do diagnóstico até a entrega do protocolo.

Quem ignora essa etapa
atrasa o próprio resultado.`;

const MSG_3 = `Lido o PDF, são só 3 passos pra começar:

1️⃣ Anamnese
2️⃣ Cadastro no app MFIT
3️⃣ Termos de uso

Vou te mandar os links agora 👇`;

const MSG_4 = `*1. Anamnese*
Responda com calma e 100% de sinceridade.
A qualidade do seu protocolo depende disso.
👉 https://mpteam-app.com/anamnese

*2. Cadastro no app MFIT*
É onde você vai receber
e acompanhar seus treinos.
👉 https://www.mfitpersonal.com.br/index?share=Mjc2NzMvMC85LzA=
_A senha chega por e-mail._
_Confere o spam também._

*3. Termos de uso*
Leia antes de seguir.
Acesso, atualizações, cancelamento e condições.
👉 https://forms.gle/xw8BcviVcJ8bTkiK6`;

const MSG_5 = `Com anamnese + cadastro feitos,
seu treino e plano alimentar chegam
em até *3 DIAS ÚTEIS*.

Bora pra cima. 💪`;

function normalizar(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isGatilho(texto: string): boolean {
  const n = normalizar(texto);
  return n.includes("acabei de concluir minha inscri") && n.includes("mpteam");
}

function digits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

function calcularChaveIdempotencia(payload: any, phone: string, texto: string): string {
  const raw =
    payload?.messageId ??
    payload?.id ??
    payload?.zaapId ??
    payload?.referenceMessageId ??
    null;
  if (raw && typeof raw === "string" && raw.length > 0) {
    return `zapi:recv:${raw}`;
  }
  // Fallback: hash de phone+texto+janela de 60s
  const janela = Math.floor(Date.now() / 60000);
  const h = createHash("sha256")
    .update(`${phone}|${texto}|${janela}`)
    .digest("hex")
    .slice(0, 32);
  return `zapi:recv:fallback:${h}`;
}

/**
 * Tenta reservar o evento. Retorna true se ESTE call ganhou a corrida.
 * Se já existir, retorna false (duplicado).
 */
async function reservarEvento(
  chave: string,
  telefone: string,
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("zapi_webhook_eventos" as any)
    .insert({
      chave_idempotencia: chave,
      telefone,
      tipo: "boas_vindas",
      status: "processando",
    });
  if (!error) return true;
  // 23505 = unique_violation
  if ((error as any).code === "23505") return false;
  // Outros erros: loga e deixa seguir (não bloqueia funcionalidade)
  console.error("[zapi-boas-vindas] erro reservarEvento:", error);
  return true;
}

async function concluirEvento(
  chave: string,
  status: "ok" | "erro",
  resultado: unknown,
): Promise<void> {
  await supabaseAdmin
    .from("zapi_webhook_eventos" as any)
    .update({
      status,
      resultado: resultado as any,
      concluido_em: new Date().toISOString(),
    })
    .eq("chave_idempotencia", chave);
}

async function jaEnviadoRecente(phone: string): Promise<boolean> {
  // Janela ampla: se já enviamos QUALQUER msg de boas-vindas nos últimos 7
  // dias para esse número, não dispara de novo o fluxo completo.
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("mensagens_log")
    .select("id")
    .eq("whatsapp_destino", phone)
    .eq("tipo_job", TIPO_JOB)
    .eq("status_envio", "enviado" as any)
    .gte("enviado_em", desde)
    .limit(1);
  return !!(data && data.length > 0);
}

// Marcadores únicos por etapa (mesmo conjunto usado no retry).
const MARK_PDF = "[PDF] Seja Bem-Vindo";
const MARK_2 = "Bem-vindo ao MPTEAM";
const MARK_3 = "Lido o PDF";
const MARK_4 = "*1. Anamnese*";
const MARK_5 = "Com anamnese + cadastro feitos";

async function etapaJaEnviada(
  phone: string,
  marker: string,
): Promise<boolean> {
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("mensagens_log")
    .select("id")
    .eq("whatsapp_destino", phone)
    .eq("tipo_job", TIPO_JOB)
    .eq("status_envio", "enviado" as any)
    .gte("enviado_em", desde)
    .ilike("mensagem_enviada", `${marker}%`)
    .limit(1);
  return !!(data && data.length > 0);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function processarPayloadBoasVindas(payload: any): Promise<{
  ok: boolean;
  ignorado?: string;
  enviados?: number;
  falhas?: string[];
}> {
  if (!payload || typeof payload !== "object") {
    return { ok: true, ignorado: "payload-invalido" };
  }
  // só mensagens de texto
  const texto: string =
    payload?.text?.message ??
    payload?.message ??
    payload?.body ??
    "";

  // Mensagens enviadas por mim não disparam fluxo de boas-vindas.
  if (payload.fromMe === true) {
    return { ok: true, ignorado: "fromMe" };
  }

  if (!texto) return { ok: true, ignorado: "sem-texto" };
  if (!isGatilho(texto)) {
    return { ok: true, ignorado: "sem-gatilho" };
  }

  const phone = digits(payload.phone || payload.from || payload.author);
  if (!phone || phone.length < 10) {
    return { ok: true, ignorado: "telefone-invalido" };
  }

  // Trava de idempotência: só um processamento por evento.
  const chave = calcularChaveIdempotencia(payload, phone, texto);
  const ganhou = await reservarEvento(chave, phone);
  if (!ganhou) {
    return { ok: true, ignorado: "evento-duplicado" };
  }

  // Idempotência 24h
  if (await jaEnviadoRecente(phone)) {
    await concluirEvento(chave, "ok", { ignorado: "ja-enviado-24h" });
    return { ok: true, ignorado: "ja-enviado-24h" };
  }

  // Busca aluno (se existir) para vincular logs
  const { data: alunoRow } = await supabaseAdmin.rpc(
    "buscar_aluno_por_telefone",
    { _telefone: phone },
  );
  const alunoId =
    Array.isArray(alunoRow) && alunoRow[0]?.id ? (alunoRow[0].id as string) : null;

  const falhas: string[] = [];
  let enviados = 0;

  // 1. PDF
  if (!(await etapaJaEnviada(phone, MARK_PDF))) {
    const r1 = await enviarDocumentoZapi({
      phone,
      documentUrl: PDF_URL,
      fileName: PDF_FILENAME,
      tipoJob: TIPO_JOB,
      alunoId,
    });
    if (r1.ok) enviados++;
    else falhas.push(`pdf: ${r1.error}`);
    await sleep(400);
  }

  // 2-5. Textos
  const textos: { texto: string; marker: string }[] = [
    { texto: MSG_2, marker: MARK_2 },
    { texto: MSG_3, marker: MARK_3 },
    { texto: MSG_4, marker: MARK_4 },
    { texto: MSG_5, marker: MARK_5 },
  ];
  for (let i = 0; i < textos.length; i++) {
    const { texto, marker } = textos[i];
    if (await etapaJaEnviada(phone, marker)) continue;
    const r = await enviarTextoZapiDireto({
      phone,
      mensagem: texto,
      tipoJob: TIPO_JOB,
      alunoId,
    });
    if (r.ok) enviados++;
    else falhas.push(`msg${i + 2}: ${r.error}`);
    if (i < textos.length - 1) await sleep(400);
  }

  await concluirEvento(
    chave,
    falhas.length === 0 ? "ok" : "erro",
    { enviados, falhas },
  );
  return { ok: true, enviados, falhas };
}

export const Route = createFileRoute("/api/public/hooks/zapi-boas-vindas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any = null;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ ok: true, ignorado: "json-invalido" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        const unauth = checkZapiWebhookAuth(request, body);
        if (unauth) return unauth;
        // Responde imediatamente para evitar timeout/retry da Z-API.
        // Processa em background usando waitUntil quando disponível.
        const work = processarPayloadBoasVindas(body).catch((e) => {
          console.error("[zapi-boas-vindas] erro background:", e);
        });
        const ctx = (globalThis as any).__cfCtx ?? (request as any).ctx;
        if (ctx?.waitUntil) {
          ctx.waitUntil(work);
        } else {
          // Fallback: aguarda mas com timeout curto
          await Promise.race([work, new Promise((r) => setTimeout(r, 4000))]);
        }
        return new Response(JSON.stringify({ ok: true, queued: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
      GET: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            info: "Webhook Z-API boas-vindas. Configure este URL como POST em 'Ao receber mensagem'.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    },
  },
});