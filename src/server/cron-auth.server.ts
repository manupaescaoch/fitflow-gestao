/** Valida bearer CRON_SECRET nos hooks públicos chamados pelo pg_cron.
 *  Retorna null se ok; Response 401 caso contrário. */
export function checkCronAuth(request: Request): Response | null {
  const auth = request.headers.get("authorization") || "";
  const expected = process.env.CRON_SECRET || "";
  if (!expected) {
    return new Response(JSON.stringify({ error: "CRON_SECRET não configurado" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
  const prefix = "Bearer ";
  if (!auth.startsWith(prefix)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  const token = auth.slice(prefix.length);
  if (token.length !== expected.length) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}