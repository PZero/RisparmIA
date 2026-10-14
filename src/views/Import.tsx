import { useState } from 'preact/hooks';
import { formatEur } from '../lib/analytics';
import { CsvFormatError, parseBankCsv, type CsvParseResult } from '../lib/csv';
import { demoCsv, generateDemoRows } from '../lib/demo';
import { importRows } from '../state';

interface Props {
  notify: (msg: string) => void;
  onDone: () => void;
}

/** Legge il file come testo provando prima UTF-8 e, se ci sono caratteri non validi, Windows-1252. */
async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8;
}

export function Import({ notify, onDone }: Props) {
  const [parsed, setParsed] = useState<(CsvParseResult & { fileName: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setError(null);
    setParsed(null);
    if (/\.(xlsx?|ods)$/i.test(file.name)) {
      setError('Questo è un file Excel. Aprilo e salvalo come "CSV (delimitato da punto e virgola)", poi importalo qui.');
      return;
    }
    try {
      const result = parseBankCsv(await readText(file));
      setParsed({ ...result, fileName: file.name });
    } catch (err) {
      setError(err instanceof CsvFormatError ? err.message : `Errore nella lettura del file: ${(err as Error).message}`);
    }
  }

  async function confirm() {
    if (!parsed) return;
    setBusy(true);
    const r = await importRows(parsed.rows);
    setBusy(false);
    setParsed(null);
    notify(
      r.added > 0
        ? `Importati ${r.added} movimenti${r.duplicates ? `, ${r.duplicates} erano già presenti` : ''}.`
        : 'Nessun movimento nuovo: erano già tutti presenti.'
    );
    if (r.added > 0) onDone();
  }

  function downloadDemo() {
    const blob = new Blob([demoCsv(generateDemoRows(6))], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'estratto-conto-DEMO.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const range = parsed?.rows.length
    ? [parsed.rows.reduce((m, r) => (r.date < m ? r.date : m), parsed.rows[0].date),
       parsed.rows.reduce((m, r) => (r.date > m ? r.date : m), parsed.rows[0].date)]
    : null;

  return (
    <div class="stack">
      <section class="card">
        <h2>Importa l'estratto conto</h2>
        <ol class="steps">
          <li>Entra nell'home banking UniCredit dal computer e apri la lista movimenti del conto.</li>
          <li>Scegli il periodo (anche più mesi insieme) e usa <strong>Esporta</strong> in formato CSV. Se c'è solo Excel, aprilo e salvalo come CSV.</li>
          <li>Seleziona qui il file. Viene letto <strong>solo sul tuo dispositivo</strong>; i movimenti vengono cifrati prima del salvataggio.</li>
        </ol>
        <label class="file-drop">
          <input type="file" accept=".csv,text/csv,.txt,.xls,.xlsx" onChange={onFile} />
          <span>Scegli il file CSV</span>
        </label>
        <p class="muted small">
          Puoi reimportare lo stesso periodo senza problemi: i movimenti già presenti vengono riconosciuti e saltati.
          Vuoi provare prima? <button class="link" onClick={downloadDemo}>Scarica un CSV di esempio con dati finti</button>.
        </p>
        {error && <p class="error" role="alert">{error}</p>}
      </section>

      {parsed && (
        <section class="card">
          <h3>Anteprima di {parsed.fileName}</h3>
          <p>
            <strong>{parsed.rows.length}</strong> movimenti
            {range && <> dal {new Date(range[0]).toLocaleDateString('it-IT')} al {new Date(range[1]).toLocaleDateString('it-IT')}</>}.
            Colonne riconosciute: {[parsed.mapping.date, ...parsed.mapping.description, parsed.mapping.amount ?? parsed.mapping.debit, parsed.mapping.credit]
              .filter((i): i is number => i !== undefined)
              .map((i) => `"${parsed.headers[i]}"`)
              .join(', ')}.
          </p>
          {parsed.warnings.map((w) => <p key={w} class="muted small">{w}</p>)}
          <table class="preview">
            <tbody>
              {parsed.rows.slice(0, 6).map((r, i) => (
                <tr key={i}>
                  <td>{new Date(r.date).toLocaleDateString('it-IT')}</td>
                  <td class="ellipsis">{r.description}</td>
                  <td class={`num ${r.amount > 0 ? 'pos' : ''}`}>{formatEur(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div class="row">
            <button class="primary" disabled={busy || parsed.rows.length === 0} onClick={confirm}>
              {busy ? 'Importo…' : `Importa ${parsed.rows.length} movimenti`}
            </button>
            <button class="ghost" onClick={() => setParsed(null)}>Annulla</button>
          </div>
        </section>
      )}
    </div>
  );
}
