# Handoff — StudIA, 3-8 agosto 2026

> 📍 **Storico.** Il punto d'ingresso è **sempre** l'`HANDOFF-DEFINITIVO-*` con la data più alta
> — oggi quello del **30 agosto 2026**. ⚠️ Gli handoff storici sono stati eliminati quel giorno e
> vivono in git: il §7 del più recente dice come si riprendono.
> Qui resta: la **pipeline**, di cui è l'unica specifica: il wizard a sette passi (§5-pre), il
> composer e i percorsi (§5), perché i PDF non venivano citati (§7 e §7-bis), il riquadro «Note
> e materiali» (§8), Chandra e la regola per scegliere le pagine (§9).

> ⚠️ **QUESTO FILE È VECCHIO.** Chi arriva adesso parte dall'handoff più recente (vedi il
> riquadro qui sopra). Quello che segue resta perché il vocabolario, le scelte di fondo e le
> trappole del 3-8 agosto valgono ancora — ma i numeri e l'elenco dei lavori aperti qui sotto
> sono superati.
>
> ⚠️ **«HANDOFF §…» nei commenti del codice non nomina sempre QUESTO file.** Sono sei citazioni,
> e si dividono fra due documenti che si chiamano tutti e due «handoff»:
>
> | citazione | dove | quale file |
> |---|---|---|
> | `HANDOFF §7` | `lib/ocr.js:31` | **questo** (§7, il digest amputato) |
> | `HANDOFF §9` | `lib/mappe.js:24` | **questo** (§9, `motore` su ogni pagina) |
> | `HANDOFF §5.1` · `§5.2` | `lib/appunti.js:44,119` · `lib/album.js:512` | `HANDOFF-SESSIONE-2026-08-09.md` (in git: `git show 52b0ad5:HANDOFF-SESSIONE-2026-08-09.md`) |
> | «guasto 5.6 dell'HANDOFF» | `test/disegna-fonti.js:19` | `HANDOFF-SESSIONE-2026-08-09.md` (in git: `git show 52b0ad5:HANDOFF-SESSIONE-2026-08-09.md`) |
>
> Chi tocca uno di quei commenti scriva il nome del file per esteso: il numero di sezione da solo
> non basta più a dire dove si va.

Stato consegnato: **1260 controlli verdi** (`npm test`), app funzionante, tre corsi nel vault.

> **Vocabolario, prima di tutto il resto.** I tre livelli si chiamano **Corso › Lezione ›
> Capitolo**: il corso è la cartella autonoma che contiene materiali, lezioni, appunti, mappe e
> percorsi; la lezione raggruppa i materiali dentro il corso; il capitolo è il file che si legge.
> Fino al 9 agosto 2026 gli stessi tre livelli si chiamavano Progetto › Corso › Capitolo, e il
> contratto della rinomina — nomi sul disco, chiavi di frontmatter e di JSON, falsi amici,
> compatibilità con i vault vecchi — sta in [RINOMINA-GLOSSARIO.md](RINOMINA-GLOSSARIO.md).
> Se qui sotto un pezzo di codice usa ancora il vocabolario vecchio, è un residuo, non una variante.

> 📄 **Il racconto della sessione dell'8-9 agosto** — mappe personali (L0–L4) e primo lotto del
> banco (B1), con i nove guasti trovati e le misure prese — sta in
> `HANDOFF-SESSIONE-2026-08-09.md`, eliminato il 30 agosto e ripreso con
> `git show 52b0ad5:HANDOFF-SESSIONE-2026-08-09.md`. Questo file resta il punto di
> ripartenza generale; quello serve a chi deve capire in fretta dove siamo arrivati.
>
> **PUNTO DI RIPARTENZA (8-9 agosto, fine sessione).**
>
> **Mappe, fase D — il piano di esecuzione è finalizzato in
> [PIANO-MAPPE-EDITOR.md §12](PIANO-MAPPE-EDITOR.md), sei lotti L0–L6, e i primi cinque sono chiusi.**
> Le **mappe personali si costruiscono**: si creano e si aprono dal registro «Mie», si semina da
> «Modifica una copia», e sulla tela si crea col doppio click, si fanno figli con Tab e fratelli
> con Invio, si rinomina, si trascina, si elimina, si annulla con ⌘Z etichettato; in barra c'è il
> cestino per la mappa intera, con conferma. Tutto provato sull'app viva a gesti veri (26 + 33
> controlli via CDP). Da L3 e L4 si aggiungono gli **archi** — si tirano dalla porta sul bordo o con
> «Collega a…», il verbo si scrive al volo con i 68 suggeriti — e il **menu contestuale unico**, in
> cui ogni gesto ha la sua voce con la scorciatoia accanto. Il prossimo passo è **L5, l'estrazione**
> (§3), oppure il lotto nuovo **G1–G3 del §13**, che rifonda le mappe generate sui concetti dei
> paragrafi e le porta alla scala del corso: quello è il lavoro che l'utente ha chiesto per
> ultimo, ed è la ragione per cui il §6 di quel piano porta ora un avviso di superamento.
>
> 🆕 **Il banco (lo spazio di lavoro): disegnato E il primo lotto è in piedi**, 9 agosto. Il piano è
> [PIANO-BANCO.md](PIANO-BANCO.md); una griglia 2×2 in cui i blocchi si uniscono (otto forme), ogni
> blocco ospita uno strumento preso da un registro (capitolo · fonte · appunti · mappa · parole
> chiave · flashcard), la fonte va a schede, i tre menu scendono dalla topbar alla sidebar. ⚠️ I
> lotti **B1 e B2 vengono prima di L5**: l'estrazione presuppone di vedere fonte e mappa insieme, e
> oggi la mappa copre il capitolo.
>
> **B1 è fatto e provato** (`assets/banco/forme.js` puro + il renderer, 55 + 26 controlli). Da
> sapere subito, perché cambia il modo in cui l'app sta insieme: **il dock non è più un pannello**
> — `#pdfPane` e `#notePane` sono strumenti che il banco sposta nei blocchi, e chi non è a schermo
> aspetta vivo in `#bancoMagazzino` — e **la pagina non scorre più**: scorre il corpo di ogni
> blocco. ⚠️ Da qui in poi ogni ascoltatore di `scroll` va registrato in **cattura**: l'evento di un
> elemento non risale, e senza `capture` non arriva più a `window`.
>
> ⚠️ **Il prossimo passo è B2**: portare la mappa dentro un blocco. Oggi `#mappaView` vive dentro
> `main` e nasconde il capitolo — dentro il banco significa che occupa il blocco del capitolo, che
> è meglio di prima ma non è ancora la cosa giusta.
>
> ⚠️ **Le famiglie di relazione sono 11**, non più 8: `definizione`, `misura`, `intervento` sono
> state aggiunte **dopo averle misurate** su 5.259 frasi di TD74. E il commento che dichiarava la
> palette leggibile ai daltonici **era falso**: due coppie preesistenti stanno sotto ΔE 5, e ora un
> test lo tiene scritto.
>
> ⚠️ **Provando L3 è emerso che nel motore Percorso gli archi cliccabili non erano quelli della
> mappa** (là `res.archi` è il filo numerato, i legami veri stanno in `res.extra`), e che **la
> linking word copriva il bersaglio del proprio arco**. Corretti tutti e due in `disegna.js`, con i
> test che li bloccano.
>
> ⚠️ **Un guasto di fase B, rimasto invisibile fin qui: cliccare una card non apriva la fonte, in
> nessuno dei due registri.** Il trascinamento chiama `setPointerCapture` sull'SVG e Chrome
> ridirige lì anche il `click`, che quindi arriva con `target` uguale a `<svg>`. I controlli non
> l'avevano preso perché gli eventi sintetici saltano l'hit-testing, e i pallini dei rami
> funzionavano perché per loro il `pointerdown` esce prima e non cattura. Ora il bersaglio si
> prende al `pointerdown` e si agisce al rilascio (`mappaBersaglio`/`mappaAttiva`): **è la regola
> per tutto ciò che si preme dentro la tela**, doppio click compreso.
>
> ⚠️ Due guasti trovati in codice già consegnato, entrambi correggevano il disco **rispondendo
> «fatto»**: `mappe.rinomina` cancellava la mappa se il titolo cambiava solo di maiuscole (su macOS
> il volume non le distingue, e il confronto per decidere se togliere il vecchio file invece sì), e
> `rimuovi`/`salva` non validavano il nome — `rimuovi(p,'../APPUNTI/prezioso.md')` cancellava
> l'appunto. Corretti, con i test che li bloccano.
>
> ⚠️ Rettifica di quanto scritto qui prima: **non restava «solo l'interfaccia».** Tre pezzi del
> livello puro mancavano, ed erano tutti guasti che funzionano a schermo e perdono il lavoro senza
> dirlo — su tutti, `layouts.run` che non leggeva `x`/`y`, cioè un nodo trascinato che tornava al
> suo posto alla riapertura. Sono chiusi (lotto L0, `npm test` da 921 a **1146** controlli), e il
> §12.3 racconta come. Da lì in poi ciò che resta è davvero interfaccia.
>
> Persistenza (`lib/mappe.js` + IPC + preload) e operazioni pure (`App/assets/mappa/modifica.js`)
> erano già fatte e verificate, catena su disco compresa.
>
> La **fase B è chiusa e si usa**: da ogni capitolo e da ogni lezione si apre una mappa calcolata
> dai file del corso, con quattro motori di disposizione, provata su tutti i 210 capitoli di
> TD74-DSA. Le altre fasi (export PDF, estrazione, ritagli, focus) sono in fondo al §10.
>
> ~~Resta aperto da prima il §9~~ — **chiuso il 10 agosto 2026**: le figure entrano nel capitolo, si
> aprono sul documento alla pagina giusta e viaggiano nell'esportazione. La rilettura con Chandra
> resta facoltativa e su richiesta, come è sempre stata.
>
> Le lezioni di `ai-literacy-anthropic` e `digital-education-outlook-conference-2026-oecd` restano
> **cancellate di proposito** (`LEZIONI/`, `_piano.json`, `scarti/` → Cestino): l'utente rigenera da
> zero. **Materiali e schede sono intatti** — 37 e 24 schede già pagate, nulla da rileggere.
> `TD74-DSA` non è stato toccato, se non per la riparazione delle etichette del §8.
> Il primo passo per quei due corsi è **la proposta dell'indice**, non l'elaborazione.
>
> Prima di toccare la pipeline, leggere il §7 e il §7-bis: sono due guasti diversi con lo stesso
> sintomo, ed è facile richiuderne uno credendo di aver chiuso l'altro.

---

## 1. Dove sono le cose (CAMBIATO: i percorsi vecchi non valgono più)

```
/Users/giacomomeschini/Claude/StudIA/
├── StudIA/           1,2 GB   ← l'APP (ex «StudIA-Vault», rinominata)
└── StudIA - file/     13 GB   ← i DATI (l'utente vuole spostarla nei Documenti)
```

Prima erano **una cartella sola**: codice e dati mescolati. Sono stati separati il 3 agosto.

Il `vaultPath` sta in `~/Library/Application Support/studia/config.json` ed è **la fonte di verità** su dove sono i dati. Non scrivere mai percorsi che assumono i dati dentro la cartella dell'app: `test/roundtrip.js` lo faceva, e dopo lo spostamento **15 controlli si SALTAVANO restando verdi**. Ora c'è `vaultReale()` che legge il config.

### I tre corsi

| corso | lezioni | materiali | schede |
|---|---|---|---|
| `TD74-DSA` | 16 | 106 file | 0 — **protetto**, la pipeline non ci scrive |
| `ai-literacy-anthropic` | 12 | 61 file | 12 |
| `digital-education-outlook-conference-2026-oecd` | 23 | 65 file | 24 |

Struttura di un corso:
```
Corsi/<id>/                                    (era Progetti/<id>/)
├── _corso.md                                  la scheda del corso (era _progetto.md)
├── MATERIALI/{Video,Audio,PDF,Web,Trascrizioni,Indici-PDF,Indici-Web,Figure}
├── LEZIONI/                                   (era CORSI/)
│   └── <NN-slug>/{_lezione.md, <NN-slug>.md}  (_lezione.md era _corso.md)
├── APPUNTI/
└── _lavorazione/{_piano.json, schede/}
```

### Configurazione attuale

`StudIA - file/.studia/prefs.json`: motore **Claude Code** (`sonnet`), lingua parlata `en`,
lingua di scrittura non impostata → **italiano** di default.

---

## 2. Come far girare e verificare

### Controllo di versione (NUOVO, 5 agosto)

Fino a oggi StudIA **non era versionata**: nessun `.git`, nessuna cronologia. Ora c'è, e la radice
del repository è la cartella dell'app (`StudIA/`), non quella che la contiene.

Il primo commit fotografa l'intera applicazione, lavoro di quel giorno compreso: non esisteva una
cronologia da cui separarlo. `.gitignore` tiene fuori `node_modules/`, `dist/`, gli ambienti Python
e — per prudenza, anche se i dati vivono altrove — `Corsi/` e `config.json`, che contiene le
chiavi API cifrate.

⚠️ **I dati non sono versionati e non devono esserlo**: stanno in `StudIA - file/`, fuori dal
repository. Un `git clean` o un checkout non li tocca, ma nemmeno li salva: il loro backup è un
problema a sé.

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA" && npm test
```

Per pilotare l'app e ispezionarla dal vivo (indispensabile: molti guasti si vedono solo a runtime):

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA" && ./node_modules/.bin/electron . --remote-debugging-port=9333
```

Poi via CDP con Node 20: `node --experimental-websocket <script>` che fa `fetch('http://localhost:9333/json')`,
apre il WebSocket e usa `Runtime.evaluate`. Gli script usati stanno nello scratchpad di sessione.

⚠️ **`lib/` e `main.js` vivono nel processo principale: un `Page.reload` NON li ricarica.** Va riavviata
l'app. Una verifica è già girata su codice vecchio per questo motivo, dando un falso negativo.

⚠️ `App/StudIA.html` servito da `file://` può arrivare dalla cache anche con `ignoreCache`. Per accertarsi
che il renderer sia aggiornato: `fetch('wizard.js').then(r=>r.text()).then(s=>/frammento nuovo/.test(s))`.

---

## 3. Che cosa è stato fatto

### Riordino del filesystem
- Codice e dati separati; `StudIA-Vault` → `StudIA`; `config.json` riagganciato.
- Eliminato un **duplicato da 10 GB** di TD74-DSA (confrontati prima gli alberi: unici solo 2 log, salvati in `_lavorazione/log-copia-vecchia/`).
- 41 materiali orfani nella radice del vault spostati dentro il corso OECD; 3 gusci di corso vuoti cestinati.
- Rimosse le cartelle globali `Media/ Fonti/ Trascrizioni/ Indice-PDF/ Indice-HTML/` (vecchio modello a corpus unico).

### Scoping per corso (era tutto globale)
`corpus.digest(vault, corso)`, `mat.cartelle/trova/elenca(..., corso, solo)`, `corpus:list`,
`prossimoNumero(v, corso)`, `importa.destinazione(...)`, `ingest.py --corso`, `preload.numeriPerCorso`.

Il confine si decide su `mat.haMateriali(vault, id)` (esiste `MATERIALI/`?): chi ce l'ha vede solo i suoi,
chi non ce l'ha (vault vecchio) pesca ancora dal globale.

**Prima**: aprire l'Analisi sul corso OECD leggeva — e faceva pagare — anche i 40 materiali sui DSA.

### Numerazione per corso
Tre pezzi che **stanno o cadono insieme**: chi assegna il numero, dove atterrano i file, chi risolve `video:NN`.
L'OECD è stato rinumerato `79–102 → 01–24` (65 file, 24 JSON aggiornati anche all'interno).
TD74 resta `01–40`: i suoi **673 rimandi** in 140 capitoli non si toccano.

### Lingua
`ingest.py --lang` (prima `language="it"` era cablato: audio inglese trascritto in italiano inventato).
`lib/lingua.js` + iniezione in `provider.completa()` — **non nei singoli prompt**, che sono nove in cinque moduli.

### Robustezza delle risposte del modello
- `schede.entroSchema()` — ricorsivo: accorcia stringhe all'ultima parola, taglia liste, rimuove campi inventati e valori fuori enum. Scrive nel campo `note` che cosa ha toccato. **Non** aggiusta ciò che non si può aggiustare (campo obbligatorio mancante → resta errore).
- `scaletta.numeroDiFonte()` — se il modello cita un materiale per titolo invece che per numero, lo riconduce.
- Tetti delle schede alzati: temi 24→**40**, concetti 30→**50**, capitoli proposti 20→**30**.

### Capitoli: fonti raccolte e tasti di lettura

**Le fonti citate ora finiscono nel frontmatter.** Lo schema del capitolo prevede `videoRefs` e `sources`
— è da lì che il lettore costruisce il riquadro delle fonti in fondo — ma **nessuno li riempiva**: il prompt
chiede al modello di citare con `[vai a 12:30](video:05#t=750)` e lui lo fa, mentre gli elenchi restavano
vuoti. Un capitolo pieno di rimandi non mostrava nessuna fonte raccolta.

`genera.rimandiDa(dati)` li **ricava dal testo** (contenuto, inBreve, punti chiave, note), deduplicati e
ordinati per numero e minuto. Non si è chiesta al modello una seconda lista che ripete la prima: una cosa
scritta due volte prima o poi diverge.

⚠️ In `scriviCapitolo` i valori calcolati vanno messi **dopo** `dati` nell'`Object.assign`. Il modello
dichiara spesso `videoRefs: []`, e un valore calcolato messo prima verrebbe sovrascritto dall'elenco vuoto —
riproducendo il guasto. C'è un test che copre proprio il caso «il modello li dichiara vuoti».

**I tasti di lettura si distribuiscono sulla lunghezza.** Prima ne finiva uno su *ogni* `<p>`: nei capitoli
sintetici, fatti di frasi brevi, uno ogni due righe. Ora i titoli lo prendono sempre (ossatura della
navigazione) e i paragrafi solo quando dall'ultimo si sono accumulati `TTS_PASSO = 420` caratteri
(≈ mezzo minuto di parlato); un paragrafo già lungo se lo prende comunque. Misurato sugli 11 capitoli veri
della lezione AI Literacy: **101 → 45 pulsanti, 55% in meno**. Il testo resta tutto ascoltabile: cambia solo
da dove si può far ripartire la lettura.

### Interfaccia
- **Tre menu in fila nella topbar: corso → variante → lezione**, che si leggono da sinistra a destra come si restringe il campo. Quello delle varianti **resta al suo posto anche quando non ce ne sono** (dice «— nessuna variante —» ed è spento): un menu che sparisce fa ballare gli altri due. Cambio corso via `cambiaCorso()`, **una funzione sola** condivisa coi menu delle Impostazioni; cambio variante in §5.
- Elenco lezioni filtrato per corso **e per variante attiva**, **numerato** (`01 · Titolo`) e in **sequenza didattica**.
- Wizard: pulsante «Riprendi la creazione guidata» (prima un corso senza lezioni era **irraggiungibile**); un solo comando di elaborazione che dichiara su cosa agisce; spunta «✓ N capitoli» letta **dal disco**.

---

## 4. Le trappole ricorrenti (leggere prima di toccare qualcosa)

**⑧ Provare l'app viva contro il VAULT VERO è una cattiva idea, e in questa sessione è costata un
file.** Le verifiche via CDP creano, modificano ed eliminano mappe nel corso attivo, e una
sequenza di prove interrotte a metà ha lasciato il vault in stati che nessuno stava sorvegliando: a
fine giornata la mappa `AI.json` — dell'utente, un nodo, creata l'8 agosto alle 18:45 — non c'era
più, e nei log non c'è traccia di che cosa l'abbia tolta. Prima di riaprire la porta di debug:
puntare `vaultPath` a una copia temporanea, oppure far girare le prove su un corso usa-e-getta.
I dati non sono versionati (§2), quindi qui non c'è nessuna rete sotto.

**① Una regola dichiarata solo dove si GIUDICA la risposta è una trappola.**
Successo tre volte:
- i tetti delle schede stavano in `scheda.schema.json` ma non nello schema mandato al modello;
- `scaletta` chiedeva `materiale: {type:'string'}` senza dire che voleva il numero;
- la regola «usa i numeri» c'era **in prosa** nel prompt, ma il modello guarda **lo schema**.

Se aggiungi un vincolo, mettilo dove il modello lo legge.

**①-bis Un campo previsto dallo schema non è un campo riempito.**
`videoRefs` e `sources` esistevano nello schema del capitolo da sempre, e nessuno li scriveva. Quando aggiungi
un campo, verifica **chi lo popola**: se la risposta è «il modello, se se ne ricorda», meglio ricavarlo.

**② Errori silenziosi che si vedono come UI mancante.**
`gen:start` scriveva i capitoli nel piano in una forma che `scriviPiano` rifiutava, e **nessuno guardava il valore
restituito**: la lezione restava «approvata» e la spunta non compariva mai. Controlla sempre gli esiti dei salvataggi.

**③ Il registro può mentire, il disco no.**
La spunta dei capitoli ora conta i file `.md` via `expandStato`, col piano come solo ripiego.

**④ Due copie della stessa logica divergono sempre.**
Già capitato con l'ordinamento delle lezioni (`refreshLessonSelect` per numero, `primoLezioneVisibile` per titolo).
Ora `lezioniOrdinati()` e `cambiaCorso()` sono in un punto solo.

**⑤ `lib/reader-parser.js` estrae il parser del lettore da `StudIA.html`** a partire da `function _unq(`.
Quello che sta prima non entra nella sandbox e va fornito lì a mano (com'è per `escHtml`, `_mediaNum`, `_pdfNum`).

**⑦ Una misura presa una volta sola all'avvio è una misura sbagliata.**
`--topbar-h` (ci si appendono sidebar sticky, fantasma e la barra `.cprog`) veniva calcolata una volta,
durante l'esecuzione dello script. A finestra stretta i controlli della topbar vanno a capo e l'header
raddoppia — ma il momento in cui va a capo arriva **dopo**: quando i webfont sostituiscono il ripiego e
quando i tre menu si riempiono da chiamate asincrone. La barra restava a metà topbar finché non si
trascinava il bordo della finestra (un `resize`, l'unico ascoltatore registrato). Ora la misura segue
l'elemento con un `ResizeObserver`. Se aggiungi qualcosa che cambia l'altezza di un elemento a cui altri
si agganciano, chiediti **chi te lo dice** quando cambia.

**⑥ Il ripulitore di schema per Gemini** (`lib/ai/google.js`) non deve filtrare le chiavi dentro `properties`:
lì sono **nomi di campo**, non parole chiave. `title` è entrambe le cose, e la confusione rendeva Gemini
inutilizzabile per quasi ogni chiamata strutturata. C'è un test che lo blocca in modo generale.

---

## 5-pre. Il wizard è di SETTE passi (cambiato)

`Corso · Materiali · Elaborazione · Analisi · **Opzioni** · **Composer** · Capitoli`

Prima erano sei e il quinto si chiamava «Indice delle lezioni»: lì si correggeva il raggruppamento dei materiali
in lezioni e si approvava. Ora quel pannello **non esiste più** e il suo lavoro si è diviso in due:

- **Passo 5 «Opzioni e profilo»** — le regole con cui il modello proporrà e scriverà: le leve di forma del
  profilo (grana, lunghezza, stile, quiz, glossario, approfondimenti) **modificabili lì e salvate in
  `_profilo.md`**, il recap delle esigenze dichiarate, le indicazioni per questo corso, e le tre opzioni
  della proposta: grana delle lezioni, **alternative d'indice per lezione**, capitoli per lezione. Da qui parte la
  proposta delle lezioni — **solo quella**: le scalette costano e si chiedono nel composer, quando il taglio delle
  lezioni convince.
  Il profilo esisteva dal primo giorno e governava la forma di tutto senza farsi mai rivedere: si compilava
  una volta e si dimenticava. Qui torna sotto gli occhi nel momento in cui decide qualcosa.
- **Passo 6 «Composer»** — la porta e il riassunto (quante lezioni, quanti indici proposti, quanti percorsi
  salvati, quante cartelle di capitoli scritte). Il wizard si chiude mentre componi e **si riapre da sé** a
  questo passo quando chiudi il composer (`apri(corso, {tornaAlWizard})`).
- **Passo 7 «Capitoli»** — quello di prima, ora facoltativo: serve per la lezione singola senza varianti e per
  l'estensione. «Approva le lezioni» (il tasto del passo 6) crea le cartelle senza suffisso di cui questo passo ha bisogno.

⚠️ **I passi si chiamano per nome**, non per numero: `P.OPZIONI`, `P.COMPOSER`… `W.step === 4` era sparso in
dodici punti di `wizard.js`, ed è esattamente il modo di dimenticarne uno quando i passi diventano sette.

### Il taglio delle lezioni si corregge nel composer

Unisci, separa, sposta, rinomina sono passati **dentro le righe del composer**, accanto agli indici che ne
nascono: decidere il raggruppamento senza vedere che scalette produce è decidere alla cieca. La logica sta in
`lib/pianoedit.js` (pura, testata) e il comando passa da `plan:comando` — il piano vero resta nel processo
principale, il composer manda l'azione e ridisegna con quello che torna, invece di tenere una seconda copia.

⚠️ **Ogni comando rinumera le cartelle**, e una scaletta rimasta appesa al vecchio nome sarebbe **peggio** di
una mancante: sembrerebbe la scaletta di quella lezione e proporrebbe capitoli su materiali che quella lezione non
ha più. `pianoEdit.cartelleCambiate()` confronta le impronte (cartella → materiali) e `percorsi.invalida()`
butta le scalette morte e le scelte dei percorsi che le usavano; un percorso rimasto senza scelte si
cancella. Vale per `plan:comando` **e** per `plan:save`. Lo si dice con un toast: si è persa una spesa.

### Il numero di alternative è un'opzione, non una costante

`N_ALTERNATIVE = 3` era cablato in `lib/scaletta.js` e finiva in due punti del prompt. Ora è
`opts.nAlternative` (2–6, `quante()` riporta dentro i limiti), vive in `prefs.nAlternative` e si cambia sia al
passo «Opzioni» sia nella topbar del composer, che è dove si preme «Proponi gli indici».

---

## 5. Varianti di percorso: il composer è agganciato all'app

**Scritto il 5 agosto 2026.** Il mockup è diventato una pagina vera; resta fuori la sola scrittura dei
capitoli per coppia lezione+indice (vedi «Quel che manca», in fondo alla sezione).

L'idea: dalla **stessa base di materiali** ricavare più percorsi per studenti dello **stesso livello** ma con
**stili di apprendimento diversi** (non per età o grado scolastico).

### Forma su disco concordata

```
Corsi/<id>/
├── MATERIALI/            condivisi   (191 MB, pagati una volta)
├── _lavorazione/schede/  condivise   (pagate una volta)
├── LEZIONI/
│   ├── 03-delega--per-domande/   ← i capitoli, scritti UNA volta
│   └── 03-delega--sequenza/      ← l'altra versione, se qualcuno la sceglie
└── PERCORSI/
    ├── analitica.json    → { "01":"panoramica", "02":"casi", "03":"per-domande", … }
    └── sequenziale.json  → { "01":"sequenza",   "02":"sequenza", "03":"sequenza", … }
```

Un percorso è **una mappa lezione → indice**, poche righe. L'unità di lavoro è la coppia **lezione+indice**.

### Regole decise

1. **I capitoli si condividono.** Due percorsi che scelgono lo stesso indice per una lezione usano gli stessi capitoli. Misurato sul mockup: con 3 percorsi di cui 2 simili, **91 → 60 capitoli, 34% in meno**.
2. **L'esportazione appiattisce.** `03-delega--per-domande` → `03-delega`. Chi riceve vede un corso normale e non sa che esistevano altre varianti.
3. **Rigenerare un indice condiviso aggiorna tutti i percorsi che lo usano.** È voluto, ma va **detto prima di premere**: «questo indice è usato da 3 percorsi».
4. **Un personaggio segue un indice solo per lezione** (trascinarlo altrove lo sposta, non lo duplica).
5. Rimandata: le varianti che **escludono** parte dei materiali. Per ora tutte usano tutto.

### Il composer (`App/composer.js` + `#composer` in `StudIA.html`)

Pagina piena, non modale stretta. Righe = le lezioni del piano approvato; su ogni riga le card degli indici
proposti (numero variabile, lo zig-zag è previsto); 8 personaggi OpenMoji rotondi da trascinare sulle card;
in fondo i percorsi a colonne dinamiche coi capitoli in ordine numerico; alert sui percorsi con buchi, col
chip e le sigle delle lezioni mancanti. Si apre da **wizard, passo «Capitoli»** e da **⚙ Impostazioni › Corsi**.

Gli 8 personaggi stanno in `lib/percorsi.js` (`PERSONAGGI`), sorgente unica per l'interfaccia e per i file su
disco: 🦉 Analitica · 🐢 Sequenziale · 🦊 Sintetica · 🐝 Pratica · 🐙 Trasversale · 🐇 Curioso ·
🐘 Ripassatore · 🦅 Panoramica. Animali di proposito: sono codepoint singoli e OpenMoji li rende sempre
(le emoji «professione» sono sequenze ZWJ e cadono sul font di sistema).

Le frasi **«Adatto a: chi vuole seguire la logica dell'autore senza saltare»** sono il campo `adattaA`, che il
modello già produceva e che ora la card mostra: è ciò che fa capire la differenza fra un indice e l'altro.

### La card: scheda riassunto **e** indice

Ogni card dice come è fatto l'indice (`adattaA` + `differenza`) e, aprendo «▸ 8 capitoli», **che cosa c'è
dentro**: sono due domande diverse e servono entrambe — «adatto a chi vuole la mappa prima» non dice se il
capitolo sui limiti c'è. I titoli **non costano una chiamata**: `capitoli[{titolo, sintesi}]` è già nella
scaletta pagata e già in cache; il composer ne usava solo `.length`. Il `title` di ogni voce è la `sintesi`.

Chiuso di default, perché il costo è verticale: 7 lezioni × 3 card × 8–14 titoli sono ~200 righe, e le righe
smettono di confrontarsi a colpo d'occhio. In topbar c'è «Mostra gli indici» che apre tutte le card; una card
aperta o chiusa a mano **vince** sull'interruttore finché non lo si tocca di nuovo.

### Sillabazione e comandi a scomparsa

- `hyphens:auto` in tutto `#composer` e nei pannelli del wizard (funziona perché il documento è `lang="it"`).
  Fuori restano nomi di cartella, etichette maiuscole e bottoni. **Il testo dei capitoli no**: là si legge per
  davvero, e spezzare le parole rallenta chi legge lentamente — che è il caso dichiarato in questo profilo.
- I cinque comandi sulla lezione e la riga «auto/rifai» compaiono **in hover sulla cella del titolo** (e in
  `:focus-within`, che la tastiera non ha il puntatore). Opacità, non `display`: comparendo dal nulla
  farebbero saltare la riga sotto le dita. Con `data-reduce="1"` restano sempre visibili.
- Il titolo della lezione è un `contenteditable`, non un `<input>`: dentro un campo largo 230px un titolo lungo si
  tagliava a metà parola. Si salva uscendo dal campo (`blur` in cattura), Invio conferma, Esc annulla.

### Il campo «capitoli per lezione»

In topbar del composer, più un campo per riga che lo scavalca su quella lezione. Vuoto = lo decide il modello.
Quando c'è un numero, `lib/scaletta.js → vincoloCapitoli()` lo scrive nel messaggio: vale per **tutte** le
alternative, mai come variabile per differenziarle — lasciato libero il numero oscillava fra 2 e 8 sulla stessa
lezione, e le scalette finivano per distinguersi per lunghezza invece che per principio organizzativo. La
copertura resta intera: si accorpa, non si lascia fuori. Il valore generale vive in `prefs.capitoliPerLezione`,
quello usato per una lezione resta scritto nella sua cache.

### Canali e file

- `composer:stato` — piano, scalette in cache, percorsi salvati, personaggi: tutto in una chiamata.
- `scalette:tutte` (+ `scalette:progress|done|error`) — le scalette di più lezioni **in fila, non in parallelo**:
  sono chiamate lunghe e un 429 in concorrenza ne farebbe cadere quattro invece di una. Senza `rifai` salta le
  lezioni che hanno già una scaletta in cache, così riaprire il composer dopo un errore non ricompra il fatto.
- `percorsi:list` / `percorsi:save` — `save` manda lo **stato intero**: i percorsi spariti dal tavolo vengono
  cancellati dal disco, altrimenti il menu in topbar mostrerebbe varianti che non esistono più.
- `_lavorazione/scalette/<folder>.json` — le alternative pagate al modello, con `nCapitoli`.
- `PERCORSI/<personaggio>.json` — `{id, emoji, nome, slug, creato, aggiornato, scelte: {folder: {indice, nome, capitoli}}}`.
  Il **nome del file è il personaggio**: rinominare la variante non lascia due file dove prima ce n'era uno.

### La scrittura dei capitoli per coppia (fatta)

Nel composer, in fondo, la tabella **«Capitoli · una cartella per coppia lezione+indice»**: una riga per coppia,
con la cartella, l'indice, quanti capitoli, **quali percorsi la usano** e quanto è già scritto. Sopra, il conto
totale e il costo stimato; i comandi sono «Scrivi i capitoli mancanti», «Riscrivi tutto» e il «rifai» per riga.

- **Il nome della cartella ha sempre il suffisso**, anche con una variante sola: `03-delega--per-domande`.
  Se comparisse solo alla seconda variante, la prima dovrebbe cambiare nome — e con lei i rimandi
  `[[03-delega]]` già scritti dentro gli altri capitoli, rotti senza che nessuno se ne accorga.
  Nomi di indice uguali non diventano una cartella sola: il doppione prende `-2` (`cartelleAlternative`).
- **Il titolo del `_lezione.md` resta quello della lezione base.** Due varianti sono la stessa lezione: chiamarle
  «Delega (per domande)» le farebbe leggere come due lezioni diverse. Che cosa le distingue sta in `variante:`
  e `lezione_base:` nel frontmatter.
- **Riscrivendo, i capitoli vecchi si cancellano prima.** La cartella appartiene per intero alla coppia, e
  lasciarli lì vuol dire due versioni dello stesso capitolo con numeri uguali e slug diversi.
- **La regola 3 è applicata**: prima di riscrivere una coppia condivisa la conferma dice *«01-… è usato da 2
  percorsi: si aggiornano tutti»*. Le coppie già complete si saltano se non si chiede «riscrivi».
- Le coppie vengono dai percorsi **salvati**, non dal tavolo: scrivere capitoli per un'assegnazione che esiste
  solo a schermo produrrebbe cartelle che nessun percorso rivendica.
- La scrittura vera è la stessa del wizard: `gen:start` e `percorsi:capitoli` chiamano entrambi
  **`scriviCapitoli()`** in `main.js` (ordine, riparazione, quarantena, `_lezione.md`). Si ferma con lo stesso
  interruttore, `gen:cancel`: la coda è una sola.

Canali nuovi: `percorsi:coppie` (stato + costo) e `percorsi:capitoli` (+ `percorsi:cap:progress|log|done|error`).

### Il menu delle varianti in topbar (acceso)

`variantSelect` ora **funziona**: cambia quali capitoli si leggono. Ogni scelta salvata porta con sé la sua
`cartella` (`conCartelle()` la calcola al salvataggio) e il lettore filtra su quella — `lezioniVisibili()` mostra
la variante del percorso attivo e nasconde le altre; la cartella base resta visibile solo se il percorso non ne
usa una variante. Senza percorsi salvati non si filtra niente. La scelta vive in
`localStorage['studia.percorso.<corso>']` e sopravvive alla chiusura; cambiando variante, se la lezione aperta
non le appartiene si apre la prima che le appartiene.

### Quel che manca ancora

- **L'esportazione non appiattisce** (regola 2): `course:export` porta fuori tutte le cartelle, suffisso
  compreso. Va deciso *quale* percorso si esporta — è una scelta dell'utente, non un default.
- Il **badge di avanzamento** per corso andrebbe disegnato sui percorsi, non sulle lezioni (§6).

---

## 6. Coda, in ordine di urgenza

1. **Le figure dentro il capitolo** (§9, «Che cosa resta»). È il lavoro in corso, ed è a metà: la
   rilettura scrive già figure e didascalie nell'indice, ma il capitolo non le può mostrare. Finché
   non si chiude, le ore di lettura avanzata producono un indice più ricco che nessuno vede.
2. **Ritentativo sugli errori passeggeri** in `provider.completa` (503/429/timeout). Non esiste **nessun** retry
   in `lib/ai/`: una cascata di 503 di Google ha fatto perdere 7 materiali e un intero indice, e la proposta è
   ricaduta sull'euristica **senza che fosse evidente**. ~25 righe in un punto solo, vale per tutti i fornitori.
3. **L'esportazione che appiattisce le varianti** (§5, «Quel che manca ancora»): oggi un corso con più
   percorsi si esporta con tutte le cartelle `lezione--indice`. Serve scegliere quale percorso esce.
4. **Sezione «estendi una lezione»** nelle Impostazioni: va riscritta perché dica che cosa comporta estendere una
   lezione già strutturata (richiesta esplicita dell'utente, mai affrontata).
5. **Badge di avanzamento** nel tab Corsi: `materiali 24/24 · analisi 24/24 · indice approvato · capitoli 2/7`.
   Da fare **dopo** le varianti, perché andrebbero disegnati sui percorsi e non sul corso.
6. **I 70 capitoli con il riquadro orfano** (§8, in fondo): l'unico rimedio è riscriverli col prompt
   nuovo, e si paga. Decisione dell'utente, non ancora presa.
7. **Le mappe, fasi C-G** (§10): export PDF, mappe dell'utente, estrazione, ritagli, focus. La
   fase B è in piedi e si usa; il resto è elencato in fondo al §10.
8. `_ARCHIVIO/` (6 MB) e `dist/` (372 MB) nella cartella dell'app: mai valutati. `_ARCHIVIO` è ora
   versionato — dentro c'è anche il mockup del composer del §5 — mentre `dist/` è escluso dal
   repository e resta eliminabile senza perdere niente.

---

## 7. Perché i PDF non venivano citati (indagato a fondo, causa certa)

Sintomo: nel corso `ai-literacy-anthropic` i capitoli avevano **156 citazioni video e zero PDF**.

**Causa: il piano è nato su un digest amputato.** La proposta multiagente è delle 19:26 del 4 agosto;
gli indici dei PDF sono stati creati alle 23:24 e le relative schede alle 23:38. In quel momento
`corpus.digest` restituiva **12 materiali su 37**, perché un materiale senza indice **sparisce in
silenzio**: `lib/corpus.js:194` (`digestHtml`) e `lib/corpus.js:212` (`digestPdf`) fanno `if (!idx) return null`.

Il digest amputato rende ciechi in modo coerente quattro punti, e nessuno se ne accorge:
- `lib/schede.js` — `tutte()` itera su `dg.materiali`: alla pipeline arrivano 12 schede;
- `main.js:810` — il gate dell'80% è `12 >= floor(12*0.8)`, sempre vero: si va di multiagente
  «convinti» di avere il corpus intero;
- `lib/propose.js:148` — `recuperaMancanti` calcola i mancanti **contro lo stesso digest**: 12/12, nessun mancante;
- `main.js:857` — `plan:approve` non riguarda il corpus.

Poi la catena fino al sintomo: piano senza PDF → `lib/scaletta.js:188` filtra le fonti di ogni capitolo
su `materialiDi(lezione)` → `genera.testoPdf` non è mai chiamato → nel prompt non c'è nessun blocco
«documento» → zero citazioni `pdf:NN#p=`.

⚠️ **Smentite due comode spiegazioni**, per non rincorrerle di nuovo:
- *«lo schema impone che ogni materiale stia in una lezione»* — **falso**, verificato: `schema/piano.schema.json`
  non ha nessuna regola di copertura, e un JSON Schema non può vedere il corpus. La regola sta nel *prompt*.
  L'unica rete è `recuperaMancanti`, e conta contro il digest sbagliato.
- *«il contesto era troppo lungo»* — **falso**, misurato: ai-literacy manda ~11.700 token e perde 25 materiali,
  l'OECD ne manda ~15.700 e non perde nulla.

### Correzione di fondo — FATTA (5 agosto, sessione successiva)

Si è fatto **tutto e due**, perché sono due reti a maglie diverse.

1. `lib/corpus.js` — `digestMedia/digestPdf/digestHtml` non restituiscono più `null`: il materiale
   senza trascrizione né indice torna con `indicizzato:false`. `digest()` tiene in `materiali` i soli
   elaborati (così gli 8 chiamanti non cambiano comportamento) e aggiunge `senzaIndice` e `suDisco`.
   Il materiale non può più sparire senza che qualcuno possa contarlo.
2. `corpus.perIlPiano(dg)` — riduce il digest a ciò che un piano può accogliere e restituisce **le due
   liste**: quella che va avanti e quella che resta fuori. `corpus.avvisoEsclusi()` ne fa la riga da
   mostrare. Ci passano `propose.corpusDelPiano()` (usata da tutte e tre le proposte), il gate di
   `plan:propose`, `schede:build` e `schede:stato`.
3. `plan:approve` ricalcola il corpus e **rifiuta** l'approvazione elencando i materiali già elaborati
   lasciati fuori dal piano. Non protesta per i non elaborati e per i congelati: quelli l'utente li ha
   già visti nell'avviso della proposta.

⚠️ Il gate dell'80% va misurato sul corpus **del piano**, non su quello del disco: confrontando le
schede con un totale che comprende materiali non elaborati e pagine web congelate, i due numeri si
muovono insieme e la soglia è sempre soddisfatta. È il guasto originale, in miniatura.

### Bloccante prima di rigenerare Anthropic
`schema/piano.schema.json` (enum di `lezioni[].materiali[].type` e di `lezioni[].capitoli[].fonte.type`)
ammette solo `["video","pdf"]`, ma `corpus` produce anche `tipo: 'html'`. Misurato: una riproposta che
copre tutti e 37 i materiali genera **12 errori di validazione** e **non viene scritta su disco**.
I 12 materiali HTML di Anthropic resteranno quindi fuori dalle lezioni finché l'enum non si apre.

**Risolto senza toccare l'enum**: gli HTML sono **in freezer**, cioè restano fuori dal piano di
proposito (`corpus.TIPI_PIANIFICABILI = ['video','pdf']`) e l'utente lo legge in un avviso. Prima una
sola pagina web faceva fallire la scrittura dell'intero piano con «piano non valido», senza dire chi
fosse il colpevole. Quando si deciderà su Chandra, l'unico punto da cambiare è quella costante — più
l'enum, se il tipo resterà `html`.

**Decisione dell'utente (5 agosto): non patchare l'enum adesso.** Vuole valutare
[chandra](https://github.com/datalab-to/chandra) (datalab) per pagine HTML, appunti scritti a mano, foto
e PDF con grafici e tabelle. È un modello OCR che converte immagini e PDF in markdown/HTML/JSON
preservando layout, tabelle e formule; gira da CLI (`pip install chandra-ocr`), server vLLM o Streamlit;
codice Apache 2.0, **modello sotto licenza OpenRAIL-M modificata** — libero per ricerca, uso personale e
startup sotto i 2 M$, non utilizzabile in concorrenza con la loro API, licenza a pagamento per il resto.
Se quei materiali passano da Chandra il loro tipo cambia, e patchare l'enum ora sarebbe lavoro da rifare.

## 7-bis. Perché i PDF non venivano citati NEL TESTO (la seconda metà, chiusa)

Il §7 spiega perché i PDF non entravano nelle lezioni. Restava un secondo guasto, **indipendente**: anche
quando il PDF era nel piano, il capitolo non ci rimandava. Misurato su TD74-DSA:

| | capitoli | con un link nel testo |
|---|---|---|
| video | 123 | **123** |
| PDF | 87 | **17** |

Negli altri 70 la fonte c'era, ma scritta a parole in una **nota a piè di pagina**: «Definizione ripresa
da D. Hammill; Materiale 01 (video), min. 2:40». 165 capitoli su 210 nominavano un materiale in prosa.

**Causa**: `lib/genera.js` offriva al modello **due canali** per la stessa cosa — il link
`[p. 7](pdf:03#p=7)` e la nota `[^1]` — e per un documento scritto il modello sceglie la nota, che è
come si cita un libro. Nessuno gli aveva detto che qui la fonte è un oggetto che si apre.

**Correzione**, nei tre posti che devono dire la stessa cosa:
- il prompt di sistema: una forma sola per i rimandi, l'obbligo di citare ogni materiale usato, il
  divieto esplicito di scrivere numero/pagina/minuto in prosa, e le note ridotte a note di contenuto;
- `genera.comeCitare()`: l'intestazione di ogni blocco di fonte dice come si cita **quel** materiale
  («citalo così: [etichetta](pdf:03#p=PAGINA)»). La regola dove il modello guarda davvero;
- `validate.validateCapitolo` con `ctx.attesi`: un materiale dichiarato e mai citato è un **errore**, e
  così una citazione in prosa (`citazioniInProsa`, che guarda anche le note). L'errore rientra nel giro
  di correzione già previsto da `generaCapitolo` — c'è un test che lo percorre tutto.

⚠️ `ctx.attesi` lo può riempire solo chi ha in mano la scaletta (`genera.fontiAttese`): il validatore
vede il testo, non il piano da cui il testo nasce.

Corretto nella stessa passata: `genera.testoVideo/testoPdf/testoHtml` cercavano il testo della fonte
**senza il corso**, cioè in tutte le cartelle del vault. Con la numerazione per corso due
materiali diversi possono chiamarsi «03 …».

## 8. Il riquadro «Note e materiali» (chiuso)

Due difetti distinti, entrambi in `lib/genera.js`, entrambi corretti e verificati su tutti i 258 capitoli.

1. **Riquadro assente** (17 capitoli). Il frontmatter `videoRefs`/`sources` non veniva mai riempito: il
   prompt chiede di citare con `[vai a 12:30](video:05#t=750)` e il modello lo fa, ma gli elenchi restavano
   vuoti. Risolto con `genera.rimandiDa()`, che li ricava dal testo.
2. **Riquadro monco** (39 capitoli, 88 rimandi persi). La prima versione usava una precedenza *esclusiva*:
   se il modello dichiarava anche una sola voce, la sua lista vinceva per intero e i rimandi in più scritti
   nel testo sparivano. Risolto con `genera.unisciRimandi()`: unione con dedup su `NN#t`/`NN#p`, e sul
   doppione **vince l'etichetta dichiarata dal modello**, che è scritta per essere letta lì.

I file già scritti sono stati riparati con le stesse funzioni (mai con logica duplicata). Stato finale
misurato: **258 capitoli, 0 senza riquadro, 0 incompleti.**

### Terzo difetto, trovato dopo (5 agosto, sessione successiva)

Il riquadro era pieno e i suoi rimandi si aprivano tutti — 996 su 996 — ma restavano **due difetti di
lettura**, misurati su TD74:

3. **Etichetta che ripete se stessa.** `rimandiDa` prendeva come etichetta il testo del link, e nel
   testo il link si scrive «[vai a 12:30](…)». Nel riquadro diventa «vai a 12:30 / Videolezione ·
   12:30», dove ci si aspetta di leggere di che cosa si parla lì. Erano **84 voci in 35 file**.
   Ora `genera.etichettaUtile()` scarta le etichette che sono solo il puntatore, e senza etichetta il
   lettore ripiega sul **titolo del materiale**.
4. **Ordine arbitrario.** `chapterNotes` elencava prima tutti i documenti e poi tutti i video, comunque
   fosse fatto il capitolo: appena un capitolo cita entrambi — cosa che il §7-bis rende normale — la
   voce «1» non è più la prima che si incontra leggendo. Ora `ordinaComeNelTesto()` ordina per
   comparsa nel testo, e mette in coda ciò che nel testo non compare.

⚠️ `titoloMateriale()` nel renderer ripete le regole di `corpus.titoloDi()`, perché il renderer non può
richiamare `lib/`. C'è un test che confronta le due implementazioni: è la trappola ④.

**Resta il riquadro orfano.** Nei 70 capitoli del §7-bis il riquadro è pieno ma nel testo non c'è nulla
che ci rimandi: l'unico rimedio è **riscrivere quei capitoli** con il prompt nuovo, e si paga.

---

## 9. Chandra: lettura avanzata dei documenti, componente FACOLTATIVO

Installato, girato su PDF veri e misurato. **La parte costruita finisce qui**: il resto — indice con le
figure, campo nel capitolo, resa nel lettore, esportazione — non è ancora scritto.

### Fatto

- `lib/ocr.js` — venv **separato** (`pyenv-ocr`, non `pyenv`). Chandra porta torch e transformers, la
  trascrizione vive su mlx e ctranslate2: nello stesso ambiente installare l'OCR potrebbe rompere la
  trascrizione, che è la cosa che si usa di più. Separati, rimuovere è cancellare una cartella.
- `ambiente.rileva()` lo vede; il suggerimento sta in `consiglio().ocr`, **fuori dagli avvisi**: un avviso
  che c'è sempre non lo legge nessuno, e «macchina a posto, niente da segnalare» deve restare possibile.
- `ocr:stato` · `ocr:installa` (con avanzamento e registro) · `ocr:rimuovi`. Nessuno parte da solo.
- Scheda in Impostazioni → Corsi, sotto «Materiali del corso».
- `ocr:rimuovi` **non tocca i pesi**: stanno nella cache condivisa di Hugging Face. Dice dove sono.
- `ocr.cartellaHub()` rispetta `HF_HUB_CACHE` e `HF_HOME`: chi tiene i modelli su un disco esterno le
  imposta, e cercare a mano in `~/.cache` farebbe riscaricare dieci gigabyte per niente.

### Misure vere (M5, 32 GB, MPS)

| | |
|---|---|
| ambiente | 0,93 GB · pesi 9,9 GB (`datalab-to/chandra-ocr-2`, ~5B, Qwen3.5-VL) |
| velocità | **169 s a pagina** (misurate: da 80 a 436). Il corpus intero = **65 ore** |
| resa | figura ritagliata in `.webp` **con didascalia generata** e bbox; tabelle in `<table>` vero |
| confronto | sulle pagine scansionate pypdf estrae **solo il piè di pagina**: titolo, consegna, tabella e figura per l'app non esistono |

### Tre trappole nel codice di Chandra, che costano ore

1. `load_file(path, config)` vuole un **dict**, non un argomento nominato.
2. `page_range` è confrontato con l'indice **0-based** del documento (`input.py`), mentre la CLI lo
   documenta come numero di pagina. Sfasando di uno le figure si attaccano alla pagina sbagliata, **in
   silenzio** — e il senso della feature è proprio «questa figura sta a p. 7».
3. Serve `prompt_type='ocr_layout'`: è quello che fa uscire bbox ed etichette. Il default `None` va in
   `KeyError`, e `'ocr'` dà il solo testo.

### Quali pagine mandare a Chandra: misurato, non stimato

A 169 s/pagina la selezione decide se l'elaborazione dura ore o giorni. Due regimi:

- **pagine scansionate** (testo estratto < 200 car.): il rilevamento è esatto — la pagina *è* un'immagine.
  Ma nessun rilevatore locale può sapere se dentro c'è una figura: quello lo sa solo Chandra.
- **pagine native**: `pypdfium2` **elenca gli oggetti veri** della pagina, non indovina.

Provate due regole contro la verità di Chandra su 6 pagine:

| regola | esito |
|---|---|
| area della grafica più grande sotto il fondale ≥ 0,15 | **4/6** |
| `nImg ≥ 1` **oppure** `nPath ≥ 10` | **6/6** |

⚠️ **L'area è la caratteristica sbagliata**, ed è stata la mia prima ipotesi per due giri. Una tabella è
disegnata con filetti sottili: tanti tracciati, area minima — infatti la regola ad area perdeva una tabella
e segnalava una pagina che aveva solo una decorazione grande. Il conteggio funziona perché è meccanico: un
oggetto immagine **è** una figura, e venti tracciati **sono** una tabella o un disegno.

⚠️ Altre due secche in cui sono caduto, entrambe da evitare:
- `pypdf.pages[i].images` dà **0 ovunque** su questo corpus: quei disegni sono grafica vettoriale, non
  immagini incorporate.
- prendere il **massimo** dell'area dà sempre `1.000` sulle slide, perché è il rettangolo di sfondo.
- in `pypdfium2` un `PdfObject` **non ha** `get_objects()`: i gruppi (Form XObject) si aprono con
  `FPDFFormObj_CountObjects` / `FPDFFormObj_GetObject`, ed è lì dentro che stanno quasi sempre gli schemi.
  Sbagliando questo si perdevano **444 pagine su 1377** senza un errore.

Con la regola a conteggio: **786 pagine su 1377 (57%)**, cioè ~37 ore invece di 65 — TD74 14,4 · OECD 21,8
· anthropic 0,7. Il risparmio è modesto: la leva vera è scegliere **quali PDF** valgono la pena, non quali
pagine.

### Deciso con l'utente

I 258 capitoli già scritti **non si toccano**: le figure entrano solo nei capitoli nuovi.
La selezione delle pagine **si mostra prima**, PDF per PDF, e la sceglie l'utente.

### La rilettura, fatta e provata

- `ocr.py scheda <pdf>…` → un JSON per pagina (`car`, `nImg`, `nPath`). Gira sull'ambiente della
  **trascrizione**, non su quello dell'OCR: la stima deve vedersi *prima* di scaricare undici gigabyte,
  altrimenti l'unico modo di sapere se conviene installare Chandra sarebbe installarlo. Per questo
  `pypdfium2` è stato aggiunto a `ensureDeps` (pochi megabyte).
- `ocr.py leggi <pdf> <pagine> <indice.json> <cartella-figure>` → legge, ritaglia, e **innesta**
  nell'indice esistente senza buttare via ciò che pypdf aveva estratto dalle altre pagine.
- `lib/ocr.js`: `motivoPagina` · `selezionaPagine` · `rigaStima` · `durata` · `totaleStima`. La regola è
  **pura**, quindi provata contro i casi veri già letti da Chandra.
- IPC `ocr:stima` · `ocr:leggi` (avanzamento per pagina) · `ocr:ferma`. Un documento che fallisce non
  butta via le ore spese sugli altri, e i falliti si dicono **col nome**.
- Interfaccia: elenco dei PDF con spunta, «76 pagine · 29 da rileggere (20 figura, 1 scansione, 8 tabella
  o schema) · 82 minuti», totale in fondo, conferma con il numero davanti, e «Ferma la rilettura».

Formato dell'indice dopo la rilettura, **provato su una copia**:

```json
{ "motore": "misto",
  "pages": [ { "page": 13, "text": "…", "motore": "pypdf" },
             { "page": 14, "text": "…", "motore": "chandra", "html": "…" } ],
  "figure": [ { "p": 14, "file": "<stem>__p014_f1.webp", "tipo": "figura",
                "didascalia": "…", "bbox": [339,462,1253,1498] } ] }
```

⚠️ `motore` si scrive su **ogni pagina**, non solo sull'indice: un vault finisce per contenere pagine
lette in due modi diversi, e senza dirlo non si può più sapere perché una figura c'è e un'altra no.

⚠️ Il nome del ritaglio è `<stem>__pNNN_fK.webp` e **non** quello di Chandra, che è un hash dell'HTML
del modello: instabile fra due letture e muto su quale pagina venga.

Nuova cartella `MATERIALI/Figure/` in `mat.NOMI` e `cartelleCorso()`: i ritagli sono derivati come le
trascrizioni e devono viaggiare col corso.

Verificato: `ocr:leggi` **rifiuta** TD74-DSA (protetto) e l'indice resta intatto.

### ~~Che cosa resta (la metà del capitolo)~~ → **fatta il 10 agosto 2026**

> Questa metà era il primo punto della coda del §6 e non c'è più: la sintassi
> `![didascalia](fig:03#p=7&i=2)`, il campo nello schema, il validatore, `mdser`, la raccolta dei
> rimandi, l'offerta delle figure al modello e il conteggio nell'esportazione sono scritti e provati
> (`test/figure.js`, 32 controlli). Il verbale sta in
> `HANDOFF-SESSIONE-2026-08-10.md` §3.4 (`git show 52b0ad5:HANDOFF-SESSIONE-2026-08-10.md`).
>
> ⚠️ Due cose scoperte scrivendola, che questo paragrafo non prevedeva: `srcUrl` doveva imparare a
> cercare anche in `MATERIALI/Figure/` (senza, casella vuota e nessuna causa visibile), e la figura
> si rende con uno `<span role="figure">` e **non** con un `<figure>` — dentro un `<p>` è markup
> illegale e il browser spezza il paragrafo per conto suo.

Il testo originale, per memoria: *«`capitolo.schema.json` non ha nessun campo immagine e
`validateCapitolo` vieta l'HTML grezzo in `contenuto`. Da scrivere: la sintassi in `_mdInline`, il
campo nello schema, `mdser` + `reader-parser`, l'offerta delle figure al modello in
`genera.testoFonti`, e `lib/pacchetto.js` perché i `.webp` viaggino nell'esportazione.»*

### Disegno concordato per la figura nel capitolo (non ancora scritto)

Stessa grammatica dei rimandi già in uso: `![didascalia](fig:03#p=7&i=2)`. Il lettore la rende come
`<figure>` cliccabile che apre il PDF a quella pagina — **riusando `openPdf`**, quindi zero codice nuovo
per il click — e `genera.rimandiDa()` la raccoglie come qualunque altro rimando, così la figura entra da
sé nel riquadro «Note e materiali». Chiude anche il riquadro orfano del §8: una figura nel testo è un
puntatore visibile dentro il PDF.

Da scrivere: `capitolo.schema.json` (oggi non ha nessun campo immagine, e `validateCapitolo` **vieta
l'HTML grezzo** in `contenuto`), il formato dell'indice PDF (`ingest.py:48`, oggi `{pdf, npages, pages}`),
`mdser` + `reader-parser`, una cartella in `mat.NOMI` per i ritagli, e l'esportazione (`lib/pacchetto.js`)
perché i `.webp` viaggino col corso.

⚠️ Da scrivere anche `motore: 'chandra' | 'pypdf'` **dentro l'indice**. Senza, un vault finisce per
contenere indici fatti in due modi diversi senza che si possa sapere quale: è la stessa cecità silenziosa
del §7.

---

## 10. Mappe — la vista generata (fase B, fatta l'8 agosto 2026)

Primo pezzo delle mappe: da ogni capitolo e da ogni lezione si apre una mappa **calcolata dai file
del corso**, navigabile, con quattro motori di disposizione. Nessuna chiamata al modello,
nessun costo, nessun file nuovo su disco. Il disegno del complesso sta in
[PIANO-MAPPE-EDITOR.md](PIANO-MAPPE-EDITOR.md) (interazione), con dietro
[PIANO-BRAYNR.md](PIANO-BRAYNR.md) (che cosa) e [PIANO-MAPPE-MAPPAI.md](PIANO-MAPPE-MAPPAI.md)
(con quali motori).

### Dove sta il codice, e perché lì

```
App/assets/mappa/
├── relazioni.js   8 famiglie di verbi → colore dell'arco
├── grafo.js       modello + sanitizza() + i sotto-grafi del focus
├── layouts.js     i 4 motori + instradamento + misura()
├── genera.js      dai capitoli/lezioni già parsati al grafo
└── disegna.js     dal layout al markup SVG (stringa pura)
```

Sono **moduli puri UMD**: il renderer li carica con `<script>`, `test/roundtrip.js` li richiede da
Node. Non stanno in `lib/` perché `lib/` vive nel processo principale e questi servono al
renderer; sono UMD perché altrimenti l'unica alternativa era una copia per parte — la trappola ④.
**78 controlli nuovi, 696 verdi in tutto.**

### Le decisioni prese

- **La vista generata non si salva mai.** È una proiezione del capitolo; il capitolo è la verità.
  Salvarla creerebbe due versioni destinate a divergere (trappola ③). Chi vorrà una mappa propria
  ne farà una copia in `MAPPE/`, che sarà un artefatto suo — fase D.
- **Niente fisica, niente D3.** I quattro motori sono deterministici: stesso grafo e stesse
  opzioni ⇒ stesso disegno. Su una mappa la memoria di *dove* sta un concetto è parte di quel che
  si impara, e un layout che si riassesta a ogni apertura la manda a monte. C'è un test che lo
  blocca, motore per motore.
- **`sanitizza()` prima di ogni disposizione**: i livelli si ricalcolano sempre dalla struttura
  (BFS), un livello dichiarato è un'opinione. I cicli si rompono **invertendo** un arco, non
  buttandolo. È l'`entroSchema` dei grafi, e serve già oggi ma soprattutto quando le mappe
  arriveranno dal modello (fase 6 del piano).
- **Il disegno è tutto ad attributi SVG, mai classi CSS**, e le frecce sono triangoli disegnati
  invece di `<marker>`. Non è pedanteria: è ciò che rende possibile l'esportazione vettoriale
  della fase C senza riscrivere il renderer. Le uniche regole CSS sulla mappa sono il cursore e
  l'evidenza al passaggio.
- **I colori si leggono dalle variabili CSS vere** (`--panel`, `--ink`, `--teal-strong`…) e si
  riscrivono al cambio tema, seguito con un `MutationObserver`.
- **Il glossario è acceso di default.** Misurato su TD74: **17 capitoli su 18 non hanno alcun
  titolo di sezione**, quindi senza i termini definiti la loro mappa sarebbe la sola manciata di
  punti chiave. Con il glossario diventa un albero a due rami bilanciati.
- **I preset con nome sono stati esclusi** su richiesta dell'utente: ci sono le leve, non le
  ricette.

### Che cosa si vede

Bottone **«🗺 Mappe»** accanto ad «Appunti». La mappa prende l'area del contenuto; il capitolo
resta sotto e si ritrova chiudendo (Esc). In barra: il toggle `Generata | Mie` (**«Mie» è spento**
finché non c'è l'editor — resta a schermo perché un comando che compare dopo fa ballare gli altri,
com'è già per il menu delle varianti), l'ambito capitolo/lezione, i quattro motori, TD/SX, il
pannellino ⚙ e «adatta». Le leve del ⚙ (distanze, corpi, larghezza card, stile linee, parole sui
legami, glossario) vivono in `localStorage` **per corso**, e sotto mostrano le **misure vere**
del disegno: nodi, legami, incroci, archi sopra le card. Un nodo con un rimando apre la fonte nel
dock riusando `openNote`; in panoramica un nodo-capitolo ci porta dentro.

⚠️ Su **Anelli** i tasti TD/SX si spengono: gli anelli si dispongono attorno a un centro e non
hanno un verso. Un comando acceso prometterebbe un effetto che non c'è.

### Muoversi nella mappa, e i rami che si chiudono

- **Rotella = zoom** (sotto il puntatore, non sul centro: zoomare al centro allontana proprio il
  nodo che si sta guardando), **trascinamento = spostamento**, `⤢` rimette tutto in vista.
- ⚠️ Trascinare partendo da una card finisce con un `click` su quella card, e senza rimedio ogni
  spostamento aprirebbe una fonte. `MAPPA.mosso` lo blocca, con una soglia di 3 unità: sotto,
  il gesto resta un clic — chi ha la mano poco ferma non deve perdere il bersaglio.
- **I rami si chiudono e si aprono** da un **pallino sul bordo della card**, al centro del lato da
  cui escono le diramazioni: in basso se si legge dall'alto, a destra se si legge da sinistra,
  rivolto all'esterno del cerchio negli anelli. Il verso lo dice `versoDeiFigli()` leggendolo dal
  **layout**, non dagli archi disegnati: quando il ramo è chiuso quegli archi non esistono più, e
  il pallino salterebbe da un lato all'altro proprio nel momento in cui lo si preme.
- **Niente `+` e `−`**: la differenza la fa il pieno — **anello** = ramo aperto, non c'è niente di
  riposto; **pallino pieno** = dentro c'è qualcosa. Ha due vantaggi oltre alla pulizia: non chiede
  di leggere un segno piccolo due pixel, e stando **sul bordo non ruba spazio al testo** (con il
  quadratino nell'angolo il titolo della radice finiva sotto il simbolo e bisognava accorciare la
  riga per fargli posto).
- Il tasto è un **fratello** della card nell'SVG, non un figlio: dentro avrebbe ereditato il click
  che apre la fonte, e chiudere un ramo avrebbe aperto un PDF. Raggiungibile da tastiera
  (Tab + Invio), con un bersaglio invisibile di 13px di raggio attorno al pallino da 6.
- Il pallino della **fonte** resta un cerchietto piccolo nell'angolo in alto a destra, dentro la
  card: i due segni non si confondono né per posto né per dimensione.
- La logica sta in `grafo.senzaRami()`, **pura e testata**: il sottoalbero esce dal grafo *prima*
  della disposizione, non si nasconde nel disegno — chiudere un ramo serve a restituire spazio
  agli altri, e un nodo lasciato lì invisibile terrebbe il buco dov'era.
- I rami chiusi vivono in memoria e si azzerano quando cambia la mappa (`MAPPA.identita`): gli id
  (`n1`, `n2`…) si rigenerano a ogni costruzione, quindi su un altro capitolo indicherebbero
  un altro nodo.

⚠️ **Con la sidebar nascosta la mappa era larga 367px su una finestra da 1320.** Causa:
`html[data-sidebar="collapsed"] main{ max-width:940px; margin:0 auto }` — misure giuste per la
colonna di lettura, sbagliate per una mappa; e un margine automatico su una **cella di griglia**
non la centra soltanto, la fa restringere al contenuto. Rimedio:
`html[data-mappa="1"] main{ padding:0; max-width:none; margin:0 }`.

### La prova sul corpus vero: tutte le mappe di TD74-DSA

Costruite **tutte** le mappe del corso protetto — 210 capitoli e 16 lezioni — senza scrivere
nulla nel vault (nessuna `MAPPE/`, nessun file toccato: verificato).

| | |
|---|---|
| tempo per l'intero corso | **0,2 s** (nessuna chiamata al modello, nessun costo) |
| capitoli · lezioni | 210 · 16 |
| nodi per mappa di capitolo | 11–28, **19 in media** |
| incroci · card sovrapposte · archi sopra le card | **0 · 0 · 0** su tutte e 226 le mappe |
| mappe degeneri (≤2 nodi) | **nessuna** |

Due cose che solo il corpus vero poteva dire:

1. **Solo 4 capitoli su 210 hanno titoli di sezione.** La struttura di un capitolo TD74 non sta
   nei `##`: sta nei punti chiave, nel glossario e nelle fonti citate. Il generatore è già
   costruito su questo (vedi la regola del raccoglitore), ma va ricordato prima di ottimizzare la
   gerarchia delle sezioni: qui non ce n'è.
2. **70 mappe su 210 non avevano NESSUN nodo che riportasse alla fonte**, e le altre 139 ne
   avevano uno solo (la radice). Sono esattamente i **70 capitoli del riquadro orfano del §7-bis**:
   la fonte è dichiarata nel frontmatter ma nel testo non c'è un link che ci porti, e la mappa —
   che legge i link del testo — ereditava il buco. **La mappa rende visibile quel guasto.**

### «Note e materiali» come ramo (la leva nata da quella misura)

Il riquadro in fondo al capitolo ha ciò che al testo manca: **996 fonti, 4,7 per capitolo, e tutti
e 210 i capitoli ne hanno almeno una** (è il lavoro di riparazione del §8). E le etichette non
sono puntatori generici — sono frasi come *«A1: il criterio della discrepanza rispetto al QI»* o
*«La definizione di Hammill»*: per i 206 capitoli senza sezioni **sono la sola struttura
argomentativa che i file contengano.**

Da qui il ramo **«Note e materiali»** nella mappa del capitolo, acceso di default e spegnibile
dal ⚙. Effetto misurato su tutto TD74:

| | prima | dopo |
|---|---|---|
| rimandi nelle mappe | 144 | **1140** |
| capitoli con zero nodi cliccabili | **70** | **0** |
| nodi per mappa | 13,3 | 19,0 (max 28) |
| incroci · sovrapposte · archi su card | 0 · 0 · 0 | **0 · 0 · 0** |

⚠️ Le etichette arrivano **già risolte** da `chapterNotes()` — la stessa funzione che riempie il
riquadro nel capitolo. `genera.js` non ricostruisce il titolo di un materiale: sarebbe una seconda
copia di `titoloMateriale`, e ce n'è già una nel renderer sorvegliata da un test (trappola ④).

Rami più affollati: 7 capitoli su 210 hanno un ramo con 10+ figli (il massimo è 14, un capitolo
con molte fonti). Larghezza mediana 2884px — si guarda con «adatta» e si stringe chiudendo un ramo,
che è precisamente il motivo per cui i rami si chiudono.

### Tre sintomi, due cause (corretti)

L'utente segnalava: *«lo scroll, il drag&move e i pallini non funzionano; la rotella fa scorrere
la pagina e la barra esce dalla vista»*. Sembravano tre guasti; erano due, e nessuno dei due stava
dove sembrava.

**① Lo stato vuoto si mangiava tutti i click.** `.mvuota` è `position:absolute; inset:0` e
dichiara `display:grid` **in una classe**: la regola batte quella del browser per `[hidden]`, che
ha specificità zero. `mVuota.hidden = true` quindi non nascondeva niente — il riquadro restava
steso, invisibile ma solido, sopra l'intera mappa. Ogni evento arrivava a lui e mai all'SVG:
rotella, trascinamento e pallini erano tutti scavalcati dallo stesso pezzo di vetro.
È **la trappola già scritta nel foglio di stile** («nel foglio ci sono già dieci rimedi scritti
uno per uno su singoli #id»), applicata a un elemento nuovo. Rimedio:
`.mvuota[hidden]{ display:none!important }` più `pointer-events:none`, perché lì dentro c'è solo
una frase da leggere e non deve poter intercettare niente nemmeno quando è visibile.

⚠️ **Perché i test non l'avevano preso.** Le verifiche precedenti mandavano eventi *sintetici*
direttamente sull'SVG (`svg.dispatchEvent(...)`), che **saltano l'hit-testing**: passavano tutte
mentre per l'utente non funzionava nulla. Un evento sintetico prova che il gestore c'è, non che
qualcuno riesca a raggiungerlo. Ora si verifica con `Input.dispatchMouseEvent` via CDP, che entra
dalla stessa porta del mouse vero — misurato dopo il rimedio: rotella → zoom 1 → 1,12 con
`scrollY` fermo a 0; trascinamento → pan (0,0) → (173, 87); click su un pallino → ramo chiuso.

**② La pagina traboccava di 72px per un piè di pagina.** Dentro `<main>` c'è anche
`<footer class="credit">` (34px + 38 di margine = 72,4). Nascondevo `article` e `.nav` ma non lui:
il documento diventava 920px in una finestra da 848, la pagina scorreva e **la barra dei comandi
usciva dalla vista** — la barra non è fissata, sta in cima alla mappa, e la mappa occupa esattamente
l'altezza della finestra. Ora la regola nasconde anche `main > footer`. Misurato: eccedenza 72 → **0**.

**①-bis La famiglia intera, chiusa.** Dopo il rimedio a `.mvuota` una ricognizione su tutto il
foglio (39 elementi gestiti con `hidden`, 810 regole, `wizard.js`, `composer.js` e il CSS di
EasyMDE che partecipa alla cascata) ha trovato **altri 5 casi** dello stesso difetto. Nessuno era
posizionato — **nessun altro mangia-click** — ma tre erano guasti veri e visibili:

| elemento | che cosa restava a schermo |
|---|---|
| `#expAzioni` (`.setrow{display:flex}`) | il menu delle lezioni e **«Estendi questa lezione…» funzionanti** anche senza lezioni estendibili |
| `#projRiprendiRiga` (`.vaultrow{display:flex}`) | **«Riprendi la creazione guidata»** su corsi che non hanno niente da riprendere |
| `.kr-clear` (nel gruppo `.iconbtn,…{display:inline-flex}`) | **«Rimuovi»** la chiave API dei fornitori che non ne hanno una |
| `#ocrAzioni` (`.setrow`) | una riga flex vuota: spaziatura fantasma (i bottoni dentro erano già coperti) |
| `#slotLezione` (`.setrow`) | un `<div>` vuoto — difetto formale, nessun effetto: nessun JS lo tocca più |

Invece del diciassettesimo rimedio su misura c'è ora **una rete unica**, subito dopo il reset:
`[hidden]{ display:none!important; }`. I sedici specifici restano dove sono — ridondanti, non
dannosi, e toglierli sarebbe sedici modifiche a rischio per un guadagno estetico.

⚠️ Verificato prima di metterla che **nessuna superficie dell'app si apra contando di restare
`hidden`**: impostazioni, pannelli interni, mappa, editor degli appunti si aprono e si chiudono
come prima. E chiude anche una **fragilità latente**: `.ttsbar` (i comandi di lettura) è
`position:absolute` dentro `#content` e aveva un rimedio **senza `!important`** — se avesse perso
la cascata sarebbe diventato esattamente il mangia-click che è stato `.mvuota`, ma sopra il testo
del capitolo.

**③ Altezza della barra.** `min-height:calc(var(--ctl-h) - 1px)` = 39px: la maniglia dell'indice è
alta 40 ma parte 1px più su per sovrapporre i bordi invece di affiancarli, e così i due bordi
inferiori cadono sulla stessa riga (misurato: entrambi a 196). È `min-height` e non `height`
perché a riquadro stretto i comandi vanno a capo e la barra deve poter crescere.

### Un guasto vecchio trovato per strada (corretto)

`positionPanelToggle()` — che piazza il tasto dell'indice e il contatore dei capitoli — girava
**solo su `load` e `resize`**. Quando i webfont arrivavano dopo, la topbar cresceva e i due
restavano dov'erano, sopra il contenuto: è la **trappola ⑦ già scritta nel §4**, sugli stessi
pixel, rimasta aperta per questi due elementi. Si vedeva a intermittenza (dipende da chi vince la
corsa fra `load` e il reflow dei font) e la barra della mappa l'ha resa evidente. Ora
`positionPanelToggle` è chiamata da `setTopbarH`, cioè dal `ResizeObserver` che già segue la
topbar. Barra di avanzamento e contatore si nascondono con la mappa aperta: misurano dove sei nel
*testo*, e sopra una mappa non vogliono dire niente.

### Fase D — mappe personali: decisioni prese e lavoro in corso (8 agosto)

**Le decisioni di merito sono chiuse.** Vanno rispettate da chi continua, perché sono state
prese misurando o discutendo, non per default.

1. **Formato: JSON nostro, non JSON Canvas.** Obsidian non interessa più all'utente.
   ⚠️ Per verbale: avevo scoraggiato JSON Canvas dicendo che non ha il verbo sull'arco. **Era
   falso** — la spec 1.0 ha `label` sugli archi e `fromEnd`/`toEnd` per le punte. La scelta di un
   formato proprio resta valida, ma non per quella ragione.
2. **`formato: 1` in testa a ogni file.** Costa una riga oggi ed è la sola cosa che rende
   economico un cambio di forma domani. Stessa logica di `motore` dentro gli indici PDF (§9).
3. **Sull'arco si salva SOLO il verbo.** Famiglia e colore non si salvano mai: si ricavano con
   `relazioni.famigliaDi()` in lettura. Se si salvassero entrambi, il giorno in cui l'utente
   corregge il verbo il colore resterebbe quello di prima e la mappa direbbe una cosa mostrandone
   un'altra. È la trappola ④ applicata alle mappe.
4. **Gli archi non prendono un colore scelto a mano.** I nodi sì (5 preset + picker), gli archi
   no: il loro colore significa la famiglia, e un colore manuale renderebbe la classificazione
   invisibile. Chi vuole un altro colore cambia il verbo.
5. **Il verbo si salva come è stato battuto**, senza normalizzarlo in scrittura: la
   normalizzazione serve solo alla ricerca della famiglia in lettura.
6. **Testo libero con `datalist`, mai lista chiusa.** Costringere a scegliere fra otto voci fa
   scrivere il verbo sbagliato invece di quello giusto; un verbo sconosciuto ha già casa in
   `altro`.
7. **«Inverti» scambia i capi E SVUOTA IL VERBO** *(scelta esplicita dell'utente)*. «A richiede B»
   invertito non è «B richiede A»: è falso. Quasi tutte le famiglie sono asimmetriche, solo
   l'analogia regge l'inversione. Rifinitura possibile in futuro: proporre il reciproco dove
   esiste (*precede* ↔ *segue*, *comprende* ↔ *fa parte di*), mai invertire e basta.

**Il lavoro è stato diviso in tre strati**, secondo la skill `fan-out`: i due disgiunti in
parallelo, l'interfaccia in fila dopo perché converge tutta in un file solo.

| strato | file | stato |
|---|---|---|
| persistenza | `lib/mappe.js` (nuovo), `main.js`, `preload.js`, `lib/pacchetto.js`, `test/mappe.js` | ✅ **fatto e verificato**: 116 controlli, più il giro completo su disco provato a parte |
| operazioni pure | `App/assets/mappa/modifica.js` (nuovo), `test/modifica.js` | ✅ **fatto e verificato**: 109 controlli, più un giro di controprova indipendente |
| motori e disegno (lotto L0) | `layouts.js`, `grafo.js`, `disegna.js`, `modifica.js`, `lib/mappe.js` | ✅ **fatto e verificato** l'8 agosto: posizioni fissate onorate dai motori, nodi estratti, colore per origine |
| registro «Mie» (lotto L1) | `App/StudIA.html` | ✅ **fatto e verificato** l'8 agosto: elenco, apertura, «+ Nuova», «Modifica una copia», salvataggio automatico, pallino di modifica |
| i gesti sulla tela (lotto L2) | `App/StudIA.html`, `App/assets/mappa/disegna.js` | ✅ **fatto e verificato** l'8 agosto: crea, figlio/fratello, rinomina, trascina, elimina, ⌘Z etichettato, cestino della mappa |
| archi e menu (lotti L3–L4) | `App/StudIA.html`, `disegna.js`, `relazioni.js` | ✅ **fatto e verificato** il 9 agosto: porta di trascinamento, «Collega a…», linking word col vocabolario condiviso, menu contestuale unico, colori con cascata, cestino |
| interfaccia, il resto | `App/StudIA.html` | L5 ✅ · **G1–G2 ✅ il 10 agosto** (le generate parlano di concetti) · **DA FARE: L6 ritaglio e G3 (i verbi dal modello)** |

⚠️ **`App/assets/mappa/modifica.js` non era caricato dalla pagina.** I tag in testa a `StudIA.html`
caricavano gli altri cinque moduli: nel renderer `MappaModifica` era `undefined`, cioè 582 righe
provate da 212 controlli e **irraggiungibili** — la classe di guasto del §7, sul lavoro dello stesso
giorno. Ora c'è la riga, con la nota che chi aggiunge un modulo deve aggiungere anche quella.

⚠️ **Il ponte delle mappe si chiama `window.vault.mappe`** (non `studia.mappe`, come diceva una
prima stesura del piano) ed è **asincrono**, a differenza di `vault.notes.*` che scrive con `fs`
dentro il preload. Da lì tre cose che dagli appunti non si possono copiare: niente salvataggio in
`beforeunload` (la finestra si chiude prima della risposta — si salva su `visibilitychange` e
`blur`), un guardiano di sequenza sulle risposte, e il pallino che si spegne nel `.then`.

⚠️ **Quel «restava solo l'interfaccia» era sbagliato.** Rileggendo il codice per pianificare
l'editor sono saltati fuori tre buchi nel livello puro, raccontati in
[PIANO-MAPPE-EDITOR.md §12.1](PIANO-MAPPE-EDITOR.md): il più caro è che **nessun motore leggeva
`x`/`y`** — `sposta` le scriveva, il disco le conservava, e `layouts.run` ricalcolava tutto da
zero. Trascinare un nodo avrebbe salvato una coordinata che nessuno onora, e alla riapertura la
mappa sarebbe tornata ordinata: il lavoro sparisce, e sparisce in silenzio. Gli altri due:
`creaNodo` non sapeva fare un nodo estratto (quindi il §3 del piano non era lavoro di renderer), e
`disegna.js` non aveva la regola cromatica origine→colore. Tutti e tre chiusi in L0.

**Verifica fatta, non solo riferita.** Il **punto di contatto** — che è dove una delega lascia i
suoi difetti — non è più una prova fatta a parte: è la sezione 15 di `test/mappe.js`, e percorre
la catena intera come la percorrerà l'interfaccia. `estrai` → `sposta` → `salva` → `apri` →
`layouts.run` → `disegna.svg`: coordinate, rimandi, origini e rami chiusi sopravvivono al disco, il
motore onora le posizioni rilette, l'arco arriva davvero sulla card spostata e non dove stava
prima, e il nodo scritto a mano si disegna grigio mentre quello estratto prende il colore del ramo.

`npm test` esegue **tutti e tre** i file (`roundtrip` 769 · `mappe` 165 · `modifica` 212 =
**1146 controlli**). Prima ne lanciava uno solo: una rete che c'è ma non è agganciata è la classe
di guasto del §7.

**Un difetto vecchio trovato per strada.** `lib/corsi.js` elencava in `NON_LEZIONI` le cartelle
che non sono lezioni, e sui corsi senza `LEZIONI/` quell'elenco decide che cosa compare come lezione.
Mancava `MAPPE` (nuova) **e mancava `PERCORSI`**, che manca dal giorno in cui sono nate le
varianti: su un corso vecchio sarebbe comparsa una lezione fantasma di nome «PERCORSI». Aggiunte
tutte e due, con una nota che dice di aggiornarle ogni volta che nasce una cartella dell'utente.

**Lo strato dell'interfaccia, quello che resta**, è disegnato in
[PIANO-MAPPE-EDITOR.md](PIANO-MAPPE-EDITOR.md) §4 e §5, ordinato in lotti nel **§12.3** (L1–L6) e
si appoggia a cose che esistono già:

- accendere il tasto **«Mie»** in barra (oggi spento con un titolo che promette) e l'elenco a
  tendina delle mappe, col pattern di `noteSelect`;
- **«Modifica una copia»**, che semina una mappa dell'entità generata che si sta guardando;
- **menu contestuale** su nodo, arco e area vuota (§5 del piano). Da scrivere UNA volta: le voci
  di lettura servono anche alla fase G (focus vicini/parentela, le cui funzioni di selezione sono
  già scritte e provate in `grafo.js`);
- i gesti del §4.1–4.4: doppio click su vuoto crea, Tab/Invio figlio e fratello, drag dalla porta
  per l'arco, doppio click sull'arco per la linking word, colore con la spunta «applica ai
  discendenti». ⚠️ **Ognuno di questi gesti deve avere anche la sua voce nel menu contestuale**,
  con la scorciatoia scritta accanto (richiesta esplicita dell'utente, §5 del piano): un gesto non
  si vede, e chi legge lentamente non lo indovina. Conseguenza pratica: i gesti nascono come
  funzioni chiamabili, non come gestori d'evento, così gesto e menu passano per lo stesso punto;
- **⌘Z etichettato**: la pila la fornisce `modifica.js` (`annullabile` / `annulla` /
  `daAnnullare`, tetto 20), l'interfaccia deve solo chiamarla prima di ogni operazione distruttiva
  e mostrare che cosa annulla.

✅ **La decisione sulla cascata del colore è presa** (dall'utente, 8 agosto): `colora(g, id,
colore, {aCascata:true})` colora il sottoalbero **del grafo che le passi**, e l'interfaccia le
passa il **grafo intero**, non quello potato da `senzaRami`. Chi colora un ramo intende il ramo,
non la porzione che sta guardando in quel momento, e un colore che cambiasse a seconda di quali
rami erano aperti sarebbe imprevedibile. Nel modulo non c'è una regola nascosta: la scelta resta
di chi chiama, ed è questa.

Le altre decisioni prese lo stesso giorno stanno nel **§12.2 del piano**: «→ Mappa» senza una
mappa attiva crea una mappa nuova vuota col solo frammento; le posizioni manuali valgono finché
non si cambia motore (e il cambio motore, essendo perciò distruttivo, passa dalla pila e dichiara
quante ne azzera); il ✂ ritaglio d'area entra, ma per ultimo.

Sull'API di `modifica.js` due dettagli utili: l'id del nodo appena creato torna in `g2.nuovo`,
proprietà **non enumerabile** (quindi `JSON.stringify` non la vede e non finisce nel file); gli id
utente sono `u1`, `u2`… scelti prendendo **il primo libero** e non contando i nodi, perché dopo
un'eliminazione i due numeri divergono.

### Che cosa resta (fasi successive, in ordine)

| fase | contenuto |
|---|---|
| **C** | export PDF vettoriale (`svg2pdf` + jsPDF: font registrato nell'istanza, alone del testo copiato a mano — le trappole sono già scritte nel §7 di PIANO-MAPPE-MAPPAI) |
| **D** | «Mie mappe»: `MAPPE/*.canvas`, «Modifica una copia», editor di nodi/archi/colori, menu contestuale, undo |
| **E** | estrazione: `→ Mappa` sulla selezione, ⌘⇧C verso la mappa, linking words col vocabolario delle famiglie |
| **F** | ✂ ritaglio d'area sul PDF → `MATERIALI/Figure/` |
| **G** | focus vicini/parentela (le due funzioni di selezione sono **già scritte e provate** in `grafo.js`: `vicini()` e `parentela()`) |

⚠️ Quando nascerà `MAPPE/`, va aggiunta a `lib/pacchetto.js` **lo stesso giorno**: un'esportazione
che perde le mappe è il tipo di silenzio che in questo lavoro è già costato caro.

---

### Note sparse

- Lo stato del piano dichiara 7 valori ma **solo `proposto` e `approvato` vengono scritti**: `raccolta`, `ingest`,
  `in-generazione`, `generato` non compaiono in nessuna riga di codice.
- La numerazione dei materiali è per corso, ma TD74 resta `01–40` e l'OECD `01–24`: **si sovrappongono**.
  Va bene perché il risolutore è scopato per corso, ma non fidarsi dei numeri fuori dal loro corso.
- I 10 GB della copia vecchia di TD74 sono stati liberati (Cestino svuotato dall'utente il 5 agosto).
- Chandra occupa **~11 GB** sul computer dell'autore: 0,93 GB di ambiente in
  `~/Library/Application Support/studia/pyenv-ocr` e 9,9 GB di pesi nella cache di Hugging Face.
  Su quella macchina `~/.cache/huggingface` è un **link** verso
  `~/Antigravity/ScriverAI_models_database/huggingface` — stesso disco interno, solo un'altra
  cartella, dove l'utente raccoglie i modelli di più programmi. Niente da collegare o da montare.
  «Rimuovi» nelle Impostazioni cancella l'ambiente ma **non** i pesi: stanno in una cache condivisa
  e potrebbero servire ad altro, quindi si tolgono a mano. L'app dice dove sono.
- I server MCP `plugin:design:*` (asana, atlassian, figma, intercom, linear, notion, slack) risultano non
  autorizzati: vanno collegati dalle impostazioni dei connettori di claude.ai o con `claude mcp` in una
  sessione interattiva. Non servono a StudIA.
