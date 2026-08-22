import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { criarAcessoAluno } from "@/server/aluno-auth.functions";
import {
  MODALIDADE_LABEL, STATUS_LABEL, csvFromRows, downloadCSV,
  diasRestantes, fmtDate, createAnamneseAndIntroJobs, logStatusChange,
  type Aluno, type Modalidade, type Status,
} from "@/lib/crm";
import { ModalidadeTag } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { Plus, Search, Download, CheckCircle2, Phone, MoreVertical, ChevronDown, ArrowLeft, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { usePlanosCatalogo, formatPlanoOption } from "@/lib/planos-catalogo";
import { COUNTRIES, splitPhone, joinPhone } from "@/components/publico/PhoneDdiInput";
import { readCache, writeCache } from "@/lib/swr-cache";

export const Route = createFileRoute("/_app/alunos/")({
  head: () => ({
    meta: [
      { title: "Alunos — MPTEAM" },
      { name: "description", content: "Gerencie a base de alunos da consultoria MPTEAM: cadastro, modalidade, anamnese e acompanhamento." },
    ],
  }),
  component: AlunosPage,
});

const PAGE_SIZE = 25;

function AlunosPage() {
  const { canEdit, canEditAluno, crmUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const cachedRows = readCache<(Aluno & { proximo?: string | null })[]>("alunos-list") ?? [];
  const [rows, setRows] = useState<(Aluno & { proximo?: string | null })[]>(cachedRows);
  const [loading, setLoading] = useState(cachedRows.length === 0);
  const [filterMod, setFilterMod] = useState<"all" | Modalidade>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "ativo" | "vencido" | "vence_7d">("all");
  const [filterRen, setFilterRen] = useState<"all" | "sim" | "nao">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Aluno | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!menuOpenId) return;
    const close = () => setMenuOpenId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpenId]);

  async function excluirAluno(a: Aluno) {
    setDeleting(true);
    const { error } = await supabase.from("alunos").delete().eq("id", a.id);
    setDeleting(false);
    if (error) { alert("Erro ao excluir: " + error.message); return; }
    setConfirmDelete(null);
    await load();
  }

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("alunos-list-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "alunos" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "jobs_disparos" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  async function load() {
    setLoading(true);
    const { data: alunos } = await supabase.from("alunos").select("*").order("nome", { ascending: true });
    const ids = (alunos ?? []).map((a) => a.id);
    let nextMap = new Map<string, string>();
    if (ids.length) {
      const { data: jobs } = await supabase
        .from("jobs_disparos")
        .select("aluno_id, agendado_para")
        .in("aluno_id", ids)
        .eq("executado", false)
        .order("agendado_para", { ascending: true });
      for (const j of jobs ?? []) {
        if (j.aluno_id && !nextMap.has(j.aluno_id)) nextMap.set(j.aluno_id, j.agendado_para);
      }
    }
    setRows((alunos ?? []).map((a) => ({ ...a, proximo: nextMap.get(a.id) ?? null })));
    writeCache("alunos-list", (alunos ?? []).map((a) => ({ ...a, proximo: nextMap.get(a.id) ?? null })));
    setLoading(false);
  }

  const filtered = useMemo(() => {
    return rows.filter((a) => {
      if (filterMod !== "all" && a.modalidade !== filterMod) return false;
      if (filterStatus !== "all") {
        const dr = diasRestantes(a.data_expiracao);
        const isVencido = dr !== null && dr < 0;
        if (filterStatus === "vencido" && !isVencido) return false;
        if (filterStatus === "ativo" && (isVencido || a.status !== "ativo")) return false;
        if (filterStatus === "vence_7d" && (dr === null || dr < 0 || dr > 7 || a.status !== "ativo")) return false;
      }
      if (filterRen === "sim" && !a.renovado) return false;
      if (filterRen === "nao" && a.renovado) return false;
      if (q) {
        const norm = (v: string) =>
          v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const s = norm(q);
        if (!norm(a.nome).includes(s) && !norm(a.whatsapp).includes(s)) return false;
      }
      return true;
    });
  }, [rows, filterMod, filterStatus, filterRen, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  async function confirmarD0(a: Aluno) {
    if (!canEditAluno) return;
    const now = new Date();
    const exp = new Date(now.getTime() + (a.prazo_dias ?? 30) * 24 * 60 * 60 * 1000);
    const { error } = await supabase.from("alunos").update({
      data_d0: now.toISOString(),
      data_expiracao: exp.toISOString(),
      status: "ativo",
    }).eq("id", a.id);
    if (error) { alert(error.message); return; }
    await logStatusChange(a.id, a.status, "ativo", crmUser?.nome ?? crmUser?.email ?? "usuario");
    await load();
  }

  function exportCSV() {
    const headers = ["nome","whatsapp","email","modalidade","plano","valor_plano","status","data_d0","data_expiracao","renovado"];
    const csv = csvFromRows(filtered as any, headers);
    downloadCSV(`alunos-${new Date().toISOString().slice(0,10)}.csv`, csv);
  }

  function exportXLSX() {
    const headers = [
      "Nome","WhatsApp","E-mail","Modalidade","Plano","Valor do plano",
      "Status","Renovado","Início (D0)","Expiração","Dias restantes",
    ];
    const data = filtered.map((a) => {
      const dr = diasRestantes(a.data_expiracao);
      return [
        a.nome,
        a.whatsapp,
        a.email ?? "",
        MODALIDADE_LABEL[a.modalidade as Modalidade] ?? a.modalidade,
        a.plano ?? "",
        Number(a.valor_plano ?? 0),
        STATUS_LABEL[a.status as Status] ?? a.status,
        a.renovado ? "Sim" : "Não",
        a.data_d0 ? fmtDate(a.data_d0) : "",
        a.data_expiracao ? fmtDate(a.data_expiracao) : "",
        dr ?? "",
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws["!cols"] = [
      { wch: 32 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 28 },
      { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alunos");
    XLSX.writeFile(wb, `alunos-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <Link
        to="/visao-geral"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar para Visão geral
      </Link>
      <div className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Alunos</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} {filtered.length === 1 ? "aluno" : "alunos"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={exportCSV} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 sm:px-3 py-2 text-sm hover:bg-card">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">CSV</span>
          </button>
          <button onClick={exportXLSX} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 sm:px-3 py-2 text-sm hover:bg-card" title="Exportar Excel com filtros aplicados">
            <Download className="h-4 w-4" /> <span className="hidden sm:inline">Excel</span>
          </button>
          {canEditAluno && (
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-2.5 sm:px-3 py-2 text-sm font-semibold hover:bg-primary/90">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Adicionar aluno</span><span className="sm:hidden">Novo</span>
            </button>
          )}
        </div>
      </div>

      <div className="md:static sticky top-[52px] md:top-auto z-30 -mx-3 sm:mx-0 px-3 sm:px-0 bg-background/95 backdrop-blur md:bg-transparent md:backdrop-blur-0 py-2 md:py-0 space-y-2 border-b border-border md:border-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Buscar por nome ou WhatsApp"
            value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }}
            className="pl-8 pr-3 py-2 rounded-md bg-card border border-border text-sm w-full sm:w-72"
          />
        </div>
        <div className="flex md:flex-wrap gap-2 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 no-scrollbar">
          {([
            { k: "mod", v: filterMod, set: (v: string) => { setFilterMod(v as typeof filterMod); setPage(0); }, opts: [
              ["all","Todas modalidades"],["mpteam","MPTEAM"],["mp_elite","MP Elite"],["mp_presencial","MP Presencial"],
            ] as [string,string][] },
            { k: "status", v: filterStatus, set: (v: string) => { setFilterStatus(v as typeof filterStatus); setPage(0); }, opts: [
              ["all","Todos status"],["ativo","Ativo"],["vencido","Vencido"],["vence_7d","Vence em 7d"],
            ] as [string,string][] },
            { k: "ren", v: filterRen, set: (v: string) => { setFilterRen(v as typeof filterRen); setPage(0); }, opts: [
              ["all","Renovado: todos"],["sim","Renovado: sim"],["nao","Renovado: não"],
            ] as [string,string][] },
          ]).map((g) => (
            <div key={g.k} className="relative shrink-0">
              <select
                value={g.v}
                onChange={(e) => g.set(e.target.value)}
                className={`appearance-none px-3 py-1.5 pr-7 rounded-full border text-xs font-medium ${
                  g.v !== "all" ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-foreground"
                }`}
              >
                {g.opts.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 opacity-60" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Nenhum aluno.</div>
        ) : visible.map((a) => {
          const dr = diasRestantes(a.data_expiracao);
          const isVencido = dr !== null && dr < 0;
          const statusPill = isVencido
            ? { label: "Vencido", cls: "bg-[hsl(0_84%_60%/0.10)] text-primary border-[hsl(0_84%_60%/0.25)]" }
            : { label: "Ativo", cls: "bg-[hsl(142_76%_45%/0.12)] text-[hsl(142_76%_30%)] border-[hsl(142_76%_45%/0.25)]" };
          const initials = (a.nome.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("") || "?").toUpperCase();
          return (
            <div key={a.id} className="group rounded-2xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all">
              <div className="flex items-center gap-2.5 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3">
                <Link
                  to="/alunos/$id"
                  params={{ id: a.id }}
                  className="flex items-center gap-2.5 sm:gap-4 flex-1 min-w-0"
                >
                  <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-full bg-[hsl(0_84%_60%/0.12)] text-primary flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <h3 className="font-semibold text-[13px] sm:text-base text-foreground uppercase tracking-tight truncate group-hover:text-primary transition-colors">
                        {a.nome}
                      </h3>
                      <span className={`inline-flex items-center text-[10px] sm:text-[11px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full border ${statusPill.cls}`}>
                        {statusPill.label}
                      </span>
                      <span className="hidden sm:inline-flex"><ModalidadeTag m={a.modalidade as any} /></span>
                      {(a as any).origem === "anamnese" && !a.data_d0 && (
                        <span className="hidden sm:inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          Novo · via anamnese
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-muted-foreground flex-wrap">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span>{a.whatsapp}</span>
                      {a.plano && <span className="hidden sm:inline ml-2">• {a.plano}</span>}
                      {a.data_d0 && <span className="hidden sm:inline ml-2">• Início {fmtDate(a.data_d0)}</span>}
                    </div>
                  </div>
                </Link>
                <div className="hidden sm:flex items-center gap-1 shrink-0">
                  {canEditAluno && !a.data_d0 && (
                    <button
                      onClick={() => confirmarD0(a)}
                      title="Confirmar início do plano"
                      className="text-xs inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 hover:border-primary hover:text-primary"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Iniciar plano
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === a.id ? null : a.id); }}
                    title="Mais opções"
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground relative"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpenId === a.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-4 mt-10 z-40 w-44 rounded-md border border-border bg-card shadow-lg py-1"
                    >
                      {isAdmin ? (
                        <button
                          onClick={() => { setMenuOpenId(null); setConfirmDelete(a); }}
                          className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-muted flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" /> Excluir aluno
                        </button>
                      ) : (
                        <div className="px-3 py-2 text-xs text-muted-foreground">Sem ações disponíveis</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Página {page + 1} de {pages}</span>
        <div className="flex gap-2">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-card">Anterior</button>
          <button disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-40 hover:bg-card">Próxima</button>
        </div>
      </div>

      {showAdd && (
        <AddAlunoModal
          onClose={() => setShowAdd(false)}
          onSaved={(id) => {
            setShowAdd(false);
            navigate({ to: "/alunos/$id", params: { id } });
          }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => !deleting && setConfirmDelete(null)}>
          <div className="w-full max-w-md rounded-lg bg-card border border-border p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-600" /> Excluir aluno
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Tem certeza que deseja excluir <strong className="text-foreground">{confirmDelete.nome}</strong>? Esta ação não pode ser desfeita e removerá todos os dados relacionados.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={deleting}
                onClick={() => excluirAluno(confirmDelete)}
                className="rounded-md bg-rose-600 text-white px-3 py-2 text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AddAlunoModal({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const { crmUser } = useAuth();
  const liberarAcesso = useServerFn(criarAcessoAluno);
  const [form, setForm] = useState({
    nome: "", cpf: "", whatsapp: "", email: "", modalidade: "mpteam" as Modalidade,
    plano: "", valor_plano: "", prazo_dias: "30",
    sexo: "", data_nascimento: "", peso_kg: "", altura_cm: "",
    data_d0: "", data_expiracao: "",
  });
  const { planos } = usePlanosCatalogo();
  const [planoCatalogoId, setPlanoCatalogoId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function addDaysISO(dateStr: string, days: number) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function aplicarPlanoDoCatalogo(id: string) {
    setPlanoCatalogoId(id);
    const p = planos.find((x) => x.id === id);
    if (!p) return;
    const baseDate = form.data_d0 || new Date().toISOString().slice(0, 10);
    setForm((f) => ({
      ...f,
      modalidade: p.modalidade,
      plano: p.nome,
      prazo_dias: String(p.duracao_dias),
      data_d0: baseDate,
      data_expiracao: addDaysISO(baseDate, p.duracao_dias),
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    if (!form.plano) { setErr("Selecione um plano."); setBusy(false); return; }

    // Dedupe: bloqueia cadastro se já existe aluno com o mesmo WhatsApp
    // (compara pela forma canônica DDD+8 dígitos via RPC do banco).
    try {
      const { data: existente } = await supabase.rpc("buscar_aluno_por_telefone", {
        _telefone: form.whatsapp,
      });
      const row = Array.isArray(existente) ? existente[0] : existente;
      if (row?.id) {
        setErr(`Já existe um aluno com este WhatsApp: ${row.nome ?? "(sem nome)"}. Abra o perfil existente em /alunos/${row.id}.`);
        setBusy(false);
        return;
      }
    } catch (e) {
      console.warn("Falha ao verificar duplicidade de telefone:", e);
    }

    // Aluno presencial criado por Manu dispensa anamnese (feita no consultório)
    const dispensarAnamnese =
      form.modalidade === "mp_presencial" &&
      (crmUser?.email || "").toLowerCase() === "emanuel.paes@gmail.com";
      
    const { data, error } = await supabase.from("alunos").insert({
      nome: form.nome, cpf: form.cpf || null, whatsapp: form.whatsapp, email: form.email || null,
      modalidade: form.modalidade, plano: form.plano,
      valor_plano: form.valor_plano ? Number(form.valor_plano) : null,
      prazo_dias: form.prazo_dias ? Number(form.prazo_dias) : 30,
      sexo: form.sexo || null,
      data_nascimento: form.data_nascimento || null,
      peso_kg: form.peso_kg ? Number(form.peso_kg) : null,
      altura_cm: form.altura_cm ? Number(form.altura_cm) : null,
      status: dispensarAnamnese ? "em_producao" : "aguardando_anamnese",
      data_compra: new Date().toISOString(),
      data_d0: form.data_d0 || null,
      data_expiracao: form.data_expiracao || null,
    }).select("id").single();

    if (error || !data) {
      // Mensagem amigável quando bate no índice único do WhatsApp
      const msg = error?.message ?? "Erro";
      const friendly = msg.includes("alunos_whatsapp_canonico_uniq")
        ? "Já existe um aluno cadastrado com este WhatsApp."
        : msg;
      setErr(friendly); setBusy(false); return;
    }
    try {
      if (!dispensarAnamnese) {
        await createAnamneseAndIntroJobs(data.id);
      }
      // Libera automaticamente o acesso ao app do aluno (senha inicial = WhatsApp)
      try {
        await liberarAcesso({ data: { aluno_id: data.id } });
      } catch (e) {
        console.warn("Falha ao liberar acesso do aluno:", e);
      }
      onSaved(data.id);
    } catch (e) {
      setErr((e as Error).message); setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center sm:p-4 z-50 px-safe" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-lg bg-card border border-border max-h-[92vh] sm:max-h-[90vh] flex flex-col"
      >
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 flex items-center justify-between border-b border-border sm:border-0">
          <h2 className="text-base sm:text-lg font-semibold">Adicionar aluno</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nome *"><input required value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} className="input" /></Field>
          <Field label="CPF"><input value={form.cpf} onChange={(e) => setForm({...form, cpf: e.target.value})} placeholder="000.000.000-00" className="input" /></Field>
          <Field label="WhatsApp *">
            <PhoneInlineInput
              value={form.whatsapp}
              onChange={(v) => setForm({ ...form, whatsapp: v })}
            />
          </Field>
          <Field label="E-mail"><input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="input" /></Field>
          <div className="col-span-2 space-y-3">
            <Field label="Plano *">
              <select
                required
                value={planoCatalogoId}
                onChange={(e) => aplicarPlanoDoCatalogo(e.target.value)}
                className="input"
              >
                <option value="">Selecione um plano…</option>
                {(["mpteam", "mp_elite", "mp_presencial"] as Modalidade[]).map((m) => {
                  const lista = planos.filter((p) => p.modalidade === m);
                  if (!lista.length) return null;
                  const label = m === "mpteam" ? "MPTEAM" : m === "mp_elite" ? "MP Elite" : "MP Presencial";
                  return (
                    <optgroup key={m} label={label}>
                      {lista.map((p) => (
                        <option key={p.id} value={p.id}>{formatPlanoOption(p)}</option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Data de início">
                <input
                  type="date"
                  value={form.data_d0}
                  onChange={(e) => {
                    const novaData = e.target.value;
                    setForm({
                      ...form,
                      data_d0: novaData,
                      data_expiracao: novaData && form.prazo_dias
                        ? addDaysISO(novaData, Number(form.prazo_dias))
                        : form.data_expiracao,
                    });
                  }}
                  className="input"
                />
              </Field>
              <Field label="Vencimento">
                <input
                  type="date"
                  value={form.data_expiracao}
                  onChange={(e) => setForm({ ...form, data_expiracao: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Valor manual (R$)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor_plano}
                  onChange={(e) => setForm({ ...form, valor_plano: e.target.value })}
                  className="input"
                  placeholder="0,00"
                />
              </Field>
              <Field label="Status inicial">
                <select 
                  className="input"
                  value={form.modalidade === "mp_presencial" && (crmUser?.email || "").toLowerCase() === "emanuel.paes@gmail.com" ? "em_producao" : "aguardando_anamnese"}
                  disabled
                >
                  <option value="aguardando_anamnese">Aguardando Anamnese</option>
                  <option value="em_producao">Em Produção (Presencial)</option>
                </select>
              </Field>
            </div>
          </div>
          <Field label="Sexo">
            <select value={form.sexo} onChange={(e) => setForm({...form, sexo: e.target.value})} className="input">
              <option value="">—</option>
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
              <option value="outro">Outro</option>
            </select>
          </Field>
          <Field label="Data de nascimento">
            <input type="date" value={form.data_nascimento} onChange={(e) => setForm({...form, data_nascimento: e.target.value})} className="input" />
          </Field>
          <Field label="Peso (kg)"><input type="number" step="0.1" value={form.peso_kg} onChange={(e) => setForm({...form, peso_kg: e.target.value})} className="input" /></Field>
          <Field label="Altura (cm)"><input type="number" step="0.1" value={form.altura_cm} onChange={(e) => setForm({...form, altura_cm: e.target.value})} className="input" /></Field>
        </div>
        {err && <p className="text-sm text-primary">{err}</p>}
        </div>
        <div className="flex gap-2 px-4 sm:px-6 py-3 border-t border-border bg-card sticky bottom-0 pb-safe-plus-3">
          <button type="button" onClick={onClose} className="flex-1 sm:flex-none rounded-md border border-border px-4 py-2.5 text-sm">Cancelar</button>
          <button type="submit" disabled={busy} className="flex-1 sm:flex-none rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            {busy ? "Salvando..." : "Salvar"}
          </button>
        </div>
        <style>{`.input{width:100%;background:var(--background);border:1px solid var(--input);padding:.625rem .75rem;border-radius:.375rem;font-size:.875rem;color:var(--foreground);min-height:2.5rem}`}</style>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function PhoneInlineInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const split = useMemo(() => splitPhone(value), [value]);
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selecionado = useMemo(
    () => COUNTRIES.find((c) => c.code === split.ddi) ?? COUNTRIES[0],
    [split.ddi],
  );
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.includes(q.replace(/\D/g, "")),
    );
  }, [busca]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="flex items-stretch gap-2">
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="h-full flex items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-sm min-h-10 whitespace-nowrap"
        >
          <span className="text-base leading-none">{selecionado.flag}</span>
          <span className="font-semibold">+{selecionado.code}</span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 left-0 w-64 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
            <div className="p-2 border-b border-border">
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar país ou código"
                className="w-full bg-muted rounded px-2 py-1.5 text-sm outline-none"
              />
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filtrados.length === 0 ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">Nenhum país encontrado</div>
              ) : (
                filtrados.map((c) => (
                  <button
                    type="button"
                    key={`${c.name}-${c.code}`}
                    onClick={() => {
                      onChange(joinPhone(c.code, split.numero));
                      setOpen(false);
                      setBusca("");
                    }}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-accent text-sm"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="font-semibold">+{c.code}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      <input
        required
        type="tel"
        inputMode="numeric"
        value={split.numero}
        onChange={(e) => onChange(joinPhone(split.ddi, e.target.value.replace(/\D/g, "")))}
        placeholder="81999999999"
        className="input flex-1"
      />
    </div>
  );
}