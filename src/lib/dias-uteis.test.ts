import { describe, it, expect } from "vitest";
import { ehFimDeSemana, getJanelaDiasUteis } from "./dias-uteis";

function utc(s: string): Date {
  return new Date(s + "T12:00:00.000Z");
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe("ehFimDeSemana", () => {
  it("retorna true para sábado e domingo", () => {
    expect(ehFimDeSemana(utc("2026-05-02"))).toBe(true); // sábado
    expect(ehFimDeSemana(utc("2026-05-03"))).toBe(true); // domingo
  });
  it("retorna false para dias úteis", () => {
    expect(ehFimDeSemana(utc("2026-05-04"))).toBe(false); // segunda
    expect(ehFimDeSemana(utc("2026-05-05"))).toBe(false); // terça
    expect(ehFimDeSemana(utc("2026-05-08"))).toBe(false); // sexta
  });
});

describe("getJanelaDiasUteis (d+7)", () => {
  it("retorna null em sábado", () => {
    expect(getJanelaDiasUteis(utc("2026-05-02"), 7)).toBeNull();
  });
  it("retorna null em domingo", () => {
    expect(getJanelaDiasUteis(utc("2026-05-03"), 7)).toBeNull();
  });

  it("janela de 1 dia em terça", () => {
    // ter 05/05 → D+0 em 28/04
    const j = getJanelaDiasUteis(utc("2026-05-05"), 7)!;
    expect(iso(j.de)).toBe("2026-04-28");
    expect(iso(j.ate)).toBe("2026-04-29");
  });

  it("janela de 1 dia em sexta", () => {
    // sex 08/05 → D+0 em 01/05
    const j = getJanelaDiasUteis(utc("2026-05-08"), 7)!;
    expect(iso(j.de)).toBe("2026-05-01");
    expect(iso(j.ate)).toBe("2026-05-02");
  });

  it("janela de 3 dias em segunda (cobre sábado e domingo anteriores)", () => {
    // seg 11/05 → cobre D+0 em 02/05 (sáb), 03/05 (dom), 04/05 (seg)
    const j = getJanelaDiasUteis(utc("2026-05-11"), 7)!;
    expect(iso(j.de)).toBe("2026-05-02");
    expect(iso(j.ate)).toBe("2026-05-05");
  });
});

describe("getJanelaDiasUteis (d+21)", () => {
  it("janela de 3 dias em segunda também para offset 21", () => {
    // seg 11/05 → D+0 em 18/04 (sáb), 19/04 (dom), 20/04 (seg)
    const j = getJanelaDiasUteis(utc("2026-05-11"), 21)!;
    expect(iso(j.de)).toBe("2026-04-18");
    expect(iso(j.ate)).toBe("2026-04-21");
  });
  it("janela de 1 dia em quarta para offset 21", () => {
    // qua 06/05 → D+0 em 15/04
    const j = getJanelaDiasUteis(utc("2026-05-06"), 21)!;
    expect(iso(j.de)).toBe("2026-04-15");
    expect(iso(j.ate)).toBe("2026-04-16");
  });
});