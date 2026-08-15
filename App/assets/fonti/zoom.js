/* ============================================================================
   fonti/zoom.js — la matematica dello zoom sul documento
   ============================================================================
   Il livello di ingrandimento di una fonte ha tre modi, e sono TRE STATI DI UN
   BOTTONE SOLO:

     `page-width`  adattata alla larghezza del riquadro   → il bottone dice ↔
     `page-fit`    adattata alla pagina intera            → il bottone dice ↕
     un NUMERO     lo zoom scelto a mano                  → il bottone dice 144%

   I primi due sono DINAMICI: il riquadro cambia misura (si trascina il divisore,
   si allarga la finestra, il blocco del banco cambia forma) e la scala li segue.
   Il terzo no: chi ha scelto 144% vuole 144% anche in un riquadro più stretto.
   Il click sul bottone cicla fra i due modi; «+», «−» e SHIFT+rotella portano al
   numero.

   ⚠️ PERCHÉ QUESTO FILE ESISTE. Il modo attivo NON è una variabile nostra: è
   `PDFJS.viewer.currentScaleValue`, che il visualizzatore tiene già e che si
   ricorda su disco così com'è. Tenerne una copia accanto vorrebbe dire due idee
   di «a che zoom siamo», e la prima che diverge è quella che si vede scritta in
   barra. Qui dentro c'è solo ciò che si può decidere SENZA il viewer e senza il
   DOM — aritmetica e stringhe — perché è la parte che si sbaglia e che, a
   schermo, si potrebbe provare solo a occhio.

   Nessun `fs`, nessun `crypto`, nessun DOM: `<script src>` nel browser,
   `require()` in Node.

     node test/zoom-fonte.js
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FontiZoom = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* I limiti sono NOSTRI e più stretti di quelli di pdf.js (0,1×–25×): oltre, su
     un riquadro stretto, una pagina diventa una parola per schermata. Il passo è
     moltiplicativo, cioè uguale a ogni scala. */
  var MIN = 0.25, MAX = 5, PASSO = 1.1;

  /* I modi di adattamento che pdf.js accetta per nome. Sono validi tutti, ma qui
     se ne usano due: `page-height` e `auto` non aggiungono niente che il bottone
     sappia dire in un glifo, e un ciclo a quattro stati si smette di capire.
     ⚠️ Una stringa fuori da questo elenco fa uscire pdf.js dal `default` con un
     `console.error` e SENZA sollevare: nessun `try/catch` se ne accorgerebbe. */
  var MODI = ['page-width', 'page-fit'];
  /* Gli altri due restano leciti in ARRIVO — un livello salvato da una versione
     precedente non va buttato via — ma non si raggiungono più col bottone. */
  var MODI_NOTI = ['page-width', 'page-fit', 'page-height', 'auto'];

  /* ⚠️ PERCHÉ NON `↔` E `↕`, che sarebbero i segni ovvi. Il `@font-face` di
     OpenMoji dichiara `unicode-range: … U+2190-21FF …`, e quelle due frecce
     stanno lì dentro: in barra uscirebbero come pittogrammi COLORATI, alti come
     un'emoji e non come un'etichetta. Questi due invece — freccia lunga
     bidirezionale (U+27F7) e diagonale (U+2922) — cadono FUORI da tutti gli
     intervalli dichiarati, quindi li disegna il font del testo. Il segno
     giusto qui non è quello che si sceglie per significato: è quello che il
     font che vogliamo sa disegnare. */
  var SEGNI = { 'page-width': '⟷', 'page-fit': '⤢' };

  function modo(v) { return MODI_NOTI.indexOf(String(v || '')) >= 0; }

  /**
   * Il livello letto dalla memoria, validato.
   *
   * ⚠️ Si valida qui perché pdf.js NON lancia su un valore storto: `#setScale`
   * fa `parseFloat`, non trova un numero, cade nel `default`, stampa un errore
   * in console e torna. Il documento resterebbe alla scala di fabbrica, la
   * chiave avvelenata sopravviverebbe a ogni riapertura, e nessun `try/catch`
   * scatterebbe mai. Chi non si riconosce ricomincia da `page-width`.
   */
  function valido(raw) {
    var v = String(raw == null ? '' : raw);
    if (modo(v)) return v;
    var n = parseFloat(v);
    if (isFinite(n) && n >= MIN && n <= MAX) return String(n);
    return 'page-width';
  }

  /**
   * La scala dopo un «+» o un «−», o `null` se il gesto non deve fare niente.
   *
   * ⚠️ Il tetto non deve INVERTIRE il gesto. Un adattamento può portare la scala
   * fuori dai nostri limiti — su una slide in un riquadro largo `page-width` dà
   * 600% — e un clamp cieco faceva RIMPICCIOLIRE premendo «+». Se si è già
   * oltre, il verso che porterebbe più in là non fa niente; l'altro funziona.
   */
  function passo(scala, su) {
    var s = Number(scala);
    if (!isFinite(s) || s <= 0) s = 1;
    if (su && s >= MAX) return null;
    if (!su && s <= MIN) return null;
    var n = su ? s * PASSO : s / PASSO;
    n = Math.max(MIN, Math.min(MAX, Math.round(n * 100) / 100));
    return n;
  }

  /** Il modo dopo un click sul bottone: larghezza ↔ pagina intera, e da un
   *  numero si rientra sempre dalla larghezza — è l'adattamento con cui una
   *  fonte si apre, e quello che si vuole nove volte su dieci. */
  function prossimoAdatta(valore) {
    return String(valore || '') === 'page-width' ? 'page-fit' : 'page-width';
  }

  /**
   * Che cosa scrive il bottone, e che cosa promette il suo `title`.
   *
   * La percentuale non sparisce quando il modo è dinamico: si sposta nel
   * suggerimento. Un `↔` da solo direbbe che cosa fa il bottone ma non più a che
   * ingrandimento si sta leggendo, che è l'informazione per cui quel bottone è
   * nato.
   */
  function etichetta(valore, scala, pronta, senzaCiclo) {
    var v = String(valore || '');
    /* ⚠️ `currentScale` non è mai 0: quando la scala non è ancora stata
       calcolata il getter torna 1, e la barra dichiarerebbe «100%» con sicurezza
       nella finestra fra `setDocument` e `pagesinit`. Il numero si mostra solo
       quando esiste davvero. */
    var pct = (pronta && isFinite(scala) && scala > 0) ? Math.round(scala * 100) + '%' : '';
    if (v === 'page-width' || v === 'page-fit') {
      var dove = v === 'page-width' ? 'Adattata alla larghezza' : 'Adattata alla pagina intera';
      /* ⚠️ `senzaCiclo` è per le IMMAGINI, dove di modi ne resta uno solo.
         Misurato il 15 agosto: su una foto orizzontale dentro un riquadro alto,
         «alla pagina intera» e «alla larghezza» danno LO STESSO numero — il
         vincolo è già la larghezza — quindi il secondo stato del ciclo era un
         bottone che cambiava segno senza cambiare niente. Su un documento
         invece i due si distinguono, e là il ciclo resta.
         Il suggerimento allora non promette un altro adattamento: dice dove si
         è. Un bottone che promette e non mantiene è peggio di uno che tace. */
      if (senzaCiclo) {
        return { testo: SEGNI[v], titolo: dove + (pct ? ' — ' + pct : '') + ' — segue il riquadro' };
      }
      var altro = prossimoAdatta(v) === 'page-fit' ? 'alla pagina intera' : 'alla larghezza';
      return {
        testo: SEGNI[v],
        titolo: dove + (pct ? ' — ' + pct : '') + ' — segue il riquadro; clicca per adattare ' + altro
      };
    }
    return {
      testo: pct || '—',
      titolo: 'Zoom scelto a mano — clicca per adattare alla larghezza del riquadro'
    };
  }

  /**
   * La scala che realizza un modo, date le misure vere e quelle del riquadro.
   *
   * Per un PDF questo conto lo fa pdf.js; per un'IMMAGINE no — lì c'è solo un
   * `<img>` dentro un riquadro che scorre, e la scala siamo noi a doverla
   * decidere. La grammatica però è la stessa, e sta qui: due modi dinamici e un
   * numero, con gli stessi nomi (`page-width` · `page-fit`).
   *
   * ⚠️ `page-fit` NON è «il minimo fra i due rapporti» e basta: se l'immagine è
   * più piccola del riquadro il minimo sarebbe maggiore di 1, cioè ingrandirla
   * per riempire — e una foto da 200px sgranata a tutto schermo non è «adattata
   * alla pagina», è rovinata. Adattare vuol dire «fai in modo che ci stia», non
   * «riempi».
   */
  function scalaPer(valore, misure) {
    var m = misure || {};
    var nw = Number(m.larghezza) || 0, nh = Number(m.altezza) || 0;
    var cw = Number(m.riquadroL) || 0, ch = Number(m.riquadroH) || 0;
    if (!(nw > 0) || !(nh > 0)) return 1;
    var v = String(valore || '');
    var k;
    /* «Alla larghezza» RIEMPIE, e può ingrandire: è un comando esplicito, e su
       un PDF fa esattamente così. «Alla pagina» invece è la richiesta di vedere
       tutto, e vedere tutto non richiede mai di ingrandire. */
    if (v === 'page-width') k = cw > 0 ? cw / nw : 1;
    else if (v === 'page-fit') k = (cw > 0 && ch > 0) ? Math.min(cw / nw, ch / nh, 1) : 1;
    else {
      k = parseFloat(v);
      if (!isFinite(k) || k <= 0) k = 1;
      return Math.max(MIN, Math.min(MAX, k));
    }
    /* I limiti valgono anche per gli adattamenti: un francobollo da 40px
       adattato a un riquadro largo mille arriverebbe a 25×, cioè a un mosaico. */
    return Math.max(MIN, Math.min(MAX, k));
  }

  /**
   * Lo scorrimento che tiene fermo il punto sotto il puntatore.
   *
   * ⚠️ Torna a servire con le IMMAGINI. Per i PDF lo fa
   * `updateScale({origin})` di pdf.js — e rifarlo a mano vorrebbe dire
   * indovinare l'ordine di due correzioni che si sommano — ma un `<img>` dentro
   * un riquadro che scorre non ha nessuno che ci pensi.
   *
   * `px`/`py` sono le coordinate del puntatore DENTRO il riquadro (dal suo
   * bordo, non dallo schermo), `k` il rapporto fra la scala nuova e la vecchia.
   * Zoomare sul centro allontana proprio il punto che si sta guardando: è la
   * stessa regola già pagata sulle mappe.
   */
  function puntoFisso(o) {
    var s = o || {};
    var k = Number(s.k);
    if (!isFinite(k) || k <= 0) k = 1;
    var sl = Number(s.scrollLeft) || 0, st = Number(s.scrollTop) || 0;
    var px = Number(s.px) || 0, py = Number(s.py) || 0;
    return {
      left: Math.max(0, (sl + px) * k - px),
      top: Math.max(0, (st + py) * k - py)
    };
  }

  /**
   * Il verso di una rotellata.
   *
   * ⚠️ Con SHIFT premuto Chromium su macOS traduce la rotellata in scorrimento
   * ORIZZONTALE: `deltaY` arriva a 0 e il segno finisce su `deltaX`. Leggere
   * solo `deltaY` vuol dire un gesto che non fa niente su metà delle macchine.
   * Torna +1 (ingrandisci), −1 (riduci) o 0 (rotellata vuota: non si tocca la
   * scala, o un tocco del trackpad la farebbe saltare).
   */
  function verso(e) {
    var d = (e && Number(e.deltaY)) || 0;
    if (!d) d = (e && Number(e.deltaX)) || 0;
    if (!d) return 0;
    return d < 0 ? 1 : -1;
  }

  /**
   * Vale la pena riadattare per questo cambio di larghezza?
   *
   * ⚠️ IL PING-PONG DELLA BARRA DI SCORRIMENTO. Adattando alla larghezza la
   * barra verticale può comparire o sparire: la larghezza utile cambia di una
   * quindicina di pixel, l'osservatore riparte, la scala rimbalza. La soglia è
   * l'isteresi che rompe l'anello — sotto, il riadattamento non si fa.
   */
  function daRiadattare(valore, larghezza, ultima, soglia) {
    if (!(String(valore || '') === 'page-width' || String(valore || '') === 'page-fit')) return false;
    var w = Number(larghezza);
    if (!isFinite(w) || w <= 0) return false;
    var u = Number(ultima);
    if (!isFinite(u) || u <= 0) return true;
    return Math.abs(w - u) >= (Number(soglia) || 4);
  }

  return {
    MIN: MIN, MAX: MAX, PASSO: PASSO, MODI: MODI, MODI_NOTI: MODI_NOTI, SEGNI: SEGNI,
    modo: modo, valido: valido, passo: passo, prossimoAdatta: prossimoAdatta,
    etichetta: etichetta, verso: verso, daRiadattare: daRiadattare,
    scalaPer: scalaPer, puntoFisso: puntoFisso
  };
}));
