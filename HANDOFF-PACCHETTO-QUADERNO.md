# Handoff — il pacchetto «Quaderno»: nove lavori sugli appunti, le evidenze e i rimandi

> **A chi arriva adesso.** Questo file basta per cominciare: dice che cosa costruire, dove vive
> ogni pezzo, quali fatti sono già stati **misurati** e quali trappole sono già state pagate.
> Non è un piano approvato: è il materiale con cui scriverne uno.
>
> **Prima di scrivere una riga, leggi in quest'ordine** (è il protocollo di `GUIDA-ARCHITETTO.md` §9):
> 1. `GUIDA-ARCHITETTO.md` — invarianti numerati, vocabolario, trappole permanenti;
> 2. `HANDOFF-DEFINITIVO-2026-08-23.md` — lo stato: dove sono i lavori, che cosa è appena successo;
> 3. `PIANO-BRAYNR.md` (appunti, evidenze, mappe) e `PIANO-ZAINO.md` (§1 le decisioni, §6 i non-obiettivi).
>
> **Il punto di partenza**: `main` a **`ab74eba`**, `origin/main` allineata, albero pulito, nessun
> ramo. Suite intera CDP verde (**57 prove**) · `npm test` verde (**46 file**).
>
> ✅ **OTTO VOCI SU NOVE SONO FATTE E UNITE**: Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8.
> **Resta soltanto Q9** — il più importante dei nove, con il vincolo non negoziabile sugli strati e
> **due bivi veri ancora da decidere con l'utente** (§6.2 e §6.3). Il pacchetto raccomanda
> `/architetto` prima di scriverlo.

---

## 0. La regola di forma, che vale prima di ogni riga di codice

**Si scrive sempre pensando alla prova in NODE, non a quella CDP.** È una regola dichiarata
dall'utente il 23 agosto 2026, e non è «aggiungere una prova dopo»: è **scegliere la forma del
codice prima**, così che la parte che si sbaglia stia in una funzione pura richiamabile da
`node test/<file>.js`.

Il perché è misurato (`PIANO-MODULI.md` §1): una prova CDP costa ~40 secondi e un'istanza di
Electron; una di unità ~40 millisecondi. Cambia quante volte al giorno si prova qualcosa.

**Come si applica.** Davanti a ogni lavoro, separare **la decisione** dall'**esecuzione**:

- la decisione (aritmetica, stringhe, tabelle di priorità, «chi vince fra questi due», «che cosa
  si fa di un valore che arriva dal disco») diventa un **modulo UMD** in `App/assets/…` con la sua
  prova in `test/`;
- al renderer resta leggere il DOM, chiamare il modulo, e fare quello che dice.

Il criterio è scritto in testa a `App/assets/fonti/zoom.js`: *«solo ciò che si può decidere SENZA
il viewer e senza il DOM, perché è la parte che si sbaglia e che a schermo si potrebbe provare solo
a occhio»*. E il modo di passare i dati è quello di `suMac(nav)` in `tasti/nomi.js`: **il modulo si
fa passare quello che non può leggere**, invece di leggerlo da sé.

Alla prova CDP resta **il cablaggio**: il gestore è attaccato? il `preventDefault` ferma davvero
quello che c'era sotto? Mai la logica.

⚠️ **E una prova non si crede finché non la si sa far diventare rossa.** Il metodo usato in tutto
il pacchetto precedente: si rimette il codice di prima, si rilancia, e si guarda che il controllo
nuovo fallisca. Un verde che non si sa far diventare rosso non prova niente.

---

## 1. I nove lavori

Otto **S** e due **M**. Sono tutti sulla stessa materia — gli appunti, le evidenze, i rimandi — e
per questo stanno insieme: toccano `_evidenze.json`, la barra della selezione, la lente e
`APPUNTI/`. Vengono dal catalogo di 56 idee costruito il 23 agosto (sei prospettive, tre giudici).

| | | costo | famiglia |
|---|---|---|---|
| Q1 | ✅ **Il quaderno si riapre alla riga** — *fatto il 26 ago 2026, `PIANO-ZAINO.md` §Z19* | S | ritrovare |
| Q2 | ✅ **La lente porta al punto esatto della parola cercata** (editor **e** PDF) — *fatto, `ab74eba`* | S | ritrovare |
| Q3 | ✅ **Il pallino che mantiene la promessa** — *fatto il 24 ago 2026, `PIANO-ZAINO.md` §Z16* | S | lavorare |
| Q4 | ✅ **Sbirciare senza saltare** — *fatto il 26 ago 2026, `PIANO-ZAINO.md` §Z21* | M | ritrovare |
| Q5 | ✅ **La lente legge anche le mappe e le didascalie** — *fatto il 26 ago 2026, `PIANO-ZAINO.md` §Z20* | S | ritrovare |
| Q6 | ✅ **La postilla** — *fatto il 26 ago 2026, `PIANO-ZAINO.md` §Z17* | S | lavorare |
| Q7 | ✅ **Chi entra si vede** — *fatto il 24 ago 2026, `PIANO-ZAINO.md` §Z15* | S | riparazione |
| Q8 | ✅ **Il quaderno va nel Cestino, non nel nulla** — *fatto il 24 ago 2026, `PIANO-ZAINO.md` §Z14* | S | riparazione |
| Q9 | **Le sottolineature del tutor arrivano come lettura** | M | insieme |

⚠️ **I numeri di riga di `App/StudIA.html` NON sono in questo documento**, ed è deliberato: il file
è un monolite da ~20.400 righe che si muove sotto i piedi, e la trappola è catalogata in
`GUIDA-ARCHITETTO.md` §8 («i confini di un blocco si calcolano dalle sentinelle al momento, mai da
un grep di ieri»). Qui trovi **i nomi delle funzioni e delle stringhe da cercare**: falli parlare
con un `grep -n` tuo.

---

## Q1 — Il quaderno si riapre alla riga ✅ *FATTO (26 ago 2026 — il racconto è in `PIANO-ZAINO.md` §Z19)*

**Il gesto.** Riapri un appunto e il cursore è dove l'avevi lasciato, con quella riga a vista. Come
il PDF si riapre alla pagina e il video al secondo. Nessun comando nuovo.

**Perché.** L'app ricorda già dove eri in ogni documento (`_lettura.json`) e in ogni media
(`_ascolto.json`). L'appunto — il pezzo su cui si torna più spesso, e l'unico che l'utente ha
scritto lui — si riapre sempre in cima. Su un appunto di un semestre vuol dire scorrere ogni volta.

**Dove.** `noteOpen(file)` è la porta unica da cui passa l'apertura (la usano la sidebar, la
tendina QUADERNO e `searchGoto`). La memoria di «dove eravamo» ha già il suo precedente in
`lib/lettura.js` e `lib/ascolto.js`, che sono due moduli con la stessa forma — vale la pena
leggerli tutti e due prima di decidere.

⚠️ **La decisione da prendere, e va presa PRIMA:** la riga è una **preferenza di lettura di questa
macchina** (`localStorage`) o **viaggia col vault** (un file accanto agli appunti)? La linea è
fissata il 19 agosto e sta scritta nell'handoff del 23 (§3): *nel vault sta l'aspetto e lo stato
dei CONTENUTI, che viaggia con l'esportazione; nel `localStorage` sta come si vede lo schermo di
questa macchina.* La pagina del PDF viaggia col vault (`_lettura.json` sta in `MATERIALI/`);
l'argomento per fare lo stesso con la riga è forte, e sarebbe `APPUNTI/_lettura.json` o una chiave
in quello che c'è.

⚠️ **Che cosa si ricorda: la RIGA o il carattere?** Un appunto si riscrive: salvare l'offset
assoluto vuol dire riaprirlo a metà parola dopo una modifica fatta altrove. La riga è più robusta,
e se il file si accorcia si stringe all'ultima — la stessa regola di `vaiAPagina`, che stringe
all'ultima pagina vera.

**La parte pura** (candidata): dato il numero di righe di adesso e la riga ricordata, quale riga
mostrare. Con i casi limite: file accorciato, riga 0, riga oltre la fine, valore illeggibile.
⚠️ Attenzione a non ripetere il difetto già pagato in `aspetto/stanza.js`: *«non ho capito» non è
«vai in cima»* — o si perde il punto per un valore storto.

---

## Q2 — La lente porta al punto esatto della parola cercata ✅ *FATTO (`ab74eba`, 24 ago 2026)*

Tutti e quattro i pezzi sono in `main`. **Che cosa è entrato**, per chi deve costruirci sopra —
Q4 in particolare, che riusa gli stessi risolutori:

| | | dove |
|---|---|---|
| **Q2.1** | l'attesa del documento non è più un numero | `App/assets/fonti/attesa.js` |
| **Q2.2** | la prova passa dalla lente vera | `test/cdp/prova-lente-punto.js` |
| **Q2.3** | l'editor atterra sulla parola e la seleziona | `RicercaIndice.punto` + `noteVaiAlPunto` |
| **Q2.4** | la prova che il punto è quello giusto, su tutte e due le metà | idem |

**Due moduli nuovi, e quello che va saputo prima di riusarli:**

- **`App/assets/fonti/attesa.js`** — `attendi(prova, opz)` → `{pronto, ms, sguardi}`. **Orologio e
  timer si fanno passare** (`ora`, `dopo`), perché un'attesa provata col tempo vero è una prova che
  a volte passa. Risponde **una volta sola** e **non rifiuta mai**: «non è arrivato in tempo» è una
  risposta, non un guasto. Tetto di fabbrica **20 s**, misurato sui 12,4 dell'Intel.
- **`RicercaIndice.punto(grezzo, chiesto)`** → `{da, a}` nel testo **grezzo**, o `null`. Sta dentro
  `ricerca/indice.js` e non accanto: chi dice *se* una parola c'è dice anche *dove*, con le stesse
  convenzioni. **Mappa le posizioni una per una** invece di supporre che la normalizzazione
  conservi la lunghezza.

⚠️ **Tre cose trovate misurando, che valgono per il resto del pacchetto:**

1. **La normalizzazione NON preserva sempre la lunghezza.** `toLowerCase()` non è uno a uno: la
   «İ» (U+0130) diventa **due** caratteri. `punto()` non ci casca; **il `frammento` della lente
   sì**, e su un testo con quella lettera parte sfasato di uno. Piccolo, cosmetico, **dichiarato**
   in `test/ricerca.js` con il suo controllo — se qualcuno vuole chiuderlo, il posto è `frammento`.
2. **La lente cerca dentro i PDF SOLO in modalità zaino**, e nei corsi cerca nei capitoli: è un
   ramo con il suo commento, non una lacuna. Serve a Q5, che deve decidere dove infilare mappe e
   ritagli.
3. **Il vault di prova non va arricchito**: `prova-import.js` mostra la ricetta — uno zaino nuovo,
   il PDF importato dalla porta vera, `fontiIndicizza` che scrive l'indice con pdf.js.

⚠️ **E due trappole per chiunque scriva una prova che tocca uno zaino:** non cancellare lo zaino di
prova alla fine (`zaino:elimina` passa da `shell.trashItem`, cioè dal **Cestino vero** di chi lancia
le prove) e **tornare ai corsi** alla fine, perché `partiPulito()` chiude pannellini e selezioni ma
**non riporta la modalità**. Da sole erano verdi tutte e due; le ha viste solo la suite intera.

---

## Q3 — Il pallino che mantiene la promessa ✅ *FATTO (24 ago 2026 — il racconto è in `PIANO-ZAINO.md` §Z16)*

**Il difetto.** Selezioni una frase nel PDF, premi **«Alla mappa»**: nasce un nodo col testo, e col
**pallino della fonte nell'angolo** — che cliccato **non apre niente**. Un nodo nato da una parola
chiave o da un ritaglio quel pallino lo onora; questo no.

**Perché è di principio, non estetico.** «Un comando su carta è un disegno che promette un gesto
impossibile» è già scritto nel modulo di stampa, e il progetto si vieta i gesti promessi e
impossibili in più punti (il segmento Generata/Mie che *sparisce* invece di spegnersi; la voce
«Capitolo» che non si offre in uno zaino). Un pallino che compare e non apre è la stessa cosa.

**Dove.** La barra della selezione e il menu del tasto destro fanno le stesse cose con le stesse
funzioni: cerca `data-az` nel monolite — c'è un `getAttribute('data-az')` che smista, ed è da lì
che si arriva all'azione «mappa».

⚠️ **La pagina è già calcolata**: «Appunta», nello stesso menu e sulla stessa selezione, scrive già
`pdf:NN#p=X` passando da `RimandiSintassi`. Non serve calcolare niente di nuovo: serve **passare al
nodo quello che il fratello accanto ha già in mano**.

⚠️ **`MAPPE/*.json` non deve cambiare forma.** Il campo che regge il pallino esiste (`rimando` sui
nodi, vedi `App/assets/mappa/genera.js`): si riempie quello. Un campo nuovo sarebbe una seconda
grammatica (invariante 7).

⚠️ E se la pagina non c'è, **il pallino non deve comparire**: meglio nessun pallino di uno che non
apre. È lo stesso difetto, al contrario.

---

## Q4 — Sbirciare senza saltare ✅ *FATTO (26 ago 2026 — il racconto è in `PIANO-ZAINO.md` §Z21)*

**Il gesto.** Ti fermi col mouse su un rimando — nell'anteprima di un appunto, su un chip delle
Parole chiave, sul pallino di un nodo — e dopo mezzo secondo una bolla mostra che cosa c'è
dall'altra parte:

| rimando | che cosa mostra |
|---|---|
| `pdf:NN#p=7` | le tre-quattro righe della pagina attorno alla citazione |
| `ev:id` | la frase con prefisso e suffisso, e l'esatto acceso del suo colore |
| `album:id` | la miniatura |
| `video:NN#t=160` | il titolo del media e «2:40» |

Esc la chiude. Il click resta quello di sempre.

**Perché.** È il principio fondante di `PIANO-BRAYNR.md` §0 — *«hover = anteprima; click = torni
lì»* — che nello zaino non c'è. Rileggere un appunto pieno di rimandi costa oggi un salto per
ciascuno, e **ogni salto butta via il filo**: per un lettore con una dislessia è il costo più alto,
e chi rilegge appunti vecchi verifica la fonte dieci volte al minuto.

**Dove, e la disciplina che decide se il lavoro è buono.** ⚠️ **Gli stessi risolutori del click, mai
un secondo lettore dei rimandi.** `RimandiSintassi.leggi` è la porta unica (invariante 7); i dati
sono già tutti in memoria — `FONTI.indici` per il testo delle pagine (li carica `lib/fonti.js
leggiIndici`, e li usa già la lente), `EVIDENZE` per le frasi, `lib/album.js` per le miniature. Se
ti trovi a scrivere una seconda funzione che *interpreta* un rimando, ti sei perso.

⚠️ Il vestito è il **tooltip dell'app**, non uno nuovo (invariante 8).

⚠️ **Attenzione al costo su un appunto lungo**: la bolla si costruisce al passaggio del mouse, non
in anticipo per tutti i rimandi della pagina.

**La parte pura**: da un rimando letto + i dati grezzi (il testo della pagina, la voce
dell'evidenza) → **il contenuto della bolla**, come struttura. Il DOM lo costruisce il renderer.

---

## Q5 — La lente legge anche le mappe e le didascalie ✅ *FATTO (26 ago 2026 — il racconto è in `PIANO-ZAINO.md` §Z20)*

**Il gesto.** Cerchi «perielio» e, sotto APPUNTI e prima dei documenti, compaiono:

- **MAPPE** — una voce per nodo che contiene la parola («Il sistema solare › nodo "perielio"»);
  click = apre la mappa e mette a fuoco quel nodo;
- **RITAGLI** — una voce per didascalia; click = la card.

**Perché.** I nodi di mappa e le didascalie sono **l'altro testo che l'utente ha SCRITTO**, e la
lente non li vede. Il principio è già dichiarato dentro `App/assets/ricerca/indice.js`: gli appunti
stanno in cima ai risultati perché *«quello che hai scritto tu viene prima di quello che hai
letto»*. Le mappe e le didascalie sono dalla stessa parte di quella linea, e ne restano fuori.

**Dove.** Il modulo ha già tre costruttori di documento — `docCapitolo`, `docAppunto`, `docPagina`
— e la funzione `cerca(docs, q, opt)`. Il lavoro è **due costruttori in più** con la loro prova in
Node, più il ramo di atterraggio in `searchGoto`.

⚠️ Il modulo è **puro e già provato** (`test/ricerca.js`): i due costruttori nuovi si provano lì,
in Node. Alla CDP resta l'atterraggio.

⚠️ **L'ordine dei gruppi è una promessa**, non un caso: appunti primi. Decidere dove vanno mappe e
ritagli — e scriverlo — fa parte del lavoro.

⚠️ Su una mappa il click deve **mettere a fuoco il nodo**, non aprire e basta: aprire una mappa di
98 nodi e lasciare che l'utente cerchi a occhio è mezzo gesto. `mappaFocus(id, 'vicini')` esiste.

---

## Q6 — La postilla ✅ *FATTO (26 ago 2026 — il racconto è in `PIANO-ZAINO.md` §Z17)*

**Il gesto.** Nella barra della selezione, accanto a «Keyword», **«Postilla…»** apre un campo di una
riga; il testo si salva come `nota` dell'evidenza. Sulla pagina l'evidenza con postilla porta un
segnetto al margine: passandoci sopra si legge, dal menu del chip si corregge. Chi cita `ev:id`
negli appunti eredita la postilla nel `title` del `<mark>`, **come già eredita il colore**.

**Perché.** Nel modello W3C un'annotazione ha due metà: il **bersaglio** e il **corpo**. StudIA ha
il bersaglio (`prefix/exact/suffix`, il TextQuoteSelector) e **non ha il corpo**. Il momento è
quello in cui sottolinei e sai già perché («contraddice p. 4», «chiedere al prof»): scriverlo in un
appunto è un cambio di stanza, e per una riga non lo fai — così la ragione della sottolineatura,
l'unica cosa che valeva, si perde.

**Dove.** `lib/evidenze.js`: `CAMPI` è la lista bianca dei campi che sopravvivono a un salvataggio.
Un campo `nota` opzionale in più.

⚠️ **Non entra nell'identità.** Il seme dell'id è `materiale + pagina + prefix + exact + suffix`
(+ `strato` se c'è). La postilla sta accanto a `colore` e `tratto`: sono *commento e aspetto*, non
identità. Scriverla o correggerla non deve far nascere una seconda evidenza. **Verificalo con una
prova**: è la trappola catalogata («aggiungere un campo al SEME di un'identità cambia gli id di ciò
che è già nei vault»).

⚠️ **I vault vecchi restano identici byte per byte**: un campo assente resta assente, non diventa
`""`.

⚠️ **Il gancio esiste già**: l'appunto chiede all'evidenza il suo colore via `evidenza(id)` —
chiedere anche la nota è la stessa strada. E vale la regola di `PIANO-BRAYNR` P1.1-bis: *nel
markdown c'è la CITAZIONE, non il dato*. La postilla vive nell'evidenza; l'appunto la chiede al
momento di disegnare. Copiarla nel markdown la farebbe divergere al primo ritocco.

⚠️ **IL LIMITE VA DICHIARATO E FATTO RISPETTARE: una riga.** Se cresce, il posto è l'appunto. Non è
pigrizia: il giorno che la postilla accetta tre paragrafi, l'utente ha due posti dove scrivere —
uno cercabile (gli appunti), uno no — e non saprà mai in quale ha messo quella cosa. Il limite si
scrive nel codice, non solo nel commento.

---

## Q7 — Chi entra si vede ✅ *FATTO (24 ago 2026 — il racconto è in `PIANO-ZAINO.md` §Z15)*

**Il difetto, misurato il 23 agosto.** La lista delle estensioni audio esiste in **cinque copie**.
Due concordano, tre no:

| dove | ha `.ogg .opus .aiff`? | chi la usa |
|---|---|---|
| `lib/materiali.js` | **sì** | il drop nello ZAINO |
| `App/assets/player/lettore.js` | **sì** | il player nel browser |
| `main.js` (due volte) | no | l'elenco dei media di un CORSO · il drop nel vault · il conto delle trascrizioni |
| `lib/importa.js` | no | l'import cartella di un corso |
| `lib/corpus.js` | no | che cosa può entrare in un piano |

**Conseguenza reale**: un `.opus` (WhatsApp, Telegram, i registratori) trascinato in uno **zaino**
entra e si vede; messo in `Media/` di un **corso** non viene elencato, e **l'app non dice niente**.
Chi lo fa crede di aver sbagliato lui.

⚠️ **Le prime due copie NON sono il difetto**: sono una copia **dichiarata**, con il commento che
spiega perché (un file gira nel browser, dove `lib/` non arriva; l'altro nella pipeline, dove
`assets/` non arriva) e con `test/player.js` che la inchioda. Quello è il pattern giusto e va
lasciato.

**Il lavoro**: le altre tre richiamano `lib/materiali.js` invece di riscrivere la lista, e
`test/player.js` estende il confronto alle liste rimaste. È l'invariante 5 da saldare e
l'invariante 4 da onorare.

⚠️ **C'è il caso opposto, e va MISURATO prima di dichiararlo**: `.aiff`, `.avi` e `.mpg` sono nelle
liste accettate, ma Chromium potrebbe non decodificarli. «Entra e non suona» è la stessa promessa
rotta dall'altro lato. La regola sana è simmetrica: **o entra e si vede, o si ferma sulla soglia
dicendo perché**. Il terzo caso non deve esistere.

⚠️ È il **prerequisito del memo vocale**: `MediaRecorder` in Chromium produce `audio/webm` col
codec Opus, e con cinque liste che non concordano non si sa nemmeno in quale metterlo.

---

## Q8 — Il quaderno va nel Cestino, non nel nulla ✅ *FATTO (24 ago 2026 — il racconto è in `PIANO-ZAINO.md` §Z14)*

**L'asimmetria, misurata.**

| cosa cancelli | che cosa succede | dove |
|---|---|---|
| un PDF | **Cestino di sistema** | `shell.trashItem` iniettato in `main.js` |
| un video/audio | **Cestino di sistema** | idem |
| uno zaino intero | **Cestino di sistema** | idem |
| **un appunto** | **cancellato davvero** | `fs.unlinkSync` in `lib/appunti.js` |
| **una mappa** | **cancellata davvero** | `lib/mappe.js` |
| **un ritaglio / una foto** | **cancellato davvero** | `lib/album.js` |

**È rovesciata rispetto al valore.** Un PDF cancellato è ancora nella mail del professore. Un
appunto no: è l'unica cosa nello zaino che esiste soltanto lì, perché l'ha scritta l'utente una
volta, e non c'è una seconda copia da nessuna parte.

E i messaggi sono coerenti col difetto: il PDF dice «va nel Cestino di sistema… reimportandolo si
riaggancia»; l'appunto dice **«L'operazione non è reversibile»**; la mappa **«non si può
annullare»**.

**Il lavoro.** ⚠️ Il pattern esiste già, tre volte: `lib/` **non conosce Electron** (è una regola
del progetto), quindi il main **inietta** la funzione — `{ cestina: (p) => shell.trashItem(p) }`.
Le tre cancellazioni «buone» sono scritte tutte così. Portare `appunti.remove`, `mappe.rimuovi` e
`album.rimuovi` sullo stesso pattern **copia una riga da un fratello maggiore**, non inventa niente.

E i due messaggi diventano quelli veri: «è nel Cestino» invece di «non è reversibile».

⚠️ Il solo punto delicato: cancellando un appunto si ferma anche il salvataggio automatico in canna
(`clearTimeout`). Quel gesto resta identico — si sta togliendo il bersaglio, e non si vuole che il
salvataggio lo riscriva mezzo secondo dopo.

---

## Q9 — Le sottolineature del tutor arrivano come lettura · M

**È il lavoro più importante dei nove**, e quello con il vincolo più stretto.

**Il gesto.** Il tutor e lo studente lavorano sulla stessa dispensa. Il tutor legge a casa e
sottolinea trenta passaggi — le date in verde, le parole difficili in giallo, i tre concetti da
sapere per forza in rosso. Poi manda allo studente **un file solo**. Lo studente lo trascina sul suo
zaino, e compare: **«Lettura di Giulia — 30 segni su 03 Leopardi»**.

Da lì lo studente ha un interruttore, **quello degli strati che esiste già**: solo le mie · solo
quelle di Giulia · tutte e due · nessuna.

Il tutor, dall'altro lato, non ha preparato niente: ha **letto sottolineando**, che è il suo
mestiere.

**Perché nessuna delle sei prospettive l'aveva vista.** Guardavano tutte **una persona sola davanti
allo schermo**. Nessuna guardava **due persone sullo stesso materiale** — che è il contesto d'uso
originario di StudIA, la formazione tutor DSA/BES.

### ⚠️ IL VINCOLO, dichiarato dall'utente e non negoziabile

> **Questa funzione deve AGGIUNGERE uno strato agli appunti dello studente, e non sovrascrivere
> eventuali strati creati prima da lui.**

Non è un dettaglio implementativo: è la condizione perché la funzione sia usabile. Uno studente che
importa la lettura del tutor e si ritrova senza le proprie sottolineature ha perso settimane di
lavoro, e le ha perse **in silenzio** — l'invariante 4 nella sua forma peggiore.

**La buona notizia: il meccanismo per farlo bene ESISTE GIÀ**, ed è documentato nel codice.

`lib/evidenze.js` → `salva(vaultPath, courseId, elenco, strati)` porta questa nota:

> ⚠️ IL REGISTRO SI CONSERVA, e la difesa sta QUI perché qui passano tutte. `aggiungi`, `rimuovi`,
> `colora` e `tratta` scrivono l'elenco da questa funzione: se il registro delle letture non venisse
> riletto, il primo cambio di colore lo cancellerebbe — e con lui il nome di ogni strato, mentre le
> evidenze continuerebbero a citarne l'id. **Chi VUOLE cambiarlo lo passa; chi non lo nomina se lo
> ritrova intatto.**

Quindi la regola dell'importazione è:

1. **leggere** quello che c'è (`leggi` restituisce `{ evidenze, strati }`);
2. **creare** lo strato nuovo con un id che non collide, e **aggiungerlo** al registro letto;
3. **aggiungere** le evidenze importate a quelle che c'erano;
4. chiamare `salva` **con l'unione** — mai con i soli importati.

⚠️ **Una prova che vale il lavoro**: un vault con due strati dello studente più il suo strato base,
si importa una lettura, e dopo l'importazione **ci sono tutti e tre più il nuovo**, con le evidenze
di ciascuno intatte. Scrivila **prima** del codice, e falla diventare rossa su un'implementazione
che passa solo gli importati: è il modo di sapere che difende davvero.

### Perché due persone possono segnare le stesse parole

⚠️ **Lo strato entra nell'identità dell'evidenza** — il seme è
`materiale + pagina + prefix + exact + suffix` **+ `strato`, e solo se lo strato non è vuoto**.

È esattamente ciò che rende la funzione possibile: le stesse identiche parole segnate da te e dal
tutor restano **due record distinti**, ognuno col suo colore, accendibili e spegnibili
separatamente. Senza quel campo nel seme si sovrascriverebbero a vicenda.

⚠️ E **lo strato «Base» non è un record**: è **l'assenza** di strato. Le evidenze fatte prima che
gli strati esistessero hanno `strato` vuoto, e quel vuoto *è* la base. Un'importazione che
«normalizzasse» tutto dandogli uno strato cambierebbe l'id di ogni evidenza esistente, e tutti i
`ev:` scritti negli appunti smetterebbero di ritrovarle. **Non toccare le evidenze che ci sono.**

### Le altre tre difficoltà (sono la ragione della M)

1. **A che documento si agganciano.** Un'evidenza dice `materiale: "03 Leopardi.pdf"`, ma nello
   zaino dello studente lo stesso PDF può chiamarsi `01 Leopardi.pdf`. Il gancio giusto **non è il
   nome: è l'IMPRONTA** (`sha1`), che il progetto già calcola — è la stessa regola con cui un
   documento cestinato e ritrascinato riprende il suo numero (le «lapidi» in
   `MATERIALI/_rimossi.json`, vedi `lib/fonti.js`). ⚠️ E c'è un caso già documentato: un PDF passato
   dall'OCR ha un'impronta diversa dall'originale, e l'indice conserva `improntaOriginale` proprio
   per questo. Guardarle tutte e due.
   Se l'impronta non combacia, **non si aggancia niente e lo si dice**.

2. **Che cosa succede se la frase non si ritrova.** Il tutor ha il PDF originale, lo studente la
   copia riconosciuta con l'OCR: il testo è leggermente diverso. L'ancoraggio
   `prefix/exact/suffix` (`App/assets/evidenze/ancoraggio.js`) è nato apposta e regge quasi sempre —
   **ma non sempre**. Serve il **rapporto delle non ritrovate**: «28 segni su 30; 2 non li ho
   trovati, eccoli». Un'importazione che perde due segni in silenzio è l'invariante 4 violato.

3. **Lo stato di visibilità oggi non viaggia.** Quali letture sono accese vive nel `localStorage`
   di quella macchina, non nel vault, e `App/assets/evidenze/strati.js` lo **dichiara**: *«se un
   giorno dovrà viaggiare col vault, è questo il file da cui si parte»*. La lettura importata deve
   nascere **accesa**, o lo studente non vede niente e crede che l'importazione non abbia
   funzionato.

⚠️ **Il canale.** Trascinare un `_evidenze.json` è la strada corta; l'alternativa è appoggiarsi a
`lib/pacchetto.js`, che sa già fare pacchetti (`comandoEsporta`, `esamina`) e che una voce del
catalogo — «Lo zaino passa di mano» — userebbe per esportare uno zaino intero. **Scegliere prima**,
e dichiararlo: sono due lavori diversi, e il secondo è più grande.

---

## 2. Che cosa questo pacchetto NON fa

Scritti per primi, perché il modo più facile di far fallire un lavoro è allargarlo.

- **Nessuna chiamata al modello dentro lo zaino** (`PIANO-ZAINO.md` §6, decisione 5). Nessuno dei
  nove ne ha bisogno.
- **Nessuna seconda grammatica dei rimandi.** Q3 e Q4 riusano `rimandi/sintassi.js`; se ti serve un
  campo nuovo per far funzionare un rimando, ti sei perso (invariante 7).
- **Nessun secondo motore di ancoraggio**, né di evidenziazione, né di ricerca. Q2 usa la selezione
  di CodeMirror, Q5 usa `RicercaIndice`, Q9 usa `EvidenzeAncoraggio`.
- **La postilla non diventa un secondo quaderno**: una riga, e il limite si fa rispettare.
- **Niente riscrittura della catena degli `Escape`**: sono 18 gestori il cui ordine è pagato, con un
  guasto vero scritto accanto a ciascuno.
- Possibili seguiti, fuori: «Lo spoglio» (l'elenco di tutte le evidenze di un documento), «Con
  parole tue» (il riquadro Definizione che nasce vuoto da un chip), «Lo zaino passa di mano».

---

## 3. Le trappole già pagate, che valgono per tutti e nove

Distillate dalla sessione del 23 agosto. Ognuna è costata almeno una volta.

**⚠️ Una prova che dice il contrario si RISCRIVE con la promessa, non si aggira.** In un giorno solo
è successo quattro volte. E in un caso il controllo si **chiamava** «e la mappa non è stata
trascinata via con lui» e **affermava** che la mappa fosse chiusa: passava proprio grazie al difetto.
Quando cambi una promessa, `grep` in **tutte** le prove — non solo in quella che ti sembra la sua.

**⚠️ La suite INTERA al cancelletto, non solo le prove che tocchi.** Due dei difetti peggiori della
sessione erano **verdi lanciati da soli** e rossi solo nella suite: dipendevano da che cosa avevano
lasciato le prove precedenti.

**⚠️ Un rosso «a corse alterne» si fa PARLARE, non si rilancia.** Il metodo: catturare l'output
intero della prova, leggere le sue diagnostiche, e confrontare *come si deve* — stesso codice,
stessa suite, stessa base. Due volte in un giorno il rosso era della **prova**, non dell'app: un
bersaglio a due parole in cui il doppio click cadeva sullo spazio, e una riga cercata dove lo
scorrimento del momento la metteva.

**⚠️ Fermare la propagazione è un ATTO, e si paga solo se si è consumato il tasto.** Un gestore in
cattura su `window` che chiamava `stopPropagation()` *prima* di decidere si è messo a ingoiare
l'Esc senza usarlo, e con lui è sparito l'Esc di mezza app.

**⚠️ Il righello prima del codice.** Due misure sbagliate hanno quasi fatto correggere il codice
giusto: contare i `top` dei figli di una barra `align-items:center` (che sono diversi *sulla stessa
riga*), e misurare un testo con `getComputedStyle().font` (che per la shorthand torna vuota, e
misurava a 16px invece che a 11). **Se una misura contraddice un esperimento minimo identico,
sospetta la misura.**

**⚠️ Le virgolette inverse dentro un comando di shell fra doppi apici vengono ESEGUITE.** Tre volte
in un giorno, due delle quali in un messaggio di commit che è finito corrotto. La forma sicura è
l'**heredoc quotato** (`<<'EOF'`). La cugina è già catalogata per i commenti dentro un template
literal.

**⚠️ Un `replace` che non trova niente NON fallisce**: riscrive il file identico e dichiara di aver
funzionato. Ogni sostituzione automatica va con il suo `assert`.

**⚠️ Una prova nuova va DENTRO i due registri**, e il conto **si conta, non si ricorda**: `PROVE=(`
in `test/cdp/con-vault-di-prova.sh` e la catena di `npm test` in `package.json`.

**⚠️ Prima di aprire Electron, leggi `GUIDA-ARCHITETTO.md` §6.1**: la porta di debug è a esemplare
unico, e il client CDP finisce a pilotare l'app sbagliata. **Non si chiude mai un processo per
nome** (`pkill -f Electron` prende ogni Electron della macchina, comprese le app dell'utente).

**⚠️ Un lavoro laterale a un agente va in un worktree ISOLATO** — obbligatorio se tocca
`App/StudIA.html` — e all'agente si **vieta la suite CDP**. Il suo rapporto non si prende per
buono: si verificano a mano le due o tre affermazioni che contano. Nella sessione precedente un
agente aveva misurato una larghezza in un banco di prova fuori dall'app, e il numero era sbagliato
del 38%.

---

## 4. Come si verifica

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                                   # 45 file, exit 0
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh         # le 56 prove sull'app viva
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh prova-note.js   # una sola
```

⚠️ Il `cd` fa parte del comando: la cartella di lavoro delle chat è `StudIA/` (quella **di fuori**),
e da lì `./test/cdp/…` non esiste.

**E se il lavoro sta su un ramo**, il comando per provarlo a mano si dà **sempre**, in un blocco a
sé — è una regola dichiarata dall'utente:

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA" && git checkout <ramo> && npm start
```

**Le prove da guardare per prime**, perché sono quelle che questo pacchetto tocca:
`test/evidenze.js` · `test/evidenze-appunti.js` · `test/strati.js` · `test/ricerca.js` ·
`test/note.js` · `test/appunti-md.js` · `test/media.js` · `test/player.js`, e sull'app viva
`prova-note.js` · `prova-keyword.js` · `prova-evidenze-pdf.js` · `prova-evidenziatore.js` ·
`prova-strati.js` · `prova-evidenza-appunto.js` · `prova-selezione-menu.js` · `prova-mappe-ui.js`.

---

## 5. Un ordine di esecuzione suggerito

Non è vincolante, ma segue il criterio del pacchetto precedente: **prima si toglie danno con diff
minime, poi si aggiunge superficie**. Così, se il lavoro si ferma a metà, ciò che è entrato è già
utile.

0. ~~**Q2** (la lente al punto esatto)~~ — ✅ **fatto il 24 agosto**, tutti e quattro i pezzi;
1. ~~**Q8** (il Cestino)~~ — ✅ **fatto il 24 agosto** (`PIANO-ZAINO.md` §Z14): il rischio più
   grave del pacchetto è tolto;
2. ~~**Q7** (le liste audio)~~ — ✅ **fatto il 24 agosto** (`PIANO-ZAINO.md` §Z15): le copie erano
   sette, non cinque, e la promessa è chiusa da tutti e due i lati;
3. ~~**Q3** (il pallino)~~ — ✅ **fatto il 24 agosto** (`PIANO-ZAINO.md` §Z16): la mano sulla barra
   della selezione è già stata fatta, e serve a Q6;
4. ~~**Q6** (la postilla)~~ — ✅ **fatto il 26 agosto** (`PIANO-ZAINO.md` §Z17), con le due reti
   sotto gli appunti che sono nate lo stesso giorno da un guasto vero;
5. ~~**Q1** (il quaderno si riapre alla riga)~~ — ✅ **fatto il 26 agosto** (`PIANO-ZAINO.md` §Z19);
6. ~~**Q5** (la lente vede mappe e didascalie)~~ — ✅ **fatto il 26 agosto** (`PIANO-ZAINO.md` §Z20);
7. ~~**Q4** (sbirciare)~~ — ✅ **fatto il 26 agosto** (`PIANO-ZAINO.md` §Z21), e l'ordine ha pagato:
   la bolla mostra il rimando che Q3 crea e la postilla che Q6 scrive;
8. **Q9** (la lettura del tutor) — l'altro **M**, e l'ultimo: è quello con il vincolo più stretto,
   e merita di trovare `_evidenze.json` già assestato.

⚠️ **Q4 e Q9 meritano ciascuno il suo piano** prima di essere scritti: usa `/architetto` con il
braindump della voce, che leggerà la guida e passerà il piano contro gli invarianti uno per uno.

---

## 6. Le decisioni da prendere prima di cominciare

Sono i bivi veri: due letture producono lavori materialmente diversi. Vanno chiesti all'utente, non
indovinati.

1. ~~**Q1** — la riga dell'appunto viaggia col vault o resta di questa macchina?~~ ✅ **deciso il
   26 agosto: viaggia col vault**, in `APPUNTI/_riga.json` (§Z19).
2. **Q9** — il canale è un `_evidenze.json` trascinato, oppure un pacchetto vero costruito con
   `lib/pacchetto.js`?
3. **Q9** — quando l'impronta del documento non combacia: si rifiuta tutto, o si importa lo stesso
   lasciando i segni orfani (che è quello che già succede a un documento tolto dallo zaino)?
4. ~~**Q5** — dove vanno i gruppi MAPPE e RITAGLI nell'ordine dei risultati?~~ ✅ **deciso il 26
   agosto: appunti → mappe → ritagli → ciò che si è letto** (§Z20).

Tutto il resto si decide e **si dichiara nel piano**: un piano pieno di domande è una ricognizione
pigra, uno senza nessuna decisione dichiarata è stato scritto senza pensare.
