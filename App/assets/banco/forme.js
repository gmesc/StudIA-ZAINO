/* =========================================================================
   forme — il BANCO: le otto forme della griglia, e le regole sullo stato.

   Il banco è lo spazio di lavoro (PIANO-BANCO.md §2): quattro celle — A e C
   sopra, B e D sotto — e un insieme CHIUSO di forme che le uniscono. Ogni forma
   si dice per intero con un `grid-template-areas`; tutta la geometria che resta
   sta in due numeri, la frazione della colonna e quella della riga. Uno stato
   così piccolo entra in una riga di `localStorage` e si racconta a voce.

   Qui c'è solo il livello PURO: la tabella e lo stato. Niente DOM, niente
   `localStorage`, niente colori — e soprattutto NON il registro degli
   strumenti, che vive nel renderer perché ogni strumento è un pezzo di pagina.
   Qui uno strumento è una stringa opaca: `'mappa'` per questo modulo non
   significa niente, e va bene così — il giorno in cui arrivano le parole chiave
   e le flashcard (§2.2) questo file non cambia di una riga.

   ⚠️ Un elenco scritto due volte è due elenchi (la trappola ④ di questo
   progetto, già pagata due volte). Quali blocchi usa una forma, e se ha davvero
   il divisore verticale o quello orizzontale, si LEGGONO dalla stringa delle
   aree: sono già scritti lì. Una seconda copia diverge al primo ritocco, e
   diverge in silenzio — una griglia storta non è un errore che qualcuno lancia,
   è solo un blocco che non si vede più.

   Modulo PURO, UMD (vedi relazioni.js). Il globale arriva come ARGOMENTO alla
   factory anche se oggi qui non serve niente, perché la forma giusta vuota
   costa meno di quella sbagliata il giorno in cui servirà: dentro la factory
   `root` non è in scope, ed è un errore che questo progetto ha già pagato una
   volta (vedi la testata di modifica.js).
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(null);
  else root.BancoForme = factory(root);
}(typeof self !== 'undefined' ? self : this, function (glob) {   // `glob` non serve: vedi la testata
  'use strict';

  /* I quattro blocchi nel loro ordine CANONICO. È l'ordine in cui si scrivono
     le aree ("A C" sopra, "B D" sotto) ed è l'ordine con cui si sciolgono le
     contese più avanti: un ordine solo, sempre lo stesso, così una regola non
     dipende mai da come è stato serializzato un file. */
  /* ⚠️ NOVE e non più quattro. Il banco è diventato una griglia fino a 3×3 per
     gli schermi larghi — su un 4K tre colonne sono la disposizione naturale — e
     i primi quattro nomi restano quelli di prima: una disposizione salvata con
     la vecchia griglia continua a dire le stesse cose. */
  var BLOCCHI = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

  /** La forma di fabbrica: due colonne affiancate. Vale quando non si sa niente
   *  — primo avvio, stato mai salvato, file storto — ed è la disposizione che
   *  il dock di oggi già realizza: riaprire l'app non deve dare l'impressione
   *  di aver aperto un altro programma. */
  var DI_FABBRICA = 'due-col';

  /* Le otto forme (§2), nell'ordine in cui il selettore le mostra — lo stesso
     del disegno nel piano: due righe da quattro, prima quanti blocchi sono e
     poi come stanno.
     ⚠️ `aree` è l'UNICO posto in cui è scritto quali blocchi ha una forma.
     Tutto il resto di questo file lo ricava da lì. */
  var SORGENTE = [
    ['uno',       'Un blocco solo',                '"A"'],
    ['due-col',   'Due · affiancati',              '"A C"'],
    ['due-riga',  'Due · impilati',                '"A" "B"'],
    ['tre-sx',    'Tre · colonna sinistra intera', '"A C" "A D"'],
    ['tre-dx',    'Tre · colonna destra intera',   '"A C" "B C"'],
    ['tre-sopra', 'Tre · riga sopra intera',       '"A A" "B D"'],
    ['tre-sotto', 'Tre · riga sotto intera',       '"A C" "B B"'],
    ['quattro',   'Quattro blocchi',               '"A C" "B D"'],
    /* Le forme a TRE COLONNE: nate per gli schermi larghi, dove due riquadri
       lasciano metà pagina a un documento che non ne ha bisogno. */
    ['tre-col',   'Tre · colonne affiancate',      '"A C E"'],
    ['tre-col-dx','Tre colonne · la terza divisa', '"A C E" "A C F"'],
    ['tre-col-sx','Tre colonne · la prima divisa', '"A C E" "B C E"'],
    ['sei',       'Sei blocchi',                   '"A C E" "B D F"']
  ];

  /* ------------------------------------------------------- leggere le aree */

  /** Le quattro celle nell'ordine di lettura: sopra-sinistra, sopra-destra,
   *  sotto-sinistra, sotto-destra. Le virgolette della sintassi CSS non
   *  interessano a nessuno: contano i nomi, e sono in fila. */
  function celleDi(aree) {
    return String(aree == null ? '' : aree).match(/[A-Za-z]+/g) || [];
  }

  /** Le celle RIGA PER RIGA: `'"A C" "B D"'` → `[['A','C'],['B','D']]`. È la
   *  lettura che serve da quando la griglia non è più per forza 2×2 — il numero
   *  di colonne è la lunghezza di una riga, e quello delle righe è quante sono.
   *  ⚠️ Sempre derivata dalle aree, mai dichiarata a parte: due numeri scritti
   *  accanto alla stringa sarebbero due numeri da tenere d'accordo con lei. */
  function righeDi(aree) {
    var m = String(aree == null ? '' : aree).match(/"[^"]*"/g);
    if (!m) return [];
    return m.map(function (r) { return r.match(/[A-Za-z]+/g) || []; });
  }
  /** Quante colonne e quante righe ha una forma. Forma ignota → 1×1. */
  function griglia(forma) {
    var r = righeDi(FORME[forma] ? FORME[forma].aree : '');
    return { colonne: r.length ? r[0].length : 1, righe: r.length || 1 };
  }

  /** I blocchi che una stringa di aree usa davvero, in ordine canonico.
   *  È LA derivazione: `blocchiDi`, il conteggio della tabella e i divisori
   *  passano tutti di qui, così la domanda «quali blocchi ha?» ha una sola
   *  risposta anche quando la si fa da tre punti diversi. */
  function blocchiNelleAree(aree) {
    var c = celleDi(aree);
    return BLOCCHI.filter(function (b) { return c.indexOf(b) >= 0; });
  }

  /** Le celle di una forma nota; di una forma che non esiste, nessuna. */
  function celleDiForma(forma) {
    return celleDi(FORME[forma] ? FORME[forma].aree : '');
  }

  /**
   * Che cosa non va in una stringa di aree — o `''` se va tutto bene.
   *
   * Serve al controllo che gira al CARICAMENTO del modulo (poco più sotto).
   * Una forma storta non fa eccezione da nessuna parte: il browser scarta la
   * `grid-template-areas` intera e impagina una griglia qualunque, quindi il
   * guasto si scopre a occhio, mesi dopo, senza sapere da dove venga. Meglio al
   * primo `node test/roundtrip.js` — è la stessa scelta di `relazioni.js` col
   * verbo dichiarato in due famiglie.
   *
   * Tre condizioni, tutte necessarie perché il CSS accetti la regola:
   *   · quattro celle esatte (due righe da due);
   *   · solo i nomi A B C D — un nome inventato non ha un `.blocco` che lo
   *     occupi, e lascerebbe un buco muto;
   *   · ogni nome deve coprire un RETTANGOLO. In una griglia 2×2 l'unico modo
   *     di sbagliare è la diagonale (`"A C" "C A"`), e il CSS la rifiuta.
   */
  function guastoNelleAree(aree) {
    var r = righeDi(aree);
    if (!r.length) return 'non c\'è nessuna riga';
    if (r.length > 3) return 'le righe sono ' + r.length + ', il massimo è tre';
    var colonne = r[0].length;
    if (!colonne || colonne > 3) return 'le colonne sono ' + colonne + ', devono essere da una a tre';
    for (var i = 1; i < r.length; i++) {
      if (r[i].length !== colonne) return 'la riga ' + (i + 1) + ' ha ' + r[i].length + ' celle invece di ' + colonne;
    }
    var celle = [].concat.apply([], r);
    var fuori = celle.filter(function (n) { return BLOCCHI.indexOf(n) < 0; });
    if (fuori.length) return 'nomi non previsti: ' + fuori.join(', ');
    /* ⚠️ Ogni nome deve coprire un RETTANGOLO pieno. In una griglia 2×2 l'unico
       modo di sbagliare era la diagonale; in una 3×3 ce ne sono molti di più —
       una L, una croce, un blocco con un buco in mezzo — e il CSS scarta la
       regola INTERA senza dire niente: la griglia si impagina a caso e il
       guasto si scopre a occhio, mesi dopo. */
    var storti = BLOCCHI.filter(function (b) { return celle.indexOf(b) >= 0; }).filter(function (b) {
      var righe = [], colonneB = [];
      r.forEach(function (riga, y) {
        riga.forEach(function (n, x) { if (n === b) { righe.push(y); colonneB.push(x); } });
      });
      var alto = Math.max.apply(null, righe) - Math.min.apply(null, righe) + 1;
      var largo = Math.max.apply(null, colonneB) - Math.min.apply(null, colonneB) + 1;
      return alto * largo !== righe.length;      // il riquadro che le contiene ha buchi
    });
    return storti.length ? 'non è un rettangolo: ' + storti.join(', ') : '';
  }

  /* ------------------------------------------------------------- la tabella */

  var FORME = {};
  var CHIAVI = SORGENTE.map(function (r) {
    /* ⚠️ `quanti` si CONTA dalle aree, non si scrive. E si chiama `quanti` e
       non `blocchi` di proposito: `stato.blocchi` è tutt'altra cosa (blocco →
       strumento), e due campi omonimi con due significati sono un invito a
       sbagliare in un `for` distratto. */
    FORME[r[0]] = { nome: r[1], aree: r[2], quanti: blocchiNelleAree(r[2]).length };
    return r[0];
  });

  /* Il controllo gira ORA, mentre il modulo si carica: una forma impossibile
     salta al primo test invece che alla prima apertura del banco. */
  CHIAVI.forEach(function (k) {
    var guasto = guastoNelleAree(FORME[k].aree);
    if (guasto) throw new Error('banco/forme: la forma «' + k + '» ha aree impossibili — ' + guasto);
  });

  /* ------------------------------------------------- le forme dell'utente */

  /**
   * Registra una forma PERSONALE. `''` se è entrata, altrimenti il guasto.
   *
   * Le forme dell'utente vivono nel `localStorage` del renderer (sono una
   * preferenza dello schermo che si ha davanti, come le disposizioni) e vengono
   * ripresentate qui a ogni avvio: la tabella resta l'unico posto che sa quali
   * forme esistono, e tutto il resto del modulo — divisori, contese, griglia —
   * le tratta come le altre senza una riga in più.
   *
   * ⚠️ Le chiavi personali hanno un prefisso obbligato (`mia-`): una forma
   * dell'utente che si chiamasse `quattro` COPRIREBBE quella di fabbrica, e le
   * disposizioni salvate cambierebbero significato in silenzio.
   */
  function registraForma(chiave, nome, aree) {
    var k = String(chiave == null ? '' : chiave);
    if (!/^mia-[a-z0-9-]{1,30}$/.test(k)) return 'la chiave di una forma personale comincia con «mia-»';
    var guasto = guastoNelleAree(aree);
    if (guasto) return guasto;
    FORME[k] = { nome: String(nome == null ? '' : nome).trim() || 'Forma personale',
                 aree: String(aree),
                 quanti: blocchiNelleAree(aree).length,
                 personale: true };
    if (CHIAVI.indexOf(k) < 0) CHIAVI.push(k);
    return '';
  }
  /** Toglie una forma personale. Quelle di fabbrica non si toccano. */
  function dimenticaForma(chiave) {
    var k = String(chiave == null ? '' : chiave);
    if (!FORME[k] || !FORME[k].personale) return false;
    delete FORME[k];
    var i = CHIAVI.indexOf(k);
    if (i >= 0) CHIAVI.splice(i, 1);
    return true;
  }

  /* ------------------------------------------------------------- le domande */

  /** I blocchi che una forma usa, in ordine canonico. Forma sconosciuta → `[]`.
   *  Array NUOVO a ogni chiamata: chi lo riceve può ordinarlo, tagliarlo o
   *  svuotarlo senza che la tabella se ne accorga (la stessa cautela di
   *  `relazioni.verbiPerFamiglia`). */
  function blocchiDi(forma) {
    return FORME[forma] ? blocchiNelleAree(FORME[forma].aree) : [];
  }

  /** Se quel blocco esiste in quella forma. È la domanda che il renderer fa a
   *  ogni ridisegno per decidere l'attributo `[hidden]`, quindi sta scritta
   *  qui una volta e non quattro volte lì. */
  function visibile(forma, blocco) {
    return blocchiDi(forma).indexOf(blocco) >= 0;
  }

  /** C'è il divisore VERTICALE, cioè `col` significa qualcosa in questa forma?
   *  Sì se almeno una riga è spezzata fra due nomi diversi.
   *  ⚠️ Ricavato dalle aree e non da un elenco di forme: l'elenco sarebbe la
   *  tabella riscritta una seconda volta, e «due-riga» ci finirebbe dentro il
   *  giorno in cui qualcuno lo compila a memoria. */
  function usaDivisoreColonna(forma) {
    return divisoriDi(forma).col.length > 0;
  }

  /** C'è il divisore ORIZZONTALE? Sì se almeno una colonna è spezzata. */
  function usaDivisoreRiga(forma) {
    return divisoriDi(forma).riga.length > 0;
  }

  /**
   * QUALI divisori servono a una forma: `{ col:[0], riga:[0,1] }`, cioè gli
   * indici delle fessure che separano davvero due blocchi.
   *
   * ⚠️ Una fessura fra due colonne che in OGNI riga hanno lo stesso nome non è
   * un divisore: non separa niente, e trascinarla sposterebbe un confine che
   * non si vede. In una 2×2 il caso era uno solo; in una 3×3 capita di continuo
   * — «tre colonne, la prima divisa» ha una fessura vera e una finta.
   */
  function divisoriDi(forma) {
    var r = righeDi(FORME[forma] ? FORME[forma].aree : '');
    var out = { col: [], riga: [] };
    if (!r.length) return out;
    var colonne = r[0].length;
    for (var x = 0; x + 1 < colonne; x++) {
      for (var y = 0; y < r.length; y++) {
        if (r[y][x] !== r[y][x + 1]) { out.col.push(x); break; }
      }
    }
    for (var y2 = 0; y2 + 1 < r.length; y2++) {
      for (var x2 = 0; x2 < colonne; x2++) {
        if (r[y2][x2] !== r[y2 + 1][x2]) { out.riga.push(y2); break; }
      }
    }
    return out;
  }

  /* --------------------------------------------------------------- lo stato */

  /* ⚠️ Le frazioni non toccano mai i bordi. Un blocco largo zero non si
     riafferra più: il divisore è un bersaglio di 9px appoggiato al bordo, e
     sotto una certa larghezza ci si finisce sopra per sbaglio, non per scelta.
     La soglia è 0,1, e vale in tutte e due le direzioni perché una soglia sola
     si ricorda: sulle misure del piano (1166px di banco a 1440, 1630 a 1920) il
     blocco più stretto resta 117–163px — la testata con la sua tendina ci sta,
     e soprattutto il divisore resta a portata di mouse; in verticale, su una
     finestra alta 900, fa 84px, cioè più del doppio della testata. */
  var MINIMO = 0.1;
  var MASSIMO = 1 - MINIMO;
  var MEZZO = 0.5;

  /**
   * Una frazione dello spazio: 0–1, tenuta lontana dai bordi.
   *
   * ⚠️ Solo NUMERI veri. `+null`, `+''` e `+[]` fanno tutti zero, e qui lo zero
   * non vuol dire «manca»: vuol dire «largo niente». Ciò che non è un numero
   * finito torna al MEZZO, che è il valore di fabbrica, non al minimo — che è
   * dove lo schiaccerebbe una conversione compiacente. (È la stessa lezione di
   * `grafo.fissato`, dove lo zero è una posizione legittima.)
   *
   * ESPORTATA di proposito: la usa anche il divisore mentre lo si trascina, per
   * ricondurre i pixel a una frazione. Due limiti scritti in due posti sono due
   * limiti diversi appena qualcuno ne cambia uno.
   */
  function frazione(v) {
    if (typeof v !== 'number' || !isFinite(v)) return MEZZO;
    return Math.min(MASSIMO, Math.max(MINIMO, v));
  }

  /**
   * La SECONDA frazione di un asse: dove sta il secondo divisore, quando le
   * colonne (o le righe) sono tre.
   *
   * ⚠️ Deve stare DOPO la prima, e non a ridosso: due divisori sovrapposti sono
   * un blocco largo zero, cioè un blocco che non si riafferra più. Se il valore
   * manca o non è un numero, il ripiego divide a metà lo spazio che resta —
   * con la prima a un terzo, la seconda cade a due terzi, che è la griglia
   * simmetrica che chiunque si aspetta.
   */
  function frazioneDopo(prima, v) {
    var p = frazione(prima);
    var ripiego = p + (1 - p) / 2;
    var n = (typeof v === 'number' && isFinite(v)) ? v : ripiego;
    return Math.min(MASSIMO, Math.max(p + MINIMO, n));
  }

  /** L'id di uno strumento, o `''` se in quel blocco non c'è niente.
   *  Solo stringhe: un numero o un oggetto arrivati da un file storto,
   *  convertiti, diventerebbero il nome di uno strumento che non esiste — e il
   *  renderer mostrerebbe un blocco vuoto senza sapere perché. */
  function strumento(v) {
    return typeof v === 'string' ? v.trim() : '';
  }

  /**
   * L'ordine in cui si sciolgono le contese fra blocchi: prima quelli che la
   * forma mostra, poi gli altri, ciascun gruppo in ordine canonico.
   *
   * ⚠️ Chi si vede vince. Se lo stesso strumento risulta in due blocchi, uno a
   * schermo e uno nascosto, svuotare quello a schermo toglierebbe all'utente
   * una cosa che sta guardando per conservare una copia che non guarda nessuno:
   * una perdita che si nota e non si sa spiegare.
   */
  function ordineContese(forma) {
    var visti = blocchiDi(forma);
    return visti.concat(BLOCCHI.filter(function (b) { return visti.indexOf(b) < 0; }));
  }

  /**
   * I quattro blocchi col loro strumento, senza doppioni.
   *
   * ⚠️ Uno strumento sta in UN blocco solo (§2.2): è un pezzo di pagina, non
   * un'immagine da duplicare. Se lo stato che arriva lo dice due volte — un
   * file scritto a mano, un salvataggio interrotto, una versione precedente —
   * la copia si toglie sempre alla stessa: vince il primo blocco secondo
   * `ordineContese`. Non «l'ultima chiave scritta», che dipende da come è stato
   * serializzato il file e da niente che l'utente possa vedere.
   *
   * I blocchi che la forma NON usa restano: cambiare forma e tornare indietro
   * deve ritrovare le cose dov'erano.
   */
  function blocchiSenzaDoppioni(b, forma) {
    var dentro = (b && typeof b === 'object') ? b : {};
    var out = {}, presi = {};
    BLOCCHI.forEach(function (k) { out[k] = ''; });   // le chiavi in ordine canonico, sempre tutte e quattro
    ordineContese(forma).forEach(function (k) {
      var s = strumento(dentro[k]);
      if (!s || presi[s]) return;      // «vuoto» non è uno strumento: più blocchi vuoti convivono
      presi[s] = true;
      out[k] = s;
    });
    return out;
  }

  /**
   * Qualunque cosa arrivi → uno stato del banco valido. È l'`entroSchema` del
   * banco: non lancia mai, ripara.
   *
   * Lo stato viene dal `localStorage`, cioè da un testo che può essere di una
   * versione precedente dell'app, riscritto a mano o troncato a metà. Se questa
   * funzione si arrendesse, l'app si aprirebbe senza banco — e il banco è la
   * pagina.
   *
   * Restituisce SOLO i quattro campi previsti. Lo stato è minuscolo e descritto
   * per intero (§2.1): ciò che arriva in più è rumore, e il rumore in un
   * `localStorage` non se ne va più da solo.
   */
  function normalizzaStato(s) {
    var v = (s && typeof s === 'object') ? s : {};
    var forma = FORME[v.forma] ? v.forma : DI_FABBRICA;
    var g = griglia(forma);
    /* ⚠️ La prima frazione ha DUE valori di fabbrica: metà con due colonne, un
       terzo con tre. Un banco a tre colonne che si apre con la prima a metà è
       una colonna doppia delle altre senza che nessuno l'abbia chiesto. Il
       valore SALVATO invece si rispetta sempre: è una scelta. */
    /* ⚠️ Le griglie a DUE e a TRE colonne ricordano tarature SEPARATE. Una
       frazione scelta con due colonne (0,62 per leggere largo) non significa
       niente su tre — misurato: passando a tre colonne la prima usciva doppia
       delle altre — e viceversa. Quattro campi in più nello stato costano una
       riga di JSON; una taratura che cambia significato cambiando forma costa
       un banco storto ogni volta. */
    var col3 = (typeof v.col3 === 'number' && isFinite(v.col3)) ? frazione(v.col3) : frazione(1 / 3);
    var riga3 = (typeof v.riga3 === 'number' && isFinite(v.riga3)) ? frazione(v.riga3) : frazione(1 / 3);
    var col3b = (typeof v.col3b === 'number' && isFinite(v.col3b)) ? frazioneDopo(col3, v.col3b) : frazioneDopo(col3, 2 / 3);
    var riga3b = (typeof v.riga3b === 'number' && isFinite(v.riga3b)) ? frazioneDopo(riga3, v.riga3b) : frazioneDopo(riga3, 2 / 3);
    return {
      forma: forma,
      col: frazione(v.col),
      riga: frazione(v.riga),
      col3: col3, col3b: col3b,
      riga3: riga3, riga3b: riga3b,
      blocchi: blocchiSenzaDoppioni(v.blocchi, forma)
    };
  }

  /** In quale blocco sta uno strumento, o `null`. Vale su uno stato qualunque,
   *  quindi passa prima dalla normalizzazione — e dopo quella un doppione non
   *  c'è più, quindi la risposta è una sola per costruzione. */
  function bloccoCon(stato, strum) {
    var s = normalizzaStato(stato), cercato = strumento(strum);
    if (!cercato) return null;
    for (var i = 0; i < BLOCCHI.length; i++) {
      if (s.blocchi[BLOCCHI[i]] === cercato) return BLOCCHI[i];
    }
    return null;
  }

  /** Attacca allo stato una cosa da sapere sull'OPERAZIONE appena fatta senza
   *  scriverla DENTRO lo stato: la proprietà non è enumerabile, quindi
   *  `JSON.stringify` non la vede e nel `localStorage` non ci finisce.
   *
   *  ⚠️ È la gemella di `modifica.segna`, una riga identica in un altro modulo,
   *  e non è una svista: prenderla da lì legherebbe il banco — che di mappe non
   *  sa niente — al modulo che le modifica. Che sia una funzione e non un
   *  `defineProperty` scritto sul posto è invece la solita ragione: la trappola
   *  è dimenticare `enumerable:false` alla terza volta. */
  function segna(o, chiave, valore) {
    Object.defineProperty(o, chiave, { value: valore, enumerable: false, configurable: true });
    return o;
  }

  /* ------------------------------------------------------------ le mosse */

  /**
   * Mette uno strumento in un blocco. Restituisce uno stato NUOVO e non tocca
   * quello ricevuto — la stessa regola di `modifica.js` per le mappe, e per la
   * stessa ragione: chi mette da parte uno stato per rimetterlo deve ritrovarlo
   * com'era.
   *
   * ⚠️ Se lo strumento stava già in un altro blocco, i due si SCAMBIANO il
   * contenuto. L'alternativa — lasciare vuoto il blocco di partenza — sembra
   * più semplice e costa un gesto in più ogni volta: chi porta la mappa da C ad
   * A voleva la mappa in A, non il capitolo sparito e un buco in C da riempire.
   * Lo scambio conserva quanti blocchi sono pieni e non inventa niente: rimette
   * in circolo esattamente ciò che c'era.
   *
   * Uno strumento vuoto (`''`) svuota il blocco, e non scambia niente con
   * nessuno: il vuoto non è una cosa che stava da un'altra parte.
   */
  function assegna(stato, blocco, strum) {
    var s = normalizzaStato(stato);                 // già un oggetto nuovo: da qui si scrive su quello
    if (BLOCCHI.indexOf(blocco) < 0) return s;      // blocco inventato: errore di chi chiama, non dell'utente
    var nuovo = strumento(strum);
    var prima = s.blocchi[blocco];
    if (nuovo === prima) return s;
    var altrove = nuovo ? bloccoCon(s, nuovo) : null;
    s.blocchi[blocco] = nuovo;
    if (altrove) s.blocchi[altrove] = prima;        // lo scambio
    return s;
  }

  /**
   * Cambia la forma del banco. Stato NUOVO, come `assegna`.
   *
   * Passando a una forma con MENO blocchi, gli strumenti dei blocchi che
   * spariscono non si perdono: restano scritti nello stato e tornano da soli
   * appena si torna a una forma che li mostra. Ma chi chiama deve poter dire
   * che cosa è uscito di scena, altrimenti la mappa «sparisce» e l'unico modo
   * di scoprire dov'è finita è riprovare le otto forme a una a una.
   *
   * L'elenco esce come proprietà NON ENUMERABILE `.usciti` — `[{blocco,
   * strumento}]` — come fa `modifica.creaNodo` con `.nuovo`: è
   * un'informazione sull'operazione, non un dato del banco, e su disco sarebbe
   * solo rumore da ripulire poi. C'è sempre, anche vuota, così chi la legge non
   * deve controllare prima se esiste.
   *
   * Esce di scena solo ciò che PRIMA si vedeva: un blocco già nascosto resta
   * nascosto, e annunciarlo adesso sarebbe una notizia vecchia.
   *
   * ⚠️ Forma sconosciuta → si tiene quella di adesso, non quella di fabbrica.
   * Qui, a differenza di `normalizzaStato`, una forma buona ce l'abbiamo già:
   * per un refuso di chi chiama non si rifà il banco all'utente.
   */
  function cambiaForma(stato, forma) {
    var s = normalizzaStato(stato);
    if (!FORME[forma] || forma === s.forma) return segna(s, 'usciti', []);
    var usciti = blocchiDi(s.forma)
      .filter(function (b) { return s.blocchi[b] && !visibile(forma, b); })
      .map(function (b) { return { blocco: b, strumento: s.blocchi[b] }; });
    s.forma = forma;
    return segna(s, 'usciti', usciti);
  }

  return {
    FORME: FORME, CHIAVI: CHIAVI, BLOCCHI: BLOCCHI, DI_FABBRICA: DI_FABBRICA,
    blocchiDi: blocchiDi, visibile: visibile, righeDi: righeDi, griglia: griglia,
    usaDivisoreColonna: usaDivisoreColonna, usaDivisoreRiga: usaDivisoreRiga, divisoriDi: divisoriDi,
    guastoNelleAree: guastoNelleAree, frazione: frazione, frazioneDopo: frazioneDopo,
    normalizzaStato: normalizzaStato, bloccoCon: bloccoCon,
    registraForma: registraForma, dimenticaForma: dimenticaForma,
    assegna: assegna, cambiaForma: cambiaForma
  };
}));
