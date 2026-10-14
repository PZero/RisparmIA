# RisparmIA — Proposta di gestione del progetto

> Documento di discussione, versione 0.1 (14 ottobre 2026), scritto prima dell'implementazione. Le decisioni prese poi sono riassunte qui sotto e prevalgono sul resto del testo.

## Decisioni prese (14 ottobre 2026)

| Tema | Decisione |
|---|---|
| Collegamento banca | Fase 1 con import CSV; Enable Banking in Fase 3 |
| Piano Firebase | Spark ora, Blaze dalla Fase 3 |
| Utenti | Un solo utente |
| Hosting | Frontend su **GitHub Pages**, backend su Firebase (Auth + Firestore) |
| AI | Dalla **Fase 2**, con la chiave Claude dell'utente salvata cifrata nel browser; usata per esercenti ambigui e lettura degli scontrini |
| Scontrini | Il dettaglio degli acquisti (righe dello scontrino) è centrale nella Fase 2 |
| Obiettivo di risparmio | Target in % delle entrate, monitorato sulla media degli ultimi mesi completi: anticipato in Fase 1 |
| Subagenti | repo-maintainer e privacy-guardian subito; savings-strategist e firebase-ops in Fase 2 |

---

## 1. Fasi (roadmap)

| Fase | Obiettivo | Cosa ottieni | Dipendenze |
|---|---|---|---|
| **0. Decisioni** | Chiudere i punti aperti di questo documento | Architettura e regole condivise | — |
| **1. MVP "vedo i miei soldi"** | Import movimenti da file UniCredit (CSV/Excel), categorizzazione automatica a regole, dashboard mensile, login Google, dati cifrati | Una PWA installabile sul telefono che mostra dove vanno i soldi | Firebase piano gratuito (Spark) |
| **2. Motore risparmi v1** | Rilevatori di opportunità, proposte con stima in €, piani accettati, monitoraggio previsto vs realizzato | Le azioni concrete e il tracking che hai chiesto | Almeno 3 mesi di storico importato |
| **3. Collegamento automatico UniCredit** | Sincronizzazione movimenti via Enable Banking (PSD2) | Niente più import manuale | Piano Firebase Blaze (Functions) + account Enable Banking |
| **4. Evoluzioni** | Famiglia multi‑utente, notifiche, spiegazioni in linguaggio naturale con AI (opzionale) | Uso condiviso e coaching | Decisione privacy su AI |

Ogni fase è una **Milestone** su GitHub; ogni funzionalità è una **Issue** collegata.

## 2. Flusso di lavoro su GitHub

- Repo **pubblico** `PZero/RisparmIA`, licenza MIT.
- Branch `main` protetto: si entra solo con Pull Request.
- Branch di lavoro `feat/…`, `fix/…`, `docs/…`; commit in stile *Conventional Commits* (`feat:`, `fix:`, …) così changelog e release si generano da soli.
- **CI su ogni PR** (GitHub Actions): controllo tipi, test, build, e scansione anti‑segreti. Se fallisce, la PR non si unisce.
- **Deploy automatico** su Firebase Hosting quando `main` cambia (anteprima su canale temporaneo per ogni PR).
- Protezioni GitHub attive: *secret scanning* + *push protection*, Dependabot per le dipendenze.
- Release con tag semantici (`v0.1.0`, …) e note di rilascio scritte dal subagente di manutenzione.

## 3. Subagenti (in `.claude/agents/`)

Propongo **quattro** subagenti, ciascuno con un perimetro stretto e strumenti limitati al minimo necessario.

| Subagente | Specializzazione | Quando interviene | Cosa NON può fare |
|---|---|---|---|
| **repo-maintainer** | README "professionale", CHANGELOG, issue e milestone, note di rilascio, badge, coerenza della documentazione col codice | A fine di ogni PR e ad ogni release | Toccare codice applicativo |
| **privacy-guardian** | Revisione di sicurezza e privacy: cerca IBAN, token, dati reali, log che espongono importi; verifica regole Firestore e cifratura | Prima di ogni merge (blocca se trova problemi) | Modificare file: solo segnala |
| **savings-strategist** | Progetta e valida le regole del motore risparmi, i benchmark e le formule di previsione; scrive i test con dati sintetici | Quando si aggiunge o tara una strategia | Usare dati reali: lavora solo su dataset finti |
| **firebase-ops** | Configurazione Firebase, regole Firestore, emulatori, deploy, controllo costi e quote | Setup, deploy, modifiche infrastrutturali | Cancellare progetti o dati in produzione senza tua conferma |

Consiglio di partire con **repo-maintainer** e **privacy-guardian** (servono da subito, visto che il repo è pubblico) e aggiungere gli altri due all'inizio della Fase 2.

## 4. Privacy (il punto su cui non si transige)

1. **Cifratura lato client (end‑to‑end).** I movimenti vengono cifrati nel browser (AES‑GCM 256) con una chiave derivata da una tua *passphrase* che non lascia mai il dispositivo. Su Firestore finiscono solo blob illeggibili: né Google né chi accede al progetto può leggere importi o descrizioni.
   - Rovescio della medaglia: se perdi la passphrase, i dati non sono recuperabili. Mitigazione: esportazione di backup cifrato e una "chiave di recupero" da stampare.
2. **Regole Firestore strette**: ogni utente legge e scrive solo sotto `users/{suo uid}`; tutto il resto è negato.
3. **Nessun tracciamento**: niente Google Analytics né servizi di terze parti nel frontend.
4. **Repo pubblico pulito**: `.gitignore` per `.env`, chiavi, export bancari (`*.csv`, `*.xlsx` fuori da `fixtures/`); dati di esempio solo **generati sinteticamente**; hook pre‑commit + scansione in CI.
5. **Collegamento bancario (Fase 3)**: la chiave privata di Enable Banking sta in *Secret Manager*, mai nel repo. I movimenti transitano nella Cloud Function solo in memoria e vengono cifrati dal tuo browser prima di essere salvati. Nota onesta: durante quel transito il server li vede in chiaro per qualche istante; con l'import da file invece non escono mai in chiaro dal tuo dispositivo.

## 5. UniCredit: come prendere i movimenti

| Opzione | Pro | Contro | Verdetto |
|---|---|---|---|
| API PSD2 UniCredit dirette | Ufficiale | Serve licenza di Terza Parte (AISP) rilasciata da Banca d'Italia: impraticabile per un privato | ❌ |
| GoCardless Bank Account Data | Era gratuito e diffuso | Ha chiuso le nuove iscrizioni da luglio 2025 | ❌ |
| **Enable Banking** (modalità *restricted*) | Gratuito per i **propri** conti, supporta UniCredit Italia con login + SCA | Le carte di credito UniCredit non sono esposte via PSD2; consenso da rinnovare periodicamente; serve un backend (Cloud Functions → piano Blaze) | ✅ Fase 3 |
| **Import file dall'home banking** (CSV/Excel) | Zero costi, zero terze parti, massima privacy | Manuale (1 minuto al mese) | ✅ Fase 1 |

Proposta: si parte con l'import da file e si aggiunge Enable Banking in Fase 3, mantenendo l'import come alternativa sempre disponibile.

## 6. Come verranno costruite le strategie di risparmio

**Principio: prima regole trasparenti e misurabili, poi (eventualmente) AI.** Ogni proposta deve dire *perché*, *quanto* e *con quale affidabilità*.

### 6.1 Pipeline

```
Movimenti ─► Categorizzazione ─► Baseline per categoria ─► Rilevatori ─► Proposte
                                    (mediana 3‑6 mesi,                    (azione, € stimati,
                                     anomalie escluse)                      confidenza)
                                                                              │
             Ricalibrazione ◄── Monitoraggio mensile ◄── Piano accettato ◄────┘
                                (previsto vs realizzato)   (obiettivo in €/mese)
```

### 6.2 Rilevatori previsti (v1)

| Rilevatore | Cosa cerca | Azione proposta | Affidabilità della stima |
|---|---|---|---|
| Abbonamenti ricorrenti | Stesso esercente, importo simile, cadenza mensile/annuale | Disdire o declassare quelli poco usati | Alta (importo certo) |
| Commissioni e canoni bancari | Canone conto, commissioni bonifici/prelievi | Passare a un'offerta a canone zero o cambiare pacchetto | Alta |
| Utenze e telefonia | Luce, gas, mobile, fibra sopra la mediana o rincari | Confronto sul Portale Offerte ARERA | Media |
| Assicurazioni | Premi annuali (RC auto, casa) in scadenza | Promemoria 45 giorni prima con richiesta preventivi | Media |
| Piccole spese frequenti | Bar, delivery, ristoranti, acquisti online d'impulso | Tetto settimanale, ridotto del 20‑30% rispetto alla baseline | Bassa (dipende dal comportamento) |
| Spesa alimentare | Confronto con benchmark ISTAT per la tua composizione familiare | Lista, discount, marca del distributore | Bassa‑media |
| "Paga prima te stesso" | Saldo medio che resta sul conto a fine mese | Bonifico automatico il giorno dello stipendio verso un conto separato | Alta (è un'automazione) |

### 6.3 Previsioni

Per ogni piano accettato si calcolano **due scenari**:
- **Prudente** = risparmio teorico × aderenza attesa (es. 90% per una disdetta, 40% per un tetto comportamentale).
- **Atteso** = risparmio teorico × aderenza storica reale, che si aggiorna mese dopo mese.

Proiezione cumulata a 12, 24 e 60 mesi. Un eventuale tasso di rendimento del capitale risparmiato è **un parametro che imposti tu** (default 0%): RisparmIA non fa consulenza finanziaria.

### 6.4 Monitoraggio

- Risparmio realizzato = baseline − speso effettivo, mese per mese, per ogni piano.
- Semaforo per piano (in linea / in ritardo / fuori strada) e barra "previsto vs realizzato" complessiva.
- Se un piano è fuori strada per 2 mesi consecutivi, il motore propone di ricalibrarlo (obiettivo più basso o azione diversa) invece di continuare a mostrare una previsione irrealistica.

### 6.5 AI (Fase 4, da decidere)

Un modello linguistico può aiutare a categorizzare i movimenti ambigui e a spiegare le proposte in linguaggio naturale. Per privacy lo userei **solo su dati aggregati e anonimi** (es. "categoria Ristoranti: 310 €/mese, +40% vs baseline"), mai sulle descrizioni dei movimenti.

## 7. Quanto si può risparmiare davvero?

### Cosa dicono i dati

- **Spesa media delle famiglie italiane (ISTAT, anno 2024):** 2.755 €/mese in media, 2.240 € la mediana; gli alimentari pesano il 19,3%. Fonte: [ISTAT, Spese per consumi delle famiglie – Anno 2024](https://www.istat.it/comunicato-stampa/spese-per-consumi-delle-famiglie-anno-2024/).
- **Levi & Benartzi, "Mind the App"**: gli utenti di un'app di aggregazione conti hanno ridotto la spesa in media del **15,7%**, quasi tutto sulle spese discrezionali ([SSRN](https://papers.ssrn.com/author=3573455), [sintesi Wharton BCFG](https://bcfg.wharton.upenn.edu/newsletter-may-2019/)). Attenzione: il dato viene da coperture secondarie legate all'azienda dell'app, il campione è auto‑selezionato (chi scarica l'app è già motivato) e l'effetto tende a calare nel tempo. Va letto come **tetto massimo**, non come aspettativa.
- **Carlin, Olafsson, Pagel, "Mobile Apps and Financial Decision Making"** (Review of Finance, 2023): con l'accesso via app le commissioni per fondi insufficienti sono calate del **38%** in 24 mesi ([Review of Finance](https://revfin.org/?p=3045), [Rice Business](https://business.rice.edu/wisdom/can-mobile-banking-app-really-save-you-money)). Indica che vedere i dati riduce soprattutto gli **errori costosi**, più che cambiare lo stile di vita.

### La mia stima prudente (è una mia inferenza, non un dato pubblicato)

Su una famiglia con spesa vicina alla media ISTAT (≈2.750 €/mese):

| Leva | Risparmio realistico | Note |
|---|---|---|
| Disdette abbonamenti inutilizzati | 10‑40 €/mese | Una tantum, si mantiene |
| Rinegoziazione utenze, telefonia, assicurazioni, conto | 20‑60 €/mese | Richiede 2‑3 ore l'anno |
| Spese discrezionali (bar, delivery, ristoranti, impulso) | 5‑10% della categoria | L'effetto cala se non c'è monitoraggio |
| Spesa alimentare | 3‑6% della categoria | Abitudini difficili da cambiare |

**Totale realistico: circa il 3‑6% della spesa mensile il primo anno (≈80‑170 €/mese, 1.000‑2.000 €/anno).** Oltre il 10% si arriva solo con decisioni strutturali (casa, auto, mutuo) che un'app può suggerire ma non realizzare.

La leva più potente non è tagliare ma **automatizzare**: il bonifico "paga prima te stesso" fa sì che il risparmio previsto diventi reale invece di restare sul conto e venire speso.

## 8. Decisioni che ti chiedo

1. **Collegamento UniCredit**: partiamo con l'import da file e aggiungiamo Enable Banking in Fase 3? *(consigliato: sì)*
2. **Piano Firebase Blaze** (pago a consumo, a questi volumi ~0 €, ma richiede una carta) quando arriveremo alla Fase 3? *(consigliato: sì, con budget alert a 1 €)*
3. **Utenti**: solo tu, o anche altri membri della famiglia con dati condivisi? *(cambia la gestione delle chiavi di cifratura)*
4. **AI nel motore risparmi**: no, oppure solo su dati aggregati? *(consigliato: solo aggregati, in Fase 4)*
5. **Subagenti**: tutti e quattro subito, o i primi due adesso e gli altri in Fase 2? *(consigliato: due adesso)*
