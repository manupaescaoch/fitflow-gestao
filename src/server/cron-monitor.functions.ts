import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CronExpressionParser } from "cron-parser";

export type CronJobRow = {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  proxima: string | null;
  ultima: {
    runid: number;
    start_time: string;
    end_time: string | null;
    status: string;
    http_status: number | null;
    return_message: string | null;
    duracao_ms: number | null;
  } | null;
};

export type CronKpis = {
  ok_24h: number;
  fail_24h: number;
  ultima_falha_em: string | null;
  ultima_falha_jobname: string | null;
};

function extractHttpStatus(msg: string | null): number | null {
  if (!msg) return null;
  const m = msg.match(/HTTP\/[\d.]+\s+(\d{3})/i);
  if (m) return Number(m[1]);
  const m2 = msg.match(/\bstatus(?:_code)?["':\s]+(\d{3})\b/i);
  if (m2) return Number(m2[1]);
  return null;
}

function proximaExecucao(schedule: string): string | null {
  try {
    const it = CronExpressionParser.parse(schedule, { tz: "UTC" });
    return it.next().toDate().toISOString();
  } catch {
    return null;
  }
}

export const listarCronJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ jobs: CronJobRow[]; kpis: CronKpis }> => {
    const { data: jobs, error: e1 } = await supabaseAdmin.rpc("admin_listar_cron_jobs");
    if (e1) throw new Error(e1.message);

    const { data: kpis, error: e2 } = await supabaseAdmin.rpc("admin_kpis_cron_jobs");
    if (e2) throw new Error(e2.message);

    const list = (jobs ?? []) as Array<{
      jobid: number; jobname: string; schedule: string; command: string; active: boolean;
    }>;

    const ultimas = await Promise.all(
      list.map(async (j) => {
        const { data } = await supabaseAdmin.rpc("admin_historico_cron_job", {
          _jobname: j.jobname,
          _limit: 1,
        });
        const row = (data?.[0] ?? null) as null | {
          runid: number; start_time: string; end_time: string | null;
          status: string; return_message: string | null;
        };
        return { jobname: j.jobname, ultima: row };
      }),
    );
    const mapUlt = new Map(ultimas.map((u) => [u.jobname, u.ultima]));

    const out: CronJobRow[] = list.map((j) => {
      const u = mapUlt.get(j.jobname);
      let duracao: number | null = null;
      if (u?.start_time && u.end_time) {
        duracao = new Date(u.end_time).getTime() - new Date(u.start_time).getTime();
      }
      return {
        jobid: j.jobid,
        jobname: j.jobname,
        schedule: j.schedule,
        active: j.active,
        proxima: proximaExecucao(j.schedule),
        ultima: u
          ? {
              runid: u.runid,
              start_time: u.start_time,
              end_time: u.end_time,
              status: u.status,
              http_status: extractHttpStatus(u.return_message),
              return_message: u.return_message,
              duracao_ms: duracao,
            }
          : null,
      };
    });

    const k = (kpis?.[0] ?? null) as null | CronKpis;
    return {
      jobs: out,
      kpis: k ?? { ok_24h: 0, fail_24h: 0, ultima_falha_em: null, ultima_falha_jobname: null },
    };
  });

export const historicoCronJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      jobname: z.string().min(1).max(100),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("admin_historico_cron_job", {
      _jobname: data.jobname,
      _limit: data.limit ?? 50,
    });
    if (error) throw new Error(error.message);
    return {
      execucoes: ((rows ?? []) as Array<{
        runid: number; start_time: string; end_time: string | null;
        status: string; return_message: string | null;
      }>).map((r) => ({
        runid: r.runid,
        start_time: r.start_time,
        end_time: r.end_time,
        status: r.status,
        return_message: r.return_message,
        http_status: extractHttpStatus(r.return_message),
        duracao_ms: r.end_time
          ? new Date(r.end_time).getTime() - new Date(r.start_time).getTime()
          : null,
      })),
    };
  });

export const dispararCronJobAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ jobname: z.string().min(1).max(100) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: res, error } = await supabaseAdmin.rpc("admin_rodar_cron_job", {
      _jobname: data.jobname,
    });
    if (error) throw new Error(error.message);
    return res as { ok: boolean; erro?: string; jobname?: string; executado_em?: string };
  });