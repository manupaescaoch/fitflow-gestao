import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "detalhe_aluno",
  title: "Detalhe do aluno",
  description: "Retorna os dados completos de um aluno do CRM pelo seu ID.",
  inputSchema: {
    aluno_id: z.string().uuid().describe("ID (uuid) do aluno."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ aluno_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("alunos")
      .select("*")
      .eq("id", aluno_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Aluno não encontrado" }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { aluno: data },
    };
  },
});
