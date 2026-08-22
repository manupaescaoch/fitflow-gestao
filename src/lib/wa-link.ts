/** Helpers para abrir conversa manual no WhatsApp (wa.me). */
export function digits(s: string | null | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

export function waMeUrl(phone: string | null | undefined, mensagem?: string): string | null {
  const d = digits(phone);
  if (!d || d.length < 8) return null;
  const base = `https://wa.me/${d}`;
  if (!mensagem) return base;
  return `${base}?text=${encodeURIComponent(mensagem)}`;
}