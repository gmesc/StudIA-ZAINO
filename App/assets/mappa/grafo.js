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

  /** Nodo + tutto ciò che tocca a un salto, in entrambi i versi. */
  function vicini(g, id) {
    var es = archi(g), fuori = {};
    fuori[id] = true;
    es.forEach(function (e) {
      if (e.da === id) fuori[e.a] = true;
      if (e.a === id) fuori[e.da] = true;
    });
    return Object.keys(fuori);
  }

  /** Nodo + antenati + discendenti: la linea di sangue intera. */
  function parentela(g, id) {
    var es = archi(g);
    var inc = incidenze(g.nodi || [], es);
    function risali(mappa) {
      var visti = {}, pila = [id];
      while (pila.length) {
        var u = pila.pop();
        (mappa[u] || []).forEach(function (v) { if (!visti[v]) { visti[v] = true; pila.push(v); } });
      }
      return visti;
    }
    var su = risali(inc.pred), giu = risali(inc.succ), fuori = {};
    fuori[id] = true;
    Object.keys(su).forEach(function (k) { fuori[k] = true; });
    Object.keys(giu).forEach(function (k) { fuori[k] = true; });
    return Object.keys(fuori);
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

  /** Discendenti di un nodo lungo la foresta portante (per il colore a cascata). */
  function discendenti(g, id) {
    var s = sanitizza(g);
    var out = [], pila = (s.figli[id] || []).slice();
    while (pila.length) {
      var u = pila.pop();
      out.push(u);
      (s.figli[u] || []).forEach(function (v) { pila.push(v); });
    }
    return out;
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
   * @returns {{grafo, nascosti, quanti, chiudibili, figli}}
   *          `chiudibili` è id → 'aperto' | 'chiuso' per i soli nodi VISIBILI
   *          che hanno figli: è l'elenco esatto dei tasti da disegnare.
   */
  function senzaRami(g, chiusi) {
    var s = sanitizza(g);
    var lista = Array.isArray(chiusi) ? chiusi : Object.keys(chiusi || {});
    var nascosti = {}, quanti = {};
    lista.forEach(function (id) {
      var f = s.figli[id];
      if (!f || !f.length) return;
      var pila = f.slice(), n = 0;
      while (pila.length) {
        var u = pila.pop();
        if (nascosti[u]) continue;
        nascosti[u] = true; n++;
        (s.figli[u] || []).forEach(function (w) { pila.push(w); });
      }
      quanti[id] = n;
    });
    var visibili = s.nodi.filter(function (n) { return !nascosti[n.id]; }).map(function (n) { return n.id; });
    var chiudibili = {};
    visibili.forEach(function (id) {
      if (s.figli[id] && s.figli[id].length) chiudibili[id] = quanti[id] ? 'chiuso' : 'aperto';
    });
    return {
      grafo: Object.keys(nascosti).length ? ritaglia(g, visibili) : g,
      nascosti: nascosti, quanti: quanti, chiudibili: chiudibili, figli: s.figli
    };
  }

  return { idDi: idDi, fissato: fissato, archi: archi, mappaNodi: mappaNodi, adiacenza: adiacenza, incidenze: incidenze,
           rompiCicli: rompiCicli, profondita: profondita, foresta: foresta, sanitizza: sanitizza,
           vicini: vicini, parentela: parentela, ritaglia: ritaglia, discendenti: discendenti,
           senzaRami: senzaRami };
}));
