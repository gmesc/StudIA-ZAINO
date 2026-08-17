/* ============================================================================
   ricerca/indice.js — che cosa entra nell'indice, e come si ordina ciò che trova
   ============================================================================
   Duecento-trecento capitoli tenuti in memoria, nessuna dipendenza esterna: si
   cerca nel testo dei capitoli del corso attivo — o nelle pagine dei documenti,
   se si è nello zaino — e si ordina per pertinenza.

   ⚠️ PERCHÉ QUESTO PEZZO MERITAVA DI USCIRE PIÙ DEGLI ALTRI. La ricerca è la
   cosa che si rompe più in silenzio di tutta l'app: se l'indice smette di
   indicizzare un campo, nessun errore compare da nessuna parte — semplicemente
   quella cosa non si trova più, e chi cerca conclude che non c'è. Finché stava
   dentro il renderer non aveva UNA prova: si poteva verificarla solo aprendo
   l'app e cercando qualcosa di cui si sapeva già la risposta.

   Che cosa NON sta qui: prendere i capitoli dall'app, disegnare l'elenco dei
   risultati, saltare al punto trovato. Quello è pagina, e resta nel renderer.
   Qui entrano dati e ne escono altri.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RicercaIndice = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Normalizzazione che PRESERVA LA LUNGHEZZA: accenti e virgolette diventano
     la loro forma piana, ma nessun carattere sparisce. È la condizione che
     permette di usare le posizioni trovate nel testo normalizzato per ritagliare
     il frammento dal testo ORIGINALE — togliere anche un solo carattere
     sfaserebbe il ritaglio di uno, e il frammento comincerebbe a mezza parola. */
  function sNorm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c').replace(/[ñ]/g, 'n')
      .replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  }

  /**
   * Che cosa ha chiesto chi scrive nel campo: il testo, e se l'ha messo fra
   * VIRGOLETTE.
   *
   * Le virgolette vogliono dire «la parola così com'è, non un pezzo di
   * un'altra»: cercando `per` si trovano anche *perché* e *periodo*, e chi
   * cercava la preposizione scorre venti risultati che non gli servono. Con
   * `"per"` la ricerca pretende i confini di parola.
   *
   * ⚠️ La regola sta QUI e non nel renderer perché deve valere per tutte e due
   * le ricerche — quella dentro il documento e la lente — e due letture della
   * stessa convenzione divergono al primo caso strano. Questa funzione non
   * cerca niente: dice soltanto che cosa è stato chiesto.
   *
   * ⚠️ Si accettano anche le virgolette CURVE e le caporali: su una tastiera
   * italiana con la correzione automatica «"» diventa «“” » senza che chi
   * scrive lo voglia, e una regola che le rifiuta sembra rotta a chi la usa.
   *
   * ⚠️ Una virgoletta SPAIATA non è una richiesta di parola intera: `"per` è
   * uno che ha cominciato a scrivere, e trattarlo come esatto gli cambierebbe i
   * risultati sotto le mani a metà digitazione. Il testo resta com'è, virgoletta
   * compresa — è quello che ha scritto.
   */
  function interpreta(q) {
    var s = String(q == null ? '' : q).trim();
    var m = /^(["'“«])([\s\S]*)(["'”»])$/.exec(s);
    if (!m) return { testo: s, esatta: false };
    /* Le coppie che si chiudono davvero. Un apostrofo iniziale e una virgoletta
       finale non sono una coppia: sarebbero due segni diversi per caso. */
    var coppie = { '"': '"', "'": "'", '“': '”', '«': '»' };
    if (coppie[m[1]] !== m[3]) return { testo: s, esatta: false };
    var dentro = m[2].trim();
    /* Virgolette vuote non sono una ricerca esatta di niente: sono due segni. */
    if (!dentro) return { testo: s, esatta: false };
    return { testo: dentro, esatta: true };
  }

  /* Che cosa è «dentro una parola», nel testo NORMALIZZATO: `sNorm` ha già
     appiattito gli accenti su a-z, quindi qui bastano lettere e cifre. Tutto il
     resto — spazi, punteggiatura, e l'APOSTROFO — è un confine: cercando
     `"acqua"` si deve trovare anche in «dell'acqua», che in italiano è la forma
     più comune in cui una parola compare attaccata a un'altra. */
  var PAROLA = /[a-z0-9]/;
  function confine(s, a, b) {
    return (a === 0 || !PAROLA.test(s.charAt(a - 1))) &&
           (b >= s.length || !PAROLA.test(s.charAt(b)));
  }

  /**
   * Quante volte un termine compare in un testo, e dove comincia la prima volta.
   *
   * `intera` è la richiesta fra virgolette: si contano soltanto le occorrenze
   * che stanno fra due confini di parola. Senza, `per` conta anche i pezzi
   * dentro *perché* e *periodo* — che è il comportamento giusto quando nessuno
   * ha chiesto altro, e quello sbagliato quando l'utente ha messo le virgolette.
   *
   * ⚠️ Torna anche la POSIZIONE, e deve essere quella della prima occorrenza
   * VALIDA: è da lì che si ritaglia il frammento, e ritagliare attorno a un
   * pezzo di un'altra parola mostrerebbe una riga che non è una risposta.
   */
  function occorrenze(ntesto, termine, intera) {
    var s = String(ntesto == null ? '' : ntesto);
    if (!termine) return { n: 0, pos: -1 };
    if (!intera) {
      var at = s.indexOf(termine);
      return { n: at < 0 ? 0 : s.split(termine).length - 1, pos: at };
    }
    var n = 0, pos = -1, i = 0;
    for (;;) {
      var k = s.indexOf(termine, i);
      if (k < 0) break;
      if (confine(s, k, k + termine.length)) { n++; if (pos < 0) pos = k; }
      i = k + 1;
    }
    return { n: n, pos: pos };
  }

  /**
   * Una voce dell'indice a partire da un CAPITOLO.
   *
   * ⚠️ Nel testo cercabile entrano titolo, sommario, corpo, punti chiave e
   * glossario: sono i cinque posti in cui l'utente si aspetta di trovare una
   * parola che ha letto. Toglierne uno non rompe niente e non si vede — è il
   * guasto silenzioso di cui parla la testata, e il motivo per cui la prova in
   * Node li elenca uno per uno.
   *
   * `stripHtml` la passa chi chiama: il corpo di un capitolo è HTML, e qui non
   * c'è un DOM con cui srotolarlo. Chi non la passa cerca dentro i tag, che è
   * peggio che non cercare.
   */
  function docCapitolo(ch, dove, stripHtml) {
    var via = typeof stripHtml === 'function' ? stripHtml : function (x) { return String(x == null ? '' : x); };
    var c = ch || {}, d = dove || {};
    var text = [c.title, via(c.brief || ''), via(c.html || ''),
      (c.keypoints || []).map(via).join(' '),
      (c.glossary || []).map(function (g) { return g.t + ' ' + via(g.d || ''); }).join(' ')].join('  ');
    return {
      lessonId: d.lessonId, lessonTitle: d.lessonTitle, idx: d.idx, title: c.title,
      text: text, ntext: sNorm(text), ntitle: sNorm(c.title)
    };
  }

  /**
   * Una voce dell'indice a partire da un APPUNTO.
   *
   * ⚠️ Gli appunti sono l'unica cosa dell'indice che l'utente ha SCRITTO, ed
   * erano l'unica che non si poteva cercare: la lente guardava i capitoli (nei
   * corsi) o le pagine dei documenti (negli zaini), mai il quaderno. Chi cercava
   * una frase che sapeva di aver scritto non la trovava, e non c'era modo di
   * capire che era la lente a non guardare lì.
   *
   * Nel testo cercabile entrano il titolo e il corpo — che è già markdown, cioè
   * testo: nessuno `stripHtml` da passare, al contrario del capitolo.
   *
   * `idx` è la posizione nell'elenco: serve solo a dare un ordine stabile fra
   * appunti dello stesso punteggio, come l'indice del capitolo nella lezione.
   */
  function docAppunto(nota, gruppo, idx) {
    var n = nota || {};
    var titolo = n.title || String(n.file || '').replace(/\.md$/i, '');
    var text = [titolo, n.body || ''].join('  ');
    return {
      appunto: n.file, lessonTitle: gruppo || 'Appunti', idx: idx || 0, title: titolo,
      text: text, ntext: sNorm(text), ntitle: sNorm(titolo)
    };
  }

  /** Una voce dell'indice a partire da una PAGINA di documento (lo zaino: là non
   *  ci sono capitoli, e l'unità che si può aprire è la pagina). */
  function docPagina(pdf, titolo, pagina) {
    var p = pagina || {};
    return {
      materiale: pdf, pagina: p.page, lessonTitle: titolo,
      title: 'p. ' + p.page, idx: p.page, text: p.text,
      ntext: sNorm(p.text), ntitle: sNorm(titolo)
    };
  }

  /**
   * Cerca `q` fra le voci e le ordina.
   *
   * Tutti i termini devono esserci (AND): una ricerca di due parole che
   * restituisse i documenti con una sola delle due riempirebbe l'elenco di
   * risposte che non sono risposte.
   *
   * Il punteggio è il numero di occorrenze, più **30 se il termine sta nel
   * titolo**. Trenta e non tre: un capitolo che si intitola «La memoria di
   * lavoro» è la risposta a «memoria di lavoro» anche se un altro la nomina
   * dieci volte di sfuggita, e senza quel peso finiva sotto.
   *
   * I risultati escono RAGGRUPPATI PER FONTE: ogni documento (o lezione) compare
   * una volta sola, i gruppi in ordine del loro risultato migliore, e dentro un
   * gruppo prima la pertinenza e poi l'ordine di lettura — che è l'unico che chi
   * studia riconosce.
   *
   * ⚠️ GLI APPUNTI VENGONO PRIMA DI TUTTO IL RESTO, anche col punteggio più
   * basso: ciò che l'utente ha SCRITTO precede ciò che ha letto. Non è una
   * preferenza di gusto, è ciò che tiene insieme l'elenco — l'intestazione la
   * scrive il renderer quando `lessonTitle` cambia, quindi un appunto piazzato a
   * metà classifica spezza in due il documento che lo circonda e la stessa fonte
   * compare sotto due intestazioni uguali, come se fossero due cose diverse.
   * Ordinandoli in blocco davanti, «Appunti» è una sezione sola e in cima, e ogni
   * documento resta intero.
   *
   * ⚠️ E si ordina PRIMA di tagliare a `max`: un appunto quarantunesimo per
   * punteggio, senza questo, non entrerebbe nell'elenco — «sempre prima» diventa
   * «prima, se ci arriva».
   *
   * ⚠️ FRA VIRGOLETTE la richiesta è UNA SOLA e va presa alla lettera: la frase
   * in quell'ordine, e con i confini di parola ai suoi due capi. Senza
   * virgolette ogni parola è un termine a sé e servono tutti, in qualunque punto
   * del documento — che è la ricerca larga, quella che serve quando si ricorda
   * un argomento e non una frase. Le virgolette vogliono dire la stessa cosa che
   * vogliono dire nella ricerca dentro il documento: «così com'è, non un pezzo
   * di un'altra parola». Una convenzione con due significati non è una
   * convenzione.
   */
  function cerca(docs, q, opt) {
    var max = (opt && opt.max) || 40;
    var chiesto = interpreta(q);
    var esatta = chiesto.esatta;
    var toks = esatta ? [sNorm(chiesto.testo)]
                      : sNorm(chiesto.testo).split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    var out = [];
    (docs || []).forEach(function (d) {
      var score = 0, pos = -1, ok = true, hits = [];
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i], o = occorrenze(d.ntext, t, esatta);
        if (!o.n) { ok = false; break; }
        score += o.n; if (occorrenze(d.ntitle, t, esatta).n) score += 30;
        hits.push(t); if (pos < 0 || o.pos < pos) pos = o.pos;
      }
      /* `esatta` viaggia col risultato perché serve anche a `frammento`:
         accendere nel frammento un pezzo che non ha fatto match sarebbe
         mostrare come risposta qualcosa che la ricerca ha scartato. */
      if (ok) out.push({ d: d, score: score, pos: pos, toks: hits, esatta: esatta });
    });
    /* ⚠️ I RISULTATI SI RAGGRUPPANO PER FONTE, e ogni fonte compare UNA VOLTA
       SOLA. Ordinando per punteggio puro le pagine di due documenti si
       alternavano, e siccome l'intestazione la scrive il renderer a ogni cambio
       di gruppo, lo stesso documento si presentava tre volte in dodici righe:
       chi legge non sa se sta guardando una fonte nuova o quella di prima.
       Dove va un gruppo lo decide il suo risultato MIGLIORE — non la somma, che
       premierebbe il documento lungo, e non la media, che punirebbe quello che
       risponde benissimo in un punto solo. Dentro il gruppo comanda la
       pertinenza, poi l'ordine di lettura: è la stessa scala di prima, applicata
       un piano più sotto. */
    var meglio = {};
    out.forEach(function (r) {
      var k = String(r.d.lessonTitle || '');
      if (!(k in meglio) || r.score > meglio[k]) meglio[k] = r.score;
    });
    out.sort(function (a, b) {
      var ka = String(a.d.lessonTitle || ''), kb = String(b.d.lessonTitle || '');
      return ((b.d.appunto ? 1 : 0) - (a.d.appunto ? 1 : 0)) ||
        (meglio[kb] - meglio[ka]) ||
        ka.localeCompare(kb) ||
        (b.score - a.score) ||
        (a.d.idx - b.d.idx);
    });
    return out.slice(0, max);
  }

  /**
   * Il frammento di testo attorno alla prima occorrenza, coi termini accesi.
   *
   * ⚠️ L'accensione lavora sugli INDICI della stringa normalizzata, non su una
   * sostituzione nel testo: `replace` avrebbe dovuto cercare la forma accentata
   * originale, che non è quella che si è cercata. E si salta ciò che sta già
   * dentro un `<mark>`, o due termini sovrapposti («memo» e «memoria»)
   * produrrebbero marcatori annidati e HTML rotto.
   *
   * `esc` la passa chi chiama: qui si compone HTML, e l'escape è l'unica cosa
   * che separa un frammento da un'iniezione. Chi non la passa ottiene comunque
   * un escape di ripiego — mancarlo in silenzio sarebbe peggio.
   *
   * ⚠️ Se la ricerca era ESATTA (fra virgolette) si accendono soltanto le
   * occorrenze fra confini di parola, come ha fatto `cerca`. Accendere anche i
   * pezzi dentro un'altra parola mostrerebbe come risposta proprio ciò che la
   * ricerca ha scartato — e chi legge concluderebbe che le virgolette non
   * funzionano.
   */
  function frammento(r, esc) {
    var escape = typeof esc === 'function' ? esc : function (x) {
      return String(x == null ? '' : x).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
      });
    };
    var t = r.d.text, start = Math.max(0, r.pos - 45), end = Math.min(t.length, r.pos + 115);
    var s = (start > 0 ? '… ' : '') + t.slice(start, end).replace(/\s+/g, ' ') + (end < t.length ? ' …' : '');
    var h = escape(s);
    r.toks.slice().sort(function (a, b) { return b.length - a.length; }).forEach(function (tok) {
      var acc = '', i = 0, hn = sNorm(h);
      while (true) {
        var at = hn.indexOf(tok, i);
        if (at < 0) { acc += h.slice(i); break; }
        /* Ricerca esatta: un'occorrenza dentro un'altra parola non ha fatto
           match, quindi non si accende — si scavalca come si scavalca ciò che
           sta già dentro un `<mark>`. */
        if (r.esatta && !confine(hn, at, at + tok.length)) {
          acc += h.slice(i, at + tok.length); i = at + tok.length; continue;
        }
        if (h.slice(0, at).lastIndexOf('<mark>') > h.slice(0, at).lastIndexOf('</mark>')) {
          acc += h.slice(i, at + tok.length); i = at + tok.length; continue;
        }
        acc += h.slice(i, at) + '<mark>' + h.slice(at, at + tok.length) + '</mark>'; i = at + tok.length;
      }
      h = acc;
    });
    return h;
  }

  return { sNorm: sNorm, interpreta: interpreta,
    docCapitolo: docCapitolo, docPagina: docPagina, docAppunto: docAppunto,
    cerca: cerca, frammento: frammento };
}));
