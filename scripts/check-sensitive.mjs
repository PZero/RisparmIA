#!/usr/bin/env node
/**
 * Controllo anti-dati sensibili per un repository PUBBLICO.
 * Blocca il commit (o la CI) se trova IBAN reali, numeri di carta, chiavi private,
 * token o file di estratto conto fuori dalle cartelle di dati sintetici.
 *
 * Uso:
 *   node scripts/check-sensitive.mjs            # file in staging (hook pre-commit)
 *   node scripts/check-sensitive.mjs --all      # tutti i file tracciati (CI)
 */
import { execFileSync } from 'node:child_process';

const all = process.argv.includes('--all');
const files = execFileSync('git', all ? ['ls-files'] : ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
  encoding: 'utf8'
})
  .split('\n')
  .filter(Boolean);

/** Cartelle dove sono ammessi solo dati inventati, controllati a mano. */
const SYNTHETIC_DIRS = ['tests/fixtures/'];
/** Nomi di file vietati anche se forzati con `git add -f`. */
const FORBIDDEN_NAMES = [
  /(^|\/)\.firebaserc$/,
  /(^|\/)service-account[^/]*\.json$/i,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)(risparmia-)?backup[^/]*\.json$/i
];
const SKIP = [/^package-lock\.json$/, /\.(png|jpg|jpeg|gif|ico|woff2?)$/i, /^scripts\/check-sensitive\.mjs$/];

/** IBAN italiano valido secondo il controllo mod-97 (quelli finti di esempio non lo superano). */
function isValidIban(iban) {
  const s = iban.replace(/\s/g, '').toUpperCase();
  const rearranged = s.slice(4) + s.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const d of digits) rem = (rem * 10 + Number(d)) % 97;
  return rem === 1;
}

/** Numero di carta valido secondo Luhn. */
function isLuhn(num) {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

const CHECKS = [
  { name: 'IBAN valido', re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/gi, test: (m) => isValidIban(m) },
  { name: 'numero di carta', re: /\b(?:\d[ -]?){15,16}\b/g, test: (m) => isLuhn(m.replace(/\D/g, '')) },
  { name: 'chiave privata', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'chiave API Anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'token GitHub', re: /\b(?:ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9_]{20,}/g },
  { name: 'chiave API Google', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'codice fiscale', re: /\b[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]\b/g }
];

const problems = [];
for (const file of files) {
  const f = file.replace(/\\/g, '/');
  if (SKIP.some((r) => r.test(f))) continue;
  const synthetic = SYNTHETIC_DIRS.some((d) => f.startsWith(d));
  if (/\.(csv|xlsx?|ofx|qif)$/i.test(f) && !synthetic) {
    problems.push(`${f}: file di movimenti fuori da ${SYNTHETIC_DIRS.join(', ')}`);
    continue;
  }
  if (/(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example')) {
    problems.push(`${f}: file .env con possibili segreti`);
    continue;
  }
  if (FORBIDDEN_NAMES.some((r) => r.test(f))) {
    problems.push(`${f}: file che non deve mai stare nel repository`);
    continue;
  }
  // Si legge la versione nell'indice di git (quella che finisce nel commit),
  // non quella su disco: con uno staging parziale potrebbero essere diverse.
  let text;
  try {
    text = execFileSync('git', ['show', `:${f}`], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  } catch {
    problems.push(`${f}: impossibile leggerlo dall'indice di git`);
    continue;
  }
  for (const c of CHECKS) {
    for (const m of text.matchAll(c.re)) {
      if (!c.test || c.test(m[0])) problems.push(`${f}: ${c.name} → "${m[0].slice(0, 6)}…"`);
    }
  }
}

if (problems.length) {
  console.error('\n✖ Possibili dati sensibili. Questo repository è PUBBLICO: correggi prima di procedere.\n');
  for (const p of problems) console.error('  - ' + p);
  console.error('\nSe è un falso positivo su dati inventati, spostali in tests/fixtures/ e verifica a mano.\n');
  process.exit(1);
}
console.log(`✓ Nessun dato sensibile trovato (${files.length} file controllati).`);
