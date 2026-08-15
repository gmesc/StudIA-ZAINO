# Handoff definitivo — 15 agosto 2026

> **A chi arriva adesso: questo file basta per ripartire.** Sostituisce
> [HANDOFF-DEFINITIVO-2026-08-14b.md](HANDOFF-DEFINITIVO-2026-08-14b.md), che resta valido per ciò
> che non ripete (lo zoom della fonte, le forbici con ⌘) — e soprattutto resta valido il **§4 del
> [14 agosto](HANDOFF-DEFINITIVO-2026-08-14.md): le quattro cose che contano prima del beta**, di
> cui la prima è ancora il pacchetto (`dist/` ferma al 23 luglio).
>
> Qui c'è una sessione sola, il ramo `menu-impostazioni`, unito in `main` a fine giornata:
> **crediti e licenze ricavati dal disco, il token dei bottoni esteso a tutti i modali e
> all'onboarding, e l'Atlante delle opzioni del profilo.**
>
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato, col rimedio accanto.

---

## 1. Dove sono i lavori

| ramo | commit | suite |
|---|---|---|
| `main` | punta di `menu-impostazioni` (fast-forward del 15 sera) | ✅ **31** file di unità · **40** prove CDP |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                              # 31 file, exit 0
STUDIA_PORTA=9334 ./test/cdp/con-vault-di-prova.sh    # 40 prove sull'app viva
```

Le quattro condizioni del §7.2 della guida erano tutte vere al merge: suite verdi sulla punta,
gesti provati a mano da Giacomo (crediti, token, «?», Atlante — «sono tutti funzionanti»),
questo handoff scritto, `main` ferma (fast-forward: il codice unito è quello su cui sono girate
le suite, niente da rieseguire).

---

## 2. Crediti e licenze: ricavati, non ricopiati

La schermata (⚙ › 🧙) elencava 15 progetti; l'app ne spedisce **96**. Un'attribuzione promessa e
non mantenuta è peggio di nessuna: adesso l'inventario si **ricava**.

- `lib/crediti.js` legge `node_modules` (nome, versione, licenza, copyright, **testo integrale**)
  e lo unisce a `App/assets/dati/crediti-extra.json`: piattaforma (Electron/Chromium/Node/ffmpeg
  **LGPL**), vendorizzate, modelli e dati, strumenti Python, servizi remoti. `npm run crediti`
  rigenera `crediti.json` (477 KB, committato); `test/crediti.js` **fallisce se resta indietro**
  rispetto ai pacchetti installati.
- I testi in `App/assets/licenze/` sono i file **originali** dei progetti; per i 3 pacchetti npm
  senza file di licenza c'è il testo canonico MIT, **dichiarato come tale** nella voce.
- Gli **obblighi** stanno sopra l'elenco: attribuzione, NOTICE Apache, CC BY-SA di OpenMoji,
  LGPL di ffmpeg (libreria separata e sostituibile), l'elenco Chromium (14 MB, spedito via
  `build.extraResources` e apribile dalla schermata), i dati che escono verso i fornitori AI, e
  la nota che non è una consulenza legale. Esportazione **NOTICE.txt** completa.
- **L'icona dell'app è un'opera derivata**: emoji «graduation cap» (1F393) di OpenMoji, quindi
  l'icona è **CC BY-SA 4.0, non MIT** — voce e obbligo dedicati. Quando esisterà l'`.icns`,
  in `build.mac` manca ancora il campo `icon`.
- ⚠️ Il `.dmg` **non conteneva nessun file di licenza**: buco chiuso solo per le build future.

## 3. Il token dei bottoni copre tutta l'app

Cinque giri sullo stesso invariante (8): Impostazioni, testate dei modali, piede del modale
Video, wizard/onboarding/composer, e il «?» dei campi liberi.

- **`.tbar-ctl`**: variante di scala come `.tbar-lg`, ma verso il basso — ridichiara i token a
  `--ctl-h` (40px, corpo 12px). La usano `.set-body`, `.media-head/.guida-head/.media-foot`,
  `.wz-head/.wz-foot/.pa-foot/.ps-row` e la card del benvenuto.
- **`.tbtn.acc`** = «questo comando SCRIVE» (teal, lo stesso dell'`aria-pressed`). Il blu di
  `.dashbtn` è morto: erano due accenti senza una regola.
- Morti anche: `.kr-save/.kr-clear` (regole), `.btn-sec/.btn-go`, `.setup-btn`, `.ps-skip`,
  `.wz-btn` e varianti — **19 regole CSS in meno**, zero misure a mano negli `style`.
- I piedi (Video, wizard, primo avvio) sono **la stessa barra girata**: linea sopra, non sotto.
- Le righe di comandi nelle Impostazioni sono **vassoi** (fondo `--hover`): un bottone nudo su
  `--panel` nudo sembrava un titoletto.
- Il **«?»** non è una scatoletta da 18px: è un rimando a nota — 10px, grassetto,
  `vertical-align:super`, blu. Il bersaglio del mouse resta 17×20 (rientro + margine negativo).
  Lo stato aperto sta in `aria-expanded`, messo da `openHelp` e tolto da `closePops`.
- Guardie: `prova-impostazioni-token.js` e `prova-onboarding-token.js` misurano **dai vivi**
  (altezza unica, corpo, maiuscole, elenco esatto degli accenti, zero dialetti superstiti), col
  metro costruito al momento — una `.tbar.tbar-ctl` vera, non un numero: l'altezza di una barra
  non è quella dei suoi bottoni.

## 4. L'Atlante delle opzioni — [⚙ › Utente]

Risponde a «se scelgo questa voce, che cosa cambia?», a schermo intero come il composer: una
riga per leva (16), una card per variante (45).

- **La direttiva non è scritta da nessuna parte**: la compone il main chiedendola a
  `profilo.directives()` via `profilo:atlante` — la stessa funzione che riempie i prompt.
  Catalogo leve in `App/assets/dati/leve.js` (UMD); è una seconda copia dei `<select>` e
  `test/atlante.js` la tiene onesta.
- **La fase si deduce, non si dichiara**: il cartellino «cambia l'indice / cambia il testo»
  viene da dove `directives()` mette le righe. Misurato: 6 leve toccano la proposta; il testo
  libero del profilo entra **solo** in generazione (prova col canarino).
- **Gli esempi sono sintetici e dichiarati tali** (scelta di Giacomo dopo il giro licenze: AI
  Fluency è CC BY-**NC**-SA — l'NC non ha soglie di fatturato e Giacomo fa formazione a
  pagamento; *Teach AI Literacy* ha dichiarazioni contraddittorie; restano pulite CJESS e
  AILF_en OCSE, entrambe **CC BY 4.0**, per un eventuale seguito con esempi generati dalla
  pipeline vera). Brano inventato (batteria a ioni di litio), un solo brano per tutte le celle:
  se ognuna partisse da un testo suo, la differenza vista sarebbe il materiale, non la leva.
- Il **«?» dei campi liberi è stato riscritto**: era il difetto da cui è nato tutto — suggeriva
  frasi che i menu già coprono, quindi direttiva doppia al modello e l'illusione di toccare la
  scaletta. Ora gli esempi «utili» mostrano solo ciò che nessun menu dice; le frasi-menu stanno
  fra i «Da evitare» col menu giusto accanto; il piede apre l'Atlante (stessa funzione del
  bottone in Impostazioni). `test/atlante.js` vieta il ritorno delle frasi-menu con parole-spia.

## 5. ⚠️ Le trappole pagate qui

1. **Le quattro prove CDP nuove non erano in `PROVE=(`** del runner: le corse complete dicevano
   «verdi» senza averle eseguite. È la trappola già scritta in guida, pagata di nuovo. Messe in
   coda hanno trovato tre guasti veri — il che è il punto della trappola.
2. **Le prove ereditano lo schermo dell'ultima**: un modale rimasto aperto copre la topbar e il
   click su ⚙ finisce sul suo fondo. Rimedio: `schermoPulito()` in testa alle prove dei modali
   (accanto a `partiPulito`, che pulisce altro).
3. **L'Esc delle mappe (window, cattura, ~15378) mangiava l'Esc dell'atlante** quando una mappa
   era rimasta nel banco — lasciava passare solo crediti e guida. Difetto dell'app, non della
   prova: l'atlante è entrato nella sua lista. Regola: un gestore in cattura che «chiude il suo
   strato» deve conoscere **tutti** gli strati che gli stanno sopra.
4. **Un elemento `hidden` non ha geometria**: misurarlo dà 0×0 e la prova accusa il CSS di una
   colpa sua. Prima di misurare: la scheda giusta, `data-media='1'` per il modale Video, e
   scroll dentro i riquadri che scorrono (la prima sonda del bottone del «?» cliccava fuori).
5. **`ok:`/`no:` del blocco HELP passano per `escHtml`**: le entità HTML scritte nel JS restano
   letterali a schermo. Caratteri UTF-8 diretti.
6. **Aspettative che invecchiano**: «openmoji» nei crediti trova 2 voci dal commit dell'icona,
   e «glossario» nell'atlante trova anche lettura-lenta (la sua direttiva contiene la parola).
   Quando una ricerca trova «troppo», prima di accusare il filtro: contare che cosa contiene
   davvero il testo cercato.

## 6. Che cosa resta aperto

Invariato dal [14 §5](HANDOFF-DEFINITIVO-2026-08-14b.md) (motore invisibile sulle mappe, M4–M9,
pillole delle Lenti), più:

- **Il beta**: il §4 del 14 agosto è ancora la lista che conta — pacchetto, primo avvio
  vergine, canale dei difetti, giro su un vault altrui. **Niente di questa sessione lo tocca.**
- L'`.icns` dell'icona (e il campo `icon` in `build.mac`).
- Esempi dell'Atlante generati dalla pipeline vera, se si vorrà: fonte pulita = CJESS o AILF_en
  (CC BY 4.0, per AILF_en serve la formula di adattamento OCSE); la mail a Judy Robertson può
  sbloccare *Teach AI Literacy*.
- v2 dell'Atlante: costruire i `<select>` dal catalogo, e far sparire la seconda copia con la
  sua prova.

## 7. Come si lavora qui

[GUIDA-ARCHITETTO.md](GUIDA-ARCHITETTO.md) è la fonte. Le tre di ogni sessione: ramo per ogni
lavoro, prove che misurano + gesti a mano, handoff datato che rimpiazza questo.
