# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate in questo file.

Il formato segue [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/) e il progetto adotta il [versionamento semantico](https://semver.org/lang/it/).

## [Unreleased]

Nessuna modifica dopo la versione 0.1.0.

## [0.1.0] - 2026-10-14

Prima versione: Fase 1, MVP "vedo i miei soldi".

### Aggiunto

- Import dell'estratto conto UniCredit in CSV letto solo nel browser, con anteprima delle colonne riconosciute, rilevamento automatico di separatore e intestazione, numeri e date all'italiana, colonna importo unica oppure Entrate/Uscite.
- Deduplicazione dei movimenti: reimportare lo stesso periodo non crea doppioni.
- Categorizzazione automatica in 21 categorie tramite regole dell'utente, tipo di operazione e dizionario di esercenti italiani; estrazione del nome esercente dalle descrizioni bancarie.
- Regole apprese: correggendo una categoria si può creare una regola sull'esercente, applicata a tutti i movimenti simili e gestibile dalle Impostazioni.
- Dashboard mensile con entrate, spese e rimanenza, spesa per categoria rispetto alla mediana dei mesi precedenti (3, 6 o 12), andamento degli ultimi 12 mesi ed esercenti principali.
- Obiettivo di risparmio in percentuale delle entrate, misurato sulla media degli ultimi mesi completi, con distanza in euro dall'obiettivo, tendenza e storico mensile.
- Elenco movimenti con ricerca, filtri per mese e categoria e ricategorizzazione.
- Accesso con Google tramite Firebase Authentication.
- Cifratura lato client con AES-GCM 256 e chiave derivata dalla passphrase con PBKDF2-SHA256 a 600.000 iterazioni; archivio cifrato su Cloud Firestore, un documento per mese.
- Regole Firestore: accesso solo al proprietario, validazione della forma dei documenti cifrati e degli ID consentiti.
- Backup cifrato scaricabile e ripristino con la passphrase.
- Blocco automatico dopo 10 minuti di inattività e blocco manuale.
- Modalità demo con dati sintetici e CSV di esempio scaricabile.
- PWA installabile con aggiornamento automatico.
- Pubblicazione su GitHub Pages tramite GitHub Actions, con configurazione Firebase dalle variabili del repository.
- CI con controllo anti-dati sensibili, scansione gitleaks, controllo dei tipi, test e build; hook pre-commit anti-dati sensibili; Dependabot.
- Subagenti Claude Code `repo-maintainer` e `privacy-guardian`.
- Documentazione: README, SECURITY, CONTRIBUTING, proposta di progetto.

[Unreleased]: https://github.com/PZero/RisparmIA/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/PZero/RisparmIA/releases/tag/v0.1.0
