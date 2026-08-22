import { createMiddleware } from "@tanstack/react-start";
import { getAlunoSessionServer } from "./aluno-session.server";
export type { AlunoSessionData } from "./aluno-session.server";

/** Middleware obrigatório: garante aluno autenticado. */
export const requireAlunoAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const session = await getAlunoSessionServer();
    const alunoId = session.data?.aluno_id;
    if (!alunoId) {
      throw new Response("Unauthorized: sessão de aluno inválida", { status: 401 });
    }
    // Se está pendente troca de senha no 1º acesso, bloqueia qualquer
    // operação até que a senha seja redefinida. As únicas exceções são as
    // server fns que usam `requireAlunoAuthAllowPending` (trocar senha,
    // logout, getAlunoMe).
    if (session.data?.deve_trocar_senha) {
      throw new Response(
        "Troca de senha obrigatória antes de continuar",
        { status: 403 },
      );
    }
    return next({ context: { alunoId, alunoSession: session.data } });
  },
);

/** Middleware: aluno autenticado, mas permite chamadas com `deve_trocar_senha`.
 *  Use APENAS em fluxos de troca de senha, logout e leitura de sessão. */
export const requireAlunoAuthAllowPending = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  const session = await getAlunoSessionServer();
  const alunoId = session.data?.aluno_id;
  if (!alunoId) {
    throw new Response("Unauthorized: sessão de aluno inválida", { status: 401 });
  }
  return next({ context: { alunoId, alunoSession: session.data } });
});

/** Middleware opcional: injeta alunoId|null sem lançar. */
export const optionalAlunoAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    try {
      const session = await getAlunoSessionServer();
      return next({ context: { alunoId: session.data?.aluno_id ?? null } });
    } catch {
      return next({ context: { alunoId: null as string | null } });
    }
  },
);