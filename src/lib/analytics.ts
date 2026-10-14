import { getCategory, isConsumption } from './categories';
import type { CategoryId, Transaction } from './types';

export const monthKey = (isoDate: string) => isoDate.slice(0, 7);

export function monthLabel(key: string, style: 'long' | 'short' = 'long'): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('it-IT', { month: style, year: style === 'long' ? 'numeric' : '2-digit', timeZone: 'UTC' });
}

export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function listMonths(transactions: Transaction[]): string[] {
  return [...new Set(transactions.map((t) => monthKey(t.date)))].sort();
}

export interface MonthSummary {
  month: string;
  income: number;
  /** Spesa di consumo (positiva), al netto dei rimborsi. */
  spending: number;
  /** Uscite non dettagliate: contanti e saldo carta di credito. */
  untracked: number;
  /** Giroconti verso risparmio o altri conti. */
  transfers: number;
  /** Entrate - spesa - uscite non dettagliate. */
  net: number;
  /** Quota di entrate non spesa (0..1). */
  savingsRate: number;
  count: number;
}

export function summarizeMonth(transactions: Transaction[], month: string): MonthSummary {
  let income = 0, spending = 0, untracked = 0, transfers = 0, count = 0;
  for (const t of transactions) {
    if (monthKey(t.date) !== month) continue;
    count++;
    const cat = getCategory(t.categoryId);
    if (cat.group === 'income') income += t.amount;
    else if (isConsumption(t.categoryId)) spending -= t.amount;
    else if (t.categoryId === 'giroconti') transfers -= t.amount;
    else untracked -= t.amount;
  }
  const net = income - spending - untracked;
  return {
    month, income, spending, untracked, transfers, net, count,
    savingsRate: income > 0 ? Math.max(-1, net / income) : 0
  };
}

export interface CategoryTotal {
  categoryId: CategoryId;
  total: number;
  count: number;
}

/** Spesa per categoria in un mese, dalla più alta. Solo categorie di consumo. */
export function categoryTotals(transactions: Transaction[], month: string): CategoryTotal[] {
  const map = new Map<CategoryId, CategoryTotal>();
  for (const t of transactions) {
    if (monthKey(t.date) !== month || !isConsumption(t.categoryId)) continue;
    const row = map.get(t.categoryId) ?? { categoryId: t.categoryId, total: 0, count: 0 };
    row.total -= t.amount;
    row.count++;
    map.set(t.categoryId, row);
  }
  return [...map.values()].filter((r) => r.total > 0.005).sort((a, b) => b.total - a.total);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Baseline per categoria: mediana della spesa mensile negli `n` mesi completi
 * precedenti a `month`. La mediana ignora i mesi anomali (es. una spesa una tantum).
 */
export function categoryBaseline(
  transactions: Transaction[],
  month: string,
  n: number
): Map<CategoryId, number> {
  const months = Array.from({ length: n }, (_, i) => shiftMonth(month, -(i + 1)));
  const available = new Set(listMonths(transactions));
  const used = months.filter((m) => available.has(m));
  const perMonth = used.map((m) => new Map(categoryTotals(transactions, m).map((r) => [r.categoryId, r.total])));
  const ids = new Set(perMonth.flatMap((totals) => [...totals.keys()]));
  const out = new Map<CategoryId, number>();
  for (const id of ids) out.set(id, median(perMonth.map((totals) => totals.get(id) ?? 0)));
  return out;
}

export interface MerchantTotal {
  merchant: string;
  categoryId: CategoryId;
  total: number;
  count: number;
}

export function topMerchants(transactions: Transaction[], month: string, limit = 8): MerchantTotal[] {
  const map = new Map<string, MerchantTotal>();
  for (const t of transactions) {
    if (monthKey(t.date) !== month || t.amount >= 0 || !isConsumption(t.categoryId)) continue;
    const row = map.get(t.merchant) ?? { merchant: t.merchant, categoryId: t.categoryId, total: 0, count: 0 };
    row.total -= t.amount;
    row.count++;
    map.set(t.merchant, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const eur0 = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export const formatEur = (n: number, decimals = true) => (decimals ? eur : eur0).format(n);
export const formatPct = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'percent', maximumFractionDigits: 0 }).format(n);
