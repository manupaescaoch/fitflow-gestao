import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, CheckCircle2, Lock, AlertTriangle, ArrowLeft, ArrowRight, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CampoResposta } from "@/components/formularios/CampoResposta";
import {
  Formulario, Pergunta, Secao, TIPOS_ESTATICOS, condicoesAtendidas, mapFormulario, mapPergunta,
  perguntaVisivel, validarPergunta, type Valores,
} from "@/lib/formularios";

export const Route = createFileRoute("/f/$slug")({
  head: () => ({
    meta: [
      { title: "Formulário — MPTEAM" },
      { name: "description", content: "Responda o formulário da MPTEAM. Leva poucos minutos e suas respostas são confidenciais." },
      { property: "og:title", content: "Formulário — MPTEAM" },
      { property: "og:description", content: "Responda o formulário da MPTEAM em poucos minutos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormularioPublico,
});

type Estado = "carregando" | "invalido" | "fechado" | "aberto" | "enviado";

function FormularioPublico() {
  const { slug } = useParams({ from: "/f/$slug" });
  const [estado, setEstado] = useState<Estado>("carregando");
  const [form, setForm] = useState<Formulario | null>(null);
  const [secoes, setSecoes] = useState<Secao[]>([]);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [valores, setValores] = useState<Valores>({});
  const [erros, setErros] = useState<Record<string, string | null>>({});
  const [idx, setIdx] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [protocolo, setProtocolo] = useState<string | null>(null);
  const [identificacao, setIdentificacao] = useState({ nome: "", email: "", telefone: "" });
  const [motivoFechado, setMotivoFechado] = useState("Este formulário não está recebendo respostas no momento.");
  const [inicio] = useState(() => Date.now());

  const chaveRascunho = `form-rascunho-${slug}`;

  useEffect(() => {
    (async () => {
      const { data: f } = await supabase.from("form_formularios").select("*").eq("slug", slug).is("excluido_em", null).maybeSingle();
      if (!f) { setEstado("invalido"); return; }
      const formulario = mapFormulario(f as Record<string, unknown>);
      setForm(formulario);
      const [{ data: s }, { data: p }] = await Promise.all([
        supabase.from("form_secoes").select("*").eq("formulario_id", formulario.id).is("excluido_em", null).order("ordem"),
        supabase.from("form_perguntas").select("*").eq("formulario_id", formulario.id).is("excluido_em", null).order("ordem"),
      ]);
      setSecoes((s ?? []) as unknown as Secao[]);
      setPerguntas(((p ?? []) as Record<string, unknown>[]).map(mapPergunta));

      const agora = Date.now();
      const fechadoPor =
        formulario.status === "pausado" ? "Este formulário está pausado temporariamente."
        : formulario.status === "encerrado" ? "Este formulário foi encerrado."
        : formulario.status !== "publicado" ? "Este formulário ainda não foi publicado."
        : formulario.config.aceitar_respostas === false ? "Este formulário não está recebendo novas respostas."
        : formulario.abre_em && +new Date(formulario.abre_em) > agora ? "Este formulário ainda não está aberto."
        : formulario.encerra_em && +new Date(formulario.encerra_em) < agora ? "O prazo deste formulário foi encerrado."
        : formulario.max_respostas != null && formulario.total_respostas >= formulario.max_respostas ? "Este formulário atingiu o limite de respostas."
        : null;
      if (fechadoPor) { setMotivoFechado(fechadoPor); setEstado("fechado"); return; }

      if (formulario.config.uma_resposta_por_pessoa && localStorage.getItem(`form-enviado-${slug}`)) {
        setMotivoFechado("Você já enviou uma resposta para este formulário.");
        setEstado("fechado"); return;
      }
      try {
        const salvo = localStorage.getItem(chaveRascunho);
        if (salvo) setValores(JSON.parse(salvo) as Valores);
      } catch { /* rascunho inválido */ }
      setEstado("aberto");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (estado === "aberto") localStorage.setItem(chaveRascunho, JSON.stringify(valores));
  }, [valores, estado, chaveRascunho]);

  const secaoAtual = secoes[idx];
  const doSecao = useMemo(
    () => perguntas.filter((p) => p.secao_id === secaoAtual?.id),
    [perguntas, secaoAtual],
  );
  const visiveis = doSecao.filter((p) => perguntaVisivel(p, valores));

  const setValor = useCallback((pid: string, v: unknown) => {
    setValores((old) => ({ ...old, [pid]: v }));
    setErros((e) => ({ ...e, [pid]: null }));
  }, []);

  function validarSecao() {
    const novos: Record<string, string | null> = {};
    let ok = true;
    for (const p of visiveis) {
      const err = validarPergunta(p, valores[p.id], valores);
      novos[p.id] = err;
      if (err) ok = false;
    }
    if (form?.config.exigir_identificacao && idx === 0) {
      if (form.config.coletar_nome !== false && !identificacao.nome.trim()) { novos["__nome"] = "Informe seu nome."; ok = false; }
    }
    setErros((e) => ({ ...e, ...novos }));
    if (!ok) window.scrollTo({ top: 0, behavior: "smooth" });
    return ok;
  }

  function proximaSecaoIndex(): number | "fim" {
    const s = secaoAtual;
    if (!s) return "fim";
    if (s.destino === "encerrar") return "fim";
    if (s.destino === "secao" && s.destino_secao_id) {
      const alvo = secoes.findIndex((x) => x.id === s.destino_secao_id);
      return alvo >= 0 ? alvo : "fim";
    }
    return idx + 1 < secoes.length ? idx + 1 : "fim";
  }

  async function enviar() {
    if (!form || !validarSecao()) return;
    setEnviando(true);
    const { data: resp, error } = await supabase.from("form_respostas").insert({
      formulario_id: form.id,
      respondente_nome: identificacao.nome || null,
      respondente_email: identificacao.email || null,
      respondente_telefone: identificacao.telefone || null,
      duracao_seg: Math.round((Date.now() - inicio) / 1000),
    }).select("id, protocolo").single();

    if (error || !resp) {
      setEnviando(false);
      setMotivoFechado("Não foi possível registrar sua resposta. Tente novamente mais tarde.");
      setEstado("fechado");
      return;
    }

    const itens = perguntas
      .filter((p) => !TIPOS_ESTATICOS.includes(p.tipo) && perguntaVisivel(p, valores))
      .map((p, i) => {
        const v = valores[p.id];
        const num = typeof v === "number" ? v : null;
        const ehData = p.tipo === "data" && typeof v === "string" && v ? v : null;
        return {
          resposta_id: resp.id, pergunta_id: p.id, pergunta_titulo: p.titulo, pergunta_tipo: p.tipo, ordem: i,
          valor_texto: v == null ? null : Array.isArray(v) ? v.join(" | ") : String(v),
          valor_num: num, valor_data: ehData,
          valor_json: Array.isArray(v) ? v : null,
          arquivos: p.tipo === "arquivo" && Array.isArray(v) ? v : [],
        };
      });
    if (itens.length) await supabase.from("form_resposta_itens").insert(itens);

    localStorage.removeItem(chaveRascunho);
    if (form.config.uma_resposta_por_pessoa) localStorage.setItem(`form-enviado-${slug}`, "1");
    setProtocolo(resp.protocolo as string);
    setEnviando(false);
    setEstado("enviado");
    if (form.redirect_url) setTimeout(() => { window.location.href = form.redirect_url!; }, 2500);
  }

  if (estado === "carregando") {
    return <Centro><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Carregando formulário…</p></Centro>;
  }
  if (estado === "invalido") {
    return <Centro><AlertTriangle className="h-7 w-7 text-muted-foreground" />
      <p className="mt-3 font-semibold">Link inválido</p>
      <p className="text-sm text-muted-foreground">Este formulário não existe ou foi removido.</p></Centro>;
  }
  if (estado === "fechado") {
    return <Centro><Lock className="h-7 w-7 text-muted-foreground" />
      <p className="mt-3 font-semibold">{form?.titulo ?? "Formulário"}</p>
      <p className="text-sm text-muted-foreground">{motivoFechado}</p></Centro>;
  }

  const cor = form?.cor_primaria ?? "#e11d48";

  if (estado === "enviado") {
    return (
      <Centro>
        <CheckCircle2 className="h-10 w-10" style={{ color: cor }} />
        <p className="mt-3 text-lg font-semibold">Resposta recebida</p>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{form?.mensagem_sucesso}</p>
        {form?.config.gerar_protocolo && protocolo && (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-sm">Protocolo: <strong>{protocolo}</strong></p>
        )}
        <div className="mt-5 flex gap-2">
          {form?.config.permitir_editar && (
            <Button variant="outline" onClick={() => { setEstado("aberto"); setIdx(0); }}>Editar minha resposta</Button>
          )}
          {!form?.config.uma_resposta_por_pessoa && (
            <Button onClick={() => { setValores({}); setProtocolo(null); setIdx(0); setEstado("aberto"); }}>Enviar nova resposta</Button>
          )}
        </div>
      </Centro>
    );
  }

  const progresso = secoes.length ? Math.round(((idx + 1) / secoes.length) * 100) : 100;
  const proxima = proximaSecaoIndex();

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-6">
      <div className="mx-auto w-full max-w-2xl">
        {form?.capa_url && (
          <img src={form.capa_url} alt={`Capa do formulário ${form.titulo}`} loading="lazy"
            className="mb-4 h-36 w-full rounded-xl object-cover" />
        )}
        <div className="rounded-xl border border-border bg-card p-5" style={{ borderTopColor: cor, borderTopWidth: 4 }}>
          <h1 className="text-xl font-bold" style={{ color: cor }}>{form?.titulo}</h1>
          {form?.descricao && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{form.descricao}</p>}
          {form?.config.setor && <p className="mt-2 text-xs text-muted-foreground">Setor responsável: {form.config.setor}</p>}
        </div>

        {form?.config.barra_progresso && secoes.length > 1 && (
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${progresso}%`, backgroundColor: cor }} />
          </div>
        )}

        {idx === 0 && (form?.config.exigir_identificacao || form?.config.coletar_nome || form?.config.coletar_email || form?.config.coletar_telefone) && (
          <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Identificação</h2>
            {(form.config.coletar_nome ?? form.config.exigir_identificacao) && (
              <div>
                <label className="text-sm font-medium">Nome {form.config.exigir_identificacao && <span style={{ color: cor }}>*</span>}</label>
                <Input className="mt-1" value={identificacao.nome} onChange={(e) => setIdentificacao((v) => ({ ...v, nome: e.target.value }))} />
                {erros["__nome"] && <p className="mt-1 text-xs font-medium text-destructive">{erros["__nome"]}</p>}
              </div>
            )}
            {form.config.coletar_email && (
              <div>
                <label className="text-sm font-medium">E-mail</label>
                <Input className="mt-1" type="email" inputMode="email" value={identificacao.email}
                  onChange={(e) => setIdentificacao((v) => ({ ...v, email: e.target.value }))} />
              </div>
            )}
            {form.config.coletar_telefone && (
              <div>
                <label className="text-sm font-medium">Telefone</label>
                <Input className="mt-1" type="tel" inputMode="tel" value={identificacao.telefone}
                  onChange={(e) => setIdentificacao((v) => ({ ...v, telefone: e.target.value }))} />
              </div>
            )}
            {form.config.permitir_anonimo && !form.config.exigir_identificacao && (
              <p className="text-xs text-muted-foreground">Você pode responder sem se identificar.</p>
            )}
          </div>
        )}

        {secaoAtual && (
          <div className="mt-3 rounded-xl border border-border bg-card p-5">
            {secoes.length > 1 && (
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Seção {idx + 1} de {secoes.length}
                </p>
                <h2 className="mt-1 text-base font-semibold">{secaoAtual.titulo}</h2>
                {secaoAtual.descricao && <p className="text-sm text-muted-foreground">{secaoAtual.descricao}</p>}
              </div>
            )}
            <div className="space-y-6">
              {visiveis.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pergunta nesta seção.</p>}
              {visiveis.map((p) => (
                <CampoResposta key={p.id} pergunta={p} cor={cor} valor={valores[p.id]}
                  erro={erros[p.id] ?? null} onChange={(v) => setValor(p.id, v)} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 pb-8">
          {idx > 0 && (
            <Button variant="outline" onClick={() => setIdx((i) => Math.max(0, i - 1))}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
          )}
          {proxima === "fim" ? (
            <Button className="ml-auto" disabled={enviando} onClick={() => void enviar()} style={{ backgroundColor: cor }}>
              {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} Enviar
            </Button>
          ) : (
            <Button className="ml-auto" style={{ backgroundColor: cor }}
              onClick={() => { if (validarSecao()) { setIdx(proxima as number); window.scrollTo({ top: 0 }); } }}>
              Avançar <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-6 text-center">
      {children}
    </div>
  );
}

export { condicoesAtendidas };
