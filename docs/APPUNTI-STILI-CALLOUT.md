# Stili di testo e icone dei callout — 12 novembre 2026

Il comando Stile del paragrafo è un pulsante con il pilcrow ¶. Apre un popover
con Testo e sei livelli: # 1 · Titolo, # 2 · Sottotitolo 1, …, # 6 · Sottotitolo 5.
Le anteprime usano i token --tit-1…6 della pagina, ridotti tutti della stessa
proporzione, e il font UI. Conserva la selezione, consente frecce/Home/End,
Invio/Spazio, Escape e Undo. Una selezione mista non indica un livello unico.

Personalizza i riquadri offre una famiglia comune a tutti i sette tipi, salvata
nel vault in prefs.riquadriStileIcone: lucide (predefinito), openmoji o android.
Le personalizzazioni esistenti di nomi, colori ed emoji restano intatte.
AppuntiRiquadri è la decisione pura per la famiglia e il simbolo: le emoji note,
compreso 🔐, hanno un equivalente Lucide; quelle senza equivalente usano il
simbolo del tipo. Il selettore Lucide permette di scegliere esplicitamente
un altro simbolo, salvato in riquadri[tipo].icona. Le scelte emoji e SVG restano
indipendenti. FONTI, APPUNTI, menu, anteprime e PDF usano calloutIcona.

Lucide usa tratto 2,5; nei documenti il simbolo scuro ha un piccolo fondo bianco.
OpenMoji e Android conservano i loro colori. Android usa Noto-COLRv1.ttf
originale, incluso offline, licenza SIL OFL 1.1 conservata nei crediti:
https://github.com/googlefonts/noto-emoji/tree/99701e07d3d1fe1bdbcdb14964547f0fd592966f/2D/fonts

Correzione PDF: il documento A4 autonomo teneva il foglio display:none fino alla
stampa. document.fonts.ready terminava prima che venisse richiesto il font
Android: il PDF aveva il riquadro bianco ma nessuna icona. Nell'HTML autonomo
il foglio ora viene impaginato subito; l'app e le viste normali non cambiano.
Il difetto si riproduce sia con Noto bitmap sia con COLRv1: non è il formato.

## Verifiche

- 111 programmi Node: /private/tmp/zaino-callout-node-finale.log.
- UI: prova-appunti-stili-callout (nuova e registrata), strumenti, ortografia-ui,
  a4, keyword e callout-bolla. Le cinque regressioni verdi sono nel log
  /private/tmp/zaino-callout-ui-finale.log; la nuova prova completa, dopo la
  correzione di Invio, è /private/tmp/zaino-callout-ui-tastiera.log.
- Red reale icona personalizzata: /private/tmp/zaino-stili-callout-rosso.log.
- Red PDF Android (zero pixel del simbolo): /private/tmp/zaino-callout-pdf-rosso.log;
  verifica passata: /private/tmp/zaino-callout-pdf-verde.log.
- PDF reali OpenMoji/Android/Lucide generati tramite salvaPdf su zaino sintetico,
  disegno verificato da PDF.js, Android e Lucide controllati anche visivamente.
- La prima esecuzione Node nella sandbox non poteva sintetizzare la voce macOS;
  l'esecuzione autorizzata l'ha verificata. Il mock del selettore emoji è stato
  adeguato per supportare dataset, senza cambiare le aspettative della prova.

Nessuna modifica ai documenti personali o pubblicazione sul sito per questa
revisione. Notarizzazione sospesa.

## Guida online con schermate aggiornate

Il 12 novembre 2026 sono state pubblicate le sezioni `#menu-stili-paragrafo`
e `#icone-callout` su https://www.insegnai.ch/studia-zaino/guida/.
Quattro schermate acquisite dalla UI reale c55ff33 su uno zaino sintetico:
menu ¶, callout Lucide, OpenMoji e Android. I due confronti a colori sono
espandibili; tutte le immagini hanno testo alternativo, provenienza e zoom.
Testi e immagini sono inclusi anche nei sorgenti della guida dell'app; il
frammento del generatore conserva le aggiunte nelle successive rigenerazioni.

Pubblicati soltanto HTML e quattro PNG, senza eliminazioni. Backup remoto:
`~/.zaino-backups/20261112-guida-callout`. Backup locale e materiale di verifica:
`/private/tmp/zaino-guida-callout-web`. Verificati i cinque hash via HTTPS,
indice, immagini, ingrandimento e assenza di overflow a 1280 e 375 px.
Notarizzazione sospesa; nessuna nuova build applicativa per questa sola
pubblicazione della guida.
