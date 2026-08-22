import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Perfil = "admin" | "equipe" | "consultor" | "visualizador";

export interface CrmUser {
  id: string;
  nome: string | null;
  email: string | null;
  perfil: Perfil;
  ativo: boolean;
}

interface AuthCtx {
  loading: boolean;
  session: Session | null;
  user: User | null;
  crmUser: CrmUser | null;
  isAdmin: boolean;
  isEquipe: boolean;
  isConsultor: boolean;
  canEdit: boolean;
  canEditAluno: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [crmUser, setCrmUser] = useState<CrmUser | null>(null);

  const loadCrmUser = async (uid: string | undefined) => {
    if (!uid) { setCrmUser(null); return; }
    const { data } = await supabase.from("usuarios_crm").select("*").eq("id", uid).maybeSingle();
    setCrmUser((data as CrmUser) ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setTimeout(() => { void loadCrmUser(s?.user?.id); }, 0);
    });
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      await loadCrmUser(data.session?.user?.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Inject Authorization: Bearer <token> on every server-fn request
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __serverFnFetchPatched?: boolean };
    if (w.__serverFnFetchPatched) return;
    w.__serverFnFetchPatched = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
        if (url.includes("/_serverFn/")) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) {
            const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
            if (!headers.has("authorization")) {
              headers.set("authorization", `Bearer ${token}`);
            }
            return originalFetch(input, { ...init, headers });
          }
        }
      } catch {
        // fall through to original fetch
      }
      return originalFetch(input, init);
    };
  }, []);

  const value: AuthCtx = {
    loading, session, user, crmUser,
    isAdmin: crmUser?.perfil === "admin",
    isEquipe: crmUser?.perfil === "equipe",
    isConsultor: crmUser?.perfil === "consultor",
    canEdit: crmUser?.perfil === "admin" || crmUser?.perfil === "equipe",
    canEditAluno:
      crmUser?.perfil === "admin" ||
      crmUser?.perfil === "equipe" ||
      crmUser?.perfil === "consultor",
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    signUp: async (email, password, nome) => {
      const redirectUrl = `${window.location.origin}/visao-geral`;
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: redirectUrl, data: { nome } },
      });
      return { error: error?.message ?? null };
    },
    signOut: async () => { await supabase.auth.signOut(); },
    refresh: async () => { await loadCrmUser(user?.id); },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}