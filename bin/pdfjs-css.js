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
 *     cursori). Diventano `&`, cioè il guscio stesso: così le variabili nascono
 *     su `#pdfPane` invece che sulla radice del documento.
 *     ⚠️ La prima stesura li riscriveva `#pdfPane` — ma DENTRO il guscio, e un
 *     selettore annidato senza `&` è relativo al genitore: `#pdfPane #pdfPane`,
 *     cioè niente. Misurato il 7 settembre 2026: le variabili erano vuote anche
 *     dentro il riquadro, e nessuno se n'era accorto perché quei blocchi vestono
 *     cose che l'app non usa (editor di annotazioni, firme, XFA, alto contrasto)
 *     e i margini delle pagine li governa `removePageBorders`. Un `& { }` è la
 *     forma che il nesting prevede per «questo stesso elemento», anche dentro un
 *     `@media` annidato.
 *  3. da quei blocchi si TOGLIE `color-scheme`: il viewer lo dichiara `light dark`
 *     per il suo documento, ma qui il tema lo decide StudIA, e un riquadro che
 *     segue il sistema mentre l'app non lo fa cambia colore alla sua barra di
 *     scorrimento (misurato su un Mac in modalità scura: da 249 a 47 di grigio).
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
/* Il selettore con cui rinascono i blocchi `:root` DENTRO il guscio: «il guscio stesso». */
const RADICE = '&';

/**
 * Trova i blocchi `:root { … }` di PRIMO livello e ne riscrive il selettore.
 *
 * Si conta le graffe invece di usare un'espressione regolare sul blocco intero:
 * dentro un `:root` ci sono `@media` e regole annidate, e una regex non
 * ricorsiva chiuderebbe il blocco alla prima graffa che incontra — lasciando
 * fuori metà dichiarazioni e dentro un pezzo di sintassi rotta.
 */
/** L'indice della graffa che CHIUDE il blocco aperto in `apertura` (l'indice di `{`), saltando i commenti. */
function chiusuraDi(css, apertura) {
  let depth = 0;
  for (let k = apertura; k < css.length; k++) {
    if (css.startsWith('/*', k)) { k = css.indexOf('*/', k + 2) + 1; continue; }
    if (css[k] === '{') depth++;
    else if (css[k] === '}' && --depth === 0) return k;
  }
  return -1;
}

function riscriviRoot(css) {
  let out = '', i = 0, quanti = 0, schemi = 0;
  while (i < css.length) {
    const j = css.indexOf(':root', i);
    if (j < 0) { out += css.slice(i); break; }
    // solo i `:root` che aprono un blocco di primo livello, non quelli dentro
    // un selettore composto (`:root:has(…)`) o dentro una funzione
    const dopo = css.slice(j + 5, j + 6);
    const prima = css.slice(Math.max(0, j - 1), j);
    const attaccato = /[\w.#\-[\]:)]/.test(prima) || /[\w:([]/.test(dopo);
    if (attaccato) { out += css.slice(i, j + 5); i = j + 5; continue; }
    // il blocco intero, per togliergli `color-scheme` (trasformazione 3)
    const apre = css.indexOf('{', j + 5), chiude = chiusuraDi(css, apre);
    let blocco = css.slice(apre, chiude + 1);
    blocco = blocco.replace(/^[ \t]*color-scheme:[^;]*;[ \t]*\n/mg, () => { schemi++; return ''; });
    out += css.slice(i, j) + RADICE + blocco;
    quanti++;
    i = chiude + 1;
  }
  return { css: out, quanti, schemi };
}

function main() {
  const grezzo = fs.readFileSync(SORGENTE, 'utf8');
  const { css, quanti, schemi } = riscriviRoot(grezzo);

  const testa = [
    '/* GENERATO DA bin/pdfjs-css.js — NON MODIFICARE A MANO.',
    ' *',
    ' * È `pdf_viewer.css` di pdf.js incapsulato sotto `' + GUSCIO + '`: senza il guscio',
    ' * il suo `.sidebar` riscrive l\'indice dei capitoli di StudIA, che ha lo stesso',
    ' * nome di classe e meno fortuna nell\'ordine di caricamento.',
    ' *',
    ' * I ' + quanti + ' blocchi `:root` sono diventati `' + RADICE + '` — il guscio stesso: riscritti',
    ' * come `' + GUSCIO + '` ma annidati corrispondevano a niente, e le variabili del',
    ' * viewer non arrivavano (misurato il 7 settembre 2026). Da quei blocchi è tolto',
    ' * `color-scheme` (' + schemi + '): il tema lo decide StudIA, non il viewer.',
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
  console.log('blocchi :root riscritti come ' + RADICE + ' (il guscio stesso): ' + quanti + ' · color-scheme tolti: ' + schemi);
}

if (require.main === module) main();
module.exports = { riscriviRoot, chiusuraDi, SORGENTE, USCITA, GUSCIO, RADICE };
