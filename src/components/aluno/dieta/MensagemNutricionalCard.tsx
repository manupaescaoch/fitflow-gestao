import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { gerarMensagemNutricao } from "@/server/dieta.functions";
import { useAuth } from "@/lib/auth";
import { fmtDateTime } from "@/lib/crm";
import { Copy, Loader2, Sparkles, X, MessageCircle } from "lucide-react";

type Registro = {
  id: string;
  ajustes_realizados: string;
  dificuldades: string | null;
  medidas_otimizacao: string;
  mensagem_gerada: string | null;
  criado_por: string | null;
  criado_em: string;
};

export function MensagemNutricionalCard({ alunoId, nomeAluno, whatsapp }: { alunoId: string; nomeAluno: string; whatsapp?: string | null }) {
  const { crmUser, canEdit } = useAuth();
  const gerar = useServerFn(gerarMensagemNutricao);

  const [resumo, setResumo] = useState("");
  const [errResumo, setErrResumo] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [openModal, setOpenModal] = useState<Registro | null>(null);

  useEffect(() => { void load(); }, [alunoId]);
  async function load() {
    const { data } = await (supabase as any)
      .from("mensagens_dieta")
      .select("*")
      .eq("aluno_id", alunoId)
      .order("criado_em", { ascending: false });
    setRegistros((data ?? []) as Registro[]);
  }

  async function handleGerar() {
    setErrResumo(null); setErroGeral(null);
    if (!resumo.trim()) { setErrResumo("Campo obrigatório"); return; }

    setBusy(true);
    setResultado(null);
    try {
      const res = await gerar({
        data: { nomeAluno, resumoAjusteNutricional: resumo.trim() },
      });
      if (!res?.mensagem) {
        setErroGeral("Não foi possível gerar a mensagem. Tente novamente.");
        return;
      }
      setResultado(res.mensagem);
      const ex = res.extraidos;
      const { error: insErr } = await (supabase as any).from("mensagens_dieta").insert({
        aluno_id: alunoId,
        ajustes_realizados: ex?.ajustes_realizados ?? "Não informado.",
        dificuldades: ex?.dificuldades ?? null,
        medidas_otimizacao: ex?.medidas_otimizacao ?? "Não informado.",
        mensagem_gerada: res.mensagem,
        criado_por: crmUser?.nome ?? crmUser?.email ?? "usuario",
      });
      if (insErr) console.error("Falha ao salvar registro:", insErr);
      setToast("Mensagem gerada com sucesso");
      setTimeout(() => setToast(null), 3000);
      await load();
    } catch (e) {
      console.error(e);
      setErroGeral("Não foi possível gerar a mensagem. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function abrirWhatsApp(text: string) {
    const numero = (whatsapp || "").replace(/\D/g, "");
    const url = numero
      ? `https://wa.me/${numero}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Gerar mensagem de ajuste nutricional</h2>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground -mt-2">
            Preencha as informações abaixo em uma única resposta. A IA vai organizar isso em uma mensagem pronta para o aluno.
          </p>

          <Field label="Resumo do ajuste nutricional" required error={errResumo}>
            <textarea
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              placeholder={`Nome do aluno: ${nomeAluno}\n\nObjetivo atual:\n\nCalorias das próximas 4 semanas:\n\nDificuldade relatada:\n\nAjustes feitos na dieta:\n\nMedidas adotadas para otimizar a dieta:`}
              className="w-full bg-background border border-input rounded-md p-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 leading-relaxed overflow-y-auto resize-none"
              style={{ height: 110, maxHeight: 110 }}
              disabled={busy || !canEdit}
            />
          </Field>

          <button
            onClick={handleGerar}
            disabled={busy || !canEdit}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-3 text-sm font-semibold hover:bg-primary/90 disabled:opacity-60"
          >
            {busy ? (<><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>) : "Gerar mensagem"}
          </button>
          {erroGeral && <p className="text-xs text-primary text-center">{erroGeral}</p>}
        </div>

        {resultado && (
          <div className="mt-5 rounded-md p-4 relative" style={{ background: "#1C1C1C", borderLeft: "3px solid #f50000" }}>
            <div className="absolute top-2 right-2 flex items-center gap-1.5">
              <button
                onClick={() => copyText(resultado)}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-white/10 text-white hover:bg-white/20"
              >
                <Copy className="h-3 w-3" /> {copied ? "Copiado!" : "Copiar"}
              </button>
              <button
                onClick={() => abrirWhatsApp(resultado)}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-[#25D366] text-white hover:bg-[#1ebe57]"
                title={whatsapp ? `Enviar para ${whatsapp}` : "Enviar por WhatsApp"}
              >
                <MessageCircle className="h-3 w-3" /> WhatsApp
              </button>
            </div>
            <p className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: "var(--primary)" }}>
              Mensagem gerada
            </p>
            <p className="text-white whitespace-pre-wrap pr-32" style={{ fontSize: 14, lineHeight: 1.7 }}>
              {resultado}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold mb-4">Histórico de mensagens nutricionais</h2>
        {registros.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem gerada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b border-border">
                <tr>
                  <th className="text-left py-2 font-medium">Data</th>
                  <th className="text-left font-medium">Ajustes realizados</th>
                  <th className="text-left font-medium">Gerado por</th>
                  <th className="text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(r.criado_em)}</td>
                    <td className="py-2 pr-4">
                      {r.ajustes_realizados.length > 70
                        ? r.ajustes_realizados.slice(0, 70) + "..."
                        : r.ajustes_realizados}
                    </td>
                    <td className="py-2 text-xs text-muted-foreground">{r.criado_por ?? "—"}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => setOpenModal(r)} className="text-xs text-primary hover:underline">
                        Ver completo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openModal && <DetalheModal r={openModal} onClose={() => setOpenModal(null)} whatsapp={whatsapp} />}

      {toast && (
        <div className="fixed right-4 z-50 fab-bottom-safe rounded-md bg-foreground text-background px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string | null; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium">
        {label} {required && <span className="text-primary">*</span>}
      </span>
      {children}
      {error && <span className="text-[11px] text-primary">{error}</span>}
    </label>
  );
}

function DetalheModal({ r, onClose, whatsapp }: { r: Registro; onClose: () => void; whatsapp?: string | null }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    if (!r.mensagem_gerada) return;
    void navigator.clipboard.writeText(r.mensagem_gerada);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  function enviarWhats() {
    if (!r.mensagem_gerada) return;
    const numero = (whatsapp || "").replace(/\D/g, "");
    const url = numero
      ? `https://wa.me/${numero}?text=${encodeURIComponent(r.mensagem_gerada)}`
      : `https://wa.me/?text=${encodeURIComponent(r.mensagem_gerada)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 px-safe" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card">
          <h3 className="font-semibold">Mensagem nutricional — {fmtDateTime(r.criado_em)}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <Block title="Ajustes realizados" text={r.ajustes_realizados} />
          <Block title="Dificuldades relatadas" text={r.dificuldades} placeholder="Nenhuma dificuldade relatada" />
          <Block title="Medidas de otimização" text={r.medidas_otimizacao} />
          <hr className="border-border" />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Mensagem gerada</p>
            <div className="rounded-md p-4 relative" style={{ background: "#1C1C1C", borderLeft: "3px solid #f50000" }}>
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                <button onClick={copy} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-white/10 text-white hover:bg-white/20">
                  <Copy className="h-3 w-3" /> {copied ? "Copiado!" : "Copiar"}
                </button>
                <button onClick={enviarWhats} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-[#25D366] text-white hover:bg-[#1ebe57]">
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </button>
              </div>
              <p className="text-white whitespace-pre-wrap pr-32" style={{ fontSize: 14, lineHeight: 1.7 }}>
                {r.mensagem_gerada ?? "—"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Block({ title, text, placeholder }: { title: string; text: string | null; placeholder?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{title}</p>
      {text ? (
        <p className="text-sm whitespace-pre-wrap">{text}</p>
      ) : (
        <p className="text-sm text-muted-foreground italic">{placeholder ?? "—"}</p>
      )}
    </div>
  );
}