import { useEffect, useMemo, useState } from 'preact/hooks';
import { listMonths } from './lib/analytics';
import type { CategoryId } from './lib/types';
import { lock, useAppState } from './state';
import { Dashboard } from './views/Dashboard';
import { Gate } from './views/Gate';
import { Import } from './views/Import';
import { Settings } from './views/Settings';
import { Transactions } from './views/Transactions';

type Tab = 'dashboard' | 'transactions' | 'import' | 'settings';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'dashboard', label: 'Panoramica', icon: '◔' },
  { id: 'transactions', label: 'Movimenti', icon: '≡' },
  { id: 'import', label: 'Importa', icon: '⇪' },
  { id: 'settings', label: 'Impostazioni', icon: '⚙' }
];

/** Dopo 10 minuti senza attività l'archivio si blocca e la chiave viene dimenticata. */
const AUTO_LOCK_MS = 10 * 60 * 1000;

export function App() {
  const s = useAppState();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [month, setMonth] = useState<string>('');
  const [txMonth, setTxMonth] = useState<string>('all');
  const [catFilter, setCatFilter] = useState<CategoryId | ''>('');
  const [toast, setToast] = useState<string | null>(null);

  const months = useMemo(() => listMonths(s.vault.transactions), [s.vault.transactions]);
  const currentMonth = month && months.includes(month) ? month : months[months.length - 1] ?? '';

  useEffect(() => {
    if (s.phase !== 'ready' || s.demo) return;
    let timer = window.setTimeout(lock, AUTO_LOCK_MS);
    const reset = () => { clearTimeout(timer); timer = window.setTimeout(lock, AUTO_LOCK_MS); };
    const events = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => { clearTimeout(timer); events.forEach((e) => window.removeEventListener(e, reset)); };
  }, [s.phase, s.demo]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  if (s.phase !== 'ready') return <Gate phase={s.phase} email={s.email} error={s.error} />;

  return (
    <div class="app">
      <header class="topbar">
        <div class="brand small">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width="28" height="28" />
          <span>RisparmIA</span>
          {s.demo && <span class="badge">DEMO</span>}
        </div>
        <span class="muted small" aria-live="polite">{s.saving ? 'Salvataggio cifrato…' : '🔒 cifrato'}</span>
      </header>

      <nav class="tabs" aria-label="Sezioni">
        {TABS.map((t) => (
          <button key={t.id} class={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            <span class="tab-icon" aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      <main class="content">
        {s.error && <p class="error" role="alert">{s.error}</p>}
        {tab === 'dashboard' && (
          <Dashboard
            vault={s.vault}
            month={currentMonth}
            onMonth={setMonth}
            onGoImport={() => setTab('import')}
            onOpenCategory={(id) => { setCatFilter(id); setTxMonth(currentMonth); setTab('transactions'); }}
          />
        )}
        {tab === 'transactions' && (
          <Transactions
            vault={s.vault}
            month={txMonth}
            onMonth={setTxMonth}
            categoryFilter={catFilter}
            onCategoryFilter={setCatFilter}
            notify={setToast}
          />
        )}
        {tab === 'import' && <Import notify={setToast} onDone={() => { setMonth(''); setTab('dashboard'); }} />}
        {tab === 'settings' && <Settings vault={s.vault} demo={s.demo} email={s.email} notify={setToast} />}
      </main>

      {toast && <div class="toast" role="status">{toast}</div>}
    </div>
  );
}
