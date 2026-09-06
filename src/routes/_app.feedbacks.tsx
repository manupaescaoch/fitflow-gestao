import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { gerarRespostaFeedback } from "@/server/feedback.functions";
import { gerarMensagemPontoContato } from "@/server/pontos-contato.functions";
import { calcularPrimeiroFeedbackMensal } from "@/lib/feedback-agendamento";
import {
  FileText, Send, Eye, Pencil, Trash2, Plus, Calendar,
  Filter, Copy, Loader2, ShieldAlert, Inbox, Sparkles, Save, MessageSquare, X,
  Pause, Play, Radio, RefreshCw,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/feedbacks")({
  component: FeedbacksPage,
});

type TabKey = "formularios" | "prompts" | "enviados" | "respondidos" | "agendamentos" | "pontos_contato";

type Template = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  perguntas: unknown;
  ativo: boolean;
  criado_em: string;
};

type Pergunta = {
  id: string;
  secao?: string;
  label: string;
  tipo: "text" | "textarea" | "number" | "date" | "radio" | "select" | "file";
  obrigatorio?: boolean;
  opcoes?: string[];
};

type Envio = {
  id: string;
  template_id: string;
  aluno_id: string;
  token: string;
  status: string;
  enviado_em: string;
  respondido_em: string | null;
};

type Agendamento = {
  id: string;
  aluno_id: string;
  template_id: string;
  periodicidade: string;
  intervalo_dias: number;
  proximo_envio_em: string | null;
  ultimo_envio_em: string | null;
  ativo: boolean;
};

type AlunoMin = { id: string; nome: string };

const TABS: { key: TabKey; label: string }[] = [
  { key: "respondidos", label: "Respondidos" },
  { key: "enviados", label: "Enviados" },
  { key: "agendamentos", label: "Agendados" },
];


function FeedbacksPage() {
  const { isAdmin } = useAuth();
  const canEdit = isAdmin;
  const [tab, setTab] = useState<TabKey>("respondidos");

  if (!canEdit) {
    return (
      <div className="max-w-2xl mx-auto mt-12 rounded-lg border border-border bg-card p-6 text-center">
        <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <h2 className="text-lg font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground">Apenas administradores podem acessar Feedbacks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Feedbacks</h1>
          <p className="text-sm text-muted-foreground mt-1">Crie e envie formulários de Anamnese, Quinzenal e Mensal para seus alunos.</p>
        </div>
      </div>

      <div className="border-b border-border -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 -mb-px overflow-x-auto scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "formularios" && <FormulariosTab />}
      {tab === "prompts" && <PromptsTab canEdit={canEdit} />}
      {tab === "enviados" && <EnviadosTab />}
      {tab === "respondidos" && <RespondidosTab />}
      {tab === "agendamentos" && <AgendamentosTab />}
      {tab === "pontos_contato" && <PontosContatoTab canEdit={canEdit} />}
    </div>
  );
}

/* ---------------- BOTÃO TESTE — Reenvio das últimas 24h ---------------- */
/* ---------------- FORMULÁRIOS ---------------- */
function FormulariosTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviarFor, setEnviarFor] = useState<Template | null>(null);
  const [previewFor, setPreviewFor] = useState<Template | null>(null);
  const [editFor, setEditFor] = useState<Template | null>(null);
  const [deleteFor, setDeleteFor] = useState<Template | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("feedback_templates")
      .select("*")
      .eq("ativo", true)
      .order("criado_em", { ascending: false });
    setTemplates((data ?? []) as Template[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => toast.info("Editor de perguntas será implementado em breve")}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Novo Formulário
        </button>
      </div>

      {templates.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum formulário criado" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-semibold text-foreground">{t.nome}</h3>
                <TipoBadge tipo={t.tipo} />
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[2.5rem]">
                {t.descricao || "Sem descrição"}
              </p>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Criado em {new Date(t.criado_em).toLocaleDateString("pt-BR")}
                </span>
                <div className="flex items-center gap-1">
                  <IconBtn title="Visualizar como o aluno" onClick={() => setPreviewFor(t)}><Eye className="h-4 w-4" /></IconBtn>
                  <IconBtn title="Enviar para aluno" onClick={() => setEnviarFor(t)}><Send className="h-4 w-4" /></IconBtn>
                  <IconBtn title="Editar" onClick={() => setEditFor(t)}><Pencil className="h-4 w-4" /></IconBtn>
                  <IconBtn title="Excluir" onClick={() => setDeleteFor(t)}><Trash2 className="h-4 w-4" /></IconBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {enviarFor && <EnviarModal template={enviarFor} onClose={() => setEnviarFor(null)} onSent={load} />}
      {previewFor && <PreviewModal template={previewFor} onClose={() => setPreviewFor(null)} />}
      {editFor && <EditTemplateModal template={editFor} onClose={() => setEditFor(null)} onSaved={() => { setEditFor(null); load(); }} />}
      {deleteFor && <DeleteConfirmModal template={deleteFor} onClose={() => setDeleteFor(null)} onDeleted={() => { setDeleteFor(null); load(); }} />}
    </div>
  );
}

/* ---------------- PROMPTS IA ---------------- */
type PromptTipo = "anamnese" | "feedback_quinzenal" | "feedback_mensal" | "check_shape_mensal" | "followup_d7" | "followup_d21" | "estrategia_treino" | "estrategia_nutricional";

const PROMPT_SECTIONS: { tipo: PromptTipo; label: string; descricao: string }[] = [
  { tipo: "anamnese", label: "Anamnese", descricao: "Resposta após o aluno preencher a anamnese inicial." },
  { tipo: "feedback_quinzenal", label: "Feedback Quinzenal (histórico)", descricao: "Não usado: o quinzenal agora é apenas uma mensagem de check-in." },
  { tipo: "feedback_mensal", label: "Feedback Mensal", descricao: "Resposta após o feedback mensal completo." },
  { tipo: "check_shape_mensal", label: "Check Shape Mensal", descricao: "Análise das fotos antes/depois (comparativo mensal) no tom do Manu Paes." },
  { tipo: "followup_d7", label: "Follow-up D7", descricao: "Mensagem automática 7 dias após a entrega do plano." },
  { tipo: "followup_d21", label: "Follow-up D21", descricao: "Mensagem automática 21 dias após a entrega do plano." },
  { tipo: "estrategia_treino", label: "Estratégia de Treino", descricao: "Prompt usado para gerar a estratégia de treino do aluno." },
  { tipo: "estrategia_nutricional", label: "Estratégia Nutricional", descricao: "Prompt usado para gerar a estratégia nutricional do aluno." },
];

const PROMPT_VARS = [
  { name: "nome_aluno", desc: "primeiro nome / nome completo do aluno" },
  { name: "respostas", desc: "respostas do formulário, agrupadas por seção" },
];

function PromptsTab({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
        Configure o prompt de IA para cada tipo de formulário. Quando um aluno responder, você poderá gerar a resposta personalizada na aba <span className="font-medium text-foreground">Enviados</span>.
      </div>
      {PROMPT_SECTIONS.map((s) => (
        <PromptEditor key={s.tipo} tipo={s.tipo} label={s.label} descricao={s.descricao} canEdit={canEdit} />
      ))}
    </div>
  );
}

function PromptEditor({ tipo, label, descricao, canEdit }: { tipo: PromptTipo; label: string; descricao: string; canEdit: boolean }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("prompts_ia").select("prompt_sistema").eq("tipo", tipo).maybeSingle();
      setText(data?.prompt_sistema ?? "");
      setLoading(false);
    })();
  }, [tipo]);

  const save = async () => {
    setSaving(true); setSavedAt(null);
    const { data: existing } = await supabase.from("prompts_ia").select("id").eq("tipo", tipo).maybeSingle();
    const { error } = existing
      ? await supabase.from("prompts_ia").update({ prompt_sistema: draft, atualizado_em: new Date().toISOString() }).eq("id", existing.id)
      : await supabase.from("prompts_ia").insert({ tipo, prompt_sistema: draft });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setText(draft);
    setSavedAt(new Date().toLocaleTimeString("pt-BR"));
    toast.success("Prompt salvo");
    setEditing(false);
  };

  const insertVar = (name: string) => {
    const el = ref.current;
    const token = `{{${name}}}`;
    if (!el) { setDraft(draft + token); return; }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    setDraft(draft.slice(0, start) + token + draft.slice(end));
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + token.length; });
  };

  const openEdit = () => { setDraft(text); setEditing(true); };

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-5 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold leading-tight">{label}</h3>
              <TipoBadge tipo={tipo} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{descricao}</p>
            {savedAt && <p className="text-[11px] text-muted-foreground mt-1">Atualizado às {savedAt}</p>}
          </div>
        </div>
        <button
          onClick={openEdit}
          disabled={loading || !canEdit}
          className="shrink-0 inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          <Pencil className="h-3.5 w-3.5" />
          Editar agente
        </button>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 px-safe" onClick={() => !saving && setEditing(false)}>
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-base font-semibold">Editar agente — {label}</h3>
              </div>
              <button onClick={() => !saving && setEditing(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">{descricao}</p>
            <textarea
              ref={ref}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={saving || !canEdit}
              rows={12}
              placeholder="Escreva o prompt do sistema..."
              className="w-full bg-background border border-border rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
            />
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground mb-2">Variáveis injetadas automaticamente — clique para inserir no cursor:</p>
              <div className="flex flex-wrap gap-2">
                {PROMPT_VARS.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => insertVar(v.name)}
                    disabled={!canEdit}
                    title={v.desc}
                    className="text-[11px] px-2 py-1 rounded font-mono bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 disabled:opacity-50"
                  >{`{{${v.name}}}`}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >Cancelar</button>
              <button
                onClick={save}
                disabled={saving || !canEdit}
                className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- ENVIADOS ---------------- */
function EnviadosTab() {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [alunos, setAlunos] = useState<AlunoMin[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroAluno, setFiltroAluno] = useState<string>("todos");
  const [loading, setLoading] = useState(true);
  const [gerarFor, setGerarFor] = useState<Envio | null>(null);

  useEffect(() => {
    (async () => {
      const [e, t, a] = await Promise.all([
        supabase.from("feedback_envios").select("*").order("enviado_em", { ascending: false }),
        supabase.from("feedback_templates").select("*"),
        supabase.from("alunos").select("id,nome").order("nome"),
      ]);
      setEnvios((e.data ?? []) as Envio[]);
      setTemplates((t.data ?? []) as Template[]);
      setAlunos((a.data ?? []) as AlunoMin[]);
      setLoading(false);
    })();
  }, []);

  const tplMap = useMemo(() => Object.fromEntries(templates.map((t) => [t.id, t])), [templates]);
  const alnMap = useMemo(() => Object.fromEntries(alunos.map((a) => [a.id, a.nome])), [alunos]);

  const filtered = envios.filter((e) => {
    if (filtroTipo !== "todos" && tplMap[e.template_id]?.tipo !== filtroTipo) return false;
    if (filtroAluno !== "todos" && e.aluno_id !== filtroAluno) return false;
    return true;
  });

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">
          <option value="todos">Todos os tipos</option>
          <option value="anamnese">Anamnese</option>
          <option value="feedback_quinzenal">Quinzenal</option>
          <option value="feedback_mensal">Mensal</option>
          <option value="custom">Customizado</option>
        </select>
        <select value={filtroAluno} onChange={(e) => setFiltroAluno(e.target.value)} className="rounded-md border border-border bg-background px-3 py-1.5 text-sm">
          <option value="todos">Todos os alunos</option>
          {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Inbox} title="Nenhum feedback enviado ainda" />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Aluno</th>
                <th className="text-left px-4 py-2.5 font-medium">Formulário</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Enviado</th>
                <th className="text-left px-4 py-2.5 font-medium">Respondido</th>
                <th className="text-right px-4 py-2.5 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">{alnMap[e.aluno_id] ?? "—"}</td>
                  <td className="px-4 py-2.5">{tplMap[e.template_id]?.nome ?? "—"}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={e.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{new Date(e.enviado_em).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.respondido_em ? new Date(e.respondido_em).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      {e.status === "respondido" && (
                        <button
                          title="Gerar resposta com IA"
                          onClick={() => setGerarFor(e)}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Gerar resposta IA
                        </button>
                      )}
                      <button
                        title="Copiar link"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/formularios/${e.token}`);
                          toast.success("Link copiado");
                        }}
                        className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {gerarFor && (
        <GerarRespostaModal
          envio={gerarFor}
          alunoNome={alnMap[gerarFor.aluno_id] ?? ""}
          alunoId={gerarFor.aluno_id}
          templateNome={tplMap[gerarFor.template_id]?.nome ?? ""}
          onClose={() => setGerarFor(null)}
        />
      )}
    </div>
  );
}

/* ---------------- RESPONDIDOS ---------------- */
type RespondidoRow = {
  id: string;
  origem: "envio" | "formulario";
  aluno_id: string | null;
  aluno_nome: string;
  template_nome: string;
  tipo: string;
  respondido_em: string;
  link?: string;
};

function RespondidosTab() {
  const [rows, setRows] = useState<RespondidoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [envR, formR, tplR, alnR] = await Promise.all([
        supabase
          .from("feedback_envios")
          .select("id,aluno_id,template_id,respondido_em,status")
          .eq("status", "respondido")
          .not("respondido_em", "is", null)
          .order("respondido_em", { ascending: false }),
        supabase
          .from("formularios")
          .select("id,aluno_id,tipo,respondido_em,respondido")
          .eq("respondido", true)
          .not("respondido_em", "is", null)
          .order("respondido_em", { ascending: false }),
        supabase.from("feedback_templates").select("id,nome,tipo"),
        supabase.from("alunos").select("id,nome"),
      ]);
      const tplMap = Object.fromEntries((tplR.data ?? []).map((t: any) => [t.id, t]));
      const alnMap = Object.fromEntries((alnR.data ?? []).map((a: any) => [a.id, a.nome]));

      const tipoLabel: Record<string, string> = {
        anamnese: "Anamnese",
        feedback_mensal: "Feedback mensal",
        feedback_quinzenal: "Feedback quinzenal",
        check_shape: "Check shape",
        treino: "Treino",
        custom: "Customizado",
      };

      const fromEnvios: RespondidoRow[] = (envR.data ?? []).map((e: any) => ({
        id: `env_${e.id}`,
        origem: "envio",
        aluno_id: e.aluno_id,
        aluno_nome: alnMap[e.aluno_id] ?? "—",
        template_nome: tplMap[e.template_id]?.nome ?? "—",
        tipo: tplMap[e.template_id]?.tipo ?? "custom",
        respondido_em: e.respondido_em,
      }));

      const fromForms: RespondidoRow[] = (formR.data ?? []).map((f: any) => ({
        id: `form_${f.id}`,
        origem: "formulario",
        aluno_id: f.aluno_id,
        aluno_nome: f.aluno_id ? (alnMap[f.aluno_id] ?? "—") : "—",
        template_nome: tipoLabel[f.tipo] ?? f.tipo,
        tipo: f.tipo,
        respondido_em: f.respondido_em,
        link: `/formularios/${f.id}/respostas`,
      }));

      const all = [...fromEnvios, ...fromForms].sort(
        (a, b) => new Date(b.respondido_em).getTime() - new Date(a.respondido_em).getTime()
      );
      setRows(all);
      setLoading(false);
    })();
  }, []);

  const tipos = useMemo(() => Array.from(new Set(rows.map((r) => r.tipo))), [rows]);
  const filtered = rows.filter((r) => {
    if (filtroTipo !== "todos" && r.tipo !== filtroTipo) return false;
    if (busca && !r.aluno_nome.toLowerCase().includes(busca.toLowerCase())) return false;
    return true;
  });

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
        >
          <option value="todos">Todos os tipos</option>
          {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por aluno..."
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm flex-1 min-w-[200px] max-w-xs"
        />
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} respondido(s)</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Inbox} title="Nenhum formulário respondido ainda" />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Aluno</th>
                <th className="text-left px-4 py-2.5 font-medium">Formulário</th>
                <th className="text-left px-4 py-2.5 font-medium">Data</th>
                <th className="text-left px-4 py-2.5 font-medium">Hora</th>
                <th className="text-right px-4 py-2.5 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => {
                const dt = new Date(r.respondido_em);
                const href = r.link ?? (r.aluno_id ? `/alunos/${r.aluno_id}` : null);
                return (
                  <tr
                    key={r.id}
                    className={`hover:bg-muted/30 ${href ? "cursor-pointer" : ""}`}
                    onClick={() => { if (href) window.location.href = href; }}
                  >
                    <td className="px-4 py-2.5 font-medium">{r.aluno_nome}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span>{r.template_nome}</span>
                        <TipoBadge tipo={r.tipo} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {dt.toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {r.link ? (
                        <a
                          href={r.link}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver respostas
                        </a>
                      ) : r.aluno_id ? (
                        <Link
                          to="/alunos/$id"
                          params={{ id: r.aluno_id }}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver aluno
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- AGENDAMENTOS ---------------- */
function AgendamentosTab() {
  const [items, setItems] = useState<Agendamento[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [alunos, setAlunos] = useState<AlunoMin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    const [ag, t, a] = await Promise.all([
      supabase.from("feedback_agendamentos").select("*").order("criado_em", { ascending: false }),
      supabase.from("feedback_templates").select("*").eq("ativo", true),
      supabase.from("alunos").select("id,nome").order("nome"),
    ]);
    setItems((ag.data ?? []) as Agendamento[]);
    setTemplates((t.data ?? []) as Template[]);
    setAlunos((a.data ?? []) as AlunoMin[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const tplMap = useMemo(() => Object.fromEntries(templates.map((t) => [t.id, t.nome])), [templates]);
  const alnMap = useMemo(() => Object.fromEntries(alunos.map((a) => [a.id, a.nome])), [alunos]);

  const toggle = async (id: string, ativo: boolean) => {
    await supabase.from("feedback_agendamentos").update({ ativo: !ativo }).eq("id", id);
    load();
  };

  const [recalculando, setRecalculando] = useState(false);
  const recalcularMensais = async () => {
    if (!window.confirm("Recalcular a data do próximo envio de todos os agendamentos mensais de alunos com plano vigente?")) return;
    setRecalculando(true);
    try {
      const mensais = items.filter((a) => a.periodicidade === "mensal" && a.ativo);
      if (mensais.length === 0) {
        toast.info("Nenhum agendamento mensal ativo encontrado.");
        return;
      }
      const ids = mensais.map((m) => m.aluno_id);
      const { data: alunosData, error: alErr } = await supabase
        .from("alunos")
        .select("id,status,data_compra")
        .in("id", ids);
      if (alErr) { toast.error(alErr.message); return; }
      const alunoById = new Map((alunosData ?? []).map((a) => [a.id, a]));
      let atualizados = 0;
      let ignorados = 0;
      for (const ag of mensais) {
        const al = alunoById.get(ag.aluno_id);
        if (!al || al.status !== "ativo" || !al.data_compra) { ignorados++; continue; }
        const proximo = calcularPrimeiroFeedbackMensal(new Date(al.data_compra)).toISOString();
        const { error } = await supabase
          .from("feedback_agendamentos")
          .update({ proximo_envio_em: proximo })
          .eq("id", ag.id);
        if (!error) atualizados++;
      }
      toast.success(`${atualizados} agendamento(s) recalculado(s)${ignorados ? ` · ${ignorados} ignorado(s)` : ""}`);
      load();
    } finally {
      setRecalculando(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button
          onClick={recalcularMensais}
          disabled={recalculando}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          title="Recalcula proximo_envio_em para agendamentos mensais de alunos com status ativo, usando o dia da data_compra"
        >
          {recalculando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Recalcular datas mensais
        </button>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Configurar Periodicidade
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Calendar} title="Nenhum agendamento periódico configurado" />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Aluno</th>
                <th className="text-left px-4 py-2.5 font-medium">Formulário</th>
                <th className="text-left px-4 py-2.5 font-medium">Periodicidade</th>
                <th className="text-left px-4 py-2.5 font-medium">Próximo envio</th>
                <th className="text-left px-4 py-2.5 font-medium">Ativo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5">{alnMap[a.aluno_id] ?? "—"}</td>
                  <td className="px-4 py-2.5">{tplMap[a.template_id] ?? "—"}</td>
                  <td className="px-4 py-2.5 capitalize">{a.periodicidade.replace("_", " ")} <span className="text-xs text-muted-foreground">({a.intervalo_dias}d)</span></td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {a.proximo_envio_em ? new Date(a.proximo_envio_em).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggle(a.id, a.ativo)}
                      className={`inline-flex h-5 w-9 items-center rounded-full transition ${a.ativo ? "bg-primary" : "bg-muted"}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-background transition-transform ${a.ativo ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AgendamentoModal
          templates={templates}
          alunos={alunos}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

/* ---------------- HELPERS ---------------- */
function EnviarModal({ template, onClose, onSent }: { template: Template; onClose: () => void; onSent: () => void }) {
  const [alunos, setAlunos] = useState<AlunoMin[]>([]);
  const [alunoId, setAlunoId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("alunos").select("id,nome").order("nome");
      setAlunos((data ?? []) as AlunoMin[]);
    })();
  }, []);

  const enviar = async () => {
    if (!alunoId) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("feedback_envios")
      .insert({ template_id: template.id, aluno_id: alunoId })
      .select("token")
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    const link = `${window.location.origin}/formularios/${data!.token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Link gerado e copiado — abrindo em nova aba");
    window.open(link, "_blank", "noopener,noreferrer");
    onSent();
    onClose();
  };

  return (
    <Modal title={`Enviar: ${template.nome}`} onClose={onClose}>
      <div className="space-y-4">
        <LinkPublicoBox tipo={template.tipo} />
        <div>
          <label className="text-sm font-medium text-foreground">Aluno</label>
          <select value={alunoId} onChange={(e) => setAlunoId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">Selecione...</option>
            {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
          <button onClick={enviar} disabled={!alunoId || saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Gerar link
          </button>
        </div>
      </div>
    </Modal>
  );
}

const PUBLIC_LINK_MAP: Record<string, { path: string; label: string }> = {
  anamnese: { path: "/anamnese", label: "Anamnese Inicial" },
  feedback_mensal: { path: "/feedback-mensal", label: "Feedback Mensal" },
};

function LinkPublicoBox({ tipo }: { tipo: string }) {
  const meta = PUBLIC_LINK_MAP[tipo];
  if (!meta) return null;
  const link = typeof window !== "undefined" ? `${window.location.origin}${meta.path}` : meta.path;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link público copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Link público fixo · {meta.label}
        </div>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
        >
          <Copy className="h-3.5 w-3.5" /> Copiar
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-mono text-foreground"
        />
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
        >
          Abrir
        </a>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Sem login, sem token. Use para divulgação geral. Para vincular a um aluno específico, gere um link individual abaixo.
      </p>
    </div>
  );
}

const PERIODICIDADES = [
  { value: "semanal", label: "Semanal", dias: 7 },
  { value: "quinzenal", label: "Quinzenal", dias: 15 },
  { value: "mensal", label: "Mensal", dias: 30 },
];

function AgendamentoModal({ templates, alunos, onClose, onSaved }: { templates: Template[]; alunos: AlunoMin[]; onClose: () => void; onSaved: () => void }) {
  const [alunoId, setAlunoId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [periodicidade, setPeriodicidade] = useState("quinzenal");
  const [saving, setSaving] = useState(false);
  const [previewMensal, setPreviewMensal] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setPreviewMensal(null);
    if (periodicidade !== "mensal" || !alunoId) return;
    (async () => {
      const { data } = await supabase
        .from("alunos")
        .select("status,data_compra")
        .eq("id", alunoId)
        .maybeSingle();
      if (cancel) return;
      if (data?.status === "ativo" && data?.data_compra) {
        const d = calcularPrimeiroFeedbackMensal(new Date(data.data_compra));
        setPreviewMensal(d.toLocaleDateString("pt-BR"));
      } else if (data && data.status !== "ativo") {
        setPreviewMensal("__inativo__");
      } else if (data && !data.data_compra) {
        setPreviewMensal("__sem_compra__");
      }
    })();
    return () => { cancel = true; };
  }, [alunoId, periodicidade]);

  const salvar = async () => {
    if (!alunoId || !templateId) return;
    setSaving(true);
    const dias = PERIODICIDADES.find((p) => p.value === periodicidade)?.dias ?? 15;
    let proximo = new Date(Date.now() + dias * 86400000).toISOString();
    if (periodicidade === "mensal") {
      const { data: aluno } = await supabase
        .from("alunos")
        .select("status,data_compra")
        .eq("id", alunoId)
        .maybeSingle();
      if (aluno?.status === "ativo" && aluno?.data_compra) {
        proximo = calcularPrimeiroFeedbackMensal(new Date(aluno.data_compra)).toISOString();
      }
    }
    const { error } = await supabase.from("feedback_agendamentos").insert({
      aluno_id: alunoId, template_id: templateId, periodicidade, intervalo_dias: dias, proximo_envio_em: proximo,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Agendamento criado");
    onSaved();
  };

  return (
    <Modal title="Configurar periodicidade" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Aluno</label>
          <select value={alunoId} onChange={(e) => setAlunoId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">Selecione...</option>
            {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Formulário</label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="">Selecione...</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Periodicidade</label>
          <select value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            {PERIODICIDADES.map((p) => <option key={p.value} value={p.value}>{p.label} (a cada {p.dias} dias)</option>)}
          </select>
          {periodicidade === "mensal" && previewMensal && previewMensal !== "__inativo__" && previewMensal !== "__sem_compra__" && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Primeiro envio: <span className="font-medium text-foreground">{previewMensal}</span> (mês seguinte à data de compra)
            </p>
          )}
          {periodicidade === "mensal" && previewMensal === "__inativo__" && (
            <p className="mt-1.5 text-xs text-amber-600">Aluno não está com plano vigente — usará o cálculo padrão (hoje + 30 dias).</p>
          )}
          {periodicidade === "mensal" && previewMensal === "__sem_compra__" && (
            <p className="mt-1.5 text-xs text-amber-600">Aluno sem data de compra — usará o cálculo padrão (hoje + 30 dias).</p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={!alunoId || !templateId || saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 px-safe" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* ---------- PREVIEW (como o aluno vê) ---------- */
function PreviewModal({ template, onClose }: { template: Template; onClose: () => void }) {
  const perguntas = (Array.isArray(template.perguntas) ? template.perguntas : []) as Pergunta[];
  const grupos = perguntas.reduce<Record<string, Pergunta[]>>((acc, p) => {
    const k = p.secao ?? "Perguntas";
    (acc[k] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 p-4 overflow-y-auto px-safe" onClick={onClose}>
      <div className="w-full max-w-2xl my-8 rounded-lg border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-6 py-4 rounded-t-lg">
          <div>
            <h3 className="text-lg font-semibold">Preview: {template.nome}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Visualização de como o aluno verá o formulário</p>
          </div>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Fechar</button>
        </div>
        <div className="px-6 py-5 space-y-6">
          {template.descricao && (
            <div className="rounded-md border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm whitespace-pre-line">
              {template.descricao}
            </div>
          )}
          {Object.entries(grupos).map(([secao, items]) => (
            <div key={secao} className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground border-b border-border pb-1">{secao}</h4>
              {items.map((p) => (
                <div key={p.id} className="space-y-1">
                  <label className="text-sm text-foreground">
                    {p.label}
                    {p.obrigatorio && <span className="text-destructive ml-1">*</span>}
                  </label>
                  <PreviewField p={p} />
                </div>
              ))}
            </div>
          ))}
          {perguntas.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Esse template ainda não tem perguntas.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewField({ p }: { p: Pergunta }) {
  const cls = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm pointer-events-none";
  if (p.tipo === "textarea") return <textarea disabled rows={3} className={cls} placeholder="Resposta do aluno..." />;
  if (p.tipo === "radio") {
    return (
      <div className="space-y-1.5 pt-1">
        {(p.opcoes ?? []).map((o) => (
          <label key={o} className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="radio" disabled /> {o}
          </label>
        ))}
      </div>
    );
  }
  if (p.tipo === "select") {
    return (
      <select disabled className={cls}>
        <option>Selecione...</option>
        {(p.opcoes ?? []).map((o) => <option key={o}>{o}</option>)}
      </select>
    );
  }
  return <input disabled type={p.tipo === "number" ? "number" : p.tipo === "date" ? "date" : "text"} className={cls} placeholder="Resposta do aluno..." />;
}

/* ---------- EDIT ---------- */
function EditTemplateModal({ template, onClose, onSaved }: { template: Template; onClose: () => void; onSaved: () => void }) {
  const [nome, setNome] = useState(template.nome);
  const [descricao, setDescricao] = useState(template.descricao ?? "");
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("feedback_templates")
      .update({ nome: nome.trim(), descricao: descricao.trim() || null, atualizado_em: new Date().toISOString() })
      .eq("id", template.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Formulário atualizado");
    onSaved();
  };

  return (
    <Modal title="Editar formulário" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-sm font-medium">Descrição / cabeçalho</label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
        </div>
        <p className="text-xs text-muted-foreground">A edição das perguntas será adicionada em breve.</p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- DELETE CONFIRM ---------- */
function DeleteConfirmModal({ template, onClose, onDeleted }: { template: Template; onClose: () => void; onDeleted: () => void }) {
  const [deleting, setDeleting] = useState(false);

  const excluir = async () => {
    setDeleting(true);
    // Soft-delete: marca como inativo (preserva histórico de envios já feitos)
    const { error } = await supabase
      .from("feedback_templates")
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq("id", template.id);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Formulário excluído");
    onDeleted();
  };

  return (
    <Modal title="Excluir formulário" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <Trash2 className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Tem certeza que deseja excluir?</p>
            <p className="text-muted-foreground mt-1">
              O formulário <span className="font-medium text-foreground">"{template.nome}"</span> será removido da lista. Os envios já feitos para alunos continuarão acessíveis.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
          <button onClick={excluir} disabled={deleting} className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50">
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />} Excluir
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EmptyState({ icon: Icon, title }: { icon: typeof FileText; title: string }) {
  return (
    <div className="rounded-lg border border-border bg-card py-16 text-center">
      <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">{title}</p>
    </div>
  );
}

function Loading() {
  return <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={title} className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted">
      {children}
    </button>
  );
}

function TipoBadge({ tipo }: { tipo: string }) {
  const labels: Record<string, string> = {
    anamnese: "Anamnese", feedback_quinzenal: "Quinzenal", feedback_mensal: "Mensal", check_shape_mensal: "Check Shape Mensal", custom: "Custom",
    followup_d7: "Follow-up D7", followup_d21: "Follow-up D21",
    estrategia_treino: "Estratégia Treino", estrategia_nutricional: "Estratégia Nutricional",
  };
  return <span className="inline-flex items-center rounded bg-primary/15 text-primary px-2 py-0.5 text-xs font-medium">{labels[tipo] ?? tipo}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pendente: { label: "Pendente", cls: "bg-amber-500/15 text-amber-500" },
    respondido: { label: "Respondido", cls: "bg-emerald-500/15 text-emerald-500" },
    expirado: { label: "Expirado", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span>;
}

/* ---------- GERAR RESPOSTA IA ---------- */
function GerarRespostaModal({
  envio, alunoNome, alunoId, templateNome, onClose,
}: { envio: Envio; alunoNome: string; alunoId: string; templateNome: string; onClose: () => void }) {
  const gerar = useServerFn(gerarRespostaFeedback);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const [r, a] = await Promise.all([
        gerar({ data: { envioId: envio.id } }),
        supabase.from("alunos").select("whatsapp").eq("id", alunoId).maybeSingle(),
      ]);
      setWhatsapp(a.data?.whatsapp ?? null);
      if (r.error) setError(r.error);
      else setMensagem(r.mensagem ?? "");
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const regenerar = async () => {
    setLoading(true); setError(null);
    const r = await gerar({ data: { envioId: envio.id } });
    if (r.error) setError(r.error);
    else setMensagem(r.mensagem ?? "");
    setLoading(false);
  };

  const copiar = async () => {
    await navigator.clipboard.writeText(mensagem);
    toast.success("Mensagem copiada");
  };

  const enviarWhatsApp = () => {
    if (!whatsapp) { toast.error("Aluno sem WhatsApp cadastrado"); return; }
    const fone = whatsapp.replace(/\D/g, "");
    const url = `https://wa.me/${fone}?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const salvarRascunho = async () => {
    setSalvando(true);
    const { error: e } = await supabase.from("mensagens_log").insert({
      aluno_id: alunoId,
      whatsapp_destino: whatsapp,
      mensagem_enviada: mensagem,
      tipo_job: "resposta_feedback",
      status_envio: "enviado",
    });
    setSalvando(false);
    if (e) toast.error(e.message);
    else toast.success("Rascunho salvo no histórico");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 p-4 overflow-y-auto px-safe" onClick={onClose}>
      <div className="w-full max-w-2xl my-8 rounded-lg border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-lg font-semibold">Resposta gerada por IA</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{alunoNome} — {templateNome}</p>
          </div>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Fechar</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando resposta com IA...
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
          ) : (
            <>
              <textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={14}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">Você pode editar a mensagem antes de copiar ou enviar.</p>
            </>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border px-6 py-3 flex-wrap">
          <button
            onClick={regenerar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> Regenerar
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={salvarRascunho}
              disabled={!mensagem || salvando}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar no histórico
            </button>
            <button
              onClick={copiar}
              disabled={!mensagem}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </button>
            <button
              onClick={enviarWhatsApp}
              disabled={!mensagem || !whatsapp}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Enviar via WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PONTOS DE CONTATO ---------------- */
type PontoContato = {
  id: string;
  nome: string;
  descricao: string | null;
  prompt_tipo: PromptTipo;
  gatilho_tipo: string;
  gatilho_valor: number;
  canal: string;
  condicoes: unknown;
  ativo: boolean;
  ultimo_envio_em: string | null;
  total_envios: number;
};

const PROMPT_OPTIONS: { tipo: PromptTipo; label: string }[] = [
  { tipo: "followup_d7", label: "Follow-up D7" },
  { tipo: "followup_d21", label: "Follow-up D21" },
  { tipo: "anamnese", label: "Anamnese" },
  { tipo: "feedback_quinzenal", label: "Feedback Quinzenal" },
  { tipo: "feedback_mensal", label: "Feedback Mensal" },
];

function descreverGatilho(p: PontoContato): string {
  if (p.gatilho_tipo === "dias_apos_entrega") return `${p.gatilho_valor} dias após entrega do plano`;
  if (p.gatilho_tipo === "dias_apos_d0") return `${p.gatilho_valor} dias após D0`;
  if (p.gatilho_tipo === "sem_resposta") return `Após ${p.gatilho_valor} dias sem resposta`;
  if (p.gatilho_tipo === "antes_vencimento") return `${p.gatilho_valor} dias antes do vencimento`;
  return `${p.gatilho_tipo} (${p.gatilho_valor})`;
}

function PontosContatoTab({ canEdit }: { canEdit: boolean }) {
  const [pontos, setPontos] = useState<PontoContato[]>([]);
  const [loading, setLoading] = useState(true);
  const [editFor, setEditFor] = useState<PontoContato | "new" | null>(null);
  const [previewFor, setPreviewFor] = useState<PontoContato | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pontos_contato")
      .select("*")
      .order("criado_em", { ascending: true });
    setPontos((data ?? []) as PontoContato[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const togglePausar = async (p: PontoContato) => {
    const { error } = await supabase.from("pontos_contato").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(!p.ativo ? "Ponto de contato ativado" : "Ponto de contato pausado");
    load();
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground flex-1 min-w-[280px]">
          Configure mensagens automáticas de relacionamento (D7, D21, sem resposta, lembretes). Aqui você define <span className="font-medium text-foreground">quando, para quem e em qual condição</span> a mensagem é enviada. O texto base da IA é configurado na aba <span className="font-medium text-foreground">Prompts IA</span>.
        </div>
        <button
          onClick={() => setEditFor("new")}
          disabled={!canEdit}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Novo ponto de contato
        </button>
      </div>

      {pontos.length === 0 ? (
        <EmptyState icon={Radio} title="Nenhum ponto de contato configurado" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {pontos.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-card p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-semibold text-foreground">{p.nome}</h3>
                <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${p.ativo ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                  {p.ativo ? "Ativo" : "Pausado"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3 min-h-[2.5rem]">
                {p.descricao || "Sem descrição"}
              </p>
              <div className="space-y-1.5 text-xs mb-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Gatilho</span>
                  <span className="font-medium text-foreground text-right">{descreverGatilho(p)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Prompt vinculado</span>
                  <TipoBadge tipo={p.prompt_tipo} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Canal</span>
                  <span className="font-medium text-foreground capitalize">{p.canal}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Último envio</span>
                  <span className="font-medium text-foreground">{p.ultimo_envio_em ? new Date(p.ultimo_envio_em).toLocaleDateString("pt-BR") : "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Total de envios</span>
                  <span className="font-medium text-foreground">{p.total_envios}</span>
                </div>
              </div>
              <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-border mt-auto">
                <button
                  onClick={() => setPreviewFor(p)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-muted"
                >
                  <Eye className="h-3.5 w-3.5" /> Ver prévia
                </button>
                <button
                  onClick={() => setEditFor(p)}
                  disabled={!canEdit}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
                <button
                  onClick={() => togglePausar(p)}
                  disabled={!canEdit}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                >
                  {p.ativo ? <><Pause className="h-3.5 w-3.5" /> Pausar</> : <><Play className="h-3.5 w-3.5" /> Ativar</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editFor && <PontoContatoEditModal ponto={editFor === "new" ? null : editFor} onClose={() => setEditFor(null)} onSaved={() => { setEditFor(null); load(); }} />}
      {previewFor && <PontoContatoPreviewModal ponto={previewFor} onClose={() => setPreviewFor(null)} />}
    </div>
  );
}

function PontoContatoEditModal({ ponto, onClose, onSaved }: { ponto: PontoContato | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !ponto;
  const [nome, setNome] = useState(ponto?.nome ?? "");
  const [descricao, setDescricao] = useState(ponto?.descricao ?? "");
  const [promptTipo, setPromptTipo] = useState<PromptTipo>(ponto?.prompt_tipo ?? "followup_d7");
  const [gatilhoTipo, setGatilhoTipo] = useState(ponto?.gatilho_tipo ?? "dias_apos_entrega");
  const [gatilhoValor, setGatilhoValor] = useState(ponto?.gatilho_valor ?? 7);
  const [canal, setCanal] = useState(ponto?.canal ?? "whatsapp");
  const [condicoes, setCondicoes] = useState(JSON.stringify(ponto?.condicoes ?? {}, null, 2));
  const [ativo, setAtivo] = useState(ponto?.ativo ?? true);
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    if (!nome.trim()) { toast.error("Nome obrigatório"); return; }
    let condParsed: unknown = {};
    try { condParsed = condicoes.trim() ? JSON.parse(condicoes) : {}; }
    catch { toast.error("Condições: JSON inválido"); return; }
    setSaving(true);
    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      prompt_tipo: promptTipo,
      gatilho_tipo: gatilhoTipo,
      gatilho_valor: gatilhoValor,
      canal,
      condicoes: condParsed as never,
      ativo,
    };
    const { error } = isNew
      ? await supabase.from("pontos_contato").insert(payload)
      : await supabase.from("pontos_contato").update(payload).eq("id", ponto!.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "Ponto de contato criado" : "Ponto de contato atualizado");
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 px-safe" onClick={() => !saving && onClose()}>
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold">{isNew ? "Novo ponto de contato" : `Editar — ${ponto!.nome}`}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium mb-1">Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Descrição</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Tipo de gatilho</label>
              <select value={gatilhoTipo} onChange={(e) => setGatilhoTipo(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="dias_apos_entrega">Dias após entrega do plano</option>
                <option value="dias_apos_d0">Dias após D0</option>
                <option value="sem_resposta">Sem resposta há X dias</option>
                <option value="antes_vencimento">Dias antes do vencimento</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Valor (dias)</label>
              <input type="number" value={gatilhoValor} onChange={(e) => setGatilhoValor(parseInt(e.target.value || "0", 10))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Prompt vinculado</label>
              <select value={promptTipo} onChange={(e) => setPromptTipo(e.target.value as PromptTipo)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                {PROMPT_OPTIONS.map((o) => <option key={o.tipo} value={o.tipo}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Canal</label>
              <select value={canal} onChange={(e) => setCanal(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Condições de envio (JSON)</label>
            <textarea value={condicoes} onChange={(e) => setCondicoes(e.target.value)} rows={3} className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs font-mono" placeholder='{}' />
            <p className="text-[11px] text-muted-foreground mt-1">Filtros opcionais — ex: {'{"modalidade":"mpteam"}'}</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            <span>Ativo</span>
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button onClick={onClose} disabled={saving} className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function PontoContatoPreviewModal({ ponto, onClose }: { ponto: PontoContato; onClose: () => void }) {
  const gerar = useServerFn(gerarMensagemPontoContato);
  const [loading, setLoading] = useState(true);
  const [mensagem, setMensagem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [nomeAluno, setNomeAluno] = useState("");

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const r = await gerar({ data: { pontoId: ponto.id } });
      if (r.error) setError(r.error);
      else { setMensagem(r.mensagem ?? ""); setNomeAluno((r as { nomeAluno?: string }).nomeAluno ?? ""); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar");
    } finally { setLoading(false); }
  };

  useEffect(() => { run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ponto.id]);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 px-safe" onClick={onClose}>
      <div className="w-full max-w-xl rounded-lg border border-border bg-card shadow-xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Prévia — {ponto.nome}</h3>
            <p className="text-xs text-muted-foreground mt-1">Aluno exemplo: <span className="font-medium text-foreground">{nomeAluno || "—"}</span></p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando mensagem com IA...
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
          ) : (
            <>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{mensagem}</div>
              <div>
                <p className="text-xs font-medium mb-1.5">Variáveis usadas:</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[11px] px-2 py-1 rounded font-mono bg-primary/15 text-primary border border-primary/30">{`{{nome_aluno}}`}</span>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <button onClick={run} disabled={loading} className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">
            <Sparkles className="h-3.5 w-3.5" /> Gerar nova variação
          </button>
          <button onClick={onClose} className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted">Fechar</button>
        </div>
      </div>
    </div>
  );
}
