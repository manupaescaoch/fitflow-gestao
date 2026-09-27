import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  iniciarFormularioPublico,
  checarFormularioPendente,
  iniciarFormularioPorTelefone,
  confirmarCodigoFormulario,
} from "@/server/formulario-publico-flow.functions";
import { AnamneseFlow } from "@/components/anamnese/AnamneseFlow";
import { FeedbackQuinzenalFlow } from "@/components/feedback/FeedbackQuinzenalFlow";
import { FeedbackMensalFlow } from "@/components/feedback/FeedbackMensalFlow";
import { PhoneDdiInput } from "@/components/publico/PhoneDdiInput";

type Tipo = "anamnese" | "feedback_quinzenal" | "feedback_mensal";

interface Props {
  tipo: Tipo;
}

interface Sessao {
  formId: string;
  token: string;
  alunoNome?: string | null;
  alunoId?: string | null;
  telefone?: string;
}

function storageKey(tipo: Tipo) {
  return `publico_form:${tipo}`;
}

const RED = "var(--primary)";
const INK = "#0a0a0a";
const BORDER = "#e5e5e5";
const MUTED = "#737373";

export function PublicFormularioPublico({ tipo }: Props) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const iniciarFn = useServerFn(iniciarFormularioPublico);
  const checarFn = useServerFn(checarFormularioPendente);
  const iniciarPorTelFn = useServerFn(iniciarFormularioPorTelefone);
  const confirmarFn = useServerFn(confirmarCodigoFormulario);

  const ehFeedback = tipo === "feedback_mensal" || tipo === "feedback_quinzenal";

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        // Tenta recuperar sessão local
        const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey(tipo)) : null;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Sessao;
            if (parsed?.formId && parsed?.token) {
              const r = await checarFn({ data: { formId: parsed.formId, token: parsed.token } });
              if (r.ok && !r.respondido) {
                if (!cancelado) setSessao(parsed);
                return;
              }
              // Se já respondido ou inexistente, descarta e cria nova
              localStorage.removeItem(storageKey(tipo));
            }
          } catch {
            localStorage.removeItem(storageKey(tipo));
          }
        }

        // Feedbacks: identificação por telefone (não cria nada antes).
        if (ehFeedback) {
          if (!cancelado) setBootstrapping(false);
          return;
        }

        // Anamnese: fluxo anônimo (aluno ainda não existe).
        const novoToken = (typeof crypto !== "undefined" && "randomUUID" in crypto)
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const r = await iniciarFn({ data: { tipo, token: novoToken } });
        if (!r.ok) {
          if (!cancelado) setErro("Não foi possível iniciar o formulário. Tente novamente em instantes.");
          return;
        }
        const nova: Sessao = { formId: r.id, token: novoToken };
        try { localStorage.setItem(storageKey(tipo), JSON.stringify(nova)); } catch {}
        if (!cancelado) setSessao(nova);
      } catch {
        if (!cancelado) setErro("Erro inesperado ao iniciar o formulário.");
      } finally {
        if (!cancelado) setBootstrapping(false);
      }
    })();
    return () => { cancelado = true; };
  }, [tipo, ehFeedback]);

  async function handleSubmitted() {
    try { localStorage.removeItem(storageKey(tipo)); } catch {}
  }

  async function handleIdentificar(telefone: string): Promise<string | null> {
    const r = await iniciarPorTelFn({ data: { tipo: tipo as "feedback_mensal" | "feedback_quinzenal", telefone } });
    if (!r.ok) return r.error || "Não foi possível iniciar o formulário.";
    setChallengeId(r.challengeId);
    return null;
  }

  async function handleConfirmar(codigo: string): Promise<string | null> {
    if (!challengeId) return "Solicite um novo código.";
    const r = await confirmarFn({ data: { challengeId, codigo } });
    if (!r.ok) return r.error || "Código inválido.";
    const nova: Sessao = {
      formId: r.id,
      token: r.token,
      alunoNome: r.alunoNome ?? null,
      alunoId: (r as any).alunoId ?? null,
    };
    try { localStorage.setItem(storageKey(tipo), JSON.stringify(nova)); } catch {}
    setSessao(nova);
    return null;
  }

  if (erro) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#f7f7f7]">
        <div className="max-w-md text-center bg-white border border-[#e5e5e5] rounded-lg p-8">
          <p className="text-sm text-[#0a0a0a]">{erro}</p>
        </div>
      </div>
    );
  }

  if (bootstrapping && !sessao) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#f7f7f7]">
        <div className="text-sm text-[#737373]">Carregando…</div>
      </div>
    );
  }

  // Feedbacks sem sessão: pedir telefone para identificar o aluno.
  if (!sessao && ehFeedback) {
    return challengeId
      ? <ConfirmacaoCodigo onConfirmar={handleConfirmar} />
      : <IdentificacaoTelefone tipo={tipo} onIdentificar={handleIdentificar} />;
  }

  if (!sessao) return null;

  if (tipo === "anamnese") {
    return <AnamneseFlow formId={sessao.formId} alunoId={null} token={sessao.token} onSubmitted={handleSubmitted} />;
  }
  if (tipo === "feedback_quinzenal") {
    return <FeedbackQuinzenalFlow formId={sessao.formId} alunoId={sessao.alunoId ?? null} token={sessao.token} onSubmitted={handleSubmitted} />;
  }
  return <FeedbackMensalFlow formId={sessao.formId} alunoId={sessao.alunoId ?? null} token={sessao.token} onSubmitted={handleSubmitted} />;
}

function ConfirmacaoCodigo({ onConfirmar }: {
  onConfirmar: (codigo: string) => Promise<string | null>;
}) {
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return <div className="min-h-screen flex items-center justify-center px-4 bg-[#f7f7f7]">
    <form className="w-full max-w-md bg-white rounded-lg p-8 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        setErro(await onConfirmar(codigo)); setBusy(false);
      }}>
      <h1 className="text-xl font-bold">Confirme seu WhatsApp</h1>
      <p className="text-sm">Digite o código de 6 dígitos enviado ao número cadastrado.</p>
      <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required
        value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
        className="w-full border rounded-md p-3" aria-label="Código de confirmação" />
      {erro && <p role="alert" className="text-sm text-red-600">{erro}</p>}
      <button disabled={busy || codigo.length !== 6} className="w-full py-3 rounded-md text-white font-semibold disabled:opacity-60"
        style={{ backgroundColor: RED }}>{busy ? "Verificando..." : "Confirmar"}</button>
    </form>
  </div>;
}

function IdentificacaoTelefone({
  tipo,
  onIdentificar,
}: {
  tipo: "feedback_mensal" | "feedback_quinzenal";
  onIdentificar: (telefone: string) => Promise<string | null>;
}) {
  const [telefone, setTelefone] = useState("");
  const [ddi, setDdi] = useState("55");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const titulo = useMemo(
    () => (tipo === "feedback_mensal" ? "Feedback mensal" : "Feedback quinzenal"),
    [tipo],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErro(null);
    const digitos = telefone.replace(/\D/g, "");
    if (digitos.length < 10) {
      setErro("Confira o número: informe DDD + WhatsApp (ex: 81 91234-5678).");
      return;
    }
    setBusy(true);
    const err = await onIdentificar(digitos);
    if (err) {
      setErro(err);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f7f7f7]">
      <div className="w-full max-w-md bg-white rounded-lg p-6 md:p-8" style={{ border: `1px solid ${BORDER}` }}>
        <div className="text-center mb-6">
          <div className="text-2xl font-black tracking-tight" style={{ color: RED }}>MPTEAM</div>
          <div className="text-[10px] font-semibold tracking-[0.4em]" style={{ color: MUTED }}>CRM</div>
        </div>
        <h1 className="text-xl md:text-2xl font-bold mb-2" style={{ color: INK }}>{titulo}</h1>
        <p className="text-sm mb-5" style={{ color: MUTED }}>
          Confirme seu WhatsApp pra continuar de onde parou (ou abrir um novo formulário).
        </p>
        <form onSubmit={submit} className="space-y-4">
          <PhoneDdiInput
            value={telefone}
            ddi={ddi}
            onDdiChange={setDdi}
            onChange={setTelefone}
            numeroLabel="Seu WhatsApp"
            error={erro || undefined}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 rounded-md text-white font-semibold text-base transition disabled:opacity-60"
            style={{ backgroundColor: RED }}
          >
            {busy ? "Carregando..." : "Continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
