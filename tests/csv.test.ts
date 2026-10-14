import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CsvFormatError, detectDelimiter, parseAmount, parseBankCsv, parseDate, splitCsv } from '../src/lib/csv';
import { demoCsv, generateDemoRows } from '../src/lib/demo';

describe('parseAmount', () => {
  it.each([
    ['-1.234,56', -1234.56],
    ['1234,5', 1234.5],
    ['1,234.56', 1234.56],
    ['1234.56', 1234.56],
    ['1.234', 1234],
    ['€ 12,00', 12],
    ['12,00-', -12],
    ['(5,00)', -5],
    ['+7,10', 7.1],
    ['', NaN],
    ['abc', NaN]
  ])('%s → %s', (raw, expected) => {
    expect(parseAmount(raw)).toBe(expected);
  });
});

describe('parseDate', () => {
  it('accetta i formati italiani e ISO', () => {
    expect(parseDate('12/09/2026')).toBe('2026-09-12');
    expect(parseDate('1.9.26')).toBe('2026-09-01');
    expect(parseDate('2026-09-12')).toBe('2026-09-12');
  });
  it('rifiuta date impossibili', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('Saldo')).toBeNull();
  });
});

describe('splitCsv', () => {
  it('rispetta virgolette, separatori e a capo nelle celle', () => {
    const rows = splitCsv('a;"b;c";"d ""e"""\r\n1;"x\ny";3\n', ';');
    expect(rows).toEqual([['a', 'b;c', 'd "e"'], ['1', 'x\ny', '3']]);
  });
  it('rileva il separatore', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
  });
});

describe('parseBankCsv', () => {
  it('legge il formato con colonne Entrate/Uscite e ignora intestazione del conto e saldo', () => {
    const text = readFileSync(new URL('./fixtures/entrate-uscite-sintetico.csv', import.meta.url), 'utf8');
    const r = parseBankCsv(text);
    expect(r.rows).toHaveLength(4);
    expect(r.rows[0]).toMatchObject({ date: '2026-09-02', amount: -25.4 });
    expect(r.rows[1].amount).toBe(-1064.1);
    expect(r.rows[2].amount).toBe(2350);
    // Causale e descrizione vengono unite.
    expect(r.rows[3].description).toBe('COMMISSIONI - CANONE MENSILE CONTO');
    expect(r.skipped).toBeGreaterThan(0);
  });

  it('legge il CSV demo in stile UniCredit (importo unico)', () => {
    const rows = generateDemoRows(3, new Date(2026, 8, 30));
    const r = parseBankCsv(demoCsv(rows));
    expect(r.rows).toHaveLength(rows.length);
    expect(r.rows).toEqual(rows);
  });

  it('accetta il BOM UTF-8', () => {
    const r = parseBankCsv('﻿Data;Descrizione;Importo\n01/01/2026;TEST;-1,00');
    expect(r.rows).toEqual([{ date: '2026-01-01', amount: -1, description: 'TEST' }]);
  });

  it('dà un errore chiaro se mancano le colonne', () => {
    expect(() => parseBankCsv('nome;cognome\nmario;rossi')).toThrow(CsvFormatError);
  });
});
