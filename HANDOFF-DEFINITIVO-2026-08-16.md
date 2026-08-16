# Handoff definitivo — 16 agosto 2026

> **A chi arriva adesso: questo file basta per ripartire.** Dice dov'è il codice, che cosa è appena
> entrato, che cosa resta aperto e in che ordine — e le trappole fresche, che sono la parte utile.
>
> Sostituisce [HANDOFF-DEFINITIVO-2026-08-15.md](HANDOFF-DEFINITIVO-2026-08-15.md), che resta la
> lettura di dettaglio su Album Foto, banco 3×3, Confronto. Il **§4 del
> [14 agosto](HANDOFF-DEFINITIVO-2026-08-14.md)** — le quattro cose che contano prima del beta —
> è ancora la lista giusta; la prima, il pacchetto, oggi è fatta.
>
> **Come si costruisce qui** lo dice [GUIDA-ARCHITETTO.md](GUIDA-ARCHITETTO.md), aggiornata oggi al §6.
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato, col rimedio accanto.

---

## 1. Dove sono i lavori

| | |
|---|---|
| rami | tre, in fila: **`pacchetto`** → **`selmenu-closepops`** (fix di closePops, icona, emoji, evidenziatore) → **`installer-windows`** (Windows, pacchetto Intel, `lib/ambiente.js`). L'ultimo contiene tutti: unendo quello entra tutto in un colpo |
| commit | `installer-windows` alla testa · `main` ferma a `b005214` |
| remoto | `git@github.com:gmesc/StudIA.git` (privato); **nessun ramo è salito** |
| suite | ✅ **36** file di unità · ✅ **45** prove CDP sul codice · ✅ le stesse **dentro il pacchetto** (macOS) |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                                   # 36 file, exit 0
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh         # 45 prove sull'app viva
STUDIA_PORTA=9346 STUDIA_APP="$PWD/dist/mac-arm64/StudIA.app" \
  ./test/cdp/con-vault-di-prova.sh                         # le stesse DENTRO il pacchetto
npm run pacchetto                                          # macOS: bundle + firma + dmg + controprova
npm run dist:win                                           # Windows: l'installer NSIS x64
```

**Il rosso di `prova-testolayer` non esiste più**: non era ambientale (§3).

---

## 2. Che cosa è entrato oggi

### Il pacchetto — `npm run pacchetto`
`dist/StudIA-1.0.0-arm64.dmg` è di oggi, **195 MB**, e dentro c'è l'app firmata. Ci sono voluti tre
guasti prima di arrivarci, tutti invisibili finché non si guarda la copia giusta:

1. **`npm run dist:mac` non funzionava più.** electron-builder 25 rifiuta la chiave `"//"` che
   teneva il commento dentro `extraResources` (lo schema ammette solo `filter`/`from`/`to`). Il
   perché di quel file — le licenze dei componenti di Chromium, 14 MB, che vanno accompagnate al
   binario — ora sta nel commit, non in un JSON che non ammette commenti.
2. ⚠️ **Il dmg conteneva l'app NON firmata.** `mac.identity: null` fa saltare la firma, e su arm64
   un bundle non sigillato è quello che macOS chiama «danneggiato». Il rimedio noto era firmare a
   mano dopo il build — ma electron-builder il dmg lo ha già fatto **prima**, con dentro la copia
   non firmata. Firmare `dist/mac-arm64/StudIA.app` e spedire quel dmg è il modo più facile di
   credere di aver rimediato senza aver rimediato. `bin/pacchetto-mac.sh` fa i quattro passi in
   fila e chiude con **la controprova che conta**: monta il dmg e verifica la firma dell'app **lì
   dentro**, l'unica copia che il tester eseguirà davvero.
3. **`prompts/**` era ancora nella whitelist `files`** e quella cartella non esiste più. Una voce
   morta non rompe niente e nasconde che nessuno guarda quella lista.

Il pacchetto è stato provato, non solo costruito: l'app estratta dal dmg parte su un vault suo, la
card di primo avvio compare, **zero errori di console**, e **tutte le prove CDP girano dentro il
bundle** (`STUDIA_APP=…`, interruttore nuovo del runner; erano 43 quel giorno, 45 stasera). Quindi
pdf.js vendorizzato, tesseract,
OCR, album e stampa funzionano *impacchettati*, non solo in cartella.

⚠️ La firma resta **ad-hoc**: `spctl` dirà sempre «rejected» e al primo avvio serve Impostazioni di
Sistema → Privacy e sicurezza → «Apri comunque». Per togliere quel passo servono l'Apple Developer
Program e la notarizzazione — e allora `bin/pacchetto-mac.sh` **si butta, non si adatta**: esiste
solo per compensare `identity: null`.

### `prova-testolayer` — chiuso, e non era il layer
Vedi §3: era la prova, in tre modi diversi.

### L'icona dell'app — `npm run icona`
Il tocco accademico di OpenMoji (1F393) su tile bianco, 824×824 dentro una tela di 1024 (i 100 px
di margine sono lo spazio dell'ombra di sistema). ⚠️ La forma dell'angolo è **misurata**, non
indovinata: campionata da un'icona di sistema — bordo sinistro a dieci altezze e rientro sulla
diagonale — e riprodotta da un quarto di superellisse con raggio 0,2803 del lato ed esponente 2,56.
Scarto sotto i 3 px ovunque, 1 px sulla diagonale. Un arco di cerchio sbaglierebbe di 37 px lì: è
la differenza fra «icona di macOS» e «quadrato stondato». I crediti dichiaravano già l'icona come
opera derivata CC BY-SA 4.0; ora quella riga corrisponde a un fatto.

### La tavolozza di emoji — `npm run emoji`
Il selettore della barra degli appunti passa da 89 emoji scelte a mano a **2111**: tutte le emoji
Unicode che il font dell'app sa disegnare, con le curate in testa. Non pesa quasi niente perché
sono **caratteri**, non immagini: il font OpenMoji era già nel pacchetto, e l'elenco costa 128 KB
di testo. Che il font le disegni è verificato disegnando ogni carattere due volte, con e senza —
se i pixel coincidono a disegnarlo è il sistema, e quella voce non entra (scartate: zero).
Le parole di ricerca sono **italiane** (Unicode CLDR): «attenzione» trova ⚠️.

⚠️ Restano fuori le 405 icone «extra» in area a uso privato: dentro StudIA si vedrebbero, ma
finiscono negli appunti dell'utente, che devono restare leggibili in Obsidian o in una mail —
fuori di qui sarebbero quadratini.

### L'installer per Windows 11 — `npm run dist:win`
`dist/StudIA-1.0.0-setup-x64.exe` (142 MB): un NSIS che **non** è a un click solo — chiede dove
installare, mette il collegamento sul desktop, si disinstalla dal pannello. Si costruisce **dal
Mac senza Wine**: le dipendenze del progetto sono tutte JS, non c'è niente da ricompilare.
L'icona viene dalla stessa sorgente del Mac (`bin/icona.js` scrive anche `build/icon.ico`), ed è
verificata *dentro* `StudIA.exe` e dentro l'installer, non solo accanto.

⚠️ **Quello che il porting ha fatto emergere** sono le assunzioni macOS che non fanno rumore —
l'app parte lo stesso e mente. Tutte in `lib/ambiente.js`: i candidati Python erano solo percorsi
Unix; «quello di sistema» era scritto come `/usr/bin/python3` (su Windows il confronto era sempre
falso, quindi l'avviso «stai usando un altro interprete» non sarebbe comparso mai); e il rimedio
suggerito a chi non ha Python era `xcode-select --install`. `test/ambiente.js` prova il
comportamento Windows **da un Mac**, ridefinendo `process.platform`.

⚠️ **Non è ancora stato eseguito su Windows.** Da qui si può misurare che l'installer è un NSIS
valido, che contiene l'app intera e che l'icona è dentro l'exe — non che si installi e parta. Serve
una macchina o una VM Windows 11, ed è la prima cosa da fare prima di darlo a un tester.

Che cosa aspettarsi là, dichiarato:
- **SmartScreen**: l'installer non è firmato (serve un certificato EV o OV, a pagamento), quindi
  Windows dirà «ha protetto il PC» → «Ulteriori informazioni» → «Esegui comunque». È l'equivalente
  di «Apri comunque» del Mac;
- **HEIC**: niente conversione, `sips` è di macOS — il codice lo dice già all'utente;
- **la voce di sistema** (`say`) non c'è, ma la lettura ad alta voce **funziona lo stesso** con
  `speechSynthesis`, che su Windows usa le voci installate;
- **la pipeline** (trascrizione, OCR) dipende da un Python installato: il venv usa già
  `Scripts\python.exe`, ma quel percorso non è mai stato eseguito.

### Il pacchetto per i Mac Intel — `npm run pacchetto -- x64`
⚠️ Il pacchetto era **arm64 puro**: su un Mac Intel non parte — non «va lento», proprio non si apre.
Ora c'è anche `dist/StudIA-1.0.0-x64.dmg`. Il difetto che lo nascondeva: `artifactName` conteneva
«arm64» **scritto a mano**, quindi la build Intel provava a sovrascrivere il dmg dell'altra
architettura e moriva dentro `hdiutil` con un errore che parlava d'altro. Ora è `${arch}`, e la
controprova fa `lipo` sull'app **dentro il dmg**: due file che si chiamano quasi uguale sono due
file che si scambiano, e un tester Intel che riceve l'arm64 non vede un errore utile.

Misurato eseguendolo qui con Rosetta: parte, e passa **37 prove CDP su 45**. Le 8 rosse sono
**attese troppo corte, non guasti** — il layer di testo di un PDF da 266 pagine compare dopo 12,4 s
invece di 1-2, senza un errore di console.

### Quanto chiede la macchina — i numeri, non le impressioni
| | |
|---|---|
| macOS minimo | **12.0** (Electron 39): un Air 2013/2014, fermo a Big Sur, non apre l'app |
| memoria | 558 MB appena aperta · 667 MB con PDF da 266 pagine e mappa |
| OCR di un documento fotografato | picco **1,3 GB**, e ⚠️ **non cresce con le pagine** (1312 MB su 30 contro 1325 su 10): lavora una pagina per volta e libera |
| OCR, tempo per pagina | 1,7 s su Apple Silicon · 6,2 s sul pacchetto Intel |
| lettura avanzata (Chandra) | modello da 10,6 GB e 15,6 GB liberi richiesti: **fuori portata** su una macchina da 4 GB, ed è dichiaratamente opzionale |

Servono a rispondere «ci gira sul portatile vecchio?» senza riaprire il profiler: su 4 GB si studia
e si fa OCR di schede corte, non si trascrive e non si installa Chandra.

### L'evidenziatore — il testo resta nero
Il fondo pieno non è più diluito al 34%: i preset sono cinque colori **da evidenziatore** (giallo,
verde, rosa, arancio, azzurro) in `evidenzeColori()`, e il testo sotto resta nero. ⚠️ Le due
superfici ci arrivano per strade diverse perché sono fatte in modo diverso: nel **capitolo** il
fondo sta dietro il testo, quindi basta imporre il nero; sul **documento** il testo è nel canvas e
sopra c'è un layer di lettere trasparenti, quindi il layer si compone in `mix-blend-mode: multiply`
— imporre `color` lì accenderebbe le lettere trasparenti sopra quelle disegnate, due testi quasi
allineati.

⚠️ La **riga** dei colori resta una sola (condivisa col menu della mappa), ma le **tavolozze** sono
due: quelle della mappa sono tinte da tratto, queste sono inchiostro chiaro. Le evidenze già
segnate portano il loro colore sul disco e non cambiano.

`prova-evidenziatore.js` misura il contrasto dei preset col nero invece di giudicarlo: il più basso
è il rosa, 8,8:1 contro i 4,5 di WCAG.

---

## 3. ⚠️ La caccia che ha insegnato di più

Il rosso «a corse alterne» dell'11–15 agosto era **sistematico dentro la suite e verde da solo**.
Tre corse su tre lo hanno riprodotto appena si è smesso di chiamarlo flake.

Il metodo che l'ha sciolto: **far portare al rosso la sua diagnosi**. «Il testo non sta nella pagina
30» non dice *dove* sta; aggiunto il dump della provenienza, la prima corsa ha risposto
`daPagina: "1"` con `viewerAllaPagina: 30`. Da lì, tre strati:

1. ⚠️ **Il trascinamento finiva fuori dalla finestra.** Il filtro degli span guardava `top` e
   `bottom` e non `left` e `right`: se il riquadro della Fonte è più stretto della pagina, la riga
   esce a destra (misurato: da x=1243 a x=1759, finestra larga 1320). Lì Chrome non trova nessun
   carattere e porta il fuoco all'inizio del contenitore: la selezione diventa **all'indietro**,
   dalla pagina 1 — che nel DOM c'è ancora, sei span, il frontespizio — fino al punto di partenza.
   E siccome `getRangeAt(0)` mette sempre in ordine di documento, il rosso mostrava il frontespizio.
   **Il press era sempre stato giusto**: «caret alla pagina 30, collassato».
2. ⚠️ **Lo zoom era ereditato dalla prova precedente**, non dichiarato. Con una scala alta nessuna
   riga sta dentro la finestra. Ora la prova dichiara `page-width` — e **torna alla pagina 30**,
   perché cambiare scala fa smontare a pdf.js le pagine lontane (senza quel ritorno la prova
   accusava il layer di un'assenza causata da lei).
3. ⚠️ **Il menu della selezione restava aperto sopra il testo.** I doppi click lo aprono e
   `closePops()` **non lo chiude**: `#selMenu` e `#selBarra` non sono nel suo elenco e si chiudono
   con funzioni proprie. `elementFromPoint` sul punto di partenza restituiva `button.ctx-item`.

**Questo terzo strato riguardava anche l'app**, non solo la prova — ed è stato corretto in giornata
sul ramo `selmenu-closepops`: `closePops()` chiama ora `selMenuChiudi()` e `selBarraChiudi()`.
Erano rimasti fuori perché non hanno un attributo `open` da togliere ma uno stato in una classe;
`popAt()` comincia con `closePops()`, quindi ogni apertura di pannellino lasciava il menu sopra il
testo.

⚠️ Il rovescio, verificato prima di toccare, è il guasto 10.3.3: chi si apre al RILASCIO del
puntatore viene poi chiuso dal `click` che il browser manda subito dopo. Qui non succede — la barra
non nasce nel `mouseup` ma nel `setTimeout` del giro dopo, e il menu si apre col tasto destro, che
un click sinistro non genera. Lo misura `prova-selezione-menu`, che seleziona col mouse vero e
controlla «la barra è aperta».

E la regola di sempre: **una misura che contraddice un esperimento minimo identico va sospettata
prima del codice**. Qui la prova isolata era verde e la suite rossa: la differenza non era il layer,
era ciò che le altre prove lasciavano dietro (zoom, menu, larghezza del riquadro).

---

## 4. Che cosa resta aperto, in ordine

### 1. Unire i tre rami a `main`
Sono in fila e l'ultimo contiene gli altri: unito `installer-windows`, è unito tutto — oppure i tre
uno dopo l'altro, se si vogliono passi distinti.
Le quattro condizioni: (a) le suite sono verdi — anche dentro il bundle; (b) **mancano i gesti
provati a mano** (§5); (c) piani e handoff aggiornati — fatto il 16 agosto, insieme al README, che
prima fotografava il layout di luglio; (d) `main` ferma, **da riverificare al momento del merge**,
non ricordata.

⚠️ I pacchetti in `dist/` sono stati rifatti dopo l'ultimo cambiamento del codice, ma è una cosa da
riverificare invece che da ricordare: dopo un merge, `npm run pacchetto` (e `-- x64`, e
`dist:win`) prima di consegnare a un tester.

### 1-bis. Provare l'installer su Windows 11
È l'unico pezzo di oggi che **nessuna prova automatica ha toccato** — vedi §2. Serve una macchina o
una VM: installazione, primo avvio con SmartScreen, scelta del vault, una lezione, un PDF. E se là
c'è Python, un ingest vero: `Scripts\python.exe` non è mai stato eseguito.

### 2. F3 — gli usi e le lapidi delle immagini → [PIANO-FOTO §3](PIANO-FOTO.md)
Chiesto esplicitamente da Giacomo, non ancora iniziato. Le tre regole già decise (invariate):
il click su un'immagine usata in più posti **chiede all'indice degli usi** (`album.usi`); cancellare
una foto con ritagli figli è permesso e i figli **dicono** che la fonte non c'è più (regola delle
lapidi); il ritaglio di un ritaglio si ancora **sempre all'immagine originale**, componendo i
rettangoli.

### 3. La notarizzazione
L'unico modo di togliere «Apri comunque» ai tester. Serve l'Apple Developer Program (99 €/anno);
i dettagli operativi stanno in `PIANO-ONBOARDING.md` in fondo. Il beta è **fra sette giorni**.

### 4. B2 vero — il multi-istanza
Invariato: va dopo lo smontaggio degli stati (M4–M9 di [PIANO-MODULI](PIANO-MODULI.md)).

### 5. Il resto, invariato
Il motore invisibile sulle mappe tue, il limite del nodo all'area visibile, M4–M9, le pillole delle
Lenti. E le due idee messe da parte con la loro ragione (lettore di testo come fonte; `.docx` via
`textutil`).

---

## 5. I gesti da provare a mano

Le suite misurano, non guardano — e più di un difetto vero l'ha trovato Giacomo con tutto verde.

1. **Apri il dmg** (`dist/StudIA-1.0.0-arm64.dmg`), trascina StudIA in Applicazioni, aprila:
   la prima volta serve Impostazioni di Sistema → Privacy e sicurezza → «Apri comunque». Non deve
   mai dire «danneggiata».
2. **Nel pacchetto, con il tuo vault vero**: apri una lezione, apri una Fonte PDF, evidenzia,
   ritaglia, apri il Confronto. È l'app che eseguiranno i tester, non quella in cartella.
3. **La pipeline nel pacchetto**: un ingest vero (python + whisper) — è l'unico pezzo che le prove
   CDP non toccano, e nel bundle i percorsi sono altri (`Resources/app/ingest.py`, venv in
   `userData`).
4. **Selezione su PDF**: seleziona del testo (la barra deve comparire), poi apri un pannellino
   qualsiasi — materiali, ricerca, la tendina di un blocco. Il menu e la barra della selezione
   devono sparire con gli altri, e la barra deve continuare a comparire alla selezione dopo
   (§3.3: il rischio era spegnerla nello stesso gesto che la apre).
5. **L'icona**: nel Dock e nel Finder, a tutte le taglie — 16 px è dove un disegno troppo fine
   diventa una macchia grigia.
6. **Le emoji**: nella barra dell'editor, la faccina. Scorrere le categorie, cercare in italiano
   («attenzione», «gatto», «bandiera»), inserirne una e **riaprire l'appunto in Obsidian** per
   vedere che il carattere è lo stesso anche fuori.
7. **L'installer Windows**, su una macchina o VM Windows 11: installazione, primo avvio
   (SmartScreen → «Esegui comunque»), scelta della cartella del vault, apertura di una lezione e
   di un PDF. Poi, se c'è Python: un ingest vero. È l'unica parte di tutto questo che **nessuna**
   prova automatica ha toccato.
8. **L'evidenziatore**: scegliere il fondo pieno, evidenziare una frase nel capitolo e una nel PDF,
   con due colori diversi. Il testo deve restare leggibile in entrambi — e provare anche in tema
   scuro, dove il pezzo evidenziato diventa un'isola chiara.
