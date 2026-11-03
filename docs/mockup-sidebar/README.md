# Sidebar e testate: mockup conservati

Le tre alternative esplorate il 3 novembre 2026 restano in `index.html`.
Il file è autonomo, si apre anche senza server e non legge il vault.
`confronto.png` conserva i tre stati affiancati.

- A · Segni sottili: categorie neutre, indicatore laterale della selezione,
  linea superiore e numero pieno sul riquadro attivo.
- B · Etichette esplicite: spunta e diciture «In uso» / «Aperto».
- C · Schede e cornici: gruppi delimitati e contorno del riquadro attivo.

L’utente ha scelto **A**, apprezzando la chiarezza di C ma chiedendo di
preservare lo spazio utile. L’app reale conserva questa struttura compatta, con le successive correzioni
richieste dall’utente: categorie grigie e pallini numerati, arancioni sullo
split attivo e con bordo grigio sugli altri. I mockup originali restano invariati.

La maniglia mantiene l’icona originale del fantasma. Il primo split le
riserva una fessura: la maniglia legge il suo rettangolo e condivide
`--tb-blocco-h`, evitando sovrapposizioni con numero e selettore.

Riduzione verticale richiesta del 10%, nei token di `App/StudIA.html`:

| Superficie | Prima | Ora |
|---|---:|---:|
| Topbar, una riga | 42,9 px | 38,61 px |
| Testata split e maniglia | 32 px | 32,4 px |
| Toolbar interna, altezza minima | 39 px | 35,1 px |
| Controllo delle toolbar | 30 px | 27 px |

La testata ridotta a 28,8px è stata poi aumentata di **1/8**: 32,4px.
Topbar e toolbar interne mantengono la riduzione precedente.

Le barre possono crescere quando i comandi vanno a capo. Il corpo del testo
e le misure dei contenuti restano indipendenti dalla scala delle barre.

Per il confronto interattivo, avviare da questa cartella:

```sh
python3 -m http.server 8999 --bind 127.0.0.1
```

Aprire `http://127.0.0.1:8999/?variant=A&view=confronto`.
La stessa porta serve alle prove dell’app: fermare il server dei mockup
prima di avviare il runner.

Verifica della geometria e dei colori sull’app reale:

```sh
STUDIA_PORTA=8999 bash bin/prova-zaino.sh prova-gerarchia-sidebar.js
```

## Indicatori dinamici — revisione del 3 novembre

Il numero in sidebar segue gli split **visibili**, nell’ordine di lettura.
Il nome dei materiali aperti è in grassetto; passando a un altro strumento,
chiudendo il documento o riducendo la disposizione, gli indicatori scompaiono.
Un PDF presente in entrambe le Fonti mostra due pallini. Lo stesso criterio
vale per Appunti, Mappe, Album, Schede, LIM e PRESENTA. L’arancione segue il
focus del banco. Il fantasma resta nell’angolo riservato della prima testata.

Le miniature selezionate di PRESENTA conservano l’highlight senza contorno
verde. L’Album usa cursore gray-500 e traccia gray-200, con i normali separatori
verticali fra Ritagli, Immagini, Video e Audio.

La regressione osservata prima della correzione: un appunto nascosto passando
ad Album restava evidenziato. Ora passa `prova-indicatori-materiali.js`,
registrata nel runner sintetico e affiancata alla logica Node di
`test/split-materiali.js`. Anche ordinare i nomi continua a ignorare i numeri
dei pallini.

Node: 92 programmi verdi. UI mirate su8999: indicatori, gerarchia,
banco-riduzione, editor-pari, sidebar-schede, LIM, presenta-editor, tbar e
maniglia-indice. La suite UI completa ha i problemi preesistenti documentati
qui sotto; questa revisione non li dichiara risolti.

## Collaudo precedente, prima revisione A del 3 novembre

Suite Node: 92 programmi superati. Verdi i controlli mirati di geometria,
barre, topbar, maniglia, chat, parità dei due Appunti, editor PRESENTA e
Ripasso. La nuova prova è stata osservata rossa sulle misure precedenti,
poi verde su temi, forme e larghezze 1440/1024/800/390.

La suite UI completa non è verde. Confrontata con un archivio isolato del
commit precedente `3b7b093`, riproduce dieci fallimenti in comune:
PRESENTA in sequenza, album, chat, gruppi, cronologia citazioni, download RAG,
costi, due prove Studio e selezione delle citazioni. PRESENTA passa anche
nella campagna mirata, ma fallisce dopo le prove che la precedono nella
suite completa. Questi problemi non sono dichiarati risolti.

L’ulteriore controllo cromatico del Ripasso, che usava la testata colorata
degli split come campione, è stato aggiornato a un campione indipendente e
superato. Nella copia di confronto fallisce inoltre l’accesso alle licenze
di Chromium nel diverso contesto dell’archivio: non è un risultato dell’app corrente.
