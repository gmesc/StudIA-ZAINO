'use strict';
/**
 * wizard — creazione guidata di un corso.
 *
 * Questa versione copre gli step 0 (progetto e brief) e 1 (raccolta materiali);
 * gli step 2–5 (elaborazione, proposta indice, generazione, fine) arrivano con M3–M5.
 * Lo stato vive nel filesystem: `_progetto.md` è scritto alla fine dello step 0,
 * quindi il brief esiste PRIMA di qualunque elaborazione e il wizard è riprendibile.
 *
 * Un pannello per volta, azioni esplicite, «Chiudi (riprendi dopo)» sempre disponibile.
 */
(function () {
  var W = { step: 0, progetto: null, brief: {}, importati: [], daImportare: [],
            corpus: [], scelti: null, ing: { stato: 'fermo', frazione: 0, msg: '', file: '', log: [], errore: null },
            imp: { cartella: null, piano: null, forzati: [], stato: 'fermo', errore: null },
            fonti: {},                                  // numero materiale → ruolo dichiarato
            cap: { folder: null, alternative: null, scelta: -1, stato: 'fermo', prog: null, log: [], esito: null, stima: null, errore: null },
            piano: null, plan: { stato: 'fermo', msg: '', errore: null, avviso: null, origine: null }, granularita: 'atomico',
            lingua: 'it',                               // lingua parlata nei media (vedi LINGUE)
            linguaOut: 'it',                            // lingua in cui scrivere il corso (vedi LINGUE_OUT)
            sch: { stato: 'fermo', fatte: 0, totale: 0, mancanti: [], corrente: '', righe: [], errore: null } };
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var toast = function (m, ok) { if (typeof window.toast === 'function') window.toast(m, ok); };

  var STEPS = ['Progetto', 'Materiali', 'Elaborazione', 'Analisi', 'Indice dei corsi', 'Capitoli'];
  /* Il ruolo di una fonte è la sola cosa che il file non dice di sé: un PDF non
     sa se è la dispensa ufficiale del corso o i tuoi appunti presi a lezione.
     «ufficiale» è il caso normale e non si scrive: si dichiarano le eccezioni. */
  var RUOLI = [
    ['', 'materiale ufficiale del corso'],
    ['integrazione', 'fonte esterna aggiunta da me'],
    ['appunti', 'appunti personali'],
    ['riferimento', 'da consultare, non da studiare']
  ];
  /* La lingua PARLATA nei video e negli audio — non quella del corso, che resta
     l'italiano in ogni caso. Va dichiarata perché Whisper, con la lingua sbagliata,
     non fallisce in modo visibile: traduce i suoni in parole plausibili della lingua
     imposta e restituisce un testo scorrevole e del tutto inventato. */
  var LINGUE = [
    ['it', 'italiano'], ['en', 'inglese'], ['fr', 'francese'], ['de', 'tedesco'],
    ['es', 'spagnolo'], ['pt', 'portoghese'], ['auto', 'riconoscila dall\'audio']
  ];
  /* La lingua in cui il modello SCRIVE il corso: un'altra cosa dalla precedente.
     Non ha «auto»: una lingua di uscita va decisa, non indovinata. L'elenco
     rispecchia lib/lingua.js, che è dove la scelta diventa un'istruzione. */
  var LINGUE_OUT = [
    ['it', 'italiano'], ['en', 'inglese'], ['fr', 'francese'],
    ['de', 'tedesco'], ['es', 'spagnolo'], ['pt', 'portoghese']
  ];
  /** Il nome per esteso di un codice di lingua, cercato in entrambi gli elenchi. */
  function nomeLingua(codice) {
    var t = LINGUE.concat(LINGUE_OUT).find(function (l) { return l[0] === codice; });
    return t ? t[1] : codice;
  }

  /* ---- ascolto dell'ingest: registrato UNA VOLTA a livello di modulo ----
     I due onDone già esistenti nel renderer non sono rimovibili e continuano a
     funzionare: qui non li tocchiamo, ci limitiamo a reagire solo quando è il
     wizard ad aver avviato l'elaborazione (flag W.ing.stato === 'in-corso'). */
  if (window.vault && window.vault.ingest) {
    window.vault.ingest.onProgress(function (d) {
      if (W.ing.stato !== 'in-corso' || !d) return;
      if (d.indeterminate) { W.ing.msg = d.msg || 'Preparazione…'; W.ing.frazione = -1; }
      else {
        if (typeof d.fraction === 'number') W.ing.frazione = d.fraction;
        if (d.msg) W.ing.msg = d.msg;
        if (d.name) W.ing.file = (d.kind ? d.kind + ' · ' : '') + d.name;
        if (d.total) W.ing.msg = 'Materiale ' + (d.index || 0) + ' di ' + d.total;
      }
      pittaIngest();
    });
    window.vault.ingest.onLog(function (l) {
      if (W.ing.stato !== 'in-corso') return;
      W.ing.log.push(String(l)); if (W.ing.log.length > 60) W.ing.log.shift();
      pittaIngest();
    });
    window.vault.ingest.onError(function (m) {
      if (W.ing.stato !== 'in-corso') return;
      W.ing.stato = 'errore'; W.ing.errore = String(m || 'errore sconosciuto');
      fineIngest();
    });
    window.vault.ingest.onDone(function (d) {
      if (W.ing.stato !== 'in-corso') return;
      var ok = !d || (d.code === 0 && !d.fatal);
      if (ok) { W.ing.stato = 'fatto'; W.ing.frazione = 1; W.ing.msg = 'Elaborazione completata'; }
      else { W.ing.stato = 'errore'; W.ing.errore = (d && d.fatal) || ('il processo è uscito con codice ' + (d && d.code)); }
      fineIngest();
    });
  }
  function fineIngest() {
    document.documentElement.dataset.wizingest = '';
    if (window.vault.corpus) window.vault.corpus.list(W.progetto).then(function (c) { W.corpus = c || []; pitta(); });
    else pitta();
    toast(W.ing.stato === 'fatto' ? 'Elaborazione completata' : 'Elaborazione interrotta: ' + W.ing.errore, W.ing.stato === 'fatto');
  }
  function pitta() { if (!$('#wizard').hidden && W.step === 2) render(); }
  // durante l'elaborazione arrivano molte righe al secondo: si ridisegna al massimo una volta per frame
  // NB: setTimeout e non requestAnimationFrame — rAF viene sospeso quando la finestra
  // è in secondo piano, e l'elaborazione è proprio il momento in cui si guarda altrove
  var attesa = false;
  function pittaIngest() {
    if (attesa) return;
    attesa = true;
    setTimeout(function () { attesa = false; pitta(); }, 120);
  }

  /**
   * Apre il wizard. Con `passo` lo riapre a metà strada.
   *
   * Un progetto con i materiali dentro ma nessun corso era finora irraggiungibile:
   * non compariva negli elenchi (che filtravano per corsi), «+ Nuovo progetto»
   * ricominciava sempre da zero, e il pannello «Estendi» nasconde i suoi comandi
   * quando i corsi sono zero. L'unica via d'uscita era rifare il progetto — ed è
   * così che ne nascono quattro uguali.
   */
  function open(progetto, passo) {
    W.step = 0; W.progetto = progetto || null; W.importati = []; W.daImportare = [];
    W.imp = { cartella: null, piano: null, forzati: [], stato: 'fermo', errore: null };
    W.fonti = {};
    // la lingua dei media è una preferenza tecnica del vault: sopravvive alla chiusura
    // del wizard, perché in un corpus i materiali parlano quasi sempre la stessa lingua
    try {
      var pr = (window.vault && window.vault.prefs && window.vault.prefs.read()) || {};
      W.lingua = pr.lingua || 'it'; W.linguaOut = pr.linguaOutput || 'it';
    } catch (e) { W.lingua = 'it'; W.linguaOut = 'it'; }
    $('#wizard').hidden = false;
    if (W.progetto && window.vault.brief) {
      window.vault.brief.get(W.progetto).then(function (b) {
        W.brief = b || {}; W.fonti = (b && b.fonti) || {};
        if (passo > 0) vaiAPasso(passo); else render();
      });
    } else { W.brief = {}; render(); }
  }

  /**
   * Salta a un passo caricandone i dati.
   *
   * Ogni pannello vive di quello che `avanti()` gli carica strada facendo: il
   * passo 2 ha bisogno del corpus, il 3 dello stato delle schede, il 4 del piano.
   * Arrivandoci di lato quei dati mancherebbero, e il pannello direbbe «nessun
   * materiale» su un progetto pieno. Qui si caricano tutti quelli dei passi
   * attraversati, non solo del passo d'arrivo: indietro si può sempre tornare.
   */
  function vaiAPasso(n) {
    W.step = Math.max(0, Math.min(STEPS.length - 1, Number(n) || 0));
    render();
    if (W.step >= 2 && window.vault.corpus) {
      window.vault.corpus.list(W.progetto).then(function (c) { W.corpus = c || []; render(); });
    }
    if (W.step >= 3) caricaStatoSchede();
    if (W.step >= 4 && window.vault.plan) {
      window.vault.plan.get(W.progetto).then(function (p) {
        if (p && p.corsi) { W.piano = p; W.granularita = p.granularity || W.granularita; W.plan.origine = p.origine; render(); }
      });
    }
    if (W.step >= 5) caricaStatoCorsi();      // quanti capitoli ha già ogni corso
  }
  function close() {
    $('#wizard').hidden = true;
    // se l'elaborazione è in corso torna a mostrarsi la barra globale in fondo:
    // il processo prosegue anche a wizard chiuso e l'utente deve poterlo vedere
    if (W.ing.stato === 'in-corso') document.documentElement.dataset.wizingest = '';
    if (W.progetto) toast('Progetto «' + W.progetto + '» salvato: puoi riprendere quando vuoi', true);
  }

  var TITOLI = ['Nuovo progetto', 'Materiali di studio', 'Elaborazione dei materiali', 'Analisi dei contenuti', 'Indice dei corsi', 'Scrittura dei capitoli'];
  var PANNELLI = [step0, step1, step2, stepAnalisi, step3, step4];
  function render() {
    $('#wzSteps').textContent = 'Passo ' + (W.step + 1) + ' di ' + STEPS.length + ' · ' + STEPS[W.step];
    $('#wzTitle').textContent = TITOLI[W.step];
    $('#wzBack').disabled = (W.step === 0 || W.ing.stato === 'in-corso' || W.plan.stato === 'in-corso' || W.sch.stato === 'in-corso');
    $('#wzNext').textContent = W.step === 4 ? 'Approva l\'indice' : (W.step === 5 ? 'Chiudi' : 'Avanti');
    $('#wzNext').disabled = (W.ing.stato === 'in-corso' || W.plan.stato === 'in-corso' || W.sch.stato === 'in-corso' ||
      W.cap.stato === 'in-corso' || (W.step === 4 && !(W.piano && W.piano.corsi && W.piano.corsi.length)));
    ($('#wzBody')).innerHTML = PANNELLI[W.step]();
    if (W.step === 0) {
      var n = $('#wzNome'); if (n && !W.progetto) setTimeout(function () { n.focus(); }, 30);
    }
    aggiornaHint();
  }

  // ---------------------------------------------------------------- step 0
  function step0() {
    var b = W.brief || {};
    return '' +
      '<h3>Di che progetto si tratta</h3>' +
      '<p>Un progetto raccoglie i corsi che nascono dallo stesso materiale. Il nome diventa la cartella dentro <code>Progetti/</code>.</p>' +
      '<label class="f">Nome del progetto' +
      '<input type="text" id="wzNome" value="' + esc(b.title || W.progetto || '') + '"' + (W.progetto ? ' disabled' : '') + ' placeholder="Es. Tutor DSA — corso Galton"></label>' +
      '<label class="f">A cosa ti serve' +
      '<select id="wzObiettivo">' + opt(['', 'esame', 'professionale', 'curiosita'], ['— scegli —', 'Preparare un esame', 'Lavoro / formazione professionale', 'Interesse personale'], b.obiettivo) + '</select></label>' +
      '<label class="f">Cosa conta di più' +
      '<select id="wzPriorita">' + opt(['', 'comprensione', 'memorizzazione', 'applicazione'], ['— scegli —', 'Capire a fondo', 'Ricordare i contenuti', 'Saperli applicare'], b.priorita) + '</select></label>' +
      '<label class="f" style="margin-top:1.2rem;">Indicazioni per questo materiale <span style="font-weight:400;text-transform:none;letter-spacing:0;">(facoltative)</span>' +
      '<textarea id="wzIndicazioni" rows="3" placeholder="Es. la parte sui test standardizzati mi serve più approfondita del resto.">' + esc(b.indicazioni || '') + '</textarea></label>' +
      '<p>Queste indicazioni valgono <b>solo per questo progetto</b> e descrivono come trattare il materiale, non quali argomenti includere. Il tuo profilo generale sta in ⚙ Impostazioni › Utente.</p>';
  }
  function opt(valori, etichette, sel) {
    return valori.map(function (v, i) { return '<option value="' + esc(v) + '"' + (v === (sel || '') ? ' selected' : '') + '>' + esc(etichette[i]) + '</option>'; }).join('');
  }

  function salvaStep0() {
    var nome = (($('#wzNome') || {}).value || '').trim();
    var brief = {
      obiettivo: ($('#wzObiettivo') || {}).value || '',
      priorita: ($('#wzPriorita') || {}).value || '',
      indicazioni: ($('#wzIndicazioni') || {}).value || ''
    };
    W.brief = Object.assign({}, W.brief, brief, { title: nome });
    if (W.progetto) return window.vault.brief.set(W.progetto, brief).then(function (r) {
      if (r && r.error) throw new Error(r.error);
      return W.progetto;
    });
    if (!nome) return Promise.reject(new Error('dai un nome al progetto'));
    return window.vault.project.create(nome, brief).then(function (r) {
      if (r && r.error) throw new Error(r.error);
      W.progetto = r.id;
      // il brief va riscritto dopo la creazione: project:create scrive il file, brief:set fa l'upsert dei campi
      return window.vault.brief.set(W.progetto, brief).then(function () { return W.progetto; });
    });
  }

  // ---------------------------------------------------------------- step 1
  function step1() {
    if (W.imp.piano) return anteprimaCartella();
    var righe = W.importati.map(function (f) {
      return '<li>' + (f.error
        ? '<span class="err">✗ ' + esc(f.src.split('/').pop()) + ' — ' + esc(f.error) + '</span>'
        : '<span class="dest">' + esc(f.sub) + '</span><span>' + esc(f.name) + '</span>') + '</li>';
    }).join('');
    return '' +
      '<h3>Porta dentro i materiali</h3>' +
      '<p>Se hai già raccolto tutto in una cartella — anche divisa in sottocartelle come <code>MEDIA</code>, <code>PDF</code>, <code>HTML</code>, <code>SOTTOTITOLI</code> — dalla a StudIA: legge com\'è fatta e propone dove va ogni file. I file vengono <b>copiati</b>: gli originali restano dove sono.</p>' +
      '<button type="button" class="wz-btn primary" id="wzCartella">Importa una cartella…</button> ' +
      '<button type="button" class="wz-btn" id="wzPick">Scegli singoli file…</button> ' +
      '<span class="wz-hint">' + (W.importati.length ? W.importati.filter(function (f) { return !f.error; }).length + ' importati' : 'nessun file ancora importato') + '</span>' +
      (W.imp.errore ? '<div class="wz-errore">' + esc(W.imp.errore) + '</div>' : '') +
      (righe ? '<ul class="wz-files">' + righe + '</ul>' : '');
  }

  /** L'anteprima: che cosa entra, con che nome, e che cosa resta fuori e perché. */
  function anteprimaCartella() {
    var p = W.imp.piano, r = p.riepilogo;
    var sigla = function (s) { return s ? s.replace(/^0+(?=\d)/, '') : '—'; };

    var mats = p.materiali.map(function (m) {
      var ab = m.abbinati.map(function (a) {
        return '<li class="wz-sub"><span class="dest">abbinato</span>' +
          '<span>' + esc(a.nome) + '</span><span class="wz-hint">→ ' + esc(a.dir) + '/</span></li>';
      }).join('');
      return '<li><span class="dest">' + m.num + ' · ' + esc(m.tipo) + '</span>' +
        '<span class="wc-chip">' + esc(sigla(m.sigla)) + '</span>' +
        '<span style="flex:1">' + esc(m.nome) + '</span>' +
        '<span class="wz-hint">→ ' + esc(m.dir) + '/</span></li>' + ab;
    }).join('');

    // gli scarti si contano per motivo: 173 righe di asset non servono a nessuno
    var perMotivo = {};
    p.esclusi.forEach(function (e) { (perMotivo[e.motivo] = perMotivo[e.motivo] || []).push(e); });
    var scarti = Object.keys(perMotivo).map(function (motivo) {
      var lista = perMotivo[motivo], rib = lista.filter(function (e) { return e.ribaltabile; });
      var voci = rib.map(function (e) {
        return '<li class="wz-sub"><span style="flex:1">' + esc(e.nome) + '</span>' +
          '<button type="button" class="wz-rip" data-rel="' + esc(e.origine || e.rel) + '">riprendilo</button></li>';
      }).join('');
      return '<li><span style="flex:1">' + lista.length + ' × ' + esc(motivo) + '</span></li>' + voci;
    }).join('');

    return '' +
      '<h3>Ecco che cosa ho capito</h3>' +
      '<p class="wz-hint" style="word-break:break-all">' + esc(W.imp.cartella) + '</p>' +
      '<div class="wz-ok"><b>' + r.materiali + ' materiali</b> — ' + r.media + ' video, ' + r.pdf + ' PDF, ' + r.html + ' pagine web' +
      (r.trascrizioniAbbinate ? '; <b>' + r.trascrizioniAbbinate + ' trascrizioni già pronte</b> abbinate ai rispettivi video (Whisper darà i minutaggi, il testo ufficiale la terminologia esatta)' : '') +
      '. Il numero davanti al nome è quello con cui il lettore costruirà i rimandi al minuto e alla pagina.</div>' +
      '<ul class="wz-files wz-imp">' + mats + '</ul>' +
      (p.esclusi.length ? '<p style="margin-top:.9rem"><b>Restano fuori ' + p.esclusi.length + ' file.</b></p><ul class="wz-files wz-imp">' + scarti + '</ul>' : '') +
      '<div style="margin-top:1rem">' +
      '<button type="button" class="wz-btn primary" id="wzImpOk"' + (W.imp.stato === 'copia' ? ' disabled' : '') + '>' +
      (W.imp.stato === 'copia' ? 'Copio…' : 'Importa questi ' + r.materiali + ' materiali') + '</button> ' +
      '<button type="button" class="wz-btn" id="wzImpNo">Scegli un\'altra cartella</button>' +
      '</div>';
  }

  function scegliCartella() {
    if (!window.vault.cartella) return;
    W.imp.errore = null;
    window.vault.cartella.pick().then(function (dir) {
      if (!dir) return;
      W.imp.cartella = dir; W.imp.forzati = [];
      return riesaminaCartella();
    }).catch(function (e) { W.imp.errore = e.message; render(); });
  }

  function riesaminaCartella() {
    return window.vault.cartella.scan(W.imp.cartella, W.imp.forzati, W.progetto).then(function (p) {
      if (p && p.error) { W.imp.errore = p.error; W.imp.piano = null; }
      else { W.imp.piano = p; W.imp.errore = null; }
      render();
    });
  }

  /** Un file ripescato dagli scarti: si ripianifica, così la numerazione resta coerente. */
  function ripesca(rel) {
    if (!rel || W.imp.forzati.indexOf(rel) >= 0) return;
    W.imp.forzati.push(rel);
    riesaminaCartella();
  }

  function applicaCartella() {
    W.imp.stato = 'copia'; render();
    window.vault.cartella.apply(W.imp.cartella, W.imp.forzati, W.progetto).then(function (r) {
      W.imp.stato = 'fermo';
      if (r && r.error) { W.imp.errore = r.error; render(); return; }
      var esiti = (r && r.esiti) || [];
      // gli esiti entrano nella stessa lista dell'import a file singoli
      W.importati = W.importati.concat(esiti.map(function (e) {
        return e.errore
          ? { src: e.origine, error: e.errore }
          : { sub: String(e.dest).split('/')[0], name: String(e.dest).split('/').slice(1).join('/') };
      }));
      W.imp.piano = null; W.imp.cartella = null; W.imp.forzati = [];
      toast(r.importati + (r.importati === 1 ? ' materiale importato' : ' materiali importati'), true);
      render();
    }).catch(function (e) { W.imp.stato = 'fermo'; W.imp.errore = e.message; render(); });
  }

  function importa() {
    if (!window.vault.files) return;
    window.vault.files.pick().then(function (paths) {
      if (!paths || !paths.length) return;
      return window.vault.files.import(paths).then(function (r) {
        if (r && r.error) { toast('Importazione fallita: ' + r.error, false); return; }
        W.importati = W.importati.concat((r && r.esiti) || []);
        var ok = W.importati.filter(function (f) { return !f.error; }).length;
        toast(ok + (ok === 1 ? ' materiale importato' : ' materiali importati'), true);
        render();
      });
    }).catch(function (e) { toast('Importazione fallita: ' + e.message, false); });
  }

  // ---------------------------------------------------------------- step 2
  function step2() {
    var media = W.corpus.filter(function (m) { return m.tipo === 'media'; });
    var pdf = W.corpus.filter(function (m) { return m.tipo === 'pdf'; });
    var daFare = W.corpus.filter(function (m) { return !m.fatto; });
    var inCorso = W.ing.stato === 'in-corso';

    var h = '<h3>Trascrizione e indicizzazione</h3>' +
      '<p>I video e gli audio vengono trascritti in locale (nessun dato esce dal computer), i PDF indicizzati pagina per pagina. ' +
      'È il passo lungo: un video da 45 minuti richiede circa un minuto sulla GPU del Mac.</p>';

    if (!W.corpus.length) {
      return h + '<p><b>Nessun materiale nella cartella.</b> Torna indietro e importane qualcuno.</p>';
    }

    var web = W.corpus.filter(function (m) { return m.tipo === 'html'; });
    var conUff = media.filter(function (m) { return m.ufficiale; }).length;
    h += '<p><b>' + W.corpus.length + '</b> materiali in cartella: ' + media.length + ' fra video e audio, ' +
      pdf.length + ' PDF' + (web.length ? ', ' + web.length + ' pagine web' : '') + '. ' +
      (daFare.length ? '<b>' + daFare.length + '</b> ancora da elaborare.' : 'Sono già tutti elaborati.') + '</p>' +
      (conUff ? '<p class="wz-hint" style="display:block">' + conUff + ' video ' + (conUff === 1 ? 'ha' : 'hanno') +
        ' già la trascrizione dell\'autore: la trascrizione qui serve a ricavare i minutaggi per i rimandi al video.</p>' : '');

    if (!inCorso) {
      h += '<ul class="wz-files">' + W.corpus.map(function (m, i) {
        var sel = W.scelti ? W.scelti.indexOf(m.name) >= 0 : !m.fatto;
        return '<li>' +
          (m.tipo === 'media'
            ? '<input type="checkbox" class="wz-sel" data-name="' + esc(m.name) + '"' + (sel ? ' checked' : '') + '>'
            : '<span style="width:13px"></span>') +
          '<span class="dest">' + (m.tipo === 'pdf' ? 'PDF' : m.tipo === 'html' ? 'WEB' : 'MEDIA') + '</span>' +
          '<span style="flex:1">' + esc(m.name) + (m.ufficiale ? ' <span class="wc-chip">testo ufficiale</span>' : '') + '</span>' +
          '<select class="wz-ruolo" data-num="' + esc(m.num || '') + '"' + (m.num ? '' : ' disabled title="senza numero: non posso identificarlo"') + '>' +
          RUOLI.map(function (r) {
            return '<option value="' + esc(r[0]) + '"' + (r[0] === (W.fonti[m.num] || '') ? ' selected' : '') + '>' + esc(r[1]) + '</option>';
          }).join('') + '</select>' +
          '<span class="dest">' + (m.fatto ? '✓ fatto' : '— da fare') + '</span></li>';
      }).join('') + '</ul>' +
        '<p class="wz-hint" style="display:block;margin-top:.5rem;">PDF e pagine web vengono sempre indicizzati (sono veloci); la casella vale per video e audio. ' +
        'Il menu a destra dice <b>che ruolo</b> ha la fonte: è l\'unica cosa che il file non sa di sé, e l\'analisi la userà per pesare le fonti quando costruisce i corsi.</p>' +
        '<div class="setrow" style="margin-top:.9rem;">' +
        '<label class="wz-hint" for="wzLingua">Lingua parlata nei video e negli audio&nbsp;</label>' +
        '<select id="wzLingua">' + LINGUE.map(function (l) {
          return '<option value="' + esc(l[0]) + '"' + (l[0] === W.lingua ? ' selected' : '') + '>' + esc(l[1]) + '</option>';
        }).join('') + '</select>' +
        '</div>' +
        '<p class="wz-hint" style="display:block;margin-top:.35rem;">' +
        'Che cosa si sente nell\'audio. Se è sbagliata la trascrizione non dà errore: inventa parole plausibili nella lingua indicata, e non te ne accorgi finché non la leggi. ' +
        'Vale solo per video e audio — i PDF si leggono in qualunque lingua senza impostare niente.' +
        '</p>' +
        '<div class="setrow" style="margin-top:.7rem;">' +
        '<label class="wz-hint" for="wzLinguaOut">Lingua in cui scrivere il corso&nbsp;</label>' +
        '<select id="wzLinguaOut">' + LINGUE_OUT.map(function (l) {
          return '<option value="' + esc(l[0]) + '"' + (l[0] === W.linguaOut ? ' selected' : '') + '>' + esc(l[1]) + '</option>';
        }).join('') + '</select>' +
        '</div>' +
        '<p class="wz-hint" style="display:block;margin-top:.35rem;">' +
        'Vale per tutto quello che scrive il modello: schede, titoli dei corsi, capitoli, glossario, domande. ' +
        'Può essere diversa dalla lingua dei materiali — è il caso normale.' +
        (W.lingua !== 'auto' && W.lingua !== W.linguaOut
          ? ' Qui i materiali sono in <b>' + esc(nomeLingua(W.lingua)) + '</b> e il corso uscirà in <b>' + esc(nomeLingua(W.linguaOut)) + '</b>: ' +
            'i minutaggi e i numeri di pagina restano corretti (sono numeri), e le <b>citazioni testuali restano nella lingua della fonte</b>, ' +
            'perché tradurre le parole di un relatore e attribuirgliele falsifica la fonte.'
          : '') +
        '</p>' +
        /* UN comando solo, che dice su che cosa agisce. Prima erano due, e il
           secondo — «Rielabora tutto» — non voleva dire «rifai questo progetto»
           ma «rifai i materiali dell'intero vault»: è così che una lavorazione
           dell'OECD ha ritrascritto anche le quaranta lezioni sui DSA.
           Rifare un singolo materiale ora si chiede spuntandolo: se ne scegli
           uno già fatto, quello viene rifatto (vedi avviaIngest). */
        '<div style="display:flex;gap:.5rem;margin-top:.8rem;">' +
        '<button type="button" class="wz-btn primary" id="wzIngStart">' +
        (daFare.length ? 'Elabora i ' + daFare.length + ' materiali mancanti' : 'Rielabora i materiali scelti') +
        '</button>' +
        '</div>' +
        '<p class="wz-hint" style="display:block;margin-top:.4rem;">' +
        'Agisce solo su <b>' + esc(W.progetto || 'questo progetto') + '</b>. ' +
        'Le caselle sono già spuntate sui materiali da fare; se ne spunti uno già elaborato, quello viene rifatto.' +
        '</p>';
    } else {
      var pc = W.ing.frazione < 0 ? null : Math.round(W.ing.frazione * 100);
      h += '<div style="margin:.6rem 0 1rem;">' +
        '<div style="height:10px;background:color-mix(in srgb,var(--teal) 12%,var(--panel));overflow:hidden;">' +
        '<i style="display:block;height:100%;width:' + (pc === null ? 100 : pc) + '%;background:var(--teal-strong);opacity:' + (pc === null ? .35 : 1) + ';"></i></div>' +
        '<div class="wz-hint" style="display:block;margin-top:.4rem;">' + esc(W.ing.msg || 'Avvio…') + (pc === null ? '' : ' · ' + pc + '%') + '</div>' +
        (W.ing.file ? '<div class="wz-hint" style="display:block;">' + esc(W.ing.file) + '</div>' : '') +
        '</div>';
    }

    if (W.ing.errore) {
      h += '<div style="border-left:4px solid #b91c1c;background:color-mix(in srgb,#b91c1c 8%,var(--panel));padding:.6rem .8rem;margin-top:.8rem;">' +
        '<b style="font-size:12px;">Elaborazione interrotta</b>' +
        '<div style="font-size:12px;line-height:1.5;margin-top:.3rem;">' + esc(W.ing.errore) + '</div>' +
        '<div class="wz-hint" style="display:block;margin-top:.4rem;">Il dettaglio completo è in <code>Trascrizioni/_ingest.log</code> dentro la cartella StudIA.</div>' +
        '</div>';
    } else if (W.ing.stato === 'fatto') {
      h += '<div style="border-left:4px solid var(--teal-strong);background:color-mix(in srgb,var(--teal) 10%,var(--panel));padding:.6rem .8rem;margin-top:.8rem;font-size:13px;">' +
        'Elaborazione completata. Il passo successivo — la proposta dell\'indice dei corsi — arriva con la prossima parte del wizard.</div>';
    }

    if (W.ing.log.length) {
      h += '<details style="margin-top:.9rem;"><summary class="wz-hint" style="cursor:pointer;">Registro (' + W.ing.log.length + ' righe)</summary>' +
        '<pre style="font-size:11px;line-height:1.4;max-height:160px;overflow:auto;background:var(--hover);padding:.5rem;margin:.4rem 0 0;">' +
        esc(W.ing.log.slice(-25).join('\n')) + '</pre></details>';
    }
    return h;
  }

  /* I media spuntati, letti dal DOM. Va richiamata PRIMA di ogni render() dello
     step 2: il pannello si ricostruisce da capo, e senza fissare la scelta in
     W.scelti le caselle tornerebbero al loro stato di partenza. */
  function selezioneMedia() {
    return Array.prototype.slice.call(document.querySelectorAll('.wz-sel:checked'))
      .map(function (c) { return c.getAttribute('data-name'); });
  }

  /**
   * Avvia l'elaborazione dei materiali SCELTI, dentro il progetto corrente.
   *
   * Il «rifai» non è più un comando a sé: si deduce dalla scelta. Se fra i
   * materiali spuntati ce n'è almeno uno già elaborato, vuol dire che lo si
   * vuole rifare, e si passa `force`. Così rifare una trascrizione venuta male
   * costa una spunta, invece di un pulsante che rifaceva tutto il vault.
   */
  function avviaIngest() {
    if (!window.vault.ingest) { toast('Elaborazione disponibile solo nell\'app', false); return; }
    var scelti = selezioneMedia();
    var giaFatti = W.corpus.filter(function (m) { return m.fatto && scelti.indexOf(m.name) >= 0; });
    var force = giaFatti.length > 0;
    W.scelti = scelti;
    var media = W.corpus.filter(function (m) { return m.tipo === 'media'; });
    /* I documenti non hanno casella — si indicizzano sempre — quindi «nessun media
       spuntato» non vuol dire «niente da fare»: può esserci un PDF che aspetta.
       Prima si rifiutava lo stesso, e l'unica strada rimasta era «Rielabora tutto»,
       che per indicizzare sette PDF avrebbe ritrascritto quaranta video.
       Con `files` vuoto non si passa nessun --only, e ingest elabora ciò che manca. */
    var docDaFare = W.corpus.filter(function (m) { return m.tipo !== 'media' && !m.fatto; });
    if (!force && !scelti.length && !docDaFare.length) {
      toast(media.length ? 'Spunta i video o gli audio da elaborare'
                         : 'Non c\'è niente di nuovo da elaborare', false);
      return;
    }
    W.ing = { stato: 'in-corso', frazione: -1, msg: 'Avvio…', file: '', log: [], errore: null };
    document.documentElement.dataset.wizingest = '1';   // nasconde la barra globale: qui il progresso è nel wizard
    render();
    window.vault.ingest.start(force ? { force: true, lang: W.lingua, progetto: W.progetto } : { files: scelti, lang: W.lingua, progetto: W.progetto });
  }

  // ------------------------------------------------------------ step Analisi
  // Stadio 0: un agente legge ogni materiale per intero e ne scrive la scheda.
  // È la lettura che rende possibile un'architettura di qualità: senza schede,
  // l'indice si costruisce sulle sole parole chiave.

  function stepAnalisi() {
    var s = W.sch, inCorso = s.stato === 'in-corso';
    var h = '<h3>Lettura dei materiali</h3>' +
      '<p>Ogni materiale viene letto per intero dal modello, che ne scrive una scheda: di cosa tratta, i temi in sequenza con i minutaggi o le pagine, i concetti, i prerequisiti e i capitoli proposti. ' +
      'Le schede restano nel progetto: si pagano una volta e servono poi all\'indice e alla generazione.</p>';

    if (s.totale) {
      h += '<p><b>' + s.fatte + '</b> material' + (s.fatte === 1 ? 'e letto' : 'i letti') + ' su ' + s.totale +
        (s.mancanti.length ? ' · mancano: ' + s.mancanti.slice(0, 8).map(function (m) { return m.num || '?'; }).join(', ') + (s.mancanti.length > 8 ? '…' : '') : ' · nessuno mancante') + '</p>';
      var pc = s.totale ? Math.round(s.fatte / s.totale * 100) : 0;
      h += '<div style="height:10px;background:color-mix(in srgb,var(--teal) 12%,var(--panel));overflow:hidden;margin:.4rem 0 .8rem;">' +
        '<i style="display:block;height:100%;width:' + pc + '%;background:var(--teal-strong);"></i></div>';
    }

    if (!inCorso) {
      h += '<div style="display:flex;gap:.5rem;">' +
        '<button type="button" class="wz-btn primary" id="wzSchede">' + (s.fatte ? 'Leggi i materiali mancanti' : 'Analizza i materiali') + '</button>' +
        (s.fatte ? '<button type="button" class="wz-btn" id="wzSchedeTutto">Rileggi tutto</button>' : '') +
        '</div>';
    } else {
      h += '<p class="wz-hint">' + esc(s.corrente || 'Avvio…') + '</p>';
    }

    if (s.errore) h += '<div class="wz-errore">Analisi non riuscita: ' + esc(s.errore) + '</div>';
    if (s.righe.length) {
      h += '<ul class="wz-files">' + s.righe.slice(-14).map(function (r) {
        return '<li><span class="dest">' + esc(r.num || '--') + '</span><span style="flex:1">' + esc(r.titolo || '') + '</span>' +
          '<span class="' + (r.stato && r.stato.indexOf('errore') === 0 ? 'err' : 'dest') + '">' + esc(r.stato) + '</span></li>';
      }).join('') + '</ul>';
    }
    if (s.fatte && s.fatte >= s.totale && s.totale) {
      h += '<div class="wz-ok">Tutti i materiali sono stati letti. Il passo successivo costruisce l\'architettura dei corsi a partire dalle schede.</div>';
    }
    return h;
  }

  function caricaStatoSchede() {
    if (!window.vault.schede) return;
    window.vault.schede.stato(W.progetto).then(function (st) {
      W.sch.totale = st.totale; W.sch.fatte = st.fatte; W.sch.mancanti = st.mancanti || [];
      if (W.step === 3) render();
    });
  }

  function avviaSchede(rifai) {
    if (!window.vault.schede) { toast('Analisi disponibile solo nell\'app', false); return; }
    W.sch.stato = 'in-corso'; W.sch.errore = null; W.sch.righe = []; W.sch.corrente = 'Avvio…';
    render();
    window.vault.schede.build(W.progetto, !!rifai);
  }

  // ---------------------------------------------------------------- step 3
  // Editor dell'indice: azioni esplicite a bottoni, niente trascinamento.

  /** Elenco dei corsi con i loro materiali e i comandi di modifica. */
  function elencoCorsi() {
    var corsi = (W.piano && W.piano.corsi) || [];
    return corsi.map(function (c, i) {
      return '<li class="wz-corso">' +
        '<div class="wc-testa">' +
        '<span class="wc-num">' + (i + 1) + '</span>' +
        '<input type="text" class="wc-titolo" data-i="' + i + '" value="' + esc(c.title) + '" aria-label="Titolo del corso">' +
        '</div>' +
        '<div class="wc-mat">' + c.materiali.map(function (m) {
          return '<span class="wc-chip" title="' + esc(m.source) + '">' + (m.num || '?') + ' · ' + (m.type === 'pdf' ? 'PDF' : 'video') + '</span>';
        }).join('') + '</div>' +
        (c.rationale ? '<div class="wc-perche">' + esc(c.rationale) + '</div>' : '') +
        '<div class="wc-cmd">' +
        cmd(i, 'su', '↑', 'Sposta il corso più in alto', i === 0) +
        cmd(i, 'giu', '↓', 'Sposta il corso più in basso', i === corsi.length - 1) +
        cmd(i, 'unisci', 'Unisci col successivo', '', i === corsi.length - 1) +
        cmd(i, 'separa', 'Separa l\'ultimo materiale', '', c.materiali.length < 2) +
        cmd(i, 'giu-mat', 'Passa l\'ultimo al corso dopo', '', i === corsi.length - 1 || c.materiali.length < 2) +
        '</div></li>';
    }).join('');
  }
  function cmd(i, azione, testo, titolo, disabilitato) {
    return '<button type="button" class="wc-btn" data-az="' + azione + '" data-i="' + i + '"' +
      (titolo ? ' title="' + esc(titolo) + '"' : '') + (disabilitato ? ' disabled' : '') + '>' + testo + '</button>';
  }

  function step3() {
    var inCorso = W.plan.stato === 'in-corso';
    var h = '<h3>Proposta dell\'indice</h3>' +
      '<p>I materiali vengono raggruppati in corsi. La proposta è un punto di partenza: correggila finché ti somiglia, poi approvala. ' +
      'Solo allora vengono create le cartelle sul disco.</p>';

    h += '<div class="setrow" style="margin-bottom:.8rem;">' +
      '<label class="wz-hint">Grana&nbsp;' +
      '<select id="wzGran">' +
      ['atomico', 'medio', 'ampio'].map(function (g) {
        var et = { atomico: 'fine — molti corsi piccoli', medio: 'media', ampio: 'larga — pochi corsi grandi' }[g];
        return '<option value="' + g + '"' + (W.granularita === g ? ' selected' : '') + '>' + et + '</option>';
      }).join('') + '</select></label>' +
      '<button type="button" class="wz-btn" id="wzProponi"' + (inCorso ? ' disabled' : '') + '>' +
      (W.piano ? 'Rifai la proposta' : 'Proponi l\'indice') + '</button>' +
      '</div>';

    if (inCorso) h += '<p class="wz-hint">' + esc(W.plan.msg || 'Sto lavorando…') + '</p>';
    if (W.plan.errore) h += '<div class="wz-errore">Proposta non riuscita: ' + esc(W.plan.errore) + '</div>';
    if (W.plan.avviso) h += '<div class="wz-avviso">' + esc(W.plan.avviso) + '</div>';

    if (W.piano && W.piano.corsi && W.piano.corsi.length) {
      var nMat = W.piano.corsi.reduce(function (s, c) { return s + c.materiali.length; }, 0);
      h += '<p class="wz-hint" style="display:block;margin:.6rem 0;">' + W.piano.corsi.length + ' corsi · ' + nMat + ' materiali collocati' +
        (W.plan.origine === 'ai' ? ' · proposta rivista dal modello' : ' · proposta euristica locale') + '</p>';
      h += '<ul class="wz-corsi">' + elencoCorsi() + '</ul>';
    } else if (!inCorso && !W.plan.errore) {
      h += '<p>Nessuna proposta ancora. Premi «Proponi l\'indice».</p>';
    }
    return h;
  }

  /** Applica un comando dell'editor al piano in memoria e salva. */
  function comandoPiano(azione, i) {
    var c = W.piano && W.piano.corsi; if (!c || !c[i]) return;
    if (azione === 'su' && i > 0) { var t = c[i - 1]; c[i - 1] = c[i]; c[i] = t; }
    else if (azione === 'giu' && i < c.length - 1) { var u = c[i + 1]; c[i + 1] = c[i]; c[i] = u; }
    else if (azione === 'unisci' && i < c.length - 1) {
      c[i].materiali = c[i].materiali.concat(c[i + 1].materiali);
      c[i].rationale = 'Unito a mano con «' + c[i + 1].title + '».';
      c.splice(i + 1, 1);
    } else if (azione === 'separa' && c[i].materiali.length > 1) {
      var ultimo = c[i].materiali.pop();
      c.splice(i + 1, 0, { folder: '', title: (ultimo.num ? ultimo.num + ' ' : '') + (ultimo.titolo || ultimo.source).toUpperCase().slice(0, 80),
        area: c[i].area || '', rationale: 'Separato a mano da «' + c[i].title + '».', status: 'proposto', materiali: [ultimo], capitoli: [] });
    } else if (azione === 'giu-mat' && i < c.length - 1 && c[i].materiali.length > 1) {
      c[i + 1].materiali.unshift(c[i].materiali.pop());
    }
    rinumera();
    salvaPiano();
    render();
  }

  /** Le cartelle devono restare NN-slug progressive: si rinumerano dopo ogni modifica. */
  function rinumera() {
    if (!W.piano) return;
    W.piano.corsi.forEach(function (c, i) {
      var base = String(c.title || 'corso').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/^\s*\d{1,3}(\s*-\s*\d{1,3})?[\s.:·-]*/, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-+$/, '') || 'corso';
      c.folder = String(i + 1).padStart(2, '0') + '-' + base;
    });
  }

  function salvaPiano() {
    if (!W.piano || !window.vault.plan) return;
    window.vault.plan.save(W.progetto, W.piano).then(function (r) {
      if (r && r.error) toast('Piano non salvato: ' + r.error, false);
    });
  }

  function chiediProposta() {
    if (!window.vault.plan) { toast('Proposta disponibile solo nell\'app', false); return; }
    W.plan = { stato: 'in-corso', msg: 'Preparo il digest dei materiali…', errore: null, avviso: null, origine: null };
    render();
    window.vault.plan.propose(W.progetto, W.granularita);
  }

  // ---------------------------------------------------------------- step 5
  /* I capitoli si scrivono un corso per volta. Prima si sceglie il corso, poi si
     confrontano due o tre scalette alternative: cambiano ordine e raggruppamento,
     mai la copertura del materiale. Il costo si vede prima di spendere. */
  /* Quanti capitoli ha DAVVERO ogni corso, contati sul disco.
     Il piano dice il suo, ma è un registro che si può disallineare — ed è già
     successo. Le cartelle no: se ci sono cinque file .md, i capitoli sono
     cinque. La spunta si fida di quelle. */
  function caricaStatoCorsi() {
    if (!W.progetto || !window.vault.project || !window.vault.project.expandStato) return;
    window.vault.project.expandStato(W.progetto).then(function (r) {
      if (!r || r.error) return;
      var m = {};
      (r.corsi || []).forEach(function (c) { m[c.folder] = c.capitoli || 0; });
      W.cap.perCorso = m;
      if (!$('#wizard').hidden && W.step === 5) render();
    }).catch(function () {});
  }

  function step4() {
    var corsi = (W.piano && W.piano.corsi) || [];
    if (!corsi.length) return '<h3>Nessun corso approvato</h3><p>Torna indietro e approva l\'indice.</p>';

    if (!W.cap.folder) {
      var perCorso = W.cap.perCorso || null;
      var scritti = corsi.filter(function (c) { return perCorso && perCorso[c.folder] > 0; }).length;
      return '<h3>Da quale corso partiamo?</h3>' +
        '<p>I capitoli si scrivono un corso per volta: così puoi leggere il primo e correggere il tiro prima di spendere sul resto.</p>' +
        /* L'altra strada: guardare TUTTI gli indici proposti insieme prima di
           scrivere qualunque cosa. Serve quando dallo stesso materiale devono
           nascere più percorsi — non è un modo più veloce di fare la stessa cosa. */
        '<div class="wz-ok" style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap;">' +
        '<span style="flex:1;min-width:220px">Vuoi prima <b>vedere tutti gli indici insieme</b> e assegnarli a più percorsi ' +
        '(stesso livello, modi di imparare diversi)? Il composer mostra una riga per corso e le sue proposte affiancate.</span>' +
        '<button type="button" class="wz-btn" id="wzComposer">Apri il composer</button></div>' +
        (perCorso
          ? '<p class="wz-hint" style="display:block">' + (scritti
              ? '<b>' + scritti + '</b> corsi su ' + corsi.length + ' hanno già i capitoli scritti. Rifarli li riscrive da capo: serve a provare un taglio diverso sullo stesso materiale.'
              : 'Nessun corso ha ancora i capitoli.') + '</p>'
          : '') +
        '<ul class="wz-files">' + corsi.map(function (c) {
          // la verità sta nella cartella; il piano è solo il ripiego se il conteggio non è ancora arrivato
          var n = perCorso ? (perCorso[c.folder] || 0)
                           : ((c.status === 'generato' || c.status === 'parziale') ? -1 : 0);
          var fatto = n !== 0;
          return '<li><span class="dest">' + esc(c.folder.slice(0, 2)) + '</span>' +
            '<span style="flex:1">' + esc(c.title) + ' <span class="wz-hint">(' + (c.materiali || []).length + ' materiali)</span></span>' +
            (fatto
              ? '<span class="dest">✓ ' + (n > 0 ? n + ' capitol' + (n === 1 ? 'o' : 'i') : esc(c.status)) + '</span>'
              : '<span class="wz-hint">da scrivere</span>') +
            '<button type="button" class="wc-btn wz-corso-scelto" data-folder="' + esc(c.folder) + '">' +
            (fatto ? 'riscrivi' : 'scrivi i capitoli') + '</button></li>';
        }).join('') + '</ul>';
    }

    var corso = corsi.filter(function (c) { return c.folder === W.cap.folder; })[0] || {};
    var h = '<h3>' + esc(corso.title || W.cap.folder) + '</h3>';
    if (W.cap.errore) h += '<div class="wz-errore">' + esc(W.cap.errore) + '</div>';

    // 1. le alternative non ci sono ancora
    if (!W.cap.alternative) {
      return h + '<p>Lo stesso materiale si può insegnare in modi diversi, tutti legittimi. Chiedo <b>due o tre scalette alternative</b> e ti dico in una frase che cosa cambia per te fra l\'una e l\'altra.</p>' +
        '<p class="wz-hint" style="display:block">Le tue preferenze di forma valgono per tutte: non sono una delle variabili in gioco.</p>' +
        '<div style="margin-top:1rem">' +
        '<button type="button" class="wz-btn primary" id="wzScalette"' + (W.cap.stato === 'scalette' ? ' disabled' : '') + '>' +
        (W.cap.stato === 'scalette' ? 'Ci penso…' : 'Proponi le scalette') + '</button> ' +
        '<button type="button" class="wz-btn" id="wzAltroCorso">Cambia corso</button></div>';
    }

    // 2. confronto e scelta
    h += '<p>' + W.cap.alternative.length + ' modi di organizzare lo stesso materiale. Leggi la differenza, non i titoli.</p>';
    h += '<ul class="wz-corsi">' + W.cap.alternative.map(function (a, i) {
      var sel = W.cap.scelta === i;
      return '<li class="wz-corso" style="' + (sel ? 'border-color:var(--teal-strong)' : '') + '">' +
        '<div class="wc-testa"><span class="wc-num">' + (i + 1) + '</span>' +
        '<b style="flex:1">' + esc(a.nome) + '</b>' +
        '<span class="wc-chip">' + a.capitoli.length + ' capitoli</span>' +
        (a.completa ? '' : '<span class="wc-chip" style="background:color-mix(in srgb,#b91c1c 12%,var(--panel));color:#b91c1c">manca ' + esc(a.mancanti.join(', ')) + '</span>') +
        '</div>' +
        '<p class="wc-perche"><b>Cosa cambia per te:</b> ' + esc(a.differenza) + (a.adattaA ? ' <i>Adatta a: ' + esc(a.adattaA) + '.</i>' : '') + '</p>' +
        '<ol class="wz-hint" style="display:block;margin:.3rem 0 .5rem 1.1rem;padding:0">' +
        a.capitoli.map(function (c) { return '<li>' + esc(c.titolo) + '</li>'; }).join('') + '</ol>' +
        '<div class="wc-cmd"><button type="button" class="wc-btn wz-alt" data-i="' + i + '">' +
        (sel ? '✓ scelta' : 'scegli questa') + '</button></div></li>';
    }).join('') + '</ul>';

    // 3. costo e scrittura
    if (W.cap.scelta >= 0) {
      var alt = W.cap.alternative[W.cap.scelta];
      var s = W.cap.stima;
      h += '<div class="wz-ok"><b>' + alt.capitoli.length + ' capitoli</b> da scrivere con ' +
        esc((s && s.modello) || 'il modello scelto') +
        (s && typeof s.costoUsd === 'number' ? '. Costo stimato: <b>circa $' + s.costoUsd.toFixed(2) + '</b>' :
          '. Costo non stimabile per questo modello: non è a listino.') +
        '. Ogni capitolo viene validato e, se non passa, riscritto una volta.</div>';
    }
    if (W.cap.stato === 'in-corso') {
      var p = W.cap.prog || {};
      var perc = Math.round((p.frazione || 0) * 100);
      h += '<div class="wz-avviso">Scrivo il capitolo ' + (p.indice || 1) + ' di ' + (p.totale || '?') + ': «' + esc(p.titolo || '') + '»</div>' +
        '<div style="height:6px;background:var(--line);margin:.4rem 0"><div style="height:6px;width:' + perc + '%;background:var(--teal-strong)"></div></div>';
    }
    if (W.cap.log.length) {
      h += '<ul class="wz-files">' + W.cap.log.slice(-12).map(function (l) {
        return '<li><span' + (/^✗/.test(l) ? ' class="err"' : '') + '>' + esc(l) + '</span></li>';
      }).join('') + '</ul>';
    }
    if (W.cap.accoda) {
      h += '<div class="wz-ok">Il corso ha gi\u00e0 <b>' + (W.cap.giaScritti || 0) + '</b> capitoli: i nuovi partiranno dal <b>' +
        (W.cap.daOrdine || '?') + '\u00b0</b> e si aggiungeranno in fondo. Nessun capitolo esistente viene rinumerato o riscritto.</div>';
    }
    if (W.cap.esito) {
      var e = W.cap.esito;
      h += '<div class="' + (e.scarti.length ? 'wz-avviso' : 'wz-ok') + '">' +
        '<b>' + e.scritti.length + ' capitoli scritti</b>' +
        (e.scarti.length ? ', ' + e.scarti.length + ' scartati e messi in <code>_scarti/</code> con il motivo accanto' : '') +
        '. Chiudi il wizard per leggerli nel lettore.</div>';
    }
    h += '<div style="margin-top:1rem">' +
      (W.cap.stato === 'in-corso'
        ? '<button type="button" class="wz-btn" id="wzGenStop">Ferma dopo questo capitolo</button>'
        : '<button type="button" class="wz-btn primary" id="wzGenVia"' + (W.cap.scelta < 0 ? ' disabled' : '') + '>' +
          (W.cap.esito ? 'Riscrivi' : 'Scrivi i capitoli') + '</button>') +
      ' <button type="button" class="wz-btn" id="wzAltroCorso">Cambia corso</button></div>';
    return h;
  }

  function scegliCorso(folder) {
    W.cap = { folder: folder, alternative: null, scelta: -1, stato: 'fermo', prog: null, log: [], esito: null,
              stima: null, errore: null, accoda: false, daOrdine: 0, giaScritti: 0 };
    render();
  }
  function chiediScalette() {
    if (!window.vault.scaletta) return;
    W.cap.stato = 'scalette'; W.cap.errore = null; render();
    window.vault.scaletta.proponi(W.progetto, W.cap.folder).then(function (r) {
      W.cap.stato = 'fermo';
      if (r && r.error) { W.cap.errore = r.error; render(); return; }
      W.cap.alternative = (r && r.alternative) || [];
      if (!W.cap.alternative.length) W.cap.errore = 'Nessuna scaletta utilizzabile: riprova.';
      render();
    }).catch(function (e) { W.cap.stato = 'fermo'; W.cap.errore = e.message; render(); });
  }
  function scegliAlternativa(i) {
    W.cap.scelta = i; W.cap.stima = null; render();
    var alt = W.cap.alternative[i];
    if (window.vault.gen) window.vault.gen.stima(W.progetto, W.cap.folder, alt.capitoli)
      .then(function (s) { W.cap.stima = s; render(); });
  }
  function avviaGenerazione() {
    if (W.cap.scelta < 0 || !window.vault.gen) return;
    W.cap.stato = 'in-corso'; W.cap.log = []; W.cap.esito = null; W.cap.errore = null; W.cap.prog = null;
    render();
    window.vault.gen.start(W.progetto, W.cap.folder, W.cap.alternative[W.cap.scelta].capitoli, !!W.cap.accoda);
  }

  /* ascolto della generazione: registrato UNA VOLTA, attivo solo mentre scriviamo */
  if (window.vault && window.vault.gen) {
    window.vault.gen.onProgress(function (d) { if (W.cap.stato !== 'in-corso') return; W.cap.prog = d || {}; pittaCap(); });
    window.vault.gen.onLog(function (l) { if (W.cap.stato !== 'in-corso') return; W.cap.log.push(String(l)); pittaCap(); });
    window.vault.gen.onError(function (m) {
      if (W.cap.stato !== 'in-corso') return;
      W.cap.stato = 'fermo'; W.cap.errore = String(m || 'errore sconosciuto'); pittaCap();
    });
    window.vault.gen.onDone(function (d) {
      if (W.cap.stato !== 'in-corso') return;
      W.cap.stato = 'fatto'; W.cap.esito = d || { scritti: [], scarti: [] };
      toast(W.cap.esito.scritti.length + ' capitoli scritti', !(W.cap.esito.scarti || []).length);
      caricaStatoCorsi();          // il conteggio è cambiato: la spunta si aggiorna da sé
      pittaCap();
    });
  }
  var attesaCap = false;
  function pittaCap() {
    if (attesaCap) return;
    attesaCap = true;
    setTimeout(function () { attesaCap = false; if (!$('#wizard').hidden && W.step === 5) render(); }, 120);
  }

  function approva() {
    if (!W.piano || !window.vault.plan) return;
    $('#wzNext').disabled = true;
    window.vault.plan.approve(W.progetto).then(function (r) {
      $('#wzNext').disabled = false;
      if (r && r.error) { toast('Approvazione fallita: ' + r.error, false); return; }
      toast((r.creati || []).length + ' corsi creati sul disco', true);
      W.step = 5; W.cap.folder = null; render(); caricaStatoCorsi();
    });
  }

  function aggiornaHint() {
    var h = $('#wzHint');
    if (!h) return;
    h.textContent = W.step === 0
      ? (W.progetto ? 'Le modifiche al brief vengono salvate ora' : 'Il progetto viene creato ora, prima di qualunque elaborazione')
      : (W.step === 2 && W.ing.stato === 'in-corso' ? 'Puoi chiudere: l\'elaborazione prosegue' : '');
  }

  function avanti() {
    if (W.step === 0) {
      $('#wzNext').disabled = true;
      salvaStep0().then(function (id) {
        $('#wzNext').disabled = false;
        toast('Progetto «' + id + '» pronto', true);
        W.step = 1; render();
      }).catch(function (e) {
        $('#wzNext').disabled = false;
        toast('Non salvato: ' + e.message, false);
      });
      return;
    }
    if (W.step === 1) {
      W.step = 2; render();
      if (window.vault.corpus) window.vault.corpus.list(W.progetto).then(function (c) { W.corpus = c || []; render(); });
      return;
    }
    if (W.step === 2) { W.step = 3; render(); caricaStatoSchede(); return; }
    if (W.step === 5) {                               // ultimo passo: il tasto chiude e ricarica il lettore
      close();
      setTimeout(function () { location.reload(); }, 400);
      return;
    }
    if (W.step === 3) {
      W.step = 4; render();
      if (window.vault.plan) window.vault.plan.get(W.progetto).then(function (p) {
        if (p && p.corsi) { W.piano = p; W.granularita = p.granularity || W.granularita; W.plan.origine = p.origine; render(); }
      });
      return;
    }
    approva();
  }

  // ------------------------------------------------------------------ wiring
  document.addEventListener('click', function (e) {
    if (!e.target.closest) return;
    if (e.target.closest('#wzClose')) { close(); return; }
    if (e.target.closest('#wzBack')) { if (W.step > 0) { W.step--; render(); } return; }
    if (e.target.closest('#wzNext')) { avanti(); return; }
    if (e.target.closest('#wzPick')) { importa(); return; }
    if (e.target.closest('#wzCartella')) { scegliCartella(); return; }
    if (e.target.closest('#wzImpOk')) { applicaCartella(); return; }
    if (e.target.closest('#wzImpNo')) { W.imp.piano = null; scegliCartella(); return; }
    var rip = e.target.closest('.wz-rip');
    if (rip) { ripesca(rip.getAttribute('data-rel')); return; }
    if (e.target.closest('#wzIngStart')) { avviaIngest(); return; }
    if (e.target.closest('#wzProponi')) { chiediProposta(); return; }
    if (e.target.closest('#wzSchede')) { avviaSchede(false); return; }
    if (e.target.closest('#wzSchedeTutto')) { avviaSchede(true); return; }
    var sc = e.target.closest('.wz-corso-scelto');
    if (sc) { scegliCorso(sc.getAttribute('data-folder')); return; }
    var al = e.target.closest('.wz-alt');
    if (al) { scegliAlternativa(Number(al.getAttribute('data-i'))); return; }
    if (e.target.closest('#wzScalette')) { chiediScalette(); return; }
    if (e.target.closest('#wzComposer')) {
      // il wizard si chiude: il composer è una pagina piena, e due modali sovrapposte
      // si contendono Escape e il fondo cliccabile
      var p = W.progetto; close();
      if (window.studiaComposer) window.studiaComposer.apri(p);
      return;
    }
    if (e.target.closest('#wzAltroCorso')) { W.cap.folder = null; render(); return; }
    if (e.target.closest('#wzGenVia')) { avviaGenerazione(); return; }
    if (e.target.closest('#wzGenStop')) { window.vault.gen.cancel(W.progetto); toast('Mi fermo dopo questo capitolo', true); return; }
    var b = e.target.closest('.wc-btn');
    if (b) { comandoPiano(b.getAttribute('data-az'), Number(b.getAttribute('data-i'))); return; }
    if (e.target.closest('#newCourseBtn')) { open(null); return; }
    if (e.target === $('#wizard')) { close(); return; }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#wizard').hidden) close();
  });
  // titolo del corso e grana: si applicano appena cambiano
  document.addEventListener('change', function (e) {
    if (!e.target.closest) return;
    if (e.target.id === 'wzGran') { W.granularita = e.target.value; return; }
    if (e.target.id === 'wzLingua' || e.target.id === 'wzLinguaOut') {
      var out = e.target.id === 'wzLinguaOut';
      if (out) W.linguaOut = e.target.value; else W.lingua = e.target.value;
      if (window.vault && window.vault.prefs) {
        var p = window.vault.prefs.read() || {};
        if (out) p.linguaOutput = W.linguaOut; else p.lingua = W.lingua;
        var x = window.vault.prefs.save(p);
        if (x && x.error) toast('Lingua non salvata: ' + x.error, false);
      }
      W.scelti = selezioneMedia();               // il render seguente ricostruisce le caselle
      render();                                  // la nota sotto ai menu cambia con le lingue
      return;
    }
    if (e.target.classList && e.target.classList.contains('wz-ruolo')) {
      var num = e.target.getAttribute('data-num'), r = e.target.value;
      if (r) W.fonti[num] = r; else delete W.fonti[num];
      if (W.progetto && window.vault.fonti) window.vault.fonti.set(W.progetto, W.fonti)
        .then(function (x) { if (x && x.error) toast('Ruolo non salvato: ' + x.error, false); });
      return;
    }
    var t = e.target.closest('.wc-titolo');
    if (t && W.piano) {
      var i = Number(t.getAttribute('data-i'));
      if (W.piano.corsi[i]) { W.piano.corsi[i].title = t.value.slice(0, 120); rinumera(); salvaPiano(); }
    }
  });

  /* ---- esiti della proposta (canali con disiscrizione, come da piano) ---- */
  if (window.vault && window.vault.plan) {
    window.vault.plan.onProgress(function (d) {
      if (W.plan.stato !== 'in-corso') return;
      W.plan.msg = (d && d.msg) || W.plan.msg; pitta3();
    });
    window.vault.plan.onDone(function (d) {
      W.plan.stato = 'fatto';
      W.piano = (d && d.piano) || W.piano;
      W.plan.origine = (d && d.origine) || null;
      W.plan.avviso = (d && d.avviso) || null;
      W.plan.errore = null;
      pitta3();
      toast('Proposta pronta: ' + ((W.piano && W.piano.corsi.length) || 0) + ' corsi', true);
    });
    window.vault.plan.onError(function (m) {
      W.plan.stato = 'errore'; W.plan.errore = String(m || 'errore sconosciuto');
      pitta3(); toast('Proposta non riuscita', false);
    });
  }
  function pitta3() { if (!$('#wizard').hidden && W.step === 4) render(); }
  function pittaAnalisi() { if (!$('#wizard').hidden && W.step === 3) render(); }

  /* ---- esiti dell'analisi dei materiali (stadio 0) ---- */
  if (window.vault && window.vault.schede) {
    window.vault.schede.onProgress(function (d) {
      if (!d) return;
      if (d.fase === 'avvio') { W.sch.totale = d.totale || W.sch.totale; W.sch.corrente = d.msg || ''; }
      else {
        W.sch.corrente = 'Sto leggendo: [' + (d.num || '--') + '] ' + (d.titolo || '');
        W.sch.righe.push({ num: d.num, titolo: d.titolo, stato: d.stato });
        if (typeof d.fatti === 'number') W.sch.fatte = d.fatti;
        if (typeof d.totale === 'number') W.sch.totale = d.totale;
      }
      pittaAnalisi();
    });
    window.vault.schede.onDone(function (esiti) {
      W.sch.stato = 'fatto';
      W.sch.errore = (esiti && esiti.errori && esiti.errori.length) ? (esiti.errori.length + ' materiali non letti: ' + esiti.errori.slice(0, 3).map(function (x) { return (x.num || '?') + ' (' + x.errore + ')'; }).join(' · ')) : null;
      caricaStatoSchede(); pittaAnalisi();
      toast('Analisi completata: ' + ((esiti && esiti.fatte) || 0) + ' schede nuove', true);
    });
    window.vault.schede.onError(function (m) {
      W.sch.stato = 'errore'; W.sch.errore = String(m || 'errore'); pittaAnalisi(); toast('Analisi non riuscita', false);
    });
  }

  /**
   * Espansione: si riapre un progetto già finito per aggiungergli capitoli.
   * Differenza unica ma decisiva rispetto a una generazione normale: i capitoli
   * scritti si ACCODANO a quelli che ci sono. Rinumerare romperebbe i rimandi
   * [[NN-corso]] degli altri corsi, che nessuno si accorgerebbe finché un
   * allievo non ci clicca sopra.
   */
  function espandi(progetto, folder) {
    open(progetto);
    W.step = STEPS.length - 1;
    caricaStatoCorsi();                       // pannello «Capitoli»
    if (folder) {
      scegliCorso(folder);
      W.cap.accoda = true;
      if (window.vault.project && window.vault.project.expandStato) {
        window.vault.project.expandStato(progetto).then(function (r) {
          var c = r && (r.corsi || []).find(function (x) { return x.folder === folder; });
          if (c) { W.cap.daOrdine = c.prossimoOrdine; W.cap.giaScritti = c.capitoli; render(); }
        }).catch(function () {});
      }
    }
    render();
  }

  window.studiaWizard = { open: open, close: close, espandi: espandi };
})();
