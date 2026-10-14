import { useState } from 'preact/hooks';
import { passphraseStrength } from '../lib/crypto';
import { isFirebaseConfigured } from '../lib/firebase';
import { signIn, signOut, setupPassphrase, startDemo, unlock, type Phase } from '../state';

/** Schermate prima dell'app: accesso, creazione passphrase, sblocco. */
export function Gate({ phase, email, error }: { phase: Phase; email: string | null; error: string | null }) {
  return (
    <main class="gate">
      <div class="gate-card card">
        <div class="brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="48" height="48" />
          <h1>RisparmIA</h1>
        </div>
        {phase === 'loading' && <p class="muted">Caricamento…</p>}
        {phase === 'signedOut' && <Welcome />}
        {phase === 'needsSetup' && <Setup email={email} />}
        {phase === 'locked' && <Unlock email={email} />}
        {error && <p class="error" role="alert">{error}</p>}
      </div>
    </main>
  );
}

function Welcome() {
  return (
    <>
      <p class="lead">Il portafoglio di famiglia che ti propone come risparmiare, e verifica se ci stai riuscendo.</p>
      <ul class="bullets">
        <li>Importi l'estratto conto UniCredit in CSV</li>
        <li>Le spese vengono classificate da sole e imparano dalle tue correzioni</li>
        <li>I dati sono cifrati sul tuo dispositivo: nessun altro può leggerli</li>
      </ul>
      <div class="stack-sm">
        {isFirebaseConfigured && <button class="primary" onClick={signIn}>Accedi con Google</button>}
        <button class={isFirebaseConfigured ? 'ghost' : 'primary'} onClick={startDemo}>Prova con dati di esempio</button>
      </div>
      {!isFirebaseConfigured && (
        <p class="muted small">Questa build non è collegata a Firebase: è disponibile solo la demo.</p>
      )}
    </>
  );
}

function Setup({ email }: { email: string | null }) {
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const strength = passphraseStrength(p1);
  const ready = strength.ok && p1 === p2 && understood && !busy;

  async function submit(e: Event) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    await setupPassphrase(p1);
  }

  return (
    <form onSubmit={submit} class="stack-sm">
      <p>Ciao {email}. Scegli una <strong>passphrase</strong>: servirà a cifrare i tuoi dati prima che lascino questo dispositivo.</p>
      <input type="password" autoComplete="new-password" placeholder="Passphrase (es. 4-5 parole a caso)"
        value={p1} onInput={(e) => setP1((e.target as HTMLInputElement).value)} />
      {p1 && <p class={`small ${strength.ok ? 'pos' : 'warn-text'}`}>{strength.message}</p>}
      <input type="password" autoComplete="new-password" placeholder="Ripeti la passphrase"
        value={p2} onInput={(e) => setP2((e.target as HTMLInputElement).value)} />
      {p2 && p1 !== p2 && <p class="small warn-text">Le due passphrase non coincidono.</p>}
      <label class="check">
        <input type="checkbox" checked={understood} onChange={(e) => setUnderstood((e.target as HTMLInputElement).checked)} />
        Ho capito che se perdo la passphrase nessuno, nemmeno lo sviluppatore, può recuperare i dati.
      </label>
      <button class="primary" type="submit" disabled={!ready}>{busy ? 'Preparo la cassaforte…' : 'Crea la cassaforte'}</button>
      <button class="ghost" type="button" onClick={signOut}>Esci</button>
    </form>
  );
}

function Unlock({ email }: { email: string | null }) {
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true);
    const ok = await unlock(p);
    setBusy(false);
    if (!ok) { setWrong(true); setP(''); }
  }

  return (
    <form onSubmit={submit} class="stack-sm">
      <p>Bentornato {email}. Inserisci la passphrase per aprire i tuoi dati.</p>
      <input type="password" autoComplete="current-password" autoFocus placeholder="Passphrase"
        value={p} onInput={(e) => { setP((e.target as HTMLInputElement).value); setWrong(false); }} />
      {wrong && <p class="small warn-text">Passphrase non corretta.</p>}
      <button class="primary" type="submit" disabled={!p || busy}>{busy ? 'Sblocco…' : 'Sblocca'}</button>
      <button class="ghost" type="button" onClick={signOut}>Cambia account</button>
    </form>
  );
}
