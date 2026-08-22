/**
 * Chave pública VAPID — pode ser exposta ao cliente.
 * A chave privada correspondente fica como secret no servidor (`VAPID_PRIVATE_KEY`)
 * e só é usada quando enviarmos pushes.
 */
export const VAPID_PUBLIC_KEY =
  "BKL4H3srbsTREplSinxWEqoImHZSSqnbCstZ7vqRzwMmRjzVFjUn2jvTS3kkiH13gNGUDj1pIwtUsf6Fq2JqEeU";

/** Converte a chave pública base64url em Uint8Array para PushManager.subscribe. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}