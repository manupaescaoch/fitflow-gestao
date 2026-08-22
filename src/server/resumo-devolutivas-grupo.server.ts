import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { lerRoteamento, enviarZapiRoteado } from "./roteamento-grupos.server";
import { gerarMensagemIA } from "./processar-jobs-feedback-core.server";

const TIPO_LABEL: Record<string, string> = {
  feedback_quinzenal: "Quinzenal",
  feedback_mensal: "Mensal",
};
const MOD_LABEL: Record<string, string> = {
  mpteam: "MPTEAM",
  mp_elite: "MP Elite",
  mp_presencial: "MP Presencial",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Envia ao grupo de Feedbacks & Follow-ups o resumo de feedbacks
 * RESPONDIDOS pelo aluno mas que ainda não tiveram devolutiva enviada
 * pela equipe. Cabeçalho + 1 mensagem por aluno (Aluno / Telefone /
 * Tipo + link para a resposta).
 */
export async function enviarResumoDevolutivasPendentesGrupoImpl() {
  const desdeISO = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: forms } = await supabaseAdmin
    .from("formularios")
    .select("id, aluno_id, tipo, respondido_em")
    .in("tipo", ["feedback_quinzenal", "feedback_mensal"] as any)
    .eq("respondido", true)
    .not("respondido_em", "is", null)
    .gte("respondido_em", desdeISO)
    .not("aluno_id", "is", null)
    .order("respondido_em", { ascending: true })
    .limit(300);

  const lista = forms ?? [];
  if (lista.length === 0) return { ok: false, error: "Nenhuma devolutiva pendente", total: 0 };

  const alunoIds = Array.from(new Set(lista.map((f) => f.aluno_id!).filter(Boolean)));

  const [{ data: alunos }, { data: logs }] = await Promise.all([
    supabaseAdmin
      .from("alunos")
      .select("id, nome, whatsapp, modalidade, status")
      .in("id", alunoIds)
      .eq("status", "ativo"),
    supabaseAdmin
      .from("mensagens_log")
      .select("aluno_id, tipo_job, enviado_em, status_envio")
      .in("tipo_job", ["feedback_quinzenal_resposta", "feedback_mensal_resposta"] as any)
      .in("aluno_id", alunoIds)
      .gte("enviado_em", desdeISO),
  ]);

  const alunosMap = new Map<string, { nome: string; whatsapp: string; modalidade: string | null }>();
  (alunos ?? []).forEach((a) => alunosMap.set(a.id, { nome: a.nome, whatsapp: a.whatsapp, modalidade: a.modalidade }));

  const ultimaDev = new Map<string, string>();
  for (const l of (logs ?? []) as any[]) {
    if (!l.aluno_id || !l.enviado_em || l.status_envio === "erro") continue;
    const tipoForm = l.tipo_job === "feedback_quinzenal_resposta" ? "feedback_quinzenal" : "feedback_mensal";
    const k = `${l.aluno_id}|${tipoForm}`;
    const cur = ultimaDev.get(k);
    if (!cur || new Date(l.enviado_em).getTime() > new Date(cur).getTime()) {
      ultimaDev.set(k, l.enviado_em);
    }
  }

  const pendentes = lista
    .filter((f) => {
      if (!f.aluno_id || !f.respondido_em) return false;
      if (!alunosMap.has(f.aluno_id)) return false;
      const dev = ultimaDev.get(`${f.aluno_id}|${f.tipo}`);
      if (dev && new Date(dev).getTime() >= new Date(f.respondido_em).getTime()) return false;
      return true;
    })
    .map((f) => {
      const a = alunosMap.get(f.aluno_id!)!;
      const dias = Math.floor((Date.now() - new Date(f.respondido_em!).getTime()) / 86400000);
      return { form: f, aluno: a, dias };
    });

  if (pendentes.length === 0) return { ok: false, error: "Nenhum aluno ativo aguardando devolutiva", total: 0 };

  const cfg = await lerRoteamento("feedbacks_fu");
  if (!cfg.ativo || !cfg.destinoValor.trim()) {
    return { ok: false, error: "Roteamento de Feedbacks & Follow-ups não está ativo ou sem destino configurado", total: pendentes.length };
  }
  const destino = cfg.destinoValor.trim();

  const header = `📩 *Feedbacks respondidos aguardando devolutiva* (${pendentes.length})`;
  const resHeader = await enviarZapiRoteado(cfg.destinoTipo, destino, header);
  await supabaseAdmin.from("mensagens_log").insert({
    tipo_job: "resumo_devolutivas_pendentes_grupo",
    mensagem_enviada: header,
    whatsapp_destino: destino,
    status_envio: resHeader.ok ? "enviado" : "erro",
    erro_detalhe: resHeader.error,
  } as any);

  let enviados = 0;
  let falhas = 0;

  for (const p of pendentes) {
    // Pausa aleatória entre 3s e 5s para não parecer automação
    await sleep(3000 + Math.floor(Math.random() * 2001));
    const { form, aluno, dias } = p;
    const mod = aluno.modalidade ? ` [${MOD_LABEL[aluno.modalidade] ?? aluno.modalidade}]` : "";
    const promptTipo = form.tipo === "feedback_mensal" ? "feedback_mensal" : "feedback_quinzenal";
    const ia = await gerarMensagemIA(promptTipo, form.aluno_id!);
    const devolutivaTexto = ia.mensagem?.trim()
      || `_Não foi possível gerar a devolutiva via IA: ${ia.error ?? "erro desconhecido"}_`;
    const corpo = [
      `*Aluno:* ${aluno.nome}${mod}`,
      `*Telefone:* ${aluno.whatsapp || "—"}`,
      `*Tipo:* devolutiva_pendente_${dias}d (${TIPO_LABEL[form.tipo] ?? form.tipo})`,
      "",
      devolutivaTexto,
    ].join("\n");

    const res = await enviarZapiRoteado(cfg.destinoTipo, destino, corpo);
    if (res.ok) enviados++;
    else falhas++;

    await supabaseAdmin.from("mensagens_log").insert({
      aluno_id: form.aluno_id,
      tipo_job: "resumo_devolutivas_pendentes_grupo",
      mensagem_enviada: corpo,
      whatsapp_destino: destino,
      status_envio: res.ok ? "enviado" : "erro",
      erro_detalhe: res.error,
    } as any);
  }

  return { ok: falhas === 0, total: pendentes.length, enviados, falhas };
}