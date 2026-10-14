import { KIND_DEFAULT, MERCHANT_DICTIONARY } from './categories';
import { cleanText, merchantKey } from './normalize';
import type { CategoryId, OperationKind, Transaction, UserRule } from './types';

export interface CategoryMatch {
  categoryId: CategoryId;
  source: Transaction['categorySource'];
}

/** Chiavi del dizionario ordinate dalla più lunga: vince la corrispondenza più specifica. */
const DICTIONARY_KEYS = Object.keys(MERCHANT_DICTIONARY).sort((a, b) => b.length - a.length);

/** Cerca `needle` come sequenza di parole intere dentro `haystack` (entrambi già ripuliti). */
function containsWords(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

export function matchDictionary(description: string): CategoryId | null {
  const key = merchantKey(description);
  for (const k of DICTIONARY_KEYS) {
    if (containsWords(key, k)) return MERCHANT_DICTIONARY[k];
  }
  return null;
}

/**
 * Ordine di priorità:
 *  1. regole dell'utente (ogni correzione manuale ne crea una)
 *  2. tipo di operazione "forte" (stipendio, commissioni, prelievi, saldo carta)
 *  3. dizionario esercenti
 *  4. tipo di operazione generico (bonifici)
 *  5. "Da classificare"
 */
export function categorize(
  description: string,
  kind: OperationKind,
  amount: number,
  rules: UserRule[]
): CategoryMatch {
  // Le regole si confrontano con il testo ripulito dal rumore (date, carte, codici),
  // lo stesso da cui deriva il nome esercente su cui l'utente crea la regola.
  const cleaned = merchantKey(description);
  for (const r of rules) {
    const m = cleanText(r.match);
    if (m && containsWords(cleaned, m)) return { categoryId: r.categoryId, source: 'user-rule' };
  }

  if (kind === 'salary' || kind === 'fee' || kind === 'atm' || kind === 'card_settlement') {
    return { categoryId: KIND_DEFAULT[kind]!, source: 'kind' };
  }

  // Un importo positivo da un esercente noto è un rimborso: resta nella sua
  // categoria e ne riduce la spesa netta.
  const dict = matchDictionary(description);
  if (dict) return { categoryId: dict, source: 'dictionary' };

  const byKind = KIND_DEFAULT[kind];
  if (byKind) return { categoryId: byKind, source: 'kind' };
  if (amount > 0) return { categoryId: 'stipendio', source: 'kind' };

  return { categoryId: 'altro', source: 'fallback' };
}

/** Riapplica le regole a tutti i movimenti, senza toccare quelli corretti a mano. */
export function recategorizeAll(transactions: Transaction[], rules: UserRule[]): Transaction[] {
  return transactions.map((t) => {
    if (t.categorySource === 'manual') return t;
    const m = categorize(t.description, t.kind, t.amount, rules);
    return { ...t, categoryId: m.categoryId, categorySource: m.source };
  });
}
