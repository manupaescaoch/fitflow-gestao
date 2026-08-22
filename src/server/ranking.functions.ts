import { createServerFn } from "@tanstack/react-start";
import { requireAlunoAuth } from "./aluno-middleware";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type RankingItem = {
  aluno_id: string;
  nome: string;
  username: string | null;
  foto_url: string | null;
  score: number;
};

export type RankingResposta = {
  periodo: "semana" | "mes" | "geral";
  top: RankingItem[];
  meu: {
    posicao: number | null;
    score: number;
    sequencia: number;
    liga: string;
    proximaLiga: string | null;
    falta: number;
    progresso: number;
  } | null;
};

const SCORE_POST = 20;
const SCORE_REFEICAO = 5;

function ligaDe(score: number) {
  if (score >= 2000) return { nome: "Liga Diamante", min: 2000, max: Infinity, prox: null as string | null, proxMin: null as number | null };
  if (score >= 1000) return { nome: "Liga Ouro", min: 1000, max: 1999, prox: "Liga Diamante", proxMin: 2000 };
  if (score >= 500) return { nome: "Liga Prata", min: 500, max: 999, prox: "Liga Ouro", proxMin: 1000 };
  return { nome: "Liga Bronze", min: 0, max: 499, prox: "Liga Prata", proxMin: 500 };
}

function calcularSequencia(datas: string[]): number {
  if (!datas.length) return 0;
  const set = new Set(datas);
  let d = new Date();
  let streak = 0;
  // Permite começar contando a partir de hoje OU ontem
  const hoje = d.toISOString().slice(0, 10);
  if (!set.has(hoje)) {
    d.setDate(d.getDate() - 1);
  }
  for (;;) {
    const k = d.toISOString().slice(0, 10);
    if (set.has(k)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

export const getRanking = createServerFn({ method: "POST" }).middleware([requireAlunoAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        periodo: z.enum(["semana", "mes", "geral"]),
        aluno_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<RankingResposta> => {
    const sb = supabaseAdmin as any;
    const agora = new Date();
    let desde: string | null = null;
    if (data.periodo === "semana") {
      const d = new Date(agora);
      d.setDate(d.getDate() - 7);
      desde = d.toISOString().slice(0, 10);
    } else if (data.periodo === "mes") {
      const d = new Date(agora);
      d.setDate(d.getDate() - 30);
      desde = d.toISOString().slice(0, 10);
    }

    // Check-ins
    let qCheckins = sb
      .from("daily_checkins")
      .select("aluno_id, score_gerado, data_checkin");
    if (desde) qCheckins = qCheckins.gte("data_checkin", desde);
    const { data: checkins, error: e1 } = await qCheckins;
    if (e1) throw new Error(e1.message);

    // Posts (cada post = SCORE_POST)
    let qPosts = sb.from("community_posts").select("aluno_id, created_at");
    if (desde) qPosts = qPosts.gte("created_at", `${desde}T00:00:00`);
    const { data: posts, error: e2 } = await qPosts;
    if (e2) throw new Error(e2.message);

    // Refeições concluídas (+5 cada)
    let qRef = sb.from("aluno_refeicoes_log").select("aluno_id, data_referencia");
    if (desde) qRef = qRef.gte("data_referencia", desde);
    const { data: refeicoesLog } = await qRef;

    const scoreMap = new Map<string, number>();
    for (const c of checkins ?? []) {
      scoreMap.set(c.aluno_id, (scoreMap.get(c.aluno_id) ?? 0) + (c.score_gerado ?? 0));
    }
    for (const p of posts ?? []) {
      scoreMap.set(p.aluno_id, (scoreMap.get(p.aluno_id) ?? 0) + SCORE_POST);
    }
    for (const r of refeicoesLog ?? []) {
      scoreMap.set(r.aluno_id, (scoreMap.get(r.aluno_id) ?? 0) + SCORE_REFEICAO);
    }

    const ids = Array.from(scoreMap.keys());
    let alunos: any[] = [];
    if (ids.length) {
      const { data: arows } = await sb
        .from("alunos")
        .select("id, nome, username, foto_url, status")
        .in("id", ids);
      alunos = arows ?? [];
    }
    const alunoMap = new Map(alunos.map((a) => [a.id, a]));

    const ranking: RankingItem[] = ids
      .map((id) => {
        const a = alunoMap.get(id);
        if (!a) return null;
        return {
          aluno_id: id,
          nome: a.nome ?? "Aluno",
          username: a.username ?? null,
          foto_url: a.foto_url ?? null,
          score: Math.round(scoreMap.get(id) ?? 0),
        } as RankingItem;
      })
      .filter(Boolean as any)
      .sort((a, b) => b!.score - a!.score) as RankingItem[];

    let meu: RankingResposta["meu"] = null;
    if (data.aluno_id) {
      const idx = ranking.findIndex((r) => r.aluno_id === data.aluno_id);
      const meuScore = idx >= 0 ? ranking[idx].score : 0;
      // Sequência sempre calculada com base em todos os check-ins do aluno
      const { data: meusCheckins } = await sb
        .from("daily_checkins")
        .select("data_checkin")
        .eq("aluno_id", data.aluno_id)
        .order("data_checkin", { ascending: false })
        .limit(365);
      const datas = (meusCheckins ?? []).map((r: any) => r.data_checkin);
      const sequencia = calcularSequencia(datas);
      // Score acumulado all-time para definição de liga
      const { data: allCheckins } = await sb
        .from("daily_checkins")
        .select("score_gerado")
        .eq("aluno_id", data.aluno_id);
      const { data: allPosts } = await sb
        .from("community_posts")
        .select("id")
        .eq("aluno_id", data.aluno_id);
      const { data: allRefeicoes } = await sb
        .from("aluno_refeicoes_log")
        .select("id")
        .eq("aluno_id", data.aluno_id);
      const scoreTotal =
        (allCheckins ?? []).reduce((s: number, r: any) => s + (r.score_gerado ?? 0), 0) +
        (allPosts ?? []).length * SCORE_POST +
        (allRefeicoes ?? []).length * SCORE_REFEICAO;
      const liga = ligaDe(scoreTotal);
      const falta = liga.proxMin ? Math.max(0, liga.proxMin - scoreTotal) : 0;
      const progresso = liga.proxMin
        ? Math.min(100, Math.round(((scoreTotal - liga.min) / (liga.proxMin - liga.min)) * 100))
        : 100;
      meu = {
        posicao: idx >= 0 ? idx + 1 : null,
        score: data.periodo === "geral" ? scoreTotal : meuScore,
        sequencia,
        liga: liga.nome,
        proximaLiga: liga.prox,
        falta,
        progresso,
      };
    }

    return {
      periodo: data.periodo,
      top: ranking.slice(0, 50),
      meu,
    };
  });