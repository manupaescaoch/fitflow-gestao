// Cache simples em sessionStorage para "stale-while-revalidate".
// Mostra dados antigos imediatamente e revalida em background.

const PREFIX = "swr:";

export function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // quota / serialization — ignora
  }
}

export function clearCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PREFIX + key);
  } catch {}
}