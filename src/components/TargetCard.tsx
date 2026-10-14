import { useMemo, useState } from 'preact/hooks';
import { formatEur, formatPct, monthLabel, summarizeMonth } from '../lib/analytics';
import { completeMonths, targetProgress } from '../lib/target';
import type { VaultState } from '../lib/types';
import { updateSettings } from '../state';

/** Obiettivo di risparmio in % delle entrate e avvicinamento negli ultimi mesi. */
export function TargetCard({ vault }: { vault: VaultState }) {
  const { settings, transactions } = vault;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(Math.round((settings.savingsTarget ?? 0.15) * 100)));

  const progress = useMemo(
    () => (settings.savingsTarget === null ? null : targetProgress(transactions, settings.savingsTarget, settings.targetWindowMonths)),
    [transactions, settings.savingsTarget, settings.targetWindowMonths]
  );
  const history = useMemo(
    () => completeMonths(transactions).slice(-12).map((m) => summarizeMonth(transactions, m)).filter((s) => s.income > 0),
    [transactions]
  );

  async function save(e: Event) {
    e.preventDefault();
    const pct = Number(draft.replace(',', '.'));
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 90) return;
    await updateSettings({ savingsTarget: pct / 100 });
    setEditing(false);
  }

  if (settings.savingsTarget === null || editing) {
    return (
      <section class="card target">
        <h3>Obiettivo di risparmio</h3>
        <p class="muted">Quanta parte delle entrate vuoi mettere da parte ogni mese? Un riferimento diffuso è tra il 10% e il 20%.</p>
        <form class="row" onSubmit={save}>
          <label class="pct-input">
            <input type="number" min={1} max={89} step={1} value={draft} aria-label="Obiettivo in percentuale"
              onInput={(e) => setDraft((e.target as HTMLInputElement).value)} />
            <span>% delle entrate</span>
          </label>
          <button class="primary" type="submit">Imposta obiettivo</button>
          {editing && <button class="ghost" type="button" onClick={() => setEditing(false)}>Annulla</button>}
        </form>
      </section>
    );
  }

  const p = progress!;
  const target = p.target;
  const scaleMax = Math.max(target * 1.5, p.averageRate, 0.05);
  const fill = Math.max(0, Math.min(1, p.averageRate / scaleMax));
  const n = p.months.length;

  return (
    <section class={`card target status-${p.status}`}>
      <header class="card-head">
        <h3>Obiettivo: {formatPct(target)} delle entrate</h3>
        <button class="ghost small" onClick={() => setEditing(true)}>Modifica</button>
      </header>

      {p.status === 'no-data' ? (
        <p class="muted">Serve almeno un mese completo con entrate per misurare l'avvicinamento all'obiettivo.</p>
      ) : (
        <>
          <div class="target-headline">
            <span class="target-rate">{formatPct(p.averageRate)}</span>
            <span class="muted">
              media degli ultimi {n} {n === 1 ? 'mese completo' : 'mesi completi'} ({formatEur(p.averageNet, false)} al mese)
            </span>
          </div>

          <div class="target-track" role="img" aria-label={`Risparmio medio ${formatPct(p.averageRate)} su obiettivo ${formatPct(target)}`}>
            <span class="target-fill" style={{ width: `${fill * 100}%` }} />
            <span class="target-mark" style={{ left: `${(target / scaleMax) * 100}%` }}>
              <span>{formatPct(target)}</span>
            </span>
          </div>

          <p class="target-verdict">
            {p.status === 'reached'
              ? `Obiettivo raggiunto: stai mettendo da parte più del ${formatPct(target)}.`
              : `Per arrivare al ${formatPct(target)} servono circa ${formatEur(p.monthlyGap, false)} al mese in meno di uscite.`}
            {n >= 2 && Math.abs(p.trend) >= 0.01 && (
              <>
                {' '}
                <strong class={p.trend > 0 ? 'pos' : 'neg'}>
                  {p.trend > 0 ? 'Ti stai avvicinando' : 'Ti stai allontanando'}
                </strong>
                : l'ultimo mese è {p.trend > 0 ? 'migliore' : 'peggiore'} di {Math.round(Math.abs(p.trend) * 100)} punti rispetto ai precedenti.
              </>
            )}
          </p>

          {history.length >= 2 && <RateHistory months={history} target={target} />}
        </>
      )}
    </section>
  );
}

function RateHistory({ months, target }: { months: ReturnType<typeof summarizeMonth>[]; target: number }) {
  const W = 640, H = 120, padB = 22, padT = 8;
  const rates = months.map((m) => m.savingsRate);
  const top = Math.max(target * 1.4, ...rates, 0.05);
  const bottom = Math.min(0, ...rates);
  const y = (v: number) => padT + ((top - v) / (top - bottom)) * (H - padT - padB);
  const slot = W / months.length;
  const bw = Math.min(28, slot * 0.55);
  return (
    <svg class="rate-history" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tasso di risparmio per mese rispetto all'obiettivo">
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} class="axis" />
      {months.map((m, i) => {
        const r = m.savingsRate;
        const x = i * slot + (slot - bw) / 2;
        return (
          <g key={m.month}>
            <rect x={x} width={bw} y={Math.min(y(r), y(0))} height={Math.abs(y(r) - y(0))} rx="3"
              class={r >= target ? 'ok' : r >= 0 ? 'below' : 'neg'} />
            <text x={x + bw / 2} y={H - 6} text-anchor="middle" class="tick">{monthLabel(m.month, 'short')}</text>
            <title>{`${monthLabel(m.month)}: ${formatPct(r)} (${formatEur(m.net, false)})`}</title>
          </g>
        );
      })}
      <line x1="0" x2={W} y1={y(target)} y2={y(target)} class="target-line" />
    </svg>
  );
}
