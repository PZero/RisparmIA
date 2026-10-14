import { useState } from 'preact/hooks';
import { getCategory } from '../lib/categories';
import type { VaultState } from '../lib/types';
import {
  deleteAllTransactions,
  deleteRule,
  exportBackup,
  importBackup,
  lock,
  signOut,
  updateSettings,
  wipeAccount
} from '../state';

interface Props {
  vault: VaultState;
  demo: boolean;
  email: string | null;
  notify: (msg: string) => void;
}

export function Settings({ vault, demo, email, notify }: Props) {
  const { settings, rules } = vault;
  const [restorePass, setRestorePass] = useState('');

  async function download() {
    const blob = await exportBackup();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `risparmia-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    notify('Backup cifrato scaricato. Senza la passphrase è illeggibile.');
  }

  async function restore(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const added = await importBackup(await file.text(), restorePass);
      notify(`Backup ripristinato: ${added} movimenti aggiunti.`);
      setRestorePass('');
    } catch (err) {
      notify((err as Error).message);
    }
  }

  return (
    <div class="stack">
      <section class="card">
        <h2>Account</h2>
        {demo ? (
          <p>Stai usando la <strong>modalità demo</strong> con dati inventati. Nulla viene salvato.</p>
        ) : (
          <p>Accesso con <strong>{email}</strong>. I dati sono cifrati con la tua passphrase prima di arrivare su Firebase.</p>
        )}
        <div class="row">
          {!demo && <button onClick={lock}>Blocca ora</button>}
          <button class="ghost" onClick={signOut}>{demo ? 'Esci dalla demo' : 'Esci'}</button>
        </div>
      </section>

      <section class="card">
        <h2>Famiglia e calcoli</h2>
        <label class="field">
          <span>Persone nel nucleo familiare</span>
          <input
            type="number" min={1} max={10} value={settings.householdSize}
            onChange={(e) => updateSettings({ householdSize: Math.max(1, Number((e.target as HTMLInputElement).value) || 1) })}
          />
        </label>
        <label class="field">
          <span>Obiettivo di risparmio (% delle entrate)</span>
          <input
            type="number" min={0} max={89} step={1}
            value={settings.savingsTarget === null ? '' : Math.round(settings.savingsTarget * 100)}
            placeholder="non impostato"
            onChange={(e) => {
              const v = Number((e.target as HTMLInputElement).value);
              updateSettings({ savingsTarget: v > 0 && v < 90 ? v / 100 : null });
            }}
          />
        </label>
        <label class="field">
          <span>Mesi su cui misurare l'avvicinamento all'obiettivo</span>
          <select
            value={settings.targetWindowMonths}
            onChange={(e) => updateSettings({ targetWindowMonths: Number((e.target as HTMLSelectElement).value) })}
          >
            {[1, 3, 6, 12].map((n) => <option key={n} value={n}>{n === 1 ? 'ultimo mese' : `ultimi ${n} mesi`}</option>)}
          </select>
        </label>
        <label class="field">
          <span>Mesi per calcolare la spesa "abituale"</span>
          <select
            value={settings.baselineMonths}
            onChange={(e) => updateSettings({ baselineMonths: Number((e.target as HTMLSelectElement).value) })}
          >
            {[3, 6, 12].map((n) => <option key={n} value={n}>{n} mesi</option>)}
          </select>
        </label>
      </section>

      <section class="card">
        <h2>Le tue regole di categoria</h2>
        {rules.length === 0 ? (
          <p class="muted">Nessuna regola. Si creano da sole quando correggi la categoria di un movimento.</p>
        ) : (
          <ul class="rules" role="list">
            {rules.map((r) => (
              <li key={r.id}>
                <span><strong>{r.match}</strong> → {getCategory(r.categoryId).label}</span>
                <button class="ghost small" onClick={() => deleteRule(r.id)} aria-label={`Elimina regola ${r.match}`}>Elimina</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!demo && (
        <section class="card">
          <h2>Backup</h2>
          <p class="muted">
            Il backup è cifrato con la tua passphrase. Conservalo in un posto sicuro: è l'unico modo per recuperare i dati
            se cancelli l'account.
          </p>
          <div class="row">
            <button onClick={download}>Scarica backup cifrato</button>
          </div>
          <label class="field">
            <span>Ripristina da backup (serve la passphrase con cui è stato creato)</span>
            <input type="password" value={restorePass} autoComplete="off"
              onInput={(e) => setRestorePass((e.target as HTMLInputElement).value)} placeholder="Passphrase del backup" />
          </label>
          <label class="file-drop small">
            <input type="file" accept="application/json,.json" disabled={!restorePass} onChange={restore} />
            <span>{restorePass ? 'Scegli il file di backup' : 'Inserisci prima la passphrase'}</span>
          </label>
        </section>
      )}

      <section class="card danger-zone">
        <h2>Zona pericolosa</h2>
        <div class="row">
          <button class="danger" onClick={() => {
            if (confirm(`Eliminare tutti i ${vault.transactions.length} movimenti? Le regole restano.`)) {
              deleteAllTransactions().then(() => notify('Movimenti eliminati.'));
            }
          }}>Elimina tutti i movimenti</button>
          {!demo && (
            <button class="danger" onClick={() => {
              if (confirm('Cancellare definitivamente account, dati e passphrase da Firebase? Senza un backup non si torna indietro.')) {
                wipeAccount().then(() => notify('Account cancellato.'));
              }
            }}>Cancella tutto l'account</button>
          )}
        </div>
      </section>
    </div>
  );
}
