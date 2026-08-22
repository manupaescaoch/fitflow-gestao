import { auth, defineMcp } from "@lovable.dev/mcp-js";
import buscarAlunos from "./tools/buscar-alunos";
import detalheAluno from "./tools/detalhe-aluno";
import resumoFinanceiro from "./tools/resumo-financeiro";
import registrarObservacao from "./tools/registrar-observacao";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "crm-consultoria",
  title: "CRM CONSULTORIA",
  version: "0.1.0",
  instructions:
    "Ferramentas do CRM da consultoria: buscar e consultar alunos, registrar observações e ver o resumo financeiro por competência. O acesso segue as permissões do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [buscarAlunos, detalheAluno, resumoFinanceiro, registrarObservacao],
});
