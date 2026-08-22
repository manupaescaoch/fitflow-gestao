import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ids = readFileSync("/tmp/aluno_ids.txt", "utf8").trim().split("\n");
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 300);
const RAMP_MS = Number(process.env.RAMP_MS ?? 5000);
const ITERATIONS = Number(process.env.ITERATIONS ?? 1);

async function dash(id: string) {
  const t0 = performance.now();
  const { error } = await sb.rpc("get_aluno_dashboard", { _aluno_id: id });
  return { ms: performance.now() - t0, err: error?.message };
}
function pct(a:number[],p:number){const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p/100*s.length))];}

(async () => {
  const t0 = performance.now();
  const all = await Promise.all(Array.from({length: CONCURRENCY}, async (_,i) => {
    await new Promise(r => setTimeout(r, (i/CONCURRENCY)*RAMP_MS));
    const lat:number[] = []; const errs:string[] = [];
    for (let j=0;j<ITERATIONS;j++){const r=await dash(ids[i%ids.length]); lat.push(r.ms); if(r.err) errs.push(r.err);}
    return {lat, errs};
  }));
  const lat = all.flatMap(x=>x.lat); const errs = all.flatMap(x=>x.errs);
  console.log(JSON.stringify({
    sessoes: CONCURRENCY, requisicoes: lat.length,
    duracao_s: +((performance.now()-t0)/1000).toFixed(2),
    throughput: +(lat.length/((performance.now()-t0)/1000)).toFixed(1),
    erros: errs.length,
    p50: Math.round(pct(lat,50)), p90: Math.round(pct(lat,90)),
    p95: Math.round(pct(lat,95)), p99: Math.round(pct(lat,99)),
    max: Math.round(Math.max(...lat)),
  }, null, 2));
})();
