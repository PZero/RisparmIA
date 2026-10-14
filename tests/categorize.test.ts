import { describe, expect, it } from 'vitest';
import { categorize, recategorizeAll } from '../src/lib/categorize';
import { buildTransactions } from '../src/lib/importer';
import { detectKind, extractMerchant, merchantKey } from '../src/lib/normalize';
import type { UserRule } from '../src/lib/types';

const cases: Array<[string, number, string, string]> = [
  // descrizione, importo, tipo atteso, categoria attesa
  ['PAGAMENTO POS 25,40 EUR DEL 12.09.2026 ORE 18:03 A (ITA) ESSELUNGA MILANO CARTA *1234', -25.4, 'pos', 'spesa'],
  ['ADDEBITO DIRETTO SDD ENEL ENERGIA SPA MANDATO N. 0099', -80, 'sdd', 'utenze'],
  ['ADDEBITO DIRETTO SDD ENI PLENITUDE SPA', -80, 'sdd', 'utenze'],
  ['PAGAMENTO POS A (ITA) ENI STATION CARBURANTI CARTA *0000', -60, 'pos', 'trasporti'],
  ['PAGAMENTO ONLINE AMAZON PRIME DEL 20.09.2026 CARTA *0000', -4.99, 'online', 'abbonamenti'],
  ['PAGAMENTO ONLINE AMAZON EU DEL 20.09.2026 CARTA *0000', -39.9, 'online', 'shopping'],
  ['PAGAMENTO ONLINE JUST EAT DEL 02.09.2026 CARTA *0000', -22, 'online', 'delivery'],
  ['BONIFICO A VOSTRO FAVORE DISPOSTO DA ACME SRL CAUSALE STIPENDIO', 2350, 'salary', 'stipendio'],
  ['CANONE MENSILE CONTO', -4.5, 'fee', 'commissioni'],
  ['COMMISSIONI BONIFICO SEPA', -1, 'fee', 'commissioni'],
  ['PRELEVAMENTO CARTA *0000 ATM DEL 16.09.2026', -100, 'atm', 'contanti'],
  ['ADDEBITO SALDO E/C CARTA DI CREDITO', -540, 'card_settlement', 'carta'],
  ['BONIFICO SEPA A FAVORE DI IMMOBILIARE ESEMPIO SRL CAUSALE CANONE LOCAZIONE', -780, 'transfer_out', 'casa'],
  ['BONIFICO SEPA A FAVORE DI CONTO DEPOSITO ESEMPIO', -300, 'transfer_out', 'giroconti'],
  ['PAGAMENTO POS A (ITA) NEGOZIO GENERICO 123 CARTA *0000', -20, 'pos', 'altro'],
  // Rimborso: importo positivo da esercente noto resta nella sua categoria.
  ['PAGAMENTO ONLINE ZALANDO RIMBORSO', 49.9, 'online', 'shopping']
];

describe('categorizzazione', () => {
  it.each(cases)('%s', (description, amount, kind, category) => {
    const k = detectKind(description, amount);
    expect(k).toBe(kind);
    expect(categorize(description, k, amount, []).categoryId).toBe(category);
  });

  it('non confonde parole parziali (BARILLA non è un BAR, TIMBRI non è TIM)', () => {
    expect(categorize('PAGAMENTO POS BARILLA OUTLET', 'pos', -10, []).categoryId).toBe('altro');
    expect(categorize('PAGAMENTO POS TIMBRI E TARGHE', 'pos', -10, []).categoryId).toBe('altro');
  });

  it('le regole utente hanno la precedenza sul dizionario', () => {
    const rules: UserRule[] = [{ id: '1', match: 'ESSELUNGA', categoryId: 'shopping', createdAt: '' }];
    expect(categorize('PAGAMENTO POS A (ITA) ESSELUNGA MILANO', 'pos', -10, rules)).toEqual({
      categoryId: 'shopping',
      source: 'user-rule'
    });
  });

  it('una regola creata sul nome esercente si applica anche se nella descrizione ci sono parole di servizio in mezzo', () => {
    const [tx] = buildTransactions([{ date: '2026-09-01', amount: -20, description: 'PAGAMENTO POS A (ITA) NEGOZIO GENERICO 123 CARTA *0000' }], []);
    const rules: UserRule[] = [{ id: '1', match: tx.merchant, categoryId: 'cura', createdAt: '' }];
    const [after] = recategorizeAll([tx], rules);
    expect(after.categoryId).toBe('cura');
  });

  it('recategorizeAll non tocca le scelte manuali', () => {
    const [tx] = buildTransactions([{ date: '2026-09-01', amount: -20, description: 'PAGAMENTO POS ESSELUNGA' }], []);
    const manual = { ...tx, categoryId: 'svago', categorySource: 'manual' as const };
    expect(recategorizeAll([manual], [])[0].categoryId).toBe('svago');
  });
});

describe('estrazione esercente', () => {
  it('toglie date, carte, importi, IBAN e città', () => {
    expect(extractMerchant('PAGAMENTO POS 25,40 EUR DEL 12.09.2026 ORE 18:03 A (ITA) ESSELUNGA MILANO CARTA *1234')).toBe('ESSELUNGA');
    expect(merchantKey('BONIFICO A FAVORE DI IT00X0000000000000000000000 MARIO')).toBe('MARIO');
  });
  it('restituisce SCONOSCIUTO se non resta nulla', () => {
    expect(extractMerchant('PAGAMENTO POS 12.09.2026 CARTA *1234')).toBe('SCONOSCIUTO');
  });
});
