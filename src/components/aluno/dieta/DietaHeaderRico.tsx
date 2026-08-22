import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar, Clock, Cake, Ruler, Scale, Activity,
  MessageCircle, Sparkles, Pencil, FileDown,
} from "lucide-react";
import type { Aluno } from "@/lib/crm";
import { MODALIDADE_LABEL, fmtDate, diasRestantes } from "@/lib/crm";
import { AlunoAvatar } from "@/components/aluno/AlunoAvatar";

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}
function formatIdade(nasc: string | null | undefined): string {
  if (!nasc) return "—";
  const d = new Date(nasc);
  if (isNaN(d.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? `${age} anos` : "—";
}
function formatIMC(peso: number | null | undefined, alturaCm: number | null | undefined): string {
  if (!peso || !alturaCm) return "—";
  const m = alturaCm / 100;
  if (m <= 0) return "—";
  return (peso / (m * m)).toFixed(1).replace(".", ",");
}

export function DietaHeaderRico({
  aluno,
  onWhatsApp, onGerarFeedback, onAtualizarDieta, onSalvarPdf,
  busyPdf,
}: {
  aluno: Aluno;
  onWhatsApp: () => void;
  onGerarFeedback: () => void;
  onAtualizarDieta: () => void;
  onSalvarPdf: () => void;
  busyPdf?: boolean;
}) {
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(null);
  const [proximoFeedback, setProximoFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const [{ data: planos }, { data: jobs }] = await Promise.all([
        supabase.from("dieta_planos").select("atualizado_em").eq("aluno_id", aluno.id).eq("template", false).order("atualizado_em", { ascending: false }).limit(1),
        supabase.from("jobs_disparos").select("agendado_para,tipo").eq("aluno_id", aluno.id).eq("executado", false).in("tipo", ["d15_formulario", "d30"]).order("agendado_para", { ascending: true }).limit(1),
      ]);
      if (cancel) return;
      setUltimaAtualizacao(planos?.[0]?.atualizado_em ?? null);
      setProximoFeedback(jobs?.[0]?.agendado_para ?? null);
    })();
    return () => { cancel = true; };
  }, [aluno.id]);

  const dias = diasRestantes(aluno.data_expiracao);
  const emDia = dias === null || dias > 7;
  const ativo = aluno.status === "ativo" || aluno.status === "renovado";

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-5 flex-wrap">
        {/* Avatar + identidade */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <AlunoAvatar nome={aluno.nome} fotoUrl={(aluno as any).foto_url} className="h-16 w-16 text-xl" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-slate-900 truncate">{aluno.nome}</h2>
              {aluno.modalidade && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                  {MODALIDADE_LABEL[aluno.modalidade]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs ${ativo ? "text-emerald-700" : "text-slate-500"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${ativo ? "bg-emerald-500" : "bg-slate-400"}`} />
                {ativo ? "Ativo" : "Inativo"}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs ${emDia ? "text-emerald-700" : "text-amber-700"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${emDia ? "bg-emerald-500" : "bg-amber-500"}`} />
                {emDia ? "Em dia" : `Vence em ${dias}d`}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-3 flex-wrap text-xs">
              <Metric icon={Cake} label="Idade" value={formatIdade(aluno.data_nascimento)} />
              <Metric icon={Ruler} label="Altura" value={aluno.altura_cm ? `${(aluno.altura_cm / 100).toFixed(2).replace(".", ",")} m` : "—"} />
              <Metric icon={Scale} label="Peso" value={aluno.peso_kg ? `${aluno.peso_kg} kg` : "—"} />
              <Metric icon={Activity} label="IMC" value={formatIMC(aluno.peso_kg, aluno.altura_cm)} />
            </div>
          </div>
        </div>

        {/* Datas */}
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-muted-foreground">Última atualização</span>
            <span className="font-medium text-slate-800">{fmtDate(ultimaAtualizacao)}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-muted-foreground">Próximo feedback</span>
            <span className="font-medium text-slate-800">{fmtDate(proximoFeedback)}</span>
          </div>
        </div>

        {/* Ações rápidas */}
        <div>
          <div className="text-xs font-medium text-slate-500 mb-2">Ações rápidas</div>
          <div className="grid grid-cols-4 gap-2">
            <QuickAction icon={MessageCircle} label="WhatsApp" tone="emerald" onClick={onWhatsApp} />
            <QuickAction icon={Sparkles} label="Gerar feedback" tone="violet" onClick={onGerarFeedback} />
            <QuickAction icon={Pencil} label="Atualizar dieta" tone="sky" onClick={onAtualizarDieta} />
            <QuickAction icon={FileDown} label="Salvar PDF" tone="rose" onClick={onSalvarPdf} busy={busyPdf} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</span>
      <span className="text-[13px] font-medium text-slate-800 tabular-nums">{value}</span>
    </span>
  );
}

function QuickAction({
  icon: Icon, label, onClick, tone, busy,
}: { icon: any; label: string; onClick: () => void; tone: "emerald" | "violet" | "sky" | "rose"; busy?: boolean }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    sky: "bg-sky-50 text-sky-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 min-w-[78px]"
    >
      <span className={`h-8 w-8 rounded-full flex items-center justify-center ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[10px] font-medium text-slate-600 text-center leading-tight">{label}</span>
    </button>
  );
}