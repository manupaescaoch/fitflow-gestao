import { getAiConfig } from "./ai-provider.server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAlunoAuth } from "./aluno-middleware";

const SYSTEM_PROMPT = `Você é o Agente de Substituições Alimentares da MPTEAM, baseado em TACO > TBCA > USDA > rótulo.

Ao receber "quantidade + alimento" ou refeição completa (texto/foto), gere até 5 substituições nutricionalmente equivalentes, com foco em calorias e no macro predominante.

REGRAS:
- Identifique alimentos, porções e macros. Some tudo se for refeição.
- Margens: Carbo ±5g, Ptn ±3g, Gord ±3g, Calorias ±10%. Se inviável, mantenha o macro principal e aceite até 15% nos demais.
- Sempre porções em gramas. Adicione tag quando relevante: "Mais proteína", "Menos kcal", "Low carb", "Vegano", etc.
- Filtros (sem glúten, vegano, sem lactose, low carb, high protein, etc): aplique.
- PT-BR, sem emojis, sem explicações clínicas.
- Use a função "responder_substituicoes" para responder.`;

const TOOL = {
  type: "function",
  function: {
    name: "responder_substituicoes",
    description: "Retorna a referência e as substituições equivalentes em formato estruturado.",
    parameters: {
      type: "object",
      properties: {
        referencia: {
          type: "object",
          properties: {
            descricao: { type: "string" },
            kcal: { type: "number" },
            ptn: { type: "number" },
            cho: { type: "number" },
            gord: { type: "number" },
          },
          required: ["descricao", "kcal", "ptn", "cho", "gord"],
          additionalProperties: false,
        },
        substituicoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              descricao: { type: "string" },
              kcal: { type: "number" },
              ptn: { type: "number" },
              cho: { type: "number" },
              gord: { type: "number" },
              tag: { type: "string" },
            },
            required: ["descricao", "kcal", "ptn", "cho", "gord", "tag"],
            additionalProperties: false,
          },
        },
      },
      required: ["referencia", "substituicoes"],
      additionalProperties: false,
    },
  },
};

const inputSchema = z.object({
  pedido: z.string().max(2000).optional().default(""),
  filtro: z.string().max(100).optional().default(""),
  imagem: z.string().max(8_000_000).optional().default(""),
});

export const gerarTrocasIA = createServerFn({ method: "POST" })
  .middleware([requireAlunoAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const pedido = (data.pedido || "").trim();
    const filtro = (data.filtro || "").trim();
    const imagem = data.imagem || "";
    const temTexto = pedido.length > 0;
    const temImagem = typeof imagem === "string" && imagem.startsWith("data:image");
    if (!temTexto && !temImagem) {
      return { error: "Envie um alimento, refeição ou foto do prato.", data: null, resposta: "" };
    }

    const ai = getAiConfig();
    if (!ai) {
      console.error("trocas-ia: AI_API_KEY não configurada");
      return { error: "IA indisponível no momento.", data: null, resposta: "" };
    }

    const partes: any[] = [];
    const filtroTxt = filtro && filtro !== "Todos" ? `\nFiltro: ${filtro}` : "";
    if (temImagem) {
      partes.push({
        type: "text",
        text: `Identifique os alimentos e porções da foto e gere até 5 refeições substitutas equivalentes.${
          temTexto ? `\nContexto adicional: ${pedido}` : ""
        }${filtroTxt}`,
      });
      partes.push({ type: "image_url", image_url: { url: imagem } });
    } else {
      partes.push({ type: "text", text: `Pedido: ${pedido}${filtroTxt}` });
    }

    const resp = await fetch(ai.url, {
      method: "POST",
      headers: ai.headers,
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: partes },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "responder_substituicoes" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return { error: "Muitas requisições. Tente novamente em instantes.", data: null, resposta: "" };
      }
      if (resp.status === 402) {
        return { error: "Créditos de IA esgotados.", data: null, resposta: "" };
      }
      const t = await resp.text();
      console.error("trocas-ia AI gateway error:", resp.status, t);
      return { error: "Erro na IA", data: null, resposta: "" };
    }

    const json = await resp.json();
    const msg = json?.choices?.[0]?.message;
    const args = msg?.tool_calls?.[0]?.function?.arguments;
    let parsed: any = null;
    if (args) {
      try {
        parsed = typeof args === "string" ? JSON.parse(args) : args;
      } catch (e) {
        console.error("trocas-ia parse args:", e);
      }
    }
    return { data: parsed, resposta: msg?.content ?? "", error: null };
  });
