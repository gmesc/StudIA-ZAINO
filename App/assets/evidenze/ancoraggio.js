/* =========================================================================
   ancoraggio — ritrovare un pezzo di testo dopo che l'HTML è stato rifatto.

   L'utente evidenzia una parola dentro il capitolo. Ma l'HTML del capitolo lo
   fabbrica la pipeline, e domani lo rifabbrica: dentro quell'HTML l'evidenza
   non può abitare, perché sparirebbe alla prima rigenerazione. Si salva
   altrove e si RIAPPLICA a ogni apertura — e per riapplicarla serve un modo di
   dire «questo pezzo di testo» che sopravviva alla rigenerazione.

   Lo schema è il TextQuoteSelector del W3C Web Annotation Data Model:
   { exact, prefix, suffix }. Si descrive IL TESTO, non la posizione. Una
   posizione — il carattere 4.812, il terzo <p> — è la prima cosa che una
   rigenerazione sposta; una frase con la sua frase attorno è la cosa che più
   probabilmente resta com'era.

   ⚠️ Niente fuzzy matching, e non per pigrizia: o il match è ESATTO, o
   l'evidenza è ORFANA e lo dichiara. Su parole brevi l'approssimazione produce
   falsi positivi — l'evidenza si accende sulla parola sbagliata e nessuno se
   ne accorge — ed è un guasto noto al progetto Hypothesis, che il fuzzy ce
   l'ha. Qui vale la regola di casa: meglio un'evidenza orfana e dichiarata di
   una accesa nel punto sbagliato in silenzio. Se un giorno servirà davvero, si
   vendorizza `approx-string-match` e lo si aggiunge come TERZO passo dopo i
   due qui sotto, senza toccarli — per questo `trova` marca l'esito con
   `esatto:true` invece di lasciarlo sottinteso: il giorno che nasce un match
   approssimato, chi legge deve poterlo distinguere senza cambiare firma.

   IL CONFINE, che è la decisione di progetto più importante di questo file:
   qui dentro esistono soltanto STRINGHE E INDICI. Niente DOM, niente `Range`,
   niente `document`, niente `window`. Il ponte fra i nodi di testo del DOM e
   gli offset in una stringa lo costruisce il renderer — è la stessa divisione
   per cui `layouts.js` conosce la geometria e `disegna.js` conosce l'SVG. Un
   modulo che importasse il DOM non si potrebbe provare in Node, e i test di
   questa casa girano in Node.

   IL PATTO SULLA NORMALIZZAZIONE — sceglierlo è obbligatorio, perché appena si
   normalizza il testo gli indici non indicano più il testo di prima. Le due
   strade oneste erano: (a) il chiamante normalizza UNA VOLTA e da lì in avanti
   tutti — selezione, salvataggio, ricerca — lavorano su quella stringa;
   (b) `normalizza` restituisce anche una mappa indice→indice.
   Qui vale la (a): questo modulo espone `normalizza` ma non la applica MAI da
   sé, né in `daTesto` né in `trova`.
   Perché la (a): il ponte DOM↔stringa deve comunque costruire la propria mappa
   (quale nodo di testo, e quale offset dentro il nodo, corrisponde all'offset
   globale N). Se quel ponte emette già testo normalizzato, la mappa resta UNA.
   Con la (b) diventerebbero due mappe da comporre, e una composizione
   sbagliata di mappe non si vede a schermo: l'evidenza si accende due
   caratteri più in là e sembra solo una svista di selezione.
   ⚠️ Conseguenza operativa, non negoziabile: `daTesto` e `trova` devono
   ricevere LA STESSA specie di stringa. Un selettore costruito sul testo
   grezzo e cercato in quello normalizzato non si ritrova quasi mai — diventa
   orfano senza che nulla sia cambiato nel capitolo. Chi chiama può accertarsi
   di essere in regola con `normalizza(t) === t`; qui non lo controlliamo a
   ogni chiamata perché sarebbe una scansione dell'intero capitolo per ogni
   singola evidenza.

   Che cosa NON sta qui, e non ci deve entrare:
     · il DOM, in qualunque forma — vedi sopra;
     · la lettura e la scrittura di `APPUNTI/_evidenze.md`: sono `lib/`, e la
       scrittura passa da `appunti.writeAtomic`, mai da una seconda
       implementazione;
     · il colore, il tipo, l'etichetta di un'evidenza: qui una voce è un
       selettore, e tutto il resto le viaggia accanto senza che lo si guardi.

   Modulo PURO, UMD (vedi relazioni.js).
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EvidenzeAncoraggio = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Quanti caratteri di contesto si salvano per lato. 32 sono all'incirca
     cinque parole italiane: abbastanza per distinguere due ricorrenze della
     stessa parola dentro un capitolo, poco abbastanza da non gonfiare il file
     delle evidenze, dove il contesto pesa più del testo evidenziato.
     ⚠️ È una stima ragionata, NON una misura: sul corpus di questo progetto
     non l'ho contata. Chi ha bisogno di altro lo passa in `opt.contesto`, e se
     un giorno si conteranno le orfane vere questo numero è il primo da
     rimettere in discussione. */
  var CONTESTO = 32;

  /* ------------------------------------------------------------ il confine */

  /** Al confine si accettano solo stringhe; tutto il resto vale stringa vuota.
   *  `prefix` e `suffix` sono facoltativi per natura — una selezione a inizio
   *  capitolo non ha niente prima — e un `undefined` non è un errore. */
  function stringa(x) { return typeof x === 'string' ? x : ''; }

  /** Un indice buono è un intero dentro [0, max]. Il controllo è sul TIPO, non
   *  su `+n`: `+null` e `+''` fanno zero, e zero è un indice legittimo — la
   *  prima parola del capitolo comincia lì. Un `null` scambiato per lo zero
   *  produrrebbe un selettore plausibile e sbagliato, che è il peggio. */
  function indiceBuono(n, max) {
    return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0 && n <= max;
  }

  /* ----------------------------------------------------- la normalizzazione */

  /**
   * Collassa ogni sequenza di spazi bianchi in un solo spazio.
   *
   * Serve perché il testo che si legge dal DOM non è il testo che si vede: gli
   * a capo dell'indentazione, le tabulazioni e i `&nbsp;` entrano in
   * `textContent` come caratteri veri. Due estrazioni della stessa frase da
   * due rigenerazioni diverse dello stesso capitolo differiscono quasi solo
   * per quelli — e qui, dove il match è esatto, un solo spazio di troppo manda
   * orfana un'evidenza che il lettore vede benissimo sullo schermo.
   *
   * Una sola espressione basta anche per i non-breaking space: il `\s` di
   * JavaScript comprende già U+00A0, U+202F e U+2007 (categoria Zs), e l'ho
   * verificato in Node prima di scriverlo. Resta fuori U+200B, lo zero-width
   * space, che è categoria Cf: se un giorno la pipeline ne producesse, andrà
   * tolto qui e non aggirato altrove.
   *
   * Non tocca accenti, punteggiatura, maiuscole. Quelle non sono rumore: sono
   * il testo, e appiattirle vorrebbe dire cercare una frase che l'utente non
   * ha evidenziato.
   */
  function normalizza(testo) {
    if (typeof testo !== 'string') return '';
    return testo.replace(/\s+/g, ' ');
  }

  /* ------------------------------------------------ quante parole PIENE ci sono */

  /**
   * Le parole vuote: articoli e preposizioni, semplici e articolate.
   *
   * Non contano perché non sono quello che si evidenzia. «Stati Uniti
   * d'America» è UN concetto di tre parole piene, e contando i token nudi ne
   * farebbe quattro — cioè cadrebbe fuori dalla regola delle tre proprio nel
   * caso per cui la regola è stata scritta.
   *
   * ⚠️ Elencate senza accenti né maiuscole perché il confronto avviene su testo
   * già abbassato: una voce scritta «Il» qui dentro non combacerebbe mai.
   */
  var VUOTE = {};
  ('il lo la i gli le l un uno una;' +
   'di a da in con su per tra fra;' +
   'del dello della dell dei degli delle;' +
   'al allo alla all ai agli alle;' +
   'dal dallo dalla dall dai dagli dalle;' +
   'nel nello nella nell nei negli nelle;' +
   'sul sullo sulla sull sui sugli sulle;' +
   'col collo colla coi cogli colle;' +
   'd n').split(/[;\s]+/).forEach(function (p) { if (p) VUOTE[p] = true; });

  /**
   * Le parole PIENE di un frammento: quelle che restano tolti articoli e
   * preposizioni.
   *
   *   parolePiene("Stati Uniti d'America")  → ['Stati', 'Uniti', 'America']
   *   parolePiene("la fotosintesi")         → ['fotosintesi']
   *
   * Serve alla regola «≤ 3 parole appuntate diventano anche parola chiave», e
   * sta qui perché è testo puro — la stessa ragione per cui ci sta `normalizza`.
   *
   * Tre scelte, tutte e tre visibili negli esempi sopra:
   * 1. **L'apostrofo separa**: `d'America` sono due token, e il primo è vuoto.
   *    Splittare solo sugli spazi terrebbe l'articolo attaccato al nome e lo
   *    conterebbe come parola piena.
   * 2. **La punteggiatura ai bordi si toglie**: chi seleziona con un doppio
   *    click si porta dietro la virgola, e «sinapsi,» non è una parola diversa
   *    da «sinapsi».
   * 3. **I trattini NON separano**: «pesco-mandorlo» è una parola sola perché
   *    così la legge chi studia; separarli ne farebbe due e la selezione
   *    cadrebbe fuori dalla regola per un trattino.
   */
  function parolePiene(testo) {
    if (typeof testo !== 'string') return [];
    /* Gli apostrofi tipografici (’ ‛ ´) diventano quello dritto prima di
       tagliare: i PDF ne sono pieni, e senza questa riga `dell’acqua` resterebbe
       un token solo — con l'articolo dentro, contato come parola piena. */
    var grezzo = testo.replace(/[‘’ʼ´]/g, "'");
    var pezzi = grezzo.split(/[\s']+/);
    var piene = [];
    pezzi.forEach(function (p) {
      /* Via la punteggiatura ai due bordi, lasciando stare quella interna:
         `«sinapsi,»` è la parola «sinapsi» con addosso i segni di chi l'ha
         selezionata, e `Sig.ra` resta intera.
         ⚠️ Il taglio è cieco ai bordi, quindi `d.C.` torna come `d.C` — il punto
         finale se ne va con le virgolette. Non si corregge: qui si CONTA, e un
         punto in meno non cambia né il conteggio né quello che l'utente vede
         evidenziato (l'evidenza porta il testo selezionato, non questo). */
      var pulito = p.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      if (!pulito) return;
      if (VUOTE[pulito.toLowerCase()]) return;
      piene.push(pulito);
    });
    return piene;
  }

  /* -------------------------------------------------------- la costruzione */

  /**
   * Costruisce il selettore per la fetta [inizio, fine) di `testo`.
   *
   *   daTesto(testo, inizio, fine, { contesto: 32 }) → { exact, prefix, suffix }
   *
   * Il contesto si tronca ai bordi senza lamentarsi: una selezione che
   * comincia al carattere zero ha `prefix` vuoto, e va bene così — è un fatto
   * sul testo, non un difetto del selettore.
   *
   * Ritorna `null` se gli indici non stanno in piedi o se `exact` risulterebbe
   * vuoto. Un selettore con `exact` vuoto combacerebbe ovunque: sarebbe
   * l'unico modo, in questo file, di accendere un'evidenza su un punto a caso.
   */
  function daTesto(testo, inizio, fine, opt) {
    if (typeof testo !== 'string') return null;
    if (!indiceBuono(inizio, testo.length) || !indiceBuono(fine, testo.length)) return null;
    if (fine <= inizio) return null;               // indici invertiti, o `exact` vuoto
    var c = quantoContesto(opt);
    return {
      exact: testo.slice(inizio, fine),
      prefix: testo.slice(Math.max(0, inizio - c), inizio),
      suffix: testo.slice(fine, Math.min(testo.length, fine + c))
    };
  }

  /** Zero è una richiesta legittima («salvami solo la parola»), quindi il
   *  ripiego sul valore di fabbrica guarda il tipo, non la verità del numero. */
  function quantoContesto(opt) {
    var c = opt ? opt.contesto : undefined;
    if (typeof c !== 'number' || !isFinite(c) || c < 0) return CONTESTO;
    return Math.floor(c);
  }

  /* ------------------------------------------------------------ la ricerca */

  /** Tutte le posizioni di `ago` in `pagliaio`, comprese quelle SOVRAPPOSTE:
   *  si avanza di un carattere, non della lunghezza dell'ago. Saltare avanti
   *  di `ago.length` perderebbe la seconda «aa» dentro «aaa», e una selezione
   *  su testo ripetitivo — una sigla, una formula — è esattamente il caso in
   *  cui poi si sbaglia occorrenza. */
  function occorrenze(pagliaio, ago) {
    var out = [], da = 0, at;
    // ⚠️ Un ago vuoto combacia a ogni posizione: il ciclo qui sotto ne
    // accumulerebbe uno per carattere del capitolo, e su un testo lungo la
    // memoria finisce prima del ciclo. `trova` un `exact` vuoto lo rifiuta già,
    // ma questa funzione non deve dipendere dalla prudenza di chi la chiama.
    if (!ago) return out;
    while (true) {
      at = pagliaio.indexOf(ago, da);
      if (at < 0) return out;
      out.push(at);
      da = at + 1;
    }
  }

  /** Quanti caratteri finali di `coda` combaciano risalendo da `pos` indietro. */
  function comuniIndietro(testo, pos, coda) {
    var max = Math.min(pos, coda.length), n = 0;
    while (n < max && testo.charAt(pos - n - 1) === coda.charAt(coda.length - n - 1)) n++;
    return n;
  }

  /** Quanti caratteri iniziali di `testa` combaciano andando da `pos` avanti. */
  function comuniAvanti(testo, pos, testa) {
    var max = Math.min(testo.length - pos, testa.length), n = 0;
    while (n < max && testo.charAt(pos + n) === testa.charAt(n)) n++;
    return n;
  }

  function esito(inizio, lunghezza) {
    return { inizio: inizio, fine: inizio + lunghezza, esatto: true };
  }

  /**
   * Ritrova il selettore dentro `testo`.
   *
   *   trova(testo, { exact, prefix, suffix }) → { inizio, fine, esatto:true } | null
   *
   * Due passi, in quest'ordine:
   *
   * ① `prefix + exact + suffix` cercato come stringa unica. Se compare UNA
   *    volta sola è lui, e non c'è niente da decidere: il contesto ha
   *    combaciato per intero in un punto solo, che è la prova più forte
   *    ottenibile. È il caso normale — il capitolo non è cambiato — e deve
   *    costare una `indexOf`. Vale anche quando prefix e suffix sono vuoti:
   *    lì `intero` è `exact`, e una parola che compare una volta sola si
   *    ritrova senza scomodare i punteggi.
   *
   * ② Altrimenti si guardano TUTTE le occorrenze di `exact` e si dà a ciascuna
   *    un punteggio: quanti caratteri di `prefix` reggono andando a ritroso
   *    dall'inizio, più quanti di `suffix` reggono andando avanti dalla fine.
   *    Vince il punteggio più alto. È il passo che salva l'evidenza quando la
   *    rigenerazione ha riscritto la frase intorno ma non quella evidenziata.
   *
   * ⚠️ Se il punteggio migliore è PARI a quello di un'altra occorrenza, si
   * ritorna `null` — non la prima, non l'ultima. Un pareggio vuol dire che il
   * selettore non contiene abbastanza per distinguere i due punti: sceglierne
   * uno sarebbe indovinare, e indovinare male qui significa accendere il
   * giallo sulla parola sbagliata senza che nulla lo segnali. Un gesto che
   * sbaglia in silenzio è peggio di un gesto che non fa niente e lo dice.
   */
  function trova(testo, sel) {
    if (typeof testo !== 'string' || !testo) return null;
    if (!sel || typeof sel !== 'object') return null;
    var exact = stringa(sel.exact);
    if (!exact) return null;
    var prefix = stringa(sel.prefix), suffix = stringa(sel.suffix);

    // ① la strada corta
    var interi = occorrenze(testo, prefix + exact + suffix);
    if (interi.length === 1) return esito(interi[0] + prefix.length, exact.length);

    // ② il contesto a pezzi
    var posti = occorrenze(testo, exact);
    if (!posti.length) return null;                // la frase non c'è più: orfana

    var migliore = -1, vincitore = -1, pari = false;
    posti.forEach(function (p) {
      var punti = comuniIndietro(testo, p, prefix) + comuniAvanti(testo, p + exact.length, suffix);
      if (punti > migliore) { migliore = punti; vincitore = p; pari = false; }
      else if (punti === migliore) pari = true;
    });
    if (pari) return null;                         // ambiguità vera: meglio orfana che sbagliata
    return esito(vincitore, exact.length);
  }

  /* ---------------------------------------------------- l'apertura in blocco */

  /**
   * Risolve in un colpo tutte le evidenze di un capitolo.
   *
   *   risolvi(testo, elenco) → { trovate:[{voce,inizio,fine}], orfane:[voce], sovrapposte:[{voce,inizio,fine}] }
   *
   * Una «voce» È un selettore, più i campi che servono a chi la usa (id,
   * colore, capitoloId, data): `trova` legge soltanto `exact/prefix/suffix` e
   * ignora il resto, quindi il record salvato su disco può entrare qui com'è.
   * La voce torna indietro per RIFERIMENTO, mai copiata e mai toccata: chi
   * chiama deve poter riconoscere le proprie evidenze per identità.
   *
   * Sta qui e non nel renderer per due ragioni, entrambe di indici:
   *
   *   · l'ORDINE. Chi riscrive il DOM deve procedere dall'ultima evidenza alla
   *     prima, altrimenti la prima marcatura sposta tutti gli offset che
   *     seguono. `trovate` esce ordinata per `inizio` crescente: il renderer la
   *     percorre al contrario. Ordinare è aritmetica su interi, ed è la specie
   *     di cosa che non deve stare in mezzo al codice del DOM.
   *
   *   · le SOVRAPPOSIZIONI. Sono un caso reale, non teorico: chi evidenzia
   *     «memoria» e poi «memoria di lavoro» ha due evidenze legittime che
   *     insistono sugli stessi caratteri, e nessuna marcatura semplice del DOM
   *     può avvolgerle entrambe senza spezzarne una. Vince la prima che
   *     comincia (a parità, la più lunga) e le altre finiscono in
   *     `sovrapposte`: NON sono orfane — il loro testo c'è, e si sa dove — e
   *     chiamarle così sarebbe una bugia comoda. Il renderer può mostrarle
   *     nell'elenco laterale anche senza accenderle nel testo.
   */
  function risolvi(testo, elenco) {
    var orfane = [], sovrapposte = [], candidate = [];
    if (typeof testo !== 'string' || !Array.isArray(elenco)) {
      return { trovate: [], orfane: orfane, sovrapposte: sovrapposte };
    }
    elenco.forEach(function (voce) {
      var r = trova(testo, voce);
      if (!r) { orfane.push(voce); return; }
      candidate.push({ voce: voce, inizio: r.inizio, fine: r.fine });
    });
    candidate.sort(function (a, b) { return (a.inizio - b.inizio) || (b.fine - a.fine); });

    var trovate = [], finoA = -1;
    candidate.forEach(function (c) {
      if (c.inizio < finoA) { sovrapposte.push(c); return; }
      trovate.push(c);
      finoA = c.fine;
    });
    return { trovate: trovate, orfane: orfane, sovrapposte: sovrapposte };
  }

  return { normalizza: normalizza, parolePiene: parolePiene,
           daTesto: daTesto, trova: trova, risolvi: risolvi };
}));
