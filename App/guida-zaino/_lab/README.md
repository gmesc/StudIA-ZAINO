# Rigenerare gli screenshot del fork

Dalla radice di StudIA - ZAINO:

```bash
bash bin/guida-zaino.sh
```

Il comando avvia il runtime Electron dei test con dati e vault sintetici in
`/private/tmp/studia-guida-*`, sulla porta 9462 (modificabile con `STUDIA_PORTA`).
Non usa chiavi o servizi AI reali e non modifica `dist`. Alla fine chiude soltanto
il processo avviato; conserva il laboratorio temporaneo e i log per ispezionarli.

- `barre.js`: numerazione condivisa delle toolbar Fonti, Appunti e Mappa, con controllo
  che tutti i pulsanti stiano su una sola riga.
- `campagna.js`: rigenera gli stati degli strumenti con i materiali in `materiali/`.
- `fork.js`: acquisisce chat, cronologia, rinomina, profili, provider e quattro pannelli.
  Le risposte AI e il modello sono simulati e dichiarati nelle didascalie della guida.
- `novita.js`: acquisisce ricerca locale, indice, stima delle schede, raccoglitore,
  domanda e riscontro del Ripasso, gruppi, riduzione del Banco e fonti della chat.
  Il modello locale non viene scaricato; le risposte AI sono simulate.
- `verifica.js`: acquisisce la rinomina dello zaino e controlla immagini, indice,
  ingrandimento, collegamenti interni, numerazione e impaginazione desktop/mobile
  della guida nei due temi. Controlla anche la chiusura dell’indice mobile.
- `lab.js`: screenshot tramite CDP, ritagli, indicatori e ricostruzione dei soli menu
  nativi non catturabili, usando le etichette dell'app. I dialoghi ricostruiti usano
  lo zaino OpenMoji. Questa convenzione è dichiarata anche nella guida.
- `scatto-24.js`: ricetta mirata per la seconda fonte; richiede un laboratorio
  temporaneo già aperto, `GUIDA_VAULT` e `STUDIA_PORTA` corretti.

Le immagini vengono scritte direttamente in `../img/`. I passaggi distruttivi
controllano che il vault appartenga al laboratorio e coincida con quello del renderer.
Qualunque passo fallito della campagna fa terminare il comando con errore.

La cartella `_lab/` è esclusa dai pacchetti dell'app. Le schermate usano una finestra
1470×956 a densità 2; i numeri delle barre sono allineati su una sola riga.

- `toolbar.js`: riprese mirate delle toolbar trasparenti, Lucide, ordinamento e chiusura
  dei documenti. Richiede il vault guida Biologia con 01 Botanica.pdf e un appunto,
  oltre a `GUIDA_VAULT`/`STUDIA_PORTA`. Scrive soltanto nel laboratorio controllato.
