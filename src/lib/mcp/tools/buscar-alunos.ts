import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "buscar_alunos",
  title: "Buscar alunos",
  description:
    "Lista ou busca alunos do CRM por nome, e-mail ou WhatsApp, com filtro opcional de status.",
  inputSchema: {
    busca: z.string().trim().optional().describe("Texto para buscar em nome, e-mail ou WhatsApp."),
    status: z.string().trim().optional().describe("Filtra por status do aluno (ex: ativo)."),
    limite: z.number().int().min(1).max(50).optional().describe("Máximo de resultados (padrão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, status, limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("alunos")
      .select("id, nome, email, whatsapp, status, plano, modalidade, data_expiracao, renovado")
      .order("criado_em", { ascending: false })
      .limit(limite ?? 20);

    if (status) query = query.eq("status", status as never);
    if (busca) {
      const t = busca.replace(/[,%]/g, " ").trim();
      query = query.or(`nome.ilike.%${t}%,email.ilike.%${t}%,whatsapp.ilike.%${t}%`);
    }

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { alunos: data ?? [] },
    };
  },
});
