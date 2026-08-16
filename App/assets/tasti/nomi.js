/* ============================================================================
   tasti/nomi.js — i nomi dei tasti secondo la tastiera che si ha sotto le mani
   ============================================================================
   L'app è scritta su un Mac, e i suggerimenti lo dicevano: «Salva (Cmd+S)»,
   «Cerca nel documento (⌘F)», «tieni premuto ⌘». Su Windows quei simboli non
   stanno su nessun tasto: chi legge «⌘F» cerca un tasto che non ha, e conclude
   che la scorciatoia non c'è. Il codice invece funzionava già di là — tutte le
   guardie sono `e.metaKey || e.ctrlKey` — quindi il guasto era solo nel nome.

   ⚠️ PERCHÉ È UNA REGOLA E NON UNA SOSTITUZIONE. «⌘F» diventa «Ctrl+F», ma
   «tieni premuto ⌘» deve diventare «tieni premuto Ctrl», non «tieni premuto
   Ctrl+». Il segno del più appartiene alla COMBINAZIONE, non al tasto: dipende
   da che cosa viene dopo. Un `replace` secco sbaglia una delle due frasi, e
   sbagliarla è invisibile finché non si legge quella e non l'altra — per questo
   la regola sta qui, con una prova che le elenca tutte.

   Vale anche al contrario: su macOS «Cmd+S» diventa «⌘S», così le due scritture
   che convivevano nel monolite diventano una sola in tutte e due le lingue.

   Che cosa NON sta qui: trovare i suggerimenti nella pagina e riscriverli.
   Quello è pagina, e resta nel renderer.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TastiNomi = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Su Windows e Linux. L'ordine conta: le sequenze di due simboli prima dei
     simboli soli, o «⌘⇧C» diventerebbe «Ctrl+⇧C». */
  var ALTROVE = [
    [/⌘⇧/g, 'Ctrl+Shift+'],
    [/⌘⌥/g, 'Ctrl+Alt+'],
    [/⌥⌘/g, 'Ctrl+Alt+'],
    [/⇧⌘/g, 'Ctrl+Shift+'],
    /* Un modificatore seguito da un tasto è una combinazione: porta il «+».
       Da solo è il tasto, e il «+» sarebbe una promessa che non mantiene. */
    [/⌘(?=[0-9A-Za-z])/g, 'Ctrl+'],
    [/⇧(?=[0-9A-Za-z])/g, 'Shift+'],
    [/⌥(?=[0-9A-Za-z])/g, 'Alt+'],
    [/⌃(?=[0-9A-Za-z])/g, 'Ctrl+'],
    [/⌘/g, 'Ctrl'],
    [/⇧/g, 'Shift'],
    [/⌥/g, 'Alt'],
    [/⌃/g, 'Ctrl'],
    /* Le scritture per esteso che il monolite usava accanto ai simboli.
       ⚠️ «Maiusc» NON si tocca: su una tastiera italiana quel tasto si chiama
       così tanto su un Mac quanto su Windows, e tradurlo in «Shift» sarebbe
       inventare un tasto che chi legge non ha davanti. */
    [/\bCmd(?=[+\-])/g, 'Ctrl'],
    [/\bCmd\b/g, 'Ctrl'],
    [/\bOpt(?=[+\-])/g, 'Alt']
  ];

  /* Su macOS: una sola scrittura, quella coi simboli. */
  var MAC = [
    [/\bCmd\+/g, '⌘'],
    [/\bCmd-/g, '⌘'],
    [/\bCmd\b/g, '⌘']
  ];

  /**
   * Il testo di un suggerimento, con i nomi dei tasti della piattaforma.
   * `mac` è un booleano: chi chiama sa dove gira (nel browser lo dice
   * `suMac(navigator)`), qui dentro non si indovina niente.
   */
  function perPiattaforma(testo, mac) {
    var s = String(testo == null ? '' : testo);
    var regole = mac ? MAC : ALTROVE;
    for (var i = 0; i < regole.length; i++) s = s.replace(regole[i][0], regole[i][1]);
    return s;
  }

  /** Contiene un nome di tasto da tradurre? Serve a non riscrivere per niente
   *  i suggerimenti che di tasti non parlano. */
  function haTasti(testo) {
    return /[⌘⇧⌥⌃]|\bCmd\b|\bOpt\b/.test(String(testo == null ? '' : testo));
  }

  /**
   * Si è su un Mac?
   *
   * ⚠️ `navigator.platform` è deprecato ma è l'unico che risponde ovunque;
   * `userAgentData.platform` c'è su Chromium e va preferito quando c'è. Il
   * ripiego è lo userAgent, che su Electron contiene sempre «Macintosh».
   * Nessuno dei tre si può provare in Node: per questo la funzione prende il
   * navigatore invece di leggerlo da sé.
   */
  function suMac(nav) {
    var n = nav || {};
    var p = (n.userAgentData && n.userAgentData.platform) || n.platform || n.userAgent || '';
    return /mac|iphone|ipad|ipod/i.test(String(p));
  }

  return { perPiattaforma: perPiattaforma, haTasti: haTasti, suMac: suMac };
}));
