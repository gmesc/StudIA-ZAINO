/* =========================================================================
   genera — la VISTA GENERATA: la mappa ricavata dai file del corso.

   Deterministica: nessuna chiamata al modello, nessun costo, nessuna attesa.

   Per questo la vista generata NON si salva su disco: è una proiezione del
   testo, e il testo è la verità. Rigeneri il capitolo e la mappa lo segue da
   sé; salvarla creerebbe una seconda versione destinata a divergere in
   silenzio. Chi vuole una mappa propria ne fa una copia, che diventa un
   artefatto suo in MAPPE/ e nessuna pipeline tocca più.

   Ogni nodo che nasce da una porzione di testo porta con sé il RIMANDO che
   quella porzione cita: il click riapre il PDF alla pagina o il video al
   minuto, riusando `openNote` del lettore — nessun secondo meccanismo.

   ── Che cosa mappa, adesso (§13 di PIANO-MAPPE-EDITOR) ───────────────────
   Fino a ieri la mappa aveva per rami «Punti chiave», «Note e materiali»,
   «Glossario»: mappava COME il capitolo è confezionato, non che cosa dice, e
   fra una scatola e il suo contenuto l'unica relazione possibile è «contiene»
   — cioè nessuna. Da qui in avanti i nodi sono CONCETTI presi dai paragrafi:

     · la materia prima sono le **parole importanti dell'autore** — i grassetti
       dei paragrafi — e l'autore qui è StudIA, che i capitoli li scrive lui;
     · il glossario è il dizionario naturale che dà a un concetto definizione e
       identità (1.098 voci con definizione sul corpus TD74-DSA);
     · le **parole chiave** dello studente non si generano mai: si trovano
       leggendo, ed è il registro «Mie» — «il punto non è possederle, è
       trovarle» (de Concini, §13.2).

   Le tre scale sono `estrai` (un capitolo), `daLezione` e `daCorso`: la prima
   fa il lavoro, le altre due ri-assemblano. Cambiare soglia o filtro costa
   zero perché nessuna delle due rilegge il testo.

   ⚠️ Tutti gli archi nascono MUTI (`rel: ''`). I verbi li metterà il modello
   in G3, scegliendoli dal vocabolario chiuso di `relazioni.js`: qui il campo
   c'è ed è vuoto, che è la predisposizione. L'unico verbo scritto a mano è
   «si articola in» fra il corso e le sue lezioni, che è vero per costruzione.

   `daCapitolo` resta com'era: è la mappa gratis che si apre stando dentro il
   capitolo, e 23 controlli di `test/roundtrip.js` ne dipendono.

   Modulo PURO, UMD (vedi relazioni.js). Lavora sui capitoli GIÀ PARSATI dal
   lettore (`mdChapter`), non sul markdown: il parser resta uno solo.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MappaGenera = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ENTITA = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ', '&hellip;': '…' };

  /** Da HTML a testo leggibile. Il lettore ci consegna HTML (i capitoli sono
   *  già resi); le etichette dei nodi vogliono il testo nudo. */
  function testo(html) {
    return String(html == null ? '' : html)
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&[a-z#0-9]+;/gi, function (m) { return ENTITA[m] != null ? ENTITA[m] : m; })
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** I rimandi contenuti in una porzione di HTML, nell'ordine in cui compaiono.
   *  La forma è quella che `openNote` del lettore già sa aprire: non si inventa
   *  un secondo formato per dire la stessa cosa. */
  function rimandi(html) {
    var out = [], re = /<a\b[^>]*class="(vlink|plink)"[^>]*>/gi, m;
    var s = String(html == null ? '' : html);
    while ((m = re.exec(s))) {
      var tag = m[0];
      function attr(n) { var a = new RegExp(n + '="([^"]*)"').exec(tag); return a ? a[1] : ''; }
      var file = testo(attr('data-file'));
      if (!file) continue;
      if (m[1] === 'vlink') out.push({ type: 'video', file: file, t: parseInt(attr('data-t'), 10) || 0, label: testo(attr('data-label')) });
      else out.push({ type: 'pdf', file: file, page: parseInt(attr('data-page'), 10) || 1, label: testo(attr('data-label')) });
    }
    return out;
  }

  /** Spezza il corpo del capitolo nelle sue sezioni, seguendo i titoli.
   *  I livelli sono RELATIVI: `#` nel markdown esce come <h3>, ma qui conta
   *  solo che un h4 stia sotto l'h3 che lo precede. */
  function sezioni(html) {
    var s = String(html == null ? '' : html);
    var re = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, m, tappe = [];
    while ((m = re.exec(s))) tappe.push({ liv: +m[1], titolo: testo(m[2]), da: m.index, a: m.index + m[0].length });
    var out = [];
    if (!tappe.length) return out;
    var minLiv = Math.min.apply(null, tappe.map(function (t) { return t.liv; }));
    tappe.forEach(function (t, i) {
      var fine = i + 1 < tappe.length ? tappe[i + 1].da : s.length;
      out.push({ titolo: t.titolo, profondita: t.liv - minLiv, corpo: s.slice(t.a, fine) });
    });
    return out;
  }

  function taglia(s, n) {
    s = String(s || '');
    return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
  }

  /**
   * Mappa di UN capitolo.
   *   radice  = il titolo del capitolo
   *   rami    = i titoli di sezione (o, se non ce ne sono, i punti chiave)
   *   foglie  = i sotto-titoli, e i punti chiave sotto la sezione che li cita
   *   opzionali: un ramo «Glossario» con i termini definiti
   *
   * ⚠️ Questa è la mappa VECCHIA, quella dei contenitori. Resta perché la
   * copre `test/roundtrip.js` e perché qualcuno la chiama ancora; la mappa di
   * capitolo per lo studio è `estrai` + l'assemblaggio, che parla di concetti.
   * ⚠️ Qui `opt.fonti` è un ELENCO di rimandi già risolti; nelle funzioni
   * concettuali qui sotto `opt.fonti` è invece la leva `'pallino'|'nodo'|'no'`.
   * Stesso nome, due significati: non sono la stessa `opt` e non si mescolano.
   *
   * @param cap  capitolo già parsato dal lettore
   * @param opt  { glossario:bool, puntiChiave:bool, lezioneId, indice, fonti:[] }
   */
  function daCapitolo(cap, opt) {
    opt = opt || {};
    var nodi = [], archi = [], n = 0;
    function nodo(testoN, extra) {
      var id = 'n' + (++n);
      var o = { id: id, testo: testoN };
      Object.keys(extra || {}).forEach(function (k) { if (extra[k] != null) o[k] = extra[k]; });
      nodi.push(o);
      return id;
    }
    function arco(da, a, rel) { archi.push({ da: da, a: a, rel: rel || '' }); }

    if (!cap) return { nodi: [], archi: [], titolo: '' };

    var radice = nodo(testo(cap.title), {
      genere: 'radice', origine: 'generata',
      rimando: rimandi(cap.brief || '')[0] || rimandi(cap.html || '')[0] || null,
      nota: testo(cap.brief).slice(0, 400) || null,
      capitolo: opt.indice != null ? opt.indice : null
    });

    var sez = sezioni(cap.html || '');
    var pila = [{ prof: -1, id: radice }];
    sez.forEach(function (s) {
      while (pila.length > 1 && pila[pila.length - 1].prof >= s.profondita) pila.pop();
      var padre = pila[pila.length - 1].id;
      var id = nodo(taglia(s.titolo, 90), {
        genere: 'sezione', origine: 'generata',
        rimando: rimandi(s.corpo)[0] || null,
        capitolo: opt.indice != null ? opt.indice : null
      });
      arco(padre, id, 'si articola in');
      pila.push({ prof: s.profondita, id: id });
    });

    var fonti = (opt.fonti || []).filter(function (f) { return f && f.label; });
    var conGlossario = !!opt.glossario && (cap.glossary || []).length > 0;
    /* Molti capitoli non hanno titoli di sezione: là i punti chiave SONO la
       mappa e vanno appesi alla radice, senza un raccoglitore che aggiunge un
       livello e non dice niente. Il raccoglitore serve solo quando alla radice
       arriva anche altro — le sezioni o il glossario — perché allora distingue
       due cose diverse invece di mescolarle. */
    var raggruppa = sez.length > 0 || conGlossario || fonti.length > 0;
    if (opt.puntiChiave !== false && (cap.keypoints || []).length) {
      var padreKp = radice;
      if (raggruppa) {
        padreKp = nodo('Punti chiave', { genere: 'raccolta', origine: 'generata' });
        arco(radice, padreKp, 'comprende');
      }
      (cap.keypoints || []).forEach(function (k) {
        var id = nodo(taglia(testo(k), 110), { genere: 'punto', origine: 'generata' });
        arco(padreKp, id, raggruppa ? '' : 'comprende');
      });
    }

    /* «Note e materiali»: i punti della fonte che il capitolo cita, con
       l'etichetta che l'autore ha dato loro. Non sono puntatori generici —
       misurato sul corpus TD74 sono frasi come «A1: il criterio della
       discrepanza rispetto al QI»: per i capitoli senza titoli di sezione
       (206 su 210) è la sola struttura argomentativa che i file contengano,
       ed è anche l'unico modo perché la mappa sia navigabile verso la fonte.
       Le etichette arrivano GIÀ RISOLTE da chi chiama (nel lettore è
       `chapterNotes`): qui non si ricostruisce il titolo di un materiale, che
       è logica di un altro modulo. */
    if (fonti.length) {
      var padreFo = nodo('Note e materiali', { genere: 'raccolta', origine: 'generata' });
      arco(radice, padreFo, 'comprende');
      fonti.forEach(function (f) {
        var id = nodo(taglia(testo(f.label), 90), { genere: 'fonte', origine: 'generata', rimando: f });
        arco(padreFo, id, '');
      });
    }

    if (conGlossario) {
      var padreGl = nodo('Glossario', { genere: 'raccolta', origine: 'generata' });
      arco(radice, padreGl, 'comprende');
      (cap.glossary || []).forEach(function (g) {
        // nessun verbo sull'arco: «Glossario» lo dice già, e cinque «definisce»
        // ripetuti sarebbero rumore su una mappa che si guarda a colpo d'occhio
        var id = nodo(taglia(testo(g.t), 60), { genere: 'termine', origine: 'generata', nota: testo(g.d).slice(0, 400) });
        arco(padreGl, id, '');
      });
    }

    return { nodi: nodi, archi: archi, titolo: testo(cap.title) };
  }

  /* =======================================================================
     L'IDENTITÀ DI UN CONCETTO

     È il problema vero, non il disegno (§13.4 punto 4): se «comprensione» e
     «comprensione del testo» si fondono nasce un ponte falso, se «tempo» e
     «tempi» restano separati il ponte vero non nasce.

     La regola che ho seguito, e il verso in cui sbaglia: **si fonde solo
     quando la differenza è grammaticale, mai quando è lessicale**, e nel
     dubbio non si fonde. Concretamente sono due passi, e il secondo costa più
     del primo perché non può essere una funzione di una parola sola.
     ======================================================================= */

  /* Gli articoli, che si tolgono dalla testa del termine. Un micro-titolo è
     scritto «**La modularità.**» e lo stesso concetto ricompare nudo dieci
     righe dopo: l'articolo è un fatto della frase in cui il termine sta, non
     del concetto. ⚠️ La forma richiede lo spazio (o l'apostrofo) proprio
     perché senza si mangia l'inizio delle parole — `le` di «lessicale». */
  var ARTICOLI = /^(?:(?:il|lo|la|i|gli|le|un|uno|una|del|dello|della|dei|degli|delle)\s+|(?:l|un|dell|all|nell)['’]\s*)/;

  /**
   * La chiave con cui due occorrenze diventano lo stesso concetto: minuscole,
   * spazi normali, virgolette e punteggiatura di coda via, articolo iniziale
   * via. Nient'altro — nessuno stemming, nessun taglio di preposizioni: sono
   * quelli che farebbero collassare «comprensione del testo» su «comprensione».
   */
  function normalizza(t) {
    var s = testo(t).toLowerCase()
      .replace(/[«»"“”]/g, '')
      .replace(/^[\s(\[]+/, '')
      .replace(/[\s)\]]+$/, '')
      .replace(/[.,;:!?…]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    return s.replace(ARTICOLI, '').trim();
  }

  /** La chiave privata della vocale finale, parola per parola: è il candidato
   *  di fusione singolare/plurale, non la fusione. «tempo» e «tempi» → «temp». */
  function tronco(chiave) {
    return chiave.split(' ').map(function (w) { return w.replace(/[aeio]$/, ''); }).join(' ');
  }

  /* Le coppie di vocali finali che in italiano sono singolare/plurale della
     stessa parola: o→i (tempo/tempi), a→e (memoria/memorie), e→i
     (comprensione/comprensioni).
     ⚠️ NON c'è a↔o: è la coppia che fonderebbe «casa» con «caso». E non c'è
     a↔i, che pure sarebbe legittima per «problema/problemi»: fondeva anche
     «linguistica» con «linguistici», cioè un nome con un aggettivo, e su un
     corpus dove «analisi qualitativa» e «indici» convivono il guadagno non
     valeva il rischio. Sbaglio dalla parte del non fondere: un ponte mancato
     si vede, un ponte falso no. */
  var COPPIE = { 'i|o': 1, 'a|e': 1, 'e|i': 1 };

  function vocaleFinale(w) { var m = /[aeiou]$/.exec(w); return m ? m[0] : ''; }

  /** Due chiavi sono la stessa parola flessa? Devono avere lo stesso numero di
   *  parole, differire SOLO nella vocale finale di qualcuna, e ogni differenza
   *  dev'essere una coppia legittima. */
  function flessioniDellaStessaParola(a, b) {
    var wa = a.split(' '), wb = b.split(' ');
    if (wa.length !== wb.length) return false;
    var diverse = 0;
    for (var k = 0; k < wa.length; k++) {
      if (wa[k] === wb[k]) continue;
      if (wa[k].slice(0, -1) !== wb[k].slice(0, -1)) return false;
      var va = vocaleFinale(wa[k]), vb = vocaleFinale(wb[k]);
      if (!va || !vb) return false;
      if (!COPPIE[[va, vb].sort().join('|')]) return false;
      diverse++;
    }
    return diverse > 0;
  }

  /** Hash a 32 bit (FNV-1a) del termine normalizzato, in base 36.
   *  L'id di un concetto non può essere `n1`, `n2`: l'estrazione si salva su
   *  disco (§13.4 punto 5) e due capitoli che nominano la stessa cosa devono
   *  produrre lo stesso id, altrimenti il ponte non si conta. */
  function impronta(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(36);
  }

  function idDi(chiave) { return 'c' + impronta(chiave); }

  /** Ordine totale e indipendente dalla lingua del sistema: da qui dipende
   *  QUALE forma diventa il rappresentante di una fusione, cioè un id. */
  function primaDi(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  /* =======================================================================
     LE LEVE

     Tutte qui, con il loro valore di partenza: una soglia scritta dentro una
     funzione è una decisione che nessuno può più cambiare dal ⚙.
     ======================================================================= */

  var LEVE = {
    soglia: 2,          // in quanti capitoli (o lezioni) deve comparire un concetto per stare nella spina
    max: 12,            // tetto ai figli di un ramo — e alle fonti appese a un concetto
    fonti: 'pallino',   // 'pallino' → fonti[] sul concetto · 'nodo' → nodi a sé · 'no' → niente
    annidate: true,     // il sottobosco dei concetti locali compare (chiuso) sotto il suo ramo
    glossario: true,    // le voci di glossario contano come concetti e danno la definizione
    parole: 6,          // oltre questa lunghezza un grassetto è una frase, non un concetto
    indice: null        // l'indice del capitolo, per `estrai` chiamata da sola
  };

  function opzioni(o) {
    o = o || {};
    var out = {};
    Object.keys(LEVE).forEach(function (k) { out[k] = o[k] === undefined ? LEVE[k] : o[k]; });
    if (['pallino', 'nodo', 'no'].indexOf(out.fonti) < 0) out.fonti = LEVE.fonti;
    out.soglia = Math.max(1, +out.soglia || LEVE.soglia);
    out.max = Math.max(1, +out.max || LEVE.max);
    out.parole = Math.max(1, +out.parole || LEVE.parole);
    return out;
  }

  /* =======================================================================
     L'ESTRAZIONE — un capitolo, zero chiamate al modello
     ======================================================================= */

  /* Il testo di un capitolo è fatto di blocchi: <p> quasi sempre, <li> nelle
     note a piè di pagina, qualche titolo. Il blocco è l'unità della
     co-occorrenza — «due concetti nominati nello stesso respiro» — e nulla di
     più fine è disponibile: misurato sul corpus TD74, 206 capitoli su 210 non
     hanno nemmeno un titolo interno. */
  function blocchi(html) {
    var s = String(html == null ? '' : html);
    if (!s.trim()) return [];
    return s.split(/(?=<(?:p|li|h[1-6]|blockquote|figcaption)\b)/i)
      .filter(function (b) { return b && b.trim(); });
  }

  /** Il micro-titolo di un paragrafo: «<p><strong>La modularità.</strong> …».
   *  Misurati 234 in 63 capitoli: dove ci sono, sono la SOLA gerarchia che il
   *  file contenga, e per questo pesano più di un grassetto qualsiasi. */
  function microTitolo(blocco) {
    var m = /^<(?:p|li)\b[^>]*>\s*<strong>([\s\S]*?)<\/strong>/i.exec(blocco);
    return m ? m[1] : '';
  }

  function grassetti(blocco) {
    var out = [], re = /<strong>([\s\S]*?)<\/strong>/gi, m;
    while ((m = re.exec(blocco))) out.push(m[1]);
    return out;
  }

  /* I pesi. Non sono una taratura fine, sono un ordine di importanza:
     un micro-titolo è il titolo di un paragrafo, una voce di glossario è un
     concetto che l'autore ha ritenuto di dover definire, un grassetto è
     un'occorrenza. Stanno qui e non dentro le funzioni perché si leggano. */
  var PESO_GRASSETTO = 1, PESO_MICRO = 3, PESO_GLOSSARIO = 2;

  /** Un grassetto (o una voce di glossario) è un concetto? Le frasi in
   *  grassetto — 132 dei 2.428 grassetti del corpus superano le sei parole —
   *  sono affermazioni, non concetti: come nodo direbbero già tutto e non si
   *  legherebbero a niente. */
  function candidato(chiave, opt) {
    if (!chiave || chiave.length < 3) return false;
    if (chiave.split(' ').length > opt.parole) return false;
    return /[a-zà-öø-ÿ]/i.test(chiave);
  }

  /** I rimandi che il frontmatter dichiara, nella forma che `openNote` apre.
   *  Contano: sul corpus TD74 sono 619 `videoRefs` e 377 `sources`, mentre i
   *  link `pdf:` scritti dentro il testo sono 54 — chi guardasse solo l'HTML
   *  perderebbe l'86% delle fonti PDF. */
  function fontiFrontmatter(cap) {
    var out = [];
    (cap.videoRefs || []).forEach(function (v) {
      var f = testo(v.video); if (!f) return;
      out.push({ type: 'video', file: f, t: parseInt(v.t, 10) || 0, label: testo(v.label) });
    });
    (cap.sources || []).forEach(function (s) {
      var f = testo(s.pdf); if (!f) return;
      out.push({ type: 'pdf', file: f, page: parseInt(s.page, 10) || 1, label: testo(s.label) });
    });
    return out;
  }

  function chiaveFonte(f) {
    return f.type + '|' + f.file + '|' + (f.type === 'video' ? f.t : f.page);
  }

  /** Lo stesso punto della fonte, ma con l'etichetta dell'autore.
   *  Un link dentro il testo si chiama «vai a 2:40»; il frontmatter chiama lo
   *  stesso istante «La definizione di Hammill». Sono la stessa cosa — sul
   *  corpus tutti e 619 i vlink hanno un `videoRefs` allo stesso secondo — e
   *  su un nodo serve il nome, non l'orologio. */
  function arricchisci(r, fm) {
    for (var i = 0; i < fm.length; i++) {
      var f = fm[i];
      if (f.type !== r.type) continue;
      if (f.type === 'video' ? f.t !== r.t : f.page !== r.page) continue;
      if (f.file && r.file && f.file !== r.file) continue;
      return fonte(r.type, r.file || f.file, r.type === 'video' ? r.t : r.page, f.label || r.label);
    }
    return fonte(r.type, r.file, r.type === 'video' ? r.t : r.page, r.label);
  }

  /** Un rimando nella forma che `openNote` apre, e senza campi fantasma: un
   *  `t: undefined` su una fonte PDF finirebbe nell'artefatto salvato. */
  function fonte(type, file, dove, label) {
    var o = { type: type, file: file };
    if (type === 'video') o.t = dove || 0; else o.page = dove || 1;
    o.label = label || '';
    return o;
  }

  function copiaFonte(f) { return fonte(f.type, f.file, f.type === 'video' ? f.t : f.page, f.label); }

  /** `chiave` compare in `frase` come parola intera (e non dentro un'altra). */
  function contiene(frase, chiave) {
    if (!frase || !chiave) return false;
    var i = frase.indexOf(chiave);
    while (i >= 0) {
      var pre = i === 0 ? ' ' : frase.charAt(i - 1);
      var post = i + chiave.length >= frase.length ? ' ' : frase.charAt(i + chiave.length);
      if (!/[a-zà-öø-ÿ0-9]/i.test(pre) && !/[a-zà-öø-ÿ0-9]/i.test(post)) return true;
      i = frase.indexOf(chiave, i + 1);
    }
    return false;
  }

  /* Una fonte del frontmatter è pertinente a un concetto quando la sua
     ETICHETTA lo nomina: «Che cos'è la comorbilità» appartiene a *comorbilità*.
     Misurati 606 agganci di questo tipo sul corpus. La soglia di cinque
     caratteri esiste perché sotto si aggancia il rumore: «sei» pescava «Le sei
     eventualità da considerare». */
  var MIN_ETICHETTA = 5;

  function pertinenti(chiave, fm) {
    if (chiave.length < MIN_ETICHETTA) return [];
    return fm.filter(function (f) { return contiene(normalizza(f.label), chiave); });
  }

  /* Quando due concetti si legano in più modi, quale legame prevale — e con
     esso il VERSO dell'arco. Un micro-titolo che comprende un concetto dice più
     di due parole nello stesso paragrafo; una definizione che ne nomina un
     altro dice più di tutti e due. Sta qui perché la usano l'estrazione e
     l'assemblaggio, e due tabelle uguali in due punti divergono. */
  var RANGO_LEGAME = { definizione: 3, microtitolo: 2, cooccorrenza: 1 };

  /**
   * L'estrazione di UN capitolo: i concetti che il testo mette in rilievo e i
   * legami fra loro. Deterministica e pura — è l'artefatto che (§13.4 punto 5)
   * si paga una volta e che le due scale più grandi si limitano a rimontare.
   *
   * @param cap  capitolo già parsato dal lettore (`mdChapter`)
   * @param opt  le LEVE, più `indice` (quale capitolo è, per la navigazione)
   * @return { titolo, capitolo,
   *           concetti: [{ id, chiave, testo, alias, peso, def, micro, fonti, capitolo }],
   *           legami:   [{ da, a, rel:'', tipo, peso }] }
   */
  function estrai(cap, opt) {
    opt = opzioni(opt);
    if (!cap) return { titolo: '', capitolo: null, concetti: [], legami: [] };
    var idx = opt.indice == null ? null : +opt.indice;
    var fm = fontiFrontmatter(cap);

    var per = {};       // chiave → concetto in costruzione
    var ordine = [];    // le chiavi nell'ordine in cui il testo le nomina

    function tocca(grezzo, peso, come) {
      var chiave = normalizza(grezzo);
      if (!candidato(chiave, opt)) return '';
      var c = per[chiave];
      if (!c) {
        c = per[chiave] = { chiave: chiave, testo: taglia(testo(grezzo).replace(/[.,;:]+$/, ''), 60),
          alias: {}, peso: 0, def: '', micro: false, daTesto: false, fonti: [], viste: {} };
        ordine.push(chiave);
      }
      c.peso += peso;
      if (come === 'micro') c.micro = true;
      if (come !== 'glossario') c.daTesto = true;
      var forma = testo(grezzo).replace(/[.,;:]+$/, '');
      if (forma && forma !== c.testo) c.alias[forma] = true;
      return chiave;
    }

    function aggiungiFonte(c, r) {
      var k = chiaveFonte(r);
      if (c.viste[k]) return;
      c.viste[k] = true;
      c.fonti.push(r);
    }

    /* Il glossario per primo: una voce dà al concetto la definizione e la
       forma con cui l'autore lo scrive, e un grassetto che le coincide le
       eredita invece di fondare un secondo nodo che dice la stessa cosa.
       Misurate 395 coincidenze su 1.098 voci. */
    var vociGloss = opt.glossario === false ? [] : (cap.glossary || []).filter(function (g) { return g && g.t; });
    var defPerChiave = {};
    vociGloss.forEach(function (g) {
      var chiave = tocca(g.t, PESO_GLOSSARIO, 'glossario');
      if (!chiave) return;
      per[chiave].def = testo(g.d).slice(0, 400);
      per[chiave].testo = taglia(testo(g.t), 60);
      defPerChiave[chiave] = testo(g.d).toLowerCase();
    });

    /* Poi i paragrafi. Di ognuno resta l'insieme dei concetti nominati: è da
       lì che nascono i legami, e non serve tenersi il testo. */
    var insiemi = [];
    blocchi(cap.html || '').forEach(function (b) {
      var micro = normalizza(microTitolo(b));
      var dentro = {}, elenco = [];
      grassetti(b).forEach(function (g) {
        var chiave = normalizza(g);
        var k = tocca(g, chiave && chiave === micro ? PESO_MICRO : PESO_GRASSETTO,
          chiave && chiave === micro ? 'micro' : 'grassetto');
        if (!k || dentro[k]) return;
        dentro[k] = true; elenco.push(k);
      });
      if (!elenco.length) return;
      var qui = rimandi(b).map(function (r) { return arricchisci(r, fm); });
      elenco.forEach(function (k) { qui.forEach(function (r) { aggiungiFonte(per[k], r); }); });
      insiemi.push({ chiavi: elenco, micro: dentro[micro] ? micro : '' });
    });

    // le fonti del frontmatter che nominano il concetto: valgono anche dove il
    // testo non ha messo nessun link
    ordine.forEach(function (k) {
      pertinenti(k, fm).forEach(function (r) { aggiungiFonte(per[k], r); });
    });

    /* I LEGAMI. Tutti muti: qui si dice CHE due concetti stanno insieme, non
       che cosa lega l'uno all'altro — quello è il mestiere del modello (G3),
       e inventarlo con una regola sarebbe scrivere un verbo che nessuno ha
       misurato. */
    var legami = {}, ordineLeg = [];
    function lega(a, b, tipo) {
      if (!a || !b || a === b || !per[a] || !per[b]) return;
      // una coppia, un arco: la direzione la decide il tipo più forte visto
      var chiave = a < b ? a + '\t' + b : b + '\t' + a;
      var l = legami[chiave];
      if (!l) { l = legami[chiave] = { da: a, a: b, tipo: tipo, peso: 0 }; ordineLeg.push(chiave); }
      else if (RANGO_LEGAME[tipo] > RANGO_LEGAME[l.tipo]) { l.da = a; l.a = b; l.tipo = tipo; }
      l.peso++;
    }

    insiemi.forEach(function (s) {
      if (s.micro) s.chiavi.forEach(function (k) { lega(s.micro, k, 'microtitolo'); });
      for (var i = 0; i < s.chiavi.length; i++)
        for (var j = i + 1; j < s.chiavi.length; j++) lega(s.chiavi[i], s.chiavi[j], 'cooccorrenza');
    });

    /* Il glossario lega anche in un altro modo: se la definizione di A nomina
       B, allora per capire A bisogna avere B. Sul corpus sono 605 archi.

       ⚠️ Restano MUTI come gli altri, e questa è una scelta contro il §13.4,
       che concedeva di scriverci il verbo della famiglia `definizione`. Sono
       andato a guardare: fra le voci di glossario dello stesso capitolo il
       concetto nominato sta nella prima clausola — cioè è il genere prossimo,
       l'unico posto dove «si definisce» sarebbe vero — 18 volte su 88, e a
       leggerle nemmeno quelle reggono («Sillabe al secondo → velocità di
       lettura» viene da «unità di misura della velocità di lettura», dove il
       genere prossimo è *unità di misura*). Un verbo giusto una volta su
       cinque è peggio di nessun verbo, perché colora: lo mette G3, che il
       testo lo legge. */
    Object.keys(defPerChiave).forEach(function (a) {
      var d = defPerChiave[a];
      ordine.forEach(function (b) {
        if (b === a || b.length < 4) return;
        if (contiene(d, b)) lega(a, b, 'definizione');
      });
    });

    var concetti = ordine.map(function (k) {
      var c = per[k];
      return { id: idDi(k), chiave: k, testo: c.testo,
        alias: Object.keys(c.alias).sort(primaDi), peso: c.peso,
        def: c.def, micro: c.micro, daTesto: c.daTesto,
        fonti: c.fonti.slice(0, opt.max), capitolo: idx,
        /* L'id STABILE del capitolo (`01-fondamenti-c03`), accanto al numero.
           Il numero da solo è ambiguo appena si esce dalla lezione: su una mappa
           di corso «capitolo 3» sono sedici capitoli diversi, e il lettore
           aprirebbe il terzo della lezione che ha aperto adesso — in silenzio.
           È il guasto già documentato per `rimando`/`capitolo` in
           `mappaVaiAllaFonte`, e qui si evita alla radice: il nodo dice a quale
           capitolo appartiene, e `vaiAlCapitolo` sa già trovarlo. */
        capitoloId: cap.id ? String(cap.id) : null };
    });
    var elenco = ordineLeg.map(function (k) {
      var l = legami[k];
      return { da: idDi(l.da), a: idDi(l.a), rel: '', tipo: l.tipo, peso: l.peso };
    });
    return { titolo: testo(cap.title), capitolo: idx, concetti: concetti, legami: elenco };
  }

  /* =======================================================================
     L'ASSEMBLAGGIO — le stesse estrazioni, a due scale
     ======================================================================= */

  /**
   * Rimonta le estrazioni di più lezioni in un solo insieme di concetti,
   * fondendo le identità. È il punto in cui «tempo» e «tempi» diventano un
   * concetto solo: la fusione singolare/plurale non può stare in `estrai`
   * perché non è una funzione di una parola sola — richiede di sapere quali
   * altre forme esistono, e quale delle due è la più usata.
   *
   * @param lezioni  [{ id, titolo, chapters:[cap…] }] — capitoli GIÀ PARSATI
   * @return { concetti, legami } con `dove` (lezione → peso, primo capitolo)
   */
  function raccolta(lezioni, opt) {
    var per = {}, ordine = [];
    var legami = {}, ordineLeg = [];

    (lezioni || []).forEach(function (lz) {
      var lezId = String(lz && lz.id != null ? lz.id : (lz && (lz.titolo || lz.title)) || '');
      (((lz || {}).chapters) || []).forEach(function (cap, i) {
        var e = estrai(cap, { indice: i, glossario: opt.glossario, parole: opt.parole, max: opt.max });
        var chiavePerId = {};
        e.concetti.forEach(function (c) {
          chiavePerId[c.id] = c.chiave;
          var v = per[c.chiave];
          if (!v) {
            v = per[c.chiave] = { chiave: c.chiave, testo: c.testo, alias: {}, peso: 0,
              def: '', micro: false, daTesto: false, fonti: [], viste: {}, dove: {}, ordineDove: [] };
            ordine.push(c.chiave);
          }
          v.peso += c.peso;
          if (c.micro) v.micro = true;
          if (c.daTesto) v.daTesto = true;
          if (c.def && !v.def) { v.def = c.def; v.testo = c.testo; }
          c.alias.forEach(function (a) { v.alias[a] = true; });
          c.fonti.forEach(function (f) {
            var k = chiaveFonte(f);
            if (v.viste[k]) return;
            v.viste[k] = true; v.fonti.push(f);
          });
          var d = v.dove[lezId];
          if (!d) { d = v.dove[lezId] = { peso: 0, capitolo: c.capitolo, capitoloId: c.capitoloId, capitoli: {} }; v.ordineDove.push(lezId); }
          d.peso += c.peso;
          if (c.capitolo != null) {
            d.capitoli[c.capitolo] = true;
            /* Il capitolo in cui il concetto compare per primo, e il suo id
               stabile: viaggiano insieme, sempre. Aggiornarne uno solo darebbe
               un nodo che dice «capitolo 3» e porta al 5 — un puntatore che
               mente è peggio di un puntatore che manca. */
            if (d.capitolo == null || c.capitolo < d.capitolo) { d.capitolo = c.capitolo; d.capitoloId = c.capitoloId; }
          }
        });
        e.legami.forEach(function (l) {
          var a = chiavePerId[l.da], b = chiavePerId[l.a];
          if (!a || !b || a === b) return;
          var k = a < b ? a + '\t' + b : b + '\t' + a;
          var g = legami[k];
          if (!g) { g = legami[k] = { da: a, a: b, tipo: l.tipo, peso: 0 }; ordineLeg.push(k); }
          else if (RANGO_LEGAME[l.tipo] > RANGO_LEGAME[g.tipo]) { g.da = a; g.a = b; g.tipo = l.tipo; }
          g.peso += l.peso;
        });
      });
    });

    /* La fusione delle flessioni. Il rappresentante è la forma più diffusa —
       più lezioni, poi più peso, poi la prima in ordine — perché è quella che
       il lettore ha davvero incontrato; le altre restano come alias, così il
       nodo lo ritrova anche chi cerca il singolare. */
    var perTronco = {};
    ordine.forEach(function (k) { (perTronco[tronco(k)] = perTronco[tronco(k)] || []).push(k); });
    var fusa = {};
    Object.keys(perTronco).forEach(function (t) {
      var g = perTronco[t];
      if (g.length < 2) return;
      var rep = g.slice().sort(function (a, b) {
        return (per[b].ordineDove.length - per[a].ordineDove.length) || (per[b].peso - per[a].peso) || primaDi(a, b);
      })[0];
      g.forEach(function (k) {
        if (k === rep || !flessioniDellaStessaParola(k, rep)) return;
        var v = per[k], r = per[rep];
        r.peso += v.peso;
        r.micro = r.micro || v.micro;
        r.daTesto = r.daTesto || v.daTesto;
        if (!r.def && v.def) r.def = v.def;
        r.alias[v.testo] = true;
        Object.keys(v.alias).forEach(function (a) { r.alias[a] = true; });
        v.fonti.forEach(function (f) { var c = chiaveFonte(f); if (!r.viste[c]) { r.viste[c] = true; r.fonti.push(f); } });
        v.ordineDove.forEach(function (lz) {
          var d = r.dove[lz];
          if (!d) { d = r.dove[lz] = { peso: 0, capitolo: v.dove[lz].capitolo, capitoloId: v.dove[lz].capitoloId, capitoli: {} }; r.ordineDove.push(lz); }
          d.peso += v.dove[lz].peso;
          Object.keys(v.dove[lz].capitoli).forEach(function (c) { d.capitoli[c] = true; });
          if (d.capitolo == null || (v.dove[lz].capitolo != null && v.dove[lz].capitolo < d.capitolo)) {
            d.capitolo = v.dove[lz].capitolo; d.capitoloId = v.dove[lz].capitoloId;
          }
        });
        fusa[k] = rep;
      });
    });

    var vivi = ordine.filter(function (k) { return !fusa[k]; });
    var concetti = vivi.map(function (k) {
      var v = per[k];
      var capitoli = {};
      v.ordineDove.forEach(function (lz) { Object.keys(v.dove[lz].capitoli).forEach(function (c) { capitoli[lz + '|' + c] = true; }); });
      return { chiave: k, id: idDi(k), testo: v.testo, alias: Object.keys(v.alias).sort(primaDi),
        peso: v.peso, def: v.def, micro: v.micro, daTesto: v.daTesto, fonti: v.fonti.slice(0, opt.max),
        dove: v.dove, lezioni: v.ordineDove.slice(), capitoli: Object.keys(capitoli).length };
    });

    var finali = {}, ordineFin = [];
    ordineLeg.forEach(function (k) {
      var l = legami[k];
      var a = fusa[l.da] || l.da, b = fusa[l.a] || l.a;
      if (a === b || !per[a] || !per[b] || fusa[a] || fusa[b]) return;
      var kk = a < b ? a + '\t' + b : b + '\t' + a;
      var g = finali[kk];
      if (!g) { g = finali[kk] = { da: a, a: b, tipo: l.tipo, peso: 0 }; ordineFin.push(kk); }
      else if (RANGO_LEGAME[l.tipo] > RANGO_LEGAME[g.tipo]) { g.da = a; g.a = b; g.tipo = l.tipo; }
      g.peso += l.peso;
    });
    return { concetti: concetti, legami: ordineFin.map(function (k) { return finali[k]; }) };
  }

  /** Il costruttore di grafo condiviso dalle due scale: tiene il conto dei
   *  figli per ramo (è `opt.max`) e non lascia nascere due volte lo stesso id. */
  function tela(opt) {
    var nodi = [], archi = [], visti = {}, figli = {};
    return {
      nodi: nodi, archi: archi,
      nodo: function (id, campi) {
        if (visti[id]) return id;
        var o = { id: id, origine: 'generata' };
        Object.keys(campi || {}).forEach(function (k) { if (campi[k] != null) o[k] = campi[k]; });
        visti[id] = true; nodi.push(o);
        return id;
      },
      /* Il tetto si conta per RAMO e per RUOLO. Sullo stesso nodo-lezione
         convivono la spina (i concetti che attraversano il corso) e il
         sottobosco (quelli che vivono solo lì): con un budget unico la spina
         se lo mangerebbe tutto e il sottobosco non comparirebbe mai — cioè la
         leva `annidate` non avrebbe niente da aprire. */
      pieno: function (padre, ruolo) {
        var k = padre + '|' + ruolo;
        return (figli[k] || 0) >= opt.max;
      },
      arco: function (da, a, rel, ruolo, cross) {
        if (!da || !a || da === a) return false;
        var k = da + '|' + ruolo;
        figli[k] = (figli[k] || 0) + 1;
        var e = { da: da, a: a, rel: rel || '' };
        if (cross) e.cross = true;
        archi.push(e);
        return true;
      }
    };
  }

  /** I campi che un concetto porta su un nodo. `fonti` è un elenco di COPIE:
   *  il grafo non deve restare legato agli oggetti dell'estrazione. */
  function nodoConcetto(c, dove, opt) {
    var capitolo = dove ? dove.capitolo : null;
    /* `termine` invece di `concetto` quando il nodo nasce SOLO dal glossario:
       è una parola che l'autore ha definito ma che nessun paragrafo mette in
       rilievo. Sono cose diverse e la mappa deve poterle distinguere — 703
       voci su 1.098 non compaiono in grassetto nel capitolo che le definisce. */
    var o = { testo: c.testo, genere: c.daTesto ? 'concetto' : 'termine' };
    if (capitolo != null) o.capitolo = capitolo;
    /* L'id stabile del capitolo, che è ciò che rende cliccabile un concetto su
       una mappa di CORSO: il numero da solo vale dentro una lezione sola. */
    if (dove && dove.capitoloId) o.capitoloId = dove.capitoloId;
    if (c.def) o.nota = c.def;
    if (opt.fonti !== 'no' && c.fonti.length) {
      o.fonti = c.fonti.map(function (f) { return copiaFonte(f); });
      o.rimando = copiaFonte(c.fonti[0]);
    }
    return o;
  }

  /** Le fonti come nodi a sé (`opt.fonti === 'nodo'`): una fonte citata da due
   *  concetti resta UN nodo con due archi — è lo stesso minuto dello stesso
   *  video, e sdoppiarlo direbbe che sono due cose. */
  function appendiFonti(t, idConcetto, c, opt) {
    if (opt.fonti !== 'nodo') return;
    c.fonti.forEach(function (f) {
      if (t.pieno(idConcetto, 'fonte')) return;
      var id = 'f' + impronta(chiaveFonte(f));
      t.nodo(id, { testo: taglia(f.label || f.file, 60), genere: 'fonte', rimando: copiaFonte(f) });
      t.arco(idConcetto, id, '', 'fonte');
    });
  }

  function perPeso(a, b) { return (b.peso - a.peso) || primaDi(a.chiave, b.chiave); }

  /**
   * Mappa di UNA lezione, fatta di concetti.
   *   radice = la lezione
   *   spina  = i concetti che tornano in almeno `soglia` capitoli
   *   sotto  = gli altri, appesi al concetto della spina con cui compaiono
   *
   * Ogni concetto porta il PRIMO capitolo in cui compare, così il click ci
   * naviga, e le sue fonti. Gli archi fra concetti vengono dai legami; quando
   * i due capi abitano capitoli diversi l'arco è `cross:true` — un cross-link
   * non si chiede al modello, si conta (§13.3).
   */
  function daLezione(lezione, opt) {
    opt = opzioni(opt);
    if (!lezione || !Array.isArray(lezione.chapters)) return { nodi: [], archi: [], titolo: '' };
    var titolo = testo(lezione.titolo || lezione.title || '');
    var lezId = String(lezione.id != null ? lezione.id : titolo);
    var r = raccolta([{ id: lezId, titolo: titolo, chapters: lezione.chapters }], opt);
    var t = tela(opt);
    var radice = t.nodo('r', { testo: titolo, genere: 'radice' });

    var quale = {};
    r.concetti.forEach(function (c) { quale[c.chiave] = c; });
    /* Due funzioni e non una, e la differenza è già costata un guasto: `doveDi`
       dà il POSTO (l'oggetto con capitolo, id e conteggi), `capitoloDi` dà il
       NUMERO. Farne una sola che restituisce l'oggetto rende `capitoloDi(A) !==
       capitoloDi(B)` sempre vero — due oggetti diversi lo sono per definizione —
       e ogni legame in più diventerebbe un cross-link tratteggiato. */
    function doveDi(c) { return c.dove[lezId] || null; }
    function capitoloDi(c) { var d = doveDi(c); return d ? d.capitolo : null; }

    var spina = r.concetti.filter(function (c) { return c.capitoli >= opt.soglia; }).sort(perPeso);
    var locali = r.concetti.filter(function (c) { return c.capitoli < opt.soglia; }).sort(perPeso);

    var inMappa = {};
    spina.forEach(function (c) {
      if (t.pieno(radice, 'spina')) return;
      t.nodo(c.id, nodoConcetto(c, doveDi(c), opt));
      t.arco(radice, c.id, '', 'spina');
      inMappa[c.chiave] = true;
    });

    /* Il sottobosco si appende al concetto della spina con cui il testo lo
       nomina più spesso: è l'unica collocazione che il corpus autorizza senza
       inventare una gerarchia che nessuno ha scritto. Se non ne ha uno, sta
       sotto la radice. */
    if (opt.annidate) {
      var forza = {};
      r.legami.forEach(function (l) {
        [[l.da, l.a], [l.a, l.da]].forEach(function (p) {
          if (!inMappa[p[1]] || inMappa[p[0]]) return;
          var f = forza[p[0]];
          if (!f || l.peso > f.peso) forza[p[0]] = { padre: p[1], peso: l.peso };
        });
      });
      locali.forEach(function (c) {
        var f = forza[c.chiave];
        var padre = f ? quale[f.padre].id : radice;
        var ruolo = f ? 'sotto' : 'orfani';
        if (t.pieno(padre, ruolo)) return;
        t.nodo(c.id, nodoConcetto(c, doveDi(c), opt));
        t.arco(padre, c.id, '', ruolo);
        inMappa[c.chiave] = true;
      });
    }

    /* Gli archi in più fra concetti già in mappa. Restano fuori le
       co-occorrenze viste una volta sola: due parole nello stesso paragrafo
       una volta sono un caso, due volte sono un'abitudine del testo — e su
       una lezione intera le coppie viste una volta sono la maggioranza. */
    var portanti = {};
    t.archi.forEach(function (a) { portanti[a.da + '|' + a.a] = true; portanti[a.a + '|' + a.da] = true; });
    r.legami.forEach(function (l) {
      if (!inMappa[l.da] || !inMappa[l.a]) return;
      var A = quale[l.da], B = quale[l.a];
      if (portanti[A.id + '|' + B.id]) return;
      if (l.tipo === 'cooccorrenza' && l.peso < 2) return;
      portanti[A.id + '|' + B.id] = true; portanti[B.id + '|' + A.id] = true;
      var e = { da: A.id, a: B.id, rel: '' };
      if (capitoloDi(A) !== capitoloDi(B)) e.cross = true;
      t.archi.push(e);
    });

    r.concetti.forEach(function (c) { if (inMappa[c.chiave]) appendiFonti(t, c.id, c, opt); });
    return { nodi: t.nodi, archi: t.archi, titolo: titolo };
  }

  /**
   * Mappa di UN CORSO: la scala principale della vista generata.
   *   radice   = il corso · un nodo per lezione («si articola in»)
   *   spina    = i concetti-ponte, presenti in almeno `soglia` LEZIONI:
   *              agganciati alla lezione in cui pesano di più, e `cross:true`
   *              verso le altre in cui compaiono
   *   sotto    = i concetti locali di ogni lezione, annidati sotto di lei
   *
   * Non è «tutti i concetti»: sul corpus TD74 sarebbero 2.405 nodi, cioè
   * niente. È la spina dei ponti, e la soglia è una leva del ⚙ (§13.3).
   *
   * @param corso { titolo, lezioni: [ {id, titolo, chapters:[cap…]} ] }
   */
  function daCorso(corso, opt) {
    opt = opzioni(opt);
    if (!corso || !Array.isArray(corso.lezioni)) return { nodi: [], archi: [], titolo: '' };
    var titolo = testo(corso.titolo || corso.title || '');
    var lezioni = corso.lezioni.map(function (lz, i) {
      return { id: String(lz && lz.id != null ? lz.id : 'lezione-' + i),
        titolo: testo((lz && (lz.titolo || lz.title)) || ''), chapters: (lz && lz.chapters) || [] };
    });
    var r = raccolta(lezioni, opt);
    var t = tela(opt);
    var radice = t.nodo('r', { testo: titolo, genere: 'radice' });

    var idLez = {}, rango = {};
    lezioni.forEach(function (lz, i) {
      var id = 'l' + impronta(lz.id);
      idLez[lz.id] = id; rango[lz.id] = i;
      t.nodo(id, { testo: taglia(lz.titolo || lz.id, 80), genere: 'lezione' });
      /* L'unico verbo scritto a mano di tutto il modulo, e l'unico vero per
         costruzione: un corso si articola nelle sue lezioni.
         ⚠️ Qui `max` non si guarda apposta: nascondere la diciassettesima
         lezione perché il tetto è dodici direbbe che il corso ne ha dodici. Il
         tetto serve a non seppellire i rami, non a mentire sull'indice. */
      t.arco(radice, id, 'si articola in', 'lezioni');
    });

    var ponti = r.concetti.filter(function (c) { return c.lezioni.length >= opt.soglia; }).sort(perPeso);
    var locali = r.concetti.filter(function (c) { return c.lezioni.length < opt.soglia; }).sort(perPeso);

    /** La lezione in cui il concetto pesa di più; a pari peso, la prima del
     *  corso — perché un ponte lo si incontra la prima volta là. */
    function casa(c) {
      return c.lezioni.slice().sort(function (a, b) {
        return (c.dove[b].peso - c.dove[a].peso) || (rango[a] - rango[b]);
      })[0];
    }

    ponti.forEach(function (c) {
      var mia = casa(c);
      var padre = idLez[mia];
      if (!padre || t.pieno(padre, 'spina')) return;
      t.nodo(c.id, nodoConcetto(c, c.dove[mia], opt));
      t.arco(padre, c.id, '', 'spina');
      // il ponte: si CONTA, non si chiede — lo stesso concetto compare anche là
      c.lezioni.forEach(function (lz) {
        if (lz === mia || !idLez[lz]) return;
        t.arco(idLez[lz], c.id, '', 'cross', true);
      });
      appendiFonti(t, c.id, c, opt);
    });

    /* Il sottobosco. Sta sotto la lezione in cui pesa di più, come i ponti, e
       NON prende cross-link nemmeno quando tocca due lezioni: la soglia è
       esattamente la riga sotto la quale un attraversamento non si mostra —
       se lo si mostrasse lo stesso, alzarla non cambierebbe niente. */
    if (opt.annidate) locali.forEach(function (c) {
      var mia = casa(c);
      var padre = idLez[mia];
      if (!padre || t.pieno(padre, 'sotto')) return;
      t.nodo(c.id, nodoConcetto(c, c.dove[mia], opt));
      t.arco(padre, c.id, '', 'sotto');
      appendiFonti(t, c.id, c, opt);
    });

    return { nodi: t.nodi, archi: t.archi, titolo: titolo };
  }

  return { testo: testo, rimandi: rimandi, sezioni: sezioni, taglia: taglia,
           normalizza: normalizza, idDi: idDi, estrai: estrai,
           daCapitolo: daCapitolo, daLezione: daLezione, daCorso: daCorso };
}));
