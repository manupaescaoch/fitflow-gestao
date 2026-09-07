import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, ArrowRight, ShieldCheck, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAlunoSession, setAlunoSession } from "@/lib/aluno-session";
import { useServerFn } from "@tanstack/react-start";
import { trocarSenhaAluno } from "@/server/aluno-auth.functions";

export const Route = createFileRoute("/aluno/trocar-senha")({
  head: () => ({ meta: [{ title: "Trocar senha — MPTEAM" }] }),
  component: TrocarSenhaPage,
});

function TrocarSenhaPage() {
  const { session, hydrated } = useAlunoSession();
  const nav = useNavigate();
  const trocar = useServerFn(trocarSenhaAluno);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (hydrated && !session) nav({ to: "/login" });
  }, [hydrated, session, nav]);

  if (!hydrated || !session) {
    return (
      <div className="min-h-[100dvh] bg-[#FAFAFA] flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!atual.trim()) next.atual = "Informe sua senha atual.";
    if (!nova) next.nova = "Informe a nova senha.";
    else if (nova.length < 6) next.nova = "A nova senha precisa ter ao menos 6 caracteres.";
    else if (!/[A-Za-z]/.test(nova) || !/\d/.test(nova))
      next.nova = "Use letras e números para uma senha mais forte.";
    if (!confirma) next.confirma = "Confirme a nova senha.";
    else if (nova && nova !== confirma) next.confirma = "As senhas não coincidem.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    try {
      const r = await trocar({
        data: { senha_atual: atual, nova_senha: nova },
      });
      if (!r.ok) {
        const msg = r.error || "Não foi possível trocar a senha.";
        const lower = msg.toLowerCase();
        if (lower.includes("atual")) setErrors({ atual: msg });
        else if (lower.includes("nova") || lower.includes("senha")) setErrors({ nova: msg });
        else setErrors({ form: msg });
        setBusy(false);
        return;
      }
      setAlunoSession({ ...session!, deveTrocarSenha: false });
      window.location.replace("/aluno");
    } catch (e: any) {
      setErrors({ form: e?.message || "Falha ao trocar senha." });
      setBusy(false);
    }
  }

  const fields = [
    { key: "atual", lbl: "Senha atual", v: atual, set: setAtual, ph: "WhatsApp (no 1º acesso)" },
    { key: "nova", lbl: "Nova senha", v: nova, set: setNova, ph: "Mínimo 6 caracteres" },
    { key: "confirma", lbl: "Confirmar nova", v: confirma, set: setConfirma, ph: "Repita a nova senha" },
  ];

  return (
    <div className="px-5 py-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm mx-auto"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Crie sua nova senha</h1>
          <p className="text-sm text-black/60 mt-1 text-center">
            Por segurança, defina uma senha pessoal para acessar o app.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-3xl bg-white border border-black/5 p-6 space-y-4 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.1)]"
        >
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-black/60 mb-2">
                {f.lbl}
              </label>
              <div className="relative">
                <Lock className="h-[18px] w-[18px] text-black/30 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type={show[f.key] ? "text" : "password"}
                  value={f.v}
                  onChange={(e) => {
                    f.set(e.target.value);
                    if (errors[f.key]) {
                      setErrors((prev) => {
                        const { [f.key]: _, ...rest } = prev;
                        return rest;
                      });
                    }
                  }}
                  placeholder={f.ph}
                  aria-invalid={!!errors[f.key]}
                  className={`w-full h-12 rounded-xl bg-black/[0.03] border pl-11 pr-12 text-sm focus:outline-none focus:ring-2 transition ${
                    errors[f.key]
                      ? "border-primary/60 ring-2 ring-primary/20"
                      : "border-black/10 focus:border-primary/60 focus:ring-primary/20"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => ({ ...s, [f.key]: !s[f.key] }))}
                  aria-label={show[f.key] ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-black/40 hover:text-black/70 transition"
                >
                  {show[f.key] ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
              {errors[f.key] && (
                <p className="mt-1.5 text-[11px] text-primary flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors[f.key]}
                </p>
              )}
            </div>
          ))}

          {errors.form && (
            <div className="text-xs text-primary bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">
              {errors.form}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="group w-full h-12 mt-2 rounded-xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {busy ? "Salvando..." : "Salvar nova senha"}
            {!busy && (
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
