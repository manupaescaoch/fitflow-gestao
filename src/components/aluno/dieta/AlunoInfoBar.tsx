import { useEffect, useRef, useState } from "react";
import { Pencil, Check, X, User, Sparkles, Save, CalendarCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Aluno } from "@/lib/crm";
import { MODALIDADE_LABEL, STATUS_LABEL, modalidadeColor } from "@/lib/crm";

type AlunoExt = Aluno & { altura_cm?: number | null; data_nascimento?: string | null; peso_kg?: number | null };

export function AlunoInfoBar({
  aluno, canEdit, onChanged,
  status, savedAt, salvando,
  onGerarIA, onSalvarDieta, onConfirmarInicio,
}: {
  aluno: AlunoExt;
  canEdit: boolean;
  onChanged?: (patch: Partial<AlunoExt>) => void;
  status?: string;
  savedAt?: Date | null;
  salvando?: boolean;
  onGerarIA?: () => void;
  onSalvarDieta?: () => void;
  onConfirmarInicio?: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [peso, setPeso] = useState<string>(aluno.peso_kg != null ? String(aluno.peso_kg) : "");
  const [altura, setAltura] = useState<string>(aluno.altura_cm != null ? String(aluno.altura_cm) : "");
  const [nasc, setNasc] = useState<string>(aluno.data_nascimento ?? "");
  const [salvandoLocal, setSalvandoLocal] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPeso(aluno.peso_kg != null ? String(aluno.peso_kg) : "");
    setAltura(aluno.altura_cm != null ? String(aluno.altura_cm) : "");
    setNasc(aluno.data_nascimento ?? "");
  }, [aluno.id, aluno.peso_kg, aluno.altura_cm, aluno.data_nascimento]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setEdit(false);
    }
    if (edit) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [edit]);

  const idade = calcIdade(aluno.data_nascimento);
  const imc = calcIMC(aluno.peso_kg, aluno.altura_cm);
  const iniciais = aluno.nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  async function salvar() {
    setSalvandoLocal(true);
    const patch: Partial<AlunoExt> = {
      peso_kg: peso === "" ? null : Number(peso),
      altura_cm: altura === "" ? null : Number(altura),
      data_nascimento: nasc === "" ? null : nasc,
    };
    const { error } = await supabase.from("alunos").update(patch).eq("id", aluno.id);
    setSalvandoLocal(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Dados atualizados");
    onChanged?.(patch);
    setEdit(false);
  }

  const statusBadge = (() => {
    switch (status) {
      case "ativo": return { dot: "bg-emerald-500", label: "Ativo", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "aprovado": return { dot: "bg-sky-500", label: "Aprovado", cls: "bg-sky-50 text-sky-700 border-sky-200" };
      case "rascunho": return { dot: "bg-amber-500", label: "Rascunho", cls: "bg-amber-50 text-amber-700 border-amber-200" };
      default: return null;
    }
  })();

  return (
    <div className="rounded-2xl bg-white border border-slate-200/70 shadow-sm px-6 py-5">
      <div className="flex items-start gap-5">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-700 grid place-items-center font-semibold text-base shrink-0 ring-1 ring-rose-100">
          {iniciais || <User className="w-5 h-5" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[18px] font-semibold tracking-tight text-slate-900 truncate">{aluno.nome}</h1>
            {aluno.modalidade && (
              <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md font-medium ${modalidadeColor(aluno.modalidade)}`}>
                {MODALIDADE_LABEL[aluno.modalidade]}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {STATUS_LABEL[aluno.status]}
            </span>
            {statusBadge && (
              <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md border ${statusBadge.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                Plano {statusBadge.label.toLowerCase()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2 mt-4 max-w-xl">
            <Stat label="Idade" value={idade != null ? `${idade} anos` : "—"} />
            <Stat label="Altura" value={aluno.altura_cm ? `${(aluno.altura_cm / 100).toFixed(2).replace(".", ",")} m` : "—"} />
            <Stat label="Peso" value={aluno.peso_kg ? `${fmt(aluno.peso_kg)} kg` : "—"} />
            <Stat label="IMC" value={imc != null ? imc.toFixed(1).replace(".", ",") : "—"} />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canEdit && onConfirmarInicio && (
            <button
              onClick={onConfirmarInicio}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
            >
              <CalendarCheck className="w-3.5 h-3.5" /> Confirmar início
            </button>
          )}
          {canEdit && onGerarIA && (
            <button
              onClick={onGerarIA}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-rose-600" /> Gerar com IA
            </button>
          )}
          {canEdit && onSalvarDieta && (
            <button
              onClick={onSalvarDieta}
              disabled={!!salvando}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-60 transition shadow-sm"
            >
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar dieta
            </button>
          )}
        </div>
      </div>

      {(savedAt || canEdit) && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">
            {savedAt ? `Salvo ${timeAgo(savedAt)}` : ""}
          </span>
          {canEdit && (
        <div className="relative" ref={popRef}>
          <button
            onClick={() => setEdit((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition"
          >
            <Pencil className="w-3 h-3" /> Editar dados
          </button>
          {edit && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-popover border border-border shadow-lg p-3 z-30">
              <div className="text-xs font-semibold mb-2">Dados antropométricos</div>
              <div className="space-y-2">
                <Field label="Peso (kg)">
                  <input type="number" step="0.1" value={peso} onChange={(e) => setPeso(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm" />
                </Field>
                <Field label="Altura (cm)">
                  <input type="number" step="1" value={altura} onChange={(e) => setAltura(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm" />
                </Field>
                <Field label="Data de nascimento">
                  <input type="date" value={nasc} onChange={(e) => setNasc(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm" />
                </Field>
              </div>
              <div className="flex justify-end gap-1.5 mt-3">
                <button onClick={() => setEdit(false)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs hover:bg-muted/60">
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
                <button onClick={salvar} disabled={salvandoLocal} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-white text-xs hover:bg-primary disabled:opacity-60">
                  <Check className="w-3.5 h-3.5" /> Salvar
                </button>
              </div>
            </div>
          )}
        </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{label}</div>
      <div className="text-[15px] font-semibold text-slate-900 tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function timeAgo(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 5) return "agora";
  if (diff < 60) return `há ${diff}s`;
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  return `há ${Math.floor(diff / 3600)}h`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}

function calcIdade(nasc: string | null | undefined): number | null {
  if (!nasc) return null;
  const s = String(nasc).trim();
  if (!s) return null;
  let y = 0, mo = 0, da = 0;
  // Formatos aceitos: YYYY-MM-DD (ISO) ou DD/MM/YYYY (BR)
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (iso) {
    y = Number(iso[1]); mo = Number(iso[2]); da = Number(iso[3]);
  } else if (br) {
    da = Number(br[1]); mo = Number(br[2]); y = Number(br[3]);
  } else {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    y = d.getFullYear(); mo = d.getMonth() + 1; da = d.getDate();
  }
  const now = new Date();
  const yNow = now.getFullYear();
  if (y < 1900 || y > yNow || mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  let age = yNow - y;
  const passou = now.getMonth() + 1 > mo || (now.getMonth() + 1 === mo && now.getDate() >= da);
  if (!passou) age -= 1;
  return age >= 0 ? age : null;
}
function calcIMC(peso: number | null | undefined, alturaCm: number | null | undefined): number | null {
  if (!peso || !alturaCm) return null;
  const m = alturaCm / 100;
  if (m <= 0) return null;
  return peso / (m * m);
}
function fmt(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}