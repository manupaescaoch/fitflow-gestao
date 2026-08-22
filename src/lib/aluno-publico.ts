import { supabase } from "@/integrations/supabase/client";
import { logarFalhaPublicaServer } from "@/server/log-publico.functions";
import {
  apenasDigitos,
  normalizarTelefoneBR,
  telefoneArmazenamento,
  telefoneValido,
} from "@/lib/telefone";

/**
 * @deprecated Use `normalizarTelefoneBR` (canônica para match) ou
 * `telefoneArmazenamento` (para gravar) de `@/lib/telefone`.
 * Mantida como alias para não quebrar callers existentes — devolve apenas
 * os dígitos do input (mesmo comportamento anterior).
 */
export function normalizarTelefone(s: string): string {
  return apenasDigitos(s);
}

export { normalizarTelefoneBR, telefoneArmazenamento } from "@/lib/telefone";

export async function buscarAlunoPorTelefone(
  telefone: string,
): Promise<{ id: string; nome: string } | null> {
  const canonico = normalizarTelefoneBR(telefone);
  if (!telefoneValido(canonico)) return null;
  const { data, error } = await supabase.rpc("buscar_aluno_por_telefone", {
    _telefone: canonico,
  });
  if (error) {
    console.error("buscar_aluno_por_telefone", error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return null;
  return { id: row.id as string, nome: (row.nome as string) ?? "" };
}

export async function criarAlunoViaAnamnese(input: {
  nome: string;
  telefone: string;
  email?: string | null;
}): Promise<{ id: string } | null> {
  const nome = (input.nome || "").trim();
  if (!nome || !telefoneValido(input.telefone)) return null;
  const whatsapp = telefoneArmazenamento(input.telefone);
  const { data, error } = await supabase
    .from("alunos")
    .insert({
      nome,
      whatsapp,
      email: input.email?.trim() || null,
      origem: "anamnese",
      status: "aguardando_anamnese",
    })
    .select("id")
    .single();
  if (error) {
    console.error("criarAlunoViaAnamnese", error);
    return null;
  }
  return { id: data.id as string };
}

export async function criarAlunoViaAnamneseDetalhado(input: {
  nome: string;
  telefone: string;
  email?: string | null;
}): Promise<{ id: string | null; error: string | null }> {
  const nome = (input.nome || "").trim();
  if (!nome || !telefoneValido(input.telefone)) {
    return { id: null, error: "Dados insuficientes (nome/telefone)" };
  }
  const whatsapp = telefoneArmazenamento(input.telefone);
  const { data, error } = await supabase
    .from("alunos")
    .insert({
      nome,
      whatsapp,
      email: input.email?.trim() || null,
      origem: "anamnese",
      status: "aguardando_anamnese",
    })
    .select("id")
    .single();
  if (error) return { id: null, error: error.message };
  return { id: data.id as string, error: null };
}

export async function logarFalhaPublica(input: {
  modulo: "anamnese_publica" | "feedback_publico";
  etapa: string;
  mensagem: string;
  contexto?: Record<string, any>;
  alunoNome?: string | null;
}) {
  try {
    await logarFalhaPublicaServer({
      data: {
        modulo: input.modulo,
        etapa: input.etapa,
        mensagem: input.mensagem,
        contexto: input.contexto,
        alunoNome: input.alunoNome ?? null,
      },
    });
  } catch (e) {
    console.error("logarFalhaPublica", e);
  }
}