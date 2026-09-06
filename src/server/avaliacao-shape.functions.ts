import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { primeiroNome } from "@/lib/nome";
import { lerCredencial } from "./credenciais.server";

const BUCKET = "anamnese-uploads";
const SIGN_TTL = 60 * 30;

const PROMPT_PADRAO = `Você é um especialista em avaliação física, estética corporal e análise postural, com olhar clínico de treinador experiente.

Sua função é analisar fotos de shape (frente, lado e costas) e entregar uma avaliação direta, técnica e objetiva, sem enrolação, no estilo Manu Paes.

REGRAS DE RESPOSTA:
- Linguagem simples, direta e firme
- Nada de motivação genérica ou elogio vazio
- Não sugerir treino, dieta ou protocolo
- Apenas leitura do shape e postura
- Foco em estética, proporção, volume, definição e alinhamento corporal
- Evitar termos excessivamente técnicos
- Falar como com alguém que já treina

FORMATO DE SAÍDA (OBRIGATÓRIO — WHATSAPP):
- Texto corrido, pronto para copiar e colar
- Com espaçamento entre blocos
- Sem emojis
- Sem hashtags
- Iniciar obrigatoriamente com: Fala, {{nome_aluno}}.

ESTRUTURA:

VISÃO GERAL
Classificar nível e descrever visual geral

PROPORÇÃO
Superior vs inferior, cintura vs quadril, dorsal vs cintura

MEMBROS INFERIORES
Glúteo, quadríceps, posterior, panturrilha

TRONCO
Abdômen, cintura, costas, ombros

CONDICIONAMENTO
Gordura corporal e definição

POSTURA E DESVIOS POSTURAIS
Cabeça, Ombros, Coluna, Pelve, Quadril, Joelhos, Pés, Assimetrias

RESUMO FINAL
Fechar em 2 a 3 linhas

EXTRA:
- Se houver marcas (ex: ventosa, retenção, etc), citar de forma neutra
- Não julgar, não dramatizar
- Manter postura profissional`;

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

export const gerarAvaliacaoShape = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: { alunoId: string; imagensUrls: string[]; observacoes?: string }) => {
    if (!data?.alunoId) throw new Error("alunoId obrigatório");
    if (!Array.isArray(data?.imagensUrls) || data.imagensUrls.length === 0) {
      throw new Error("Envie pelo menos uma foto");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = (await lerCredencial("OPENAI_API_KEY"));
    if (!apiKey) return { mensagem: null as string | null, error: "OPENAI_API_KEY não configurado" };

    const { data: aluno } = await supabaseAdmin
      .from("alunos").select("nome").eq("id", data.alunoId).maybeSingle();
    if (!aluno) return { mensagem: null, error: "Aluno não encontrado" };

    const nomeCurto = primeiroNome(aluno.nome);
    const systemPrompt = PROMPT_PADRAO.replace(/\{\{\s*nome_aluno\s*\}\}/g, nomeCurto);

    const content: any[] = [
      {
        type: "text",
        text:
          `Aluno: ${nomeCurto}\n` +
          `Modo: Avaliação de Shape (fotos frente, lado e costas).\n` +
          (data.observacoes ? `Observações da equipe:\n${data.observacoes}\n\n` : "\n") +
          `Faça a avaliação de shape conforme a estrutura definida.`,
      },
    ];

    let incluidas = 0;
    for (const url of data.imagensUrls) {
      const signed = await signOne(url);
      if (signed) { content.push({ type: "image_url", image_url: { url: signed } }); incluidas++; }
    }
    if (incluidas === 0) return { mensagem: null, error: "Nenhuma imagem válida" };

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
        console.error("OpenAI avaliacao-shape error", resp.status, t);
        if (resp.status === 401) return { mensagem: null, error: "Chave OpenAI inválida (401)." };
        if (resp.status === 429) return { mensagem: null, error: "Limite de requisições excedido. Tente novamente em instantes." };
        return { mensagem: null, error: `Erro OpenAI (${resp.status})` };
      }
      const json = await resp.json();
      const mensagem = json?.choices?.[0]?.message?.content?.trim() ?? null;
      if (!mensagem) return { mensagem: null, error: "Resposta vazia da IA" };

      const { error: logErr } = await supabaseAdmin.from("mensagens_log").insert({
        aluno_id: data.alunoId,
        tipo_job: "Resposta IA — Avaliação de Shape",
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