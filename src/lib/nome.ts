/**
 * Retorna apenas o primeiro nome do aluno.
 * Usado em todas as mensagens enviadas (WhatsApp, IA, templates).
 * Para exibições administrativas (telas, PDFs, listas) continue usando o nome completo.
 */
export function primeiroNome(nome?: string | null): string {
  return (nome || "").trim().split(/\s+/)[0] || "";
}
