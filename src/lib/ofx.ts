/**
 * Parser OFX simples — suporta SGML (OFX 1.x, mais comum em bancos BR)
 * e XML (OFX 2.x). Extrai apenas as transações (STMTTRN).
 */
export interface OfxTransacao {
  fitid: string;
  data: string;          // ISO yyyy-mm-dd
  valor: number;         // negativo = débito, positivo = crédito
  tipo_ofx: string;      // CREDIT / DEBIT / etc
  descricao: string;
  memo: string;
}

export interface OfxResultado {
  banco: string | null;
  conta: string | null;
  transacoes: OfxTransacao[];
}

/** Limpa o conteúdo SGML para algo parseável: cada tag em uma linha. */
function normalizar(texto: string): string {
  // Remove header SGML (linhas até primeira tag <)
  const idx = texto.indexOf("<");
  if (idx === -1) return "";
  let body = texto.slice(idx);
  // Insere quebra de linha antes de cada tag de abertura para facilitar regex
  body = body.replace(/></g, ">\n<");
  return body;
}

/** Extrai valor de uma tag SGML <TAG>valor (sem tag de fechamento obrigatória). */
function getTag(linha: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i");
  const m = linha.match(re);
  return m ? m[1].trim() : null;
}

/** Converte data OFX (YYYYMMDD ou YYYYMMDDHHMMSS[.fff][TZ]) → yyyy-mm-dd */
function parseData(s: string): string {
  const limpo = s.replace(/\[.+?\]/g, "").trim();
  const y = limpo.slice(0, 4);
  const m = limpo.slice(4, 6);
  const d = limpo.slice(6, 8);
  return `${y}-${m}-${d}`;
}

export function parseOFX(texto: string): OfxResultado {
  const norm = normalizar(texto);
  const linhas = norm.split(/\r?\n/);

  // Banco / conta
  let banco: string | null = null;
  let conta: string | null = null;
  for (const l of linhas) {
    if (!banco) banco = getTag(l, "BANKID") ?? getTag(l, "ORG") ?? null;
    if (!conta) conta = getTag(l, "ACCTID") ?? null;
    if (banco && conta) break;
  }

  // Transações: agrupa entre <STMTTRN> e </STMTTRN>
  const transacoes: OfxTransacao[] = [];
  let bloco: string[] | null = null;
  for (const raw of linhas) {
    const l = raw.trim();
    if (!l) continue;
    if (/^<STMTTRN>/i.test(l)) { bloco = []; continue; }
    if (/^<\/STMTTRN>/i.test(l)) {
      if (bloco) {
        const join = bloco.join("\n");
        const fitid = getTag(join, "FITID") ?? `${Date.now()}-${Math.random()}`;
        const dt = getTag(join, "DTPOSTED") ?? "";
        const vlr = Number(getTag(join, "TRNAMT") ?? "0");
        const tipo_ofx = getTag(join, "TRNTYPE") ?? "OTHER";
        const memo = getTag(join, "MEMO") ?? "";
        const name = getTag(join, "NAME") ?? "";
        transacoes.push({
          fitid,
          data: dt ? parseData(dt) : new Date().toISOString().slice(0, 10),
          valor: isNaN(vlr) ? 0 : vlr,
          tipo_ofx,
          descricao: name || memo || "(sem descrição)",
          memo,
        });
      }
      bloco = null;
      continue;
    }
    if (bloco) bloco.push(l);
  }

  return { banco, conta, transacoes };
}