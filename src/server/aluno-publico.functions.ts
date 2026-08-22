import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { normalizarTelefoneBR, telefoneValido } from "@/lib/telefone";

const InputSchema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório"),
  telefone: z.string().trim().min(1, "Telefone obrigatório"),
  email: z.string().trim().email().optional().nullable(),
  peso_kg: z.union([z.string(), z.number()]).optional().nullable(),
  altura_cm: z.union([z.string(), z.number()]).optional().nullable(),
  sexo: z.string().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
});

function apenasDigitos(s: string): string {
  return (s || "").replace(/\D/g, "");
}

/** Converte "69", "69,5", 69.5 etc. para Number positivo. Retorna null se inválido. */
export function normalizarNumero(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;
  const s = String(input).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Mapeia "Feminino"/"Masculino"/variações para 'feminino'|'masculino'. Retorna null se desconhecido. */
export function normalizarSexo(input: unknown): "feminino" | "masculino" | null {
  if (!input) return null;
  const s = String(input)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!s) return null;
  if (s.startsWith("f")) return "feminino";
  if (s.startsWith("m")) return "masculino";
  return null;
}

/** Aceita "YYYY-MM-DD" ou "DD/MM/YYYY". Retorna ISO date "YYYY-MM-DD" ou null. */
export function normalizarDataNascimento(input: unknown): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  // YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [_, y, mo, d] = m;
    return validarData(Number(y), Number(mo), Number(d));
  }
  // DD/MM/YYYY
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [_, d, mo, y] = m;
    return validarData(Number(y), Number(mo), Number(d));
  }
  return null;
}

function validarData(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  )
    return null;
  if (y < 1900 || dt.getTime() > Date.now()) return null;
  return `${y.toString().padStart(4, "0")}-${mo.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

export type CriarAlunoPublicoResult =
  | { id: string; criado: boolean; error: null }
  | { id: null; criado: false; error: string };

/**
 * Cria (ou recupera) um aluno a partir dos dados de uma anamnese pública.
 * Roda com service role para evitar problemas de RLS quando o cliente está
 * em sessão anônima/expirada. Retorna o aluno existente caso o telefone já
 * esteja cadastrado.
 *
 * Quando recebe peso/altura/sexo/nascimento, preenche também esses campos:
 *  - na criação, todos vão direto para o INSERT.
 *  - em aluno já existente, faz UPDATE apenas dos campos que estão NULL no
 *    banco (nunca sobrescreve dado preenchido manualmente pela equipe).
 */
export const criarAlunoPublico = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<CriarAlunoPublicoResult> => {
    const nome = data.nome.trim();
    const canonico = normalizarTelefoneBR(data.telefone);
    // Armazenamos sempre em forma canônica (10 dígitos, sem DDI 55 nem 9º
    // dígito de celular) — mesmo padrão dos cadastros da venda, evita
    // formatos divergentes que dificultavam a comparação.
    const whatsapp = canonico;
    const email = data.email?.trim() || null;
    const peso_kg = normalizarNumero(data.peso_kg);
    const altura_cm = normalizarNumero(data.altura_cm);
    const sexo = normalizarSexo(data.sexo);
    const data_nascimento = normalizarDataNascimento(data.data_nascimento);

    if (!telefoneValido(canonico)) {
      return {
        id: null,
        criado: false,
        error:
          "Confira o telefone: precisa ter DDD + número (ex: 81 91234-5678).",
      };
    }

    // 1) Já existe aluno com esse whatsapp? (compara forma canônica)
    try {
      const { data: existente, error: rpcErr } = await supabaseAdmin
        .rpc("buscar_aluno_por_telefone", { _telefone: canonico });
      if (rpcErr) {
        console.error("[criarAlunoPublico] rpc error", rpcErr);
      } else {
        const row = Array.isArray(existente) ? existente[0] : existente;
        if (row?.id) {
          await preencherCamposVazios(row.id as string, {
            email,
            peso_kg,
            altura_cm,
            sexo,
            data_nascimento,
          });
          return { id: row.id as string, criado: false, error: null };
        }
      }
    } catch (e) {
      console.error("[criarAlunoPublico] rpc exception", e);
    }

    // 2) Lookup secundário por nome+email — pega casos em que o telefone foi
    //    digitado errado no cadastro original mas o email bate.
    if (email) {
      try {
        const { data: porEmail } = await supabaseAdmin
          .from("alunos")
          .select("id, nome")
          .ilike("email", email)
          .ilike("nome", nome)
          .limit(1)
          .maybeSingle();
        if (porEmail?.id) {
          await preencherCamposVazios(porEmail.id as string, {
            email,
            peso_kg,
            altura_cm,
            sexo,
            data_nascimento,
          });
          return { id: porEmail.id as string, criado: false, error: null };
        }
      } catch (e) {
        console.error("[criarAlunoPublico] lookup email exception", e);
      }
    }

    // 3) Cria com service role (bypassa RLS)
    const { data: novo, error: insErr } = await supabaseAdmin
      .from("alunos")
      .insert({
        nome,
        whatsapp,
        email,
        origem: "anamnese",
        status: "aguardando_anamnese",
        ...(peso_kg !== null ? { peso_kg } : {}),
        ...(altura_cm !== null ? { altura_cm } : {}),
        ...(sexo !== null ? { sexo } : {}),
        ...(data_nascimento !== null ? { data_nascimento } : {}),
      })
      .select("id")
      .single();

    if (insErr || !novo?.id) {
      // Colidiu com o índice único do whatsapp canônico — busca o existente
      // (provavelmente cadastrado em outra grafia) e devolve em vez de erro.
      if ((insErr as any)?.code === "23505") {
        try {
          const { data: existente } = await supabaseAdmin
            .rpc("buscar_aluno_por_telefone", { _telefone: canonico });
          const row = Array.isArray(existente) ? existente[0] : existente;
          if (row?.id) {
            return { id: row.id as string, criado: false, error: null };
          }
        } catch (e) {
          console.error("[criarAlunoPublico] recover after unique violation", e);
        }
      }
      console.error("[criarAlunoPublico] insert error", insErr);
      return {
        id: null,
        criado: false,
        error: insErr?.message || "Falha ao criar aluno",
      };
    }

    return { id: novo.id as string, criado: true, error: null };
  });

/**
 * Atualiza apenas campos que estão null/vazio no aluno existente.
 * Nunca sobrescreve valor já preenchido pela equipe.
 */
async function preencherCamposVazios(
  alunoId: string,
  campos: {
    email: string | null;
    peso_kg: number | null;
    altura_cm: number | null;
    sexo: "feminino" | "masculino" | null;
    data_nascimento: string | null;
  },
) {
  const { data: atual, error } = await supabaseAdmin
    .from("alunos")
    .select("email, peso_kg, altura_cm, sexo, data_nascimento")
    .eq("id", alunoId)
    .single();
  if (error || !atual) return;

  const patch: {
    email?: string;
    peso_kg?: number;
    altura_cm?: number;
    sexo?: string;
    data_nascimento?: string;
  } = {};
  if (!atual.email && campos.email) patch.email = campos.email;
  if (atual.peso_kg == null && campos.peso_kg !== null) patch.peso_kg = campos.peso_kg;
  if (atual.altura_cm == null && campos.altura_cm !== null) patch.altura_cm = campos.altura_cm;
  if (!atual.sexo && campos.sexo) patch.sexo = campos.sexo;
  if (!atual.data_nascimento && campos.data_nascimento) patch.data_nascimento = campos.data_nascimento;

  if (Object.keys(patch).length === 0) return;

  const { error: updErr } = await supabaseAdmin
    .from("alunos")
    .update(patch)
    .eq("id", alunoId);
  if (updErr) console.error("[criarAlunoPublico] preencherCamposVazios", updErr);
}