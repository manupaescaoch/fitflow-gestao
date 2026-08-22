/** Contatos públicos da equipe MPTEAM. Usado em links wa.me e similares. */
export const WHATSAPP_SUPORTE_E164 = "5581995411196";

export function whatsappSuporteUrl(mensagem?: string) {
  const base = `https://wa.me/${WHATSAPP_SUPORTE_E164}`;
  if (!mensagem) return base;
  return `${base}?text=${encodeURIComponent(mensagem)}`;
}