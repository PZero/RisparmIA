/**
 * Cifratura lato client (end-to-end).
 *
 * - La chiave AES-GCM a 256 bit viene derivata dalla passphrase con PBKDF2-SHA256
 *   (600.000 iterazioni, valore raccomandato da OWASP) e un sale casuale per utente.
 * - La chiave non è estraibile e non lascia mai il browser: su Firestore arrivano
 *   solo { iv, ct } in base64. Né Google né chi amministra il progetto può leggere i dati.
 * - Ogni cifratura usa un IV casuale nuovo di 96 bit.
 */

export const PBKDF2_ITERATIONS = 600_000;
const CHECK_PLAINTEXT = 'risparmia:passphrase-ok:v1';

export interface EncryptedBlob {
  v: 1;
  iv: string;
  ct: string;
}

export interface CryptoMeta {
  v: 1;
  salt: string;
  iterations: number;
  /** Testo noto cifrato: permette di verificare la passphrase senza conservarla. */
  check: EncryptedBlob;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n));
}

export async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFC')), 'PBKDF2', false, [
    'deriveKey'
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJSON(key: CryptoKey, value: unknown): Promise<EncryptedBlob> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value)));
  return { v: 1, iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) };
}

export async function decryptJSON<T>(key: CryptoKey, blob: EncryptedBlob): Promise<T> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(blob.iv) }, key, fromBase64(blob.ct));
  return JSON.parse(dec.decode(pt)) as T;
}

/** Prima configurazione: genera il sale e il verificatore della passphrase. */
export async function createCryptoMeta(passphrase: string): Promise<{ meta: CryptoMeta; key: CryptoKey }> {
  const salt = randomBytes(16);
  const key = await deriveKey(passphrase, salt);
  const check = await encryptJSON(key, CHECK_PLAINTEXT);
  return { meta: { v: 1, salt: toBase64(salt), iterations: PBKDF2_ITERATIONS, check }, key };
}

/** Sblocco: deriva la chiave e verifica che la passphrase sia corretta. */
export async function unlockWithPassphrase(passphrase: string, meta: CryptoMeta): Promise<CryptoKey | null> {
  const key = await deriveKey(passphrase, fromBase64(meta.salt), meta.iterations);
  try {
    const value = await decryptJSON<string>(key, meta.check);
    return value === CHECK_PLAINTEXT ? key : null;
  } catch {
    return null;
  }
}

/** Valutazione semplice della robustezza: lunghezza e varietà. */
export function passphraseStrength(p: string): { ok: boolean; message: string } {
  if (p.length < 12) return { ok: false, message: 'Usa almeno 12 caratteri (meglio una frase di 4-5 parole).' };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (p.length < 16 && classes < 3) return { ok: false, message: 'Aggiungi maiuscole, numeri o simboli, oppure allungala.' };
  return { ok: true, message: 'Passphrase robusta.' };
}
