import { useMemo, useState } from 'preact/hooks';
import { formatEur, listMonths, monthLabel } from '../lib/analytics';
import { CATEGORIES, getCategory } from '../lib/categories';
import type { CategoryId, Transaction, VaultState } from '../lib/types';
import { setCategory } from '../state';

interface Props {
  vault: VaultState;
  month: string;
  categoryFilter: CategoryId | '';
  onCategoryFilter: (id: CategoryId | '') => void;
  onMonth: (m: string) => void;
  notify: (msg: string) => void;
}

const SOURCE_LABEL: Record<Transaction['categorySource'], string> = {
  dictionary: 'riconosciuto',
  'user-rule': 'tua regola',
  manual: 'scelto da te',
  kind: 'dal tipo di operazione',
  ai: 'suggerito da AI',
  fallback: 'non riconosciuto'
};

export function Transactions({ vault, month, categoryFilter, onCategoryFilter, onMonth, notify }: Props) {
  const [query, setQuery] = useState('');
  const [learn, setLearn] = useState(true);
  const months = useMemo(() => listMonths(vault.transactions).reverse(), [vault.transactions]);

  const list = useMemo(() => {
    const q = query.trim().toUpperCase();
    return vault.transactions.filter(
      (t) =>
        (month === 'all' || t.date.startsWith(month)) &&
        (!categoryFilter || t.categoryId === categoryFilter) &&
        (!q || t.description.toUpperCase().includes(q) || t.merchant.includes(q))
    );
  }, [vault.transactions, month, categoryFilter, query]);

  const total = list.reduce((s, t) => s + t.amount, 0);

  async function change(t: Transaction, id: CategoryId) {
    const n = await setCategory(t.id, id, learn);
    const label = getCategory(id).label;
    notify(
      learn && n > 1
        ? `${t.merchant} → ${label}. Aggiornati ${n} movimenti e creata una regola.`
        : `Categoria aggiornata: ${label}.`
    );
  }

  return (
    <div class="stack">
      <div class="filters card">
        <input
          type="search"
          placeholder="Cerca esercente o descrizione"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          aria-label="Cerca"
        />
        <select value={month} onChange={(e) => onMonth((e.target as HTMLSelectElement).value)} aria-label="Mese">
          <option value="all">Tutti i mesi</option>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => onCategoryFilter((e.target as HTMLSelectElement).value)}
          aria-label="Categoria"
        >
          <option value="">Tutte le categorie</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <label class="check">
          <input type="checkbox" checked={learn} onChange={(e) => setLearn((e.target as HTMLInputElement).checked)} />
          Quando cambio categoria, ricordala per lo stesso esercente
        </label>
      </div>

      <p class="muted small">
        {list.length} movimenti · saldo {formatEur(total)}
      </p>

      <ul class="tx-list" role="list">
        {list.slice(0, 500).map((t) => {
          const cat = getCategory(t.categoryId);
          return (
            <li key={t.id} class="tx">
              <div class="tx-main">
                <span class="tx-merchant">{t.merchant}</span>
                <span class={`tx-amount ${t.amount > 0 ? 'pos' : ''}`}>{formatEur(t.amount)}</span>
              </div>
              <div class="tx-desc" title={t.description}>{t.description}</div>
              <div class="tx-meta">
                <time dateTime={t.date}>{new Date(t.date).toLocaleDateString('it-IT')}</time>
                <span class="dot" style={{ background: cat.color }} />
                <select
                  value={t.categoryId}
                  onChange={(e) => change(t, (e.target as HTMLSelectElement).value)}
                  aria-label={`Categoria di ${t.merchant}`}
                >
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <span class="muted small">{SOURCE_LABEL[t.categorySource]}</span>
              </div>
            </li>
          );
        })}
      </ul>
      {list.length > 500 && <p class="muted small">Mostrati i primi 500: usa i filtri per restringere.</p>}
    </div>
  );
}
