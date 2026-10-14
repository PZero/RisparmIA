import { categorize } from './categorize';
import type { RawRow } from './csv';
import { detectKind, extractMerchant } from './normalize';
import type { Transaction, UserRule } from './types';

/** Hash a 53 bit (cyrb53), sufficiente per riconoscere i duplicati. Non è crittografico. */
export function hash(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Trasforma le righe del CSV in movimenti. Due movimenti identici nello stesso
 * giorno (es. due caffè uguali) restano distinti grazie al contatore di occorrenza.
 */
export function buildTransactions(rows: RawRow[], rules: UserRule[]): Transaction[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = `${r.date}|${r.amount.toFixed(2)}|${r.description.trim().toUpperCase()}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const kind = detectKind(r.description, r.amount);
    const match = categorize(r.description, kind, r.amount, rules);
    return {
      id: hash(`${base}|${n}`),
      date: r.date,
      amount: r.amount,
      description: r.description.trim(),
      kind,
      merchant: extractMerchant(r.description),
      categoryId: match.categoryId,
      categorySource: match.source
    };
  });
}

export interface MergeResult {
  transactions: Transaction[];
  added: number;
  duplicates: number;
}

/** Aggiunge i nuovi movimenti a quelli esistenti, scartando quelli già importati. */
export function mergeTransactions(existing: Transaction[], incoming: Transaction[]): MergeResult {
  const ids = new Set(existing.map((t) => t.id));
  const fresh = incoming.filter((t) => !ids.has(t.id));
  const transactions = [...existing, ...fresh].sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)
  );
  return { transactions, added: fresh.length, duplicates: incoming.length - fresh.length };
}
