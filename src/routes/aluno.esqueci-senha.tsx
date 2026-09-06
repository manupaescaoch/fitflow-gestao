import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, KeyRound, Send } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { solicitarResetSenhaAluno } from "@/server/aluno-auth.functions";

export const Route = createFileRoute("/aluno/esqueci-senha")({
  head: () => ({ meta: [{ title: "Recuperar senha — MPTEAM" }] }),
  component: EsqueciSenhaPage,
});

function EsqueciSenhaPage() {
  const nav = useNavigate();
  const reset = useServerFn(solicitarResetSenhaAluno);
  const [identificador, setIdentificador] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identificador.trim() || busy) return;
    setBusy(true);
    try {
      await reset({ data: { identificador: identificador.trim() } });
    } catch {
      /* sempre mostra sucesso genérico */
    }
    setDone(true);
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center px-6 pt-10 pb-10">
      <div className="w-full max-w-sm">
        <button
          onClick={() => nav({ to: "/login" })}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-black/55 hover:text-black mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o login
        </button>

        <div className="flex flex-col items-center">
          <img
            src={mpTeamLogo}
            alt="MPTEAM"
            className="h-24 w-24 object-contain select-none"
            draggable={false}
          />
          <div className="mt-4 h-12 w-12 rounded-2xl bg-[#F70906]/10 flex items-center justify-center">
            <KeyRound className="h-6 w-6 text-[#F70906]" />
          </div>
          <h1 className="mt-4 text-[28px] leading-none font-extrabold tracking-tight text-black">
            Recuperar senha
          </h1>
          <p className="mt-3 text-[14px] text-black/55 text-center max-w-[280px]">
            Informe seu <strong>e-mail</strong> ou <strong>WhatsApp</strong> cadastrado.
            A nova senha temporária será enviada no seu WhatsApp.
          </p>
        </div>

        {done ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-2xl bg-emerald-50 border border-emerald-200 p-5 text-center"
          >
            <div className="text-[15px] font-bold text-emerald-800">
              Pedido recebido!
            </div>
            <p className="mt-2 text-[13px] text-emerald-700 leading-relaxed">
              Se o cadastro existir, em instantes você vai receber a senha
              temporária no seu WhatsApp. Use ela para entrar — o app vai
              te pedir pra criar uma nova senha em seguida.
            </p>
            <button
              onClick={() => nav({ to: "/login" })}
              className="mt-5 w-full h-12 rounded-xl bg-[#F70906] text-white font-bold text-[14px] hover:bg-[#F70906]/90 transition"
            >
              Ir para o login
            </button>
          </motion.div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <input
              type="text"
              autoFocus
              autoComplete="username"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              required
              placeholder="E-mail ou WhatsApp"
              className="w-full h-[60px] rounded-2xl bg-white border-0 px-5 text-[16px] placeholder:text-black/40 text-black shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] focus:outline-none focus:ring-2 focus:ring-[#F70906]/30 transition"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full h-[60px] rounded-2xl bg-[#F70906] text-white text-[17px] font-bold flex items-center justify-center gap-2 shadow-[0_18px_40px_-12px_rgba(247,9,6,0.55)] hover:bg-[#F70906]/95 active:scale-[0.99] disabled:opacity-50 transition-all"
            >
              {busy ? (
                "Enviando..."
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Enviar nova senha
                </>
              )}
            </button>

            <p className="text-[12px] text-black/45 text-center pt-2">
              Não recebeu? Verifique se o número cadastrado está atualizado
              ou{" "}
              <Link
                to="/login"
                className="font-semibold text-[#F70906] hover:underline"
              >
                fale com a equipe
              </Link>
              .
            </p>
          </form>
        )}
      </div>
    </div>
  );
}