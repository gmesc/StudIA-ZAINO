/* ============================================================================
   lettura/misura.js — quanto è larga un'immagine dentro un testo
   ============================================================================
   Un'immagine citata in un appunto si scrive così:

     ![La curva di Galton](album:9f2c1a4b7e)          la sua misura naturale
     ![La curva di Galton|60%](album:9f2c1a4b7e)      il 60% della colonna

   La misura sta nella DIDASCALIA, dopo una barra verticale, e non dentro le
   parentesi. Non è un vezzo:

   ⚠️ `(album:<id>)` deve restare identico carattere per carattere. Chi lo cerca
   per sapere dove un'immagine è usata (`lib/album.js` → `usi`, che decide se
   cancellarla è un gesto silenzioso o una domanda) e chi la sostituisce dopo un
   ritaglio (`fotoSostituisciInserimento`, che cerca proprio `(album:<id>)`)
   troverebbero una stringa diversa e direbbero «non c'è», in silenzio. Una
   misura è una proprietà di COME si vede quell'immagine lì, non di DA DOVE
   viene: la stessa foto in due appunti può essere larga in modi diversi.

   ⚠️ E la barra è la convenzione di Obsidian per la stessa identica cosa
   (`![alt|300](file.png)`): il vault è dell'utente e i suoi `.md` si aprono
   anche di là, quindi dove esiste già un modo di dirlo non se ne inventa un
   secondo. Qui è una PERCENTUALE e non dei pixel — vedi `limita`.

   ⚠️ PERCHÉ LEGGERE E SCRIVERE STANNO NELLO STESSO FILE. Sono due metà di una
   grammatica sola, e separarle vuol dire che un giorno una scrive quello che
   l'altra non sa leggere. È la storia già pagata di `rimandi/sintassi.js`: la
   stessa sintassi in cinque punti diversi, e tre guasti in due giorni.

   Qui non si disegna niente e non si tocca nessun file: si passa da una stringa
   ai suoi pezzi, e viceversa.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LetturaMisura = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* La misura in coda alla didascalia. ⚠️ In CODA e con la barra più a destra:
     una didascalia può contenere delle barre («prima|dopo»), e quella che conta
     è l'ultima. Solo cifre intere: `|33,5%` non è una misura, è testo — chi
     l'ha scritto voleva dire qualcosa d'altro, e mangiargliela sarebbe peggio
     che ignorarla. */
  var RE = /^([\s\S]*)\|(\d{1,3})%$/;

  /** Il minimo e il massimo, e perché sono questi.
   *
   *  ⚠️ È una percentuale della COLONNA, non della misura naturale
   *  dell'immagine. Con la misura naturale il gesto non farebbe niente proprio
   *  sul caso che lo fa nascere: una foto importata ha il lato lungo fino a
   *  3000px (PIANO-FOTO §2), la colonna ne è larga cinque-seicento, e portarla
   *  all'80% del naturale la lascerebbe identica — sempre più larga del tetto.
   *
   *  Sopra il 100 non si va: `max-width:100%` la fermerebbe lì comunque, e un
   *  comando che mostra «125%» senza cambiare niente insegna che l'app mente.
   *  Sotto il 10 non si scende: un'immagine alta dieci pixel non è più piccola,
   *  è sparita. */
  var MIN = 10, MAX = 100;
  function limita(p) {
    var n = Math.round(Number(p));
    if (!isFinite(n) || n <= 0) return 0;
    return Math.max(MIN, Math.min(MAX, n));
  }

  /**
   * La didascalia e la sua misura. `percento` è 0 quando la misura non c'è —
   * cioè «come viene», che NON è la stessa cosa di 100 (vedi `scrivi`).
   */
  function leggi(alt) {
    var s = String(alt == null ? '' : alt);
    var m = RE.exec(s);
    if (!m) return { didascalia: s, percento: 0 };
    var p = limita(m[2]);
    if (!p) return { didascalia: s, percento: 0 };
    return { didascalia: m[1], percento: p };
  }

  /**
   * Da didascalia e misura all'`alt` da scrivere nel file.
   *
   * ⚠️ A misura assente NON si scrive `|100%`: un campo scritto per dire
   * «normale» sporca il file dell'utente e lo fa cambiare a ogni giro senza che
   * sia cambiato niente. È la stessa regola con cui `mappa/modifica.js`
   * cancella `scala` quando il nodo torna a 1.
   *
   * ⚠️ E 100% non è «come viene»: una figurina da 200px portata al 100% RIEMPIE
   * la colonna. Ingrandire è lecito solo quando è un comando esplicito — è la
   * differenza già scritta in PIANO-FOTO fra «pagina intera», che non ingrandisce
   * mai, e «alla larghezza», che riempie. Qui l'utente ha chiesto una misura, e
   * la misura si rispetta.
   */
  function scrivi(didascalia, percento) {
    var d = String(didascalia == null ? '' : didascalia);
    var p = limita(percento);
    return p ? (d + '|' + p + '%') : d;
  }

  /** Una didascalia che arriva da fuori (il nome di un file, un titolo scritto
   *  a mano) non deve poter sembrare una misura: si toglie la barra, come già
   *  si tolgono le quadre che spezzerebbero il markdown. */
  function ripulisci(didascalia) {
    return String(didascalia == null ? '' : didascalia).replace(/[\[\]|]/g, '');
  }

  /** Un passo più piccola, o più grande. ⚠️ Moltiplicativo (×1,25) e non
   *  additivo: da 20 a 25 il salto si vede, da 95 a 100 no, e il gesto deve
   *  pesare uguale a ogni grandezza. Stesso passo del ridimensionamento dei
   *  nodi-immagine sulla mappa: due volte lo stesso gesto, non due dialetti. */
  function passo(percento, verso) {
    var ora = limita(percento) || MAX;
    return limita(verso === '+' ? ora * 1.25 : ora / 1.25);
  }

  /** Le parentesi di un rimando dentro un'espressione regolare: `fig:03#p=7&i=2`
   *  porta caratteri che là dentro vogliono dire altro. */
  function _quota(s) { return String(s == null ? '' : s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /** Tutte le immagini che citano lo stesso bersaglio, in ordine di lettura. */
  function _tutte(testo, bersaglio) {
    var re = new RegExp('!\\[([^\\]]*)\\]\\(' + _quota(bersaglio) + '\\)', 'g');
    var out = [], m;
    while ((m = re.exec(String(testo == null ? '' : testo)))) out.push(m[1]);
    return out;
  }

  /**
   * La misura che ha ADESSO una certa immagine dentro un testo. 0 se non ne ha,
   * o se quell'occorrenza non c'è.
   *
   * ⚠️ Si chiede al TESTO, non a quello che il menu ha mostrato un attimo fa.
   * Fra un passo e l'altro l'anteprima si rifà da capo e il nodo che si era
   * cliccato non esiste più: leggere dalla sorgente è l'unico modo perché il
   * numero in testa al menu dica quello che è scritto sul disco.
   */
  function misuraDi(testo, bersaglio, occorrenza) {
    if (!bersaglio) return 0;
    var alt = _tutte(testo, bersaglio)[Math.max(0, Math.floor(Number(occorrenza) || 0))];
    return alt == null ? 0 : leggi(alt).percento;
  }

  /**
   * Riscrive la misura di UNA immagine dentro un testo.
   *
   * `bersaglio` è il rimando fra parentesi (`album:9f2c…`, `fig:03#p=7&i=2`) e
   * `occorrenza` dice quale, contando da zero fra quelle che citano lo stesso
   * bersaglio: la stessa immagine può comparire due volte nello stesso blocco, e
   * ridimensionarle tutte e due quando se ne è toccata una è una perdita
   * silenziosa quanto perderne una.
   *
   * Torna il testo INVARIATO se quel bersaglio lì non c'è: chi chiama deve
   * poterlo sapere confrontando, invece di ricevere un testo rimaneggiato a
   * caso. È la stessa forma di `MappaModifica.ridimensionaImmagine`, che
   * restituisce il grafo di prima quando il nodo non porta un'immagine.
   */
  function cambia(testo, bersaglio, occorrenza, percento) {
    var s = String(testo == null ? '' : testo);
    if (!bersaglio) return s;
    var re = new RegExp('!\\[([^\\]]*)\\]\\(' + _quota(bersaglio) + '\\)', 'g');
    var n = Math.max(0, Math.floor(Number(occorrenza) || 0)), i = -1;
    return s.replace(re, function (m, alt) {
      i++;
      if (i !== n) return m;
      return '![' + scrivi(leggi(alt).didascalia, percento) + '](' + bersaglio + ')';
    });
  }

  return {
    MIN: MIN, MAX: MAX,
    limita: limita, leggi: leggi, scrivi: scrivi, ripulisci: ripulisci,
    passo: passo, cambia: cambia, misuraDi: misuraDi
  };
}));
