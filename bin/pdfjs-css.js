#!/usr/bin/env node
'use strict';
/**
 * pdfjs-css — incapsula il foglio di stile del viewer di pdf.js sotto `#pdfPane`.
 *
 * Perché esiste. `App/assets/pdfjs/pdf_viewer.css` non è il CSS di un
 * componente: è quello del viewer di Firefox, 6.348 righe, 156 selettori di
 * primo livello. Caricato così com'è dentro StudIA **riscrive l'indice dei
 * capitoli**: il suo `.sidebar` (larghezza fissa 239px, bordo, ombra,
 * `position:relative`) ha la stessa specificità del nostro e arriva dopo, quindi
 * vince — e `position:relative` ammazza lo `sticky` della nostra sidebar.
 * Misurato, non temuto: `.sidebar` sta a `pdf_viewer.css:6053`, il nostro a
 * `StudIA.html:1589`.
 *
 * Perché uno script e non una modifica a mano. Il file è VENDORIZZATO: si
 * aggiorna ricopiandolo da pdf.js. Una modifica a mano andrebbe rifatta a
 * memoria al prossimo aggiornamento, e la volta che qualcuno se ne dimentica il
 * guasto torna. Così invece la trasformazione è una riga di comando:
 *
 *     node bin/pdfjs-css.js
 *
 * ⚠️ Il file generato NON si modifica a mano: si rigenera.
 *
 * Le due trasformazioni, e sono solo due:
 *  1. tutto il foglio finisce dentro `#pdfPane { … }` — si può, perché il CSS
 *     annidato è nativo in questo Chromium (142) e il file lo usa già
 *     massicciamente per conto suo;
 *  2. i blocchi `:root` NON si annidano: `#pdfPane :root` non corrisponde a
 *     niente, e perderebbe tutte e 46 le variabili del viewer (bordi, margini,
 *     cursori: tutto rotto). Diventano `#pdfPane` a loro volta, così le
 *     variabili nascono dove servono invece che sulla radice del documento.
 */

const fs = require('fs');
const path = require('path');

const SORGENTE = path.join(__dirname, '..', 'App', 'assets', 'pdfjs', 'pdf_viewer.css');
const USCITA = path.join(__dirname, '..', 'App', 'assets', 'pdfjs', 'pdf_viewer.scoped.css');
/* ⚠️ `:is(...)`: da quando esiste il CONFRONTO i riquadri col viewer sono due,
   e un guscio che ne copre uno solo lascia l'altro con 266 pagine ad altezza
   ZERO — misurato: `_getVisiblePages()` vuota, nessun rendering, nessun
   errore da nessuna parte. Chi aggiunge un terzo riquadro lo aggiunge QUI. */
const GUSCIO = ':is(#pdfPane, #pdfPane2)';

/**
 * Trova i blocchi `:root { … }` di PRIMO livello e ne riscrive il selettore.
 *
 * Si conta le graffe invece di usare un'espressione regolare sul blocco intero:
 * dentro un `:root` ci sono `@media` e regole annidate, e una regex non
 * ricorsiva chiuderebbe il blocco alla prima graffa che incontra — lasciando
 * fuori metà dichiarazioni e dentro un pezzo di sintassi rotta.
 */
function riscriviRoot(css) {
  let out = '', i = 0, quanti = 0;
  while (i < css.length) {
    const j = css.indexOf(':root', i);
    if (j < 0) { out += css.slice(i); break; }
    // solo i `:root` che aprono un blocco di primo livello, non quelli dentro
    // un selettore composto (`:root:has(…)`) o dentro una funzione
    const dopo = css.slice(j + 5, j + 6);
    const prima = css.slice(Math.max(0, j - 1), j);
    const attaccato = /[\w.#\-[\]:)]/.test(prima) || /[\w:([]/.test(dopo);
    if (attaccato) { out += css.slice(i, j + 5); i = j + 5; continue; }
    out += css.slice(i, j) + GUSCIO;
    quanti++;
    i = j + 5;
  }
  return { css: out, quanti };
}

function main() {
  const grezzo = fs.readFileSync(SORGENTE, 'utf8');
  const { css, quanti } = riscriviRoot(grezzo);

  const testa = [
    '/* GENERATO DA bin/pdfjs-css.js — NON MODIFICARE A MANO.',
    ' *',
    ' * È `pdf_viewer.css` di pdf.js incapsulato sotto `' + GUSCIO + '`: senza il guscio',
    ' * il suo `.sidebar` riscrive l\'indice dei capitoli di StudIA, che ha lo stesso',
    ' * nome di classe e meno fortuna nell\'ordine di caricamento.',
    ' *',
    ' * I ' + quanti + ' blocchi `:root` sono diventati `' + GUSCIO + '`: annidati non',
    ' * corrisponderebbero a niente e le variabili del viewer sparirebbero tutte.',
    ' *',
    ' * Si rigenera con:  node bin/pdfjs-css.js',
    ' */',
    ''
  ].join('\n');

  // il nesting nativo fa il resto: una sola graffa attorno a tutto il foglio
  const fuori = testa + GUSCIO + ' {\n' + css + '\n}\n';
  fs.writeFileSync(USCITA, fuori, 'utf8');

  const kb = (n) => Math.round(n / 1024) + ' KB';
  console.log('pdf_viewer.css  ' + kb(grezzo.length) + '  →  pdf_viewer.scoped.css  ' + kb(fuori.length));
  console.log('blocchi :root riscritti come ' + GUSCIO + ': ' + quanti);
}

if (require.main === module) main();
module.exports = { riscriviRoot, SORGENTE, USCITA, GUSCIO };
