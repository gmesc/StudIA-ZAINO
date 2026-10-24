# Sicurezza dei documenti e accesso al disco

ZAINO tratta i materiali importati come dati non fidati. Limita i formati accettati, disabilita le funzionalità attive dei documenti e assegna alle operazioni aree di lettura e scrittura definite nel processo principale. Non chiede privilegi di amministratore per usare lo zaino e non modifica i permessi dell'intero computer.

## PDF: lettura senza codice attivo

I PDF sono mostrati dal PDF.js incluso nell'app. I caricamenti dichiarano `isEvalSupported:false` e `enableXfa:false`. I due visualizzatori non collegano un gestore degli script PDF; usano `annotationMode:1` per mostrare l'aspetto delle annotazioni senza moduli interattivi e disabilitano l'editor PDF. Non viene fornito un gestore per scaricare o aprire gli allegati incorporati.

Restano disponibili selezione del testo, navigazione tra pagine, evidenze di ZAINO e ritagli. Le evidenze sono dati dello zaino: non autorizzano l'esecuzione di JavaScript contenuto nel PDF. L'apertura alternativa del PDF in una nuova finestra non è offerta.

I collegamenti esterni possono aprire nel browser di sistema soltanto URL HTTP/HTTPS validi, senza credenziali incorporate. Altri schemi e nuove finestre interne sono bloccati. La navigazione della finestra dell'app e dei suoi frame è limitata; documenti e anteprime non possono caricare script, pagine o risorse remote.

## Renderer isolato e richieste al main

La finestra principale usa `sandbox:true`, `contextIsolation:true`, `nodeIntegration:false` e `webSecurity:true`; i webview sono disabilitati. Il preload non importa `fs`, `path` o librerie applicative: espone comandi nominati attraverso Electron. Anche i salvataggi sincroni di appunti, evidenze e album passano dal main, conservando il salvataggio alla chiusura.

Il main verifica che ogni richiesta provenga dal frame principale della finestra ZAINO e dal file dell'app. I canali e i metodi sincroni ammessi sono elencati esplicitamente; non esiste un comando pubblico generico «leggi/scrivi questo percorso». Le funzioni storiche CORSI restano disabilitate. Permessi browser come camera, microfono e geolocalizzazione sono negati. La Content Security Policy vieta frame, oggetti incorporati e connessioni remote del renderer; conserva gli script inline necessari al monolite. Per questo l'escape dei testi e la sanitizzazione del contenuto rimangono necessari.

La policy applicativa è in `lib/sicurezza-app.js`, il controllo dei percorsi e delle operazioni filesystem in `lib/permessi-disco.js`, il ponte sincrono in `lib/vault-sincrono.js`. La policy segue anche le operazioni asincrone avviate dal comando. Il motore OCR legge le lingue incluse nell’app senza usare una cache esterna, così il suo worker non scrive attraverso percorsi cache fuori dalla policy.

## Privilegi delle operazioni

«Sola lettura» significa che la funzione non può scrivere nell'area. «Vietato» significa che il relativo comando non riceve accesso a quell'area. La tabella riguarda il filesystem gestito dall'app; sistema operativo, librerie di sistema e servizi scelti dall'utente hanno responsabilità proprie.

| Operazione | Lettura consentita | Scrittura consentita |
|---|---|---|
| Importazione | File o cartelle realmente scelti/trascinati; materiali dello zaino | Copie in `MATERIALI/` e registri dei gruppi; vietata sulla sorgente esterna |
| Apertura e ricerca nei materiali | Documenti/media ammessi dello zaino | Vietata sui materiali; eventuali indici sono separati |
| Appunti ed evidenze | Zaino corrente | `APPUNTI/`, inclusi indice, versioni e segni |
| Mappe | Zaino corrente | `MAPPE/` |
| Album e ritagli | Zaino corrente | `ALBUM/`, immagini, miniature e relativo registro |
| Organizzazione dei gruppi | Zaino corrente | Registro della sezione; per le fonti anche la struttura `MATERIALI/PDF/` |
| Rinomina/rimozione di fonti | Zaino corrente | Materiali e registri/rimandi collegati in appunti, mappe e album; il comando esplicito mantiene coerenti i riferimenti |
| Riconoscimento OCR | PDF dello zaino e temporanei privati | Copia PDF e indici in `MATERIALI/`, temporanei; vietata sull'originale esterno |
| Posizione di lettura/ascolto | Zaino corrente | Soltanto i registri di posizione pertinenti |
| Chat AI | Fonti e conversazioni dello zaino, impostazioni | `CHAT/`, inventario delle fonti e cache necessaria; registro costi. `APPUNTI/` solo con il comando di salvataggio della risposta |
| Indice locale e schede | Fonti dello zaino, modello locale | `_fonti-ai.json` e `_lavorazione/rag/`; copia negli appunti solo a comando |
| Ripasso | Fonti, schede e ripassi dello zaino | `RIPASSO/`, cache/inventario necessari e costi delle chiamate AI |
| Download embedder | Risorse del modello | Cartella `rag-model/` nei dati locali dell'app |
| Preferenze/profili | Preferenze pertinenti | `.studia/` del vault; configurazione e chiavi nei dati locali dell'app tramite funzioni dedicate |
| Creazione/rinomina/rimozione zaini | Elenco degli zaini | `Zaini/`, soltanto attraverso quei comandi espliciti |
| Esportazione | Contenuto da esportare e risorse dell'app | File scelto dal dialogo nativo e temporanei privati |
| Altri percorsi del computer | Vietata ai comandi sui contenuti, salvo selezioni esplicite e servizi di sistema necessari | Vietata ai comandi sui contenuti, salvo destinazioni esplicite |

I metadati necessari per verificare le cartelle non concedono automaticamente la lettura del loro contenuto. Configurazione, chiavi, modello e temporanei non vengono consegnati al documento aperto. La ricerca locale usa un indice su disco, conservato nello zaino dopo la chiusura; la sincronizzazione della cartella può sincronizzare anche quell'indice.

## Importazione e apertura dei formati

La lista consentita comprende PDF, testo UTF-8/Markdown e sottotitoli, immagini raster supportate, audio e video supportati. Ogni funzione ammette solo il proprio sottoinsieme. HTML, SVG importati, script, eseguibili, archivi e documenti con macro non sono materiali apribili/importabili; i vecchi percorsi d'importazione non possono aggirare la lista tramite un'opzione «forza».

L'estensione da sola non basta: si controllano firma del contenuto e tipo di file regolare. Il testo viene verificato come UTF-8 senza caratteri binari di controllo. Un eseguibile semplicemente rinominato `.pdf` viene rifiutato. I controlli si applicano prima dell'importazione e quando viene risolta/aperta una risorsa locale; non si considera affidabile un file soltanto perché era già nel vault.

Il preload ottiene il percorso da un oggetto `File` reale di Electron. Il main registra l'identità del file selezionato e la ricontrolla prima di importarlo; una stringa arbitraria dal renderer non costituisce un'autorizzazione. La copia usa il descrittore verificato, controlla eventuali modifiche durante la lettura e non sovrascrive silenziosamente una destinazione esistente.

Percorsi fuori dall'area autorizzata, componenti simbolici all'interno delle aree, hard link e file speciali vengono rifiutati. Le copie importate e le scritture atomiche sono create con modo `0600` sui sistemi POSIX: lettura/scrittura del proprietario, senza bit di esecuzione. Questo non è un attributo universale «non eseguibile» né una riscrittura dei permessi di tutti i file preesistenti; su Windows valgono anche le ACL del sistema.

Le esportazioni usano il dialogo nativo per scegliere la destinazione. Il renderer non può sostituirlo fornendo un percorso da sovrascrivere. L'anteprima di stampa ha JavaScript disabilitato e vive in una finestra senza ponte verso il vault.

## Limiti e manutenzione

Queste protezioni non sono un antivirus e non certificano che un PDF, un'immagine o un video siano innocui. Un formato valido può sfruttare un difetto del parser o consumare risorse. Non si analizzano o «ripuliscono» tutte le possibili strutture malevole del documento.

La sandbox del renderer è una protezione di Electron/Chromium. La policy di lettura e scrittura del main è invece un confine applicativo: il processo principale, il worker Node per estrarre testo PDF e i convertitori nativi HEIC/OCR non sono sandbox del sistema operativo. L'app continua a operare con l'account dell'utente per i servizi che le servono.

Controlli dei descrittori, identità e percorsi riducono le sostituzioni dei file, ma non eliminano tutte le corse con altre applicazioni che modificano contemporaneamente directory o file (TOCTOU). Non proteggono da un sistema operativo o da un account già compromesso. Limiti di tempo/memoria dell'estrazione contengono alcuni blocchi, senza dimostrare l'assenza di vulnerabilità.

Electron, Chromium, PDF.js e gli altri decoder devono essere mantenuti aggiornati e verificati prima della distribuzione. Un vecchio advisory PDF.js non va attribuito automaticamente alla versione vendorizzata attuale.

Fonti ufficiali: [raccomandazioni di sicurezza Electron](https://www.electronjs.org/docs/latest/tutorial/security), [opzioni e API PDF.js](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html), [advisory Mozilla CVE-2024-4367 e mitigazione `isEvalSupported:false`](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq). Quest'ultimo riguarda le versioni fino a 4.1.392 ed è corretto dalla 4.2.67; documenta un rischio storico, non una vulnerabilità accertata del build incluso in ZAINO.
