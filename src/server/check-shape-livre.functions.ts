import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { primeiroNome } from "@/lib/nome";
import { lerCredencial } from "./credenciais.server";

const BUCKET = "anamnese-uploads";
const SIGN_TTL = 60 * 30; // 30 min

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

async function signOne(raw: string): Promise<string | null> {
  const path = extractPath(raw);
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, SIGN_TTL);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export const gerarCheckShapeLivre = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { alunoId: string; imagensUrls: string[]; observacoes?: string }) => {
    if (!data?.alunoId) throw new Error("alunoId obrigatório");
    if (!Array.isArray(data?.imagensUrls) || data.imagensUrls.length === 0) {
      throw new Error("Envie pelo menos uma imagem");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = (await lerCredencial("OPENAI_API_KEY"));
    if (!apiKey) return { mensagem: null as string | null, error: "OPENAI_API_KEY não configurado" };

    const [{ data: aluno }, { data: promptRow }] = await Promise.all([
      supabaseAdmin.from("alunos").select("nome").eq("id", data.alunoId).maybeSingle(),
      supabaseAdmin
        .from("prompts_ia")
        .select("prompt_sistema")
        .eq("tipo", "check_shape_mensal" as any)
        .maybeSingle(),
    ]);

    if (!aluno) return { mensagem: null, error: "Aluno não encontrado" };

    const rawPrompt = promptRow?.prompt_sistema?.trim()
      || `Você é um especialista em avaliação física visual. Analise as imagens enviadas (fotos e/ou páginas de avaliação) e produza uma análise objetiva, motivadora e em português, no estilo Manu Paes.`;

    const nomeCurto = primeiroNome(aluno.nome);
    const vars: Record<string, string> = {
      nome_aluno: nomeCurto,
      data_antes: "—",
      data_depois: "—",
      periodo: "Análise livre",
    };
    const systemPrompt = rawPrompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? `{{${k}}}`);

    const content: any[] = [
      {
        type: "text",
        text:
          `Aluno: ${nomeCurto}\n` +
          `Modo: análise livre (Check Shape) — o usuário enviou imagens de fotos e/ou páginas de avaliação para análise.\n` +
          (data.observacoes ? `Observações da equipe:\n${data.observacoes}\n\n` : "\n") +
          `Faça a análise comparativa e devolutiva conforme o protocolo Check Shape Mensal.`,
      },
    ];

    let imagensIncluidas = 0;
    for (const url of data.imagensUrls) {
      const signed = await signOne(url);
      if (signed) {
        content.push({ type: "image_url", image_url: { url: signed } });
        imagensIncluidas++;
      }
    }

    if (imagensIncluidas === 0) {
      return { mensagem: null, error: "Nenhuma imagem válida para análise" };
    }

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content },
          ],
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error("OpenAI check-shape-livre error", resp.status, t);
        if (resp.status === 401) return { mensagem: null, error: "Chave OpenAI inválida (401)." };
        if (resp.status === 429) return { mensagem: null, error: "Limite de requisições excedido. Tente novamente em instantes." };
        return { mensagem: null, error: `Erro OpenAI (${resp.status})` };
      }
      const json = await resp.json();
      const mensagem = json?.choices?.[0]?.message?.content?.trim() ?? null;
      if (!mensagem) return { mensagem: null, error: "Resposta vazia da IA" };

      const { error: logErr } = await supabaseAdmin.from("mensagens_log").insert({
        aluno_id: data.alunoId,
        tipo_job: "Resposta IA — Check Shape Mensal",
        mensagem_enviada: mensagem,
        status_envio: "pendente" as any,
      });
      if (logErr) console.error("mensagens_log insert error", logErr);

      return { mensagem, error: null };
    } catch (e: any) {
      console.error("OpenAI fetch failed", e);
      return { mensagem: null, error: e?.message || "Falha ao chamar a OpenAI" };
    }
  });