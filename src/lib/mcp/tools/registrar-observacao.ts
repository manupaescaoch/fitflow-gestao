import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "registrar_observacao_aluno",
  title: "Registrar observação do aluno",
  description:
    "Acrescenta um texto ao campo de observações do aluno, preservando o conteúdo existente.",
  inputSchema: {
    aluno_id: z.string().uuid().describe("ID (uuid) do aluno."),
    observacao: z.string().trim().min(1).describe("Texto a acrescentar às observações."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ aluno_id, observacao }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: atual, error: readError } = await supabase
      .from("alunos")
      .select("id, nome, observacoes")
      .eq("id", aluno_id)
      .maybeSingle();
    if (readError) return { content: [{ type: "text", text: readError.message }], isError: true };
    if (!atual) return { content: [{ type: "text", text: "Aluno não encontrado" }], isError: true };

    const carimbo = new Date().toISOString().slice(0, 10);
    const texto = `${atual.observacoes ? `${atual.observacoes}\n` : ""}[${carimbo}] ${observacao}`;

    const { data, error } = await supabase
      .from("alunos")
      .update({ observacoes: texto })
      .eq("id", aluno_id)
      .select("id, nome, observacoes")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { aluno: data },
    };
  },
});
