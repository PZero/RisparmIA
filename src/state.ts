import { useEffect, useState } from 'preact/hooks';
import { recategorizeAll } from './lib/categorize';
import {
  createCryptoMeta,
  decryptJSON,
  encryptJSON,
  unlockWithPassphrase,
  type CryptoMeta,
  type EncryptedBlob
} from './lib/crypto';
import type { RawRow } from './lib/csv';
import { generateDemoRows } from './lib/demo';
import { isFirebaseConfigured, signInWithGoogle, signOutUser, watchUser } from './lib/firebase';
import { buildTransactions, hash, mergeTransactions, type MergeResult } from './lib/importer';
import { FirestoreVault, MemoryVault, type VaultBackend } from './lib/vault';
import { DEFAULT_SETTINGS, type CategoryId, type Settings, type VaultState } from './lib/types';

export type Phase = 'loading' | 'signedOut' | 'needsSetup' | 'locked' | 'ready';

export interface AppState {
  phase: Phase;
  demo: boolean;
  email: string | null;
  vault: VaultState;
  saving: boolean;
  error: string | null;
}

const EMPTY: VaultState = { settings: { ...DEFAULT_SETTINGS }, rules: [], transactions: [] };

let state: AppState = { phase: 'loading', demo: false, email: null, vault: EMPTY, saving: false, error: null };
const listeners = new Set<() => void>();

/** La chiave vive solo qui, in memoria: mai in storage, mai in rete. */
let key: CryptoKey | null = null;
let backend: VaultBackend | null = null;
let meta: CryptoMeta | null = null;

function set(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useAppState(): AppState {
  const [snapshot, setSnapshot] = useState(state);
  useEffect(() => {
    const l = () => setSnapshot(state);
    listeners.add(l);
    // Lo stato può essere cambiato tra il primo render e l'iscrizione.
    l();
    return () => listeners.delete(l);
  }, []);
  return snapshot;
}

export const getState = () => state;

// ---------------------------------------------------------------- avvio e accesso

export function initAuth(): void {
  watchUser(async (user) => {
    if (state.demo) return;
    if (!user) {
      key = null; backend = null; meta = null;
      set({ phase: 'signedOut', email: null, vault: EMPTY });
      return;
    }
    backend = new FirestoreVault(user.uid);
    set({ phase: 'loading', email: user.email });
    try {
      meta = await backend.loadMeta();
      set({ phase: meta ? 'locked' : 'needsSetup' });
    } catch (e) {
      set({ phase: 'signedOut', error: `Impossibile leggere i dati: ${(e as Error).message}` });
    }
  });
}

export async function signIn(): Promise<void> {
  set({ error: null });
  try {
    await signInWithGoogle();
  } catch (e) {
    set({ error: `Accesso non riuscito: ${(e as Error).message}` });
  }
}

export async function startDemo(): Promise<void> {
  const rows = generateDemoRows(8);
  const transactions = buildTransactions(rows, []);
  // In demo l'obiettivo è già impostato, così si vede subito il monitoraggio.
  backend = new MemoryVault({ ...EMPTY, settings: { ...DEFAULT_SETTINGS, savingsTarget: 0.15 }, transactions });
  const created = await createCryptoMeta(`demo-${crypto.randomUUID()}`);
  key = created.key;
  set({ demo: true, email: null, phase: 'ready', vault: await backend.load(key), error: null });
}

export function exitDemo(): void {
  key = null; backend = null;
  set({ demo: false, vault: EMPTY, phase: isFirebaseConfigured ? 'loading' : 'signedOut' });
  if (isFirebaseConfigured) initAuth();
}

export async function setupPassphrase(passphrase: string): Promise<void> {
  if (!backend) return;
  // Un altro dispositivo potrebbe aver già creato la cassaforte nel frattempo:
  // in quel caso si sblocca con la passphrase esistente, non se ne crea una nuova.
  const existing = await backend.loadMeta();
  if (existing) {
    meta = existing;
    set({ phase: 'locked', error: 'La cassaforte esiste già (creata da un altro dispositivo): sbloccala con quella passphrase.' });
    return;
  }
  const created = await createCryptoMeta(passphrase);
  await backend.saveMeta(created.meta);
  meta = created.meta;
  key = created.key;
  await backend.save(key, EMPTY);
  set({ phase: 'ready', vault: EMPTY });
}

export async function unlock(passphrase: string): Promise<boolean> {
  if (!backend || !meta) return false;
  const k = await unlockWithPassphrase(passphrase, meta);
  if (!k) return false;
  key = k;
  const vault = await backend.load(k);
  set({ phase: 'ready', vault, error: null });
  return true;
}

export function lock(): void {
  if (state.demo) return;
  key = null;
  set({ phase: meta ? 'locked' : 'signedOut', vault: EMPTY });
}

export async function signOut(): Promise<void> {
  if (state.demo) return exitDemo();
  key = null;
  await signOutUser();
}

// ---------------------------------------------------------------- modifiche ai dati

async function persist(vault: VaultState) {
  set({ vault, saving: true });
  try {
    if (backend && key) await backend.save(key, vault);
    set({ saving: false });
  } catch (e) {
    set({ saving: false, error: `Salvataggio non riuscito: ${(e as Error).message}` });
  }
}

export async function importRows(rows: RawRow[]): Promise<MergeResult> {
  const incoming = buildTransactions(rows, state.vault.rules);
  const result = mergeTransactions(state.vault.transactions, incoming);
  await persist({ ...state.vault, transactions: result.transactions });
  return result;
}

/**
 * Correzione manuale della categoria. Con `learn` crea una regola sull'esercente
 * e la applica subito a tutti i movimenti simili.
 */
export async function setCategory(txId: string, categoryId: CategoryId, learn: boolean): Promise<number> {
  const v = state.vault;
  const tx = v.transactions.find((t) => t.id === txId);
  if (!tx) return 0;
  let rules = v.rules;
  let transactions = v.transactions.map((t) =>
    t.id === txId ? { ...t, categoryId, categorySource: 'manual' as const } : t
  );
  let affected = 1;
  if (learn && tx.merchant !== 'SCONOSCIUTO') {
    rules = [
      { id: hash(`${tx.merchant}|${Date.now()}`), match: tx.merchant, categoryId, createdAt: new Date().toISOString() },
      ...rules.filter((r) => r.match !== tx.merchant)
    ];
    const before = transactions;
    transactions = recategorizeAll(transactions, rules);
    affected = transactions.filter((t, i) => t.categoryId !== before[i].categoryId).length + 1;
  }
  await persist({ ...v, rules, transactions });
  return affected;
}

export async function deleteRule(ruleId: string): Promise<void> {
  const rules = state.vault.rules.filter((r) => r.id !== ruleId);
  await persist({ ...state.vault, rules, transactions: recategorizeAll(state.vault.transactions, rules) });
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  await persist({ ...state.vault, settings: { ...state.vault.settings, ...patch } });
}

export async function deleteAllTransactions(): Promise<void> {
  await persist({ ...state.vault, transactions: [] });
}

/** Cancella tutto l'account su Firestore (dati e passphrase) ed esce. */
export async function wipeAccount(): Promise<void> {
  if (!backend) return;
  await backend.wipe();
  key = null; meta = null;
  if (state.demo) return exitDemo();
  set({ phase: 'needsSetup', vault: EMPTY });
}

// ---------------------------------------------------------------- backup

interface BackupFile {
  app: 'risparmia';
  version: 1;
  createdAt: string;
  meta: CryptoMeta;
  data: EncryptedBlob;
}

/** Backup cifrato con la stessa passphrase: si può conservare ovunque. */
export async function exportBackup(): Promise<Blob> {
  if (!key || !meta) throw new Error('Archivio bloccato.');
  const file: BackupFile = {
    app: 'risparmia',
    version: 1,
    createdAt: new Date().toISOString(),
    meta,
    data: await encryptJSON(key, state.vault)
  };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

export async function importBackup(text: string, passphrase: string): Promise<number> {
  const file = JSON.parse(text) as BackupFile;
  const m = file?.meta;
  const valid =
    file?.app === 'risparmia' &&
    typeof m?.salt === 'string' && Number.isInteger(m.iterations) &&
    m.iterations >= 600_000 && m.iterations <= 2_000_000 &&
    typeof m.check?.iv === 'string' && typeof m.check?.ct === 'string' &&
    typeof file.data?.iv === 'string' && typeof file.data?.ct === 'string';
  if (!valid) throw new Error('Non è un backup di RisparmIA valido.');
  const k = await unlockWithPassphrase(passphrase, file.meta);
  if (!k) throw new Error('Passphrase errata per questo backup.');
  const restored = await decryptJSON<VaultState>(k, file.data);
  if (!Array.isArray(restored?.transactions) || !Array.isArray(restored?.rules)) {
    throw new Error('Il backup è danneggiato.');
  }
  const merged = mergeTransactions(state.vault.transactions, restored.transactions);
  const ruleIds = new Set(state.vault.rules.map((r) => r.match));
  await persist({
    settings: { ...state.vault.settings, ...restored.settings },
    rules: [...state.vault.rules, ...restored.rules.filter((r) => !ruleIds.has(r.match))],
    transactions: merged.transactions
  });
  return merged.added;
}
