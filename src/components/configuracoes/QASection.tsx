import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { CheckCircle2, Circle, Clock, AlertCircle, Search, RefreshCw, ExternalLink, Image as ImageIcon } from "lucide-react";

type Aluno = { id: string; nome: string; whatsapp: string; status: string; criado_em: string };

type FormRow = {
  id: string;
  tipo: string;
  origem: string;
  recebido_em: string;
  respondido: boolean;
  respondido_em: string | null;
  dados_resposta: any;
  token: string;
};

type LogRow = { id: string; tipo_job: string | null; status_envio: string | null; enviado_em: string; mensagem_enviada: string | null };
type EnvioRow = { id: string; template_id: string; status: string; enviado_em: string; respondido_em: string | null; respostas: any };
type MensagemRow = { id: string; mensagem_gerada: string | null; criado_em: string };

interface Estado {
  forms: FormRow[];
  logs: LogRow[];
  envios: EnvioRow[];
  mensagensDieta: MensagemRow[];
  mensagensTreino: MensagemRow[];
}

export function QASection() {
  const { isAdmin, crmUser } = useAuth();
  const canView = isAdmin || crmUser?.perfil === "equipe";

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [busca, setBusca] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [loadingAlunos, setLoadingAlunos] = useState(true);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  useEffect(() => {
    if (!canView) return;
    (async () => {
      setLoadingAlunos(true);
      const { data } = await supabase
        .from("alunos")
        .select("id, nome, whatsapp, status, criado_em")
        .order("criado_em", { ascending: false })
        .limit(200);
      setAlunos(data ?? []);
      setLoadingAlunos(false);
    })();
  }, [canView]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return alunos;
    return alunos.filter((a) => a.nome.toLowerCase().includes(q) || a.whatsapp.includes(q));
  }, [alunos, busca]);

  const loadDetalhe = async (alunoId: string) => {
    setLoadingDetalhe(true);
    const [{ data: forms }, { data: logs }, { data: envios }, { data: mDieta }, { data: mTreino }] = await Promise.all([
      supabase.from("formularios").select("id, tipo, origem, recebido_em, respondido, respondido_em, dados_resposta, token").eq("aluno_id", alunoId).order("recebido_em", { ascending: false }),
      supabase.from("mensagens_log").select("id, tipo_job, status_envio, enviado_em, mensagem_enviada").eq("aluno_id", alunoId).order("enviado_em", { ascending: false }).limit(50),
      supabase.from("feedback_envios").select("id, template_id, status, enviado_em, respondido_em, respostas").eq("aluno_id", alunoId).order("enviado_em", { ascending: false }),
      supabase.from("mensagens_dieta").select("id, mensagem_gerada, criado_em").eq("aluno_id", alunoId).order("criado_em", { ascending: false }),
      supabase.from("mensagens_treino").select("id, mensagem_gerada, criado_em").eq("aluno_id", alunoId).order("criado_em", { ascending: false }),
    ]);
    setEstado({
      forms: (forms ?? []) as FormRow[],
      logs: (logs ?? []) as LogRow[],
      envios: (envios ?? []) as EnvioRow[],
      mensagensDieta: (mDieta ?? []) as MensagemRow[],
      mensagensTreino: (mTreino ?? []) as MensagemRow[],
    });
    setLoadingDetalhe(false);
  };

  useEffect(() => {
    if (selectedId) loadDetalhe(selectedId);
  }, [selectedId]);

  if (!canView) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground mt-2">Apenas administradores ou equipe podem acessar a tela de QA.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-lg font-semibold">QA — Checklist End-to-End</h2>
        <p className="text-sm text-muted-foreground">Acompanhe o ciclo completo por aluno: envio → recebimento → resposta → IA → fotos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        <aside className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar aluno…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-border bg-background"
              />
            </div>
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {loadingAlunos ? (
              <div className="p-4 text-sm text-muted-foreground">Carregando…</div>
            ) : filtrados.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nenhum aluno encontrado.</div>
            ) : (
              filtrados.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-border/60 hover:bg-muted/40 transition-colors ${selectedId === a.id ? "bg-rose-50/60" : ""}`}
                >
                  <div className="text-sm font-medium truncate">{a.nome}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center justify-between mt-0.5">
                    <span className="truncate">{a.whatsapp}</span>
                    <span className="capitalize">{a.status.replace(/_/g, " ")}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section>
          {!selectedId ? (
            <div className="border border-dashed border-border rounded-xl p-12 text-center text-sm text-muted-foreground bg-card">
              Selecione um aluno à esquerda para ver o checklist.
            </div>
          ) : (
            <DetalheAluno
              aluno={alunos.find((a) => a.id === selectedId) ?? null}
              estado={estado}
              loading={loadingDetalhe}
              onRefresh={() => selectedId && loadDetalhe(selectedId)}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function DetalheAluno({ aluno, estado, loading, onRefresh }: { aluno: Aluno | null; estado: Estado | null; loading: boolean; onRefresh: () => void }) {
  if (!aluno) return null;
  if (loading || !estado) {
    return <div className="border border-border rounded-xl p-8 text-sm text-muted-foreground bg-card">Carregando dados do aluno…</div>;
  }

  const formByTipo = (tipo: string) => estado.forms.find((f) => f.tipo === tipo);
  const anamnese = formByTipo("anamnese");
  const fbQuinz = formByTipo("feedback_quinzenal");
  const fbMensal = formByTipo("feedback_mensal");

  const fotos = fbMensal?.dados_resposta?.fotos as Record<string, string> | undefined;
  const temFotos = fotos && Object.values(fotos).some(Boolean);

  const ultimaMsgDieta = estado.mensagensDieta[0];
  const ultimaMsgTreino = estado.mensagensTreino[0];

  const totalEnviosWpp = estado.logs.filter((l) => l.status_envio === "enviado").length;
  const totalErrosWpp = estado.logs.filter((l) => l.status_envio === "erro").length;

  const checks: { label: string; ok: boolean; meta?: string }[] = [
    { label: "Aluno cadastrado", ok: true, meta: aluno.whatsapp },
    { label: "Anamnese enviada", ok: !!anamnese, meta: anamnese ? `recebida em ${fmtDateTime(anamnese.recebido_em)}` : "—" },
    { label: "Anamnese respondida", ok: !!anamnese?.respondido, meta: anamnese?.respondido_em ? fmtDateTime(anamnese.respondido_em) : "aguardando" },
    { label: "Feedback quinzenal recebido", ok: !!fbQuinz?.respondido, meta: fbQuinz?.respondido_em ? fmtDateTime(fbQuinz.respondido_em) : "—" },
    { label: "Feedback mensal recebido", ok: !!fbMensal?.respondido, meta: fbMensal?.respondido_em ? fmtDateTime(fbMensal.respondido_em) : "—" },
    { label: "Fotos anexadas (mensal)", ok: !!temFotos, meta: temFotos ? `${Object.values(fotos!).filter(Boolean).length} de 3 slots` : "nenhuma foto" },
    { label: "WhatsApp — alguma mensagem enviada", ok: totalEnviosWpp > 0, meta: `${totalEnviosWpp} enviadas / ${totalErrosWpp} com erro` },
    { label: "IA — mensagem de dieta gerada", ok: !!ultimaMsgDieta, meta: ultimaMsgDieta ? fmtDateTime(ultimaMsgDieta.criado_em) : "—" },
    { label: "IA — mensagem de treino gerada", ok: !!ultimaMsgTreino, meta: ultimaMsgTreino ? fmtDateTime(ultimaMsgTreino.criado_em) : "—" },
  ];

  const concluidos = checks.filter((c) => c.ok).length;
  const pct = Math.round((concluidos / checks.length) * 100);

  return (
    <div className="space-y-5">
      <div className="border border-border rounded-xl bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold">{aluno.nome}</h3>
            <div className="text-xs text-muted-foreground mt-0.5">{aluno.whatsapp} · status: {aluno.status}</div>
          </div>
          <button onClick={onRefresh} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-muted/40">
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </button>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{concluidos} de {checks.length} etapas concluídas</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h3 className="text-sm font-semibold">Checklist do ciclo</h3>
        </div>
        <ul>
          {checks.map((c, i) => (
            <li key={i} className="flex items-center gap-3 px-5 py-3 border-b border-border/60 last:border-b-0">
              {c.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm">{c.label}</div>
                {c.meta && <div className="text-[11px] text-muted-foreground mt-0.5">{c.meta}</div>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {temFotos && (
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            <h3 className="text-sm font-semibold">Fotos do feedback mensal</h3>
          </div>
          <div className="p-5 grid grid-cols-3 gap-3">
            {(["frente", "costas", "perfil_esquerdo"] as const).map((slot) => (
              <div key={slot} className="space-y-1.5">
                <div className="text-[11px] text-muted-foreground capitalize">{slot.replace("_", " ")}</div>
                {fotos?.[slot] ? (
                  <a href={fotos[slot]} target="_blank" rel="noreferrer" className="block aspect-square rounded-md overflow-hidden border border-border bg-muted">
                    <img src={fotos[slot]} alt={slot} className="w-full h-full object-cover" />
                  </a>
                ) : (
                  <div className="aspect-square rounded-md border border-dashed border-border flex items-center justify-center text-[11px] text-muted-foreground">não enviada</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h3 className="text-sm font-semibold">Formulários ({estado.forms.length})</h3>
        </div>
        {estado.forms.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">Nenhum formulário registrado para este aluno.</div>
        ) : (
          <ul>
            {estado.forms.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-5 py-3 border-b border-border/60 last:border-b-0">
                {f.respondido ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock className="h-4 w-4 text-amber-500" />}
                <div className="flex-1">
                  <div className="text-sm capitalize">{f.tipo.replace(/_/g, " ")}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Recebido: {fmtDateTime(f.recebido_em)}
                    {f.respondido_em && ` · Respondido: ${fmtDateTime(f.respondido_em)}`}
                    {` · origem: ${f.origem}`}
                  </div>
                </div>
                {f.respondido ? (
                  <a href={`/formularios/${f.id}/respostas`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:underline font-medium">
                    ver respostas <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <a href={`/formularios/${f.token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:underline">
                    abrir formulário <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <h3 className="text-sm font-semibold">Mensagens enviadas (WhatsApp) — últimas {estado.logs.length}</h3>
        </div>
        {estado.logs.length === 0 ? (
          <div className="p-5 text-sm text-muted-foreground">Nenhuma mensagem registrada ainda.</div>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {estado.logs.map((l) => (
              <li key={l.id} className="flex items-start gap-3 px-5 py-2.5 border-b border-border/60 last:border-b-0">
                {l.status_envio === "enviado" ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" /> : <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">
                    {fmtDateTime(l.enviado_em)} · <span className="font-medium text-foreground">{l.tipo_job ?? "—"}</span>
                  </div>
                  {l.mensagem_enviada && <div className="text-xs mt-1 line-clamp-2 text-muted-foreground">{l.mensagem_enviada}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold">IA — Dieta ({estado.mensagensDieta.length})</h3>
          </div>
          {ultimaMsgDieta?.mensagem_gerada ? (
            <div className="p-5">
              <div className="text-[11px] text-muted-foreground mb-2">Última geração: {fmtDateTime(ultimaMsgDieta.criado_em)}</div>
              <div className="text-xs whitespace-pre-wrap line-clamp-6 text-muted-foreground">{ultimaMsgDieta.mensagem_gerada}</div>
            </div>
          ) : (
            <div className="p-5 text-sm text-muted-foreground">Nenhuma mensagem gerada.</div>
          )}
        </div>
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <h3 className="text-sm font-semibold">IA — Treino ({estado.mensagensTreino.length})</h3>
          </div>
          {ultimaMsgTreino?.mensagem_gerada ? (
            <div className="p-5">
              <div className="text-[11px] text-muted-foreground mb-2">Última geração: {fmtDateTime(ultimaMsgTreino.criado_em)}</div>
              <div className="text-xs whitespace-pre-wrap line-clamp-6 text-muted-foreground">{ultimaMsgTreino.mensagem_gerada}</div>
            </div>
          ) : (
            <div className="p-5 text-sm text-muted-foreground">Nenhuma mensagem gerada.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function fmtDateTime(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
}