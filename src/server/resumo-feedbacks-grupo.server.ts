import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { lerRoteamento, enviarZapiRoteado } from "./roteamento-grupos.server";

const DIAS_PARA_LEMBRETE = 3;

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

const TPL_MENSAL_FALLBACK =
  "Fala, comigo {nome}!\n\nChegou seu feedback mensal.\n\nQuero ver como foi sua execução nesse mês: treino, dieta, rotina, evolução e onde ainda está travando.\n\nResponde sem frescura. Quanto mais claro for o feedback, melhor fica o próximo ajuste.\n\nPreenche aqui 👇🏻\n\n{link}";
const TPL_QUINZENAL_FALLBACK =
  "Fala comigo {nome}!\n\nChegou seu feedback quinzenal.\n\nQuero saber como foi a execução desses primeiros 15 dias: treino, dieta, rotina e dificuldades.\n\nSem maquiar resposta. Quanto mais claro você for, melhor fica o próximo ajuste.\n\nPreenche aqui 👇🏻\n\n{link}";

function primeiroNome(nome: string) {
  return (nome || "").split(" ")[0] || nome;
}

function renderTpl(tpl: string, nome: string, link: string) {
  return tpl.replaceAll("{nome}", primeiroNome(nome)).replaceAll("{link}", link);
}

export async function enviarResumoFeedbacksPendentesGrupoImpl() {
  const limiteISO = new Date(Date.now() - DIAS_PARA_LEMBRETE * 86400000).toISOString();
  const { data: forms } = await supabaseAdmin
    .from("formularios")
    .select("id, aluno_id, tipo, recebido_em, token, link_publico")
    .in("tipo", ["feedback_quinzenal", "feedback_mensal"] as any)
    .eq("respondido", false)
    .lte("recebido_em", limiteISO)
    .not("aluno_id", "is", null)
    .order("recebido_em", { ascending: true })
    .limit(300);

  const lista = forms ?? [];
  if (lista.length === 0) return { ok: false, error: "Nenhum feedback pendente há 3 dias ou mais", total: 0 };

  const alunoIds = Array.from(new Set(lista.map((f) => f.aluno_id!).filter(Boolean)));
  const { data: alunos } = await supabaseAdmin
    .from("alunos")
    .select("id, nome, whatsapp, modalidade, status")
    .in("id", alunoIds)
    .eq("status", "ativo");
  const alunosMap = new Map<string, { nome: string; whatsapp: string; modalidade: string | null }>();
  (alunos ?? []).forEach((a) => alunosMap.set(a.id, { nome: a.nome, whatsapp: a.whatsapp, modalidade: a.modalidade }));

  // Filtra somente alunos ativos encontrados
  const pendentes = lista
    .filter((f) => f.aluno_id && alunosMap.has(f.aluno_id))
    .map((f) => {
      const a = alunosMap.get(f.aluno_id!)!;
      const dias = Math.floor((Date.now() - new Date(f.recebido_em).getTime()) / 86400000);
      return { form: f, aluno: a, dias };
    });

  if (pendentes.length === 0) return { ok: false, error: "Nenhum aluno ativo com pendência", total: 0 };

  // Templates oficiais (mesmos do envio "em dia")
  const { data: cfgRows } = await supabaseAdmin
    .from("workflow_config")
    .select("chave, valor")
    .in("chave", ["MSG_LINK_MENSAL", "MSG_LINK_QUINZENAL", "FORM_URL_MENSAL", "FORM_URL_QUINZENAL"]);
  const cfgMap = new Map<string, string>();
  (cfgRows ?? []).forEach((r: any) => cfgMap.set(r.chave, r.valor ?? ""));
  const tplMensal = cfgMap.get("MSG_LINK_MENSAL") || TPL_MENSAL_FALLBACK;
  const tplQuinzenal = cfgMap.get("MSG_LINK_QUINZENAL") || TPL_QUINZENAL_FALLBACK;
  const urlMensal = cfgMap.get("FORM_URL_MENSAL") || "https://mpteam-app.com/feedback-mensal";
  const urlQuinzenal = cfgMap.get("FORM_URL_QUINZENAL") || "https://mpteam-app.com/feedback-quinzenal";

  const cfg = await lerRoteamento("feedbacks_fu");
  if (!cfg.ativo || !cfg.destinoValor.trim()) {
    return { ok: false, error: "Roteamento de Feedbacks & Follow-ups não está ativo ou sem destino configurado", total: pendentes.length };
  }
  const destino = cfg.destinoValor.trim();

  // Cabeçalho
  const header = `📋 *Feedbacks do dia* (${pendentes.length})`;
  const resHeader = await enviarZapiRoteado(cfg.destinoTipo, destino, header);
  await supabaseAdmin.from("mensagens_log").insert({
    tipo_job: "resumo_feedbacks_pendentes_grupo",
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
    const { form, aluno } = p;
    const mod = aluno.modalidade ? ` [${MOD_LABEL[aluno.modalidade] ?? aluno.modalidade}]` : "";
    const isMensal = form.tipo === "feedback_mensal";
    const tpl = isMensal ? tplMensal : tplQuinzenal;
    const linkPublico = isMensal ? urlMensal : urlQuinzenal;
    const msgOriginal = renderTpl(tpl, aluno.nome, linkPublico);
    const corpo = [
      `*Aluno:* ${aluno.nome}${mod}`,
      `*Telefone:* ${aluno.whatsapp || "—"}`,
      `*Tipo:* ${TIPO_LABEL[form.tipo] ?? form.tipo}`,
      "",
      msgOriginal,
    ].join("\n");

    const res = await enviarZapiRoteado(cfg.destinoTipo, destino, corpo);
    if (res.ok) enviados++;
    else falhas++;

    await supabaseAdmin.from("mensagens_log").insert({
      aluno_id: form.aluno_id,
      tipo_job: "resumo_feedbacks_pendentes_grupo",
      mensagem_enviada: corpo,
      whatsapp_destino: destino,
      status_envio: res.ok ? "enviado" : "erro",
      erro_detalhe: res.error,
    } as any);
  }

  return { ok: falhas === 0, total: pendentes.length, enviados, falhas };
}