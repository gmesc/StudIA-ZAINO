'use strict';
/**
 * composer — la pagina dove si compongono i percorsi.
 *
 * Righe = le lezioni del piano. Su ogni riga, le card degli indici che il modello
 * ha proposto per quella lezione (numero variabile: lo zig-zag è previsto e non è
 * un difetto). Gli otto personaggi si trascinano sulle card: un personaggio
 * segue UN indice per lezione, e trascinarlo altrove lo sposta invece di
 * duplicarlo. In fondo, i percorsi composti con i capitoli in ordine numerico.
 *
 * Il punto della pagina non è scegliere un indice — quello lo fa già il wizard,
 * una lezione per volta. Il punto è vedere TUTTE le proposte insieme e capire come
 * si delinea il corso prima di spendere per scrivere i capitoli.
 *
 * Due card con lo stesso indice scelto da più personaggi sono capitoli scritti
 * una volta sola e condivisi: il riepilogo in alto lo conta, perché è l'unica
 * ragione per cui otto varianti non costano otto volte.
 */
(function () {
  var C = {
    corso: null, lezioni: [], scalette: {}, percorsi: [], personaggi: [],
    ass: {},            // "folder:indice" → [id personaggio]
    nomi: {},           // id personaggio → nome dato alla variante
    nCap: null,         // capitoli per lezione chiesti al modello (null = lo decide lui)
    nAlt: 3,            // quante alternative d'indice chiedere per lezione
    nPerLezione: {},      // scostamenti riga per riga
    tuttiIndici: false, // l'interruttore in topbar: elenchi dei capitoli aperti o chiusi
    indiciAperti: {},   // le card aperte a mano, che vincono sull'interruttore
    stato: 'fermo', prog: null, errore: null, sporco: false,
    // la scrittura dei capitoli: le coppie vengono dai percorsi SALVATI, non dal tavolo
    coppie: [], stima: null, scr: { stato: 'fermo', prog: null, log: [], errore: null }
  };
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var toast = function (m, ok) { if (typeof window.toast === 'function') window.toast(m, ok); };
  var PG = {};          // id → personaggio

  function tinta(col, pct) { return 'color-mix(in srgb,' + col + ' ' + pct + '%,var(--panel))'; }
  function chiave(folder, i) { return folder + ':' + i; }
  function lezioneDi(folder) { return C.lezioni.filter(function (c) { return c.folder === folder; })[0] || null; }
  function alternativeDi(folder) { return (C.scalette[folder] && C.scalette[folder].alternative) || []; }

  // ------------------------------------------------------------------ apertura

  function apri(corso, opts) {
    C.corso = corso || null;
    // aperto dal wizard: chiudendo si torna al passo da cui si è usciti, non nel vuoto
    C.tornaAlWizard = (opts && typeof opts.tornaAlWizard === 'number') ? opts.tornaAlWizard : null;
    if (!C.corso) { toast('Scegli prima un corso', false); return; }
    if (!(window.vault && window.vault.composer)) { toast('Il composer è disponibile solo nell\'app', false); return; }
    C.errore = null; C.prog = null; C.stato = 'fermo'; C.sporco = false;
    C.coppie = []; C.stima = null; C.indiciAperti = {};
    /* Riaprendo si riparte da fermo, ma una scrittura DAVVERO in corso non si
       azzera: il processo principale continua a scrivere anche a composer
       chiuso, e perdere lo stato qui vorrebbe dire ignorare il suo «finito». */
    if (C.scr.stato !== 'in-corso') C.scr = { stato: 'fermo', prog: null, log: [], errore: null };
    try {
      var pr = (window.vault.prefs && window.vault.prefs.read()) || {};
      C.nCap = Number(pr.capitoliPerLezione) || null;
      C.nAlt = Number(pr.nAlternative) || 3;
    } catch (e) { C.nCap = null; C.nAlt = 3; }
    $('#composer').hidden = false;
    document.body.style.overflow = 'hidden';
    pitta();
    window.vault.composer.stato(C.corso).then(function (s) {
      if (!s || s.error) { C.errore = (s && s.error) || 'stato non leggibile'; pitta(); return; }
      C.lezioni = s.lezioni || []; C.scalette = s.scalette || {}; C.percorsi = s.percorsi || [];
      C.personaggi = s.personaggi || [];
      PG = {}; C.personaggi.forEach(function (p) { PG[p.id] = p; });
      // dai percorsi salvati si ricostruisce lo stato del tavolo
      C.ass = {}; C.nomi = {};
      C.percorsi.forEach(function (p) {
        if (p.nome) C.nomi[p.id] = p.nome;
        Object.keys(p.scelte || {}).forEach(function (folder) {
          var k = chiave(folder, p.scelte[folder].indice);
          (C.ass[k] = C.ass[k] || []).push(p.id);
        });
      });
      // il numero di capitoli con cui erano state chieste le scalette: si rivede com'era
      Object.keys(C.scalette).forEach(function (f) {
        if (C.scalette[f] && C.scalette[f].nCapitoli) C.nPerLezione[f] = C.scalette[f].nCapitoli;
      });
      pitta();
      caricaCoppie();
    });
  }

  /** Le coppie lezione+indice da scrivere: quante sono, quanto è già scritto, quanto costa il resto. */
  function caricaCoppie() {
    if (!(window.vault.percorsi && window.vault.percorsi.coppie)) return;
    window.vault.percorsi.coppie(C.corso).then(function (r) {
      if (!r || r.error) { C.coppie = []; C.stima = null; pittaScrittura(); return; }
      C.coppie = r.coppie || [];
      C.stima = { costoUsd: r.costoUsd, modello: r.modello, fornitore: r.fornitore };
      pittaScrittura();
    }).catch(function () {});
  }

  function chiudi() {
    if (C.sporco && !confirm('Ci sono assegnazioni non salvate. Chiudo lo stesso?')) return;
    $('#composer').hidden = true;
    document.body.style.overflow = '';
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) {} }
    if (C.tornaAlWizard !== null && window.studiaWizard && window.studiaWizard.open) {
      var passo = C.tornaAlWizard; C.tornaAlWizard = null;
      window.studiaWizard.open(C.corso, passo);
    }
  }

  // -------------------------------------------------------------------- conti

  /** Su quale indice sta un personaggio, in una data lezione (null se non c'è). */
  function sceltaDi(pid, folder) {
    for (var k in C.ass) {
      if (k.slice(0, k.lastIndexOf(':')) === folder && C.ass[k].indexOf(pid) >= 0) return Number(k.slice(k.lastIndexOf(':') + 1));
    }
    return null;
  }
  function attivi() {
    var s = {};
    for (var k in C.ass) C.ass[k].forEach(function (p) { s[p] = 1; });
    return C.personaggi.filter(function (p) { return s[p.id]; }).map(function (p) { return p.id; });
  }
  /** Le lezioni in cui un personaggio non ha ancora un indice. Solo quelle che ne hanno da offrire. */
  function buchiDi(pid) {
    return C.lezioni.filter(function (c) { return alternativeDi(c.folder).length && sceltaDi(pid, c.folder) === null; })
      .map(function (c) { return c.folder; });
  }
  function siglaLezione(folder) { return String(folder).slice(0, 2); }

  /**
   * L'elenco dei capitoli di una card è aperto?
   *
   * L'interruttore in topbar decide per tutte; una card aperta o chiusa a mano
   * vince su di lui, finché non lo si tocca di nuovo — chi apre una card per
   * confrontarla con la vicina non vuole vedersela richiudere dal comando
   * generale, e chi preme «mostra tutti» vuole davvero tutti.
   */
  function indiceAperto(k) {
    return Object.prototype.hasOwnProperty.call(C.indiciAperti, k) ? C.indiciAperti[k] : C.tuttiIndici;
  }

  // ------------------------------------------------------------------- pittura

  function pitta() { pittaPersonaggi(); pittaTopbar(); pittaRighe(); pittaPercorsi(); pittaScrittura(); }

  /**
   * La scrittura dei capitoli, coppia per coppia.
   *
   * Le coppie non vengono dal tavolo ma dai percorsi **salvati**: scrivere i
   * capitoli di un'assegnazione che esiste solo a schermo produrrebbe cartelle
   * che nessun percorso rivendica. Chi ha spostato un personaggio e non ha
   * ancora salvato lo legge qui, invece di scoprirlo dopo aver speso.
   */
  function pittaScrittura() {
    var box = $('#cmpScrittura'); if (!box) return;
    var s = C.scr;
    if (!C.coppie.length) {
      box.innerHTML = '<span class="kick">Capitoli</span>' +
        '<p class="cmp-vuoto">Nessuna coppia lezione+indice da scrivere: assegna i personaggi agli indici e ' +
        '<b>salva i percorsi</b>. Ogni coppia diventa una cartella <code>lezione--indice</code> con i suoi capitoli.</p>';
      return;
    }
    var daFare = C.coppie.filter(function (k) { return k.stato !== 'scritti'; });
    var nCap = daFare.reduce(function (n, k) { return n + k.capitoli; }, 0);
    var costo = C.stima && typeof C.stima.costoUsd === 'number'
      ? 'circa <b>$' + C.stima.costoUsd.toFixed(2) + '</b> con ' + esc(C.stima.modello || 'il modello scelto')
      : 'costo non stimabile con ' + esc((C.stima && C.stima.modello) || 'questo modello') + ' (non è a listino)';

    var righe = C.coppie.map(function (k) {
      var chips = k.usataDa.map(function (pid) {
        var p = PG[pid]; return p ? '<span class="cmp-mini" style="background:' + tinta(p.colore, 20) + '" title="' +
          esc(C.nomi[pid] || p.nome) + '">' + p.emoji + '</span>' : '';
      }).join('');
      var stato = k.stato === 'scritti' ? '<span class="cmp-fatto">✓ ' + k.scritti + ' scritti</span>'
        : (k.stato === 'parziale' ? '<span class="cmp-parz">' + k.scritti + ' di ' + k.capitoli + '</span>'
                                  : '<span class="cmp-sub">da scrivere</span>');
      return '<tr' + (s.prog && s.prog.cartella === k.cartella ? ' class="incorso"' : '') + '>' +
        '<td><code>' + esc(k.cartella) + '</code><div class="cmp-sub">' + esc(k.titoloLezione) + '</div></td>' +
        '<td>' + esc(k.nome) + '</td>' +
        '<td class="num">' + k.capitoli + '</td>' +
        '<td>' + chips + (k.usataDa.length > 1 ? '<span class="cmp-cond">usato da ' + k.usataDa.length + ' percorsi</span>' : '') + '</td>' +
        '<td>' + stato + '</td>' +
        '<td><button type="button" class="wz-btn cmp-scrivi-uno" data-cartella="' + esc(k.cartella) + '"' +
          (s.stato === 'in-corso' ? ' disabled' : '') + '>' + (k.scritti ? 'riscrivi' : 'scrivi') + '</button></td></tr>';
    }).join('');

    var avanz = '';
    if (s.stato === 'in-corso') {
      var p = s.prog || {};
      var pc = Math.round(((p.coppia || 1) - 1 + ((p.indice || 0) / (p.totale || 1))) / (p.coppie || 1) * 100);
      avanz = '<div class="wz-avviso">Coppia ' + (p.coppia || 1) + ' di ' + (p.coppie || '?') + ' · <code>' +
        esc(p.cartella || '') + '</code>' +
        (p.fase === 'capitolo' ? ' — capitolo ' + (p.indice || 1) + ' di ' + (p.totale || '?') + ': «' + esc(p.titolo || '') + '»' : ' — preparo la cartella') +
        '</div><div class="cmp-bar"><i style="width:' + pc + '%"></i></div>';
    }
    if (s.errore) avanz += '<div class="wz-errore">' + esc(s.errore) + '</div>';

    box.innerHTML = '<span class="kick">Capitoli · una cartella per coppia lezione+indice</span>' +
      '<div class="cmp-scrhead">' +
      '<span>' + C.coppie.length + ' coppie · <b>' + nCap + '</b> capitoli da scrivere · ' + costo + '</span>' +
      (s.stato === 'in-corso'
        ? '<button type="button" class="wz-btn" id="cmpScrStop">Ferma dopo questo capitolo</button>'
        : '<button type="button" class="wz-btn primary" id="cmpScrivi"' + (nCap ? '' : ' disabled') + '>' +
            'Scrivi i capitoli mancanti</button>' +
          '<button type="button" class="wz-btn" id="cmpRiscrivi">Riscrivi tutto</button>') +
      '</div>' + avanz +
      '<table class="cmp-tab"><thead><tr><th>Cartella</th><th>Indice</th><th class="num">Cap.</th>' +
      '<th>Percorsi</th><th>Stato</th><th></th></tr></thead><tbody>' + righe + '</tbody></table>' +
      (s.log.length ? '<ul class="cmp-log">' + s.log.slice(-8).map(function (l) {
        return '<li' + (/✗/.test(l) ? ' class="err"' : '') + '>' + esc(l) + '</li>'; }).join('') + '</ul>' : '');
  }

  function pittaPersonaggi() {
    var box = $('#cmpPg'); if (!box) return;
    var att = attivi();
    box.innerHTML = C.personaggi.map(function (p) {
      var on = att.indexOf(p.id) >= 0, b = on ? buchiDi(p.id).length : 0;
      return '<div class="cmp-chip' + (on ? ' on' : '') + (b ? ' manca' : '') + '" draggable="true" data-p="' + esc(p.id) + '"' +
        ' style="background:' + tinta(p.colore, 18) + '" title="' + esc(p.nome + ' — ' + p.desc) + '">' + p.emoji +
        (on ? '<span class="n">' + (b ? b : '✓') + '</span>' : '') + '</div>';
    }).join('');
  }

  function pittaTopbar() {
    var n = $('#cmpNCap'); if (n && document.activeElement !== n) n.value = C.nCap || '';
    var a = $('#cmpNAlt'); if (a && document.activeElement !== a) a.value = C.nAlt || 3;
    var p = $('#cmpProj'); if (p) p.textContent = C.corso || '';
    var v = $('#cmpVediTutti');
    if (v) {
      v.textContent = C.tuttiIndici ? 'Nascondi gli indici' : 'Mostra gli indici';
      v.setAttribute('aria-pressed', C.tuttiIndici ? 'true' : 'false');
    }
    var b = $('#cmpChiedi');
    var senza = C.lezioni.filter(function (c) { return !alternativeDi(c.folder).length; }).length;
    if (b) {
      b.disabled = C.stato === 'in-corso' || !C.lezioni.length;
      b.textContent = C.stato === 'in-corso' ? 'Ci penso…'
        : (senza ? 'Proponi gli indici (' + senza + ' lezioni)' : 'Rifai tutti gli indici');
      b.dataset.rifai = senza ? '' : '1';
    }
  }

  function pittaRighe() {
    var box = $('#cmpRighe'); if (!box) return;
    if (C.errore) { box.innerHTML = '<div class="wz-errore">' + esc(C.errore) + '</div>'; return; }
    if (!C.lezioni.length) {
      box.innerHTML = '<div class="wz-avviso">Questo corso non ha ancora un piano di lezioni approvato. ' +
        'Apri il wizard, arriva al passo «Opzioni» e premi «Proponi le lezioni»: poi qui ci saranno le righe.</div>';
      return;
    }
    var avanz = '';
    if (C.stato === 'in-corso' && C.prog) {
      var pc = Math.round((C.prog.indice || 0) / (C.prog.totale || 1) * 100);
      avanz = '<div class="wz-avviso">Chiedo gli indici: lezione ' + (C.prog.indice || 1) + ' di ' + (C.prog.totale || '?') +
        ' · ' + esc(C.prog.titolo || '') + '</div>' +
        '<div class="cmp-bar"><i style="width:' + pc + '%"></i></div>';
    }
    box.innerHTML = avanz + C.lezioni.map(function (c) {
      var alt = alternativeDi(c.folder);
      var piste = alt.length ? alt.map(function (a, i) {
        var k = chiave(c.folder, i), dentro = C.ass[k] || [];
        var chips = dentro.map(function (pid) {
          var p = PG[pid]; if (!p) return '';
          return '<span class="cmp-mini" data-del="' + esc(k) + '|' + esc(pid) + '" style="background:' + tinta(p.colore, 20) +
            '" title="' + esc(p.nome) + ' — clicca per togliere">' + p.emoji + '</span>';
        }).join('');
        /* più personaggi sulla stessa card = capitoli scritti UNA volta e condivisi */
        var cond = dentro.length > 1 ? '<span class="cond">scritti 1 volta · usati da ' + dentro.length + '</span>' : '';
        /* La scheda riassunto dice come è fatto l'indice, l'elenco dice che cosa
           c'è dentro: sono due domande diverse e servono tutte e due — «adatto a
           chi vuole la mappa prima» non dice se il capitolo sui limiti c'è.
           I titoli sono già in cassa (pagati con la scaletta, salvati nella
           cache): mostrarli non costa una chiamata, costa spazio verticale.
           Per questo l'elenco è chiuso di default: aperti tutti, le righe non si
           confrontano più a colpo d'occhio, che è il senso della griglia. */
        var cap = a.capitoli || [];
        var aperto = indiceAperto(k);
        return '<div class="cmp-card-idx' + (dentro.length ? ' presa' : '') + '" data-k="' + esc(k) + '">' +
          '<div class="nome">' + esc(a.nome) + '</div>' +
          '<div class="caps">' +
            '<button type="button" class="cmp-vedi" data-k="' + esc(k) + '" aria-expanded="' + (aperto ? 'true' : 'false') + '">' +
            '<span class="fr">' + (aperto ? '▾' : '▸') + '</span> ' + cap.length + ' capitol' + (cap.length === 1 ? 'o' : 'i') + '</button>' +
            (a.completa === false ? ' · <span class="err">manca ' + esc((a.mancanti || []).join(', ')) + '</span>' : '') + '</div>' +
          (aperto && cap.length
            ? '<ol class="cmp-cap">' + cap.map(function (x) {
                return '<li' + (x.sintesi ? ' title="' + esc(x.sintesi) + '"' : '') + '>' + esc(x.titolo) + '</li>';
              }).join('') + '</ol>'
            : '') +
          (a.adattaA ? '<div class="ada"><em>Adatto a:</em> ' + esc(a.adattaA) + '</div>' : '') +
          (a.differenza ? '<div class="dif">' + esc(a.differenza) + '</div>' : '') +
          '<div class="slot">' + (chips || '<span class="vuoto">trascina qui</span>') + cond + '</div></div>';
      }).join('') : '<div class="cmp-vuoto">Nessun indice proposto per questa lezione.</div>';

      /* Il taglio delle lezioni si corregge QUI, accanto agli indici che ne nascono:
         era nel wizard, in un pannello a parte, e decidere il raggruppamento
         senza vedere che scalette produce è decidere alla cieca. Ogni comando
         rinumera le cartelle, quindi butta le scalette delle lezioni toccate: la
         riga torna vuota e si ripropone. */
      var i = C.lezioni.indexOf(c), ultimo = i === C.lezioni.length - 1;
      var cmd = function (az, testo, titolo, spento) {
        return '<button type="button" class="cmp-cmd" data-az="' + az + '" data-i="' + i + '"' +
          (titolo ? ' title="' + esc(titolo) + '"' : '') +
          (spento || C.stato === 'in-corso' ? ' disabled' : '') + '>' + testo + '</button>';
      };
      return '<div class="cmp-riga"><div class="cmp-lezione">' +
        '<div class="n">' + esc(siglaLezione(c.folder)) + '</div>' +
        /* Il titolo è un div editabile e non un <input>: dentro un campo il
           titolo lungo si taglia a metà parola e non c'è modo di leggerlo, qui
           va a capo e si sillaba come il resto della pagina. Si salva quando si
           esce dal campo, non a ogni tasto. */
        '<div class="cmp-titolo" contenteditable="true" spellcheck="false" data-i="' + i + '" role="textbox" aria-label="Titolo della lezione">' +
          esc(c.title) + '</div>' +
        '<div class="m">' + c.materiali + ' material' + (c.materiali === 1 ? 'e' : 'i') +
          ' · ' + alt.length + ' indici proposti</div>' +
        '<div class="cmp-lezionecmd">' +
          cmd('su', '↑', 'Sposta la lezione più in alto', i === 0) +
          cmd('giu', '↓', 'Sposta la lezione più in basso', ultimo) +
          cmd('unisci', 'unisci', 'Unisci con la lezione successiva', ultimo) +
          cmd('separa', 'separa', 'Separa l\'ultimo materiale in una lezione a sé', c.materiali < 2) +
          cmd('giu-mat', '→ dopo', 'Passa l\'ultimo materiale alla lezione successiva', ultimo || c.materiali < 2) +
        '</div>' +
        '<div class="cmp-rigacmd">' +
          '<input type="number" class="cmp-ncap-riga" data-folder="' + esc(c.folder) + '" min="2" max="30" ' +
            'value="' + esc(C.nPerLezione[c.folder] || '') + '" placeholder="' + (C.nCap || 'auto') + '" ' +
            'title="Quanti capitoli per gli indici di questa lezione. Vuoto = quello generale.">' +
          '<button type="button" class="wz-btn cmp-rifai" data-folder="' + esc(c.folder) + '"' +
            (C.stato === 'in-corso' ? ' disabled' : '') + '>' + (alt.length ? 'rifai' : 'proponi') + '</button>' +
        '</div></div>' +
        '<div class="cmp-piste">' + piste + '</div></div>';
    }).join('');
  }

  function pittaPercorsi() {
    var att = attivi();
    var box = $('#cmpPcols'); if (!box) return;
    var scritte = {};                       // "folder:indice" → quanti percorsi la usano
    for (var k in C.ass) if (C.ass[k].length) scritte[k] = C.ass[k].length;

    var ok = 0, sommaIngenua = 0;
    box.innerHTML = att.length ? att.map(function (pid) {
      var p = PG[pid], voci = [], completo = true;
      C.lezioni.forEach(function (c) {
        var i = sceltaDi(pid, c.folder);
        if (i === null) { if (alternativeDi(c.folder).length) completo = false; return; }
        var a = alternativeDi(c.folder)[i]; if (!a) return;
        var quanti = scritte[chiave(c.folder, i)] || 1;
        (a.capitoli || []).forEach(function (cap, j) {
          voci.push({ num: siglaLezione(c.folder) + '.' + String(j + 1).padStart(2, '0'),
                      t: cap.titolo || a.nome, cond: quanti > 1, quanti: quanti });
        });
      });
      if (completo) ok++;
      sommaIngenua += voci.length;
      voci.sort(function (a, b) { return a.num.localeCompare(b.num, 'it', { numeric: true }); });
      var b = buchiDi(pid), nCond = voci.filter(function (v) { return v.cond; }).length;
      return '<div class="cmp-perc" style="--pc:' + p.colore + '">' +
        '<h4><span class="e">' + p.emoji + '</span>' +
        '<input type="text" class="cmp-nome" data-p="' + esc(pid) + '" value="' + esc(C.nomi[pid] || p.nome) + '" ' +
          'aria-label="Nome della variante" maxlength="60"></h4>' +
        '<div class="sub">' + voci.length + ' capitoli' +
          (nCond ? ' · ' + nCond + ' condivisi con altri percorsi' : '') +
          (b.length ? ' · <span class="err">mancano le lezioni ' + esc(b.map(siglaLezione).join(', ')) + '</span>' : ' · percorso completo') +
        '</div><ol>' + voci.map(function (v) {
          return '<li' + (v.cond ? ' class="share" title="Condiviso con altri ' + (v.quanti - 1) + ' percorsi"' : '') + '>' +
            '<span class="cn">' + esc(v.num) + '</span> — ' + esc(v.t) + (v.cond ? ' · ×' + v.quanti : '') + '</li>';
        }).join('') + '</ol></div>';
    }).join('') : '<p class="cmp-vuoto">Nessun personaggio ancora assegnato: trascinane uno su un indice.</p>';

    /* da scrivere davvero = i capitoli delle coppie DISTINTE scelte */
    var daScrivere = 0;
    for (var key in scritte) {
      var i = key.lastIndexOf(':');
      var a = alternativeDi(key.slice(0, i))[Number(key.slice(i + 1))];
      if (a) daScrivere += (a.capitoli || []).length;
    }
    var s = $('#cmpSummary'); if (!s) return;
    s.innerHTML =
      '<span><span class="kick">Corso</span><br><b>' + esc(C.corso || '—') + '</b></span>' +
      '<span><span class="kick">Lezioni</span><br><b>' + C.lezioni.length + '</b></span>' +
      '<span><span class="kick">Percorsi completi</span><br><b>' + ok + '</b> / ' + att.length + '</span>' +
      '<div class="cmp-prog"><i style="width:' + (att.length ? Math.round(ok / att.length * 100) : 0) + '%"></i></div>' +
      '<span><span class="kick">Capitoli da scrivere</span><br><b>' + daScrivere + '</b>' +
      '<span class="risp">' + (sommaIngenua > daScrivere
        ? 'invece di ' + sommaIngenua + ' · <b>' + (sommaIngenua - daScrivere) + ' risparmiati</b>'
        : (daScrivere ? 'nessuna sovrapposizione, per ora' : '')) + '</span></span>';
  }

  // -------------------------------------------------- correggere le lezioni qui

  /**
   * Un comando sul taglio delle lezioni. Il piano vero sta nel processo principale:
   * qui si manda l'azione e si ridisegna con quello che torna, invece di tenere
   * due copie del piano che prima o poi divergono.
   *
   * Ogni comando rinumera le cartelle, e le scalette delle lezioni toccate vengono
   * buttate: erano state pagate per una lezione che ora ha altri materiali dentro.
   * Lo si dice, non lo si lascia scoprire.
   */
  function comandoLezione(azione, i, valore) {
    if (!(window.vault.plan && window.vault.plan.comando)) return;
    window.vault.plan.comando(C.corso, azione, i, valore).then(function (r) {
      if (!r || r.error) { toast('Non applicato: ' + ((r && r.error) || 'errore'), false); return; }
      C.lezioni = r.lezioni || C.lezioni;
      C.scalette = r.scalette || {};
      C.percorsi = r.percorsi || [];
      // le assegnazioni si rileggono dai percorsi salvati: quelle sulle lezioni sparite non esistono più
      C.ass = {};
      C.percorsi.forEach(function (p) {
        Object.keys(p.scelte || {}).forEach(function (folder) {
          var k = chiave(folder, p.scelte[folder].indice);
          (C.ass[k] = C.ass[k] || []).push(p.id);
        });
      });
      C.sporco = false;
      pitta(); caricaCoppie();
      if ((r.invalidate || []).length) {
        toast(r.invalidate.length + ' scalette buttate: quelle lezioni sono cambiate, gli indici vanno riproposti', false);
      }
    });
  }

  // ---------------------------------------------------------------- richieste

  function chiediScalette(folders, rifai) {
    if (!(window.vault && window.vault.scaletta && window.vault.scaletta.tutte)) return;
    C.stato = 'in-corso'; C.errore = null;
    C.prog = { indice: 0, totale: (folders && folders.length) || C.lezioni.length, titolo: '' };
    pitta();
    window.vault.scaletta.tutte(C.corso, {
      nCapitoli: (folders && folders.length === 1 && C.nPerLezione[folders[0]]) || C.nCap || null,
      nAlternative: C.nAlt || null,
      solo: folders || null, rifai: !!rifai
    });
  }

  if (window.vault && window.vault.scaletta && window.vault.scaletta.onProgress) {
    window.vault.scaletta.onProgress(function (d) {
      if (C.stato !== 'in-corso' || !d) return;
      C.prog = d;
      if (d.alternative) C.scalette[d.folder] = { folder: d.folder, alternative: d.alternative };
      pitta();
    });
    window.vault.scaletta.onDone(function (d) {
      if (C.stato !== 'in-corso') return;
      C.stato = 'fermo'; C.prog = null;
      var err = (d && d.errori) || [];
      if (err.length) C.errore = err.length + ' lezioni senza indici: ' + err.map(function (x) { return x.folder + ' (' + x.errore + ')'; }).join(' · ');
      // le scalette arrivate durante la corsa sono già in C.scalette; si rilegge lo stato per la cache su disco
      if (window.vault.composer) window.vault.composer.stato(C.corso).then(function (s) {
        if (s && !s.error) { C.scalette = s.scalette || C.scalette; }
        pitta();
      }); else pitta();
      toast(((d && d.fatti) || 0) + ' lezioni con gli indici proposti', !err.length);
    });
    window.vault.scaletta.onError(function (m) {
      if (C.stato !== 'in-corso') return;
      C.stato = 'fermo'; C.prog = null; C.errore = String(m || 'errore sconosciuto'); pitta();
      toast('Indici non proposti: ' + C.errore, false);
    });
  }

  // ------------------------------------------------------- scrivere i capitoli

  /**
   * Avvia la scrittura. `cartelle` limita a certe coppie; `riscrivi` rifà anche
   * quelle già fatte — e allora va detto prima quante ne dipendono: rigenerare
   * un indice condiviso riscrive i capitoli di tutti i percorsi che lo usano.
   */
  function scriviCapitoli(cartelle, riscrivi) {
    if (!(window.vault.percorsi && window.vault.percorsi.capitoli)) return;
    var tocca = C.coppie.filter(function (k) {
      return (!cartelle || cartelle.indexOf(k.cartella) >= 0) && (riscrivi || k.stato !== 'scritti');
    });
    if (!tocca.length) { toast('Non c\'è niente da scrivere: tutte le coppie sono già fatte', false); return; }
    var condivise = tocca.filter(function (k) { return k.usataDa.length > 1 && k.scritti; });
    var giaFatti = tocca.filter(function (k) { return k.scritti; });
    if (giaFatti.length) {
      var msg = 'Riscrivo ' + giaFatti.length + ' cartelle che hanno già i capitoli: quelli vecchi vengono cancellati.';
      if (condivise.length) {
        msg += '\n\n' + condivise.map(function (k) {
          return '· ' + k.cartella + ' è usata da ' + k.usataDa.length + ' percorsi: si aggiornano tutti.';
        }).join('\n');
      }
      if (!confirm(msg + '\n\nProcedo?')) return;
    }
    C.scr = { stato: 'in-corso', prog: null, log: [], errore: null };
    pittaScrittura();
    window.vault.percorsi.capitoli(C.corso, {
      cartelle: tocca.map(function (k) { return k.cartella; }), riscrivi: !!riscrivi
    });
  }

  if (window.vault && window.vault.percorsi && window.vault.percorsi.onCapProgress) {
    window.vault.percorsi.onCapProgress(function (d) {
      if (C.scr.stato !== 'in-corso') return;
      C.scr.prog = d || {}; pittaScrittura();
    });
    window.vault.percorsi.onCapLog(function (l) {
      if (C.scr.stato !== 'in-corso') return;
      C.scr.log.push(String(l)); if (C.scr.log.length > 60) C.scr.log.shift();
      pittaScrittura();
    });
    window.vault.percorsi.onCapDone(function (d) {
      if (C.scr.stato !== 'in-corso') return;
      C.scr.stato = 'fermo'; C.scr.prog = null;
      var s = (d && d.scritti) || 0, k = (d && d.scarti) || 0;
      toast(s + ' capitoli scritti in ' + ((d && d.fatte) || 0) + ' cartelle' + (k ? ', ' + k + ' scartati' : ''), !k);
      caricaCoppie();                         // lo stato si rilegge dal disco, non si deduce
      if (typeof window.aggiornaVarianti === 'function') window.aggiornaVarianti();
    });
    window.vault.percorsi.onCapError(function (m) {
      if (C.scr.stato !== 'in-corso') return;
      C.scr.stato = 'fermo'; C.scr.prog = null; C.scr.errore = String(m || 'errore sconosciuto');
      pittaScrittura(); toast('Scrittura non riuscita: ' + C.scr.errore, false);
    });
  }

  // ------------------------------------------------------------------ salvare

  /** Lo stato del tavolo, nella forma che va sul disco. */
  function percorsiDaTavolo() {
    return attivi().map(function (pid) {
      var scelte = {};
      C.lezioni.forEach(function (c) {
        var i = sceltaDi(pid, c.folder);
        if (i === null) return;
        var a = alternativeDi(c.folder)[i];
        scelte[c.folder] = { indice: i, nome: (a && a.nome) || '', capitoli: a ? (a.capitoli || []).length : 0 };
      });
      return { id: pid, nome: C.nomi[pid] || (PG[pid] && PG[pid].nome) || pid, scelte: scelte };
    });
  }

  function salva(anchePerBuchi) {
    var att = attivi();
    if (!att.length) { toast('Trascina almeno un personaggio su un indice', false); return; }
    var rotti = att.filter(function (p) { return buchiDi(p).length; });
    if (rotti.length && !anchePerBuchi) { mostraBuchi(rotti); return; }
    window.vault.percorsi.save(C.corso, percorsiDaTavolo()).then(function (r) {
      if (r && r.error) { toast('Percorsi non salvati: ' + r.error, false); return; }
      C.percorsi = (r && r.percorsi) || []; C.sporco = false;
      toast(C.percorsi.length + ' percorsi salvati in PERCORSI/', true);
      caricaCoppie();                     // le coppie da scrivere cambiano con le assegnazioni
      if (typeof window.aggiornaVarianti === 'function') window.aggiornaVarianti();
    });
  }

  function mostraBuchi(rotti) {
    $('#cmpOvBody').innerHTML =
      '<p style="margin:0 0 .7rem">Questi personaggi hanno delle lezioni <b>senza indice assegnato</b>. ' +
      'Il percorso si salva lo stesso, ma finché ha dei buchi non ci si possono scrivere i capitoli.</p>' +
      rotti.map(function (pid) {
        var p = PG[pid], b = buchiDi(pid);
        return '<div class="cmp-buco"><span class="e" style="background:' + tinta(p.colore, 20) + '">' + p.emoji + '</span>' +
          '<span><b>' + esc(C.nomi[pid] || p.nome) + '</b><br><span class="cmp-sub">' +
          b.length + ' lezioni senza indice: <span class="num">' + esc(b.map(siglaLezione).join(' · ')) + '</span></span></span></div>';
      }).join('');
    $('#cmpOv').dataset.on = '1';
  }

  // ------------------------------------------------------------------ wiring

  var volo = null;
  document.addEventListener('dragstart', function (e) {
    var t = e.target.closest && e.target.closest('.cmp-chip');
    if (t) { volo = t.getAttribute('data-p'); e.dataTransfer.effectAllowed = 'copy'; }
  });
  document.addEventListener('dragover', function (e) {
    var c = e.target.closest && e.target.closest('.cmp-card-idx');
    if (c && volo) { e.preventDefault(); c.classList.add('drop'); }
  });
  document.addEventListener('dragleave', function (e) {
    var c = e.target.closest && e.target.closest('.cmp-card-idx');
    if (c) c.classList.remove('drop');
  });
  document.addEventListener('drop', function (e) {
    var c = e.target.closest && e.target.closest('.cmp-card-idx');
    if (!c || !volo) return;
    e.preventDefault(); c.classList.remove('drop');
    var k = c.getAttribute('data-k'), folder = k.slice(0, k.lastIndexOf(':'));
    /* un personaggio segue UN indice per lezione: assegnarlo altrove lo sposta */
    for (var x in C.ass) {
      if (x.slice(0, x.lastIndexOf(':')) !== folder) continue;
      C.ass[x] = C.ass[x].filter(function (p) { return p !== volo; });
      if (!C.ass[x].length) delete C.ass[x];
    }
    C.ass[k] = C.ass[k] || [];
    if (C.ass[k].indexOf(volo) < 0) C.ass[k].push(volo);
    volo = null; C.sporco = true; pitta();
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('#openComposer')) {
      // dalle Impostazioni: il pannello si chiude, il composer prende lo schermo
      document.documentElement.dataset.settings = '';
      var sm = document.getElementById('settingsModal'); if (sm) sm.hidden = true;
      apri(typeof window.corsoAttivo === 'function' ? window.corsoAttivo() : null);
      return;
    }
    if (e.target.closest('#cmpClose')) { chiudi(); return; }
    if (e.target.closest('#cmpSalva')) { salva(false); return; }
    if (e.target.closest('#cmpOvNo')) { $('#cmpOv').dataset.on = ''; return; }
    if (e.target.closest('#cmpOvSi')) { $('#cmpOv').dataset.on = ''; salva(true); return; }
    if (e.target.closest('#cmpFs')) {
      if (document.fullscreenElement) document.exitFullscreen();
      else $('#composer').requestFullscreen();
      return;
    }
    if (e.target.closest('#cmpScrivi')) { scriviCapitoli(null, false); return; }
    if (e.target.closest('#cmpRiscrivi')) { scriviCapitoli(null, true); return; }
    if (e.target.closest('#cmpScrStop')) {
      window.vault.percorsi.ferma(C.corso);
      toast('Mi fermo dopo questo capitolo', true);
      return;
    }
    var uno = e.target.closest('.cmp-scrivi-uno');
    if (uno) { scriviCapitoli([uno.getAttribute('data-cartella')], true); return; }
    var cmd = e.target.closest('.cmp-cmd');
    if (cmd) { comandoLezione(cmd.getAttribute('data-az'), Number(cmd.getAttribute('data-i'))); return; }
    if (e.target.closest('#cmpVediTutti')) {
      C.tuttiIndici = !C.tuttiIndici;
      C.indiciAperti = {};              // il comando generale riazzera le scelte per card
      pittaTopbar(); pittaRighe();
      return;
    }
    var vedi = e.target.closest('.cmp-vedi');
    if (vedi) {
      var kk = vedi.getAttribute('data-k');
      C.indiciAperti[kk] = !indiceAperto(kk);
      pittaRighe();
      return;
    }
    var chiedi = e.target.closest('#cmpChiedi');
    if (chiedi) { chiediScalette(null, chiedi.dataset.rifai === '1'); return; }
    var rifai = e.target.closest('.cmp-rifai');
    if (rifai) { chiediScalette([rifai.getAttribute('data-folder')], true); return; }
    // togliere un personaggio da una card
    var del = e.target.closest('.cmp-mini');
    if (del) {
      var parti = del.getAttribute('data-del').split('|');
      C.ass[parti[0]] = (C.ass[parti[0]] || []).filter(function (p) { return p !== parti[1]; });
      if (!C.ass[parti[0]].length) delete C.ass[parti[0]];
      C.sporco = true; pitta();
      return;
    }
    if (e.target.id === 'cmpOv') { e.target.dataset.on = ''; return; }
  });

  document.addEventListener('change', function (e) {
    if (!e.target.closest) return;
    if (e.target.id === 'cmpNAlt') {
      C.nAlt = Math.min(6, Math.max(2, Number(e.target.value) || 3));
      try {
        var pa = (window.vault.prefs && window.vault.prefs.read()) || {};
        pa.nAlternative = C.nAlt; window.vault.prefs.save(pa);
      } catch (err) {}
      pittaTopbar();
      return;
    }
    if (e.target.id === 'cmpNCap') {
      C.nCap = Number(e.target.value) || null;
      try {
        var p = (window.vault.prefs && window.vault.prefs.read()) || {};
        p.capitoliPerLezione = C.nCap; window.vault.prefs.save(p);
      } catch (err) {}
      pittaRighe();                       // i segnaposto delle righe seguono il valore generale
      return;
    }
    if (e.target.classList && e.target.classList.contains('cmp-ncap-riga')) {
      var f = e.target.getAttribute('data-folder'), n = Number(e.target.value) || 0;
      if (n) C.nPerLezione[f] = n; else delete C.nPerLezione[f];
      return;
    }
    if (e.target.classList && e.target.classList.contains('cmp-nome')) {
      C.nomi[e.target.getAttribute('data-p')] = e.target.value.slice(0, 60);
      C.sporco = true;
      return;
    }
  });

  /* Il titolo si salva uscendo dal campo: `blur` non risale, quindi si ascolta
     in cattura. Ridisegnare a ogni tasto rifarebbe la riga sotto le dita. */
  document.addEventListener('blur', function (e) {
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains('cmp-titolo')) return;
    var nuovo = (t.textContent || '').replace(/\s+/g, ' ').trim();
    var i = Number(t.getAttribute('data-i'));
    var vecchio = (C.lezioni[i] && C.lezioni[i].title) || '';
    if (!nuovo || nuovo === vecchio) { t.textContent = vecchio; return; }
    comandoLezione('titolo', i, nuovo);
  }, true);
  document.addEventListener('keydown', function (e) {
    // Invio conferma il titolo invece di andare a capo: è un titolo, non un testo
    if (e.key === 'Enter' && e.target && e.target.classList && e.target.classList.contains('cmp-titolo')) {
      e.preventDefault(); e.target.blur(); return;
    }
    // Esc dentro il titolo annulla la modifica: chiudere tutto il composer sarebbe una punizione
    if (e.key === 'Escape' && e.target && e.target.classList && e.target.classList.contains('cmp-titolo')) {
      e.stopPropagation();
      var j = Number(e.target.getAttribute('data-i'));
      e.target.textContent = (C.lezioni[j] && C.lezioni[j].title) || '';
      e.target.blur();
      return;
    }
    if (e.key === 'Escape' && !$('#composer').hidden) {
      if ($('#cmpOv').dataset.on) { $('#cmpOv').dataset.on = ''; return; }
      chiudi();
    }
  });

  window.studiaComposer = { apri: apri, chiudi: chiudi };
})();
