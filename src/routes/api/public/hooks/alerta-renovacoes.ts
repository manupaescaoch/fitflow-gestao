import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkCronAuth } from "@/server/cron-auth.server";
import { checarBloqueioFimDeSemana } from "@/server/weekend-lock.server";

const DESTINO = process.env.RENOVACOES_DESTINO_WHATSAPP || ""; // DDI+DDD+numero
const JANELA_DIAS = 15;
const GATILHOS = [3, 7, 15]; // só dispara nesses dias

function fmtBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

function diasAte(iso: string, hoje: Date): number {
  const a = new Date(iso); a.setHours(0, 0, 0, 0);
  const h = new Date(hoje); h.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - h.getTime()) / 86400000);
}

async function sendZapi(phone: string, message: string) {
  const instance = process.env.ZAPI_INSTANCE_ID || process.env.ZAPI_INSTANCE;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instance || !token || !clientToken) return { ok: false, error: "Z-API não configurada" };
  const url = `https://api.z-api.io/instances/${instance}/token/${token}/send-text`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Client-Token": clientToken },
    body: JSON.stringify({ phone, message }),
  });
  if (!r.ok) return { ok: false, error: `Z-API ${r.status}: ${(await r.text()).slice(0, 200)}` };
  return { ok: true, error: null };
}

export const Route = createFileRoute("/api/public/hooks/alerta-renovacoes")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = checkCronAuth(request);
        if (unauth) return unauth;
        const bloq = checarBloqueioFimDeSemana(request, "alerta-renovacoes");
        if (bloq) return bloq;
        const hoje = new Date();
        const limite = new Date(hoje.getTime() + (JANELA_DIAS + 1) * 86400000);

        // Auto-inativa (cancela) alunos vencidos há mais de 30 dias
        const corte30 = new Date(hoje.getTime() - 30 * 86400000).toISOString();
        await supabaseAdmin
          .from("alunos")
          .update({ status: "cancelado" })
          .lt("data_expiracao", corte30)
          .not("status", "in", "(renovado,cancelado)");

        const { data: alunos, error } = await supabaseAdmin
          .from("alunos")
          .select("id, nome, data_expiracao, status")
          .not("data_expiracao", "is", null)
          .neq("status", "renovado")
          .neq("status", "cancelado")
          .gte("data_expiracao", hoje.toISOString())
          .lte("data_expiracao", limite.toISOString())
          .order("data_expiracao", { ascending: true });

        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

        const lista = (alunos ?? []).map((a) => ({
          nome: a.nome,
          data_expiracao: a.data_expiracao!,
          dias: diasAte(a.data_expiracao!, hoje),
        }));
        const b3 = lista.filter((a) => a.dias >= 1 && a.dias <= 3);
        const b7 = lista.filter((a) => a.dias >= 4 && a.dias <= 7);
        const b15 = lista.filter((a) => a.dias >= 8 && a.dias <= 15);

        // Só dispara se houver alguém em algum gatilho (3, 7 ou 15)
        const algumGatilho = lista.some((a) => GATILHOS.includes(a.dias));
        if (!algumGatilho) {
          return new Response(JSON.stringify({ ok: true, total: lista.length, skipped: "sem alunos nos gatilhos 3/7/15" }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        }

        const linha = (a: { nome: string; dias: number; data_expiracao: string }) =>
          `• ${a.nome} — vence em ${a.dias} ${a.dias === 1 ? "dia" : "dias"} (${fmtBR(a.data_expiracao)})`;

        const linhas: string[] = [];
        linhas.push("🔥 VENCEM NOS PRÓXIMOS 3 DIAS");
        linhas.push("Prioridade máxima. Chamar hoje.");
        linhas.push("");
        linhas.push(`Total: ${b3.length}`);
        linhas.push("");
        b3.forEach((a) => linhas.push(linha(a)));
        linhas.push("");
        linhas.push("");
        linhas.push("⏰ VENCEM NOS PRÓXIMOS 7 DIAS");
        linhas.push("Atenção. Já iniciar contato para evitar virar vencido.");
        linhas.push("");
        linhas.push(`Total: ${b7.length}`);
        linhas.push("");
        b7.forEach((a) => linhas.push(linha(a)));
        linhas.push("");
        linhas.push("");
        linhas.push("📅 VENCEM NOS PRÓXIMOS 15 DIAS");
        linhas.push("Pré-renovação. Contato leve e preventivo.");
        linhas.push("");
        linhas.push(`Total: ${b15.length}`);
        linhas.push("");
        b15.forEach((a) => linhas.push(linha(a)));
        linhas.push("");
        linhas.push("");
        linhas.push("📊 RESUMO GERAL");
        linhas.push(`🔥 Próximos 3 dias: ${b3.length}`);
        linhas.push(`⏰ Próximos 7 dias: ${b7.length}`);
        linhas.push(`📅 Próximos 15 dias: ${b15.length}`);
        linhas.push("");
        linhas.push(`Total geral: ${lista.length}`);

        const mensagem = linhas.join("\n").trim();
        if (!DESTINO) {
          return new Response(JSON.stringify({ ok: false, error: "RENOVACOES_DESTINO_WHATSAPP não configurado" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        const r = await sendZapi(DESTINO, mensagem);

        await supabaseAdmin.from("entregas_dia_log").insert({
          aluno_id: null, aluno_nome: null,
          origem: "alerta_renovacoes", tipo_evento: "envio_whatsapp",
          data_referencia: null, data_base: null,
          resultado: r.ok ? "enviado" : "erro",
          detalhes: { destino: DESTINO, total: lista.length, b3: b3.length, b7: b7.length, b15: b15.length, erro: r.error } as any,
        });

        return new Response(JSON.stringify({ ok: r.ok, total: lista.length, b3: b3.length, b7: b7.length, b15: b15.length, error: r.error }), {
          status: r.ok ? 200 : 500, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});