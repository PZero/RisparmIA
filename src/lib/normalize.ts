import type { OperationKind } from './types';

/**
 * Le descrizioni UniCredit sembrano testo libero ma seguono uno schema:
 *   <tipo operazione> <dettagli: data, importo, carta> <esercente> <luogo>
 * Esempi (inventati):
 *   "PAGAMENTO POS 25,40 EUR DEL 12.09.2026 ORE 18:03 A (ITA) ESSELUNGA MILANO CARTA *1234"
 *   "ADDEBITO DIRETTO SDD ENEL ENERGIA SPA MANDATO N. 0099"
 *   "BONIFICO A VOSTRO FAVORE DISPOSTO DA ACME SRL CAUSALE STIPENDIO SETTEMBRE"
 * Qui ricaviamo il tipo di operazione e un nome esercente pulito.
 */

/** Maiuscolo, senza accenti, punteggiatura trasformata in spazi. */
export function cleanText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const KIND_PATTERNS: Array<[RegExp, OperationKind]> = [
  [/\b(STIPENDIO|EMOLUMENTI|PENSIONE|CEDOLINO|RETRIBUZIONE)\b/, 'salary'],
  [/\b(SALDO|ADDEBITO) (E C |ESTRATTO CONTO )?CARTA (DI )?CREDITO\b|\bADDEBITO CARTA CREDITO\b/, 'card_settlement'],
  [/\b(PRELIEVO|PRELEVAMENTO)\b|\bATM\b.*\b(PRELIEVO|CONTANTI)\b/, 'atm'],
  [/\b(COMMISSION[EI]|CANONE (MENSILE|CONTO|CARTA)|IMPOSTA (DI )?BOLLO|SPESE (TENUTA|INVIO|GESTIONE)|COMPETENZE)\b/, 'fee'],
  [/\b(SDD|ADDEBITO DIRETTO|ADDEBITO SEPA|RID)\b/, 'sdd'],
  [/\bBONIFICO\b.*\b(A VOSTRO FAVORE|A VS FAVORE|IN ENTRATA|RICEVUTO|DISPOSTO DA)\b|\bACCREDITO\b/, 'transfer_in'],
  [/\b(BONIFICO|GIROCONTO|GIRO)\b/, 'transfer_out'],
  [/\b(PAGAMENTO ONLINE|E COMMERCE|ECOMMERCE|INTERNET)\b/, 'online'],
  [/\b(POS|PAGAMENTO CARTA|PAGAMENTO CON CARTA|CONTACTLESS|APPLE PAY|GOOGLE PAY)\b/, 'pos']
];

export function detectKind(description: string, amount: number): OperationKind {
  const t = cleanText(description);
  for (const [re, kind] of KIND_PATTERNS) {
    if (re.test(t)) {
      // Un "bonifico" con segno positivo è comunque un'entrata.
      if (kind === 'transfer_out' && amount > 0) return 'transfer_in';
      return kind;
    }
  }
  return amount > 0 ? 'transfer_in' : 'other';
}

/** Parole di servizio da togliere per arrivare al nome dell'esercente. */
const NOISE = new Set([
  'PAGAMENTO', 'POS', 'CARTA', 'DI', 'DEBITO', 'CREDITO', 'DEL', 'ORE', 'EUR', 'ADDEBITO',
  'DIRETTO', 'SDD', 'SEPA', 'CORE', 'B2B', 'A', 'ITA', 'IT', 'CONTACTLESS', 'NFC', 'APPLE', 'PAY',
  'GOOGLE', 'ONLINE', 'ACQUISTO', 'OPERAZIONE', 'PRESSO', 'N', 'NR', 'NUM', 'RIF', 'MANDATO',
  'CRO', 'TRN', 'ID', 'BONIFICO', 'FAVORE', 'VOSTRO', 'VS', 'DISPOSTO', 'DA', 'ORDINANTE',
  'BENEFICIARIO', 'CAUSALE', 'INTERNET', 'E', 'COMMERCE', 'ECOMMERCE', 'MAESTRO', 'VISA',
  'MASTERCARD', 'DEBIT', 'GENIUS', 'CARD', 'CIRCUITO', 'DATA', 'VALUTA', 'IN', 'ENTRATA', 'USCITA',
  'SPA', 'SRL', 'SRLS', 'SNC', 'SAS', 'S', 'P', 'R', 'L', 'ADD', 'PAG', 'C', 'O'
]);

const IBAN_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;

/** True se il token non è informativo: numeri, date, importi, carte mascherate, codici. */
function isNoiseToken(tok: string): boolean {
  if (NOISE.has(tok)) return true;
  if (/^\*+\d*$/.test(tok)) return true;          // carta mascherata "*1234"
  if (/^\d+$/.test(tok)) return true;             // numeri, date spezzate, importi
  if (IBAN_RE.test(tok)) return true;             // IBAN
  if (tok.length >= 12 && /\d/.test(tok)) return true; // codici di riferimento lunghi
  return false;
}

/** Città frequenti che seguono il nome dell'esercente: le togliamo dal nome. */
const CITIES = new Set([
  'MILANO', 'ROMA', 'TORINO', 'NAPOLI', 'BOLOGNA', 'FIRENZE', 'GENOVA', 'VENEZIA', 'VERONA',
  'PADOVA', 'BRESCIA', 'BERGAMO', 'MONZA', 'PALERMO', 'BARI', 'CATANIA', 'TRIESTE', 'PARMA',
  'MODENA', 'COMO', 'VARESE', 'PAVIA', 'LECCO', 'TREVISO', 'VICENZA', 'PISA', 'LUCCA'
]);

/** Testo ripulito da tutto ciò che non identifica l'esercente: usato per il dizionario. */
export function merchantKey(description: string): string {
  return cleanText(description)
    .split(' ')
    .filter((t) => t && !isNoiseToken(t))
    .join(' ');
}

/** Nome esercente leggibile e stabile, usato per raggruppare (es. abbonamenti ricorrenti). */
export function extractMerchant(description: string): string {
  const tokens = merchantKey(description).split(' ').filter(Boolean);
  const kept: string[] = [];
  for (const t of tokens) {
    if (CITIES.has(t) && kept.length > 0) break;
    kept.push(t);
    if (kept.length === 3) break;
  }
  return kept.join(' ') || 'SCONOSCIUTO';
}
