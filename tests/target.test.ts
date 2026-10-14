import { describe, expect, it } from 'vitest';
import { buildTransactions } from '../src/lib/importer';
import { completeMonths, targetProgress } from '../src/lib/target';

/** Tre mesi completi con stipendio 2.000 € e spese crescenti in risparmio (calo delle uscite). */
const txs = buildTransactions(
  [
    { date: '2026-07-27', amount: 2000, description: 'BONIFICO A VOSTRO FAVORE STIPENDIO' },
    { date: '2026-07-10', amount: -1900, description: 'PAGAMENTO POS ESSELUNGA' },
    { date: '2026-08-27', amount: 2000, description: 'BONIFICO A VOSTRO FAVORE STIPENDIO' },
    { date: '2026-08-10', amount: -1800, description: 'PAGAMENTO POS ESSELUNGA' },
    { date: '2026-09-27', amount: 2000, description: 'BONIFICO A VOSTRO FAVORE STIPENDIO' },
    { date: '2026-09-10', amount: -1600, description: 'PAGAMENTO POS ESSELUNGA' },
    // Mese in corso: escluso dal calcolo perché parziale.
    { date: '2026-10-05', amount: -900, description: 'PAGAMENTO POS ESSELUNGA' }
  ],
  []
);
const today = new Date(2026, 9, 14);

describe('obiettivo di risparmio', () => {
  it('esclude il mese in corso', () => {
    expect(completeMonths(txs, today)).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('calcola media, distanza dall\'obiettivo e tendenza', () => {
    const p = targetProgress(txs, 0.15, 3, today);
    // Risparmio: 100 + 200 + 400 = 700 su 6.000 di entrate.
    expect(p.averageRate).toBeCloseTo(700 / 6000);
    expect(p.averageNet).toBeCloseTo(700 / 3);
    // Per il 15% servono 300 €/mese: ne mancano 300 - 233,33.
    expect(p.monthlyGap).toBeCloseTo(300 - 700 / 3);
    // Ultimo mese 20% contro il 7,5% dei due precedenti: ci si avvicina.
    expect(p.trend).toBeCloseTo(0.2 - 300 / 4000);
    expect(p.status).toBe('close');
  });

  it('riconosce l\'obiettivo raggiunto e la finestra di un solo mese', () => {
    const p = targetProgress(txs, 0.15, 1, today);
    expect(p.averageRate).toBeCloseTo(0.2);
    expect(p.monthlyGap).toBe(0);
    expect(p.status).toBe('reached');
  });

  it('senza mesi completi con entrate non inventa numeri', () => {
    const p = targetProgress(txs.filter((t) => t.date.startsWith('2026-10')), 0.15, 3, today);
    expect(p.status).toBe('no-data');
  });
});
