# Handoff definitivo — 17 agosto 2026

> ⚠️ **SUPERATO** da [HANDOFF-DEFINITIVO-2026-08-18.md](HANDOFF-DEFINITIVO-2026-08-18.md), che è il
> punto di ripartenza. Questo resta la lettura di dettaglio sull'anteprima scrivibile, sulla guida
> dentro l'app e sui tre pacchetti del 17 agosto — e il §5 («committare») è **fatto**: quel lavoro è
> il commit `7d65d99`.

> **Al suo tempo era il punto di ripartenza.** Sostituiva
> [HANDOFF-DEFINITIVO-2026-08-16b.md](HANDOFF-DEFINITIVO-2026-08-16b.md), che resta la lettura di
> dettaglio sulla lente negli appunti, sulla rinomina di uno zaino e sui nomi dei tasti.
>
> **Come si costruisce qui** lo dice [GUIDA-ARCHITETTO.md](GUIDA-ARCHITETTO.md) — oggi con un
> capitolo nuovo, §6.1, che è la prima cosa da leggere se lanci prove CDP.
> **Regola di lettura**: dove c'è ⚠️ c'è un guasto già pagato, col rimedio accanto.

---

## 0. Da dove ripartire, in tre righe

**Il lavoro di oggi è tutto su `main`, tranne l'ultimo pezzo — l'anteprima scrivibile — che è
finito e provato ma NON committato.** Il primo gesto di una chat nuova è: leggere §5, lanciare le
due suite, e committare (il comando è lì). Poi si può ripartire dal §6, dove i lavori aperti sono
in ordine di maturità.

⚠️ **Prima di lanciare qualunque cosa che apra Electron**, leggi GUIDA-ARCHITETTO §6.1: due
istanze sulla stessa macchina si contendono la porta di debug, e il client CDP finisce a pilotare
l'app sbagliata. Oggi ci sono cascato io, e per venti minuti ho creduto che il codice non
funzionasse.

---

## 1. Dove sono i lavori

| | |
|---|---|
| ramo | `main`, e basta: i quattro rami del 16 agosto sono uniti e `git branch --no-merged main` è vuoto |
| remoto | `git@github.com:gmesc/StudIA.git` — allineato fino a `51859a4`; i due commit dopo (`529447d`, `6caecc8`) sono locali |
| oggi | otto commit (§2) più **undici file non committati** (§5) |
| suite | ✅ 37 file di unità · ✅ 45 prove CDP sull'app viva, verdi stamattina sul codice committato |
| pacchetti | i tre installer del 17 agosto sono in `dist/` (§4) |
| guida | vive dentro l'app: `App/guida-zaino/`, col suo laboratorio in `_lab/` |

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
npm test                                                   # 37 file, exit 0
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh         # le 45 prove sull'app viva
STUDIA_PORTA=9346 ./test/cdp/con-vault-di-prova.sh prova-note.js   # una sola
```

⚠️ Il `cd` fa parte del comando: la cartella di lavoro delle chat è `StudIA/` (quella di fuori), e
da lì `./test/cdp/…` non esiste. Il 17 agosto ho consegnato tre volte un comando che non partiva.

---

## 2. Che cosa è entrato oggi, e perché

Otto commit, in ordine di lettura più che di orario.

**`0cd9013` · La lente mette gli appunti per primi.** Cercando una parola che sta sia in un
documento sia in un appunto, l'appunto si infilava a metà classifica: e siccome l'elenco scrive
un'intestazione ogni volta che il gruppo cambia, spezzava in due il documento attorno a lui. Ora
ciò che l'utente ha SCRITTO viene prima di ciò che ha letto, e la regola sta nella prima chiave
dell'ordinamento di `cerca()` — non nel renderer, o l'ordine della tastiera (↑↓, Invio) e quello
dell'occhio sarebbero due.

**`dfc0e07` · «Riempi larghezza» arriva al bordo.** `pdf_viewer.mjs` toglie `SCROLLBAR_PADDING = 40`
dalla larghezza prima di calcolare la scala di `page-width`: in un riquadro da 465px la pagina era
424. `removePageBorders:true` è l'unico interruttore che lo azzera. ⚠️ Misurando è saltato fuori che
le 46 variabili di `pdf_viewer.scoped.css` **non arrivano mai** — `bin/pdfjs-css.js` annida i
blocchi `:root` sotto il guscio, e `#pdfPane #pdfPane` non corrisponde a niente. Non toccato: vedi §6.

**`68c6409` · L'anteprima su ⌘J, ⌘P torna a stampare.** ⌘P era la scorciatoia di fabbrica di
EasyMDE e rubava la stampa dentro l'editor.

**`172ab0f` · L'originale di una scansione tolta è un ritorno.** Dopo l'OCR il file nel contenitore
ha un layer in più e un'altra impronta: la lapide ne conosceva una sola, e l'originale ritrascinato
prendeva un numero nuovo — con evidenze e ritagli appesi a un numero senza documento. Ora la lapide
porta anche `improntaOriginale`.

**`4d7ccf9` · La guida vive dentro l'app.** `App/guida-zaino/` è la sorgente unica (pagina,
immagini, e `_lab/` con la ricetta e i materiali di prova); si apre dal bottone in Impostazioni ›
Zaino, in una finestra senza preload. Dentro: il capitolo nuovo «Come faccio a…», le misure delle
figure tokenizzate in quattro generi, i dialoghi finti con l'icona OpenMoji.

**`51859a4` · La prova del bottone della guida** — i tre anelli (ponte, bottone, file) controllati
separatamente, senza aprire la finestra durante la suite.

**`529447d` · GUIDA-ARCHITETTO §6.1: due Electron sulla stessa macchina.** Le tre regole, tutte
pagate: si chiude per PID o per porta di debug, mai per nome; la porta è a esemplare unico e il
guasto peggiore non è «occupata» ma il client che pilota l'app dell'altro progetto; due campagne
insieme si rubano il fuoco.

**`6caecc8` · Le virgolette, e la ricerca del documento che si vede.** `"per"` cerca la parola
intera in tutte e due le ricerche (`RicercaIndice.interpreta`, un posto solo). La barra della
ricerca nel documento adesso si apre quando la lente accende una parola, non si chiude più al click
fuori (si cambia lo zoom senza perderla), ha la ✕, e il 🔍 fa da interruttore.

---

## 3. Il pezzo che manca — l'anteprima scrivibile (fatto, non committato)

Ultimo lavoro della giornata, chiesto e verificato a schermo: **nell'affiancata ◫ si scrive anche
nella parte resa**, un blocco per volta.

- `renderNoteMd(md, {mappa:true})` avvolge ogni blocco in `<div class="mdb" data-da data-a>`: dice
  da quali righe del sorgente viene. È `display:contents`, cioè un appiglio senza una scatola —
  l'anteprima non cambia impaginazione.
- Cliccando un blocco, quello torna markdown in un campo; ⌘Invio chiude e tiene, Esc **annulla**,
  cliccare un altro blocco chiude salvando. Rimandi e immagini restano cliccabili.
- Si riscrivono SOLO le righe del blocco (`replaceRange` con le due coordinate).

⚠️ **Non si converte l'HTML in markdown, e non si deve.** Le notazioni di quest'app
(`[testo](pdf:01#p=3)`, `![](album:id)`, `> [!nota]`) non hanno un HTML ritraducibile senza perderle:
una conversione all'indietro riscriverebbe il file dell'utente in silenzio. Il markdown resta
l'unica verità; il pannello lo mostra o lo lascia scrivere, mai lo interpreta.

Nello stesso giro: **◫ non prende più la finestra** (`sideBySideFullscreen:false` — di fabbrica
EasyMDE chiamava anche `toggleFullScreen`, la sidebar spariva sotto e la maniglia restava
inchiodata), la barra dei riquadri ha l'icona 📜 al posto di ☰, e ⌘J adesso **spegne** l'anteprima
oltre ad accenderla (la scorciatoia sta nel keymap di CodeMirror, che in anteprima è nascosto: il
tasto non arrivava più a nessuno).

Restano da fare gli incrementi **2** (elenchi e riquadri modificabili riga per riga) e **3** (↹ al
blocco dopo, cursore dove hai cliccato).

---

## 4. I pacchetti del 17 agosto

| pacchetto | file | peso |
|---|---|---|
| macOS Apple Silicon | `dist/StudIA-1.0.0-arm64.dmg` | 185 MB |
| macOS Intel | `dist/StudIA-1.0.0-x64.dmg` | 231 MB |
| Windows 11 | `dist/StudIA-1.0.0-setup-x64.exe` | 163 MB |

Controprova fatta su tutti e tre: la guida è dentro (`index.html` + 101 immagini, 30 MB), `_lab/` è
fuori (8 MB di materiali di prova). Il dmg arm64 montato porta l'app firmata ad-hoc.

⚠️ Due build Mac di fila si inciampano in `hdiutil detach`: il volume del dmg precedente è ancora
attaccato e i due usano lo stesso nome. Si rilancia lo stesso comando. ⚠️ L'installer Windows **non
è ancora stato eseguito su Windows**: si è misurato che è un NSIS valido e completo, non che parta.

---

## 5. Prima di ripartire: committare

Undici file, un lavoro solo — l'anteprima scrivibile e i tre difetti chiusi insieme a lei.

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA"
git add -A && git commit -m "feat(appunti): si scrive dentro l'anteprima, un blocco per volta"
```

Poi le quattro condizioni del merge non servono (siamo già su `main`), ma le due suite sì: **il
codice non è mai girato tutto insieme dopo l'ultimo pezzo**. E `origin/main` è indietro di due
commit più questo.

---

## 6. Che cosa viene dopo, in ordine di maturità

1. **Gli incrementi 2 e 3 dell'anteprima scrivibile** (§3). Il più piccolo passo utile è il 3:
   mettere il cursore dove l'utente ha cliccato invece che in fondo al blocco.
2. **Le 46 variabili morte di `pdf_viewer.scoped.css`.** `bin/pdfjs-css.js` riscrive i blocchi
   `:root` in `:is(#pdfPane, #pdfPane2)` ma li lascia annidati dentro il guscio, e un
   `#pdfPane #pdfPane` non corrisponde a niente. Oggi il viewer funziona per i suoi ripieghi;
   rigenerando il CSS con una versione nuova di pdf.js quello che regge per caso può smettere.
   ⚠️ Rianimarle rimette bordi e margini che l'app non ha mai avuto: è un lavoro con le sue prove,
   non una riga.
3. **Tre prove CDP che non girano da sempre**: `prova-l1.js`, `prova-l2.js`, `prova-l3l4.js` sono
   nel repo ma fuori da `PROVE=(`, e non potrebbero nemmeno partire — chiedono un `cdp.js` dentro
   uno scratchpad temporaneo di una sessione di luglio, che non esiste più. O si riportano al
   `test/cdp/cdp.js` di casa e si mettono nell'elenco, o si tolgono: un file di prove che non gira
   è la stessa bugia di una prova verde che non prova niente.
4. **La rinomina di una fonte** (dal 16 agosto): si può, tenendo il numero, ma il nome del file è
   citato per esteso in sei posti — l'elenco è già quello di `fonti.usi()`.
5. **Notarizzazione** e **installer Windows provato su Windows**: PIANO-ONBOARDING.

---

## 7. Il laboratorio degli screenshot

`App/guida-zaino/_lab/` — `lab.js` pilota l'app viva via CDP (porta **9345**) e scatta;
`campagna.js` rifà tutte le immagini della guida in un giro, e i materiali di prova stanno lì
accanto in `materiali/`. Le immagini finiscono direttamente in `../img/`, cioè dentro la guida che
l'app spedisce: non c'è nessuna copia da fare dopo.

```bash
cd "/Users/giacomomeschini/Claude/StudIA/StudIA/App/guida-zaino/_lab"
GUIDA_VAULT=<vault di prova vuoto> node campagna.js > campagna.log
```

⚠️ Prima di scattare, controlla di parlare con l'istanza giusta (`pgrep -f
"remote-debugging-port=9345"` deve dare **una** riga) e che il codice caricato sia quello nuovo. Il
17 agosto due istanze mi hanno fatto fotografare per tre volte il comportamento vecchio.
