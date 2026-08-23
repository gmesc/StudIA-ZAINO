/* ============================================================================
   fonti/righello.js — dove passano le righe di una pagina
   ============================================================================
   La finestra sulla riga è una fascia chiara che scorre sul documento e lascia
   in ombra il resto: la mascherina di cartoncino che ogni tutor DSA mette in
   mano per primo, e l'unico attrezzo di questa lista che esisteva sulla carta
   prima che esistesse sul computer. Isola la riga, toglie il salto di rigo, e
   dà all'occhio un posto solo dove stare.

   Qui dentro c'è la sola cosa che serve saperne senza guardare: **a che altezze
   passano le righe**. Entrano i rettangoli dei pezzi di testo (li dà il layer di
   pdf.js), esce l'elenco delle bande.

   ⚠️ PERCHÉ È UN MODULO. Raggruppare pezzi in righe è la parte che sbaglia in
   silenzio, e i modi di sbagliarla non si vedono a occhio:

     · **gli apici e le note.** Un «2» in esponente è alto la metà e sta più su:
       col centro fuori tolleranza diventa una riga sua, e la fascia si ferma
       due volte sulla stessa riga di testo;
     · **i corpi diversi.** Un titolo alto ventotto pixel e il testo che gli sta
       accanto non hanno lo stesso centro, ma sono la stessa riga;
     · **le due colonne.** Due pezzi lontanissimi in orizzontale possono essere
       la stessa banda — e devono esserlo, perché la fascia è ORIZZONTALE e
       attraversa la pagina. Chi raggruppasse per vicinanza in x farebbe due
       righe dove l'occhio ne vede una;
     · **i pezzi che si sovrappongono appena.** Due decimi di pixel di distanza
       fra due `top` non sono due righe, sono la stessa riga misurata due volte.

   ⚠️ IL CRITERIO NON È IL CENTRO, È LA SOVRAPPOSIZIONE. Due pezzi stanno sulla
   stessa riga se le loro fasce verticali si accavallano per più di metà del più
   basso dei due. È l'unico criterio che tiene insieme un apice e la sua parola
   senza incollare due righe vicine.

   Niente DOM: entrano numeri, escono numeri. Chi ha la pagina misura i
   rettangoli e li passa. Stessa divisione di `fonti/zoom.js`.

     node test/righello.js
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FontiRighello = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }

  /* Un rettangolo utile è alto: quelli a zero sono pezzi che il layer monta e
     non disegna, e una banda alta zero è una fascia che non si vede. */
  function fascia(r) {
    if (!r) return null;
    var t = num(r.top), b = num(r.bottom);
    if (t === null) return null;
    if (b === null) { var h = num(r.height); b = (h === null) ? null : t + h; }
    if (b === null || b - t <= 0) return null;
    return { alto: t, basso: b };
  }

  /** Quanto due fasce si accavallano, in parte del più basso dei due. */
  function accavallo(a, b) {
    var sopra = Math.max(a.alto, b.alto), sotto = Math.min(a.basso, b.basso);
    var comune = sotto - sopra;
    if (comune <= 0) return 0;
    return comune / Math.min(a.basso - a.alto, b.basso - b.alto);
  }

  /**
   * Dalle caselle dei pezzi alle BANDE DI RIGA.
   *
   * `caselle`: rettangoli con almeno `top` e (`bottom` o `height`).
   * `opz.quota`: quanto devono accavallarsi due pezzi per essere la stessa riga
   *              (parte del più basso). Di fabbrica **0,5**: mezzo pezzo.
   *
   * → `[{alto, basso, centro}]`, in ordine di lettura.
   */
  function righe(caselle, opz) {
    var quota = (opz && num(opz.quota) !== null) ? num(opz.quota) : 0.5;
    var f = [];
    for (var i = 0; i < ((caselle && caselle.length) || 0); i++) {
      var x = fascia(caselle[i]);
      if (x) f.push(x);
    }
    if (!f.length) return [];
    f.sort(function (a, b) { return a.alto - b.alto || a.basso - b.basso; });

    var out = [];
    var cur = { alto: f[0].alto, basso: f[0].basso };
    for (var j = 1; j < f.length; j++) {
      /* ⚠️ Il confronto è con la banda CRESCIUTA fin qui, non con l'ultimo
         pezzo: una riga fatta di un titolo alto e di un apice basso si tiene
         insieme solo se ogni pezzo nuovo si misura contro tutto quello che la
         riga è diventata. */
      if (accavallo(cur, f[j]) >= quota) {
        cur.alto = Math.min(cur.alto, f[j].alto);
        cur.basso = Math.max(cur.basso, f[j].basso);
      } else {
        out.push(cur);
        cur = { alto: f[j].alto, basso: f[j].basso };
      }
    }
    out.push(cur);
    return out.map(function (b) {
      return { alto: b.alto, basso: b.basso, centro: (b.alto + b.basso) / 2 };
    });
  }

  /**
   * Su quale banda cade un'altezza. → l'indice, oppure **-1** se sta fra due
   * righe (nell'interlinea) o fuori dalla pagina.
   *
   * ⚠️ `-1` NON è «la prima»: il puntatore che passa nell'interlinea non deve
   * far saltare la fascia in cima alla pagina.
   */
  function sotto(bande, y) {
    var v = num(y); if (v === null) return -1;
    for (var i = 0; i < ((bande && bande.length) || 0); i++) {
      if (v >= bande[i].alto && v <= bande[i].basso) return i;
    }
    return -1;
  }

  /**
   * La banda più vicina a un'altezza. → l'indice, oppure -1 se non ce n'è
   * nessuna. È quello che serve al puntatore: la fascia segue il mouse anche
   * quando passa nell'interlinea, invece di sparire e riapparire.
   */
  function vicina(bande, y) {
    var v = num(y); if (v === null || !bande || !bande.length) return -1;
    var best = -1, dist = Infinity;
    for (var i = 0; i < bande.length; i++) {
      var d = (v < bande[i].alto) ? (bande[i].alto - v)
        : (v > bande[i].basso) ? (v - bande[i].basso) : 0;
      if (d < dist) { dist = d; best = i; }
    }
    return best;
  }

  /**
   * La banda dopo (o prima), per le frecce. → l'indice nuovo, oppure **`null`**
   * se non c'è niente da fare perché si è al capo.
   *
   * ⚠️ Non gira in tondo, e non è un dettaglio: chi legge con la fascia e arriva
   * in fondo alla pagina non vuole ritrovarsi in cima — vuole accorgersi che la
   * pagina è finita. È la stessa scelta di `fonti/zoom.js` e di
   * `aspetto/stanza.js`: al capo si risponde «niente da fare».
   */
  function passo(bande, i, giu) {
    var n = (bande && bande.length) || 0;
    if (!n) return null;
    var da = num(i);
    /* Da nessuna parte si comincia dalla prima (o dall'ultima, andando su). */
    if (da === null || da < 0 || da >= n) return giu ? 0 : n - 1;
    var a = da + (giu ? 1 : -1);
    if (a < 0 || a >= n) return null;
    return a;
  }

  return { righe: righe, sotto: sotto, vicina: vicina, passo: passo };
}));
