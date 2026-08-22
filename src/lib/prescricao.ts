import type { Prescricao } from "@/lib/dieta-pdf/gerar";

/** Marker prefix used to embed prescription JSON into dieta_planos.observacoes. */
const MARKER = "__PRESCRICAO_JSON__:";

export type PrescricaoCompleta = Prescricao & {
  titulo?: string;
  data?: string; // ISO yyyy-mm-dd
};

/** Extract prescription data + free-text observacoes from the stored field. */
export function parseObservacoesField(
  raw: string | null | undefined,
): { prescricao: PrescricaoCompleta | null; observacoesLivres: string } {
  if (!raw) return { prescricao: null, observacoesLivres: "" };
  const idx = raw.indexOf(MARKER);
  if (idx < 0) return { prescricao: null, observacoesLivres: raw };
  const before = raw.slice(0, idx).trimEnd();
  const jsonStart = idx + MARKER.length;
  const newlineEnd = raw.indexOf("\n", jsonStart);
  const jsonStr = newlineEnd >= 0 ? raw.slice(jsonStart, newlineEnd) : raw.slice(jsonStart);
  const after = newlineEnd >= 0 ? raw.slice(newlineEnd + 1) : "";
  let prescricao: PrescricaoCompleta | null = null;
  try {
    prescricao = JSON.parse(jsonStr) as PrescricaoCompleta;
  } catch {
    prescricao = null;
  }
  return {
    prescricao,
    observacoesLivres: [before, after].filter(Boolean).join("\n").trim(),
  };
}

/** Re-encode the field combining free-text observacoes + prescription JSON. */
export function serializeObservacoesField(
  observacoesLivres: string,
  prescricao: PrescricaoCompleta | null,
): string | null {
  const obs = (observacoesLivres ?? "").trim();
  if (!prescricao || !hasContent(prescricao)) {
    return obs || null;
  }
  const json = JSON.stringify(prescricao);
  return [obs, `${MARKER}${json}`].filter(Boolean).join("\n");
}

export function hasContent(p: PrescricaoCompleta | null): boolean {
  if (!p) return false;
  return Boolean(
    (p.titulo && p.titulo.trim()) ||
    (p.descricao && p.descricao.trim()) ||
    (p.posologia && p.posologia.trim()) ||
    (p.suplementos && p.suplementos.some((s) => s.trim())) ||
    (p.fitoterapicos && p.fitoterapicos.some((s) => s.trim())) ||
    (p.observacoes && p.observacoes.trim()),
  );
}

export function emptyPrescricao(): PrescricaoCompleta {
  return {
    titulo: "",
    data: new Date().toISOString().slice(0, 10),
    descricao: "",
    posologia: "",
    suplementos: [],
    fitoterapicos: [],
    observacoes: "",
  };
}