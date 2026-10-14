/**
 * Lettura degli estratti conto in CSV (UniCredit e, in generale, banche italiane).
 * Il file viene letto solo nel browser: nessun dato esce dal dispositivo.
 *
 * Gestisce:
 *  - separatore ; , o tabulazione (rilevato automaticamente)
 *  - righe di intestazione del conto prima della tabella (ignorate, compreso l'IBAN)
 *  - importo unico con segno, oppure colonne separate Entrate/Uscite (Dare/Avere)
 *  - numeri all'italiana ("-1.234,56") e date gg/mm/aaaa
 */

export interface RawRow {
  date: string; // ISO yyyy-mm-dd
  amount: number;
  description: string;
}

export interface ColumnMapping {
  date: number;
  description: number[];
  amount?: number;
  debit?: number;
  credit?: number;
}

export interface CsvParseResult {
  rows: RawRow[];
  mapping: ColumnMapping;
  headers: string[];
  skipped: number;
  warnings: string[];
}

export class CsvFormatError extends Error {}

/** Divide il testo in righe e celle, rispettando le virgolette. */
export function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 30).join('\n');
  const counts = [';', '\t', ','].map((d) => ({ d, n: sample.split(d).length - 1 }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ';';
}

/** "-1.234,56" → -1234.56 ; "1234.56" → 1234.56 ; "1.234" → 1234 ; "" → NaN */
export function parseAmount(raw: string): number {
  let s = raw.trim().replace(/\s|€|EUR/gi, '');
  if (!s) return NaN;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { negative = true; s = s.slice(0, -1); }
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  if (!/^\d*\.?\d+$/.test(s)) return NaN;
  const n = Number(s);
  return negative ? -n : n;
}

/** "12/09/2026", "12-09-26", "2026-09-12" → "2026-09-12" ; non valida → null */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    if (y < 100) y += 2000;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function norm(h: string): string {
  return h.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]+/g, ' ').trim();
}

function findCol(headers: string[], patterns: RegExp[]): number {
  for (const p of patterns) {
    const i = headers.findIndex((h) => p.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

/** Riconosce le colonne da un'intestazione. Restituisce null se non è una riga di intestazione. */
export function detectMapping(rawHeaders: string[]): ColumnMapping | null {
  const h = rawHeaders.map(norm);
  const date = findCol(h, [/^DATA (REGISTRAZIONE|CONTABILE|OPERAZIONE)/, /^DATA$/, /^DATA (?!VALUTA)/, /^DATA/]);
  const amount = findCol(h, [/^IMPORTO/, /^AMMONTARE/, /^AMOUNT/]);
  const debit = findCol(h, [/^USCITE?/, /^DARE/, /^ADDEBIT/, /^DEBIT/]);
  const credit = findCol(h, [/^ENTRATE?/, /^AVERE/, /^ACCREDIT/, /^CREDIT/]);
  const description = ['DESCRIZIONE', 'CAUSALE', 'DETTAGL', 'MOTIVO', 'BENEFICIARIO', 'ESERCENTE']
    .map((k) => h.findIndex((x) => x.startsWith(k)))
    .filter((i, idx, arr) => i >= 0 && arr.indexOf(i) === idx)
    .sort((a, b) => a - b); // nell'ordine delle colonne del file

  if (date < 0 || description.length === 0) return null;
  if (amount >= 0) return { date, description, amount };
  if (debit >= 0 || credit >= 0) {
    return { date, description, debit: debit >= 0 ? debit : undefined, credit: credit >= 0 ? credit : undefined };
  }
  return null;
}

export function parseBankCsv(text: string): CsvParseResult {
  const clean = text.replace(/^﻿/, '');
  const delimiter = detectDelimiter(clean);
  const table = splitCsv(clean, delimiter);

  // L'intestazione può non essere la prima riga (UniCredit mette prima i dati del conto).
  let headerIndex = -1;
  let mapping: ColumnMapping | null = null;
  for (let i = 0; i < Math.min(table.length, 40); i++) {
    mapping = detectMapping(table[i]);
    if (mapping) { headerIndex = i; break; }
  }
  if (!mapping) {
    throw new CsvFormatError(
      'Non trovo le colonne Data, Descrizione e Importo (o Entrate/Uscite). Esporta i movimenti in formato CSV dall\'home banking e riprova.'
    );
  }

  const headers = table[headerIndex];
  const rows: RawRow[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  for (const cells of table.slice(headerIndex + 1)) {
    const date = parseDate(cells[mapping.date] ?? '');
    let amount: number;
    if (mapping.amount !== undefined) {
      amount = parseAmount(cells[mapping.amount] ?? '');
    } else {
      const out = mapping.debit !== undefined ? parseAmount(cells[mapping.debit] ?? '') : NaN;
      const inc = mapping.credit !== undefined ? parseAmount(cells[mapping.credit] ?? '') : NaN;
      amount = (Number.isNaN(inc) ? 0 : Math.abs(inc)) - (Number.isNaN(out) ? 0 : Math.abs(out));
      if (Number.isNaN(out) && Number.isNaN(inc)) amount = NaN;
    }
    const description = mapping.description
      .map((i) => (cells[i] ?? '').trim())
      .filter(Boolean)
      .join(' - ');

    // Righe di totale, saldo o note in fondo al file: le saltiamo.
    if (!date || Number.isNaN(amount) || amount === 0 || !description) { skipped++; continue; }
    if (/^SALDO\b/i.test(description)) { skipped++; continue; }
    rows.push({ date, amount: Math.round(amount * 100) / 100, description });
  }

  if (rows.length === 0) warnings.push('Il file non contiene movimenti leggibili.');
  if (skipped > 0) warnings.push(`${skipped} righe ignorate (totali, saldi o righe incomplete).`);
  return { rows, mapping, headers, skipped, warnings };
}
