import { describe, it, expect } from "vitest";
import { isApenasFotos, filtrarFormulariosVisiveis } from "./formularios-filtro";

describe("isApenasFotos", () => {
  it("filtra registros com origem=avaliacao_manual independente do payload", () => {
    expect(isApenasFotos({ origem: "avaliacao_manual", dados_resposta: null })).toBe(true);
    expect(isApenasFotos({ origem: "avaliacao_manual", dados_resposta: { fotos: {} } })).toBe(true);
    expect(
      isApenasFotos({ origem: "avaliacao_manual", dados_resposta: { fotos: {}, outro: "x" } }),
    ).toBe(true);
  });

  it("filtra registros cujo payload contém somente a chave 'fotos'", () => {
    expect(isApenasFotos({ origem: "publico", dados_resposta: { fotos: { frente: "url" } } })).toBe(true);
    expect(isApenasFotos({ origem: "token", dados_resposta: { fotos: {} } })).toBe(true);
  });

  it("NÃO filtra anamnese/feedback completos que incluem 'fotos' + outros campos", () => {
    expect(
      isApenasFotos({
        origem: "publico",
        dados_resposta: { fotos: { frente: "url" }, objetivo: "ganhar massa", saude: {} },
      }),
    ).toBe(false);
    expect(
      isApenasFotos({
        origem: "token",
        dados_resposta: { peso_atual: 70, sono: "bom" },
      }),
    ).toBe(false);
  });

  it("não filtra registros sem dados_resposta vindos de origens normais", () => {
    expect(isApenasFotos({ origem: "token", dados_resposta: null })).toBe(false);
    expect(isApenasFotos({ origem: "publico", dados_resposta: undefined })).toBe(false);
    expect(isApenasFotos({ origem: "manual" })).toBe(false);
  });

  it("trata payloads malformados (array, primitivo) como não-foto", () => {
    expect(isApenasFotos({ origem: "token", dados_resposta: [] as unknown })).toBe(false);
    expect(isApenasFotos({ origem: "token", dados_resposta: "string" as unknown })).toBe(false);
    expect(isApenasFotos({ origem: "token", dados_resposta: 42 as unknown })).toBe(false);
  });

  it("trata objeto vazio como não-foto (sem chaves para inspecionar)", () => {
    expect(isApenasFotos({ origem: "token", dados_resposta: {} })).toBe(false);
  });

  it("aceita null/undefined com segurança", () => {
    expect(isApenasFotos(null)).toBe(false);
    expect(isApenasFotos(undefined)).toBe(false);
  });
});

describe("filtrarFormulariosVisiveis", () => {
  it("remove apenas-fotos preservando ordem e demais registros", () => {
    const input = [
      { id: "1", origem: "token", dados_resposta: { peso_atual: 70 } },
      { id: "2", origem: "avaliacao_manual", dados_resposta: { fotos: {} } },
      { id: "3", origem: "publico", dados_resposta: { fotos: { frente: "u" } } },
      { id: "4", origem: "publico", dados_resposta: { fotos: {}, objetivo: "x" } },
    ];
    const out = filtrarFormulariosVisiveis(input);
    expect(out.map((f) => f.id)).toEqual(["1", "4"]);
  });
});