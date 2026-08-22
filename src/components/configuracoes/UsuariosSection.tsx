import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Perfil } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { criarUsuarioCRM, editarUsuarioCRM, excluirUsuarioCRM } from "@/server/usuarios.functions";
import { toast } from "sonner";
import { Loader2, Pencil, Save, X, UserPlus, Trash2, KeyRound, User, ExternalLink } from "lucide-react";

type UsuarioRow = {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  perfil: Perfil;
  ativo: boolean;
  criado_em: string;
};

export function UsuariosSection() {
  const [rows, setRows] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<UsuarioRow | null>(null);
  const { user } = useAuth();
  const excluir = useServerFn(excluirUsuarioCRM);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("usuarios_crm")
      .select("*")
      .order("criado_em", { ascending: false });
    setRows((data ?? []) as unknown as UsuarioRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  async function setPerfil(id: string, perfil: Perfil) {
    const { error } = await supabase.from("usuarios_crm").update({ perfil }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Perfil atualizado"); void load(); }
  }
  async function toggleAtivo(id: string, ativo: boolean) {
    const { error } = await supabase.from("usuarios_crm").update({ ativo: !ativo }).eq("id", id);
    if (error) toast.error(error.message);
    else void load();
  }

  async function handleExcluir(u: UsuarioRow) {
    if (!confirm(`Excluir o usuário "${u.nome ?? u.email}"? Esta ação é irreversível.`)) return;
    try {
      await excluir({ data: { id: u.id } });
      toast.success("Usuário excluído");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Crie usuários abaixo ou peça que se cadastrem em <Link to="/login" className="text-primary underline">/login</Link>.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/aluno"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <User className="h-4 w-4" /> Meu Perfil Paciente <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </a>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            <UserPlus className="h-4 w-4" /> Novo usuário
          </button>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground border-b border-border">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Nome</th>
              <th className="text-left font-medium">E-mail</th>
              <th className="text-left font-medium">Telefone</th>
              <th className="text-left font-medium">Perfil</th>
              <th className="text-left font-medium">Ativo</th>
              <th className="text-right pr-4 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário</td></tr>
            ) : rows.map((u) => (
              <tr key={u.id} className="border-b border-border/40">
                <td className="px-4 py-3">{u.nome ?? "—"}</td>
                <td className="text-muted-foreground">{u.email}</td>
                <td className="text-muted-foreground">{u.telefone ?? "—"}</td>
                <td>
                  <select
                    value={u.perfil}
                    onChange={(e) => setPerfil(u.id, e.target.value as Perfil)}
                    className="bg-background border border-input rounded px-2 py-1 text-xs"
                  >
                    <option value="admin">admin</option>
                    <option value="equipe">equipe</option>
                    <option value="consultor">consultor</option>
                    <option value="visualizador">visualizador</option>
                  </select>
                </td>
                <td>
                  <button
                    onClick={() => toggleAtivo(u.id, u.ativo)}
                    className={`text-xs px-2 py-1 rounded ${u.ativo ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    {u.ativo ? "Ativo" : "Inativo"}
                  </button>
                </td>
                <td className="pr-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => setEditing(u)}
                      title="Editar"
                      className="inline-flex items-center justify-center h-7 w-7 rounded border border-border bg-background hover:bg-muted transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleExcluir(u)}
                      disabled={u.id === user?.id}
                      title={u.id === user?.id ? "Você não pode excluir a si mesmo" : "Excluir"}
                      className="inline-flex items-center justify-center h-7 w-7 rounded border border-border bg-background text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showCreate && (
        <CriarUsuarioModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); void load(); }}
        />
      )}
      {editing && (
        <EditarUsuarioModal
          usuario={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}

function CriarUsuarioModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const criar = useServerFn(criarUsuarioCRM);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("equipe");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = telefone.replace(/\D/g, "");
    if (digits.length < 10) { toast.error("Telefone deve ter DDD + número (mín. 10 dígitos)."); return; }
    setSaving(true);
    try {
      await criar({ data: { nome: nome.trim(), email: email.trim(), telefone: telefone.trim(), perfil } });
      toast.success(`Usuário criado. Senha inicial: ${digits}`);
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao criar usuário";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 px-safe" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Novo usuário</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <Field label="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <Field label="E-mail">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <Field label="Telefone com DDD (será a senha inicial)">
          <input
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            required
            maxLength={20}
            placeholder="(11) 99999-9999"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            A senha inicial será apenas os dígitos do telefone. O usuário pode alterá-la depois.
          </p>
        </Field>
        <Field label="Perfil">
          <select value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="equipe">Equipe (treinador / nutricionista)</option>
            <option value="consultor">Consultor de vendas</option>
            <option value="visualizador">Visualizador</option>
            <option value="admin">Admin (acesso total)</option>
          </select>
          <p className="text-[11px] text-muted-foreground mt-1">
            Consultor pode cadastrar alunos e editar planos/valores, mas não acessa o módulo Financeiro. Equipe e Visualizador não acessam Financeiro, Feedbacks nem Configurações.
          </p>
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Criar usuário
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function EditarUsuarioModal({
  usuario, onClose, onSaved,
}: { usuario: UsuarioRow; onClose: () => void; onSaved: () => void }) {
  const editar = useServerFn(editarUsuarioCRM);
  const [nome, setNome] = useState(usuario.nome ?? "");
  const [email, setEmail] = useState(usuario.email ?? "");
  const [telefone, setTelefone] = useState(usuario.telefone ?? "");
  const [perfil, setPerfil] = useState<Perfil>(usuario.perfil);
  const [resetarSenha, setResetarSenha] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = telefone.replace(/\D/g, "");
    if (digits.length < 10) { toast.error("Telefone deve ter DDD + número (mín. 10 dígitos)."); return; }
    setSaving(true);
    try {
      await editar({
        data: {
          id: usuario.id,
          nome: nome.trim(),
          email: email.trim(),
          telefone: telefone.trim(),
          perfil,
          resetar_senha: resetarSenha,
        },
      });
      toast.success(resetarSenha ? `Usuário atualizado. Nova senha: ${digits}` : "Usuário atualizado");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 px-safe" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Editar usuário</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <Field label="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={120}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <Field label="E-mail">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <Field label="Telefone com DDD">
          <input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} required maxLength={20}
            placeholder="(11) 99999-9999"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Field>
        <Field label="Perfil">
          <select value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="equipe">Equipe (treinador / nutricionista)</option>
            <option value="consultor">Consultor de vendas</option>
            <option value="visualizador">Visualizador</option>
            <option value="admin">Admin (acesso total)</option>
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={resetarSenha} onChange={(e) => setResetarSenha(e.target.checked)}
            className="rounded border-input" />
          <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Resetar senha para os dígitos do telefone</span>
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}