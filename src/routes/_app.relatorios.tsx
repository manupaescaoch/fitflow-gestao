import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { RefreshCcw, Download, Eye, Copy, ExternalLink, CheckCircle2, KeyRound, Search } from "lucide-react";
import { IndicadorCards } from "@/components/relatorios/IndicadorCards";
import { AlertaSignFalha } from "@/components/relatorios/AlertaSignFalha";
import { exportToCsv } from "@/lib/csv-export";
import {
  getIndicadores, listMensagens, listHistoricoStatus, listRenovacoes,
  listFeedbacks, marcarFeedbackAnalisado, marcarRenovado,
} from "@/server/relatorios.functions";
import { listSystemLogs, marcarLogResolvido, contarAlertasSign } from "@/server/system-logs.functions";
import { listPhotoAudit, reassinarUrl, marcarFotoResolvida, varrerFotosFormularios } from "@/server/photo-audit.functions";
import { listarConfirmacoes, type ConfirmacaoRow } from "@/server/entregas.functions";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/relatorios")({
  component: RelatoriosGuard,
});

function RelatoriosGuard() {
  const { isAdmin, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !isAdmin) nav({ to: "/visao-geral" });
  }, [loading, isAdmin, nav]);
  if (loading || !isAdmin) return null;
  return <RelatoriosPage />;
}

function defaultRange() {
  const to = new Date();
  const from = new Date(Date.now() - 30 * 86400_000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString("pt-BR"); } catch { return s; }
}

function StatusBadge({ value }: { value: string }) {
  const map: Record<string, { label: string; className: string }> = {
    enviado: { label: "Enviada", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    sucesso: { label: "Enviada", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    erro: { label: "Falhou", className: "bg-red-100 text-red-700 border-red-200" },
    pendente: { label: "Pendente", className: "bg-amber-100 text-amber-700 border-amber-200" },
  };
  const v = map[value] || { label: value || "—", className: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
}

function RenewalBadge({ value }: { value: string }) {
  const map: Record<string, { label: string; className: string }> = {
    em_dia: { label: "Em dia", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    proximo_vencimento: { label: "Próx. vencimento", className: "bg-amber-100 text-amber-700 border-amber-200" },
    vence_hoje: { label: "Vence hoje", className: "bg-amber-200 text-amber-900 border-amber-300" },
    vencido: { label: "Vencido", className: "bg-red-100 text-red-700 border-red-200" },
    renovado: { label: "Renovado", className: "bg-blue-100 text-blue-700 border-blue-200" },
    cancelado: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
    indefinido: { label: "—", className: "bg-muted text-muted-foreground" },
  };
  const v = map[value] || { label: value, className: "bg-muted text-muted-foreground" };
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
}

function SeverityBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    info: "bg-blue-100 text-blue-700 border-blue-200",
    warning: "bg-amber-100 text-amber-700 border-amber-200",
    error: "bg-red-100 text-red-700 border-red-200",
    critical: "bg-red-200 text-red-900 border-red-300",
  };
  return <Badge variant="outline" className={map[value] || "bg-muted text-muted-foreground"}>{value}</Badge>;
}

function UrlStatusBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    ativa: "bg-emerald-100 text-emerald-700 border-emerald-200",
    expirada: "bg-amber-100 text-amber-700 border-amber-200",
    sem_assinatura: "bg-amber-100 text-amber-700 border-amber-200",
    rejeitada: "bg-red-100 text-red-700 border-red-200",
    erro_403: "bg-red-100 text-red-700 border-red-200",
    erro_404: "bg-red-100 text-red-700 border-red-200",
    invalida: "bg-red-100 text-red-700 border-red-200",
    pendente: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={map[value] || "bg-muted text-muted-foreground"}>{value}</Badge>;
}

function copy(s: string) {
  if (!s) return;
  navigator.clipboard.writeText(s).then(() => toast.success("Copiado")).catch(() => toast.error("Falha ao copiar"));
}

function EmptyRow({ cols, msg }: { cols: number; msg?: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="text-center text-sm text-muted-foreground py-8">
        {msg || "Nenhum registro encontrado para o período selecionado."}
      </TableCell>
    </TableRow>
  );
}

function RelatoriosPage() {
  const [range, setRange] = useState(defaultRange());
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("mensagens");
  const [indicadores, setIndicadores] = useState<any | null>(null);
  const [alertas, setAlertas] = useState<{ signFails: number; photoIssues: number }>({ signFails: 0, photoIssues: 0 });
  const [loadingInd, setLoadingInd] = useState(false);

  const fnInd = useServerFn(getIndicadores);
  const fnAlertas = useServerFn(contarAlertasSign);

  const fromIso = `${range.from}T00:00:00.000Z`;
  const toIso = `${range.to}T23:59:59.999Z`;

  const refreshIndicadores = useCallback(async () => {
    setLoadingInd(true);
    try {
      const [ind, al] = await Promise.all([
        fnInd({ data: { from: fromIso, to: toIso } }),
        fnAlertas(),
      ]);
      setIndicadores(ind);
      setAlertas(al);
    } catch (e: any) {
      toast.error("Erro ao carregar indicadores: " + (e?.message ?? "desconhecido"));
    } finally {
      setLoadingInd(false);
    }
  }, [fnInd, fnAlertas, fromIso, toIso]);

  useEffect(() => { refreshIndicadores(); }, [refreshIndicadores]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Auditoria completa de mensagens, status, renovações, feedbacks e arquivos do sistema.</p>
      </div>

      <AlertaSignFalha signFails={alertas.signFails} photoIssues={alertas.photoIssues} onClick={() => setTab("fotos")} />

      <Card>
        <CardContent className="p-3 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Período:</span>
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="h-9 w-36" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="h-9 w-36" />
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input placeholder="Buscar por nome do aluno…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
          </div>
          <Button variant="outline" size="sm" onClick={refreshIndicadores}>
            <RefreshCcw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        </CardContent>
      </Card>

      <IndicadorCards data={indicadores} loading={loadingInd} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
          <TabsTrigger value="status">Histórico de status</TabsTrigger>
          <TabsTrigger value="renovacoes">Renovações</TabsTrigger>
          <TabsTrigger value="feedbacks">Feedbacks</TabsTrigger>
          <TabsTrigger value="entregas">Entregas</TabsTrigger>
          <TabsTrigger value="fotos">Auditoria de fotos</TabsTrigger>
          <TabsTrigger value="logs">Logs do sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="mensagens"><TabMensagens fromIso={fromIso} toIso={toIso} search={search} /></TabsContent>
        <TabsContent value="status"><TabHistoricoStatus fromIso={fromIso} toIso={toIso} search={search} /></TabsContent>
        <TabsContent value="renovacoes"><TabRenovacoes search={search} onChanged={refreshIndicadores} /></TabsContent>
        <TabsContent value="feedbacks"><TabFeedbacks fromIso={fromIso} toIso={toIso} search={search} onChanged={refreshIndicadores} /></TabsContent>
        <TabsContent value="entregas"><TabEntregas fromIso={fromIso} toIso={toIso} search={search} /></TabsContent>
        <TabsContent value="fotos"><TabAuditoriaFotos fromIso={fromIso} toIso={toIso} search={search} onChanged={refreshIndicadores} /></TabsContent>
        <TabsContent value="logs"><TabLogs fromIso={fromIso} toIso={toIso} onChanged={refreshIndicadores} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* =================== ABA: MENSAGENS =================== */
function TabMensagens({ fromIso, toIso, search }: { fromIso: string; toIso: string; search: string }) {
  const fn = useServerFn(listMensagens);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusF, setStatusF] = useState<string>("all");
  const [onlyErr, setOnlyErr] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fn({ data: { from: fromIso, to: toIso, search, status: statusF === "all" ? undefined : statusF, onlyErrors: onlyErr } });
      setRows(r.rows || []);
    } finally { setLoading(false); }
  }, [fn, fromIso, toIso, search, statusF, onlyErr]);
  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="sucesso">Enviada</SelectItem>
              <SelectItem value="enviado">Enviada</SelectItem>
              <SelectItem value="erro">Falhou</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>
          <Button variant={onlyErr ? "default" : "outline"} size="sm" onClick={() => setOnlyErr((v) => !v)}>
            Ver apenas problemas
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="h-4 w-4 mr-1" /> Atualizar</Button>
          <Button variant="outline" size="sm" onClick={() => exportToCsv("mensagens.csv", rows)}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Conteúdo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <EmptyRow cols={7} msg="Carregando…" /> :
                rows.length === 0 ? <EmptyRow cols={7} /> :
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs">{fmtDate(r.enviado_em)}</TableCell>
                    <TableCell>{r.aluno_nome}</TableCell>
                    <TableCell><Badge variant="outline">{r.tipo_job || "—"}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{r.mensagem_enviada}</TableCell>
                    <TableCell><StatusBadge value={r.status_envio} /></TableCell>
                    <TableCell className="text-xs text-destructive max-w-xs truncate">{r.erro_detalhe || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setDetail(r)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => copy(r.mensagem_enviada || "")}><Copy className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes da mensagem</DialogTitle>
              <DialogDescription>{detail && fmtDate(detail.enviado_em)}</DialogDescription>
            </DialogHeader>
            {detail && (
              <div className="space-y-2 text-sm">
                <div><strong>Aluno:</strong> {detail.aluno_nome}</div>
                <div><strong>WhatsApp:</strong> {detail.whatsapp_destino}</div>
                <div><strong>Tipo:</strong> {detail.tipo_job}</div>
                <div><strong>Status:</strong> <StatusBadge value={detail.status_envio} /></div>
                {detail.erro_detalhe && <div className="text-destructive"><strong>Erro:</strong> {detail.erro_detalhe}</div>}
                <div className="bg-muted p-3 rounded text-xs whitespace-pre-wrap">{detail.mensagem_enviada}</div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* =================== ABA: HISTÓRICO STATUS =================== */
function TabHistoricoStatus({ fromIso, toIso, search }: { fromIso: string; toIso: string; search: string }) {
  const fn = useServerFn(listHistoricoStatus);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fn({ data: { from: fromIso, to: toIso, search } }); setRows(r.rows || []); }
    finally { setLoading(false); }
  }, [fn, fromIso, toIso, search]);
  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="h-4 w-4 mr-1" /> Atualizar</Button>
          <Button variant="outline" size="sm" onClick={() => exportToCsv("historico_status.csv", rows)}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Aluno</TableHead>
              <TableHead>De</TableHead><TableHead>Para</TableHead>
              <TableHead>Alterado por</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <EmptyRow cols={6} msg="Carregando…" /> :
                rows.length === 0 ? <EmptyRow cols={6} /> :
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.criado_em)}</TableCell>
                    <TableCell>{r.aluno_nome}</TableCell>
                    <TableCell><Badge variant="outline">{r.status_de || "—"}</Badge></TableCell>
                    <TableCell><Badge>{r.status_para || "—"}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.alterado_por || "sistema"}</TableCell>
                    <TableCell className="text-right">
                      {r.aluno_id && <Link to="/alunos/$id" params={{ id: r.aluno_id }}><Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button></Link>}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* =================== ABA: RENOVAÇÕES =================== */
function TabRenovacoes({ search, onChanged }: { search: string; onChanged: () => void }) {
  const fn = useServerFn(listRenovacoes);
  const fnRenovar = useServerFn(marcarRenovado);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusF, setStatusF] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fn({ data: { search, status: statusF === "all" ? undefined : statusF } }); setRows(r.rows || []); }
    finally { setLoading(false); }
  }, [fn, search, statusF]);
  useEffect(() => { load(); }, [load]);

  const handleRenovar = async (id: string) => {
    const r = await fnRenovar({ data: { alunoId: id } });
    if (r.ok) { toast.success("Marcado como renovado"); load(); onChanged(); }
    else toast.error(r.error || "Erro");
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="em_dia">Em dia</SelectItem>
              <SelectItem value="proximo_vencimento">Próx. vencimento</SelectItem>
              <SelectItem value="vence_hoje">Vence hoje</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="renovado">Renovado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="h-4 w-4 mr-1" /> Atualizar</Button>
          <Button variant="outline" size="sm" onClick={() => exportToCsv("renovacoes.csv", rows)}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Aluno</TableHead><TableHead>Plano</TableHead>
              <TableHead>Início</TableHead><TableHead>Vencimento</TableHead>
              <TableHead>Dias</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <EmptyRow cols={7} msg="Carregando…" /> :
                rows.length === 0 ? <EmptyRow cols={7} /> :
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.nome}</TableCell>
                    <TableCell>{r.plano || "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{r.data_d0 ? new Date(r.data_d0).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{r.data_expiracao ? new Date(r.data_expiracao).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell>{r.dias_restantes ?? "—"}</TableCell>
                    <TableCell><RenewalBadge value={r.renewal_status} /></TableCell>
                    <TableCell className="text-right space-x-1">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">Marcar renovado</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar renovação</AlertDialogTitle>
                            <AlertDialogDescription>Marcar {r.nome} como renovado e estender vencimento por {r.prazo_dias ?? 30} dias?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRenovar(r.id)}>Confirmar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Link to="/alunos/$id" params={{ id: r.id }}><Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button></Link>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* =================== ABA: FEEDBACKS =================== */
function TabFeedbacks({ fromIso, toIso, search, onChanged }: { fromIso: string; toIso: string; search: string; onChanged: () => void }) {
  const fn = useServerFn(listFeedbacks);
  const fnMarcar = useServerFn(marcarFeedbackAnalisado);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState("all");
  const [status, setStatus] = useState("respondidos");

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fn({ data: { from: fromIso, to: toIso, search, tipo: tipo === "all" ? undefined : tipo, status } }); setRows(r.rows || []); }
    finally { setLoading(false); }
  }, [fn, fromIso, toIso, search, tipo, status]);
  useEffect(() => { load(); }, [load]);

  const handleMarcar = async (id: string) => {
    const r = await fnMarcar({ data: { id } });
    if (r.ok) { toast.success("Marcado como analisado"); load(); onChanged(); }
    else toast.error(r.error || "Erro");
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="respondidos">Respondidos</SelectItem>
              <SelectItem value="pendentes">Pendentes (≤14d)</SelectItem>
              <SelectItem value="expirados">Expirados (sem resposta)</SelectItem>
              <SelectItem value="erro_foto">Com erro técnico (fotos)</SelectItem>
              <SelectItem value="todos">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="anamnese">Anamnese inicial</SelectItem>
              <SelectItem value="feedback_quinzenal">Feedback quinzenal</SelectItem>
              <SelectItem value="feedback_mensal">Feedback mensal</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="h-4 w-4 mr-1" /> Atualizar</Button>
          <Button variant="outline" size="sm" onClick={() => exportToCsv("feedbacks.csv", rows)}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Aluno</TableHead>
              <TableHead>Tipo</TableHead><TableHead>Situação</TableHead><TableHead>Análise</TableHead>
              <TableHead>Por</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <EmptyRow cols={7} msg="Carregando…" /> :
                rows.length === 0 ? <EmptyRow cols={7} /> :
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.data_evento || r.respondido_em || r.criado_em)}</TableCell>
                    <TableCell>{r.aluno_nome}</TableCell>
                    <TableCell><Badge variant="outline">{r.tipo}</Badge></TableCell>
                    <TableCell>
                      {r.situacao === "respondido" && <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Respondido</Badge>}
                      {r.situacao === "pendente" && <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Pendente</Badge>}
                      {r.situacao === "expirado" && <Badge variant="outline" className="bg-zinc-200 text-zinc-700 border-zinc-300">Expirado</Badge>}
                      {r.situacao === "erro_foto" && <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Erro fotos ({r.erros_foto})</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={r.confirmado_equipe ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                        {r.confirmado_equipe ? "Respondido" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.confirmado_por || "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Link to="/formularios/$id/respostas" params={{ id: r.id }}><Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button></Link>
                      {r.aluno_id && <Link to="/alunos/$id" params={{ id: r.aluno_id }}><Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button></Link>}
                      {!r.confirmado_equipe && (
                        <Button variant="outline" size="sm" onClick={() => handleMarcar(r.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* =================== ABA: AUDITORIA DE FOTOS =================== */
function TabAuditoriaFotos({ fromIso, toIso, search, onChanged }: { fromIso: string; toIso: string; search: string; onChanged: () => void }) {
  const fnList = useServerFn(listPhotoAudit);
  const fnRe = useServerFn(reassinarUrl);
  const fnResolve = useServerFn(marcarFotoResolvida);
  const fnVarrer = useServerFn(varrerFotosFormularios);
  const [rows, setRows] = useState<any[]>([]);
  const [cards, setCards] = useState({ ativas: 0, expiradas: 0, rejeitadas: 0, sem_assinatura: 0, alunos_resign: 0 });
  const [loading, setLoading] = useState(false);
  const [onlyErr, setOnlyErr] = useState(false);
  const [onlyResign, setOnlyResign] = useState(false);
  const [statusF, setStatusF] = useState("all");
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fnList({ data: {
        from: fromIso, to: toIso, search, onlyErrors: onlyErr, onlyResign,
        urlStatus: statusF === "all" ? undefined : statusF,
      }});
      setRows(r.rows || []);
      setCards(r.cards);
    } finally { setLoading(false); }
  }, [fnList, fromIso, toIso, search, onlyErr, onlyResign, statusF]);
  useEffect(() => { load(); }, [load]);

  const handleRe = async (id: string) => {
    const r = await fnRe({ data: { logId: id } });
    if (r.ok) { toast.success("URL reassinada"); load(); onChanged(); }
    else toast.error(r.error || "Falha");
  };
  const handleResolve = async (id: string) => {
    const r = await fnResolve({ data: { id } });
    if (r.ok) { toast.success("Marcado como resolvido"); load(); onChanged(); }
    else toast.error(r.error || "Erro");
  };
  const handleVarrer = async () => {
    toast.info("Varrendo formulários…");
    const r = await fnVarrer({ data: { dias: 90 } });
    if (r.error) toast.error(r.error);
    else { toast.success(`${r.processed} fotos processadas`); load(); onChanged(); }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            ["URLs ativas", cards.ativas, "text-emerald-600"],
            ["Expiradas", cards.expiradas, "text-amber-600"],
            ["Rejeitadas", cards.rejeitadas, "text-destructive"],
            ["Sem assinatura", cards.sem_assinatura, "text-amber-600"],
            ["Alunos p/ re-sign", cards.alunos_resign, "text-amber-600"],
          ].map(([label, v, tone]) => (
            <Card key={label as string}><CardContent className="p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className={`text-xl font-semibold ${tone}`}>{v as number}</div>
            </CardContent></Card>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Status URL" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativa">Ativa</SelectItem>
              <SelectItem value="expirada">Expirada</SelectItem>
              <SelectItem value="sem_assinatura">Sem assinatura</SelectItem>
              <SelectItem value="rejeitada">Rejeitada</SelectItem>
              <SelectItem value="erro_403">Erro 403</SelectItem>
              <SelectItem value="erro_404">Erro 404</SelectItem>
              <SelectItem value="invalida">Inválida</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>
          <Button variant={onlyErr ? "default" : "outline"} size="sm" onClick={() => setOnlyErr((v) => !v)}>Apenas com erro</Button>
          <Button variant={onlyResign ? "default" : "outline"} size="sm" onClick={() => setOnlyResign((v) => !v)}>Precisa re-sign</Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={handleVarrer}><RefreshCcw className="h-4 w-4 mr-1" /> Varrer formulários</Button>
          <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="h-4 w-4 mr-1" /> Atualizar</Button>
          <Button variant="outline" size="sm" onClick={() => exportToCsv("auditoria_fotos.csv", rows)}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Aluno</TableHead>
              <TableHead>Tipo</TableHead><TableHead>Origem</TableHead>
              <TableHead>Status</TableHead><TableHead>Motivo</TableHead>
              <TableHead>Re-sign?</TableHead><TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <EmptyRow cols={8} msg="Carregando…" /> :
                rows.length === 0 ? <EmptyRow cols={8} msg="Nenhuma foto auditada. Clique em 'Varrer formulários' para começar." /> :
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                    <TableCell>{r.aluno_nome || "—"}</TableCell>
                    <TableCell className="text-xs">{r.photo_type || "—"}</TableCell>
                    <TableCell className="text-xs">{r.source || "—"}</TableCell>
                    <TableCell><UrlStatusBadge value={r.url_status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{r.error_reason || "—"}</TableCell>
                    <TableCell>{r.needs_resign ? <Badge variant="destructive">Sim</Badge> : <Badge variant="outline">Não</Badge>}</TableCell>
                    <TableCell className="text-right space-x-1">
                      {(r.signed_url || r.original_url) && (
                        <Button variant="ghost" size="icon" onClick={() => setPreview({ url: r.signed_url || r.original_url, name: r.photo_type || "foto" })}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => copy(r.original_url || "")}><Copy className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm"><KeyRound className="h-4 w-4 mr-1" /> Reassinar</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reassinar URL</AlertDialogTitle>
                            <AlertDialogDescription>Tentar gerar nova URL assinada para esta foto?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRe(r.id)}>Confirmar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {!r.resolved && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">Resolver</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Marcar como resolvido?</AlertDialogTitle>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleResolve(r.id)}>Confirmar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {r.aluno_id && <Link to="/alunos/$id" params={{ id: r.aluno_id }}><Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button></Link>}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>{preview?.name}</DialogTitle></DialogHeader>
            {preview && <img src={preview.url} alt={preview.name} className="max-h-[70vh] w-auto mx-auto rounded" />}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* =================== ABA: LOGS DO SISTEMA =================== */
function TabLogs({ fromIso, toIso, onChanged }: { fromIso: string; toIso: string; onChanged: () => void }) {
  const fnList = useServerFn(listSystemLogs);
  const fnResolve = useServerFn(marcarLogResolvido);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sev, setSev] = useState("all");
  const [onlyUnresolved, setOnlyUnresolved] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fnList({ data: { from: fromIso, to: toIso, severity: sev === "all" ? undefined : sev, onlyUnresolved } });
      setRows(r.rows || []);
    } finally { setLoading(false); }
  }, [fnList, fromIso, toIso, sev, onlyUnresolved]);
  useEffect(() => { load(); }, [load]);

  const handleResolve = async (id: string) => {
    const r = await fnResolve({ data: { id } });
    if (r.ok) { toast.success("Marcado como resolvido"); load(); onChanged(); }
    else toast.error(r.error || "Erro");
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={sev} onValueChange={setSev}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Severidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Button variant={onlyUnresolved ? "default" : "outline"} size="sm" onClick={() => setOnlyUnresolved((v) => !v)}>Ver apenas problemas</Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="h-4 w-4 mr-1" /> Atualizar</Button>
          <Button variant="outline" size="sm" onClick={() => exportToCsv("system_logs.csv", rows)}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Evento</TableHead>
              <TableHead>Módulo</TableHead><TableHead>Severidade</TableHead>
              <TableHead>Descrição</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <EmptyRow cols={7} msg="Carregando…" /> :
                rows.length === 0 ? <EmptyRow cols={7} /> :
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                    <TableCell className="text-xs">{r.event_type}</TableCell>
                    <TableCell className="text-xs">{r.module || "—"}</TableCell>
                    <TableCell><SeverityBadge value={r.severity} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{r.description || r.error_message || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={r.resolved ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}>
                        {r.resolved ? "Resolvido" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => setDetail(r)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => copy(r.error_message || r.description || "")}><Copy className="h-4 w-4" /></Button>
                      {!r.resolved && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">Resolver</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Marcar como resolvido?</AlertDialogTitle>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleResolve(r.id)}>Confirmar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Detalhes técnicos</DialogTitle></DialogHeader>
            {detail && (
              <div className="space-y-2 text-xs">
                <div><strong>Evento:</strong> {detail.event_type}</div>
                <div><strong>Severidade:</strong> {detail.severity}</div>
                <div><strong>Quando:</strong> {fmtDate(detail.created_at)}</div>
                {detail.error_message && <div className="text-destructive"><strong>Erro:</strong> {detail.error_message}</div>}
                {detail.payload_summary && (
                  <pre className="bg-muted p-3 rounded overflow-x-auto">{JSON.stringify(detail.payload_summary, null, 2)}</pre>
                )}
                {detail.stack_trace && (
                  <pre className="bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">{detail.stack_trace}</pre>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* =================== ABA: ENTREGAS (quem confirmou) =================== */
function TabEntregas({ fromIso, toIso, search }: { fromIso: string; toIso: string; search: string }) {
  const fn = useServerFn(listarConfirmacoes);
  const [rows, setRows] = useState<ConfirmacaoRow[]>([]);
  const [usuarios, setUsuarios] = useState<{ nome: string; total: number }[]>([]);
  const [tipoF, setTipoF] = useState<string>("all");
  const [usuarioF, setUsuarioF] = useState<string>("__all__");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fn({ data: { from: fromIso, to: toIso, search, porUsuario: usuarioF } });
      setRows(r.rows);
      setUsuarios(r.usuarios);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? "desconhecido"));
    } finally { setLoading(false); }
  }, [fn, fromIso, toIso, search, usuarioF]);
  useEffect(() => { load(); }, [load]);

  const filtered = tipoF === "all" ? rows : rows.filter((r) => r.tipo === tipoF);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={tipoF} onValueChange={setTipoF}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              <SelectItem value="dieta">Dieta</SelectItem>
              <SelectItem value="treino">Treino</SelectItem>
              <SelectItem value="d0">D0</SelectItem>
            </SelectContent>
          </Select>
          <Select value={usuarioF} onValueChange={setUsuarioF}>
            <SelectTrigger className="h-9 w-52"><SelectValue placeholder="Usuário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os usuários</SelectItem>
              {usuarios.map((u) => (
                <SelectItem key={u.nome} value={u.nome}>{u.nome} ({u.total})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="h-4 w-4 mr-1" /> Atualizar</Button>
          <Button variant="outline" size="sm" onClick={() => exportToCsv("entregas-confirmadas.csv", filtered)}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>

        {usuarios.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-muted-foreground">Confirmações no período: <strong className="text-foreground">{rows.length}</strong> ·</span>
            {usuarios.slice(0, 8).map((u) => (
              <Badge key={u.nome} variant="outline">{u.nome}: {u.total}</Badge>
            ))}
          </div>
        )}

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Confirmado em</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Confirmado por</TableHead>
                <TableHead>Data ref.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <EmptyRow cols={5} msg="Carregando…" /> :
                filtered.length === 0 ? <EmptyRow cols={5} /> :
                filtered.map((r) => (
                  <TableRow key={`${r.entrega_id}-${r.tipo}`}>
                    <TableCell className="whitespace-nowrap text-xs">{fmtDate(r.em)}</TableCell>
                    <TableCell>
                      <Link to="/alunos/$id" params={{ id: r.aluno_id }} className="text-primary hover:underline">
                        {r.aluno_nome}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        r.tipo === "dieta" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                        r.tipo === "treino" ? "bg-blue-100 text-blue-700 border-blue-200" :
                        "bg-amber-100 text-amber-700 border-amber-200"
                      }>{r.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.por ?? <span className="text-muted-foreground italic">sem registro</span>}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{r.data_referencia}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
