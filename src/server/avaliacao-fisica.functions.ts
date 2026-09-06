import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { lerCredencial } from "./credenciais.server";

interface FeedbackInput {
  alunoNome: string;
  dadosAtual: {
    peso: number | null;
    bf: number | null;
    massaMagra: number | null;
    cintura: number | null;
    abdomen: number | null;
    quadril: number | null;
    somaDobras: number | null;
    imc: number | null;
  };
  dadosAnterior: {
    peso: number | null;
    bf: number | null;
    massaMagra: number | null;
    cintura: number | null;
    abdomen: number | null;
    quadril: number | null;
    somaDobras: number | null;
    imc: number | null;
  } | null;
  observacoes: string | null;
  tipoAvaliacao: "inicial" | "reavaliacao";
}

export const gerarFeedbackAvaliacao = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: FeedbackInput) => input)
  .handler(async ({ data }) => {
    const key = (await lerCredencial("OPENAI_API_KEY"));
    if (!key) {
      return { ok: false as const, error: "OPENAI_API_KEY não configurada." };
    }

    const sistema = `Você é Manu Paes, treinador da MPTEAM. Tom direto, firme, objetivo, sem enrolação, sem clichês motivacionais. Frases curtas. Linguagem coloquial brasileira. Não usa emojis. Foca em consistência, evolução real e direcionamento prático.`;

    const userPrompt = buildUserPrompt(data);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.7,
          max_tokens: 500,
          messages: [
            { role: "system", content: sistema },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        return { ok: false as const, error: `OpenAI HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      const json = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
      const conteudo = json.choices?.[0]?.message?.content?.trim() ?? "";
      if (!conteudo) {
        return { ok: false as const, error: "Resposta vazia do modelo." };
      }
      return { ok: true as const, mensagem: conteudo };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Erro desconhecido" };
    }
  });

function buildUserPrompt(d: FeedbackInput): string {
  const lines: string[] = [];
  lines.push(`Aluno: ${d.alunoNome}`);
  lines.push(`Tipo: ${d.tipoAvaliacao === "inicial" ? "1ª avaliação física" : "Reavaliação"}`);
  lines.push("");
  lines.push("Dados atuais:");
  lines.push(`- Peso: ${fmt(d.dadosAtual.peso, "kg")}`);
  lines.push(`- IMC: ${fmt(d.dadosAtual.imc)}`);
  lines.push(`- % gordura: ${fmt(d.dadosAtual.bf, "%")}`);
  lines.push(`- Massa magra: ${fmt(d.dadosAtual.massaMagra, "kg")}`);
  lines.push(`- Cintura: ${fmt(d.dadosAtual.cintura, "cm")}`);
  lines.push(`- Abdômen: ${fmt(d.dadosAtual.abdomen, "cm")}`);
  lines.push(`- Quadril: ${fmt(d.dadosAtual.quadril, "cm")}`);
  lines.push(`- Soma de dobras: ${fmt(d.dadosAtual.somaDobras, "mm")}`);

  if (d.dadosAnterior) {
    lines.push("");
    lines.push("Avaliação anterior (para comparação):");
    lines.push(`- Peso: ${fmt(d.dadosAnterior.peso, "kg")}`);
    lines.push(`- % gordura: ${fmt(d.dadosAnterior.bf, "%")}`);
    lines.push(`- Massa magra: ${fmt(d.dadosAnterior.massaMagra, "kg")}`);
    lines.push(`- Cintura: ${fmt(d.dadosAnterior.cintura, "cm")}`);
    lines.push(`- Soma de dobras: ${fmt(d.dadosAnterior.somaDobras, "mm")}`);
  }

  if (d.observacoes) {
    lines.push("");
    lines.push(`Observações do avaliador: ${d.observacoes}`);
  }

  lines.push("");
  lines.push("Gere um feedback curto (máximo 6 linhas) no tom Manu Paes contendo:");
  lines.push("1. Saudação direta com o nome.");
  lines.push("2. Análise objetiva da evolução (sem enrolar, focando em cintura, dobras e massa magra antes do peso).");
  lines.push("3. Pontos positivos.");
  lines.push("4. Pontos de atenção, se houver.");
  lines.push("5. Direcionamento para o próximo ciclo.");
  return lines.join("\n");
}

function fmt(n: number | null | undefined, suffix = ""): string {
  if (n == null || isNaN(Number(n))) return "—";
  const v = Number(n);
  const s = v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return suffix ? `${s} ${suffix}` : s;
}