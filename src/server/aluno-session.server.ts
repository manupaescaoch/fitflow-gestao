import { useSession } from "@tanstack/react-start/server";

export type AlunoSessionData = {
  aluno_id?: string;
  nome?: string;
  email?: string | null;
  whatsapp?: string | null;
  foto_url?: string | null;
  deve_trocar_senha?: boolean;
  iat?: number;
};

export function alunoSessionConfig() {
  const password =
    process.env.ALUNO_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_JWKS;
  if (!password || password.length < 32) {
    throw new Error(
      "Sessão do aluno indisponível: defina ALUNO_SESSION_SECRET (ou garanta SUPABASE_SERVICE_ROLE_KEY/SUPABASE_JWKS) com pelo menos 32 caracteres.",
    );
  }
  return {
    password,
    name: "mpteam_aluno_sess",
    cookie: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: true,
      path: "/",
    },
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function getAlunoSessionServer() {
  return useSession<AlunoSessionData>(alunoSessionConfig());
}