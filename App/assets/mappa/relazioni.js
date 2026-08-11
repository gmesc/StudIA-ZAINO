/* =========================================================================
   relazioni — le FAMIGLIE semantiche degli archi.

   È ciò che distingue una mappa concettuale da una mentale: l'arco porta un
   verbo, e il verbo ha una famiglia. La famiglia dà il colore, così una mappa
   si legge per tipo di legame anche senza fermarsi a leggere le parole.

   ⚠️ QUESTA TABELLA È LA SORGENTE UNICA DEL VOCABOLARIO (§13.5). Da `FAMIGLIE`
   discendono sia i suggerimenti mostrati all'utente (il `datalist` di L3) sia
   l'enum dello schema mandato al modello (G3). Se le due liste divergessero, la
   mappa scritta a mano e quella generata si colorerebbero con due leggi diverse
   — e nessuno se ne accorgerebbe finché non le mette una accanto all'altra. Per
   questo `verbi()` e `verbiPerFamiglia()` esistono: perché nessuno debba
   riscrivere l'elenco altrove.

   IL COLORE, MISURATO (9 agosto 2026). Le famiglie sono passate da 8 a 11, e la
   domanda vera era se ci fosse posto. Misurato: sRGB → LMS → simulazione delle
   tre dicromazie (Viénot–Brettel–Mollon) → CIELAB → ΔE2000, prendendo per ogni
   coppia la visione in cui si distinguono PEGGIO.
     · le tre tinte nuove distano ≥9,2 da ogni altra famiglia, e ≥9,4 fra loro;
     · ⚠️ ma la palette AVEVA GIÀ due coppie che un deuteranope non distingue:
       dipendenza/appartenenza ΔE 3,0 e trasformazione/opposizione ΔE 4,5. Il
       commento che stava qui prima — «nessuna coppia si distingue per la sola
       opposizione rosso-verde» — era un'intenzione, non una misura. Restano il
       punto debole della palette: le tinte nuove non lo peggiorano, ma non lo
       curano nemmeno, e vanno sistemate a parte.
   La ruota è piena: cercando esaustivamente non esiste una quarta tinta satura
   che stia a ΔE ≥8 da tutte. Per questo `definizione` — la più rara delle tre
   nuove — non ha una tinta propria ma un NEUTRO: un grigio non compete per la
   tinta, ed è l'unico posto rimasto davvero libero.

   Modulo PURO: nessun DOM, nessuna dipendenza. Vive in App/ perché lo carica il
   renderer con un <script>, ma è UMD e i test lo richiedono da Node — una sola
   implementazione, due consumatori (mai una copia per parte).
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MappaRelazioni = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FAMIGLIE = {
    trasformazione: {
      etichetta: 'Causa · effetto', colore: 'hsl(28,85%,45%)',
      verbi: ['causa', 'provoca', 'produce', 'genera', 'determina', 'porta a', 'trasforma']
    },
    dipendenza: {
      etichetta: 'Dipendenza · prerequisito', colore: 'hsl(265,70%,52%)',
      verbi: ['richiede', 'dipende da', 'presuppone', 'utilizza', 'permette', 'è condizione di']
    },
    sequenza: {
      etichetta: 'Sequenza · processo', colore: 'hsl(200,80%,40%)',
      verbi: ['precede', 'segue', 'deriva da', 'avvia', 'è seguito da']
    },
    appartenenza: {
      etichetta: 'Gerarchia · parte di', colore: 'hsl(220,65%,48%)',
      verbi: ['fa parte di', 'comprende', 'include', 'contiene', 'è esempio di', 'appartiene a', 'si articola in']
    },
    regolazione: {
      etichetta: 'Controllo · regola', colore: 'hsl(315,55%,46%)',
      verbi: ['regola', 'governa', 'controlla', 'limita', 'guida', 'sostiene']
    },
    opposizione: {
      etichetta: 'Contrasto · opposto', colore: 'hsl(15,75%,48%)',
      verbi: ['si oppone a', 'contrasta', 'esclude', 'differisce da', 'nega', 'ostacola']
    },
    analogia: {
      etichetta: 'Analogia · somiglianza', colore: 'hsl(158,60%,32%)',
      verbi: ['è simile a', 'corrisponde a', 'assomiglia a', 'è paragonabile a', 'richiama']
    },

    /* --- Le tre famiglie del §13.5, MISURATE sul corpus TD74 prima di fissarle
       (210 capitoli, 5.259 frasi). Si conta la FRASE, non l'occorrenza, e il
       verbo si cerca flesso — «riducono», «valutare» — perché la prosa non
       scrive mai la forma dell'enum. Con i vocabolari esatti scritti qui sotto:

         dipendenza     213 frasi · 119 capitoli
       * intervento     192 ·  88          trasformazione 183 · 103
         regolazione    172 ·  88        * misura         156 ·  90
         appartenenza   133 ·  79        * definizione     97 ·  68
         sequenza        94 ·  68          altro           32 ·  28
         opposizione     31 ·  23          analogia        22 ·  18

       Tutte e tre stanno in mezzo al gruppo, e ognuna si riempie più delle
       quattro famiglie più rare già in uso: nessuna è entrata per simmetria.
       Tre cose che la misura ha corretto rispetto al piano, e che spiegano i
       vocabolari qui sotto:

       ① Le forme riflessive con la preposizione valgono pochissimo da sole
          («si misura con» 6 frasi, «si valuta con» 9, «si osserva in» 7): è
          come si SCRIVE un arco, non come parla un capitolo. La famiglia sta in
          piedi sui transitivi — indica 64, segnala 38, rileva 25, evidenzia 17.
          Il vocabolario tiene le une e gli altri, ma ogni relazione in UNA sola
          forma, quella che si legge bene sull'arco: «X si valuta con Y», mai
          «X valuta Y», che direbbe il contrario. Sinonimi ridondanti
          indebolirebbero un enum che serve proprio a chiudere le scelte.
       ② ⚠️ «è» NON è nel vocabolario, benché il §13.5 lo elencasse per primo.
          Compare in 1.882 frasi su 5.259 (36%): è la copula, non un legame. Come
          voce dell'enum sarebbe una calamita — e, peggio, `famigliaDi()` cerca
          anche per sottostringa, quindi una chiave lunga un carattere vincerebbe
          su «altro» per qualunque frase che contenga « è ». Un arco scritto «è»
          resta neutro, che è esattamente ciò che merita.
       ③ ⚠️ La prova che il §13.5 portava per `definizione` — «è esempio di»
          finito sotto *gerarchia* — nel corpus NON c'è: zero asserzioni
          esplicite. Il corpus esemplifica con «per esempio», che è un inciso fra
          una frase e un suo aside, non un legame fra due concetti. La famiglia
          regge lo stesso, ma per i verbi di definizione vera (significa 52,
          si chiama 22, si definisce 21), non per l'esemplificazione. --- */

    /* Nessuna tinta propria: un NEUTRO, e non per mancanza di posto soltanto.
       È la più rara delle tre nuove (97 frasi), ed è la relazione che in un
       capitolo didattico sta ovunque: colorarla vorrebbe dire dare una tinta
       vistosa agli archi più prevedibili della mappa, che è il guasto del §13.5
       — non il rimedio. Il grigio la fa arretrare e lascia parlare le famiglie
       che dicono qualcosa. ΔE ≥10,9 da tutte, «altro» compreso: recede, ma non
       si confonde. */
    definizione: {
      etichetta: 'Definizione · identità', colore: 'hsl(220,6%,56%)',
      verbi: ['si definisce', 'significa', 'si chiama', 'è definito come', 'consiste in', 'si intende come']
    },
    // verde a ΔE 9,2 (il più vicino è `sequenza`): l'unica banda di tinta rimasta
    // aperta fra l'arancio della trasformazione e il verde scuro dell'analogia
    misura: {
      etichetta: 'Misura · valutazione', colore: 'hsl(130,45%,44%)',
      verbi: ['si misura con', 'si valuta con', 'si osserva in', 'indica', 'rileva', 'segnala', 'evidenzia']
    },
    // cremisi a ΔE 9,4 (il più vicino è `opposizione`, 21° di tinta più in là:
    // ⚠️ è la coppia da guardare per prima se un giorno la palette va rivista)
    intervento: {
      etichetta: 'Intervento · compenso', colore: 'hsl(354,55%,48%)',
      verbi: ['compensa', 'riduce', 'potenzia', 'allena', 'automatizza', 'facilita', 'dispensa da', 'si interviene con']
    },

    /* `altro` resta ULTIMO: è il ripiego, e in legenda si legge come tale. */
    altro: {
      etichetta: 'Altro · libero', colore: 'hsl(220,10%,45%)',
      verbi: ['collega', 'si riferisce a', 'è associato a', 'vedi anche', 'è correlato a']
    }
  };

  var CHIAVI = Object.keys(FAMIGLIE);

  /* verbo → famiglia, costruito UNA volta dai vocabolari sopra: aggiungere un
     verbo a una famiglia lo rende riconoscibile, senza una seconda tabella da
     tenere allineata a mano. */
  var PER_VERBO = (function () {
    var m = {};
    CHIAVI.forEach(function (k) {
      FAMIGLIE[k].verbi.forEach(function (v) {
        /* ⚠️ Un verbo in due famiglie è un colore ambiguo, e prima si scopriva
           solo guardando una mappa già disegnata: l'ultima famiglia dichiarata
           sovrascriveva in silenzio la prima, e lo stesso verbo cambiava colore
           per un motivo che non stava da nessuna parte. Ora salta al
           caricamento del modulo — quindi al primo test, non alla prima
           stampa. */
        if (m[v]) {
          throw new Error('relazioni: il verbo «' + v + '» sta in due famiglie (' +
            m[v] + ' e ' + k + '): il colore sarebbe ambiguo');
        }
        m[v] = k;
      });
    });
    return m;
  })();

  function normalizza(rel) {
    return String(rel == null ? '' : rel).toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/^(che|il quale|la quale)\s+/, '')
      .trim()
      .replace(/[.,;:!?]+$/, '');
  }

  /** Famiglia di un verbo. Corrispondenza esatta, poi per prefisso più lungo
   *  («comprende anche» → appartenenza). Sconosciuto o vuoto → 'altro'. */
  function famigliaDi(rel) {
    var v = normalizza(rel);
    if (!v) return 'altro';
    if (PER_VERBO[v]) return PER_VERBO[v];
    var best = null, bestLen = 0;
    Object.keys(PER_VERBO).forEach(function (k) {
      if (k.length > bestLen && (v === k || v.indexOf(k + ' ') === 0 || v.indexOf(' ' + k) >= 0)) {
        best = PER_VERBO[k]; bestLen = k.length;
      }
    });
    return best || 'altro';
  }

  function coloreDi(rel) { return FAMIGLIE[famigliaDi(rel)].colore; }

  /**
   * Tutti i verbi in una lista piatta e ordinata. **È LA SORGENTE UNICA**: la
   * usano il `datalist` dell'editor (L3) e l'enum dello schema mandato al
   * modello (G3), che devono dire la stessa cosa (§13.5). Ordinata, perché una
   * tendina in ordine di dichiarazione costringe a leggerla tutta, e perché una
   * lista stabile non fa diff spuri nello schema.
   *
   * ⚠️ Nessuno riscriva l'elenco altrove: due liste che divergono sono
   * esattamente il guasto che questa funzione esiste per rendere impossibile.
   */
  function verbi() {
    return Object.keys(PER_VERBO).sort(function (a, b) { return a.localeCompare(b, 'it'); });
  }

  /** Lo stesso vocabolario raggruppato per famiglia — serve al datalist con le
   *  intestazioni e a chi vuole mostrare che cosa colora che cosa.
   *  Restituisce COPIE: chi la chiama non deve poter modificare `FAMIGLIE` per
   *  sbaglio, o la sorgente unica smetterebbe di essere unica. */
  function verbiPerFamiglia() {
    var out = {};
    CHIAVI.forEach(function (k) { out[k] = FAMIGLIE[k].verbi.slice(); });
    return out;
  }

  /** Nome vecchio di `verbi()`. Delega, non copia — è la stessa regola di
   *  `modifica.fissato`: una porta, non un duplicato. */
  function vocabolario() { return verbi(); }

  /** Le famiglie effettivamente usate da un insieme di archi: è la legenda da
   *  stampare in fondo al foglio (una legenda completa direbbe cose assenti). */
  function legenda(archi) {
    var viste = {};
    (archi || []).forEach(function (a) {
      if (!a || !a.rel) return;
      viste[famigliaDi(a.rel)] = true;
    });
    return CHIAVI.filter(function (k) { return viste[k]; })
      .map(function (k) { return { chiave: k, etichetta: FAMIGLIE[k].etichetta, colore: FAMIGLIE[k].colore }; });
  }

  return { FAMIGLIE: FAMIGLIE, CHIAVI: CHIAVI, normalizza: normalizza,
           famigliaDi: famigliaDi, coloreDi: coloreDi, legenda: legenda,
           verbi: verbi, verbiPerFamiglia: verbiPerFamiglia, vocabolario: vocabolario };
}));
