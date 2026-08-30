# La scheda per il Mac App Store

> Materiale pronto da incollare in App Store Connect, e **una decisione da prendere prima**.
> I limiti di caratteri di ogni campo sono verificati (contati, non ricordati): il conto è in coda
> a ogni testo.

---

## 0. ⚠️ Prima dei testi: StudIA oggi NON è pubblicabile così com'è

Il Mac App Store impone la **App Sandbox**. Non è un'opzione da spuntare: è un recinto che vieta
alcune cose su cui StudIA è costruita.

| che cosa fa StudIA | dentro la sandbox |
|---|---|
| lancia **Python** di sistema per l'ingest, la trascrizione (`faster-whisper`/`mlx-whisper`) e l'OCR (`ingest.py`, `index_videos.py`, `ocr.py`) | ❌ vietato: si possono eseguire solo binari inclusi nel bundle e firmati, e comunque ereditano il recinto |
| lancia `zip`/`ditto` per esportare un pacchetto | ❌ stessa ragione |
| tiene il vault in una **cartella scelta dall'utente**, fuori dall'app | ⚠️ possibile, ma solo con *security-scoped bookmark*: la cartella va riselezionata e memorizzata con l'API apposta, non con un percorso salvato in un JSON |
| chiavi API dell'utente verso Anthropic / OpenAI / Google | ✅ ammesso (l'utente porta le sue), ma va **dichiarato** nelle note per la revisione |
| lettura, appunti, mappe, evidenze, ripasso, OCR con `tesseract.js` | ✅ tutto JavaScript/WASM: nessun problema |

**Le tre strade, e la prima è quella che stai già percorrendo:**

1. **Distribuzione diretta, notarizzata** (`npm run notarizza`). Zero limiti, zero recinto, nessuna
   revisione, nessun 30%: il dmg si apre con un doppio click. È la strada giusta per un'app che
   *deve* lanciare Python e leggere una cartella dell'utente.
2. **Una versione «lettore» sul Mac App Store**: niente pipeline: si aprono corsi già generati, si
   legge, si prende appunti, si ripassa. Il vault si sceglie con la finestra di sistema e si
   ricorda con un bookmark. La generazione resta all'app completa o alla CLI. È lavoro vero —
   sandbox, bookmark, un secondo target `mas` in `electron-builder`, certificati «Apple
   Distribution» e «3rd Party Mac Developer Installer», un provisioning profile — ma è fattibile.
3. **Riscrivere l'ingest senza processi esterni** (whisper in WASM, PDF in JS). Mesi di lavoro per
   un risultato più lento: fuori discussione oggi.

⚠️ **Se la scelta è la 2**, tutto quello che segue vale per la *versione lettore*, e la descrizione
non deve promettere la trascrizione: una scheda che promette ciò che l'app in Store non fa viene
respinta in revisione — e, peggio, delude chi l'ha scaricata.

---

## 1. I campi della scheda

### Nome (max 30)

```
StudIA
```
6 caratteri.

### Sottotitolo (max 30)

```
Studia dai tuoi materiali
```
25 caratteri.

### Testo promozionale (max 170) — si può cambiare senza una nuova revisione

```
I tuoi PDF e le tue lezioni diventano un corso da studiare: capitoli, mappe, evidenze, appunti, ripasso. Tutto resta in una cartella tua, leggibile anche senza l'app.
```
165 caratteri, contati — e il limite è 170: un testo che arriva al pelo si spezza al primo ritocco.

### Descrizione (max 4000)

```
StudIA trasforma i materiali che hai già — dispense, PDF, videolezioni, fotografie di appunti — in
un percorso di studio ordinato, e ti dà gli strumenti per lavorarci sopra.

IL BANCO
Lo spazio di lavoro si divide in blocchi che scegli tu: il documento a sinistra, gli appunti a
destra, una mappa sotto. Due documenti affiancati per confrontarli. La disposizione si ricorda, ed
è diversa per ogni corso.

LEGGERE
Un lettore di PDF con evidenziatore a più letture sovrapposte, righello per la riga, lettura ad
alta voce, zoom che segue il riquadro e un segno che ti riporta dove eri rimasto — anche su un
altro computer, perché vive nella cartella e non nel browser.

SCRIVERE
Appunti in Markdown, con anteprima affiancata in cui si scrive: clicchi un paragrafo e quello torna
testo, modifichi solo quello. Le citazioni ai documenti sono indirizzi veri: un clic riapre la
pagina esatta da cui viene la frase.

MAPPE
Mappe concettuali disegnate a mano o seminate da ciò che stai leggendo, con quattro motori di
disposizione, colori per ramo e verbi sugli archi.

RIPASSO
Quello che evidenzi e scrivi diventa materiale di ripasso programmato, senza doverlo ricopiare.

RICERCA
Una lente sola per tutto: capitoli, pagine dei documenti, appunti, nodi delle mappe, didascalie dei
ritagli. Ti porta al punto, non alla pagina.

I TUOI DATI RESTANO TUOI
Niente account, niente cloud, niente database. Tutto sta in una cartella che scegli: file Markdown
e JSON leggibili anche con altre app, oggi e fra dieci anni. StudIA è un'interfaccia sul disco, non
il contrario.

FUNZIONI DI INTELLIGENZA ARTIFICIALE
Le funzioni che generano contenuti usano i servizi di Anthropic, OpenAI o Google, e richiedono una
chiave API tua: la inserisci nelle impostazioni, resta sul tuo computer e paghi solo il consumo al
fornitore che hai scelto. Tutto il resto dell'app — lettura, appunti, mappe, evidenze, ripasso,
ricerca — funziona senza rete e senza chiavi.
```
1 935 caratteri, contati (il limite è 4000: c'è spazio per crescere).

⚠️ **Se pubblichi la versione «lettore» (strada 2)**, togli il paragrafo sulla generazione o
riscrivilo: là dentro la pipeline non c'è.

### Parole chiave (max 100, separate da virgole, senza spazi dopo la virgola)

```
studio,appunti,PDF,mappe concettuali,ripasso,evidenziatore,markdown,DSA,università,dislessia
```
92 caratteri, contati.

⚠️ Non ripetere parole già nel nome o nel sottotitolo: Apple le indicizza comunque, e sprecarle
qui toglie posto ad altre.

### Categoria

- **Primaria**: Istruzione (`public.app-category.education`, già dichiarata in `package.json`)
- **Secondaria**: Produttività

### Classificazione per età

**4+**. Nessun contenuto sensibile. ⚠️ Se l'app permette di inserire una chiave API verso un
servizio di IA generativa che può produrre testo libero, il questionario di App Store Connect
chiede se ci sono «contenuti generati dagli utenti o da terzi non filtrati»: rispondi con onestà —
l'esito resta di norma 4+ o 12+, e mentire qui è il modo più veloce per farsi rimuovere dopo.

### Copyright

```
© 2026 Giacomo Meschini
```

### URL

| campo | obbligatorio | valore |
|---|---|---|
| Assistenza | ✅ sì | *(da decidere: una pagina su `insegnai.ch` che dica come contattarti — `giacomo@insegnai.ch` — e come si comincia)* |
| Informativa sulla privacy | ✅ sì | *(da scrivere: vedi §2)* |
| Marketing | no | facoltativo |

---

## 2. Privacy: che cosa dichiarare

Nel questionario «Privacy dell'app» la risposta onesta per StudIA è **«Non vengono raccolti
dati»**: l'app non ha account, non ha analytics, non manda niente a nessun server tuo.

⚠️ Con un'eccezione da dichiarare nell'informativa, anche se non è raccolta *tua*: quando l'utente
usa le funzioni di generazione, **il testo dei suoi materiali viene inviato al fornitore che ha
scelto** (Anthropic, OpenAI o Google) con la sua chiave. L'informativa deve dire: quali servizi,
che è l'utente a sceglierli e a pagarli, che la chiave resta sul suo computer, e dove trovare le
privacy policy dei tre fornitori.

Testo minimo per l'informativa, da mettere online:

> StudIA non raccoglie, non trasmette e non conserva alcun dato personale. Tutto ciò che scrivi —
> corsi, appunti, mappe, evidenze — resta nella cartella che hai scelto sul tuo computer.
> Se attivi le funzioni di generazione, StudIA invia i materiali che indichi al servizio di
> intelligenza artificiale che hai configurato (Anthropic, OpenAI o Google), usando la chiave API
> che hai inserito e che resta memorizzata solo sul tuo computer. Il trattamento di quei dati è
> regolato dall'informativa del fornitore scelto. Nessun altro dato lascia il tuo computer.

---

## 3. Screenshot

Servono da 1 a 10 immagini, in **una** di queste misure (tutte accettate, purché coerenti fra loro):
1280×800 · 1440×900 · 2560×1600 · 2880×1800.

⚠️ **Si scattano dall'app vera, non si disegnano.** La macchina per farlo esiste già ed è quella
della guida: `App/guida-zaino/_lab/lab.js` pilota l'app via CDP e scatta a una misura dichiarata
(la campagna della guida usa 1470×956 @2x). Per lo Store conviene **2560×1600**, che è 1280×800 @2x:
si cambia la riga della vista in una campagna sua, e si usa il **vault di prova**, mai il tuo —
negli screenshot dello Store finirebbero i tuoi materiali veri.

I sei che raccontano l'app meglio, in quest'ordine:

1. **Il banco a due blocchi**: documento aperto a sinistra, appunti a destra.
2. **Un'evidenza appena fatta**, con la barra della selezione aperta.
3. **Una mappa concettuale** con qualche nodo e un arco etichettato.
4. **L'anteprima affiancata degli appunti**, con un blocco in scrittura.
5. **La lente** aperta sui quattro tipi di risultato.
6. **Il Confronto**: due documenti affiancati.

⚠️ Niente testo promozionale sopra le immagini se non è tradotto: una schermata in italiano su uno
Store inglese è una segnalazione in revisione.

---

## 4. Note per la revisione (il campo «App Review Information»)

Da scrivere in inglese. Bozza:

```
StudIA is an offline study app. All user data (courses, notes, mind maps, highlights) is stored in
a plain folder of Markdown and JSON files chosen by the user. There is no account, no server, and
no analytics.

AI features are optional and use the reviewer's or user's own API key for Anthropic, OpenAI or
Google. No key is bundled with the app. To review those features you can add any valid key in
Settings › API keys; every other feature (reading, notes, maps, highlights, review, search) works
with no network access and no key at all.

A sample vault with two short courses is included at: <link>
```

⚠️ **Il vault di esempio va preparato e messo online**: un revisore che apre l'app su una cartella
vuota vede una schermata che spiega come si comincia, prova due clic e passa oltre. Dagli qualcosa
da leggere.

---

## 5. Che cosa resta da decidere

1. **La strada**: distribuzione diretta (che funziona già) oppure una versione «lettore» per lo
   Store. Finché non è decisa, i testi qui sopra sono pronti ma non spedibili.
2. **Gratis o a pagamento**, e in quale forma. ⚠️ Se un giorno vendessi contenuti o abbonamenti
   *dentro* l'app dovresti passare dagli acquisti in-app; il modello «l'utente porta la sua chiave»
   che hai adesso non lo richiede.
3. **Le due pagine web obbligatorie**: assistenza e privacy. Senza URL raggiungibili la scheda non
   si invia.
4. **Le lingue**: la scheda in italiano basta per lo Store italiano. Per gli altri servono almeno
   nome, sottotitolo, descrizione e screenshot in inglese.
