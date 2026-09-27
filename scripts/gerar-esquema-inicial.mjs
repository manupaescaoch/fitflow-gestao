import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/integrations/supabase/types.ts", "utf8");
const ast = ts.createSourceFile("types.ts", source, ts.ScriptTarget.Latest, true);
const property = (node, name) => node.members.find((m) => m.name?.getText(ast) === name);
const members = (node) => node?.type?.members ?? [];
const db = ast.statements.find((n) => ts.isTypeAliasDeclaration(n) && n.name.text === "Database");
const pub = property(db.type, "public");
const tables = members(property(pub.type, "Tables"));
const enums = members(property(pub.type, "Enums"));
const priorMigrations = fs.readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .map((name) => fs.readFileSync(`supabase/migrations/${name}`, "utf8")).join("\n");
const alreadyCreated = new Set([...priorMigrations.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? (?:public\.)?([a-z_]+)/gi)]
  .map((match) => match[1].toLowerCase()));

function typeName(type) {
  const raw = type.getText(ast);
  if (raw.includes('Database["public"]["Enums"]')) {
    const found = raw.match(/\["Enums"\]\["([a-z_]+)"\]/);
    if (found) return `public.${found[1]}`;
  }
  if (raw.includes("Json")) return "jsonb";
  if (raw.includes("[]")) {
    if (raw.includes("number")) return "numeric[]";
    if (raw.includes("boolean")) return "boolean[]";
    return "text[]";
  }
  if (raw.includes("boolean")) return "boolean";
  if (raw.includes("number")) return "numeric";
  return "text";
}

function columnType(table, column, type) {
  const raw = typeName(type);
  if (raw !== "text") return raw;
  if (column === "id" && table !== "agente_config") return "uuid";
  if (/(_id|_por)$/.test(column) && !/(externo|external|provider|zapi|whatsapp|kiwify|job|instancia|chave|reference|mensagem)/.test(column)) return "uuid";
  if (/^(data_nascimento|data_transacao|data_referencia|data_checkin|dia|prazo)$/.test(column)) return "date";
  if (/^data_/.test(column)) return "timestamptz";
  if (/(_em|_at|_para)$/.test(column) && !/(texto|status|enviado_para)/.test(column)) return "timestamptz";
  return "text";
}

const quote = (s) => `"${s.replaceAll('"', '""')}"`;
const lines = [
  "-- ESQUEMA INFERIDO das tipagens geradas; conferir antes de aplicar.",
  "-- Instância nova apenas. Nunca aplicar sobre o banco original.",
  "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
  "CREATE EXTENSION IF NOT EXISTS unaccent;",
];
for (const item of enums) {
  const name = item.name.getText(ast);
  const values = [...item.type.getText(ast).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (!values.length) continue;
  lines.push(`CREATE TYPE public.${quote(name)} AS ENUM (${values.map((v) => `'${v.replaceAll("'", "''")}'`).join(", ")});`);
}

const deferred = [];
for (const table of tables) {
  const name = table.name.getText(ast);
  if (alreadyCreated.has(name)) continue;
  const row = members(property(table.type, "Row"));
  const insert = members(property(table.type, "Insert"));
  const optional = new Set(insert.filter((m) => m.questionToken).map((m) => m.name.getText(ast)));
  const columns = row.map((col) => {
    const colName = col.name.getText(ast);
    const type = columnType(name, colName, col.type);
    const nullable = col.type.getText(ast).includes("null");
    let defaultValue = "";
    if (colName === "id" && type === "uuid" && name !== "usuarios_crm") defaultValue = " DEFAULT gen_random_uuid()";
    else if (optional.has(colName) && !nullable) {
      if (type === "timestamptz") defaultValue = " DEFAULT now()";
      else if (type === "boolean") defaultValue = " DEFAULT false";
      else if (type === "jsonb") defaultValue = " DEFAULT '{}'::jsonb";
      else if (type.endsWith("[]")) defaultValue = ` DEFAULT '{}'::${type}`;
      else if (type === "numeric") defaultValue = " DEFAULT 0";
      // Domínios e textos sem default documentado ficam nullable até revisão.
    }
    const required = !nullable && (!optional.has(colName) || defaultValue);
    return `  ${quote(colName)} ${type}${defaultValue}${required ? " NOT NULL" : ""}${colName === "id" ? " PRIMARY KEY" : ""}`;
  });
  if (name === "usuarios_crm") {
    const id = columns.findIndex((c) => c.includes('"id"'));
    if (id >= 0) columns[id] = columns[id].replace(" PRIMARY KEY", " PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE");
  }
  if (name === "alunos_acesso") columns.push('  CONSTRAINT "alunos_acesso_pkey" PRIMARY KEY ("aluno_id")');
  lines.push(`CREATE TABLE public.${quote(name)} (\n${columns.join(",\n")}\n);`);
  lines.push(`ALTER TABLE public.${quote(name)} ENABLE ROW LEVEL SECURITY;`);
  lines.push(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${quote(name)} TO authenticated;`);
  lines.push(`GRANT ALL ON public.${quote(name)} TO service_role;`);
  const rel = property(table.type, "Relationships")?.type?.elements ?? [];
  for (const r of rel) {
    if (!ts.isTypeLiteralNode(r)) continue;
    const fk = property(r, "foreignKeyName")?.type?.getText(ast).replaceAll('"', "");
    const target = property(r, "referencedRelation")?.type?.getText(ast).replaceAll('"', "");
    const cols = property(r, "columns")?.type?.getText(ast).match(/"([a-z_]+)"/g)?.map((x) => x.replaceAll('"', "")) ?? [];
    const refs = property(r, "referencedColumns")?.type?.getText(ast).match(/"([a-z_]+)"/g)?.map((x) => x.replaceAll('"', "")) ?? [];
    if (fk && target && cols.length && refs.length && !target.includes("view"))
      deferred.push(`ALTER TABLE public.${quote(name)} ADD CONSTRAINT ${quote(fk)} FOREIGN KEY (${cols.map(quote).join(", ")}) REFERENCES public.${quote(target)} (${refs.map(quote).join(", ")});`);
  }
}
lines.push("-- As relações abaixo foram extraídas das tipagens e exigem conferência de tipos.");
lines.push(...deferred);
lines.push('ALTER TABLE public.alunos_acesso ADD CONSTRAINT alunos_acesso_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES public.alunos(id) ON DELETE CASCADE;');
lines.push('CREATE UNIQUE INDEX IF NOT EXISTS formularios_token_key ON public.formularios(token);');
lines.push('CREATE INDEX IF NOT EXISTS alunos_whatsapp_idx ON public.alunos(whatsapp);');
lines.push('CREATE INDEX IF NOT EXISTS jobs_disparos_pendentes_idx ON public.jobs_disparos(agendado_para) WHERE executado = false;');
for (const [table, columns] of [
  ["workflow_config", "chave"], ["prompts_ia", "tipo"],
  ["transacoes", "fitid,banco"], ["aluno_atividades_dia", "aluno_id,data_referencia,tipo"],
  ["aluno_refeicoes_log", "aluno_id,data_referencia,refeicao_id"],
  ["daily_checkins", "aluno_id,data_checkin"],
  ["photo_audit_logs", "formulario_id,original_url"],
  ["aluno_push_subscriptions", "endpoint"],
  ["zapi_webhook_eventos", "chave_idempotencia"],
]) lines.push(`CREATE UNIQUE INDEX ${table}_${columns.replaceAll(",", "_")}_key ON public.${table}(${columns});`);
fs.writeFileSync("supabase/migrations/20260101000000_inferido_core.sql", lines.join("\n\n") + "\n");
console.log(`Geradas ${tables.length - [...tables].filter((t) => alreadyCreated.has(t.name.getText(ast))).length} tabelas; ${deferred.length} relações.`);
