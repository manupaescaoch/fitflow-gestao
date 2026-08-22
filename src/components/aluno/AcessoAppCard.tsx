import { useEffect, useState } from "react";
import { KeyRound, Copy, Check, Loader2, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  criarAcessoAluno,
  getStatusAcessoAluno,
} from "@/server/aluno-auth.functions";

export function AcessoAppCard({ alunoId }: { alunoId: string }) {
  const [hasAcesso, setHasAcesso] = useState<boolean | null>(null);
  const [ultimoLogin, setUltimoLogin] = useState<string | null>(null);
  const [deveTrocar, setDeveTrocar] = useState<boolean>(false);
  const [busy, setBusy] = useState(false);
  const [senha, setSenha] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const criar = useServerFn(criarAcessoAluno);
  const status = useServerFn(getStatusAcessoAluno);

  async function reload() {
    try {
      const r = await status({ data: { aluno_id: alunoId } });
      if (r.ok) {
        setHasAcesso(r.has_acesso);
        setUltimoLogin(r.ultimo_login_em);
        setDeveTrocar(r.deve_trocar_senha);
      } else {
        setHasAcesso(false);
      }
    } catch {
      setHasAcesso(false);
    }
  }
  useEffect(() => {
    void reload();
  }, [alunoId]);

  async function gerar() {
    setBusy(true);
    setErro(null);
    setSenha(null);
    try {
      const r = await criar({ data: { aluno_id: alunoId } });
      if (!r.ok) {
        setErro(r.error);
      } else {
        setSenha(r.senha_inicial);
        await reload();
      }
    } catch (e: any) {
      setErro(e?.message || "Falha ao gerar acesso");
    } finally {
      setBusy(false);
    }
  }

  function copiar() {
    if (!senha) return;
    navigator.clipboard.writeText(senha).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">Acesso ao app do aluno</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {hasAcesso === null
                ? "Verificando..."
                : hasAcesso
                  ? `Liberado · ${
                      ultimoLogin
                        ? `último login em ${new Date(ultimoLogin).toLocaleDateString("pt-BR")}`
                        : "ainda não acessou"
                    }${deveTrocar ? " · senha temporária" : ""}`
                  : "Aluno ainda não tem acesso ao app"}
            </div>
          </div>
        </div>
        <button
          onClick={gerar}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : hasAcesso ? (
            <RefreshCw className="h-3.5 w-3.5" />
          ) : (
            <KeyRound className="h-3.5 w-3.5" />
          )}
          {hasAcesso ? "Resetar senha" : "Criar acesso"}
        </button>
      </div>

      {senha && (
        <div className="mt-3 rounded-xl bg-primary/5 border border-primary/20 p-3">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-primary/80">
            Senha inicial
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <code className="text-sm font-mono font-bold tracking-wider">{senha}</code>
            <button
              onClick={copiar}
              className="inline-flex items-center gap-1 rounded-md bg-white border border-primary/30 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10 transition"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            O aluno usa o WhatsApp como login e essa senha. Será obrigado a trocar no primeiro acesso.
          </p>
        </div>
      )}
      {erro && (
        <div className="mt-3 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
          {erro}
        </div>
      )}
    </div>
  );
}