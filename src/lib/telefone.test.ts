import { describe, it, expect } from "vitest";
import {
  apenasDigitos,
  normalizarTelefoneBR,
  telefoneValido,
  mesmosTelefones,
  telefoneArmazenamento,
} from "@/lib/telefone";

describe("normalizarTelefoneBR", () => {
  it("remove máscara, DDI e 9º dígito → forma canônica de 10 dígitos", () => {
    expect(normalizarTelefoneBR("+55 (81) 99702-6832")).toBe("8197026832");
    expect(normalizarTelefoneBR("5581997026832")).toBe("8197026832");
    expect(normalizarTelefoneBR("81997026832")).toBe("8197026832");
    expect(normalizarTelefoneBR("8197026832")).toBe("8197026832");
  });

  it("preserva landline (10 dígitos sem 9)", () => {
    expect(normalizarTelefoneBR("(11) 3333-4444")).toBe("1133334444");
    expect(normalizarTelefoneBR("551133334444")).toBe("1133334444");
  });

  it("aceita vazio/curto sem quebrar", () => {
    expect(normalizarTelefoneBR("")).toBe("");
    expect(normalizarTelefoneBR(null)).toBe("");
    expect(normalizarTelefoneBR("(11) 1234")).toBe("111234");
  });
});

describe("telefoneValido", () => {
  it("válido apenas com 10 dígitos canônicos", () => {
    expect(telefoneValido("+55 81 99702-6832")).toBe(true);
    expect(telefoneValido("(11) 3333-4444")).toBe(true);
    expect(telefoneValido("9702-6832")).toBe(false);
  });
});

describe("mesmosTelefones", () => {
  it("equivalentes independente de máscara/DDI/9º dígito", () => {
    expect(mesmosTelefones("+55 (81) 99702-6832", "8197026832")).toBe(true);
    expect(mesmosTelefones("5581997026832", "81 9702-6832")).toBe(true);
    expect(mesmosTelefones("11999998888", "11888887777")).toBe(false);
  });
});

describe("telefoneArmazenamento", () => {
  it("prefixa DDI 55 quando faltar e mantém 9º dígito", () => {
    expect(telefoneArmazenamento("(81) 99702-6832")).toBe("5581997026832");
    expect(telefoneArmazenamento("(11) 3333-4444")).toBe("551133334444");
    expect(telefoneArmazenamento("5581997026832")).toBe("5581997026832");
  });
});

describe("apenasDigitos", () => {
  it("strips tudo que não é número", () => {
    expect(apenasDigitos("+55 (81) 99702-6832")).toBe("5581997026832");
    expect(apenasDigitos(null)).toBe("");
  });
});
