import { describe, it, expect } from "vitest";
import { z } from "zod";

// Mesma normalização e schema usados pelo server function.
// Mantemos cópia local para testar sem inicializar o cliente Supabase admin.
function normalizarTelefone(s: string): string {
  return (s || "").replace(/\D/g, "");
}

function normalizarNumero(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;
  const s = String(input).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function normalizarSexo(input: unknown): "feminino" | "masculino" | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!s) return null;
  if (s.startsWith("f")) return "feminino";
  if (s.startsWith("m")) return "masculino";
  return null;
}

function validarData(y: number, mo: number, d: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1900 || dt.getTime() > Date.now()) return null;
  return `${y.toString().padStart(4, "0")}-${mo.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

function normalizarDataNascimento(input: unknown): string | null {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return validarData(Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return validarData(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

const InputSchema = z.object({
  nome: z.string().trim().min(1),
  telefone: z.string().trim().min(1),
  email: z.string().trim().email().optional().nullable(),
  peso_kg: z.union([z.string(), z.number()]).optional().nullable(),
  altura_cm: z.union([z.string(), z.number()]).optional().nullable(),
  sexo: z.string().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
});

describe("normalizarTelefone", () => {
  it("remove formatação", () => {
    expect(normalizarTelefone("+55 (81) 99702-6832")).toBe("5581997026832");
    expect(normalizarTelefone("5581997026832")).toBe("5581997026832");
  });
  it("trata vazio e nulo", () => {
    expect(normalizarTelefone("")).toBe("");
    expect(normalizarTelefone(undefined as unknown as string)).toBe("");
  });
});

describe("InputSchema (criarAlunoPublico)", () => {
  it("aceita payload válido com email", () => {
    const r = InputSchema.parse({ nome: "Erica", telefone: "5581997026832", email: "a@b.co" });
    expect(r.nome).toBe("Erica");
  });
  it("aceita email null/undefined", () => {
    expect(() => InputSchema.parse({ nome: "X", telefone: "5511999999999", email: null })).not.toThrow();
    expect(() => InputSchema.parse({ nome: "X", telefone: "5511999999999" })).not.toThrow();
  });
  it("aceita campos pessoais opcionais", () => {
    const r = InputSchema.parse({
      nome: "X",
      telefone: "5511999999999",
      peso_kg: "69",
      altura_cm: 164,
      sexo: "Feminino",
      data_nascimento: "1988-10-11",
    });
    expect(r.peso_kg).toBe("69");
    expect(r.altura_cm).toBe(164);
  });
  it("rejeita nome vazio", () => {
    expect(() => InputSchema.parse({ nome: "  ", telefone: "5511999999999" })).toThrow();
  });
  it("rejeita telefone vazio", () => {
    expect(() => InputSchema.parse({ nome: "X", telefone: "" })).toThrow();
  });
  it("rejeita email inválido", () => {
    expect(() => InputSchema.parse({ nome: "X", telefone: "5511999999999", email: "nao-eh-email" })).toThrow();
  });
});

describe("regra de telefone curto", () => {
  it("normalizado com menos de 8 dígitos é inválido para criação de aluno", () => {
    const tel = normalizarTelefone("(11) 1234");
    expect(tel.length < 8).toBe(true);
  });
  it("normalizado com 8+ dígitos passa", () => {
    const tel = normalizarTelefone("5581997026832");
    expect(tel.length >= 8).toBe(true);
  });
});

describe("normalizarNumero", () => {
  it("aceita string com vírgula", () => {
    expect(normalizarNumero("69,5")).toBe(69.5);
  });
  it("aceita number", () => {
    expect(normalizarNumero(164)).toBe(164);
  });
  it("rejeita zero, negativo e lixo", () => {
    expect(normalizarNumero(0)).toBeNull();
    expect(normalizarNumero("-1")).toBeNull();
    expect(normalizarNumero("abc")).toBeNull();
    expect(normalizarNumero("")).toBeNull();
    expect(normalizarNumero(null)).toBeNull();
    expect(normalizarNumero(undefined)).toBeNull();
  });
});

describe("normalizarSexo", () => {
  it("mapeia Feminino/Masculino", () => {
    expect(normalizarSexo("Feminino")).toBe("feminino");
    expect(normalizarSexo("masculino")).toBe("masculino");
    expect(normalizarSexo("F")).toBe("feminino");
    expect(normalizarSexo("M")).toBe("masculino");
  });
  it("ignora valores desconhecidos", () => {
    expect(normalizarSexo("Outro")).toBeNull();
    expect(normalizarSexo("")).toBeNull();
    expect(normalizarSexo(null)).toBeNull();
  });
});

describe("normalizarDataNascimento", () => {
  it("aceita ISO YYYY-MM-DD", () => {
    expect(normalizarDataNascimento("1988-10-11")).toBe("1988-10-11");
  });
  it("aceita BR DD/MM/YYYY", () => {
    expect(normalizarDataNascimento("11/10/1988")).toBe("1988-10-11");
  });
  it("rejeita data inválida ou no futuro", () => {
    expect(normalizarDataNascimento("1988-13-01")).toBeNull();
    expect(normalizarDataNascimento("32/01/1988")).toBeNull();
    expect(normalizarDataNascimento("2999-01-01")).toBeNull();
    expect(normalizarDataNascimento("abc")).toBeNull();
    expect(normalizarDataNascimento("")).toBeNull();
  });
});