import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { setAlunoSession, getAlunoSession } from "@/lib/aluno-session";
import { useServerFn } from "@tanstack/react-start";
import { loginAlunoPorEmail } from "@/server/aluno-auth.functions";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — MPTEAM" },
      { name: "description", content: "Acesse sua conta MPTEAM. Login único para equipe e alunos da consultoria fitness e nutricional." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { signIn, session, loading } = useAuth();
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loginAlunoFn = useServerFn(loginAlunoPorEmail);

  useEffect(() => {
    if (!loading && session) {
      if (next) { window.location.href = next; return; }
      nav({ to: "/visao-geral" });
    }
    else if (!loading && getAlunoSession()) nav({ to: "/aluno" });
  }, [loading, session, nav, next]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    const equipe = await signIn(email.trim(), password);
    if (!equipe.error) {
      setBusy(false);
      if (next) { window.location.href = next; return; }
      nav({ to: "/visao-geral" });
      return;
    }

    try {
      const res = await loginAlunoFn({ data: { identificador: email.trim(), senha: password } });
      if (res.ok) {
        setAlunoSession({
          id: res.aluno.id,
          nome: res.aluno.nome,
          email: res.aluno.email,
          whatsapp: res.aluno.whatsapp,
          avatarUrl: (res.aluno as any).foto_url ?? null,
          deveTrocarSenha: res.deve_trocar_senha,
        });
        setBusy(false);
        nav({ to: res.deve_trocar_senha ? "/aluno/trocar-senha" : "/aluno" });
        return;
      }
    } catch {
      /* ignora */
    }

    setBusy(false);
    setErr("Credenciais inválidas");
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center px-6 pt-16 pb-10">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Título */}
        <h1 className="text-[42px] leading-none font-extrabold tracking-tight text-black">
          Bem-vindo
        </h1>
        <p className="mt-3 text-[15px] text-black/55 text-center">
          Seu <span className="text-[#F70906] font-semibold">shape</span> entrega o que sua rotina esconde.
        </p>

        {/* Formulário */}
        <form onSubmit={onSubmit} className="w-full mt-10 space-y-4">
          <div className="relative">
            <Mail className="h-5 w-5 text-[#F70906] absolute left-5 top-1/2 -translate-y-1/2" strokeWidth={2.2} />
            <input
              type="text"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              placeholder="E-mail ou WhatsApp"
              className="w-full h-[60px] rounded-2xl bg-white border-0 pl-14 pr-5 text-[16px] placeholder:text-black/40 text-black shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] focus:outline-none focus:ring-2 focus:ring-[#F70906]/30 transition"
            />
          </div>

          <div className="relative">
            <Lock className="h-5 w-5 text-[#F70906] absolute left-5 top-1/2 -translate-y-1/2" strokeWidth={2.2} />
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              autoComplete="current-password"
              placeholder="Senha"
              className="w-full h-[60px] rounded-2xl bg-white border-0 pl-14 pr-14 text-[16px] placeholder:text-black/40 text-black shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] focus:outline-none focus:ring-2 focus:ring-[#F70906]/30 transition"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70 transition"
              aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <div className="flex justify-end pt-1">
            <Link
              to="/aluno/esqueci-senha"
              className="text-[14px] font-semibold text-[#F70906] hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>

          {err && (
            <div className="text-[13px] text-[#F70906] bg-[#F70906]/5 border border-[#F70906]/20 rounded-xl px-4 py-3">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full h-[60px] mt-2 rounded-2xl bg-[#F70906] text-white text-[17px] font-bold shadow-[0_18px_40px_-12px_rgba(247,9,6,0.55)] hover:bg-[#F70906]/95 active:scale-[0.99] disabled:opacity-50 transition-all"
          >
            {busy ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
