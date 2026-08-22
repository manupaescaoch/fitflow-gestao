import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { primeiroNome } from "@/lib/nome";

const BUCKET = "anamnese-uploads";
const SIGN_TTL = 60 * 30; // 30 min — só p/ a OpenAI baixar

type SlotKey = "frente" | "costas" | "perfil_esquerdo";
const SLOT_LABEL: Record<SlotKey, string> = {
  frente: "Frente",
  costas: "Costas",
  perfil_esquerdo: "Perfil esquerdo",
};

function extractPath(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^\/+/, "").replace(/\.\./g, "") || null;
  }
  try {
    const u = new URL(trimmed);
    const marker = "/storage/v1/object/";
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    const rest = u.pathname.slice(idx + marker.length).split("/");
    if (rest.length < 3) return null;
    const [, bucket, ...pathParts] = rest;
    if (bucket !== BUCKET) return null;
    return pathParts.join("/").replace(/\.\./g, "") || null;
  } catch {
    return null;
  }
}

async function signOne(supabaseAdmin: any, raw: string): Promise<string | null> {
  const path = extractPath(raw);
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, SIGN_TTL);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function fmtData(iso: string | null): string {
  if (!iso) return "Sem data";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "Sem data";
  }
}

function periodoLabel(antes: string | null, depois: string | null): string {
  if (!antes || !depois) return "";
  const a = new Date(antes).getTime();
  const b = new Date(depois).getTime();
  const ms = Math.abs(b - a);
  const dias = Math.floor(ms / 86400000);
  const meses = Math.floor(dias / 30);
  const diasRest = dias - meses * 30;
  const partes: string[] = [];
  if (meses) partes.push(`${meses} ${meses === 1 ? "mês" : "meses"}`);
  if (diasRest) partes.push(`${diasRest} ${diasRest === 1 ? "dia" : "dias"}`);
  return partes.length ? partes.join(" e ") : "0 dias";
}

export const gerarCheckShapeMensal = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: { alunoId: string; antesFormularioId: string; depoisFormularioId: string }) => {
    if (!data?.alunoId) throw new Error("alunoId obrigatório");
    if (!data?.antesFormularioId) throw new Error("antesFormularioId obrigatório");
    if (!data?.depoisFormularioId) throw new Error("depoisFormularioId obrigatório");
    return data;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: aluno }, { data: forms }, { data: promptRow }] = await Promise.all([
      supabaseAdmin.from("alunos").select("nome").eq("id", data.alunoId).maybeSingle(),
      supabaseAdmin
        .from("formularios")
        .select("id, respondido_em, dados_resposta")
        .in("id", [data.antesFormularioId, data.depoisFormularioId]),
      supabaseAdmin
        .from("prompts_ia")
        .select("prompt_sistema")
        .eq("tipo", "check_shape_mensal" as any)
        .maybeSingle(),
    ]);

    if (!aluno) return { mensagem: null, error: "Aluno não encontrado" };
    if (!forms || forms.length < 2) return { mensagem: null, error: "Envios não encontrados" };

    const antes = forms.find((f: any) => f.id === data.antesFormularioId) as any;
    const depois = forms.find((f: any) => f.id === data.depoisFormularioId) as any;
    if (!antes || !depois) return { mensagem: null, error: "Envios não encontrados" };

    const rawPrompt = promptRow?.prompt_sistema?.trim()
      || `Você é um especialista em avaliação física visual. Compare as fotos antes/depois e produza uma análise objetiva, motivadora e em português.`;

    const periodo = periodoLabel(antes.respondido_em, depois.respondido_em);
    const nomeCurto = primeiroNome(aluno.nome);
    const vars: Record<string, string> = {
      nome_aluno: nomeCurto,
      data_antes: fmtData(antes.respondido_em),
      data_depois: fmtData(depois.respondido_em),
      periodo,
    };
    const systemPrompt = rawPrompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`);

    // Monta as imagens (antes/depois por slot) em URLs assinadas frescas
    const slots: SlotKey[] = ["frente", "costas", "perfil_esquerdo"];
    const content: any[] = [
      {
        type: "text",
        text:
          `Aluno: ${nomeCurto}\n` +
          `Data ANTES: ${fmtData(antes.respondido_em)}\n` +
          `Data DEPOIS: ${fmtData(depois.respondido_em)}\n` +
          `Período analisado: ${periodo}\n\n` +
          `Abaixo seguem pares de fotos (Antes / Depois) para cada ângulo: Frente, Costas, Perfil esquerdo. Faça a análise comparativa.`,
      },
    ];

    let imagensIncluidas = 0;
    for (const slot of slots) {
      const urlA = (antes?.dados_resposta as any)?.fotos?.[slot];
      const urlB = (depois?.dados_resposta as any)?.fotos?.[slot];
      if (typeof urlA === "string" && urlA) {
        const signed = await signOne(supabaseAdmin, urlA);
        if (signed) {
          content.push({ type: "text", text: `${SLOT_LABEL[slot]} — ANTES (${fmtData(antes.respondido_em)})` });
          content.push({ type: "image_url", image_url: { url: signed } });
          imagensIncluidas++;
        }
      }
      if (typeof urlB === "string" && urlB) {
        const signed = await signOne(supabaseAdmin, urlB);
        if (signed) {
          content.push({ type: "text", text: `${SLOT_LABEL[slot]} — DEPOIS (${fmtData(depois.respondido_em)})` });
          content.push({ type: "image_url", image_url: { url: signed } });
          imagensIncluidas++;
        }
      }
    }

    if (imagensIncluidas === 0) {
      return { mensagem: null, error: "Nenhuma foto disponível para comparação" };
    }

    try {
      const apiKey = process.env.LOVABLE_API_KEY;
      if (!apiKey) return { mensagem: null, error: "IA indisponível no momento." };

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content },
          ],
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error("Lovable AI check-shape error", resp.status, t);
        if (resp.status === 401 || resp.status === 403 || resp.status === 404) return { mensagem: null, error: "IA indisponível no momento." };
        if (resp.status === 402) return { mensagem: null, error: "Créditos de IA esgotados." };
        if (resp.status === 429) return { mensagem: null, error: "Muitas requisições. Tente novamente em instantes." };
        return { mensagem: null, error: `Erro na IA (${resp.status})` };
      }
      const json = await resp.json();
      const mensagem = json?.choices?.[0]?.message?.content?.trim() ?? null;
      if (!mensagem) return { mensagem: null, error: "Resposta vazia da IA" };

      // Persiste em mensagens_log para a equipe revisar/enviar
      const { error: logErr } = await supabaseAdmin.from("mensagens_log").insert({
        aluno_id: data.alunoId,
        tipo_job: "Resposta IA — Check Shape Mensal",
        mensagem_enviada: mensagem,
        status_envio: "pendente" as any,
      });
      if (logErr) console.error("mensagens_log insert error", logErr);

      return { mensagem, error: null };
    } catch (e: any) {
      console.error("Lovable AI fetch failed", e);
      return { mensagem: null, error: e?.message || "Falha ao chamar a IA" };
    }
  });