/* ============================================================================
   fonti/pagina.js — «aprite a pagina 142»
   ============================================================================
   Che cosa vuol dire quello che uno scrive nel contatore delle pagine, che cosa
   ci scrive sopra il contatore, e come si appiattisce il sommario che il PDF si
   porta dentro.

   ⚠️ PERCHÉ ESISTE. «Aprite a pagina 142» è la frase più detta in un'aula: il
   professore cita pagine, l'indice cita pagine, l'appunto cita pagine. Nell'app
   l'unico modo di arrivare a una pagina lontana era la rotella — la guida lo
   dichiarava come un limite («Non si scrive un numero qui»). E il sommario, sui
   PDF che ce l'hanno, è già scritto dentro il file: nessuno deve costruirlo.

   ⚠️ E PERCHÉ È UN MODULO. Qui c'è la parte che si sbaglia e che a schermo si
   proverebbe solo a occhio, un caso limite alla volta: lo zero, il numero più
   grande del documento, gli spazi, la «p.» davanti, il campo vuoto, e — la più
   pericolosa — **la differenza fra «non ho capito» e «vai a pagina 1»**. Le due
   cose sembrano vicine e non lo sono: chi batte tre lettere per sbaglio e si
   ritrova al frontespizio ha perso il punto in cui stava leggendo.

   ⚠️ LE ETICHETTE SONO UN INGRESSO, MAI UN RIMANDO. Un PDF può dichiarare che
   la sua terza pagina si chiama «iii» o «A-4» (`getPageLabels()`), ed è quello
   che uno legge stampato in basso. Qui si accetta di batterla — è la cosa che
   uno ha davanti agli occhi — ma il contatore continua a dire il numero FISICO,
   e `pdf:NN#p=` continua a citare quello. Due numerazioni dentro la grammatica
   dei rimandi sarebbero due grammatiche (invariante 7), e i rimandi già scritti
   punterebbero altrove.

   Niente DOM, niente pdf.js: chi ha il documento gli chiede `numPages`,
   `getPageLabels()` e `getOutline()`, e passa qui quello che ha ottenuto. È la
   stessa divisione di `fonti/zoom.js`, e serve alla stessa cosa: provare tutto
   in quaranta millisecondi invece che in quaranta secondi di Electron.

     node test/pagina-fonte.js
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FontiPagina = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function str(v) { return (v == null) ? '' : String(v); }
  function quante(o) {
    var n = parseInt((o && o.numPages), 10);
    return (isFinite(n) && n > 0) ? n : 0;
  }

  /**
   * Che cosa vuol dire quello che uno ha scritto.
   *
   * → il numero di pagina a cui andare, oppure **`null`** = «non ho capito, non
   *   si muove niente».
   *
   * ⚠️ `null` NON È PAGINA 1, ed è la distinzione che questo file esiste per
   * tenere ferma. Un ripiego su 1 manderebbe al frontespizio chi ha battuto una
   * lettera per sbaglio, facendogli perdere il punto in cui stava leggendo — e
   * senza dirglielo.
   *
   * ⚠️ Un numero FUORI SCALA invece si stringe, non si butta, ed è il contrario
   * di quel che fa `aspetto/stanza.js` con una misura fuori scala. La differenza
   * non è un capriccio: là il valore arriva dal disco e un valore che non
   * sappiamo leggere è RUMORE; qui l'ha appena battuto una persona, ed è un
   * INTENTO. Chi scrive 9999 su un documento di 266 pagine sta dicendo «portami
   * in fondo», e portarcelo è la risposta giusta.
   */
  function leggi(testo, o) {
    var n = quante(o);
    var s = str(testo).trim();
    if (!s) return null;

    /* Le etichette per prime: se un PDF dichiara che la sua terza pagina si
       chiama «iii», chi batte «iii» ha in mano quella pagina e intende quella.
       ⚠️ E vince sul numero: in un libro con la prefazione in numeri romani
       esistono una pagina «1» fisica (la copertina) e una pagina etichettata
       «1» (l'inizio del testo). Quella che uno intende è la seconda — è quella
       stampata sul foglio. */
    var et = (o && o.etichette) || null;
    if (et && et.length) {
      var cerca = s.toLowerCase().replace(/^p(ag(ina)?)?\.?\s*/i, '').trim();
      for (var i = 0; i < et.length; i++) {
        if (str(et[i]).trim().toLowerCase() === cerca && cerca) return i + 1;
      }
    }

    /* «p. 142», «pag 142», «142»: il numero è la cosa, il resto è cortesia.
       ⚠️ Si richiede che DOPO il numero non ci sia altro: «142a» e «1 di 2» non
       sono richieste di andare a una pagina, sono cose che non abbiamo capito. */
    var m = /^p(?:ag(?:ina)?)?\.?\s*(\d+)$/i.exec(s) || /^(\d+)$/.exec(s);
    if (!m) return null;
    var p = parseInt(m[1], 10);
    if (!isFinite(p)) return null;
    if (p < 1) p = 1;
    if (n && p > n) p = n;
    return p;
  }

  /**
   * Che cosa scrive il contatore. Sempre il numero FISICO: è quello che contano
   * i bottoni ‹ ›, quello che cita `pdf:NN#p=`, e quello che il campo qui sopra
   * restituisce.
   */
  function etichetta(pagina, o) {
    var n = quante(o);
    var p = parseInt(pagina, 10);
    if (!isFinite(p) || p < 1) p = 1;
    return 'p. ' + p + (n ? (' di ' + n) : '');
  }

  /**
   * Il suggerimento del contatore: dice che si può scrivere, e — se il documento
   * ha le etichette — come si chiama la pagina di adesso secondo il documento.
   *
   * ⚠️ L'etichetta si nomina SOLO se dice qualcosa di diverso dal numero fisico.
   * Su un PDF le cui etichette sono «1, 2, 3…» ripeterla sarebbe rumore.
   */
  function suggerimento(pagina, o) {
    var et = (o && o.etichette) || null;
    var p = parseInt(pagina, 10);
    var base = 'Vai a una pagina: premi e scrivi il numero';
    if (!et || !et.length || !isFinite(p) || p < 1 || p > et.length) return base;
    var mia = str(et[p - 1]).trim();
    if (!mia || mia === String(p)) return base;
    return base + ' — questa pagina il documento la chiama «' + mia + '», e va bene anche quella';
  }

  /**
   * Il sommario del PDF, da albero a elenco.
   *
   * pdf.js dà `getOutline()` come alberatura (`{title, items:[…]}`), e un menu è
   * una lista: qui si appiattisce tenendo il LIVELLO, che è la sola cosa che
   * dice a chi guarda dove sta un capitolo dentro l'altro.
   *
   * ⚠️ La destinazione NON si risolve qui: `dest` diventa un numero di pagina
   * solo chiedendolo al documento (`getPageIndex`), che è asincrono e vive nel
   * renderer. Qui si porta avanti così com'è, senza guardarci dentro.
   *
   * ⚠️ Le voci senza titolo si buttano: una riga vuota in un menu è una riga su
   * cui si clicca senza sapere dove si va. E la profondità si ferma: un sommario
   * malfatto può annidarsi all'infinito, e un menu di quarantotto livelli non è
   * un menu.
   */
  function appiattisci(albero, opz) {
    var max = (opz && opz.maxLivelli) || 4;
    var out = [];
    function scendi(voci, liv) {
      if (!voci || !voci.length || liv >= max) return;
      for (var i = 0; i < voci.length; i++) {
        var v = voci[i] || {};
        var t = str(v.title).replace(/\s+/g, ' ').trim();
        if (t) out.push({ titolo: t, livello: liv, dest: v.dest });
        scendi(v.items, liv + 1);
      }
    }
    scendi(albero, 0);
    return out;
  }

  return {
    leggi: leggi, etichetta: etichetta,
    suggerimento: suggerimento, appiattisci: appiattisci
  };
}));
