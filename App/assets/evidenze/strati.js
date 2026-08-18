/* ============================================================================
   evidenze/strati.js — quali segni si accendono, e quali restano spenti
   ============================================================================
   Un'evidenza è un segno sul testo. Questo file risponde a una domanda sola:
   **fra quelle che ci sono, quali si dipingono adesso.**

   La risposta dipende da due cose: l'interruttore generale — le evidenze si
   vedono o non si vedono — e lo STRATO in cui ogni evidenza vive.

   UNO STRATO È UNA LETTURA. Sullo stesso testo un insegnante segna le stesse
   parole per analisi diverse — la metrica, le figure retoriche, il lessico — e
   ognuna si accende per conto suo. Lo stato è
   `{ tutte:true, spenti:['a1b2c3d4'] }`: che cosa è acceso in generale, e quali
   letture sono messe via.

   ⚠️ LO STRATO «BASE» NON ESISTE SU DISCO. Le evidenze fatte prima che gli
   strati esistessero — e quelle fatte senza sceglierne uno — hanno `strato`
   vuoto, e quello vuoto **è** lo strato base: si accende e si spegne come gli
   altri, ma non ha un record nel registro e nessuno lo scrive nel file di
   nessuno. Un vault vecchio resta identico a se stesso finché il primo strato
   non viene creato a mano.

   ⚠️ QUI NON SI DECIDE CHE COSA APPARTIENE A CHE COSA. Quali evidenze siano di
   una pagina o di un capitolo lo dice `evidenzeDi(sup)` nel renderer, ed è un
   FATTO: non cambia perché uno guarda o non guarda. Questo file dice solo che
   cosa si vede — e la differenza non è filosofia, è un guasto evitato: se il
   filtro stesse dentro `evidenzeDi`, con i segni nascosti anche `evidenzaSotto`
   direbbe «qui non c'è niente», e ri-evidenziare una frase già segnata le
   cambierebbe il colore invece di riconoscerla. Nascondere deve cambiare come si
   VEDE, mai che cosa SUCCEDE.

   ⚠️ Lo stato è una PREFERENZA DI LETTURA, non un dato del vault: vive nel
   `localStorage` di questo computer, come il colore e il tratto correnti
   (`evidenzeTratto`). Nessun file dell'utente cambia perché ha spento i segni per
   rileggere una pagina. Se un giorno dovrà viaggiare col vault, è questo il file
   da cui si parte — e la decisione sta in PIANO-BRAYNR.

   Niente DOM, niente Electron: gira in Node e si prova con `node test/strati.js`.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EvidenzeStrati = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Di fabbrica i segni si vedono: chi non ha mai toccato niente deve trovare
   *  l'app com'era il giorno prima. */
  function diFabbrica() { return { tutte: true }; }

  /**
   * Raddrizza uno stato che arriva da fuori — dal `localStorage`, che è una
   * stringa scritta da una versione dell'app che magari non è questa.
   *
   * ⚠️ Tutto ciò che non si capisce diventa «si vedono». Il ripiego non è
   * neutro: uno stato illeggibile che spegnesse i segni farebbe sparire il
   * lavoro dell'utente per un carattere storto in una preferenza, e lui non
   * saprebbe nemmeno dove guardare.
   */
  function normalizza(v) {
    var g = v;
    if (typeof g === 'string') {
      try { g = JSON.parse(g); } catch (e) { return diFabbrica(); }
    }
    if (!g || typeof g !== 'object') return diFabbrica();
    var spenti = [];
    if (Array.isArray(g.spenti)) {
      g.spenti.forEach(function (x) {
        var s = String(x == null ? '' : x);
        if (spenti.indexOf(s) < 0) spenti.push(s);
      });
    }
    var out = { tutte: g.tutte !== false };
    /* ⚠️ Il campo si scrive solo se dice qualcosa: uno `spenti:[]` in ogni
       preferenza è rumore che si porta dietro per sempre, e la stessa regola
       vale qui come vale per `scala` sui nodi e per la misura di un'immagine. */
    if (spenti.length) out.spenti = spenti;
    return out;
  }

  /** Uno strato spento resta spento anche quando il suo id è la stringa vuota:
   *  quello vuoto È lo strato base, non «nessuno strato». */
  function spento(stato, id) {
    var s = normalizza(stato);
    return (s.spenti || []).indexOf(String(id == null ? '' : id)) >= 0;
  }

  /** Accende o spegne UNA lettura. Torna uno stato nuovo: chi chiama lo salva e
   *  ridisegna, come fa con l'interruttore generale. */
  function commutaStrato(stato, id) {
    var s = normalizza(stato), k = String(id == null ? '' : id);
    var spenti = (s.spenti || []).slice();
    var i = spenti.indexOf(k);
    if (i >= 0) spenti.splice(i, 1); else spenti.push(k);
    return normalizza({ tutte: s.tutte, spenti: spenti });
  }

  /** Uno strato che non c'è più non deve restare «spento» per sempre in una
   *  preferenza: sarebbe uno stato invisibile che riemerge il giorno in cui
   *  qualcuno riusa quell'id. */
  function potaSpenti(stato, idEsistenti) {
    var s = normalizza(stato);
    if (!s.spenti) return s;
    var vivi = Array.isArray(idEsistenti) ? idEsistenti.map(String) : [];
    return normalizza({ tutte: s.tutte, spenti: s.spenti.filter(function (k) {
      return k === '' || vivi.indexOf(k) >= 0;
    }) });
  }

  /** Quello che si scrive nel `localStorage`. Stringa, perché è lì che va. */
  function scrivi(stato) { return JSON.stringify(normalizza(stato)); }

  /** Lo stato con l'interruttore generale girato. Una funzione e non due righe
   *  nel renderer: il bottone della Fonte e quello delle Parole chiave la
   *  chiamano tutti e due, e due riti per lo stesso verbo divergono. */
  function commuta(stato) {
    var s = normalizza(stato);
    return { tutte: !s.tutte };
  }

  /** Si vedono, sì o no. */
  function accese(stato) { return normalizza(stato).tutte; }

  /**
   * Le evidenze da dipingere adesso.
   *
   * ⚠️ Torna SEMPRE un array nuovo e non tocca le voci: chi chiama le riconosce
   * per identità (`EvidenzeAncoraggio.risolvi` restituisce la voce per
   * riferimento), e una copia in mezzo romperebbe quel patto.
   */
  function visibili(elenco, stato) {
    var lista = Array.isArray(elenco) ? elenco : [];
    if (!accese(stato)) return [];
    var s = normalizza(stato);
    if (!s.spenti) return lista.slice();
    return lista.filter(function (e) { return !spento(s, e && e.strato); });
  }

  /**
   * Quante se ne vedono e quante no. Serve a DIRLO: un elenco che si accorcia
   * senza spiegare perché è la stessa forma di una perdita silenziosa
   * (invariante 4), e «nessuna parola chiave» detto a chi ne ha trenta spente è
   * una bugia comoda.
   */
  function conta(elenco, stato) {
    var lista = Array.isArray(elenco) ? elenco : [];
    var viste = visibili(lista, stato).length;
    return { viste: viste, nascoste: lista.length - viste, tutte: lista.length };
  }


  /* ------------------------------------------- i segni che si accavallano */

  /** Quante letture si distinguono, per tipo di segno, sulla stessa parola.
   *  Oltre la quarta non c'è più un modo di disegnarle diverso dalle altre —
   *  e una che si dipinge uguale a un'altra è peggio di una dichiarata. */
  var TETTO = 4;

  /**
   * A ogni segno il suo posto nella pila.
   *
   * `segni` = `[{ id, tratto, inizio, fine }]` — gli intervalli sono già
   * risolti sul testo, qui si guarda solo chi si sovrappone a chi. Torna
   * `{ per: { id: { livello, pila, tagliato } }, oltre }`.
   *
   * ⚠️ Le due pile sono SEPARATE: un fondo e una riga sulla stessa parola non
   * si danno fastidio (il colore sta dietro le lettere, la riga sotto), quindi
   * contarli insieme metterebbe una riga al terzo posto per colpa di un fondo
   * che non c'entra. È anche ciò che rende gratis il primo caso del braindump.
   *
   * ⚠️ `pila` dice se quel segno è SOLO o in compagnia, e serve a non cambiare
   * l'aspetto di ciò che è sempre stato solo: una sottolineatura sola resta la
   * riga piena di sempre, un fondo solo resta il colore pieno di sempre.
   *
   * ponytail: confronto a coppie (O(n²)) sui segni di UNA schermata — poche
   * decine. Se un giorno se ne dipingessero migliaia, si ordina e si scorre.
   */
  function livelli(segni) {
    var lista = (Array.isArray(segni) ? segni : [])
      .filter(function (s) { return s && s.id != null; })
      .map(function (s) {
        return { id: String(s.id), tratto: (s.tratto === 'overlay' ? 'overlay' : 'sotto'),
          inizio: Number(s.inizio) || 0, fine: Number(s.fine) || 0 };
      })
      .sort(function (a, b) { return (a.inizio - b.inizio) || (b.fine - a.fine); });
    var per = {}, oltre = 0;
    lista.forEach(function (s, i) {
      var prima = 0, insieme = 1;
      lista.forEach(function (x, j) {
        if (j === i || x.tratto !== s.tratto) return;
        if (!(x.inizio < s.fine && s.inizio < x.fine)) return;   // non si toccano
        insieme++;
        if (j < i) prima++;
      });
      var tagliato = prima >= TETTO;
      if (tagliato) oltre++;
      per[s.id] = { livello: tagliato ? TETTO - 1 : prima, pila: insieme, tagliato: tagliato };
    });
    return { per: per, oltre: oltre };
  }

  /* ------------------------------------------------------- il registro */

  /** Il nome di una lettura, ridotto a ciò che può stare in una riga. */
  function nomeValido(n) {
    return String(n == null ? '' : n).replace(/[\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  }

  /**
   * Un nome che non c'è già. ⚠️ Due letture con lo stesso nome sono due righe
   * indistinguibili in un pannello dove l'unica cosa che si legge è il nome: si
   * numera la seconda, come fa il Finder coi file.
   */
  function nomeLibero(nome, esistenti) {
    var base = nomeValido(nome) || 'Lettura';
    var presi = (Array.isArray(esistenti) ? esistenti : [])
      .map(function (s) { return nomeValido(s && s.nome !== undefined ? s.nome : s).toLowerCase(); });
    if (presi.indexOf(base.toLowerCase()) < 0) return base;
    for (var i = 2; i < 999; i++) {
      var tentativo = base + ' ' + i;
      if (presi.indexOf(tentativo.toLowerCase()) < 0) return tentativo;
    }
    return base;
  }

  /** Raddrizza un record del registro. `null` se non è uno strato: senza id non
   *  si può nominare, e senza nome il pannello mostrerebbe una riga muta. */
  function normalizzaStrato(v) {
    if (!v || typeof v !== 'object') return null;
    var id = String(v.id == null ? '' : v.id).trim();
    var nome = nomeValido(v.nome);
    if (!id || !nome) return null;
    return { id: id, nome: nome, creato: String(v.creato == null ? '' : v.creato) };
  }

  /** Il registro in ordine di nascita: è l'ordine in cui le letture sono state
   *  pensate, e non chiede un campo in più da tenere aggiornato. */
  function ordina(strati) {
    var out = [];
    (Array.isArray(strati) ? strati : []).forEach(function (s) {
      var n = normalizzaStrato(s);
      if (n && !out.some(function (x) { return x.id === n.id; })) out.push(n);
    });
    return out.sort(function (a, b) {
      var d = String(a.creato).localeCompare(String(b.creato));
      return d !== 0 ? d : a.nome.localeCompare(b.nome, 'it');
    });
  }

  /**
   * Le righe del pannello: una per lettura, più quella BASE.
   *
   * ⚠️ La riga base compare solo se qualcosa ci vive dentro. Un vault che non ha
   * mai visto uno strato non deve trovarsi una riga «Base» a spiegargli una cosa
   * che non gli serve; ma appena c'è anche una sola evidenza senza strato, quella
   * riga è l'unico modo per spegnerla — e senza, sarebbe l'unica che non si può
   * mettere via.
   *
   * ⚠️ Le righe portano il CONTO. Un pannello che dice «metrica» e basta non fa
   * capire perché il testo è pulito: «metrica · 12» sì.
   */
  function righe(strati, elenco, stato) {
    var lista = Array.isArray(elenco) ? elenco : [];
    var s = normalizza(stato);
    var quanteDi = function (id) {
      return lista.filter(function (e) { return String((e && e.strato) || '') === id; }).length;
    };
    var out = ordina(strati).map(function (st) {
      return { id: st.id, nome: st.nome, base: false, quante: quanteDi(st.id), spento: spento(s, st.id) };
    });
    var nudi = quanteDi('');
    if (nudi) out.push({ id: '', nome: 'Base', base: true, quante: nudi, spento: spento(s, '') });
    return out;
  }

  return {
    diFabbrica: diFabbrica, normalizza: normalizza, scrivi: scrivi,
    commuta: commuta, accese: accese, visibili: visibili, conta: conta,
    spento: spento, commutaStrato: commutaStrato, potaSpenti: potaSpenti,
    TETTO: TETTO, livelli: livelli,
    nomeValido: nomeValido, nomeLibero: nomeLibero, normalizzaStrato: normalizzaStrato,
    ordina: ordina, righe: righe
  };
}));
