import { useEffect, useState } from "react";

export interface AlunoSession {
  id: string;
  nome: string;
  email: string | null;
  whatsapp?: string | null;
  avatarUrl?: string | null;
  deveTrocarSenha?: boolean;
}

const KEY = "mpteam_aluno_session";

export function getAlunoSession(): AlunoSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AlunoSession) : null;
  } catch {
    return null;
  }
}

export function setAlunoSession(s: AlunoSession) {
  window.localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("aluno-session-change"));
}

export function clearAlunoSession() {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("aluno-session-change"));
}

export function useAlunoSession() {
  const [session, setSession] = useState<AlunoSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setSession(getAlunoSession());
    setHydrated(true);
    const handler = () => setSession(getAlunoSession());
    window.addEventListener("aluno-session-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("aluno-session-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return { session, hydrated };
}