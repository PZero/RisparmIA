import { useMemo } from 'preact/hooks';
import { CategoryBars, TrendChart } from '../components/charts';
import { TargetCard } from '../components/TargetCard';
import {
  categoryBaseline,
  categoryTotals,
  formatEur,
  formatPct,
  listMonths,
  monthLabel,
  summarizeMonth,
  topMerchants
} from '../lib/analytics';
import { getCategory } from '../lib/categories';
import type { CategoryId, VaultState } from '../lib/types';

interface Props {
  vault: VaultState;
  month: string;
  onMonth: (m: string) => void;
  onOpenCategory: (id: CategoryId) => void;
  onGoImport: () => void;
}

export function Dashboard({ vault, month, onMonth, onOpenCategory, onGoImport }: Props) {
  const { transactions, settings } = vault;
  const months = useMemo(() => listMonths(transactions), [transactions]);

  const data = useMemo(() => {
    const summary = summarizeMonth(transactions, month);
    const baseline = categoryBaseline(transactions, month, settings.baselineMonths);
    const totals = categoryTotals(transactions, month);
    const baselineTotal = [...baseline.values()].reduce((a, b) => a + b, 0);
    const trend = months.slice(-12).map((m) => summarizeMonth(transactions, m));
    const unclassified = transactions.filter((t) => t.categoryId === 'altro' && t.date.startsWith(month)).length;
    return {
      summary,
      baselineTotal,
      rows: totals.map((r) => ({ ...r, baseline: baseline.get(r.categoryId) })),
      trend,
      merchants: topMerchants(transactions, month),
      unclassified
    };
  }, [transactions, month, months, settings.baselineMonths]);

  if (transactions.length === 0) {
    return (
      <section class="empty card">
        <h2>Nessun movimento ancora</h2>
        <p>Importa l'estratto conto in CSV dall'home banking UniCredit per vedere dove vanno i tuoi soldi.</p>
        <button class="primary" onClick={onGoImport}>Importa movimenti</button>
      </section>
    );
  }

  const { summary } = data;
  const idx = months.indexOf(month);
  // Il mese in corso è parziale: il confronto con la media sarebbe fuorviante.
  const today = new Date();
  const partial = month === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const vsBaseline = !partial && data.baselineTotal > 0 ? summary.spending - data.baselineTotal : null;

  return (
    <div class="stack">
      <div class="month-nav">
        <button class="ghost" disabled={idx <= 0} onClick={() => onMonth(months[idx - 1])} aria-label="Mese precedente">‹</button>
        <h2>
          {monthLabel(month)}
          {partial && <span class="badge soft">in corso, al {today.getDate()}</span>}
        </h2>
        <button class="ghost" disabled={idx >= months.length - 1} onClick={() => onMonth(months[idx + 1])} aria-label="Mese successivo">›</button>
      </div>

      <div class="kpis">
        <div class="kpi">
          <span class="kpi-label">Entrate</span>
          <span class="kpi-value pos">{formatEur(summary.income, false)}</span>
        </div>
        <div class="kpi">
          <span class="kpi-label">Spese</span>
          <span class="kpi-value">{formatEur(summary.spending, false)}</span>
          {vsBaseline !== null && Math.abs(vsBaseline) >= 1 && (
            <span class={`kpi-note ${vsBaseline > 0 ? 'neg' : 'pos'}`}>
              {vsBaseline > 0 ? '+' : '−'}{formatEur(Math.abs(vsBaseline), false)} rispetto al solito
            </span>
          )}
        </div>
        <div class="kpi">
          <span class="kpi-label">Rimasto</span>
          <span class={`kpi-value ${summary.net >= 0 ? 'pos' : 'neg'}`}>{formatEur(summary.net, false)}</span>
          {summary.income > 0 && <span class="kpi-note">{formatPct(summary.savingsRate)} delle entrate</span>}
        </div>
      </div>

      <TargetCard vault={vault} />

      {summary.untracked > 0 && (
        <p class="hint">
          {formatEur(summary.untracked, false)} in contanti o saldo carta di credito: qui non si vede il dettaglio di cosa hai comprato.
        </p>
      )}
      {data.unclassified > 0 && (
        <p class="hint warn">
          {data.unclassified} movimenti da classificare questo mese. Correggerli una volta insegna all'app a riconoscerli.
        </p>
      )}

      <section class="card">
        <header class="card-head">
          <h3>Dove sono andati i soldi</h3>
          <span class="legend"><span class="baseline-mark" /> spesa abituale (mediana ultimi {settings.baselineMonths} mesi)</span>
        </header>
        <CategoryBars rows={data.rows} onSelect={onOpenCategory} showDelta={!partial} />
      </section>

      <section class="card">
        <header class="card-head">
          <h3>Andamento</h3>
          <span class="legend"><span class="sw in" /> entrate <span class="sw out" /> uscite</span>
        </header>
        <TrendChart months={data.trend} selected={month} onSelect={onMonth} />
      </section>

      <section class="card">
        <header class="card-head"><h3>Esercenti principali</h3></header>
        <table class="merchants">
          <tbody>
            {data.merchants.map((m) => (
              <tr key={m.merchant}>
                <td>
                  <span class="dot" style={{ background: getCategory(m.categoryId).color }} />
                  {m.merchant}
                </td>
                <td class="muted">{m.count}×</td>
                <td class="num">{formatEur(m.total, false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section class="card soon">
        <h3>Strategie di risparmio</h3>
        <p>
          In arrivo con la Fase 2: proposte concrete basate su queste spese, con risparmio previsto e monitoraggio mese per mese.
        </p>
      </section>
    </div>
  );
}
