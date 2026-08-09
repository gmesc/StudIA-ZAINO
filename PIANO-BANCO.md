# Il banco — lo spazio di lavoro di StudIA

> 9 agosto 2026. Quarto documento della serie, dopo [PIANO-BRAYNR.md](PIANO-BRAYNR.md) (*che
> cosa*), [PIANO-MAPPE-MAPPAI.md](PIANO-MAPPE-MAPPAI.md) (*con quali motori*) e
> [PIANO-MAPPE-EDITOR.md](PIANO-MAPPE-EDITOR.md) (*come si usa la mappa*). Questo decide **dove
> stanno le cose sullo schermo**, ed è il documento che gli altri tre presupponevano senza dirlo.
>
> La metafora è quella vera dello studio: sul banco ci sono **la fonte** — quello che leggi, sia
> esso un capitolo, un PDF o un video — e **il quaderno**, cioè la roba tua: appunti, mappe,
> parole chiave, carte da ripassare. Il banco non decide che cosa studi: decide come ci stai
> davanti.

---

# 1. Perché oggi non si può fare

Tre vincoli, tutti strutturali, tutti misurati nel codice in esercizio.

**La mappa non sta accanto al capitolo: lo sostituisce.** `#mappaView` vive dentro `<main>` e la
regola `html[data-mappa="1"] main > article | .nav | footer { display:none }` nasconde il capitolo.
È un overlay sul contenuto, non un riquadro — quindi «leggo e intanto costruisco la mappa» oggi non
è una disposizione difficile: è impossibile.

**Il dock non è una colonna, è un pannello fisso.** `#dock{ position:fixed; right:0;
width:var(--pane-w) }` e la pagina gli fa spazio con un `padding-right`. Ospita due cose impilate —
anteprima sopra, editor appunti sotto — **cablate**: non c'è nessun posto in cui far comparire le
parole chiave o le flashcard senza aggiungere un terzo pannello fisso, e poi un quarto.

**La topbar è satura.** Tre menu (corso · variante · lezione) più sei comandi. È il traboccamento
che ha prodotto la trappola ⑦ dell'HANDOFF: l'altezza misurata una volta sola mentre la barra
andava a capo dopo, quando arrivavano i webfont e le tendine si riempivano.

E le misure dello spazio disponibile, che vincolano tutto il resto:

| finestra | sidebar | resta per la fonte + il quaderno |
|---|---|---|
| 1440 | 274px | 1166 → **583 per colonna** |
| 1920 | 290px | 1630 → **815 per colonna** |

Una mappa in 583px si guarda solo con «adatta»: la larghezza mediana misurata sulle 226 mappe di
TD74 era **2.884px**. Non è un difetto da correggere — è la ragione per cui il quaderno a tutta
larghezza non è un lusso, ma il modo normale di lavorare su una mappa.

---

# 2. Il modello: una griglia 2×2 in cui i blocchi si uniscono

Niente gestore di riquadri libero. Con un pubblico che fatica a orientarsi, la libertà totale è un
costo cognitivo travestito da regalo — e come progetto si mangerebbe tutto il resto. Ma nemmeno due
colonne fisse: leggere un PDF vuole **tutta la larghezza**, e il testo grande.

Quindi: una griglia di quattro celle — **A** e **C** sopra, **B** e **D** sotto — e un insieme
**chiuso** di forme, ognuna delle quali unisce le celle in modo diverso.

```
  1 blocco        2 affiancati      2 impilati       3 · sinistra intera
 ┌─────────┐     ┌────┬────┐       ┌─────────┐      ┌────┬────┐
 │         │     │    │    │       │    A    │      │    │ C  │
 │    A    │     │ A  │ C  │       ├─────────┤      │ A  ├────┤
 │         │     │    │    │       │    B    │      │    │ D  │
 └─────────┘     └────┴────┘       └─────────┘      └────┴────┘

 3 · destra intera   3 · sopra intera   3 · sotto intera    4 blocchi
 ┌────┬────┐        ┌─────────┐        ┌────┬────┐        ┌────┬────┐
 │ A  │    │        │    A    │        │ A  │ C  │        │ A  │ C  │
 ├────┤ C  │        ├────┬────┤        ├────┴────┤        ├────┼────┤
 │ B  │    │        │ B  │ D  │        │    B    │        │ B  │ D  │
 └────┴────┘        └────┴────┘        └─────────┘        └────┴────┘
```

Otto forme, e si dicono tutte con un `grid-template-areas`. Il PDF a tutta larghezza con gli
appunti sotto è **«3 · sopra intera»** con `A = PDF`; la mappa e le parole chiave a schermo pieno
sono **«2 affiancati»** con la fonte chiusa.

## 2.1 Tutta la geometria sta in due numeri

Qualunque sia la forma, i divisori sono due: **uno verticale** e **uno orizzontale**. Dove la forma
non li usa, semplicemente non compaiono. Quindi lo stato del banco è minuscolo, serializzabile e
raccontabile in una riga:

```json
{ "forma": "tre-sopra", "col": 0.5, "riga": 0.62,
  "blocchi": { "A": "pdf", "B": "appunti", "C": "mappa", "D": "keyword" } }
```

⚠️ Le frazioni si salvano come **frazioni**, non in pixel: il banco deve reggere il passaggio da un
portatile a un monitor esterno senza che il quaderno diventi una fessura. È lo stesso errore che
`--pane-w:42vw` evita già oggi, e va conservato.

## 2.2 Gli strumenti sono un registro, non un elenco di `if`

Ogni blocco ospita **uno strumento**, preso da un registro dichiarato in un punto solo:

| strumento | stato | famiglia |
|---|---|---|
| **Capitolo** | c'è | fonte |
| **PDF / Video** | c'è (`#pdfPane`) | fonte |
| **Appunti** | c'è (`#notePane`, EasyMDE) | quaderno |
| **Mappa** | c'è, ma oggi è un overlay: va portata dentro un blocco | quaderno |
| **Parole chiave** | **da costruire** — è P1.1 di PIANO-BRAYNR (le evidenze) | quaderno |
| **Flashcard** | **da costruire** — è P3 | quaderno |

⚠️ Due strumenti su sei non esistono ancora. Il registro va scritto **come registro dal primo
giorno**, con le due voci future dichiarate e spente: altrimenti alla terza si riscrive la griglia.
È la stessa lezione del menu delle varianti, che resta a schermo anche quando non ha niente da
mostrare.

**Regola:** uno strumento sta in **un blocco solo**. Sceglierlo in un secondo blocco lo sposta, non
lo duplica — come i personaggi sul tavolo del composer (regola 4 del §5 dell'HANDOFF).

## 2.3 Il quaderno non è un contenitore: è una famiglia

Il «quaderno personale» resta il nome giusto, ma non corrisponde a una colonna. Corrisponde alla
**riga che divide già il vault**: ciò che vive nelle cartelle dell'utente (`APPUNTI/`, `MAPPE/`,
domani `RIPASSO/` e le evidenze) contro ciò che è generato o importato. È una distinzione che il
disco fa già, quindi non va inventata né mantenuta a mano — e si può dire a schermo con un segno
piccolo sul bordo del blocco, senza scrivere una parola.

---

# 3. La fonte a schede

Dentro un blocco di famiglia «fonte», gli strumenti convivono **a linguette**:
`Capitolo · 03 dispensa.pdf · 05 lezione`. Cliccare un rimando in un capitolo o in un nodo di mappa
apre una scheda **invece di rubare metà schermo**.

Perché a schede e non due blocchi: nella stragrande maggioranza dei momenti la fonte affiancata
serve per un attimo — si guarda la pagina 7 e si torna. Chi ha davvero bisogno del capitolo *e* del
PDF insieme divide la colonna in due, ed è la forma «3 · destra intera».

⚠️ Oggi `openPdf`/`openVideo` aprono nel dock e ci scrivono dentro `ANTEPRIMA`. Il passaggio alle
schede non deve diventare una seconda strada per aprire una fonte: `openNote` resta l'unica porta,
cambia solo dove atterra.

---

# 4. La sidebar diventa «dove sei»

`Corso ▸ Lezione ▸ capitoli`, con l'indice numerato sotto (il vocabolario è quello di RINOMINA-GLOSSARIO.md) — cioè la gerarchia **si vede** invece di
essere ricostruita mentalmente da tre tendine affiancate. Dalla topbar escono i tre menu; restano
le cose globali (ricerca, tema, impostazioni) e **il selettore della forma del banco**.

Due guadagni oltre allo spazio: la barra smette di andare a capo — cioè sparisce la *causa* della
trappola ⑦ e non solo il suo sintomo — e il cambio di lezione torna a essere un gesto di
navigazione, dove uno se lo aspetta.

⚠️ `cambiaProgetto()` è già in un punto solo perché i menu erano due (topbar e Impostazioni). Devono
restare due chiamanti di una funzione sola anche dopo lo spostamento: è la trappola ④, e in questo
file è già stata pagata due volte.

---

# 5. Che cosa si ricorda

**Una disposizione sola, globale** *(scelta dell'utente, 9 agosto)*. L'app riapre come l'hai
lasciata, ovunque tu sia. Vive in `localStorage`, come le leve della vista mappa — che invece
restano **per corso**, e va bene così: sono due cose diverse, la taratura di uno strumento e la
forma del banco.

⚠️ Un blocco che ospita uno strumento non ancora costruito (o una mappa cancellata) non deve
lasciare un buco muto: mostra il suo stato vuoto e dice come riempirlo. Vale la regola già scritta
per le mappe: l'errore prima del conteggio, e mai «non hai niente» quando la verità è «non riesco a
leggere».

---

# 6. La nomenclatura: già fatta a parte, e va tenuta separata

`Progetto → Corso` e `Corso → Lezione` sono stati eseguiti il 9 agosto e hanno il loro contratto in
[RINOMINA-GLOSSARIO.md](RINOMINA-GLOSSARIO.md), che dichiara anche la forma nuova sul disco
(`Corsi/<corso>/LEZIONI/<lezione>/`). **Questo documento adotta quel vocabolario**: dove dice
«corso» intende il livello 1, dove dice «lezione» il livello 2.

⚠️ Se durante il lavoro sul banco affiora del vocabolario vecchio nel codice, è un **residuo**, non
una variante — così dice quel contratto — e va corretto lì per lì, ma **in un commit suo**. Un diff
in cui ogni riga è cambiata per due ragioni diverse non si rivede.

---

# 7. Ordine dei lavori

| # | lotto | contenuto | dipende da |
|---|---|---|---|
| **B1** ✅ | la griglia | le 8 forme, i due divisori, lo stato salvato, il registro degli strumenti con **Capitolo**, **Fonte** e **Appunti** | — |
| **B2** | la mappa entra nel banco | `#mappaView` smette di essere un overlay e diventa uno strumento; la sua toolbar è già adattiva per container query | B1 |
| **B3** | la fonte a schede | PDF e video come linguette nel blocco fonte; `openNote` resta l'unica porta | B1 |
| **B4** | sidebar «dove sei» | i tre menu scendono dalla topbar; il selettore della forma sale | B1 |
| **B5** | i due strumenti nuovi | Parole chiave (P1.1) e Flashcard (P3) entrano nel registro già pronto | B1 + i rispettivi lavori |

**Com'è finito B1 (9 agosto).** `assets/banco/forme.js` è il livello puro — otto forme, stato
normalizzato, `assegna` e `cambiaForma` immutabili — provato con 55 controlli in `roundtrip`; il
renderer ha le sue funzioni separate una per comando (`bancoForma`, `bancoAssegna`, `bancoMostra`,
`bancoMonta`, `bancoApplicaForma`, `bancoApplicaFrazioni`, `bancoPosizionaDivisori`,
`bancoDopoLayout`), e `bancoDisegna` non fa niente di suo: chiama gli altri in ordine. 26 controlli
sull'app viva.

Tre conseguenze affrontate invece che aggirate:

1. **Il dock smette di essere un pannello.** `#pdfPane` e `#notePane` diventano strumenti che il
   banco sposta nei blocchi; `openPdf` e `openEditor` chiedono `bancoMostra(...)` invece di
   accendere `data-dock`. Gli strumenti fuori scena aspettano in un **magazzino** nascosto: non si
   distruggono, o CodeMirror perderebbe il suo stato a ogni cambio di forma.
2. **La pagina non scorre più**, scorre il corpo di ogni blocco. Quattro punti ne dipendevano, e
   tutti e quattro sono stati reinstradati. ⚠️ Il più insidioso: l'evento `scroll` di un elemento
   **non risale**, quindi i due ascoltatori su `window` avrebbero smesso di sentire senza `capture`.
3. ⚠️ **I due divisori si incrociano**, e nel punto d'incontro vinceva quello orizzontale perché
   disegnato dopo: prendere il divisore verticale **a metà altezza** — cioè dove la mano lo cerca —
   afferrava l'altro, e trascinare di lato non faceva niente. Ora il verticale è disegnato per
   ultimo e vince l'incrocio; c'è un controllo che lo tiene fermo.

⚠️ **B1 e B2 vengono prima di L5** (l'estrazione «→ Mappa» del §3 di PIANO-MAPPE-EDITOR): quel
gesto presuppone di vedere fonte e mappa insieme, e oggi la mappa copre il capitolo. Non è una
preferenza di ordine: è che il gesto non ha un posto dove succedere.

---

# 8. Le trappole che questo lavoro attraversa

Tutte già pagate una volta in questo progetto, tutte in agguato qui:

- **⑦ una misura presa una volta sola all'avvio è una misura sbagliata** — la griglia cambia le
  altezze di tutto: ogni elemento che si appende a `--topbar-h` va seguito con il `ResizeObserver`
  che già esiste, non ricalcolato a mano;
- **`container-type:inline-size`** su un blocco lo rende il blocco contenitore dei discendenti
  `position:fixed` **e** un contesto di impilamento: popover, menu e tendine vanno **fuori** dai
  blocchi, come già fanno `#mappaPop` e `#mapMenu`;
- **`[hidden]` battuto da un `display` dichiarato in una classe** — la rete globale c'è
  (`[hidden]{display:none!important}`), ma un blocco vuoto steso su tutta la sua area è
  esattamente la forma di `.mvuota`: nasce con `pointer-events:none`;
- **la regola che nasconde il resto della pagina è un elenco**, non `main > *:not(...)`: con la
  griglia va rifatta da capo, o il piè di pagina tornerà a far traboccare la pagina di 72px;
- **④ due copie della stessa logica** — il salvataggio della disposizione, il flush degli strumenti
  quando un blocco si chiude, e `cambiaProgetto`: ognuno un punto solo.
