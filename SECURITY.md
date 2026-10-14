# Politica di sicurezza

RisparmIA gestisce dati finanziari personali. Le segnalazioni di sicurezza sono benvenute e vengono trattate con priorità.

## Versioni supportate

| Versione | Supportata |
|---|---|
| `main` e ultima release `0.1.x` | Sì |
| Versioni precedenti | No |

L'app pubblicata su <https://pzero.github.io/RisparmIA/> corrisponde sempre all'ultimo commit di `main`.

## Come segnalare una vulnerabilità

**Non aprire una issue pubblica** e non descrivere la vulnerabilità in discussioni o Pull Request.

Usa la segnalazione privata di GitHub:

1. Vai su <https://github.com/PZero/RisparmIA/security/advisories/new> (oppure *Security → Advisories → Report a vulnerability*).
2. Descrivi il problema, i passi per riprodurlo, l'impatto concreto e, se l'hai, una proposta di correzione.
3. Usa solo la **modalità demo** o dati inventati. Non allegare estratti conto, backup, passphrase o dati di altre persone.

Obiettivi indicativi, trattandosi di un progetto mantenuto da una sola persona:

- presa in carico entro 7 giorni;
- valutazione e piano di correzione entro 30 giorni;
- pubblicazione dell'advisory dopo il rilascio della correzione, con il tuo nome nei ringraziamenti se lo desideri.

## Modello di minaccia in breve

### Cosa vogliamo proteggere

Importi, date, descrizioni, esercenti, categorie e regole dell'utente, insieme alla passphrase e alla chiave che ne deriva.

### Da chi

| Avversario | Protezione |
|---|---|
| Chi controlla o accede al backend (Google, amministratori del progetto Firebase, accesso non autorizzato al database) | Cifratura lato client: AES-GCM 256, chiave derivata dalla passphrase con PBKDF2-SHA256 a 600.000 iterazioni e sale casuale per utente (`src/lib/crypto.ts`). Su Firestore arrivano solo `v`, `iv`, `ct`, `updatedAt`. |
| Altri utenti autenticati di Firebase | `firestore.rules`: accesso solo a `users/{uid}` del proprietario, forma dei documenti e ID validati, tutto il resto negato. |
| Chi legge il repository pubblico | Nessun dato reale né segreto nel codice: `scripts/check-sensitive.mjs` come hook pre-commit e in CI, gitleaks in CI, `.gitignore` per estratti conto, backup e file `.env`. |
| Chi usa il dispositivo lasciato incustodito | Blocco automatico dopo 10 minuti di inattività e blocco manuale: la chiave viene dimenticata (`src/App.tsx`, `src/state.ts`). |
| Script di terze parti | Nessun servizio di analisi o tracciamento; Content Security Policy in `index.html` limitata ai domini Google e Firebase necessari. |

### Fuori dal perimetro

- Dispositivo, sistema operativo o browser compromessi, estensioni malevole: possono leggere i dati mentre l'archivio è sbloccato.
- Compromissione della catena di distribuzione (dipendenze npm, account GitHub, GitHub Pages): il codice servito potrebbe essere modificato per sottrarre la passphrase. Dependabot e la CI riducono il rischio, non lo eliminano.
- Perdita della passphrase: i dati non sono recuperabili per costruzione.

### Metadati visibili al server

Il server conosce l'identità Google dell'utente, quali mesi contengono movimenti (gli ID dei documenti sono `tx-AAAA-MM`), la dimensione dei documenti cifrati, le date di aggiornamento e i parametri non segreti di derivazione della chiave.

### Limiti noti

- GitHub Pages non consente intestazioni HTTP: la CSP è in un meta tag e non può impostare `frame-ancestors`.
- La configurazione web di Firebase è pubblica nel bundle, come previsto da Firebase; la sicurezza si basa sulle regole e sulla cifratura.
- Dalla Fase 3 (collegamento bancario via Cloud Functions) i movimenti transiteranno in chiaro, solo in memoria, nella funzione prima di essere cifrati dal browser.
- Dalla Fase 2 l'AI userà la chiave API Claude dell'utente, conservata cifrata nel browser. Verso il modello potranno uscire solo nomi di esercenti ripuliti o dati aggregati, e le foto degli scontrini solo su azione esplicita dell'utente.

## Cosa è utile segnalare

- Modi per leggere o scrivere dati di un altro utente su Firestore.
- Dati in chiaro che lasciano il dispositivo (rete, log, storage persistente).
- Debolezze nella cifratura, nella derivazione della chiave o nella verifica della passphrase.
- Script o risorse esterne caricabili nonostante la CSP, XSS.
- Dati sensibili o segreti presenti nel repository o nella sua cronologia.
