import { listMonths, summarizeMonth, type MonthSummary } from './analytics';
import type { Transaction } from './types';

/**
 * Obiettivo di risparmio espresso come quota delle entrate messa da parte
 * (tasso di risparmio). Il confronto usa la media degli ultimi mesi COMPLETI,
 * perché un singolo mese è troppo rumoroso (bollette bimestrali, spese una tantum).
 */
export interface TargetProgress {
  target: number;
  /** Mesi completi usati per la media, dal più vecchio al più recente. */
  months: MonthSummary[];
  /** Tasso di risparmio medio sul periodo: (entrate - uscite) / entrate. */
  averageRate: number;
  averageIncome: number;
  averageNet: number;
  /** Quanto bisognerebbe spendere in meno al mese per centrare l'obiettivo (0 se già raggiunto). */
  monthlyGap: number;
  /** Tasso dell'ultimo mese meno quello dei mesi precedenti del periodo: >0 ci si avvicina. */
  trend: number;
  status: 'reached' | 'close' | 'far' | 'no-data';
}

/** Un mese è completo se non è quello in corso rispetto a `today`. */
export function completeMonths(transactions: Transaction[], today = new Date()): string[] {
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  return listMonths(transactions).filter((m) => m < current);
}

export function targetProgress(
  transactions: Transaction[],
  target: number,
  windowMonths = 3,
  today = new Date()
): TargetProgress {
  const months = completeMonths(transactions, today)
    .slice(-windowMonths)
    .map((m) => summarizeMonth(transactions, m))
    .filter((s) => s.income > 0);

  if (months.length === 0) {
    return { target, months, averageRate: 0, averageIncome: 0, averageNet: 0, monthlyGap: 0, trend: 0, status: 'no-data' };
  }

  const sum = (f: (s: MonthSummary) => number) => months.reduce((a, s) => a + f(s), 0);
  const averageIncome = sum((s) => s.income) / months.length;
  const averageNet = sum((s) => s.net) / months.length;
  // Media pesata sulle entrate: un mese con tredicesima non vale come un mese normale.
  const averageRate = sum((s) => s.net) / sum((s) => s.income);
  const monthlyGap = Math.max(0, averageIncome * target - averageNet);

  // Ultimo mese rispetto ai precedenti del periodo.
  const rate = (arr: MonthSummary[]) => arr.reduce((a, s) => a + s.net, 0) / arr.reduce((a, s) => a + s.income, 0);
  const trend = months.length >= 2 ? rate(months.slice(-1)) - rate(months.slice(0, -1)) : 0;

  const status = averageRate >= target ? 'reached' : averageRate >= target - 0.05 ? 'close' : 'far';
  return { target, months, averageRate, averageIncome, averageNet, monthlyGap, trend, status };
}
