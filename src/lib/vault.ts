import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { monthKey } from './analytics';
import { decryptJSON, encryptJSON, type CryptoMeta, type EncryptedBlob } from './crypto';
import { getDb } from './firebase';
import { DEFAULT_SETTINGS, type Settings, type Transaction, type UserRule, type VaultState } from './types';

/**
 * Archivio cifrato su Firestore:
 *   users/{uid}/meta/crypto        sale + verificatore della passphrase (non segreti)
 *   users/{uid}/vault/settings     impostazioni (cifrate)
 *   users/{uid}/vault/rules        regole di categorizzazione (cifrate)
 *   users/{uid}/vault/tx-YYYY-MM   movimenti di un mese (cifrati)
 * Un documento per mese resta ben sotto il limite di 1 MB di Firestore.
 */
export interface VaultBackend {
  loadMeta(): Promise<CryptoMeta | null>;
  saveMeta(meta: CryptoMeta): Promise<void>;
  load(key: CryptoKey): Promise<VaultState>;
  save(key: CryptoKey, state: VaultState): Promise<void>;
  wipe(): Promise<void>;
}

/** Raggruppa i movimenti per mese. */
export function splitByMonth(transactions: Transaction[]): Map<string, Transaction[]> {
  const out = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const k = monthKey(t.date);
    if (!out.has(k)) out.set(k, []);
    out.get(k)!.push(t);
  }
  return out;
}

export class FirestoreVault implements VaultBackend {
  /** Impronta dell'ultimo contenuto salvato per documento: scriviamo solo ciò che cambia. */
  private written = new Map<string, string>();

  constructor(private uid: string) {}

  private metaRef() {
    return doc(getDb(), 'users', this.uid, 'meta', 'crypto');
  }

  private vaultCol() {
    return collection(getDb(), 'users', this.uid, 'vault');
  }

  async loadMeta(): Promise<CryptoMeta | null> {
    const snap = await getDoc(this.metaRef());
    if (!snap.exists()) return null;
    const d = snap.data();
    return { v: 1, salt: d.salt, iterations: d.iterations, check: d.check };
  }

  async saveMeta(meta: CryptoMeta): Promise<void> {
    await setDoc(this.metaRef(), { ...meta, updatedAt: serverTimestamp() });
  }

  async load(key: CryptoKey): Promise<VaultState> {
    const snap = await getDocs(this.vaultCol());
    let settings: Settings = { ...DEFAULT_SETTINGS };
    let rules: UserRule[] = [];
    const transactions: Transaction[] = [];
    this.written.clear();
    for (const d of snap.docs) {
      const data = d.data();
      const blob: EncryptedBlob = { v: 1, iv: data.iv, ct: data.ct };
      const value = await decryptJSON<unknown>(key, blob);
      this.written.set(d.id, JSON.stringify(value));
      if (d.id === 'settings') settings = { ...DEFAULT_SETTINGS, ...(value as Settings) };
      else if (d.id === 'rules') rules = value as UserRule[];
      else if (d.id.startsWith('tx-')) transactions.push(...(value as Transaction[]));
    }
    transactions.sort((a, b) => b.date.localeCompare(a.date));
    return { settings, rules, transactions };
  }

  async save(key: CryptoKey, state: VaultState): Promise<void> {
    const docs = new Map<string, unknown>([
      ['settings', state.settings],
      ['rules', state.rules]
    ]);
    for (const [month, txs] of splitByMonth(state.transactions)) docs.set(`tx-${month}`, txs);

    const writes: Promise<void>[] = [];
    for (const [id, value] of docs) {
      const json = JSON.stringify(value);
      if (this.written.get(id) === json) continue;
      writes.push(
        encryptJSON(key, value).then((blob) =>
          setDoc(doc(this.vaultCol(), id), { ...blob, updatedAt: serverTimestamp() })
        )
      );
      this.written.set(id, json);
    }
    for (const id of [...this.written.keys()]) {
      if (!docs.has(id)) {
        writes.push(deleteDoc(doc(this.vaultCol(), id)));
        this.written.delete(id);
      }
    }
    await Promise.all(writes);
  }

  async wipe(): Promise<void> {
    const snap = await getDocs(this.vaultCol());
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(this.metaRef());
    this.written.clear();
  }
}

/** Archivio in memoria per la modalità demo: niente login, niente rete. */
export class MemoryVault implements VaultBackend {
  private meta: CryptoMeta | null = null;
  constructor(private state: VaultState) {}
  async loadMeta() { return this.meta; }
  async saveMeta(meta: CryptoMeta) { this.meta = meta; }
  async load() { return structuredClone(this.state); }
  async save(_key: CryptoKey, state: VaultState) { this.state = structuredClone(state); }
  async wipe() { this.state = { settings: { ...DEFAULT_SETTINGS }, rules: [], transactions: [] }; }
}
