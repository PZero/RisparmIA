# Contribuire a RisparmIA

Grazie per l'interesse. RisparmIA è un progetto personale con codice pubblico: issue e Pull Request sono benvenute, purché rispettino le regole di privacy qui sotto.

## Regola zero: nessun dato reale

Il repository è **pubblico** e riguarda finanze personali.

- Mai IBAN, numeri di carta, codici fiscali, nomi, email, importi o esercenti riconducibili a una persona reale: né nel codice, né nei test, né nelle issue, né negli screenshot.
- I dati di prova sono solo **sintetici ed evidentemente finti** (per esempio "ACME SRL", "CLIENTE DI PROVA") e stanno in `tests/fixtures/` oppure sono generati da `src/lib/demo.ts`.
- Gli screenshot si fanno solo in **modalità demo**.
- Mai segreti o configurazioni valorizzate: niente `.env.local`, `.firebaserc`, chiavi o token.
- Le vulnerabilità si segnalano in privato, come descritto in [SECURITY.md](SECURITY.md).

## Preparare l'ambiente

Requisiti: Node.js 20 o superiore (la CI usa Node 22) e Git.

```bash
git clone https://github.com/PZero/RisparmIA.git
cd RisparmIA
npm ci
git config core.hooksPath .githooks
```

L'ultimo comando attiva l'hook `.githooks/pre-commit`, che esegue `scripts/check-sensitive.mjs` sui file in staging e blocca il commit se trova IBAN validi, numeri di carta, codici fiscali, chiavi, token, file `.env` o file di movimenti fuori da `tests/fixtures/`. Non aggirarlo con `--no-verify`: la stessa verifica gira in CI su tutti i file.

Per lavorare con Firebase vedi la sezione *Configurazione Firebase* del [README](README.md#configurazione-firebase); senza configurazione l'app funziona in modalità demo.

## Branch

- `main` è protetto e riceve modifiche solo tramite Pull Request con CI verde.
- Branch di lavoro da `main`, con un prefisso che ne indica il tipo:

| Prefisso | Uso |
|---|---|
| `feat/` | Nuova funzionalità (es. `feat/rilevatore-abbonamenti`) |
| `fix/` | Correzione di un difetto |
| `docs/` | Solo documentazione |
| `test/` | Solo test |
| `refactor/` | Riorganizzazione senza cambi di comportamento |
| `chore/` | Dipendenze, configurazione, manutenzione |

## Commit

Si usa [Conventional Commits](https://www.conventionalcommits.org/it/): il CHANGELOG e le note di rilascio si ricavano dai messaggi.

```text
<tipo>(<ambito facoltativo>): <descrizione all'imperativo, in minuscolo>
```

Tipi ammessi: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `security`. Una modifica incompatibile si segnala con `!` dopo il tipo o con `BREAKING CHANGE:` nel corpo.

Esempi:

```text
feat(import): riconosce la colonna "Data operazione"
fix(categorize): non confonde BARILLA con la categoria bar
docs: aggiorna la sezione sui formati CSV
security(rules): limita gli ID dei documenti del vault
```

## Test e verifiche

Prima di aprire una Pull Request esegui in locale gli stessi controlli della CI ([`ci.yml`](.github/workflows/ci.yml)):

```bash
node scripts/check-sensitive.mjs --all   # nessun dato sensibile nei file tracciati
npm run typecheck                        # controllo dei tipi
npm test                                 # test Vitest
npm run build                            # build di produzione
```

La CI esegue in più la scansione dei segreti con gitleaks.

Linee guida per i test:

- ogni modifica alla logica in `src/lib/` va accompagnata da test in `tests/`;
- le fixture CSV vanno in `tests/fixtures/` con dati inventati, IBAN finti (che non superano il controllo mod-97) e carte mascherate;
- le modifiche a cifratura, archivio o regole Firestore devono mantenere i test di `tests/core.test.ts` e aggiungerne di nuovi per il caso coperto.

## Pull Request

1. Descrivi cosa cambia e perché, collegando la issue (`Closes #N`).
2. Indica se la modifica tocca dati, cifratura, Firebase, import o logging: in quel caso serve una revisione di privacy (nel progetto la fa il subagente `privacy-guardian`).
3. Aggiorna la documentazione se cambia il comportamento visibile e aggiungi la voce in `CHANGELOG.md` sotto `[Unreleased]`.
4. Niente `console.log` di movimenti, descrizioni, importi o chiavi; niente nuovi script o servizi esterni senza aggiornare la CSP in `index.html` e motivarlo.

## Licenza

Contribuendo accetti che il tuo contributo sia distribuito con la licenza [MIT](LICENSE) del progetto.
