import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getZapiStatus, testZapiConnection, listZapiGroups, connectZapi, disconnectZapi, type ZapiGroup } from "@/server/zapi.functions";
import { getOpenAIStatus, testOpenAIConnection } from "@/server/openai.functions";
import { getCredenciais, saveCredencial } from "@/server/credenciais.functions";
import { getFormUrls, saveFormUrls } from "@/server/forms.functions";
import {
  getResumoDiarioConfig, saveResumoDiarioConfig,
  testarEnvioResumoDiario, previewResumoDiario,
} from "@/server/notificacoes-diarias.functions";
import {
  getRespostasFeedbacksConfig, saveRespostasFeedbacksConfig,
  testarEnvioRespostasFeedbacks, previewRespostasFeedbacks, enviarRespostasFeedbacks24h,
} from "@/server/notificacoes-feedbacks.functions";
import { toast } from "sonner";
import {
  Plug, PlugZap, Power, ShieldAlert, CheckCircle2, XCircle, Loader2, RefreshCw,
  Save, X, Sparkles, Link2, Copy, MessageCircle, Bell, Send, Eye, Users,
} from "lucide-react";
import { RoteamentoGrupoCard } from "./RoteamentoGrupoCard";
import { getBloqueioEnviosAlunos, setBloqueioEnviosAlunos } from "@/server/roteamento-grupos.functions";
import { ShieldOff } from "lucide-react";

type StatusData = Awaited<ReturnType<typeof getZapiStatus>>;
type TestResult = Awaited<ReturnType<typeof testZapiConnection>>;

export function ConexoesSection() {
  const fetchStatus = useServerFn(getZapiStatus);
  const runTest = useServerFn(testZapiConnection);
  const fetchGroups = useServerFn(listZapiGroups);
  const runConnect = useServerFn(connectZapi);
  const runDisconnect = useServerFn(disconnectZapi);
  const fetchOpenAI = useServerFn(getOpenAIStatus);
  const runOpenAITest = useServerFn(testOpenAIConnection);
  const fetchUrls = useServerFn(getFormUrls);
  const persistUrls = useServerFn(saveFormUrls);
  const fetchResumo = useServerFn(getResumoDiarioConfig);
  const persistResumo = useServerFn(saveResumoDiarioConfig);
  const testResumo = useServerFn(testarEnvioResumoDiario);
  const previewResumo = useServerFn(previewResumoDiario);
  const fetchCreds = useServerFn(getCredenciais);
  const persistCred = useServerFn(saveCredencial);
  type CredKey = "ZAPI_INSTANCE_ID" | "ZAPI_TOKEN" | "ZAPI_CLIENT_TOKEN" | "OPENAI_API_KEY" | "DAPI_BASE_URL" | "DAPI_SESSION_ID" | "DAPI_API_KEY";
  const [creds, setCreds] = useState<Record<CredKey, { configured: boolean; preview: string | null }> | null>(null);
  const [credDraft, setCredDraft] = useState<Record<string, string>>({});
  const [credSaving, setCredSaving] = useState<string | null>(null);
  const loadCreds = async () => {
    try {
      const r = (await fetchCreds()) as any;
      setCreds(r);
      setCredDraft((d) => ({
        ...d,
        DAPI_BASE_URL: d.DAPI_BASE_URL || r?.DAPI_BASE_URL?.preview || "https://api.d-api.cloud",
      }));
    } catch { /* ignore */ }
  };
  useEffect(() => { void loadCreds(); }, []);
  const salvarCred = async (chave: CredKey) => {
    setCredSaving(chave);
    try {
      await persistCred({ data: { chave, valor: (credDraft[chave] ?? "").trim() } });
      toast.success("Credencial salva");
      setCredDraft((d) => ({ ...d, [chave]: "" }));
      await loadCreds();
      if (chave === "OPENAI_API_KEY") await loadOpenAI(); else await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally { setCredSaving(null); }
  };
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [openAIStatus, setOpenAIStatus] = useState<Awaited<ReturnType<typeof getOpenAIStatus>> | null>(null);
  const [openAILoading, setOpenAILoading] = useState(true);
  const [openAITesting, setOpenAITesting] = useState(false);
  const [openAITestResult, setOpenAITestResult] = useState<Awaited<ReturnType<typeof testOpenAIConnection>> | null>(null);
  const [formUrls, setFormUrls] = useState<{ anamnese: string; quinzenal: string; mensal: string } | null>(null);
  const [urlsLoading, setUrlsLoading] = useState(true);
  const [urlsDraft, setUrlsDraft] = useState<{ anamnese: string; quinzenal: string; mensal: string }>({ anamnese: "", quinzenal: "", mensal: "" });
  const [urlsSaving, setUrlsSaving] = useState(false);
  type ResumoCfg = { ativo: boolean; horario: string; destinoTipo: "telefone" | "grupo"; destinoValor: string };
  const [resumoCfg, setResumoCfg] = useState<ResumoCfg | null>(null);
  const [resumoDraft, setResumoDraft] = useState<ResumoCfg>({ ativo: false, horario: "21:00", destinoTipo: "grupo", destinoValor: "" });
  const [resumoLoading, setResumoLoading] = useState(true);
  const [resumoSaving, setResumoSaving] = useState(false);
  const [resumoTesting, setResumoTesting] = useState(false);
  const [resumoPreviewing, setResumoPreviewing] = useState(false);
  const [resumoPreview, setResumoPreview] = useState<{ total: number; mensagem: string | null; dataRef: string } | null>(null);
  // Respostas de feedbacks (tempo real)
  type FbCfg = { ativo: boolean; destinoTipo: "telefone" | "grupo"; destinoValor: string };
  const fetchFbCfg = useServerFn(getRespostasFeedbacksConfig);
  const persistFbCfg = useServerFn(saveRespostasFeedbacksConfig);
  const testFbCfg = useServerFn(testarEnvioRespostasFeedbacks);
  const previewFbCfg = useServerFn(previewRespostasFeedbacks);
  const send24hFb = useServerFn(enviarRespostasFeedbacks24h);
  const [fbCfg, setFbCfg] = useState<FbCfg | null>(null);
  const [fbDraft, setFbDraft] = useState<FbCfg>({ ativo: false, destinoTipo: "grupo", destinoValor: "" });
  const [fbLoading, setFbLoading] = useState(true);
  const [fbSaving, setFbSaving] = useState(false);
  const [fbTesting, setFbTesting] = useState(false);
  const [fbPreviewing, setFbPreviewing] = useState(false);
  const [fbSending24h, setFbSending24h] = useState(false);
  const [fbPreview, setFbPreview] = useState<{ total: number; mensagem: string | null } | null>(null);
  const [groups, setGroups] = useState<ZapiGroup[] | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const r = await runConnect();
      if (!r.ok) { toast.error(r.error); return; }
      if (r.alreadyConnected) { toast.success("WhatsApp já está conectado"); await load(); return; }
      setQrDataUrl(r.qr);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao conectar");
    } finally { setConnecting(false); }
  };

  const handleDisconnect = async () => {
    if (!confirm("Desconectar o WhatsApp da Z-API? Os envios automáticos param até reconectar.")) return;
    setDisconnecting(true);
    try {
      const r = await runDisconnect();
      if (r.ok) { toast.success("WhatsApp desconectado"); setTestResult(null); await load(); }
      else toast.error(r.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao desconectar");
    } finally { setDisconnecting(false); }
  };

  const handleLoadGroups = async () => {
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const r = await fetchGroups();
      if (r.ok) {
        setGroups(r.groups);
        if (r.groups.length === 0) setGroupsError("Nenhum grupo encontrado nesta conta.");
      } else {
        setGroupsError(r.error);
      }
    } catch (e) {
      setGroupsError(e instanceof Error ? e.message : "Falha ao buscar grupos");
    } finally {
      setGroupsLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try { setStatus(await fetchStatus()); } finally { setLoading(false); }
  };
  const loadOpenAI = async () => {
    setOpenAILoading(true);
    try { setOpenAIStatus(await fetchOpenAI()); } finally { setOpenAILoading(false); }
  };
  const loadUrls = async () => {
    setUrlsLoading(true);
    try {
      const urls = await fetchUrls();
      setFormUrls(urls);
      setUrlsDraft(urls);
    } finally { setUrlsLoading(false); }
  };
  useEffect(() => { void load(); void loadOpenAI(); void loadUrls(); }, []);

  const loadResumo = async () => {
    setResumoLoading(true);
    try {
      const cfg = await fetchResumo();
      setResumoCfg(cfg);
      setResumoDraft(cfg);
    } finally { setResumoLoading(false); }
  };
  useEffect(() => { void loadResumo(); }, []);

  const loadFb = async () => {
    setFbLoading(true);
    try {
      const cfg = await fetchFbCfg();
      setFbCfg(cfg);
      setFbDraft(cfg);
    } finally { setFbLoading(false); }
  };
  useEffect(() => { void loadFb(); }, []);

  // Kill-switch: bloqueio global de envios diretos ao aluno
  const fetchBloqueio = useServerFn(getBloqueioEnviosAlunos);
  const persistBloqueio = useServerFn(setBloqueioEnviosAlunos);
  const [bloqueioAtivo, setBloqueioAtivo] = useState<boolean | null>(null);
  const [bloqueioSaving, setBloqueioSaving] = useState(false);
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetchBloqueio();
        setBloqueioAtivo(r.ativo);
      } catch { setBloqueioAtivo(false); }
    })();
  }, []);
  const handleToggleBloqueio = async (next: boolean) => {
    setBloqueioSaving(true);
    const prev = bloqueioAtivo;
    setBloqueioAtivo(next);
    try {
      await persistBloqueio({ data: { ativo: next } });
      toast.success(next ? "Envios ao aluno bloqueados" : "Envios ao aluno liberados");
    } catch (err) {
      setBloqueioAtivo(prev);
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally { setBloqueioSaving(false); }
  };

  const isFbDirty = !!fbCfg && (
    fbDraft.ativo !== fbCfg.ativo ||
    fbDraft.destinoTipo !== fbCfg.destinoTipo ||
    fbDraft.destinoValor.trim() !== fbCfg.destinoValor.trim()
  );

  const handleSaveFb = async () => {
    setFbSaving(true);
    try {
      await persistFbCfg({ data: { ...fbDraft, destinoValor: fbDraft.destinoValor.trim() } });
      toast.success("Configuração salva");
      await loadFb();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally { setFbSaving(false); }
  };

  const handleTestFb = async () => {
    setFbTesting(true);
    try {
      const r = await testFbCfg();
      if (r.ok) toast.success(`Mensagem enviada (${r.total} item${r.total === 1 ? "" : "s"})`);
      else toast.error(r.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no envio");
    } finally { setFbTesting(false); }
  };

  const handlePreviewFb = async () => {
    setFbPreviewing(true);
    try {
      const r = await previewFbCfg();
      setFbPreview(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar prévia");
    } finally { setFbPreviewing(false); }
  };

  const handleSend24hFb = async () => {
    if (!confirm("Enviar agora todas as mensagens de feedback das últimas 24h para o destino configurado?")) return;
    setFbSending24h(true);
    try {
      const r = await send24hFb();
      if (r.ok) toast.success(`Mensagem enviada (${r.total} item${r.total === 1 ? "" : "s"})`);
      else toast.error(r.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no envio");
    } finally { setFbSending24h(false); }
  };

  const isResumoDirty = !!resumoCfg && (
    resumoDraft.ativo !== resumoCfg.ativo ||
    resumoDraft.horario !== resumoCfg.horario ||
    resumoDraft.destinoTipo !== resumoCfg.destinoTipo ||
    resumoDraft.destinoValor.trim() !== resumoCfg.destinoValor.trim()
  );

  const handleSaveResumo = async () => {
    setResumoSaving(true);
    try {
      await persistResumo({ data: { ...resumoDraft, destinoValor: resumoDraft.destinoValor.trim() } });
      toast.success("Configuração salva");
      await loadResumo();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally { setResumoSaving(false); }
  };

  const handleTestResumo = async () => {
    setResumoTesting(true);
    try {
      const r = await testResumo();
      if (r.ok) toast.success(`Mensagem enviada (${r.total} aluno${r.total === 1 ? "" : "s"})`);
      else toast.error(r.error);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no envio");
    } finally { setResumoTesting(false); }
  };

  const handlePreviewResumo = async () => {
    setResumoPreviewing(true);
    try {
      const r = await previewResumo();
      setResumoPreview(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar prévia");
    } finally { setResumoPreviewing(false); }
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try { setTestResult(await runTest()); } finally { setTesting(false); }
  };

  const handleOpenAITest = async () => {
    setOpenAITesting(true); setOpenAITestResult(null);
    try { setOpenAITestResult(await runOpenAITest()); } finally { setOpenAITesting(false); }
  };

  const copyUrl = async (label: string, value: string) => {
    if (!value) { toast.error("URL não configurada."); return; }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const isUrlsDirty = !!formUrls && (
    urlsDraft.anamnese !== formUrls.anamnese ||
    urlsDraft.quinzenal !== formUrls.quinzenal ||
    urlsDraft.mensal !== formUrls.mensal
  );

  const handleSaveUrls = async () => {
    setUrlsSaving(true);
    try {
      await persistUrls({ data: urlsDraft });
      setFormUrls(urlsDraft);
      toast.success("Links salvos com sucesso");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setUrlsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <div>
              <h2 className="font-semibold">Z-API — WhatsApp</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Configurações de envio de mensagens automáticas via WhatsApp.</p>
            </div>
          </div>
          <button onClick={load} disabled={loading}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Recarregar
          </button>
        </div>
        <div className="divide-y divide-border">
          {loading && !status ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : status ? (
            <>
              <CredRow chave="ZAPI_INSTANCE_ID" label="Instance ID" desc="Identificador da instância na Z-API" item={creds?.ZAPI_INSTANCE_ID ?? status.instance} draft={credDraft.ZAPI_INSTANCE_ID ?? ""} onChange={(v) => setCredDraft((d) => ({ ...d, ZAPI_INSTANCE_ID: v }))} onSave={() => salvarCred("ZAPI_INSTANCE_ID")} saving={credSaving === "ZAPI_INSTANCE_ID"} />
              <CredRow chave="ZAPI_TOKEN" label="Token da instância" desc="Token gerado pela Z-API" item={creds?.ZAPI_TOKEN ?? status.token} draft={credDraft.ZAPI_TOKEN ?? ""} onChange={(v) => setCredDraft((d) => ({ ...d, ZAPI_TOKEN: v }))} onSave={() => salvarCred("ZAPI_TOKEN")} saving={credSaving === "ZAPI_TOKEN"} />
              <CredRow chave="ZAPI_CLIENT_TOKEN" label="Client-Token" desc="Token de segurança da conta Z-API" item={creds?.ZAPI_CLIENT_TOKEN ?? status.clientToken} draft={credDraft.ZAPI_CLIENT_TOKEN ?? ""} onChange={(v) => setCredDraft((d) => ({ ...d, ZAPI_CLIENT_TOKEN: v }))} onSave={() => salvarCred("ZAPI_CLIENT_TOKEN")} saving={credSaving === "ZAPI_CLIENT_TOKEN"} />
            </>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              <ShieldAlert className="h-6 w-6 mx-auto mb-2" />
              Não foi possível carregar status.
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border bg-muted/20 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={handleTest} disabled={testing || !status?.allConfigured}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
              {testing ? "Testando..." : "Testar conexão Z-API"}
            </button>
            <button onClick={handleConnect} disabled={connecting || !status?.allConfigured}
              className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-500 hover:bg-emerald-500/20 disabled:opacity-50">
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
              {connecting ? "Gerando QR..." : "Conectar WhatsApp"}
            </button>
            <button onClick={handleDisconnect} disabled={disconnecting || !status?.allConfigured}
              className="inline-flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50">
              {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
              {disconnecting ? "Desconectando..." : "Desconectar"}
            </button>
          </div>
          {!status?.allConfigured && (
            <p className="text-xs text-amber-500">Configure todas as credenciais antes de testar.</p>
          )}
          {testResult && (
            <div className={`rounded-md border p-3 text-sm ${testResult.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
              <div className="flex items-center gap-2 font-medium">
                {testResult.ok ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {testResult.connected ? "Conectado ao WhatsApp" : "Z-API respondeu, mas instância desconectada"}
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-destructive" /> Falha na conexão
                  </>
                )}
              </div>
              {testResult.ok ? (
                <pre className="mt-2 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">{prettyJson(testResult.raw)}</pre>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground break-all">{testResult.error}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Plug className="h-4 w-4 text-primary" />
          <div>
            <h2 className="font-semibold">D-API</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Base URL já preenchida. Informe a Session ID e a API Key quando for ativar.
            </p>
          </div>
        </div>
        <div className="divide-y divide-border">
          <CredRow chave="DAPI_BASE_URL" label="Base URL" desc="Endereço da API (padrão: https://api.d-api.cloud)"
            item={creds?.DAPI_BASE_URL ?? { configured: false, preview: null }}
            draft={credDraft.DAPI_BASE_URL ?? ""}
            onChange={(v) => setCredDraft((d) => ({ ...d, DAPI_BASE_URL: v }))}
            onSave={() => salvarCred("DAPI_BASE_URL")} saving={credSaving === "DAPI_BASE_URL"} />
          <CredRow chave="DAPI_SESSION_ID" label="Session ID" desc="Identificador da sessão na D-API"
            item={creds?.DAPI_SESSION_ID ?? { configured: false, preview: null }}
            draft={credDraft.DAPI_SESSION_ID ?? ""}
            onChange={(v) => setCredDraft((d) => ({ ...d, DAPI_SESSION_ID: v }))}
            onSave={() => salvarCred("DAPI_SESSION_ID")} saving={credSaving === "DAPI_SESSION_ID"} />
          <CredRow chave="DAPI_API_KEY" label="API Key" desc="Chave de acesso da D-API"
            item={creds?.DAPI_API_KEY ?? { configured: false, preview: null }}
            draft={credDraft.DAPI_API_KEY ?? ""}
            onChange={(v) => setCredDraft((d) => ({ ...d, DAPI_API_KEY: v }))}
            onSave={() => salvarCred("DAPI_API_KEY")} saving={credSaving === "DAPI_API_KEY"} />
        </div>
        <div className="px-5 py-3 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Os valores ficam guardados no banco do sistema e só aparecem mascarados nesta tela. Nenhuma conexão é iniciada ao salvar.
          </p>
        </div>
      </div>

      {qrDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setQrDataUrl(null)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Conectar WhatsApp</h3>
              <button onClick={() => setQrDataUrl(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Abra o WhatsApp no celular → Aparelhos conectados → Conectar aparelho e aponte para o QR abaixo.
            </p>
            <img src={qrDataUrl} alt="QR Code Z-API" className="w-full rounded-md bg-white p-2" />
            <button onClick={async () => { setQrDataUrl(null); await load(); await handleTest(); }}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              <RefreshCw className="h-4 w-4" /> Já escaneei — verificar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <h2 className="font-semibold">OpenAI — Geração de respostas</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Chave da API usada para gerar respostas personalizadas de anamnese e feedbacks.</p>
            </div>
          </div>
          <button onClick={loadOpenAI} disabled={openAILoading}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <RefreshCw className={`h-3 w-3 ${openAILoading ? "animate-spin" : ""}`} /> Recarregar
          </button>
        </div>
        <div className="divide-y divide-border">
          {openAILoading && !openAIStatus ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : openAIStatus ? (
            <CredRow chave="OPENAI_API_KEY" label="Chave da API" desc="Chave secreta da OpenAI (sk-...)" item={creds?.OPENAI_API_KEY ?? openAIStatus.apiKey} draft={credDraft.OPENAI_API_KEY ?? ""} onChange={(v) => setCredDraft((d) => ({ ...d, OPENAI_API_KEY: v }))} onSave={() => salvarCred("OPENAI_API_KEY")} saving={credSaving === "OPENAI_API_KEY"} />
          ) : (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              <ShieldAlert className="h-6 w-6 mx-auto mb-2" />
              Não foi possível carregar status.
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-border bg-muted/20 space-y-3">
          <button onClick={handleOpenAITest} disabled={openAITesting || !openAIStatus?.allConfigured}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {openAITesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {openAITesting ? "Testando..." : "Testar conexão"}
          </button>
          {!openAIStatus?.allConfigured && (
            <p className="text-xs text-amber-500">Configure a OPENAI_API_KEY antes de testar.</p>
          )}
          {openAITestResult && (
            <div className={`rounded-md border p-3 text-sm ${openAITestResult.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
              <div className="flex items-center gap-2 font-medium">
                {openAITestResult.ok ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Chave válida
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-destructive" /> Chave inválida
                  </>
                )}
              </div>
              {openAITestResult.ok ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {openAITestResult.modelCount} modelos disponíveis. Modelo padrão: <code>{openAITestResult.defaultModel}</code>
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground break-all">{openAITestResult.error}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <div>
              <h2 className="font-semibold">Links dos formulários</h2>
              <p className="text-xs text-muted-foreground mt-0.5">URLs base dos formulários enviados aos alunos via WhatsApp.</p>
            </div>
          </div>
          <button onClick={loadUrls} disabled={urlsLoading}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <RefreshCw className={`h-3 w-3 ${urlsLoading ? "animate-spin" : ""}`} /> Recarregar
          </button>
        </div>
        <div className="divide-y divide-border">
          {urlsLoading && !formUrls ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : formUrls ? (
            <>
              <UrlRow chave="FORM_URL_ANAMNESE" label="URL Anamnese" value={urlsDraft.anamnese} placeholder="https://forms.mpteam.com.br/anamnese" onCopy={copyUrl} onChange={(v) => setUrlsDraft((d) => ({ ...d, anamnese: v }))} />
              <UrlRow chave="FORM_URL_QUINZENAL" label="URL Feedback Quinzenal" value={urlsDraft.quinzenal} placeholder="https://forms.mpteam.com.br/feedback-quinzenal" onCopy={copyUrl} onChange={(v) => setUrlsDraft((d) => ({ ...d, quinzenal: v }))} />
              <UrlRow chave="FORM_URL_MENSAL" label="URL Feedback Mensal" value={urlsDraft.mensal} placeholder="https://forms.mpteam.com.br/feedback-mensal" onCopy={copyUrl} onChange={(v) => setUrlsDraft((d) => ({ ...d, mensal: v }))} />
            </>
          ) : null}
        </div>
        <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Edite os links abaixo e clique em <strong>Salvar</strong>. As alterações se aplicam imediatamente em todos os disparos de WhatsApp.
          </p>
          <div className="flex items-center gap-2">
            {isUrlsDirty && (
              <button
                onClick={() => formUrls && setUrlsDraft(formUrls)}
                disabled={urlsSaving}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
            )}
            <button
              onClick={handleSaveUrls}
              disabled={!isUrlsDirty || urlsSaving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {urlsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {urlsSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UrlRow({ chave, label, value, placeholder, onCopy, onChange }: {
  chave: string; label: string; value: string; placeholder: string;
  onCopy: (label: string, value: string) => void;
  onChange: (value: string) => void;
}) {
  const configured = !!value;
  return (
    <div className="px-5 py-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground font-mono">{chave}</div>
        </div>
        {configured ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">
            <CheckCircle2 className="h-3 w-3" /> Configurado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <XCircle className="h-3 w-3" /> Não configurado
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={() => onCopy(label, value)}
          disabled={!configured}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          <Copy className="h-3.5 w-3.5" /> Copiar link
        </button>
      </div>
    </div>
  );
}

function CredRow({ chave, label, desc, item, draft, onChange, onSave, saving }: {
  chave: string; label: string; desc: string;
  item: { configured: boolean; preview: string | null };
  draft: string; onChange: (v: string) => void; onSave: () => void; saving: boolean;
}) {
  return (
    <div className="px-5 py-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground font-mono">{chave}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
        <div className="flex items-center gap-3">
          {item.preview && <code className="text-xs text-muted-foreground">{item.preview}</code>}
          {item.configured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">
              <CheckCircle2 className="h-3 w-3" /> Preenchido
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <XCircle className="h-3 w-3" /> A preencher
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          placeholder={item.configured ? "Digite para substituir o valor atual" : "Cole o valor aqui"}
          autoComplete="off"
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={onSave}
          disabled={saving || !draft.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

function SecretRow({ label, desc, item }: { label: string; desc: string; item: { configured: boolean; preview: string | null } }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-mono font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <div className="flex items-center gap-3">
        {item.preview && <code className="text-xs text-muted-foreground">{item.preview}</code>}
        {item.configured ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">
            <CheckCircle2 className="h-3 w-3" /> Configurado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
            <XCircle className="h-3 w-3" /> Não configurado
          </span>
        )}
      </div>
    </div>
  );
}

function prettyJson(s: string) {
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
}