import { formatEur, monthLabel, type MonthSummary } from '../lib/analytics';
import { getCategory } from '../lib/categories';
import type { CategoryId } from '../lib/types';

export interface BarRow {
  categoryId: CategoryId;
  total: number;
  baseline?: number;
}

/** Barre orizzontali per categoria, con il segno della baseline (mediana dei mesi precedenti). */
export function CategoryBars({ rows, onSelect, showDelta = true }: {
  rows: BarRow[];
  onSelect?: (id: CategoryId) => void;
  showDelta?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.total, r.baseline ?? 0)));
  return (
    <ul class="bars" role="list">
      {rows.map((r) => {
        const cat = getCategory(r.categoryId);
        const delta = r.baseline ? r.total - r.baseline : 0;
        const deltaPct = r.baseline ? delta / r.baseline : 0;
        return (
          <li key={r.categoryId}>
            <button type="button" class="bar-row" onClick={() => onSelect?.(r.categoryId)}>
              <span class="bar-label">
                <span class="dot" style={{ background: cat.color }} />
                {cat.label}
              </span>
              <span class="bar-value">
                {formatEur(r.total, false)}
                {showDelta && r.baseline !== undefined && r.baseline > 0 && Math.abs(deltaPct) >= 0.1 && (
                  <span class={`delta ${delta > 0 ? 'up' : 'down'}`}>
                    {delta > 0 ? '▲' : '▼'} {Math.round(Math.abs(deltaPct) * 100)}%
                  </span>
                )}
              </span>
              <span class="bar-track" aria-hidden="true">
                <span class="bar-fill" style={{ width: `${(r.total / max) * 100}%`, background: cat.color }} />
                {r.baseline !== undefined && r.baseline > 0 && (
                  <span class="bar-baseline" style={{ left: `${(r.baseline / max) * 100}%` }} title="Spesa abituale: mediana dei mesi precedenti" />
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Andamento mensile: entrate e spese affiancate, con il risparmio netto come etichetta. */
export function TrendChart({ months, selected, onSelect }: {
  months: MonthSummary[];
  selected: string;
  onSelect: (m: string) => void;
}) {
  if (months.length === 0) return null;
  const W = 640, H = 200, padB = 28, padT = 12;
  const max = Math.max(1, ...months.map((m) => Math.max(m.income, m.spending + m.untracked)));
  const slot = W / months.length;
  const bw = Math.min(22, slot / 3);
  const y = (v: number) => H - padB - (v / max) * (H - padB - padT);
  return (
    <svg class="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Entrate e spese per mese">
      <line x1="0" x2={W} y1={H - padB} y2={H - padB} class="axis" />
      {months.map((m, i) => {
        const cx = i * slot + slot / 2;
        const out = m.spending + m.untracked;
        const active = m.month === selected;
        return (
          <g key={m.month} class={active ? 'active' : ''} onClick={() => onSelect(m.month)} style={{ cursor: 'pointer' }}>
            <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
            <rect x={cx - bw - 1} y={y(m.income)} width={bw} height={H - padB - y(m.income)} rx="3" class="bar-in" />
            <rect x={cx + 1} y={y(out)} width={bw} height={H - padB - y(out)} rx="3" class="bar-out" />
            <text x={cx} y={H - 10} text-anchor="middle" class="tick">{monthLabel(m.month, 'short')}</text>
            <title>{`${monthLabel(m.month)}: entrate ${formatEur(m.income, false)}, uscite ${formatEur(out, false)}, netto ${formatEur(m.net, false)}`}</title>
          </g>
        );
      })}
    </svg>
  );
}
