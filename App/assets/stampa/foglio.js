/* StudIA — LA CARTA: come si impagina un foglio stampato (14 agosto 2026)
 *
 *     const F = StampaFoglio;
 *     document.getElementById('stampaRegole').textContent =
 *       F.regole({ tipo:'testo', marchio:'StudIA · Appunti', titolo:'Il DSA' });
 *
 * ── PERCHÉ ESISTE ────────────────────────────────────────────────────────────
 * L'app stampava (e quindi salvava in PDF) con quattro righe di CSS dentro il
 * blocco `@media print` del monolite. Misurato il 14 agosto sul PDF vero — non
 * a occhio, rendendo le pagine a 150 dpi e cercando il riquadro dell'inchiostro:
 *
 *   | difetto misurato                        | valore prima | perché è un difetto |
 *   |-----------------------------------------|--------------|---------------------|
 *   | il foglio non era A4                    | 215,9×279,4mm (Letter) | ⚠️ `@page` senza `size` lascia decidere Chromium, e il suo default è Letter. Un foglio svizzero stampato su carta americana perde 17mm sotto e ne guadagna 6 di lato |
 *   | colonna di testo troppo larga           | 188 mm       | ~110 battute per riga: il doppio del comodo. La riga lunga è il modo più veloce di perdere il segno andando a capo |
 *   | corpo del testo                         | 10,9 pt      | materiale di studio, spesso per chi ha un DSA: 10,9pt è il corpo di una nota a piè di pagina |
 *   | numeri di pagina                        | nessuno      | due fogli caduti per terra non si rimettono in ordine |
 *   | la mappa in orizzontale                 | 132mm di 184 | disegnata larga e ancorata in alto, con 72mm di bianco sotto |
 *
 * ── CHE COSA SI È COPIATO DA MAPPAI, E CHE COSA NO ───────────────────────────
 * MappAI (l'altro progetto di Giacomo) aveva già pagato queste lezioni in
 * `mappai-doc-head.js` e nel blocco di stampa di `mappai-doc-bar.js`. Qui si
 * riusa il **metodo**, non il codice: le due app hanno palette e vocabolari
 * diversi, e una copia letterale sarebbe la seconda copia che diverge.
 *
 *   · il PIÈ VIVE NEI MARGIN-BOX DI `@page`. È l'unico posto da cui si può
 *     scrivere `counter(page)`: in un elemento del documento quel contatore
 *     vale 0. Le altre due strade note falliscono qui — `position:fixed` salta
 *     la PRIMA pagina, e il `footerTemplate` di `printToPDF` esiste solo per i
 *     PDF che scrive l'app, non per chi stampa dal dialogo;
 *   · i CORPI IN PUNTI, non in pixel, e derivati da uno solo (`--st-pt`): un px
 *     in stampa vale 0,26mm e nessuno sa quanti pixel siano «leggibile»;
 *   · l'IMBOTTITURA DEI RIQUADRI SI SOMMA AL MARGINE DI `@page`: se il corpo
 *     tiene i suoi 10px di padding, i 20mm chiesti diventano 22,6. In stampa si
 *     azzera.
 *
 * NON si è copiata la testata a card di MappAI (chip classe/materia): StudIA
 * non ha quelle due coordinate, e una card vuota è peggio di nessuna card.
 *
 * Puro: nessun DOM, nessuno stato dell'app, nessuna dipendenza. UMD → gira in
 * Node e ha la sua prova (`test/stampa-foglio.js`).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.StampaFoglio = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── LE MISURE, IN UN POSTO SOLO ───────────────────────────────────────────
     Ogni numero qui sotto è stato misurato sul PDF, non scelto a gusto.

     ⚠️ `sotto` è più grande degli altri margini in tutti e due i formati: è lì
     che vive il piè, e un margin-box non allarga la pagina — se il margine non
     gli lascia posto, il piè si stampa SOPRA l'ultima riga del testo. */
  var FORMATI = {
    /* Il foglio del testo: appunti, e qualunque cosa si legga per righe.
       Colonna = 210 − 20 − 20 = 170mm. A 12pt sono ~80 battute per riga, dentro
       la forbice comoda (45-90) che la tipografia dà da un secolo. */
    testo: {
      size: 'A4 portrait',
      margine: '20mm 20mm 25mm 20mm',
      pt: 12,          // il corpo; tutto il resto è un multiplo di questo
      interlinea: 1.55
    },
    /* Il foglio della mappa: coricato, perché una mappa è larga (mediana
       misurata in questo progetto: 2.884px) e su un foglio ritto si accartoccia.
       Margini più stretti — un disegno non si legge per righe, non gli serve
       la stessa aria — ma il piè vuole il suo posto sotto. */
    mappa: {
      size: 'A4 landscape',
      margine: '12mm 12mm 16mm 12mm',
      pt: 11,
      interlinea: 1.4,
      /* Quanto può essere alto il disegno: 210 − 12 − 16 = 182mm di pagina,
         meno la testata (~16mm col suo margine). In MILLIMETRI e non in `vh`:
         ⚠️ `vh` in stampa è una misura del riquadro di pagina che Chromium
         calcola prima dei margini, e il vecchio `max-height:92vh` lasciava il
         disegno alto due terzi con 72mm di bianco sotto (misurato). */
      disegnoMax: '164mm'
    }
  };

  /* La scala tipografica, in multipli del corpo. Non sono sette numeri scelti
     uno per uno: sono una progressione, così cambiando `pt` il foglio intero
     cresce insieme invece di sfasarsi. */
  var SCALA = {
    titolo: 1.8,     // il titolo del foglio
    dove: 0.8,       // la riga sotto il titolo (dove sta, quando è stato fatto)
    /* ⚠️ SEI livelli, e non è abbondanza: `mdToHtml` SPOSTA I TITOLI DI DUE
       LIVELLI (`lv = cancelletti + 2`), quindi un «##» di un appunto arriva in
       pagina come `h4` e un «###» come `h5`. Il blocco di stampa di prima
       nominava h1-h3 e quei titoli non li toccava: misurato sul PDF del 14
       agosto, «Terzo livello» (un h5) usciva PIÙ PICCOLO del corpo del testo,
       cioè un titolo che si legge meno di ciò che titola.
       La rampa scende piano e non arriva mai sotto il corpo: l'ultimo livello
       vale 1,0 e si distingue col peso, non con la taglia. */
    h1: 1.5, h2: 1.4, h3: 1.3, h4: 1.18, h5: 1.08, h6: 1.0,
    piccolo: 0.8,    // didascalie, citazioni numerate
    pie: 0.75        // il piè nei margin-box (in pt assoluti, vedi sotto)
  };

  var COL = {
    inchiostro: '#111',
    tenue: '#555',
    filo: '#999',
    riquadro: '#f4f4f4',
    pie: '#666'
  };

  /* ⚠️ Le stringhe dei margin-box sono VALORI CSS, non HTML. Un a-capo dentro
     una `content` invalida la dichiarazione e il piè sparisce SENZA errori:
     si appiattisce, e si proteggono barra rovescia e virgolette. */
  function escCss(s) {
    return String(s == null ? '' : s)
      .replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      .replace(/[\r\n]+/g, ' ');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* GG/MM/AAAA, senza ora. Il minuto in cui è stato stampato non dice niente a
     nessuno, e fa sembrare diverse due copie identiche. */
  function data(d) {
    var x = (d instanceof Date) ? d : (d ? new Date(d) : new Date());
    if (isNaN(x.getTime())) return '';
    function p(n) { return String(n).padStart(2, '0'); }
    return p(x.getDate()) + '/' + p(x.getMonth() + 1) + '/' + x.getFullYear();
  }

  function formato(tipo) { return FORMATI[tipo] || FORMATI.testo; }

  /* ── IL PIÈ, DENTRO @page ─────────────────────────────────────────────────
     o: { marchio?, sotto?, numeri? (default true) } */
  function pie(o) {
    o = o || {};
    var f = formato(o.tipo);
    var righe = [];
    var sx = o.marchio == null ? 'StudIA' : o.marchio;
    if (o.sotto) sx += ' · ' + o.sotto;
    var stile = 'font-family:' + (o.font || "'Helvetica Neue', Arial, sans-serif") +
      '; font-size:' + (f.pt * SCALA.pie).toFixed(1) + 'pt; color:' + COL.pie + ';';
    if (sx) {
      righe.push('  @bottom-left { content:"' + escCss(sx) + '"; ' + stile + ' }');
    }
    if (o.numeri !== false) {
      /* «pagina 2 di 7», col totale: senza, chi tiene in mano il foglio 2 non sa
         se ne mancano altri. `counter(pages)` esiste solo qui dentro. */
      righe.push('  @bottom-right { content:"pagina " counter(page) " di " counter(pages); ' + stile + ' }');
    }
    return righe.join('\n');
  }

  /* ── LE REGOLE DI STAMPA ──────────────────────────────────────────────────
     o: { tipo:'testo'|'mappa', marchio?, sotto?, numeri?, font? }
     Ritorna il CSS COMPLETO del foglio — `@page` compreso — già dentro un
     `@media print`: chi chiama lo mette in un `<style>` e non deve sapere altro.

     ⚠️ Esce come TESTO e non come oggetto: è la forma che sia il renderer sia
     una prova in Node possono guardare, e un `@page` non si può scrivere con le
     API del CSSOM in modo affidabile. */
  function regole(o) {
    o = o || {};
    var f = formato(o.tipo);
    var font = o.font || "'Helvetica Neue', Arial, sans-serif";
    var S = '#stampaFoglio';
    var css = [
      '@media print {',
      /* la carta è bianca: il tema scuro qui sarebbe una lastra d'inchiostro */
      '  :root { color-scheme:light; }',
      '  body > * { display:none !important; }',
      /* ⚠️ `padding:0` sul body e non solo sul foglio: un'imbottitura del
         contenitore si SOMMA al margine di @page. */
      '  body { background:#fff; color:' + COL.inchiostro + '; margin:0; padding:0; }',
      '  @page { size:' + f.size + '; margin:' + f.margine + ';',
      pie(o),
      '  }',
      '  ' + S + ' { display:block !important; background:#fff; color:' + COL.inchiostro + ';',
      '     font-family:' + font + '; font-size:' + f.pt + 'pt; line-height:' + f.interlinea + ';',
      '     padding:0; max-width:none; }',
      /* la testata: attaccata al suo testo, sempre */
      '  ' + S + ' .st-testa { border-bottom:1px solid ' + COL.filo + '; padding-bottom:6px;',
      '     margin:0 0 14px; break-after:avoid; page-break-after:avoid; }',
      '  ' + S + ' .st-titolo { font-size:' + (f.pt * SCALA.titolo).toFixed(1) + 'pt; font-weight:800;',
      '     margin:0 0 2px; line-height:1.2; }',
      '  ' + S + ' .st-dove { font-size:' + (f.pt * SCALA.dove).toFixed(1) + 'pt; color:' + COL.tenue + '; }',
      '  ' + S + ' .st-corpo { font-size:' + f.pt + 'pt; line-height:' + f.interlinea + '; }',
      /* La scala dei titoli dentro il corpo: derivata dal corpo, non scelta —
         e fino all'h6, perché i titoli degli appunti arrivano spostati (vedi
         SCALA). ⚠️ Anche il PESO va dichiarato: sotto l'h4 il browser dà un
         grassetto più leggero e i titoli profondi si confondono col testo. */
      '  ' + S + ' .st-corpo h1 { font-size:' + (f.pt * SCALA.h1).toFixed(1) + 'pt; }',
      '  ' + S + ' .st-corpo h2 { font-size:' + (f.pt * SCALA.h2).toFixed(1) + 'pt; }',
      '  ' + S + ' .st-corpo h3 { font-size:' + (f.pt * SCALA.h3).toFixed(1) + 'pt; }',
      '  ' + S + ' .st-corpo h4 { font-size:' + (f.pt * SCALA.h4).toFixed(1) + 'pt; }',
      '  ' + S + ' .st-corpo h5 { font-size:' + (f.pt * SCALA.h5).toFixed(1) + 'pt; }',
      '  ' + S + ' .st-corpo h6 { font-size:' + (f.pt * SCALA.h6).toFixed(1) + 'pt; }',
      '  ' + S + ' .st-corpo h1, ' + S + ' .st-corpo h2, ' + S + ' .st-corpo h3,',
      '  ' + S + ' .st-corpo h4, ' + S + ' .st-corpo h5, ' + S + ' .st-corpo h6 {',
      '     break-after:avoid; page-break-after:avoid; margin:1.1em 0 .35em;',
      '     line-height:1.25; font-weight:700; text-transform:none; letter-spacing:0; }',
      /* ⚠️ NIENTE `break-inside:avoid` sui paragrafi. C'era, e su un paragrafo
         lungo costringe a spostarlo INTERO alla pagina dopo: si guadagna un
         paragrafo intatto e si perde mezza pagina di bianco. Il rimedio
         tipografico è un altro, ed è quello che usano i libri: due righe minime
         di qua e di là dal salto. */
      '  ' + S + ' .st-corpo p, ' + S + ' .st-corpo li { orphans:2; widows:2; margin:0 0 .6em; }',
      '  ' + S + ' .st-corpo ul, ' + S + ' .st-corpo ol { margin:.4em 0 .8em; padding-left:1.4em; }',
      /* i riquadri invece SÌ: una citazione spezzata in due pagine perde il
         suo mestiere, che è essere un blocco */
      '  ' + S + ' .st-corpo blockquote, ' + S + ' .st-corpo .ucallout {',
      '     margin:.8em 0; padding:.45em .8em; break-inside:avoid; page-break-inside:avoid; }',
      '  ' + S + ' .st-corpo blockquote { border-left:3px solid ' + COL.filo + ';',
      '     background:' + COL.riquadro + '; }',
      /* ⚠️ Il riquadro dell'appunto TIENE IL SUO COLORE. La prima stesura di
         questa regola dipingeva `.ucallout` come una citazione qualunque —
         filo grigio, fondo grigio — e sul PDF del 14 agosto i quattro riquadri
         (nota, attenzione, importante, esempio) uscivano tutti uguali: il
         colore restava solo nelle due parole del titolino. Il colore di un
         callout è la sua unica differenza, ed è quella che si cerca sfogliando.
         Qui si dichiara solo ciò che la carta chiede — il fondo tenue, che a
         schermo nasce da `--panel` e su carta deve nascere dal BIANCO — e il
         resto (bordo, tinta del titolo, icona) resta quello dell'app. */
      '  ' + S + ' .st-corpo .ucallout { background:color-mix(in srgb, var(--uc-col, #999) 10%, #fff); }',
      /* ⚠️ Lo sfondo di un riquadro si stampa solo se chi stampa ha acceso
         «grafica di sfondo» (di norma è spenta nel dialogo di Chromium) — o se
         il PDF lo scrive l'app, che accende `printBackground`. Il filo a
         sinistra invece è un BORDO e si stampa sempre: è lui a tenere in piedi
         il riquadro quando il fondo non c'è. */
      '  ' + S + ' .st-corpo a { color:' + COL.inchiostro + '; text-decoration:underline; }',
      '  ' + S + ' .st-corpo img { max-width:100%; height:auto; break-inside:avoid; }',
      /* ⚠️ La misura data a un'immagine nell'appunto vale anche sulla carta. Non
         è vestito che si ricopia: è CONTENUTO — sta scritta nel markdown
         (`![Titolo|60%](album:…)`), l'utente l'ha decisa lei, e un foglio che
         la ignorasse direbbe una cosa diversa da quello che si vede a schermo.
         Qui basta il minimo perché la percentuale abbia contro che cosa
         calcolarsi: l'ancora larga quanto le si dice, l'immagine che la riempie. */
      '  ' + S + ' .st-corpo .figura.misurata a { display:inline-block; width:var(--figw); max-width:100%; }',
      '  ' + S + ' .st-corpo .figura.misurata img { width:100%; }',
      '  ' + S + ' .st-corpo pre { white-space:pre-wrap; word-wrap:break-word;',
      '     font-size:' + (f.pt * SCALA.piccolo).toFixed(1) + 'pt; background:' + COL.riquadro + ';',
      '     padding:.5em .7em; break-inside:avoid; }',
      '  ' + S + ' .st-corpo code { font-size:' + (f.pt * SCALA.piccolo).toFixed(1) + 'pt; }',
      '  ' + S + ' .st-corpo table { width:100%; border-collapse:collapse;',
      '     font-size:' + (f.pt * SCALA.piccolo).toFixed(1) + 'pt; break-inside:auto; }',
      '  ' + S + ' .st-corpo th, ' + S + ' .st-corpo td { border:1px solid ' + COL.filo + ';',
      '     padding:.3em .45em; text-align:left; vertical-align:top; }',
      '  ' + S + ' .st-corpo thead { display:table-header-group; }',   // l'intestazione si ripete
      '  ' + S + ' .st-corpo tr { break-inside:avoid; }'
    ];

    if ((o.tipo || 'testo') === 'mappa') {
      css.push(
        /* Il disegno prende quello che resta della pagina, e sta in mezzo.
           ⚠️ `max-height` in mm, non in `vh`: vedi la nota in testa al file. */
        '  ' + S + ' .st-corpo { text-align:center; }',
        '  ' + S + ' svg { width:100%; height:auto; max-width:100%;',
        '     max-height:' + formato('mappa').disegnoMax + '; }',
        /* Sul foglio non si stampa MAI l'interfaccia della mappa: le maniglie
           degli archi e i pallini dei rami sono comandi, e un comando su carta
           è un disegno che promette un gesto impossibile. */
        '  ' + S + ' .mporta, ' + S + ' .mtoggle { display:none; }'
      );
    }

    css.push('}');
    return css.join('\n');
  }

  /* ── LA TESTATA ───────────────────────────────────────────────────────────
     d: { titolo, dove?, data? (Date|stringa|false) } → l'HTML della testata.
     È qui e non nel renderer perché il foglio è UNO: chi lo riempie non deve
     ricordarsi come si scrive la riga sotto il titolo. */
  function testata(d) {
    d = d || {};
    var sotto = [];
    if (d.dove) sotto.push(esc(d.dove));
    var dt = (d.data === false) ? ''
      : (typeof d.data === 'string' && d.data) ? d.data : data(d.data);
    if (dt) sotto.push(esc(dt));
    return '<div class="st-testa">' +
      '<div class="st-titolo">' + esc(d.titolo || '') + '</div>' +
      (sotto.length ? '<div class="st-dove">' + sotto.join(' · ') + '</div>' : '') +
      '</div>';
  }

  return {
    FORMATI: FORMATI, SCALA: SCALA,
    formato: formato, regole: regole, pie: pie, testata: testata, data: data
  };
}));
