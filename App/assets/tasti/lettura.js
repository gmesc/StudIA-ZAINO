/* ============================================================================
   tasti/lettura.js — chi vince, fra i tasti che si premono leggendo
   ============================================================================
   Una funzione sola, `decidi(tasto, dove)`, che risponde a una domanda sola:
   **premuto questo tasto, in questa situazione, che cosa deve succedere?**
   Restituisce UN'AZIONE, o niente. Mai due.

   ⚠️ PERCHÉ ESISTE, ED È UNA MISURA E NON UN'OPINIONE. `App/StudIA.html`
   registra 24 ascoltatori globali di `keydown` — 14 su `document`, 10 su
   `window`, 12 in cattura e 12 in bolla — e 18 di loro guardano `Escape`.
   Chi vince lo decidono tre cose: la fase (tutta la cattura prima di tutta la
   bolla), il nodo (in cattura `window` prima di `document`, in bolla il
   contrario) e, a parità di nodo e fase, **l'ordine di registrazione** — che in
   un file di ventimila righe vuol dire *la posizione del codice nel file*.
   Quella terza regola non è dichiarata da nessuna parte: è un effetto di dove
   uno ha incollato la funzione.

   ⚠️ E IL GUASTO NON È TEORICO. Con il fuoco dentro il Player, la freccia
   sinistra oggi fa DUE cose. Il gestore dei capitoli (`document`, bolla) gira
   prima di quello del Player (`window`, bolla): quando decide,
   `defaultPrevented` è ancora falso — il Player non è stato ancora chiamato —
   quindi cambia capitolo; subito dopo il Player salta i suoi 5 secondi. Il
   commento del Player dichiara l'intenzione opposta («rubarle vorrebbe dire
   un'app in cui la stessa freccia fa due cose») e la guida dello ZAINO registra
   già il sintomo senza riconoscerlo come difetto: «anche col fuoco sul documento
   o sul player, DOVE IN PIÙ saltano di 5 secondi».

   ⚠️ `stopPropagation` non è il rimedio, e va detto perché è il malinteso che
   tiene in piedi il guasto: ferma l'evento sul NODO SUCCESSIVO, non i gestori
   registrati sullo STESSO nodo. A quelli servirebbe
   `stopImmediatePropagation`, che nel monolite non compare mai. Il patto vero
   è `defaultPrevented` — «io l'ho già gestito, tu tirati indietro» — e oggi lo
   guarda **un gestore su ventiquattro**.

   COSA CAMBIA CON QUESTO FILE. La priorità smette di essere un ordine di
   registrazione e diventa **una tabella che si legge**, in un posto solo. Il
   renderer guarda il DOM, riempie `dove`, chiede qui, e fa quello che gli
   viene detto: se la risposta non è sua, non fa niente. Due gestori non possono
   più agire sullo stesso tasto, perché la risposta è una.

   ⚠️ QUI NON SI LEGGE IL DOM, e non è pulizia: è la condizione per provare
   questa tabella in `node test/tasti-lettura.js` in quaranta millisecondi
   invece che in quaranta secondi di Electron. Chi calcola `dove` è il renderer,
   che il DOM ce l'ha davanti — è la stessa scelta di `suMac(nav)` in
   `tasti/nomi.js`, che si fa passare il navigatore invece di leggerlo da sé.
   Alla prova CDP resta il CABLAGGIO: che il gestore sia attaccato, e che il
   `preventDefault` fermi davvero lo scorrimento della pagina.

   CHE COSA NON STA QUI, e sono due cose per due ragioni diverse:

   · **La catena degli `Escape`.** Sono 18 gestori, e il loro ordine è *pagato*:
     ogni anello porta un commento che registra un guasto vero (la lente che si
     chiudeva insieme al documento sotto, la ricerca che spariva premendo «+»
     dello zoom, il menu della selezione che restava sopra il testo). Portarli
     qui vorrebbe dire rimettere in gioco tre settimane di correzioni per un
     lavoro che non le ha chieste. Esc resta dov'è.
   · **Le combinazioni col modificatore** (⌘S, ⌘F, ⌘⇧C…). Non litigano con
     niente: sono già distinte dalla combinazione stessa, e hanno il loro posto.
     Qui si decide fra i tasti NUDI, che sono quelli che si contendono.

     node test/tasti-lettura.js
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TastiLettura = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Le azioni che questa tabella sa nominare. Un insieme CHIUSO, e dichiarato:
     chi chiama fa uno `switch` su queste stringhe, e una stringa che non è qui
     dentro è un errore di chi l'ha scritta, non un caso da gestire. */
  var AZIONI = [
    'player:pausa', 'player:indietro10', 'player:avanti10',
    'player:piuLento', 'player:piuVeloce', 'player:indietro5', 'player:avanti5',
    'righello:su', 'righello:giu',
    'pagina:indietro', 'pagina:avanti',
    'capitolo:indietro', 'capitolo:avanti'
  ];

  /* Dove può stare il fuoco. Lo calcola il renderer, che il DOM ce l'ha.

     ⚠️ `mappa` è una voce a sé e non «altro» per una ragione misurata: dentro
     un SVG il bersaglio di un evento è un `<g>`, e un controllo sul `tagName`
     non lo vede — lavorando sulla tela bastava sfiorare una freccia per
     cambiare la pagina sotto. Il vecchio rimedio era grosso: bastava che una
     mappa fosse A SCHERMO perché le frecce morissero ovunque. Con `dove.fuoco`
     la domanda torna a essere quella giusta — *il fuoco è nella mappa?* — e con
     la mappa aperta in un altro blocco del banco le frecce continuano a voltare
     pagina, che è ciò che serve a chi studia con il documento e la mappa
     affiancati.

     ⚠️ `scrittura` è più largo di «è un campo»: comprende `contenteditable` e
     CodeMirror. La regola sta nel renderer (`scriveraDaTastiera`) perché
     interroga l'elemento; qui arriva già come risposta. */
  var FUOCHI = ['scrittura', 'player', 'mappa', 'documento', 'altro'];

  function str(v) { return (v == null) ? '' : String(v); }

  /* I tasti nudi del Player valgono OVUNQUE mentre un media è aperto — non solo
     col fuoco dentro il suo riquadro — perché sono il gesto di chi ascolta
     mentre scrive da un'altra parte. Le FRECCE no: quelle valgono solo col
     fuoco dentro il Player, o si prenderebbero il posto della pagina e del
     capitolo. È la distinzione che il Player dichiara già nel suo commento, e
     che finora nessuno faceva rispettare. */
  var PLAYER_NUDI = {
    'k': 'player:pausa', ' ': 'player:pausa',
    'j': 'player:indietro10',
    'l': 'player:avanti10',
    '<': 'player:piuLento',
    '>': 'player:piuVeloce'
  };

  /**
   * `tasto`: { key, meta, ctrl, alt, shift } — i campi di un `KeyboardEvent`,
   *          copiati invece che passati, così la tabella si prova senza browser.
   * `dove` : { fuoco, modo, pdf, player, righello, giaGestito }
   *          `fuoco`      una voce di FUOCHI (chi non la dice è 'altro')
   *          `modo`       'zaino' | 'corso'
   *          `pdf`        c'è un documento aperto nell'anteprima
   *          `player`     c'è un media aperto
   *          `righello`   la finestra sulla riga è accesa
   *          `giaGestito` `event.defaultPrevented`: qualcuno ha già risposto
   *
   * → una stringa di AZIONI, oppure `null`.
   */
  function decidi(tasto, dove) {
    var t = tasto || {}, d = dove || {};
    var key = str(t.key);
    var fuoco = FUOCHI.indexOf(str(d.fuoco)) >= 0 ? str(d.fuoco) : 'altro';

    /* 1. Qualcuno ha già risposto. È il patto, ed è il primo controllo perché
          un patto che si guarda per ultimo non è un patto. */
    if (d.giaGestito) return null;

    /* 2. Le scorciatoie del sistema restano del sistema. ⌘←, che su un Mac
          vuol dire «indietro», non deve cambiare capitolo: oggi lo fa, perché
          il gestore dei capitoli non guarda i modificatori. */
    if (t.meta || t.ctrl || t.alt) return null;

    /* 3. Chi sta scrivendo sta scrivendo. Vale prima di tutto il resto: anche
          con un media in corsa, la «l» di chi batte una parola è una lettera. */
    if (fuoco === 'scrittura') return null;

    /* 4. Il Player, se c'è un media aperto. Prima le frecce col fuoco dentro il
          suo riquadro, poi i tasti nudi che valgono ovunque. */
    if (d.player) {
      if (fuoco === 'player') {
        if (key === 'ArrowLeft') return 'player:indietro5';
        if (key === 'ArrowRight') return 'player:avanti5';
      }
      var nudo = PLAYER_NUDI[key.length === 1 ? key.toLowerCase() : key];
      if (nudo) return nudo;
    }

    /* 5. Il righello, quando è acceso: ↑ ↓ spostano la banda di riga.
          ⚠️ Solo da acceso. Da spento quelle due frecce sono lo scorrimento
          della pagina, e rubarle vorrebbe dire un documento che non si scorre
          più con la tastiera. */
    if (d.righello) {
      if (key === 'ArrowUp') return 'righello:su';
      if (key === 'ArrowDown') return 'righello:giu';
    }

    /* 6. Le frecce orizzontali: la mappa, poi la pagina, poi il capitolo. */
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      var avanti = (key === 'ArrowRight');
      /* Il fuoco è sulla tela: le frecce sono sue, e non fanno niente. */
      if (fuoco === 'mappa') return null;
      /* In uno ZAINO non esistono capitoli da sfogliare. Oggi quelle frecce
         sfogliano in silenzio i capitoli del corso rimasto aperto dietro —
         nessuno lo vede, e tornando ai corsi il capitolo è cambiato. */
      if (d.modo === 'zaino') return d.pdf ? (avanti ? 'pagina:avanti' : 'pagina:indietro') : null;
      /* ⚠️ IL MODO SI DICHIARA, non si suppone: qualunque cosa che non sia
         'zaino' o 'corso' non muove niente. Il ripiego «se non è uno zaino
         allora è un corso» sembrava innocuo — il renderer passa sempre una
         delle due — e invece è il ripiego che, il giorno che quel campo arriva
         vuoto o storto, SPOSTA IL CAPITOLO di chi sta leggendo per un errore di
         chi chiama. Fra i due modi di sbagliare, «le frecce non fanno niente»
         si vede subito e non porta via niente; «cambia capitolo» non si vede e
         porta via il segno. La prova lo inchioda. */
      if (d.modo === 'corso') return avanti ? 'capitolo:avanti' : 'capitolo:indietro';
      return null;
    }

    return null;
  }

  return { decidi: decidi, AZIONI: AZIONI, FUOCHI: FUOCHI };
}));
