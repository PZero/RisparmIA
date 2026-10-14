/** Identificativo di categoria (vedi categories.ts). */
export type CategoryId = string;

/** Tipo di operazione dedotto dalla descrizione bancaria. */
export type OperationKind =
  | 'pos'          // pagamento con carta presso esercente
  | 'online'       // pagamento e-commerce
  | 'sdd'          // addebito diretto SEPA (utenze, abbonamenti)
  | 'transfer_out' // bonifico in uscita
  | 'transfer_in'  // bonifico in entrata
  | 'salary'       // stipendio / pensione
  | 'atm'          // prelievo contante
  | 'fee'          // commissioni, canoni, bolli
  | 'card_settlement' // addebito saldo carta di credito
  | 'other';

/**
 * Riga di acquisto (scontrino). Prevista dalla Fase 2: il modello dati la
 * supporta già, così l'aggiunta degli scontrini non richiede migrazioni.
 */
export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  categoryId?: CategoryId;
}

export interface Transaction {
  /** Hash stabile di data+importo+descrizione+occorrenza: serve a evitare duplicati. */
  id: string;
  /** Data contabile, formato ISO yyyy-mm-dd. */
  date: string;
  /** Importo con segno: negativo = uscita, positivo = entrata. In euro. */
  amount: number;
  /** Descrizione originale della banca. */
  description: string;
  kind: OperationKind;
  /** Esercente o controparte, ripulito (es. "ESSELUNGA"). */
  merchant: string;
  categoryId: CategoryId;
  /** Come è stata assegnata la categoria. */
  categorySource: 'dictionary' | 'user-rule' | 'manual' | 'kind' | 'ai' | 'fallback';
  /** Righe di acquisto collegate (Fase 2). */
  items?: ReceiptItem[];
  /** Nota libera dell'utente. */
  note?: string;
}

/** Regola definita dall'utente: se l'esercente contiene `match`, usa `categoryId`. */
export interface UserRule {
  id: string;
  match: string;
  categoryId: CategoryId;
  createdAt: string;
}

export interface Settings {
  currency: 'EUR';
  /** Numero di componenti del nucleo familiare (per i benchmark). */
  householdSize: number;
  /** Mesi usati per calcolare la baseline. */
  baselineMonths: number;
  /** Obiettivo: quota delle entrate da mettere da parte (0.15 = 15%). null = non impostato. */
  savingsTarget: number | null;
  /** Mesi completi su cui misurare l'avvicinamento all'obiettivo. */
  targetWindowMonths: number;
}

/** Stato decifrato dell'utente, tenuto solo in memoria. */
export interface VaultState {
  settings: Settings;
  rules: UserRule[];
  transactions: Transaction[];
}

export const DEFAULT_SETTINGS: Settings = {
  currency: 'EUR',
  householdSize: 1,
  baselineMonths: 6,
  savingsTarget: null,
  targetWindowMonths: 3
};
