import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const ids = readFileSync("/tmp/aluno_ids.txt", "utf8").trim().split("\n");
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 300);
const RAMP_MS = Number(process.env.RAMP_MS ?? 5000); // distribui o start em 5s
const ITERATIONS = Number(process.env.ITERATIONS ?? 1); // quantas dashboards/usuário

const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
const hojeStr = new Date().toISOString().slice(0, 10);

async function loadDashboard(alunoId: string) {
  const t0 = performance.now();
  const queries = [
    sb.from("alunos").select("id,nome,email,whatsapp,sexo,data_nascimento,altura_cm,peso_kg,status,modalidade,plano,servico_contratado,valor_plano,prazo_dias,data_compra,data_anamnese,data_d0,data_expiracao,total_renovacoes,observacoes,foto_url").eq("id", alunoId).maybeSingle(),
    sb.from("physical_assessments").select("id,assessment_date,weight,height,body_fat_percentage,lean_mass_kg,fat_mass_kg,bmi,lean_mass_percentage,assessment_type").eq("student_id", alunoId).order("assessment_date", { ascending: false }).limit(24),
    sb.from("dieta_planos").select("id,nome,status,meta_kcal,ptn_g_kg,cho_g_kg,lip_g_kg,peso_referencia,dias_semana,atualizado_em").eq("aluno_id", alunoId).eq("status", "ativo").order("atualizado_em", { ascending: false }).limit(1).maybeSingle(),
    sb.from("daily_checkins").select("id,data_checkin,sono_horas,qualidade_sono,energia,humor,score_gerado").eq("aluno_id", alunoId).gte("data_checkin", since30).order("data_checkin", { ascending: false }),
    sb.from("entregas_dia").select("data_referencia,dieta_entregue,treino_entregue,d0_confirmado").eq("aluno_id", alunoId).gte("data_referencia", since30).order("data_referencia", { ascending: false }),
    sb.from("feedback_envios").select("id,status,enviado_em,respondido_em,respostas,template_id,feedback_templates(nome,tipo)").eq("aluno_id", alunoId).order("enviado_em", { ascending: false }).limit(8),
    sb.from("transacoes").select("id,tipo,valor,descricao,competencia,data_transacao,criado_em").eq("aluno_id", alunoId).order("criado_em", { ascending: false }).limit(10),
    sb.from("comunicacoes").select("id,gatilho,canal,status,mensagem,enviado_em").eq("aluno_id", alunoId).order("enviado_em", { ascending: false }).limit(10),
    sb.from("aluno_agua_log").select("ml").eq("aluno_id", alunoId).eq("data_referencia", hojeStr),
    sb.from("aluno_atividades_dia").select("tipo,concluido").eq("aluno_id", alunoId).eq("data_referencia", hojeStr),
    sb.from("aluno_refeicoes_log").select("refeicao_id,refeicao_nome").eq("aluno_id", alunoId).eq("data_referencia", hojeStr),
  ];
  const results = await Promise.all(queries);
  const ms = performance.now() - t0;
  const errors = results.filter((r: any) => r.error).map((r: any) => r.error.message);
  return { ms, errors };
}

async function userSession(alunoId: string, delayMs: number) {
  await new Promise((r) => setTimeout(r, delayMs));
  const latencies: number[] = [];
  const errs: string[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const { ms, errors } = await loadDashboard(alunoId);
    latencies.push(ms);
    errs.push(...errors);
  }
  return { latencies, errs };
}

function pct(arr: number[], p: number) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

(async () => {
  console.log(`▶ Load test: ${CONCURRENCY} sessões concorrentes, ramp ${RAMP_MS}ms, ${ITERATIONS} req/sessão`);
  const t0 = performance.now();
  const tasks = Array.from({ length: CONCURRENCY }, (_, i) => {
    const aluno = ids[i % ids.length];
    const delay = (i / CONCURRENCY) * RAMP_MS;
    return userSession(aluno, delay);
  });
  const all = await Promise.all(tasks);
  const totalMs = performance.now() - t0;

  const latencies = all.flatMap((r) => r.latencies);
  const errs = all.flatMap((r) => r.errs);
  const summary = {
    sessoes: CONCURRENCY,
    requisicoes_total: latencies.length,
    duracao_total_s: +(totalMs / 1000).toFixed(2),
    throughput_req_s: +(latencies.length / (totalMs / 1000)).toFixed(2),
    erros: errs.length,
    latencia_ms: {
      min: Math.round(Math.min(...latencies)),
      avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      p50: Math.round(pct(latencies, 50)),
      p90: Math.round(pct(latencies, 90)),
      p95: Math.round(pct(latencies, 95)),
      p99: Math.round(pct(latencies, 99)),
      max: Math.round(Math.max(...latencies)),
    },
    erros_sample: errs.slice(0, 5),
  };
  console.log(JSON.stringify(summary, null, 2));
  writeFileSync("/mnt/documents/loadtest-300-alunos.json", JSON.stringify(summary, null, 2));
})();
