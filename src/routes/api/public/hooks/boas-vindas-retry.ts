import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  enviarDocumentoZapi,
  enviarTextoZapiDireto,
} from "@/server/zapi-send.server";
import { checkCronAuth } from "@/server/cron-auth.server";

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

// Marcadores únicos para identificar cada etapa nos logs.
const MARK_PDF = "[PDF] Seja Bem-Vindo";
const MARK_2 = "Bem-vindo ao MPTEAM";
const MARK_3 = "Lido o PDF";
const MARK_4 = "*1. Anamnese*";
const MARK_5 = "Com anamnese + cadastro feitos";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type Etapa = "pdf" | "msg2" | "msg3" | "msg4" | "msg5";

async function listarPendentes(): Promise<
  { phone: string; faltando: Etapa[]; alunoId: string | null }[]
> {
  // Considera os últimos 7 dias para evitar reenviar etapas que já saíram
  // antes (ex: envio manual ou reentrega anterior).
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const desdeIniciado = new Date(Date.now() - 90 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("mensagens_log")
    .select("whatsapp_destino, mensagem_enviada, aluno_id, enviado_em")
    .eq("tipo_job", TIPO_JOB)
    .eq("status_envio", "enviado" as any)
    .gte("enviado_em", desde);

  if (!data || data.length === 0) return [];

  const map = new Map<
    string,
    { enviadas: Set<Etapa>; alunoId: string | null; iniciadoRecente: boolean }
  >();

  for (const row of data) {
    const phone = (row.whatsapp_destino || "").trim();
    if (!phone) continue;
    const msg = (row.mensagem_enviada || "") as string;
    let etapa: Etapa | null = null;
    if (msg.startsWith(MARK_PDF)) etapa = "pdf";
    else if (msg.startsWith(MARK_2)) etapa = "msg2";
    else if (msg.startsWith(MARK_3)) etapa = "msg3";
    else if (msg.startsWith(MARK_4)) etapa = "msg4";
    else if (msg.startsWith(MARK_5)) etapa = "msg5";
    if (!etapa) continue;
    const cur = map.get(phone) ?? {
      enviadas: new Set<Etapa>(),
      alunoId: row.aluno_id ?? null,
      iniciadoRecente: false,
    };
    cur.enviadas.add(etapa);
    if (!cur.alunoId && row.aluno_id) cur.alunoId = row.aluno_id;
    if ((row.enviado_em as string) >= desdeIniciado) {
      cur.iniciadoRecente = true;
    }
    map.set(phone, cur);
  }

  const todas: Etapa[] = ["pdf", "msg2", "msg3", "msg4", "msg5"];
  const out: { phone: string; faltando: Etapa[]; alunoId: string | null }[] =
    [];
  for (const [phone, info] of map.entries()) {
    // Só processa se o fluxo foi iniciado nos últimos 90 min (caso contrário
    // assume que o aluno já recebeu/abandonou e não devemos completar mais).
    if (!info.iniciadoRecente) continue;
    const faltando = todas.filter((e) => !info.enviadas.has(e));
    if (faltando.length > 0) {
      out.push({ phone, faltando, alunoId: info.alunoId });
    }
  }
  return out;
}

async function enviarEtapa(
  etapa: Etapa,
  phone: string,
  alunoId: string | null,
): Promise<{ ok: boolean; error: string | null }> {
  if (etapa === "pdf") {
    return enviarDocumentoZapi({
      phone,
      documentUrl: PDF_URL,
      fileName: PDF_FILENAME,
      tipoJob: TIPO_JOB,
      alunoId,
    });
  }
  const texto =
    etapa === "msg2"
      ? MSG_2
      : etapa === "msg3"
        ? MSG_3
        : etapa === "msg4"
          ? MSG_4
          : MSG_5;
  return enviarTextoZapiDireto({
    phone,
    mensagem: texto,
    tipoJob: TIPO_JOB,
    alunoId,
  });
}

async function processarRetries(): Promise<{
  alunos_processados: number;
  mensagens_reenviadas: number;
  falhas: number;
}> {
  const pendentes = await listarPendentes();
  let reenviadas = 0;
  let falhas = 0;
  for (const p of pendentes) {
    // ordem definida: pdf, msg2..msg5
    const ordem: Etapa[] = ["pdf", "msg2", "msg3", "msg4", "msg5"];
    const faltandoOrdenado = ordem.filter((e) => p.faltando.includes(e));
    for (let i = 0; i < faltandoOrdenado.length; i++) {
      const r = await enviarEtapa(faltandoOrdenado[i], p.phone, p.alunoId);
      if (r.ok) reenviadas++;
      else falhas++;
      if (i < faltandoOrdenado.length - 1) await sleep(400);
    }
  }
  return {
    alunos_processados: pendentes.length,
    mensagens_reenviadas: reenviadas,
    falhas,
  };
}

export const Route = createFileRoute("/api/public/hooks/boas-vindas-retry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = checkCronAuth(request);
        if (unauth) return unauth;
        try {
          const result = await processarRetries();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "erro";
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async ({ request }) => {
        const unauth = checkCronAuth(request);
        if (unauth) return unauth;
        const pendentes = await listarPendentes();
        return new Response(
          JSON.stringify({
            ok: true,
            pendentes: pendentes.map((p) => ({
              phone: p.phone,
              faltando: p.faltando,
            })),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});