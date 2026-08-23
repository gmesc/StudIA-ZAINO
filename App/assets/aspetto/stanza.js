/* ============================================================================
   aspetto/stanza.js — la luce e la misura del testo, e come si ritrovano
   ============================================================================
   Due preferenze sole, e la stessa domanda per tutte e due: **che cosa fare di
   un valore che arriva dal disco?** Il tema (chiaro o scuro) e il corpo del
   testo si scelgono con tre bottoni in testata, si scrivono nel `localStorage`
   e si rileggono all'avvio. Qui dentro c'è solo la regola: che cosa è lecito,
   che cosa succede al passo, e che cosa vuol dire «di fabbrica».

   ⚠️ PERCHÉ ESISTE. Fino al 23 agosto 2026 non si ricordava niente: chi legge
   meglio a diciannove pixel, o chi lavora di sera col tema scuro, rimetteva a
   posto la stanza a ogni avvio. Una preferenza che non si ricorda non è una
   preferenza: è una domanda posta ogni mattina, e la si pone proprio a chi ha
   meno energia da spenderci.

   ⚠️ E PERCHÉ È UN MODULO invece di due righe nei gestori dei bottoni. Perché
   qui dentro ci sono tre modi di sbagliare che a schermo si vedrebbero solo a
   occhio, e uno di essi l'app l'ha già pagato una volta sullo zoom del
   documento:

     · **il passo che INVERTE il gesto.** Un `Math.min` cieco sul valore massimo
       fa scendere premendo «+». È esattamente il difetto di `fonti/zoom.js`,
       che per questo restituisce «niente da fare» invece di un numero;
     · **il valore illeggibile che passa lo stesso.** Una stringa storta nel
       `localStorage` — scritta da una versione precedente, o da un dito — messa
       in `--fs` senza controllo dà `NaNrem`, e l'app si riapre con il testo di
       una misura che nessuno ha scelto. Peggio: non si può nemmeno leggere il
       bottone per rimediare;
     · **«di fabbrica» scritto come un numero.** Il valore di fabbrica del corpo
       sta nel CSS (`:root{--fs:17px}`), e i bottoni scrivono in `rem`. Chi
       «ripristina» scrivendo `1.06rem` non ripristina: inchioda in linea un
       numero che somiglia a quello di fabbrica e che smetterà di somigliargli
       il giorno che si ritocca il foglio di stile. Di fabbrica vuol dire
       NESSUNO STILE IN LINEA, e qui si dice con `null`.

   ⚠️ Niente DOM e niente `localStorage`: quelli sono del renderer, che li ha
   davanti. Qui entrano stringhe ed escono valori, e si prova in quaranta
   millisecondi invece che in quaranta secondi di Electron. Stessa scelta di
   `suMac(nav)` in `tasti/nomi.js` e di tutto `fonti/zoom.js`.

     node test/stanza.js
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AspettoStanza = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* I due temi, e il primo è quello di fabbrica: `<html data-theme="chiaro">`
     sta scritto nel markup, e chi non ha mai toccato niente deve trovare
     l'app com'era il giorno prima. */
  var TEMI = ['chiaro', 'scuro'];

  /* Le tinte del foglio, per chi legge male sul bianco pieno. Solo i NOMI: i
     colori stanno nel foglio di stile, come tutti gli altri.
     ⚠️ È l'invariante 8 alla lettera — «il vestito non si ricopia». Se i valori
     stessero qui, il giorno che si ritocca una tinta ci sarebbero due verità e
     la prima che diverge è quella che si vede. Qui c'è la REGOLA (quali tinte
     esistono, che cosa vuol dire un nome che non conosciamo); l'aspetto lo dice
     `html[data-tinta="…"]`. */
  var TINTE = ['nessuna', 'crema', 'azzurro', 'grigio'];

  /* Le misure del corpo, in `rem`. Non sono scelte a caso:
     · FABBRICA è il valore che i bottoni avevano già in memoria (1,06rem, cioè
       i 17px del foglio di stile su una radice da 16);
     · il PASSO è quello di prima, e resta uno scalino percepibile senza essere
       un salto;
     · MIN e MAX sono i limiti che i due bottoni già applicavano. */
  var FABBRICA = 1.06, PASSO = 0.08, MIN = 0.9, MAX = 1.5;

  /* Il confronto fra numeri a virgola mobile non si fa con `===`: 1.06 più otto
     centesimi cinque volte non fa esattamente 1.46. Un millesimo di rem è
     mezzo centesimo di pixel, cioè meno di quanto uno schermo sappia disegnare:
     sotto quella soglia due misure sono la stessa misura. */
  var EPS = 0.001;
  function arrotonda(v) { return Math.round(v * 1000) / 1000; }

  /**
   * Il tema che si deve accendere, dato quello che c'era scritto.
   *
   * ⚠️ Tutto ciò che non si capisce diventa CHIARO, e il ripiego non è neutro:
   * è il tema del markup, cioè quello che vede chi non ha mai scelto. Ripiegare
   * sullo scuro per un carattere storto in una preferenza vorrebbe dire un'app
   * che si riapre diversa senza che nessuno l'abbia chiesto.
   */
  function tema(v) {
    var s = (v == null) ? '' : String(v).trim().toLowerCase();
    return TEMI.indexOf(s) >= 0 ? s : 'chiaro';
  }

  /** L'altro dei due: è tutto ciò che serve all'interruttore in testata. */
  function altroTema(v) { return tema(v) === 'scuro' ? 'chiaro' : 'scuro'; }

  /**
   * La tinta del foglio, dato quello che c'era scritto.
   *
   * ⚠️ Il ripiego è «nessuna», cioè il bianco che il PDF ha davvero. Ripiegare
   * su una tinta per un nome storto vorrebbe dire un documento che si riapre
   * colorato senza che nessuno l'abbia chiesto — e su un documento a colori
   * quella tinta si sommerebbe alle figure.
   */
  function tinta(v) {
    var s = (v == null) ? '' : String(v).trim().toLowerCase();
    return TINTE.indexOf(s) >= 0 ? s : 'nessuna';
  }

  /** La tinta dopo aver scelto quella dopo: serve a un comando che cicla senza
   *  aprire un pannellino. Gira in tondo, e «nessuna» è una delle quattro. */
  function tintaDopo(v) {
    var i = TINTE.indexOf(tinta(v));
    return TINTE[(i + 1) % TINTE.length];
  }

  /**
   * Il corpo del testo che si deve applicare, dato quello che c'era scritto.
   *
   * → un numero fra MIN e MAX, oppure **`null`**, che vuol dire «di fabbrica»:
   *   nessuno stile in linea, comanda il foglio di stile.
   *
   * ⚠️ `null` NON è «MIN» e non è «FABBRICA scritto in linea». È l'assenza, e
   * la differenza si vede il giorno che qualcuno ritocca `--fs` nel CSS: chi
   * non ha mai toccato i bottoni deve seguire quel ritocco, chi ha scelto una
   * misura no.
   *
   * ⚠️ Un valore FUORI SCALA non si stringe ai limiti, si butta. Stringerlo
   * vorrebbe dire trattare «3» (un dito su una preferenza) come una scelta
   * deliberata di ingrandire al massimo; e un valore che non sappiamo leggere
   * non è una scelta, è rumore.
   */
  function corpo(v) {
    if (v == null || v === '' || v === true || v === false) return null;
    var n = (typeof v === 'number') ? v : parseFloat(String(v));
    if (!isFinite(n)) return null;
    if (n < MIN - EPS || n > MAX + EPS) return null;
    return arrotonda(Math.min(MAX, Math.max(MIN, n)));
  }

  /**
   * Il corpo dopo una premuta di «A+» (`su` vero) o «A−».
   *
   * → il valore nuovo, oppure **`null`** se non c'è niente da fare perché si è
   *   già al capo.
   *
   * ⚠️ È il difetto di `fonti/zoom.js` pagato una seconda volta a metà prezzo:
   * là un `Math.min` cieco faceva SCENDERE premendo «+» a un livello già oltre
   * il tetto. Qui, al tetto, «+» non risponde — e chi chiama non scrive niente
   * invece di scrivere lo stesso valore, che è la stessa cosa detta meglio.
   *
   * ⚠️ Il punto di partenza di chi non ha ancora scelto è FABBRICA, non MIN:
   * il primo «A+» deve ingrandire il testo che si sta guardando, non saltare
   * da un'altra parte.
   */
  function passo(v, su) {
    var da = corpo(v);
    if (da === null) da = FABBRICA;
    var a = arrotonda(da + (su ? PASSO : -PASSO));
    if (a > MAX) a = MAX;
    if (a < MIN) a = MIN;
    if (Math.abs(a - da) < EPS) return null;   // già al capo: niente da fare
    return a;
  }

  /**
   * Che cosa scrivere nella variabile `--fs`, dato un corpo.
   * `null` in entrata o corpo illeggibile → `null`, cioè «togli lo stile».
   */
  function stile(v) {
    var n = corpo(v);
    return (n === null) ? null : (n + 'rem');
  }

  return {
    TEMI: TEMI, TINTE: TINTE, FABBRICA: FABBRICA, PASSO: PASSO, MIN: MIN, MAX: MAX,
    tema: tema, altroTema: altroTema, tinta: tinta, tintaDopo: tintaDopo,
    corpo: corpo, passo: passo, stile: stile
  };
}));
