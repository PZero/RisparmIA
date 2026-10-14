/**
 * Generatore di movimenti SINTETICI per la modalità demo, i test e il CSV di esempio.
 * Nessun dato reale: l'azienda, gli importi e i riferimenti sono inventati.
 * Le descrizioni imitano il formato UniCredit per esercitare tutta la pipeline.
 */
import type { RawRow } from './csv';

/** Generatore pseudo-casuale deterministico (mulberry32): stessi dati a ogni avvio. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const itDate = (y: number, m: number, d: number) => `${pad(d)}.${pad(m)}.${y}`;

export function generateDemoRows(months = 8, endDate = new Date(), seed = 42): RawRow[] {
  const r = rng(seed);
  const between = (a: number, b: number) => Math.round((a + r() * (b - a)) * 100) / 100;
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const rows: RawRow[] = [];

  const endY = endDate.getFullYear();
  const endM = endDate.getMonth(); // 0-based
  for (let i = months - 1; i >= 0; i--) {
    const first = new Date(endY, endM - i, 1);
    const y = first.getFullYear();
    const m = first.getMonth() + 1;
    const daysInMonth = new Date(y, m, 0).getDate();
    const lastDay = i === 0 ? Math.min(endDate.getDate(), daysInMonth) : daysInMonth;
    const day = (d: number) => `${y}-${pad(m)}-${pad(Math.min(d, lastDay))}`;
    const add = (d: number, amount: number, description: string) => {
      if (d <= lastDay) rows.push({ date: day(d), amount, description });
    };
    // La spesa per il delivery cresce negli ultimi mesi: il motore dovrà notarlo.
    const trend = 1 + (months - 1 - i) * 0.06;

    add(27, 2950, 'BONIFICO A VOSTRO FAVORE DISPOSTO DA ACME SRL CAUSALE STIPENDIO');
    add(1, -780, 'BONIFICO SEPA A FAVORE DI IMMOBILIARE ESEMPIO SRL CAUSALE CANONE LOCAZIONE');
    add(5, -between(55, 95), `ADDEBITO DIRETTO SDD ENEL ENERGIA SPA MANDATO N. 000${m}`);
    if (m % 2 === 0) add(8, -between(60, 140), 'ADDEBITO DIRETTO SDD A2A ENERGIA SPA GAS');
    add(9, -9.99, 'ADDEBITO DIRETTO SDD ILIAD ITALIA SPA');
    add(12, -29.9, 'ADDEBITO DIRETTO SDD FASTWEB SPA FIBRA');
    add(3, -13.99, `PAGAMENTO ONLINE NETFLIX COM DEL ${itDate(y, m, 3)} CARTA *0000`);
    add(6, -11.99, `PAGAMENTO ONLINE SPOTIFY DEL ${itDate(y, m, 6)} CARTA *0000`);
    add(14, -9.99, `PAGAMENTO ONLINE DISNEY PLUS DEL ${itDate(y, m, 14)} CARTA *0000`);
    add(18, -19.99, `PAGAMENTO ONLINE DAZN DEL ${itDate(y, m, 18)} CARTA *0000`);
    add(20, -4.99, `PAGAMENTO ONLINE AMAZON PRIME DEL ${itDate(y, m, 20)} CARTA *0000`);
    add(28, -4.5, 'CANONE MENSILE CONTO');
    add(28, -between(1, 4), 'COMMISSIONI BONIFICO SEPA');
    add(25, -300, 'BONIFICO SEPA A FAVORE DI CONTO DEPOSITO ESEMPIO GIROCONTO RISPARMIO');

    // Spesa alimentare: tante uscite medio-piccole.
    const trips = 16 + Math.floor(r() * 8);
    for (let k = 0; k < trips; k++) {
      const d = 1 + Math.floor(r() * daysInMonth);
      const store = pick(['ESSELUNGA', 'CONAD', 'LIDL', 'COOP', 'CARREFOUR EXPRESS']);
      add(d, -between(8, 62), `PAGAMENTO POS ${itDate(y, m, d)} ORE 18:${pad(Math.floor(r() * 59))} A (ITA) ${store} MILANO CARTA *0000`);
    }
    // Bar e ristoranti.
    for (let k = 0; k < 12; k++) {
      const d = 1 + Math.floor(r() * daysInMonth);
      const place = pick(['BAR CENTRALE', 'CAFFE DEL CORSO', 'PIZZERIA DA MARIO', 'RISTORANTE IL PORTO', 'BAR SPORT']);
      add(d, -between(place.startsWith('BAR') || place.startsWith('CAFFE') ? 1.4 : 25, place.startsWith('BAR') || place.startsWith('CAFFE') ? 6 : 70), `PAGAMENTO POS ${itDate(y, m, d)} A (ITA) ${place} MILANO CARTA *0000`);
    }
    // Delivery in crescita.
    const orders = Math.round(5 * trend + r() * 3);
    for (let k = 0; k < orders; k++) {
      const d = 1 + Math.floor(r() * daysInMonth);
      add(d, -between(14, 32), `PAGAMENTO ONLINE ${pick(['GLOVO', 'JUST EAT', 'DELIVEROO'])} DEL ${itDate(y, m, d)} CARTA *0000`);
    }
    // Carburante, trasporti, salute, shopping.
    for (let k = 0; k < 3; k++) {
      const d = 1 + Math.floor(r() * daysInMonth);
      add(d, -between(45, 70), `PAGAMENTO POS ${itDate(y, m, d)} A (ITA) ${pick(['ENI STATION', 'Q8', 'IP'])} CARBURANTI CARTA *0000`);
    }
    add(10 + Math.floor(r() * 10), -between(8, 45), 'PAGAMENTO POS A (ITA) FARMACIA COMUNALE MILANO CARTA *0000');
    for (let k = 0; k < 3; k++) {
      const d = 1 + Math.floor(r() * daysInMonth);
      add(d, -between(12, 90), `PAGAMENTO ONLINE ${pick(['AMAZON EU', 'ZALANDO', 'DECATHLON'])} DEL ${itDate(y, m, d)} CARTA *0000`);
    }
    if (r() > 0.5) add(15, -between(18, 35), 'PAGAMENTO POS A (ITA) PARRUCCHIERE ESEMPIO MILANO CARTA *0000');
    if (r() > 0.6) add(22, -between(20, 60), 'PAGAMENTO POS A (ITA) CINEMA ARCOBALENO MILANO CARTA *0000');
    add(16, -100, `PRELEVAMENTO CARTA *0000 ATM DEL ${itDate(y, m, 16)}`);
    if (r() > 0.7) add(19, -between(15, 40), 'PAGAMENTO POS A (ITA) NEGOZIO GENERICO 123 CARTA *0000');
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

/** CSV in stile UniCredit (separatore ;, numeri all'italiana) con dati sintetici. */
export function demoCsv(rows: RawRow[]): string {
  const header = [
    'Conto: DEMO - dati sintetici generati da RisparmIA',
    '',
    'Data Registrazione;Data Valuta;Descrizione;Importo (EUR)'
  ];
  const lines = rows.map((r) => {
    const [y, m, d] = r.date.split('-');
    const it = `${d}/${m}/${y}`;
    const amount = r.amount.toFixed(2).replace('.', ',');
    return `${it};${it};"${r.description.replace(/"/g, '""')}";${amount}`;
  });
  return [...header, ...lines].join('\r\n');
}
