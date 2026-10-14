import { describe, expect, it } from 'vitest';
import { categoryBaseline, categoryTotals, median, shiftMonth, summarizeMonth } from '../src/lib/analytics';
import {
  createCryptoMeta,
  decryptJSON,
  encryptJSON,
  passphraseStrength,
  unlockWithPassphrase
} from '../src/lib/crypto';
import { generateDemoRows } from '../src/lib/demo';
import { buildTransactions, mergeTransactions } from '../src/lib/importer';
import { splitByMonth } from '../src/lib/vault';

describe('cifratura', () => {
  it('cifra e decifra, e il testo cifrato non contiene i dati in chiaro', async () => {
    const { meta, key } = await createCryptoMeta('una frase lunga di prova 42!');
    const data = { descrizione: 'ESSELUNGA', importo: -25.4 };
    const blob = await encryptJSON(key, data);
    expect(atob(blob.ct)).not.toContain('ESSELUNGA');
    expect(await decryptJSON(key, blob)).toEqual(data);
    expect(meta.iterations).toBeGreaterThanOrEqual(600_000);
  });

  it('due cifrature dello stesso dato producono testi diversi (IV casuale)', async () => {
    const { key } = await createCryptoMeta('una frase lunga di prova 42!');
    const a = await encryptJSON(key, 'x');
    const b = await encryptJSON(key, 'x');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('riconosce la passphrase giusta e rifiuta quella sbagliata', async () => {
    const { meta } = await createCryptoMeta('una frase lunga di prova 42!');
    expect(await unlockWithPassphrase('una frase lunga di prova 42!', meta)).not.toBeNull();
    expect(await unlockWithPassphrase('sbagliata', meta)).toBeNull();
  });

  it('valuta la robustezza', () => {
    expect(passphraseStrength('corta').ok).toBe(false);
    expect(passphraseStrength('cavallo batteria graffetta corretta').ok).toBe(true);
  });
});

describe('import e duplicati', () => {
  const rows = generateDemoRows(4, new Date(2026, 8, 30));

  it('reimportare lo stesso file non crea duplicati', () => {
    const first = mergeTransactions([], buildTransactions(rows, []));
    const again = mergeTransactions(first.transactions, buildTransactions(rows, []));
    expect(again.added).toBe(0);
    expect(again.duplicates).toBe(rows.length);
    expect(again.transactions).toHaveLength(first.transactions.length);
  });

  it('due movimenti identici nello stesso giorno restano distinti', () => {
    const caffe = { date: '2026-09-01', amount: -1.2, description: 'PAGAMENTO POS BAR SPORT' };
    const txs = buildTransactions([caffe, caffe], []);
    expect(new Set(txs.map((t) => t.id)).size).toBe(2);
  });

  it('i dati demo sono classificati quasi tutti', () => {
    const txs = buildTransactions(rows, []);
    const unknown = txs.filter((t) => t.categoryId === 'altro').length;
    expect(unknown / txs.length).toBeLessThan(0.05);
  });

  it('suddivide per mese per il salvataggio', () => {
    const byMonth = splitByMonth(buildTransactions(rows, []));
    expect([...byMonth.keys()].sort()).toEqual(['2026-06', '2026-07', '2026-08', '2026-09']);
  });
});

describe('statistiche', () => {
  const txs = buildTransactions(
    [
      { date: '2026-07-27', amount: 2000, description: 'BONIFICO A VOSTRO FAVORE STIPENDIO' },
      { date: '2026-07-10', amount: -100, description: 'PAGAMENTO POS ESSELUNGA' },
      { date: '2026-08-27', amount: 2000, description: 'BONIFICO A VOSTRO FAVORE STIPENDIO' },
      { date: '2026-08-10', amount: -300, description: 'PAGAMENTO POS ESSELUNGA' },
      { date: '2026-08-11', amount: 50, description: 'PAGAMENTO ONLINE ZALANDO RIMBORSO' },
      { date: '2026-08-12', amount: -80, description: 'PAGAMENTO ONLINE ZALANDO' },
      { date: '2026-08-15', amount: -100, description: 'PRELEVAMENTO ATM' },
      { date: '2026-08-20', amount: -500, description: 'BONIFICO SEPA A FAVORE DI CONTO DEPOSITO' },
      { date: '2026-09-10', amount: -200, description: 'PAGAMENTO POS ESSELUNGA' }
    ],
    []
  );

  it('riepilogo mensile separa consumi, contanti e giroconti', () => {
    const s = summarizeMonth(txs, '2026-08');
    expect(s.income).toBe(2000);
    expect(s.spending).toBe(330); // 300 spesa + (80 - 50) shopping netto
    expect(s.untracked).toBe(100);
    expect(s.transfers).toBe(500);
    expect(s.net).toBe(1570);
  });

  it('totali per categoria al netto dei rimborsi', () => {
    expect(categoryTotals(txs, '2026-08')).toEqual([
      { categoryId: 'spesa', total: 300, count: 1 },
      { categoryId: 'shopping', total: 30, count: 2 }
    ]);
  });

  it('baseline = mediana dei mesi precedenti, contando zero dove la categoria manca', () => {
    const b = categoryBaseline(txs, '2026-09', 2);
    expect(b.get('spesa')).toBe(200); // mediana di 100 e 300
    expect(b.get('shopping')).toBe(15); // mediana di 0 e 30
  });

  it('utilità', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([])).toBe(0);
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});
