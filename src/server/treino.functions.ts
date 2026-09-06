import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { primeiroNome } from "@/lib/nome";
import { lerCredencial } from "./credenciais.server";

type Input = {
  nomeAluno: string;
  resumoAjusteTreino: string;
};

export const gerarMensagemTreino = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: Input) => {
    if (!data?.nomeAluno || !data?.resumoAjusteTreino?.trim()) {
      throw new Error("Campos obrigatórios ausentes");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = (await lerCredencial("OPENAI_API_KEY"));
    if (!apiKey) {
      return {
        mensagem: null as string | null,
        error: "OPENAI_API_KEY não configurado",
        extraidos: null as null | { ajustes_realizados: string; dificuldades: string; medidas_otimizacao: string },
      };
    }

    // Fetch system prompt
    const { data: promptRow, error: pErr } = await supabaseAdmin
      .from("prompts_ia")
      .select("prompt_sistema")
      .eq("tipo", "estrategia_treino")
      .maybeSingle();
    if (pErr) {
      console.error("Erro ao buscar prompt:", pErr);
      return { mensagem: null, error: "Não foi possível carregar o prompt de Estratégia de Treino. Configure em Configurações → Feedbacks → Prompts IA → Estratégia de Treino.", extraidos: null };
    }
    const rawPrompt = promptRow?.prompt_sistema?.trim() || "Você é um assistente que escreve mensagens de ajuste de treino para alunos de personal trainer. Seja claro, objetivo e motivador.";

    // 1) Extrair campos estruturados do resumo livre via IA (tool-calling)
    let extraidos = {
      nome_aluno: data.nomeAluno,
      ajustes_realizados: "Não informado.",
      dificuldades: "Não informado.",
      medidas_otimizacao: "Não informado.",
    };
    try {
      const extractResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Você extrai informações estruturadas de um resumo livre escrito por um personal trainer sobre o ajuste de treino de um aluno. Se alguma informação não estiver clara, use exatamente 'Não informado.'.",
            },
            {
              role: "user",
              content: `Nome do aluno (já conhecido): ${data.nomeAluno}\n\nResumo livre:\n${data.resumoAjusteTreino}`,
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extrair_ajuste_treino",
                description: "Extrai campos estruturados a partir do resumo livre.",
                parameters: {
                  type: "object",
                  properties: {
                    nome_aluno: { type: "string" },
                    ajustes_realizados: { type: "string" },
                    dificuldades: { type: "string" },
                    medidas_otimizacao: { type: "string" },
                  },
                  required: ["nome_aluno", "ajustes_realizados", "dificuldades", "medidas_otimizacao"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "extrair_ajuste_treino" } },
        }),
      });
      if (extractResp.ok) {
        const j = await extractResp.json();
        const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (args) {
          const parsed = JSON.parse(args);
          extraidos = {
            nome_aluno: parsed.nome_aluno?.trim() || data.nomeAluno,
            ajustes_realizados: parsed.ajustes_realizados?.trim() || "Não informado.",
            dificuldades: parsed.dificuldades?.trim() || "Não informado.",
            medidas_otimizacao: parsed.medidas_otimizacao?.trim() || "Não informado.",
          };
        }
      } else {
        console.error("OpenAI extract error", extractResp.status, await extractResp.text());
      }
    } catch (e) {
      console.error("Falha ao extrair campos do resumo:", e);
    }
    // Mensagens enviadas ao aluno usam apenas o primeiro nome
    extraidos.nome_aluno = primeiroNome(extraidos.nome_aluno) || extraidos.nome_aluno;

    const vars: Record<string, string> = {
      nome_aluno: extraidos.nome_aluno,
      ajustes_realizados: extraidos.ajustes_realizados,
      dificuldades: extraidos.dificuldades,
      medidas_otimizacao: extraidos.medidas_otimizacao,
      resumo_ajuste_treino: data.resumoAjusteTreino,
    };
    // Replace {{var}} (and also legacy [var]) inside the system prompt
    const systemPrompt = rawPrompt.replace(/\{\{\s*(\w+)\s*\}\}|\[(\w+)\]/g, (_m, a, b) => {
      const key = (a ?? b) as string;
      return vars[key] ?? `{{${key}}}`;
    });

    const guard = [
      "",
      "REGRA FINAL OBRIGATÓRIA (sobrepõe qualquer instrução anterior):",
      "- Use APENAS as informações do resumo do personal trainer enviado pelo usuário.",
      "- NUNCA peça mais informações nem diga que faltam dados.",
      "- Se algum dado não foi informado, simplesmente omita essa parte.",
      "- Sempre entregue a mensagem FINAL pronta para enviar ao aluno via WhatsApp.",
      "- Comece pelo primeiro nome do aluno.",
    ].join("\n");
    const finalSystemPrompt = `${systemPrompt}\n${guard}`;

    const userContent = [
      `Resumo escrito pelo personal trainer Manu Paes sobre o ajuste de treino do aluno ${extraidos.nome_aluno}:`,
      ``,
      `"${data.resumoAjusteTreino}"`,
      ``,
      `Reescreva como mensagem do Manu Paes para o aluno via WhatsApp, seguindo todas as regras do system prompt.`,
    ].join("\n");

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 800,
          messages: [
            { role: "system", content: finalSystemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error("OpenAI error", resp.status, t);
        return { mensagem: null, error: `OpenAI ${resp.status}`, extraidos: null };
      }
      const json = await resp.json();
      const mensagem = json?.choices?.[0]?.message?.content?.trim() ?? null;
      if (!mensagem) return { mensagem: null, error: "Resposta vazia da IA", extraidos: null };
      return {
        mensagem,
        error: null,
        extraidos: {
          ajustes_realizados: extraidos.ajustes_realizados,
          dificuldades: extraidos.dificuldades,
          medidas_otimizacao: extraidos.medidas_otimizacao,
        },
      };
    } catch (e) {
      console.error("OpenAI fetch failed", e);
      return { mensagem: null, error: "Falha ao chamar OpenAI", extraidos: null };
    }
  });