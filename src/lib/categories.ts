import type { CategoryId, OperationKind } from './types';

export interface Category {
  id: CategoryId;
  label: string;
  /** Gruppo usato dal motore risparmi: essenziali, discrezionali, ecc. */
  group: 'income' | 'essential' | 'discretionary' | 'financial' | 'transfer';
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: 'stipendio', label: 'Stipendio e entrate', group: 'income', color: '#15803d' },
  { id: 'spesa', label: 'Spesa alimentare', group: 'essential', color: '#0f766e' },
  { id: 'casa', label: 'Casa (affitto, mutuo, condominio)', group: 'essential', color: '#1d4ed8' },
  { id: 'utenze', label: 'Utenze (luce, gas, acqua)', group: 'essential', color: '#0369a1' },
  { id: 'telefonia', label: 'Telefonia e internet', group: 'essential', color: '#4338ca' },
  { id: 'trasporti', label: 'Carburante e trasporti', group: 'essential', color: '#7c3aed' },
  { id: 'salute', label: 'Salute e farmacia', group: 'essential', color: '#be123c' },
  { id: 'assicurazioni', label: 'Assicurazioni', group: 'essential', color: '#9f1239' },
  { id: 'istruzione', label: 'Scuola e istruzione', group: 'essential', color: '#a16207' },
  { id: 'ristoranti', label: 'Ristoranti e bar', group: 'discretionary', color: '#ea580c' },
  { id: 'delivery', label: 'Cibo a domicilio', group: 'discretionary', color: '#f97316' },
  { id: 'abbonamenti', label: 'Abbonamenti digitali', group: 'discretionary', color: '#db2777' },
  { id: 'shopping', label: 'Shopping e acquisti online', group: 'discretionary', color: '#c026d3' },
  { id: 'svago', label: 'Svago, sport e viaggi', group: 'discretionary', color: '#9333ea' },
  { id: 'cura', label: 'Cura della persona', group: 'discretionary', color: '#e11d48' },
  { id: 'commissioni', label: 'Commissioni bancarie', group: 'financial', color: '#57534e' },
  { id: 'tasse', label: 'Tasse e tributi', group: 'financial', color: '#44403c' },
  { id: 'contanti', label: 'Prelievi contante', group: 'transfer', color: '#78716c' },
  { id: 'carta', label: 'Saldo carta di credito', group: 'transfer', color: '#a8a29e' },
  { id: 'giroconti', label: 'Giroconti e risparmio', group: 'transfer', color: '#64748b' },
  { id: 'altro', label: 'Da classificare', group: 'discretionary', color: '#94a3b8' }
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: CategoryId): Category {
  return BY_ID.get(id) ?? BY_ID.get('altro')!;
}

/** Le categorie che contano come spesa di consumo (esclude giroconti, contanti, saldo carta). */
export function isConsumption(id: CategoryId): boolean {
  const g = getCategory(id).group;
  return g === 'essential' || g === 'discretionary' || g === 'financial';
}

/**
 * Dizionario esercenti → categoria. Le chiavi sono confrontate come parole
 * intere (o sequenze di parole) dentro l'esercente normalizzato: maiuscolo,
 * senza punteggiatura. Vince la chiave più lunga, così "AMAZON PRIME" batte
 * "AMAZON" e "ENI PLENITUDE" batte "ENI".
 * Contiene solo nomi commerciali pubblici, nessun dato personale.
 */
export const MERCHANT_DICTIONARY: Record<string, CategoryId> = {
  // Spesa alimentare
  'ESSELUNGA': 'spesa', 'CONAD': 'spesa', 'COOP': 'spesa', 'LIDL': 'spesa', 'CARREFOUR': 'spesa',
  'EUROSPIN': 'spesa', 'PAM': 'spesa', 'IN S MERCATO': 'spesa', 'DESPAR': 'spesa', 'ALDI': 'spesa',
  'PENNY': 'spesa', 'MD': 'spesa', 'TIGROS': 'spesa', 'IPERAL': 'spesa', 'BENNET': 'spesa',
  'FAMILA': 'spesa', 'SIGMA': 'spesa', 'CRAI': 'spesa', 'U2': 'spesa', 'IPERCOOP': 'spesa',
  'NATURASI': 'spesa', 'PANIFICIO': 'spesa', 'MACELLERIA': 'spesa', 'FRUTTA': 'spesa',
  'SUPERMERCATO': 'spesa', 'ALIMENTARI': 'spesa',
  // Ristoranti e bar
  'BAR': 'ristoranti', 'CAFFE': 'ristoranti', 'PIZZERIA': 'ristoranti', 'RISTORANTE': 'ristoranti',
  'TRATTORIA': 'ristoranti', 'OSTERIA': 'ristoranti', 'MCDONALDS': 'ristoranti', 'MCDONALD S': 'ristoranti',
  'BURGER KING': 'ristoranti', 'AUTOGRILL': 'ristoranti', 'STARBUCKS': 'ristoranti',
  'GELATERIA': 'ristoranti', 'PASTICCERIA': 'ristoranti', 'SUSHI': 'ristoranti',
  // Cibo a domicilio
  'GLOVO': 'delivery', 'DELIVEROO': 'delivery', 'JUST EAT': 'delivery', 'JUSTEAT': 'delivery',
  'UBER EATS': 'delivery',
  // Abbonamenti digitali
  'NETFLIX': 'abbonamenti', 'SPOTIFY': 'abbonamenti', 'DISNEY': 'abbonamenti', 'DAZN': 'abbonamenti',
  'PRIME VIDEO': 'abbonamenti', 'AMAZON PRIME': 'abbonamenti', 'APPLE COM BILL': 'abbonamenti',
  'GOOGLE PLAY': 'abbonamenti', 'GOOGLE ONE': 'abbonamenti', 'YOUTUBE': 'abbonamenti',
  'NOW TV': 'abbonamenti', 'SKY ITALIA': 'abbonamenti', 'AUDIBLE': 'abbonamenti',
  'ICLOUD': 'abbonamenti', 'CHATGPT': 'abbonamenti', 'OPENAI': 'abbonamenti',
  'ANTHROPIC': 'abbonamenti', 'CLAUDE AI': 'abbonamenti', 'PARAMOUNT': 'abbonamenti',
  'TIMVISION': 'abbonamenti',
  // Shopping
  'AMAZON': 'shopping', 'AMZN': 'shopping', 'ZALANDO': 'shopping', 'IKEA': 'shopping',
  'DECATHLON': 'shopping', 'MEDIA WORLD': 'shopping', 'MEDIAWORLD': 'shopping', 'UNIEURO': 'shopping',
  'EBAY': 'shopping', 'SHEIN': 'shopping', 'TEMU': 'shopping', 'ZARA': 'shopping', 'H M': 'shopping',
  'OVS': 'shopping', 'PRIMARK': 'shopping', 'LEROY MERLIN': 'shopping', 'BRICOMAN': 'shopping',
  'TIGER': 'shopping', 'ACTION': 'shopping',
  // Utenze
  'ENEL': 'utenze', 'A2A': 'utenze', 'HERA': 'utenze', 'IREN': 'utenze', 'EDISON': 'utenze',
  'ENI PLENITUDE': 'utenze', 'PLENITUDE': 'utenze', 'ACEA': 'utenze', 'SORGENIA': 'utenze',
  'OCTOPUS ENERGY': 'utenze', 'SERVIZIO ELETTRICO NAZIONALE': 'utenze', 'ACQUEDOTTO': 'utenze',
  'METROPOLITANA MILANESE': 'utenze',
  // Telefonia
  'TIM': 'telefonia', 'VODAFONE': 'telefonia', 'WINDTRE': 'telefonia', 'WIND TRE': 'telefonia',
  'ILIAD': 'telefonia', 'FASTWEB': 'telefonia', 'HO MOBILE': 'telefonia', 'VERY MOBILE': 'telefonia',
  'KENA': 'telefonia', 'POSTEMOBILE': 'telefonia', 'TELECOM ITALIA': 'telefonia',
  // Carburante e trasporti
  'ENI': 'trasporti', 'ENILIVE': 'trasporti', 'Q8': 'trasporti', 'IP': 'trasporti', 'ESSO': 'trasporti',
  'TAMOIL': 'trasporti', 'TOTALENERGIES': 'trasporti', 'TELEPASS': 'trasporti',
  'TRENITALIA': 'trasporti', 'ITALO': 'trasporti', 'ATM MILANO': 'trasporti', 'AUTOSTRADE': 'trasporti',
  'UBER': 'trasporti', 'FREE NOW': 'trasporti', 'FREENOW': 'trasporti', 'TRENORD': 'trasporti',
  'PARCHEGGIO': 'trasporti', 'EASYPARK': 'trasporti', 'CARBURANTI': 'trasporti',
  // Salute
  'FARMACIA': 'salute', 'PARAFARMACIA': 'salute', 'OTTICA': 'salute', 'DENTISTA': 'salute',
  'STUDIO DENTISTICO': 'salute', 'CENTRO MEDICO': 'salute', 'ASL': 'salute', 'ATS': 'salute',
  'POLIAMBULATORIO': 'salute',
  // Assicurazioni
  'GENERALI': 'assicurazioni', 'UNIPOL': 'assicurazioni', 'UNIPOLSAI': 'assicurazioni',
  'ALLIANZ': 'assicurazioni', 'AXA': 'assicurazioni', 'PRIMA ASSICURAZIONI': 'assicurazioni',
  'LINEAR': 'assicurazioni', 'GENIALLOYD': 'assicurazioni', 'VERTI': 'assicurazioni',
  'ZURICH': 'assicurazioni',
  // Svago
  'CINEMA': 'svago', 'TEATRO': 'svago', 'PALESTRA': 'svago', 'TICKETONE': 'svago',
  'BOOKING': 'svago', 'AIRBNB': 'svago', 'RYANAIR': 'svago', 'EASYJET': 'svago',
  'ITA AIRWAYS': 'svago', 'FELTRINELLI': 'svago', 'MONDADORI': 'svago', 'STEAM': 'svago',
  'PLAYSTATION': 'svago', 'NINTENDO': 'svago',
  // Cura della persona
  'PARRUCCHIERE': 'cura', 'PARRUCCHIERA': 'cura', 'BARBIERE': 'cura', 'BARBERSHOP': 'cura',
  'ESTETICA': 'cura', 'SEPHORA': 'cura', 'DOUGLAS': 'cura', 'ACQUA E SAPONE': 'cura',
  'TIGOTA': 'cura', 'KIKO': 'cura',
  // Istruzione
  'SCUOLA': 'istruzione', 'UNIVERSITA': 'istruzione', 'ASILO': 'istruzione',
  'MENSA SCOLASTICA': 'istruzione',
  // Tasse e tributi
  'F24': 'tasse', 'AGENZIA ENTRATE': 'tasse', 'PAGOPA': 'tasse', 'BOLLO AUTO': 'tasse',
  'COMUNE DI': 'tasse',
  // Casa
  'CONDOMINIO': 'casa', 'AFFITTO': 'casa', 'CANONE LOCAZIONE': 'casa', 'RATA MUTUO': 'casa',
  'MUTUO': 'casa'
};

/** Categoria di ripiego in base al solo tipo di operazione. */
export const KIND_DEFAULT: Partial<Record<OperationKind, CategoryId>> = {
  salary: 'stipendio',
  transfer_in: 'stipendio',
  atm: 'contanti',
  fee: 'commissioni',
  card_settlement: 'carta',
  transfer_out: 'giroconti'
};
