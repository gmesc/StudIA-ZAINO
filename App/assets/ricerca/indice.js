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
   * A parità si ordina per lezione e poi per posizione nella lezione: l'ordine
   * di lettura, che è l'unico che chi studia riconosce.
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
   */
  function cerca(docs, q, opt) {
    var max = (opt && opt.max) || 40;
    var toks = sNorm(q).split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    var out = [];
    (docs || []).forEach(function (d) {
      var score = 0, pos = -1, ok = true, hits = [];
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i], at = d.ntext.indexOf(t);
        if (at < 0) { ok = false; break; }
        var n = d.ntext.split(t).length - 1;
        score += n; if (d.ntitle.indexOf(t) >= 0) score += 30;
        hits.push(t); if (pos < 0 || at < pos) pos = at;
      }
      if (ok) out.push({ d: d, score: score, pos: pos, toks: hits });
    });
    out.sort(function (a, b) {
      return ((b.d.appunto ? 1 : 0) - (a.d.appunto ? 1 : 0)) ||
        (b.score - a.score) ||
        String(a.d.lessonTitle || '').localeCompare(String(b.d.lessonTitle || '')) ||
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
        if (h.slice(0, at).lastIndexOf('<mark>') > h.slice(0, at).lastIndexOf('</mark>')) {
          acc += h.slice(i, at + tok.length); i = at + tok.length; continue;
        }
        acc += h.slice(i, at) + '<mark>' + h.slice(at, at + tok.length) + '</mark>'; i = at + tok.length;
      }
      h = acc;
    });
    return h;
  }

  return { sNorm: sNorm, docCapitolo: docCapitolo, docPagina: docPagina, docAppunto: docAppunto,
    cerca: cerca, frammento: frammento };
}));
