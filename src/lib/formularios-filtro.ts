/**
 * Regras para filtrar registros de `formularios` que NÃO devem aparecer
 * na lista de formulários do perfil do aluno.
 *
 * Um registro é considerado "apenas fotos" (e portanto deve ficar somente
 * na aba de Fotos) quando:
 *   - origem === "avaliacao_manual"  (upload de fotos avulsas), OU
 *   - dados_resposta é um objeto cujo único conjunto de chaves é {"fotos"}
 *
 * Anamneses/feedbacks que contêm `fotos` JUNTO de outros campos textuais
 * NÃO são filtrados — eles devem aparecer normalmente, com a galeria
 * renderizada ao final da resposta.
 */
export type FormularioLike = {
  origem?: string | null;
  dados_resposta?: unknown;
};

export function isApenasFotos(f: FormularioLike | null | undefined): boolean {
  if (!f) return false;
  if (f.origem === "avaliacao_manual") return true;
  const d = f.dados_resposta;
  if (!d || typeof d !== "object" || Array.isArray(d)) return false;
  const keys = Object.keys(d as Record<string, unknown>);
  return keys.length > 0 && keys.every((k) => k === "fotos");
}

export function filtrarFormulariosVisiveis<T extends FormularioLike>(forms: T[]): T[] {
  return forms.filter((f) => !isApenasFotos(f));
}