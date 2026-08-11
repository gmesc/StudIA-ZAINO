/* =========================================================================
   grafo — il modello della mappa e la sua igiene.

   Un grafo è { nodi:[{id,testo,…}], archi:[{da,a,rel,…}] }. Nient'altro: le
   coordinate le mette il layout, i colori il disegno.

   `sanitizza` è il gemello di `entroSchema` per i grafi: non crede a ciò che
   arriva (un modello, un file scritto a mano, una vecchia versione) e ricalcola
   ciò che si può ricalcolare — livelli, genitore unico, gruppo — scrivendo in
   `note` che cosa ha toccato. La lezione viene da MappAI: un `livello`
   dichiarato e sbagliato non si vede, e sballa in silenzio tutti i layout.

   Modulo PURO, UMD (vedi relazioni.js).
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MappaGrafo = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function idDi(x) { return (x && typeof x === 'object') ? x.id : x; }

  /** Il numero che arriva da uno slider o da una voce di menu, o `null` se non
   *  è un numero. `null`, `undefined` e la stringa vuota NON sono zero: sono
   *  «niente», e uno zero preso per errore poterebbe l'intera mappa — è la
   *  stessa trappola di `fissato` qui sotto, `Number(null)` fa 0. */
  function numeroOpt(x) {
    if (x === null || x === undefined || x === '') return null;
    var n = Number(x);
    return isFinite(n) ? n : null;
  }

  /**
   * Un nodo è FISSATO se e solo se ha `x` e `y`, ed entrambe sono numeri
   * finiti: nessun flag accanto, la presenza delle coordinate È il flag.
   *
   * Sta nel vocabolario del modello — qui — e non in chi la usa, perché la
   * stessa domanda la fanno da tre parti: i motori (`layouts`, per sapere quali
   * posizioni non ricalcolare), le operazioni di modifica (`libera`,
   * `liberaTutte`) e il menu contestuale, dove «Libera la posizione» compare
   * solo per un nodo che è stato davvero spostato a mano. Tre letture a occhio
   * della stessa condizione sono tre condizioni diverse appena qualcuno ne
   * cambia una — e `layouts` non può chiederla a `modifica`, che gli sta sopra.
   *
   * ⚠️ Il controllo è sul TIPO, non su `isFinite(+n.x)`: `+null` e `+''` fanno
   * zero, e lo zero è una posizione legittima — un nodo posato sull'origine
   * risulterebbe indistinguibile da uno che non è mai stato spostato. Per la
   * stessa ragione `"120"` non è una coordinata: a raddrizzare ciò che arriva
   * dal disco ci pensa `lib/mappe.js` in lettura, qui il nodo o è a posto o non
   * lo è.
   */
  function fissato(n) {
    return !!n
      && typeof n.x === 'number' && isFinite(n.x)
      && typeof n.y === 'number' && isFinite(n.y);
  }

  /** Archi normalizzati a {da, a, rel, …}, senza cappi né doppioni.
   *  Un cappio o un doppione non è un errore da segnalare: è rumore che ogni
   *  algoritmo a valle dovrebbe altrimenti riconoscere per conto suo. */
  function archi(g) {
    var visti = {}, out = [];
    (g.archi || []).forEach(function (l) {
      var da = idDi(l.da != null ? l.da : l.source);
      var a = idDi(l.a != null ? l.a : l.target);
      if (da == null || a == null || da === a) return;
      var k = da + '␟' + a;
      if (visti[k]) return;
      visti[k] = true;
      out.push({ da: da, a: a, rel: l.rel || '', cross: !!l.cross, bidir: !!l.bidir, _o: l });
    });
    return out;
  }

  function mappaNodi(g) {
    var m = {};
    (g.nodi || []).forEach(function (n) { m[n.id] = n; });
    return m;
  }

  /** Adiacenza non orientata (per vicini, componenti, anelli). */
  function adiacenza(nodi, es) {
    var adj = {};
    nodi.forEach(function (n) { adj[n.id] = []; });
    es.forEach(function (e) {
      if (adj[e.da]) adj[e.da].push(e.a);
      if (adj[e.a]) adj[e.a].push(e.da);
    });
    return adj;
  }

  /** Archi entranti/uscenti separati (per parentela e ordine topologico). */
  function incidenze(nodi, es) {
    var succ = {}, pred = {};
    nodi.forEach(function (n) { succ[n.id] = []; pred[n.id] = []; });
    es.forEach(function (e) {
      if (succ[e.da]) succ[e.da].push(e.a);
      if (pred[e.a]) pred[e.a].push(e.da);
    });
    return { succ: succ, pred: pred };
  }

  /* ------------------------------------------------------------------ igiene */

  /** Rompe i cicli con una DFS: gli archi all'indietro vengono INVERTITI, non
   *  buttati. Perdere un arco cambia il significato della mappa; invertirlo
   *  cambia solo da che parte la si legge, e il disegno lo dice con la freccia. */
  function rompiCicli(ids, es) {
    var stato = {}, invertiti = 0, out = [];
    var perNodo = {};
    ids.forEach(function (i) { stato[i] = 0; perNodo[i] = []; });
    es.forEach(function (e) { if (perNodo[e.da]) perNodo[e.da].push(e); });

    ids.forEach(function (r) {
      if (stato[r] !== 0) return;
      // DFS iterativa: una mappa profonda non deve poter esaurire lo stack
      var pila = [{ id: r, i: 0 }];
      stato[r] = 1;
      while (pila.length) {
        var top = pila[pila.length - 1];
        var lista = perNodo[top.id] || [];
        if (top.i >= lista.length) { stato[top.id] = 2; pila.pop(); continue; }
        var e = lista[top.i++];
        var s = stato[e.a];
        if (s === 1) { out.push({ da: e.a, a: e.da, rel: e.rel, cross: e.cross, bidir: e.bidir, _o: e._o, _inv: true }); invertiti++; }
        else {
          out.push(e);
          if (s === 0) { stato[e.a] = 1; pila.push({ id: e.a, i: 0 }); }
        }
      }
    });
    return { archi: out, invertiti: invertiti };
  }

  /** Profondità topologica: cammino più lungo dalle sorgenti, sui cicli rotti.
   *  Serve quando il `livello` dichiarato non c'è o non è affidabile. */
  function profondita(nodi, es) {
    var ids = nodi.map(function (n) { return n.id; });
    var br = rompiCicli(ids, es);
    var inGrado = {}, succ = {};
    ids.forEach(function (i) { inGrado[i] = 0; succ[i] = []; });
    br.archi.forEach(function (e) { if (inGrado[e.a] != null) { inGrado[e.a]++; succ[e.da].push(e.a); } });
    var liv = {}, coda = [];
    ids.forEach(function (i) { liv[i] = 0; if (!inGrado[i]) coda.push(i); });
    var testa = 0;
    while (testa < coda.length) {
      var u = coda[testa++];
      succ[u].forEach(function (v) {
        if (liv[v] < liv[u] + 1) liv[v] = liv[u] + 1;
        if (--inGrado[v] === 0) coda.push(v);
      });
    }
    // resti di ciclo non raggiunti: si appoggiano al più profondo dei predecessori
    ids.forEach(function (i) { if (liv[i] == null) liv[i] = 0; });
    return { livello: liv, invertiti: br.invertiti, archi: br.archi };
  }

  /** Foresta portante: un genitore solo per nodo.
   *  Fra più candidati vince quello di livello inferiore, poi il primo incontrato:
   *  è la regola che rende l'albero stabile fra due aperture della stessa mappa. */
  function foresta(nodi, es, livello) {
    var genitore = {}, candidati = {};
    nodi.forEach(function (n) { candidati[n.id] = []; });
    es.forEach(function (e) { if (candidati[e.a] && !e.cross) candidati[e.a].push(e.da); });
    nodi.forEach(function (n) {
      var lista = candidati[n.id];
      if (!lista || !lista.length) return;
      var best = null;
      lista.forEach(function (p) {
        if (livello[p] >= livello[n.id]) return;                 // non è un genitore: è un pari o un figlio
        if (best === null || livello[p] < livello[best]) best = p;
      });
      if (best === null) best = lista[0];
      genitore[n.id] = best;
    });
    var radici = nodi.filter(function (n) { return genitore[n.id] == null; }).map(function (n) { return n.id; });
    var figli = {};
    nodi.forEach(function (n) { figli[n.id] = []; });
    nodi.forEach(function (n) { var p = genitore[n.id]; if (p != null && figli[p]) figli[p].push(n.id); });
    return { genitore: genitore, figli: figli, radici: radici };
  }

  /**
   * Rimette in ordine un grafo comunque arrivato. Non lancia mai: ripara e
   * racconta. Ciò che non si può riparare (un arco verso un nodo inesistente)
   * si toglie, e finisce nelle note — sparire in silenzio è peggio.
   *
   * @returns {{nodi, archi, note:string[]}}
   */
  function sanitizza(g) {
    var note = [];
    var nodi = (g && Array.isArray(g.nodi) ? g.nodi : []).filter(function (n) { return n && n.id != null; })
      .map(function (n) { return Object.assign({}, n); });

    // id doppi: il secondo perde, altrimenti gli archi diventano ambigui
    var visti = {}, unici = [];
    nodi.forEach(function (n) {
      if (visti[n.id]) { note.push('nodo con id doppio scartato: ' + n.id); return; }
      visti[n.id] = true; unici.push(n);
    });
    nodi = unici;

    var vivi = {};
    nodi.forEach(function (n) { vivi[n.id] = true; });
    var tutti = archi({ archi: (g && g.archi) || [] });
    var es = tutti.filter(function (e) { return vivi[e.da] && vivi[e.a]; });
    if (es.length !== tutti.length) note.push((tutti.length - es.length) + ' archi verso nodi inesistenti rimossi');

    /* Anche il grafo vuoto esce con la forma PIENA. Un ritorno abbreviato
       costringerebbe ognuno dei quattro motori a ricordarsi del caso limite, e
       basta che uno se lo dimentichi perché la mappa vuota lanci invece di
       essere vuota. */
    if (!nodi.length) return { nodi: [], archi: [], note: note, genitore: {}, figli: {}, radici: [] };

    // livelli: SEMPRE ricalcolati. Un livello dichiarato è un'opinione.
    var p = profondita(nodi, es);
    var cambiati = 0;
    nodi.forEach(function (n) {
      if (n.livello !== p.livello[n.id]) cambiati++;
      n.livello = p.livello[n.id];
    });
    if (cambiati) note.push(cambiati + ' livelli ricalcolati dalla struttura');
    if (p.invertiti) note.push(p.invertiti + ' archi invertiti per rompere un ciclo');

    // gruppo: si eredita dall'antenato di primo livello, così il colore di un
    // ramo resta quello del ramo anche dopo uno spostamento
    var f = foresta(nodi, es, p.livello);
    var perId = {};
    nodi.forEach(function (n) { perId[n.id] = n; });
    var ordinati = nodi.slice().sort(function (a, b) { return a.livello - b.livello; });
    var prossimo = 1;
    ordinati.forEach(function (n) {
      var g1 = f.genitore[n.id];
      if (n.livello <= 0) { if (n.gruppo == null) n.gruppo = 0; return; }
      if (g1 != null && perId[g1] && perId[g1].livello >= 1) { n.gruppo = perId[g1].gruppo; return; }
      if (n.gruppo == null) n.gruppo = prossimo++;
      else prossimo = Math.max(prossimo, n.gruppo + 1);
    });

    return { nodi: nodi, archi: es, note: note, genitore: f.genitore, figli: f.figli, radici: f.radici };
  }

  /* ------------------------------------------------------- sotto-grafi (focus) */

  /**
   * Un salto in tutte le direzioni: da ogni id del `bordo` si entra in ciò che
   * gli sta attaccato, in entrambi i versi. Torna SOLO i nuovi arrivati, che
   * sono il bordo del salto dopo.
   *
   * Sta da solo perché un salto e dieci salti sono la stessa mossa ripetuta:
   * `vicini` è il caso a uno, il vicinato allargato del focus è il caso a n, e
   * la regola su che cosa tocca che cosa è scritta qui una volta.
   */
  function unSalto(es, bordo, dentro) {
    var era = {}, nuovi = [];
    bordo.forEach(function (i) { era[i] = true; });
    es.forEach(function (e) {
      if (era[e.da] && !dentro[e.a]) { dentro[e.a] = true; nuovi.push(e.a); }
      if (era[e.a] && !dentro[e.da]) { dentro[e.da] = true; nuovi.push(e.da); }
    });
    return nuovi;
  }

  /** Il nodo e ciò che lo tocca entro `salti` salti, in entrambi i versi.
   *  `salti` mancante vale 1; zero è legittimo e vuol dire «solo questo nodo». */
  function intorno(g, id, salti) {
    var n = numeroOpt(salti);
    n = (n === null) ? 1 : Math.max(0, Math.floor(n));
    var es = archi(g), dentro = {}, bordo = [id];
    dentro[id] = true;
    for (var i = 0; i < n && bordo.length; i++) bordo = unSalto(es, bordo, dentro);
    return Object.keys(dentro);
  }

  /** Nodo + tutto ciò che tocca a un salto, in entrambi i versi. */
  function vicini(g, id) { return intorno(g, id, 1); }

  /** Chiusura lungo gli archi in UN verso solo: `pred` risale, `succ` scende.
   *  Il visitato non è un'ottimizzazione: senza, un ciclo non finirebbe più. */
  function catena(dir, id) {
    var visti = {}, pila = [id];
    while (pila.length) {
      var u = pila.pop();
      (dir[u] || []).forEach(function (v) { if (!visti[v]) { visti[v] = true; pila.push(v); } });
    }
    return visti;
  }

  /** Il nodo, e poi l'unione degli insiemi passati. L'ordine mette sempre lui
   *  per primo: è quello di cui si sta parlando. */
  function conIlNodo(id, insiemi) {
    var fuori = {};
    fuori[id] = true;
    insiemi.forEach(function (m) { Object.keys(m).forEach(function (k) { fuori[k] = true; }); });
    return Object.keys(fuori);
  }

  /** Nodo + antenati + discendenti: la linea di sangue intera. */
  function parentela(g, id) {
    var inc = incidenze(g.nodi || [], archi(g));
    return conIlNodo(id, [catena(inc.pred, id), catena(inc.succ, id)]);
  }

  /**
   * Metà parentela: solo in su (`pred`) o solo in giù (`succ`).
   *
   * ⚠️ Segue TUTTI gli archi, come `parentela` di cui è la metà esatta, e non
   * la foresta portante di `discendenti`: quella serve al colore, che deve
   * scendere lungo l'albero che si vede, mentre qui si chiede «da dove viene» e
   * «dove va» questo concetto, e la risposta sono i legami, tutti.
   */
  function lungoGliArchi(g, id, dir) {
    var inc = incidenze(g.nodi || [], archi(g));
    return conIlNodo(id, [catena(inc[dir], id)]);
  }

  /** Ritaglia il grafo su un insieme di id (nodi e archi con entrambi i capi). */
  function ritaglia(g, ids) {
    var dentro = {};
    (ids || []).forEach(function (i) { dentro[i] = true; });
    return {
      nodi: (g.nodi || []).filter(function (n) { return dentro[n.id]; }),
      archi: archi(g).filter(function (e) { return dentro[e.da] && dentro[e.a]; })
    };
  }

  /** Il sottoalbero di `id` lungo la foresta portante, lui escluso.
   *  Il visitato serve davvero: la foresta di un grafo storto può richiudersi
   *  su sé stessa, e senza guardia il giro non finirebbe mai. */
  function sottoalbero(figli, id) {
    var visti = {}, out = [], pila = (figli[id] || []).slice();
    while (pila.length) {
      var u = pila.pop();
      if (visti[u]) continue;
      visti[u] = true; out.push(u);
      (figli[u] || []).forEach(function (v) { pila.push(v); });
    }
    return out;
  }

  /** Discendenti di un nodo lungo la foresta portante (per il colore a cascata). */
  function discendenti(g, id) {
    return sottoalbero(sanitizza(g).figli, id);
  }

  /* ------------------------------------------------------------- le potature

     Tre modi di mostrare meno mappa: il FUOCO su un nodo (`focus`), la SOGLIA
     di profondità (`entroProfondita`), i RAMI CHIUSI (`senzaRami`). Nell'app si
     applicano in fila — focus → profondità → rami — e perché quella fila stia
     in piedi senza che nessuna delle tre sappia delle altre, tutte e tre
     rispettano le stesse regole:

     · stesso contratto in uscita: { grafo, nascosti, quanti, frontiera };
     · INDIPENDENTI: ognuna riparte da `sanitizza` sul grafo che RICEVE e non
       porta con sé niente della precedente. Nessuno stato passa fra loro,
       quindi l'ordine si può cambiare senza riscriverle;
     · IDEMPOTENTI: riapplicata al proprio risultato non toglie più niente, e
       allora restituisce LO STESSO oggetto. È ciò che permette a chi disegna di
       chiedere `out.grafo === g` invece di confrontare due liste di nodi.

     Da dove si contano i livelli dopo un fuoco. `entroProfondita` non legge il
     `livello` scritto nei nodi: lo fa ricalcolare da `sanitizza` sul grafo che
     ha in mano, e lo zero sono le sorgenti di QUEL grafo. Dopo un fuoco «figli»
     o «vicini» la sorgente è il nodo messo a fuoco, e lo slider conta da lui —
     che è ciò che uno si aspetta guardando una mappa già ridotta a un nodo.
     Dopo «genitori» o «parentela», invece, gli antenati sono rimasti dentro e
     la vecchia radice varrebbe ancora zero: lo slider taglierebbe via per primo
     proprio il nodo che l'utente ha appena scelto. Per questo c'è `opt.da`, che
     rimette l'origine sul nodo a fuoco e mette al riparo tutto ciò che gli sta
     SOPRA (livello negativo, mai oltre la soglia). L'origine è il nodo che
     l'utente ha in mano, non la radice di un albero che ha smesso di guardare.

     ⚠️ Il livello di cui si parla qui è quello TOPOLOGICO del modello. Il
     `livello` che i motori scrivono in `res.pos[id]` è un'altra cosa (in
     «anelli» è la distanza dal centro): quello è disposizione, questo è
     struttura. */

  /** Nessuna potatura: LO STESSO oggetto che è arrivato, e i tre conti vuoti.
   *  Se non si nasconde niente non si costruisce niente — è la regola che rende
   *  confrontabile per identità il grafo di ritorno. */
  function intatto(g) { return { grafo: g, nascosti: {}, quanti: {}, frontiera: [] }; }

  /** Il nodo sanitizzato con quell'id, o null. Serve a due domande diverse —
   *  «esiste?» e «a che livello sta?» — che sono la stessa ricerca. */
  function nodoDi(s, id) {
    if (id == null) return null;
    for (var i = 0; i < s.nodi.length; i++) if (s.nodi[i].id === id) return s.nodi[i];
    return null;
  }

  /**
   * Il pezzo comune alle tre potature: dato l'insieme dei nodi da togliere,
   * costruisce il ritaglio e i due conti che l'interfaccia deve mostrare.
   *
   * `quanti` e `frontiera` guardano la FORESTA PORTANTE, la stessa che disegna
   * l'albero: il segno «+3» va messo sul nodo sotto cui quei tre si vedevano,
   * e nel disegno quello è il loro genitore, non un qualunque capo d'arco.
   *
   * @returns {{grafo, nascosti, quanti, frontiera}}
   *   `frontiera` = gli id RIMASTI che hanno almeno un figlio nascosto: è
   *   l'elenco esatto dei segni da disegnare, nell'ordine dei nodi del grafo.
   *   `quanti[id]` esiste per quegli id soli, e dice quanti nodi sono spariti
   *   sotto di lui.
   */
  function pota(g, s, nascosti) {
    if (!Object.keys(nascosti).length) return intatto(g);
    var visibili = [], frontiera = [], quanti = {};
    s.nodi.forEach(function (n) {
      if (nascosti[n.id]) return;
      visibili.push(n.id);
      var tagliato = (s.figli[n.id] || []).some(function (f) { return !!nascosti[f]; });
      if (!tagliato) return;
      frontiera.push(n.id);
      var persi = 0;
      sottoalbero(s.figli, n.id).forEach(function (u) { if (nascosti[u]) persi++; });
      quanti[n.id] = persi;
    });
    return { grafo: ritaglia(g, visibili), nascosti: nascosti, quanti: quanti, frontiera: frontiera };
  }

  /**
   * Rami chiusi: toglie dal grafo il sottoalbero di ogni nodo in `chiusi`.
   *
   * Si toglie invece di nascondere in CSS perché chiudere un ramo serve proprio
   * a restituire spazio agli altri: se i nodi restassero, il buco resterebbe
   * dov'era e il gesto non avrebbe senso.
   *
   * @param chiusi  oggetto o array di id. Gli id sconosciuti si ignorano: la
   *                mappa può essersi rigenerata sotto, e non è un errore.
   * @returns {{grafo, nascosti, quanti, frontiera, chiudibili, figli}}
   *          `chiudibili` è id → 'aperto' | 'chiuso' per i soli nodi VISIBILI
   *          che hanno figli: è l'elenco esatto dei tasti da disegnare, ed è
   *          `frontiera` letta al contrario — chi ha figli nascosti è chiuso,
   *          chi ha figli e non li ha nascosti è aperto.
   */
  function senzaRami(g, chiusi) {
    var s = sanitizza(g);
    var lista = Array.isArray(chiusi) ? chiusi : Object.keys(chiusi || {});
    var nascosti = {};
    lista.forEach(function (id) {
      sottoalbero(s.figli, id).forEach(function (u) { nascosti[u] = true; });
    });
    var p = pota(g, s, nascosti);
    var chiuso = {};
    p.frontiera.forEach(function (id) { chiuso[id] = true; });
    var chiudibili = {};
    s.nodi.forEach(function (n) {
      if (nascosti[n.id]) return;
      if (s.figli[n.id] && s.figli[n.id].length) chiudibili[n.id] = chiuso[n.id] ? 'chiuso' : 'aperto';
    });
    return {
      grafo: p.grafo, nascosti: p.nascosti, quanti: p.quanti, frontiera: p.frontiera,
      chiudibili: chiudibili, figli: s.figli
    };
  }

  /**
   * Slider di profondità: via tutto ciò che sta più in giù del livello `max`.
   *
   * Il livello è quello TOPOLOGICO ricalcolato da `sanitizza`, non quello
   * dichiarato nel file: un livello dichiarato è un'opinione, e una mappa
   * ridotta in base a un'opinione sbagliata taglia i nodi sbagliati.
   *
   * @param max    la soglia. Nulla, vuota, non numerica o negativa vuol dire
   *               «nessuna soglia»; una soglia oltre la profondità massima non
   *               nasconde niente. In tutti questi casi torna LO STESSO oggetto.
   * @param opt.da id da prendere come origine (tipicamente il nodo a fuoco): i
   *               livelli si contano da lui, e chi gli sta sopra non si tocca
   *               mai. Un id sconosciuto si ignora e l'origine torna la radice.
   * @returns {{grafo, nascosti, quanti, frontiera}}
   */
  function entroProfondita(g, max, opt) {
    var soglia = numeroOpt(max);
    if (soglia === null || soglia < 0) return intatto(g);
    var s = sanitizza(g);
    var da = nodoDi(s, opt && opt.da);
    var zero = da ? da.livello : 0;
    var nascosti = {};
    s.nodi.forEach(function (n) { if (n.livello - zero > soglia) nascosti[n.id] = true; });
    return pota(g, s, nascosti);
  }

  /** L'insieme dei nodi che il fuoco tiene, secondo il modo. `null` = modo che
   *  non si conosce, e allora non si taglia niente: fra togliere mezza mappa
   *  per un modo scritto male e non fare nulla, non fare nulla si vede. */
  function insiemeFuoco(g, id, modo, opt) {
    if (modo === 'vicini') return intorno(g, id, opt && opt.salti);
    if (modo === 'parentela') return parentela(g, id);
    if (modo === 'genitori') return lungoGliArchi(g, id, 'pred');
    if (modo === 'figli') return lungoGliArchi(g, id, 'succ');
    return null;
  }

  /**
   * Modalità focus: resta il nodo scelto e la sua cerchia, il resto sparisce.
   *
   * @param modo  'vicini'    il nodo e ciò che tocca entro `opt.salti` salti
   *                          (default 1), in entrambi i versi;
   *              'parentela' antenati E discendenti, la linea di sangue intera;
   *              'genitori'  solo gli antenati — «da dove viene questo»;
   *              'figli'     solo i discendenti — «dove porta questo».
   * @param opt.salti  quanti salti per 'vicini'. Zero è legittimo: solo il nodo.
   * @returns {{grafo, nascosti, quanti, frontiera}} — id sconosciuto o modo
   *          sconosciuto restituiscono il grafo intatto, senza lanciare.
   */
  function focus(g, id, modo, opt) {
    var s = sanitizza(g);
    if (!nodoDi(s, id)) return intatto(g);
    var tenuti = insiemeFuoco(g, id, modo, opt);
    if (!tenuti) return intatto(g);
    var dentro = {};
    tenuti.forEach(function (i) { dentro[i] = true; });
    var nascosti = {};
    s.nodi.forEach(function (n) { if (!dentro[n.id]) nascosti[n.id] = true; });
    return pota(g, s, nascosti);
  }

  return { idDi: idDi, fissato: fissato, archi: archi, mappaNodi: mappaNodi, adiacenza: adiacenza, incidenze: incidenze,
           rompiCicli: rompiCicli, profondita: profondita, foresta: foresta, sanitizza: sanitizza,
           vicini: vicini, parentela: parentela, ritaglia: ritaglia, discendenti: discendenti,
           senzaRami: senzaRami, entroProfondita: entroProfondita, focus: focus };
}));
