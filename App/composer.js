'use strict';
/**
 * composer — la pagina dove si compongono i percorsi.
 *
 * Righe = i corsi del piano. Su ogni riga, le card degli indici che il modello
 * ha proposto per quel corso (numero variabile: lo zig-zag è previsto e non è
 * un difetto). Gli otto personaggi si trascinano sulle card: un personaggio
 * segue UN indice per corso, e trascinarlo altrove lo sposta invece di
 * duplicarlo. In fondo, i percorsi composti con i capitoli in ordine numerico.
 *
 * Il punto della pagina non è scegliere un indice — quello lo fa già il wizard,
 * un corso per volta. Il punto è vedere TUTTE le proposte insieme e capire come
 * si delinea il progetto prima di spendere per scrivere i capitoli.
 *
 * Due card con lo stesso indice scelto da più personaggi sono capitoli scritti
 * una volta sola e condivisi: il riepilogo in alto lo conta, perché è l'unica
 * ragione per cui otto varianti non costano otto volte.
 */
(function () {
  var C = {
    progetto: null, corsi: [], scalette: {}, percorsi: [], personaggi: [],
    ass: {},            // "folder:indice" → [id personaggio]
    nomi: {},           // id personaggio → nome dato alla variante
    nCap: null,         // capitoli per corso chiesti al modello (null = lo decide lui)
    nPerCorso: {},      // scostamenti riga per riga
    stato: 'fermo', prog: null, errore: null, sporco: false
  };
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var toast = function (m, ok) { if (typeof window.toast === 'function') window.toast(m, ok); };
  var PG = {};          // id → personaggio

  function tinta(col, pct) { return 'color-mix(in srgb,' + col + ' ' + pct + '%,var(--panel))'; }
  function chiave(folder, i) { return folder + ':' + i; }
  function corsoDi(folder) { return C.corsi.filter(function (c) { return c.folder === folder; })[0] || null; }
  function alternativeDi(folder) { return (C.scalette[folder] && C.scalette[folder].alternative) || []; }

  // ------------------------------------------------------------------ apertura

  function apri(progetto) {
    C.progetto = progetto || null;
    if (!C.progetto) { toast('Scegli prima un progetto', false); return; }
    if (!(window.vault && window.vault.composer)) { toast('Il composer è disponibile solo nell\'app', false); return; }
    C.errore = null; C.prog = null; C.stato = 'fermo'; C.sporco = false;
    try {
      var pr = (window.vault.prefs && window.vault.prefs.read()) || {};
      C.nCap = Number(pr.capitoliPerCorso) || null;
    } catch (e) { C.nCap = null; }
    $('#composer').hidden = false;
    document.body.style.overflow = 'hidden';
    pitta();
    window.vault.composer.stato(C.progetto).then(function (s) {
      if (!s || s.error) { C.errore = (s && s.error) || 'stato non leggibile'; pitta(); return; }
      C.corsi = s.corsi || []; C.scalette = s.scalette || {}; C.percorsi = s.percorsi || [];
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
        if (C.scalette[f] && C.scalette[f].nCapitoli) C.nPerCorso[f] = C.scalette[f].nCapitoli;
      });
      pitta();
    });
  }

  function chiudi() {
    if (C.sporco && !confirm('Ci sono assegnazioni non salvate. Chiudo lo stesso?')) return;
    $('#composer').hidden = true;
    document.body.style.overflow = '';
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) {} }
  }

  // -------------------------------------------------------------------- conti

  /** Su quale indice sta un personaggio, in un dato corso (null se non c'è). */
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
  /** I corsi in cui un personaggio non ha ancora un indice. Solo quelli che ne hanno da offrire. */
  function buchiDi(pid) {
    return C.corsi.filter(function (c) { return alternativeDi(c.folder).length && sceltaDi(pid, c.folder) === null; })
      .map(function (c) { return c.folder; });
  }
  function siglaCorso(folder) { return String(folder).slice(0, 2); }

  // ------------------------------------------------------------------- pittura

  function pitta() { pittaPersonaggi(); pittaTopbar(); pittaRighe(); pittaPercorsi(); }

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
    var p = $('#cmpProj'); if (p) p.textContent = C.progetto || '';
    var b = $('#cmpChiedi');
    var senza = C.corsi.filter(function (c) { return !alternativeDi(c.folder).length; }).length;
    if (b) {
      b.disabled = C.stato === 'in-corso' || !C.corsi.length;
      b.textContent = C.stato === 'in-corso' ? 'Ci penso…'
        : (senza ? 'Proponi gli indici (' + senza + ' corsi)' : 'Rifai tutti gli indici');
      b.dataset.rifai = senza ? '' : '1';
    }
  }

  function pittaRighe() {
    var box = $('#cmpRighe'); if (!box) return;
    if (C.errore) { box.innerHTML = '<div class="wz-errore">' + esc(C.errore) + '</div>'; return; }
    if (!C.corsi.length) {
      box.innerHTML = '<div class="wz-avviso">Questo progetto non ha ancora un piano di corsi approvato. ' +
        'Apri il wizard, arriva al passo «Indice dei corsi» e approvalo: poi qui ci saranno le righe.</div>';
      return;
    }
    var avanz = '';
    if (C.stato === 'in-corso' && C.prog) {
      var pc = Math.round((C.prog.indice || 0) / (C.prog.totale || 1) * 100);
      avanz = '<div class="wz-avviso">Chiedo gli indici: corso ' + (C.prog.indice || 1) + ' di ' + (C.prog.totale || '?') +
        ' · ' + esc(C.prog.titolo || '') + '</div>' +
        '<div class="cmp-bar"><i style="width:' + pc + '%"></i></div>';
    }
    box.innerHTML = avanz + C.corsi.map(function (c) {
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
        return '<div class="cmp-card-idx' + (dentro.length ? ' presa' : '') + '" data-k="' + esc(k) + '">' +
          '<div class="nome">' + esc(a.nome) + '</div>' +
          '<div class="caps">' + (a.capitoli || []).length + ' capitol' + ((a.capitoli || []).length === 1 ? 'o' : 'i') +
            (a.completa === false ? ' · <span class="err">manca ' + esc((a.mancanti || []).join(', ')) + '</span>' : '') + '</div>' +
          (a.adattaA ? '<div class="ada"><em>Adatto a:</em> ' + esc(a.adattaA) + '</div>' : '') +
          (a.differenza ? '<div class="dif">' + esc(a.differenza) + '</div>' : '') +
          '<div class="slot">' + (chips || '<span class="vuoto">trascina qui</span>') + cond + '</div></div>';
      }).join('') : '<div class="cmp-vuoto">Nessun indice proposto per questo corso.</div>';

      return '<div class="cmp-riga"><div class="cmp-corso">' +
        '<div class="n">' + esc(siglaCorso(c.folder)) + '</div>' +
        '<div class="t">' + esc(c.title) + '</div>' +
        '<div class="m">' + c.materiali + ' material' + (c.materiali === 1 ? 'e' : 'i') +
          ' · ' + alt.length + ' indici proposti</div>' +
        '<div class="cmp-rigacmd">' +
          '<input type="number" class="cmp-ncap-riga" data-folder="' + esc(c.folder) + '" min="2" max="30" ' +
            'value="' + esc(C.nPerCorso[c.folder] || '') + '" placeholder="' + (C.nCap || 'auto') + '" ' +
            'title="Quanti capitoli per gli indici di questo corso. Vuoto = quello generale.">' +
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
      C.corsi.forEach(function (c) {
        var i = sceltaDi(pid, c.folder);
        if (i === null) { if (alternativeDi(c.folder).length) completo = false; return; }
        var a = alternativeDi(c.folder)[i]; if (!a) return;
        var quanti = scritte[chiave(c.folder, i)] || 1;
        (a.capitoli || []).forEach(function (cap, j) {
          voci.push({ num: siglaCorso(c.folder) + '.' + String(j + 1).padStart(2, '0'),
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
          (b.length ? ' · <span class="err">mancano i corsi ' + esc(b.map(siglaCorso).join(', ')) + '</span>' : ' · percorso completo') +
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
      '<span><span class="kick">Progetto</span><br><b>' + esc(C.progetto || '—') + '</b></span>' +
      '<span><span class="kick">Corsi</span><br><b>' + C.corsi.length + '</b></span>' +
      '<span><span class="kick">Percorsi completi</span><br><b>' + ok + '</b> / ' + att.length + '</span>' +
      '<div class="cmp-prog"><i style="width:' + (att.length ? Math.round(ok / att.length * 100) : 0) + '%"></i></div>' +
      '<span><span class="kick">Capitoli da scrivere</span><br><b>' + daScrivere + '</b>' +
      '<span class="risp">' + (sommaIngenua > daScrivere
        ? 'invece di ' + sommaIngenua + ' · <b>' + (sommaIngenua - daScrivere) + ' risparmiati</b>'
        : (daScrivere ? 'nessuna sovrapposizione, per ora' : '')) + '</span></span>';
  }

  // ---------------------------------------------------------------- richieste

  function chiediScalette(folders, rifai) {
    if (!(window.vault && window.vault.scaletta && window.vault.scaletta.tutte)) return;
    C.stato = 'in-corso'; C.errore = null;
    C.prog = { indice: 0, totale: (folders && folders.length) || C.corsi.length, titolo: '' };
    pitta();
    window.vault.scaletta.tutte(C.progetto, {
      nCapitoli: (folders && folders.length === 1 && C.nPerCorso[folders[0]]) || C.nCap || null,
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
      if (err.length) C.errore = err.length + ' corsi senza indici: ' + err.map(function (x) { return x.folder + ' (' + x.errore + ')'; }).join(' · ');
      // le scalette arrivate durante la corsa sono già in C.scalette; si rilegge lo stato per la cache su disco
      if (window.vault.composer) window.vault.composer.stato(C.progetto).then(function (s) {
        if (s && !s.error) { C.scalette = s.scalette || C.scalette; }
        pitta();
      }); else pitta();
      toast(((d && d.fatti) || 0) + ' corsi con gli indici proposti', !err.length);
    });
    window.vault.scaletta.onError(function (m) {
      if (C.stato !== 'in-corso') return;
      C.stato = 'fermo'; C.prog = null; C.errore = String(m || 'errore sconosciuto'); pitta();
      toast('Indici non proposti: ' + C.errore, false);
    });
  }

  // ------------------------------------------------------------------ salvare

  /** Lo stato del tavolo, nella forma che va sul disco. */
  function percorsiDaTavolo() {
    return attivi().map(function (pid) {
      var scelte = {};
      C.corsi.forEach(function (c) {
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
    window.vault.percorsi.save(C.progetto, percorsiDaTavolo()).then(function (r) {
      if (r && r.error) { toast('Percorsi non salvati: ' + r.error, false); return; }
      C.percorsi = (r && r.percorsi) || []; C.sporco = false;
      toast(C.percorsi.length + ' percorsi salvati in PERCORSI/', true);
      if (typeof window.aggiornaVarianti === 'function') window.aggiornaVarianti();
    });
  }

  function mostraBuchi(rotti) {
    $('#cmpOvBody').innerHTML =
      '<p style="margin:0 0 .7rem">Questi personaggi hanno dei corsi <b>senza indice assegnato</b>. ' +
      'Il percorso si salva lo stesso, ma finché ha dei buchi non ci si possono scrivere i capitoli.</p>' +
      rotti.map(function (pid) {
        var p = PG[pid], b = buchiDi(pid);
        return '<div class="cmp-buco"><span class="e" style="background:' + tinta(p.colore, 20) + '">' + p.emoji + '</span>' +
          '<span><b>' + esc(C.nomi[pid] || p.nome) + '</b><br><span class="cmp-sub">' +
          b.length + ' corsi senza indice: <span class="num">' + esc(b.map(siglaCorso).join(' · ')) + '</span></span></span></div>';
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
    /* un personaggio segue UN indice per corso: assegnarlo altrove lo sposta */
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
      apri(typeof window.progettoAttivo === 'function' ? window.progettoAttivo() : null);
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
    if (e.target.id === 'cmpNCap') {
      C.nCap = Number(e.target.value) || null;
      try {
        var p = (window.vault.prefs && window.vault.prefs.read()) || {};
        p.capitoliPerCorso = C.nCap; window.vault.prefs.save(p);
      } catch (err) {}
      pittaRighe();                       // i segnaposto delle righe seguono il valore generale
      return;
    }
    if (e.target.classList && e.target.classList.contains('cmp-ncap-riga')) {
      var f = e.target.getAttribute('data-folder'), n = Number(e.target.value) || 0;
      if (n) C.nPerCorso[f] = n; else delete C.nPerCorso[f];
      return;
    }
    if (e.target.classList && e.target.classList.contains('cmp-nome')) {
      C.nomi[e.target.getAttribute('data-p')] = e.target.value.slice(0, 60);
      C.sporco = true;
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#composer').hidden) {
      if ($('#cmpOv').dataset.on) { $('#cmpOv').dataset.on = ''; return; }
      chiudi();
    }
  });

  window.studiaComposer = { apri: apri, chiudi: chiudi };
})();
