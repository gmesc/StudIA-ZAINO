# Onboarding di primo avvio — documento di consegna

> Scritto il 2026-07-26 alla fine di una sessione lunga, perché la prossima possa
> partire senza ricostruire il contesto. Tutto ciò che segue è stato verificato
> sul codice, non ricordato.

> **FATTO il 2026-07-26.** L'onboarding è implementato: `lib/ambiente.js`, gli IPC
> `ambiente:rileva` / `onboarding:stato` / `onboarding:fatto`, la card `#primoAvvio`
> a tre pannelli, il bottone «Rifai il primo avvio» in ⚙ › Utente. `npm test` = **229
> controlli** verdi (erano 196). Le decisioni prese e le due sorprese trovate strada
> facendo sono in coda, sotto «Esito».

## Perché

StudIA oggi funziona, ma **presume che chi la apre sappia già delle cose**. Al
primo avvio chiede solo la cartella del vault; tutto il resto — quale motore AI
userà, che serve Python per trascrivere, che il primo video scarica 1,5 GB di
modello — lo scopre sbattendoci contro, spesso a metà di un'operazione lunga.

Per chi installa il `.dmg` questo è il vero ostacolo all'adozione, più della
chiave API. L'onboarding deve **rilevare com'è fatta la macchina e guidare di
conseguenza**, invece di far scoprire i requisiti per tentativi.

## Che cosa esiste già (non va riscritto)

| Pezzo | Dove | Nota |
|---|---|---|
| Overlay scelta vault | `App/StudIA.html` → `#setup` (CSS r. ~495) | Un solo passo: bottone `#chooseVault` → `vault:choose` → `location.reload()` |
| Card profilo di apprendimento | `App/StudIA.html` → `#profiloSetup` (CSS r. ~610) | Card unica con 3 passi interni, skippabile. **È il modello UI da imitare** |
| Flag «ho saltato» | `main.js` → `profile:skip` / `profile:skipped` (r. 242-243), `config.profiloSaltato` | Il pattern per non riproporre un passo saltato |
| Diagnosi Claude Code | `lib/ai/claudecode.js` → `diagnosi()` | Ritorna `{ok, percorso, versione}` o `{ok:false, motivo, spiegazione}` |
| Quali fornitori sono pronti | `main.js` → `chiaviDisponibili()` | Include già `claudecode` quando il binario c'è |
| Elenco modelli reali | `lib/ai/modelli.js` + IPC `models:refresh` | Bottone già presente in ⚙ › AI |
| Python + dipendenze | `main.js` → `findSystemPython()`, `venvPython()`, `ensureDeps(send)` (r. 121-155) | **Oggi gira solo quando parte l'ingest**: è lì che l'utente scopre che manca Python |
| Scaffold cartelle vault | `main.js` → `scaffold(v)` | Crea Fonti, Media, Lezioni, Corsi, Trascrizioni, Indice-PDF, Costi |

## Che cosa manca

Una schermata di primo avvio che, **dopo** la scelta del vault e **prima** che
l'utente provi a fare qualcosa, verifichi quattro cose e le spieghi:

1. **Motore AI.** C'è Claude Code (→ nessuna chiave, usa l'abbonamento) oppure
   serve una chiave API? Deve poter scegliere, non subire un default.
2. **Python.** `findSystemPython()` trova qualcosa? Se no, la trascrizione dei
   video non partirà mai e va detto ora, con il comando da eseguire.
3. **Spazio e primo download.** Il modello Whisper pesa ~1,5 GB e si scarica al
   primo ingest: dirlo prima, non durante.
4. **Profilo di apprendimento.** Già gestito da `#profiloSetup`: va solo messo
   in coda alla sequenza invece di comparire per conto suo.

## Come dovrebbe funzionare

**Una card, quattro passi interni, ognuno saltabile.** Stesso impianto di
`#profiloSetup`: un pannello per volta, un'azione principale per schermata, lo
stato sempre visibile. È un requisito d'uso dichiarato dell'app, non estetica.

Ogni passo mostra **l'esito del rilevamento**, non una domanda a vuoto:

- ✅ «Claude Code trovato (2.1.211) in `~/.local/bin/claude` — userai il tuo
  abbonamento, nessuna chiave da inserire.» → *Va bene* / *Preferisco una chiave API*
- ⚠️ «Claude Code non risulta installato. Puoi installarlo, oppure incollare qui
  una chiave API.» → campo chiave + link
- ✅ «Python 3.13 trovato.» / ⚠️ «Python non trovato: senza, i video non si
  trascrivono. Installalo con `xcode-select --install`.»

L'onboarding **non deve bloccare**: chi salta tutto arriva comunque all'app, e
ritrova gli stessi controlli in ⚙ Impostazioni. Un flag in `config.json`
(`onboardingFatto: true`) impedisce che si ripresenti; una voce in Impostazioni
permette di rifarlo.

## Implementazione proposta

**`lib/ambiente.js`** (nuovo, puro e testabile):

```js
function rileva()  // → { claudecode:{...}, python:{trovato, versione, percorso},
                   //     chiavi:{anthropic,openai,google}, vault:{path, scritturaOk},
                   //     spazioLiberoGb, modelloWhisperPresente }
function consiglio(stato)  // → { motore:'claudecode'|'apikey'|'nessuno', avvisi:[...] }
```

`consiglio()` è la parte che vale i test: date le condizioni della macchina, che
cosa suggerire. Va scritta come funzione pura, con lo stato passato come
argomento, così `npm test` la prova senza toccare il sistema.

**IPC** in `main.js`: `ambiente:rileva` (handle), `onboarding:fatto` (set del
flag), `onboarding:stato` (già fatto?). Il ponte in `preload.js` accanto a
`claudecode` e `modelli`.

**UI** in `App/StudIA.html`: nuova card `#primoAvvio`, stessa struttura di
`#profiloSetup`, mostrata da `initSettingsTabs`/bootstrap quando
`vault.path && !config.onboardingFatto`. Al termine incatena `#profiloSetup`
invece di lasciarlo comparire da solo.

**Ordine di comparsa al primo avvio:** `#setup` (vault) → `#primoAvvio`
(motore + Python + spazio) → `#profiloSetup` (profilo) → app.

## Trappole già pagate — non ripagarle

- **PATH del Finder.** Un'app lanciata dal Finder eredita il PATH minimo di
  launchd (`/usr/bin:/bin:/usr/sbin:/sbin`), **non** quello della shell. Per
  `claude` è già risolto in `claudecode.percorso()` (7 posizioni note + ripiego
  su `$SHELL -lc`). **Per Python il problema è diverso e va capito bene prima di
  "correggerlo":** `findSystemPython()` trova comunque qualcosa, perché macOS
  fornisce `/usr/bin/python3` — verificato, col PATH ridotto risponde. Ma su
  questa macchina quel binario è **Python 3.9.6**, mentre l'utente ha 3.10 in
  `/Library/Frameworks`, 3.13 in Homebrew. Quindi il rischio non è «non trovato»
  ma **«trovato quello sbagliato»**: il venv viene creato su un interprete vecchio
  e `mlx-whisper` potrebbe non installarsi o installarsi peggio. Da fare:
  preferire l'interprete più recente fra i candidati noti (`/opt/homebrew/bin`,
  `/usr/local/bin`, `/Library/Frameworks/Python.framework/…`, `$SHELL -lc`) e
  **mostrare all'utente quale è stato scelto**, con la versione. Nota ulteriore:
  se gli strumenti da riga di comando di Xcode non sono installati,
  `/usr/bin/python3` è uno stub che apre una finestra di installazione — dentro
  un'app packaged è un blocco silenzioso.
- **Chiavi cifrate col Keychain**: leggibili solo dentro Electron. Qualunque
  verifica che le usi non si può provare da uno script `node` esterno.
- **`--bare` di Claude Code**: disattiva OAuth e keychain, quindi rompe proprio
  l'aggancio all'abbonamento. Non usarlo.
- **`preload` è eager**: `window.vault.courses` è calcolato una volta sola alla
  creazione della finestra. Dopo modifiche al vault serve `location.reload()`.
- **Listener IPC**: i canali nuovi restituiscono la funzione di unsubscribe; gli
  `ingest.on*` storici no, e ce ne sono già due registrati altrove.
- **Niente `requestAnimationFrame`** per le barre di avanzamento: viene sospeso a
  finestra in secondo piano, che è esattamente quando si guarda altrove. `setTimeout`.

## Verifica

1. `npm test` (oggi **196 controlli**) deve restare verde; aggiungere i casi di
   `consiglio()`: macchina con solo Claude Code, con sola chiave, con entrambi,
   con nessuno dei due, senza Python.
2. Simulare il PATH del Finder: `process.env.PATH='/usr/bin:/bin:/usr/sbin:/sbin'`
   e verificare che `claude` venga trovato (già vero) e che per Python venga
   scelto **l'interprete più recente disponibile**, non `/usr/bin/python3` 3.9.
3. Prova a mano: rinominare `config.json`, riavviare l'app, percorrere la
   sequenza intera; poi rifarla saltando ogni passo e verificare che l'app resti
   usabile e che nulla si ripresenti al riavvio.

## Domande aperte per l'utente — risolte adottando le proposte

- Se non c'è **né** Claude Code **né** una chiave → **sola lettura**, con un avviso
  non modale. In `consiglio()` è l'avviso `motore-assente` e il campo
  `soloLettura: true`; l'onboarding lo mostra e lascia comunque entrare nell'app.
- **Spiegare, non installare.** Il comando compare con un bottone «Copia» che lo
  mette negli appunti. Eseguire installazioni per conto dell'utente richiederebbe
  la sua password ed è invasivo.
- **Notarizzazione: traccia separata**, perché è l'unico pezzo che il codice non
  può risolvere da sé — serve l'iscrizione all'Apple Developer Program (99 €/anno)
  e il certificato «Developer ID Application». Vedi «Notarizzazione» in coda.

## Esito — che cosa è stato costruito

| Pezzo | Dove |
|---|---|
| Rilevamento + consiglio | `lib/ambiente.js` — `rileva()` guarda il sistema, `consiglio(stato)` è **pura** |
| Scelta dell'interprete | `lib/ambiente.js` → `scegli(visti, esplicito)`, pura e testata a parte |
| IPC | `main.js` → `ambiente:rileva`, `onboarding:stato`, `onboarding:fatto` |
| Ponte | `preload.js` → `window.vault.ambiente.rileva()`, `window.vault.onboarding.{stato,fatto}` |
| UI | `App/StudIA.html` → card `#primoAvvio`, tre pannelli, CSS `.pa-*` |
| Rifallo | ⚙ › Utente → «Rifai il primo avvio» (`#rifaiOnboarding`) |

Sequenza effettiva: `#setup` (vault) → `#primoAvvio` (motore · Python · spazio) →
`#profiloSetup` (profilo) → app. Nessun passo blocca: ogni pannello ha «Salta»,
Escape chiude tutto, e il flag `config.onboardingFatto` impedisce che si ripresenti.

Un dettaglio che vale la pena non disfare: **i testi degli avvisi stanno in
`consiglio()`, non nell'HTML.** L'UI li pesca per `id` (`avvisiDi([...])`), così la
frase che l'utente legge è la stessa che i test verificano. Quando i pannelli
mostravano anche un proprio esito, il risultato era una doppia — «Python 3 non
trovato» due volte di fila — e sono stati tolti gli esiti ridondanti.

## Due sorprese trovate strada facendo

**Il ceiling sulla versione di Python non serve.** La regola «prendi il più
recente» fa scegliere su questa macchina il 3.14.6 di Homebrew invece del 3.9.6 di
`/usr/bin/python3`: giusto, ma sembrava rischioso, perché un Python appena uscito
di solito non ha ancora le wheel native. Verificato con `pip download --no-deps`:
**mlx, mlx-whisper, onnxruntime, ctranslate2 e pypdf hanno tutti wheel `cp314`.**
Nessun tetto, quindi. Il caso resta però possibile in futuro, e `ensureDeps()` ora
lo dice chiaramente: se `pip install` fallisce, l'errore nomina l'interprete usato
e suggerisce `STUDIA_PYTHON`. Quella variabile ora **vince** sull'euristica, invece
di essere solo il primo candidato di una lista ordinata per versione.

**Un `ReferenceError` che rompeva due riquadri delle Impostazioni.** `esc()` è
definita in `App/StudIA.html` dentro `initVaultUI`, ma `initSettingsTabs` — IIFE
separata — la usava per disegnare la tabella dei modelli e il box di stato di
Claude Code. Entrambi morivano zitti. Risolto con `var esc=escHtml;` in testa a
`initSettingsTabs` (`escHtml` è globale). Andava sistemato comunque: l'onboarding
riusa quella stessa diagnosi.

## Notarizzazione del `.dmg` — che cosa serve

Il muro è l'iscrizione all'**Apple Developer Program** (99 €/anno): la firma ad-hoc
(`--sign -`) non è notarizzabile per definizione, perché Apple deve poter risalire
a un'identità. Il resto è configurazione.

⚠️ **L'istruzione «clic destro → Apri» è scaduta.** Da macOS 15 Sequoia Apple ha
rimosso quella scorciatoia per le app non firmate: ora l'utente deve andare in
Impostazioni di Sistema → Privacy e sicurezza → «Apri comunque». L'ostacolo è
peggiorato, non stabile.

I pezzi: certificato **Developer ID Application** (non «Apple Development», non
«Mac App Distribution»); una chiave **App Store Connect API** (`.p8` + Key ID +
Issuer ID) per `notarytool`, preferibile all'Apple ID perché non si rompe con la
2FA; **hardened runtime** con gli entitlement che servono a Electron; infine firma
→ notarizzazione → stapling.

Da creare, `build/entitlements.mac.plist` con `allow-jit`,
`allow-unsigned-executable-memory`, `allow-dyld-environment-variables`,
`disable-library-validation`. **Niente `app-sandbox`**: serve solo per lo Store, e
qui sarebbe fatale — StudIA legge cartelle arbitrarie e fa `spawn` di `python3` e
`claude`.

Nel `build.mac` di `package.json`: **togliere `"identity": null`** (è la riga che
oggi salta la firma) e aggiungere `hardenedRuntime: true`, `gatekeeperAssess:
false`, `entitlements` / `entitlementsInherit`, `notarize: { teamId: "…" }`. Poi
`npm run dist:mac` con `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`
nell'ambiente fa tutto da sé.

**La firma manuale post-build va abbandonata, non adattata.** L'attuale
`codesign --force --deep --sign -` seguito da `hdiutil` esisteva solo perché
`identity: null` lasciava il bundle non sigillato; `--deep` è deprecato da Apple e
firma nell'ordine sbagliato (i binari annidati vanno firmati dall'interno verso
l'esterno). electron-builder lo fa nell'ordine giusto.

Due cose che qui non fanno male: `asar: false` — la notarizzazione accetta file
sciolti, e i `.py` non sono Mach-O; e il **venv, che vive fuori dal bundle**, nel
vault. Se un giorno finisse in `Contents/Resources`, la notarizzazione si
romperebbe a ogni `pip install`. Da provare comunque dopo il primo build firmato:
che l'ingest parta ancora, perché l'hardened runtime cambia le regole per i
processi figli.
