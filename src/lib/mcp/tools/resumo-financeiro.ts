import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "resumo_financeiro",
  title: "Resumo financeiro",
  description:
    "Soma entradas e saídas das transações de uma competência (formato AAAA-MM) e retorna o saldo.",
  inputSchema: {
    competencia: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .describe("Competência no formato AAAA-MM, ex: 2026-08."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ competencia }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("transacoes")
      .select("tipo, valor, descricao, data_transacao")
      .eq("competencia", competencia)
      .limit(1000);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const entradas = rows
      .filter((r) => r.tipo === "entrada")
      .reduce((s, r) => s + Number(r.valor ?? 0), 0);
    const saidas = rows
      .filter((r) => r.tipo !== "entrada")
      .reduce((s, r) => s + Number(r.valor ?? 0), 0);
    const resumo = {
      competencia,
      quantidade: rows.length,
      entradas,
      saidas,
      saldo: entradas - saidas,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(resumo) }],
      structuredContent: resumo,
    };
  },
});
