'use strict';
/**
 * wizard — creazione guidata di un corso e delle sue lezioni.
 *
 * Questa versione copre gli step 0 (corso e brief) e 1 (raccolta materiali);
 * gli step 2–5 (elaborazione, proposta indice, generazione, fine) arrivano con M3–M5.
 * Lo stato vive nel filesystem: `_corso.md` è scritto alla fine dello step 0,
 * quindi il brief esiste PRIMA di qualunque elaborazione e il wizard è riprendibile.
 *
 * Un pannello per volta, azioni esplicite, «Chiudi (riprendi dopo)» sempre disponibile.
 */
(function () {
  var W = { step: 0, corso: null, brief: {}, importati: [], daImportare: [],
            corpus: [], scelti: null, ing: { stato: 'fermo', frazione: 0, msg: '', file: '', log: [], errore: null },
            imp: { cartella: null, piano: null, forzati: [], stato: 'fermo', errore: null },
            fonti: {},                                  // numero materiale → ruolo dichiarato
            cap: { folder: null, alternative: null, scelta: -1, stato: 'fermo', prog: null, log: [], esito: null, stima: null, errore: null },
            piano: null, plan: { stato: 'fermo', msg: '', errore: null, avviso: null, origine: null }, granularita: 'atomico',
            profilo: {}, nAlternative: 3, nCapitoli: 0,   // leve del passo «Opzioni»
            comp: {},                                     // riassunto del composer
            lingua: 'it',                               // lingua parlata nei media (vedi LINGUE)
            linguaOut: 'it',                            // lingua in cui scrivere la lezione (vedi LINGUE_OUT)
            sch: { stato: 'fermo', fatte: 0, totale: 0, mancanti: [], corrente: '', righe: [], errore: null } };
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var toast = function (m, ok) { if (typeof window.toast === 'function') window.toast(m, ok); };

  /* I passi per NOME, non per numero. `W.step === 4` sparso in dodici punti è il
     modo sicuro di dimenticarne uno il giorno in cui se ne aggiunge un altro —
     ed è successo esattamente qui, quando i passi sono diventati sette. */
  var P = { CORSO: 0, MATERIALI: 1, ELABORAZIONE: 2, ANALISI: 3, OPZIONI: 4, COMPOSER: 5, CAPITOLI: 6 };
  var STEPS = ['Corso', 'Materiali', 'Elaborazione', 'Analisi', 'Opzioni', 'Composer', 'Capitoli'];
  /* Il ruolo di una fonte è la sola cosa che il file non dice di sé: un PDF non
     sa se è la dispensa ufficiale della lezione o i tuoi appunti presi a lezione.
     «ufficiale» è il caso normale e non si scrive: si dichiarano le eccezioni. */
  var RUOLI = [
    ['', 'materiale ufficiale della lezione'],
    ['integrazione', 'fonte esterna aggiunta da me'],
    ['appunti', 'appunti personali'],
    ['riferimento', 'da consultare, non da studiare']
  ];
  /* La lingua PARLATA nei video e negli audio — non quella della lezione, che resta
     l'italiano in ogni caso. Va dichiarata perché Whisper, con la lingua sbagliata,
     non fallisce in modo visibile: traduce i suoni in parole plausibili della lingua
     imposta e restituisce un testo scorrevole e del tutto inventato. */
  var LINGUE = [
    ['it', 'italiano'], ['en', 'inglese'], ['fr', 'francese'], ['de', 'tedesco'],
    ['es', 'spagnolo'], ['pt', 'portoghese'], ['auto', 'riconoscila dall\'audio']
  ];
  /* La lingua in cui il modello SCRIVE la lezione: un'altra cosa dalla precedente.
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
    if (window.vault.corpus) window.vault.corpus.list(W.corso).then(function (c) { W.corpus = c || []; pitta(); });
    else pitta();
    toast(W.ing.stato === 'fatto' ? 'Elaborazione completata' : 'Elaborazione interrotta: ' + W.ing.errore, W.ing.stato === 'fatto');
  }
  function pitta() { if (!$('#wizard').hidden && W.step === P.ELABORAZIONE) render(); }
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
   * Un corso con i materiali dentro ma nessuna lezione era finora irraggiungibile:
   * non compariva negli elenchi (che filtravano per lezioni), «+ Nuovo corso»
   * ricominciava sempre da zero, e il pannello «Estendi» nasconde i suoi comandi
   * quando le lezioni sono zero. L'unica via d'uscita era rifare il corso — ed è
   * così che ne nascono quattro uguali.
   */
  function open(corso, passo) {
    W.step = 0; W.corso = corso || null; W.importati = []; W.daImportare = [];
    W.imp = { cartella: null, piano: null, forzati: [], stato: 'fermo', errore: null };
    W.fonti = {};
    // la lingua dei media è una preferenza tecnica del vault: sopravvive alla chiusura
    // del wizard, perché in un corpus i materiali parlano quasi sempre la stessa lingua
    try {
      var pr = (window.vault && window.vault.prefs && window.vault.prefs.read()) || {};
      W.lingua = pr.lingua || 'it'; W.linguaOut = pr.linguaOutput || 'it';
    } catch (e) { W.lingua = 'it'; W.linguaOut = 'it'; }
    $('#wizard').hidden = false;
    if (W.corso && window.vault.brief) {
      window.vault.brief.get(W.corso).then(function (b) {
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
   * materiale» su un corso pieno. Qui si caricano tutti quelli dei passi
   * attraversati, non solo del passo d'arrivo: indietro si può sempre tornare.
   */
  function vaiAPasso(n) {
    W.step = Math.max(0, Math.min(STEPS.length - 1, Number(n) || 0));
    render();
    if (W.step >= P.ELABORAZIONE && window.vault.corpus) {
      window.vault.corpus.list(W.corso).then(function (c) { W.corpus = c || []; render(); });
    }
    if (W.step >= P.ANALISI) caricaStatoSchede();
    if (W.step >= P.OPZIONI) caricaProfilo();
    if (W.step >= P.OPZIONI && window.vault.plan) {
      window.vault.plan.get(W.corso).then(function (p) {
        if (p && p.lezioni) { W.piano = p; W.granularita = p.granularity || W.granularita; W.plan.origine = p.origine; render(); }
      });
    }
    if (W.step >= P.COMPOSER) caricaStatoComposer();
    if (W.step >= P.CAPITOLI) caricaStatoLezioni();   // quanti capitoli ha già ogni lezione
  }
  function close() {
    $('#wizard').hidden = true;
    // se l'elaborazione è in corso torna a mostrarsi la barra globale in fondo:
    // il processo prosegue anche a wizard chiuso e l'utente deve poterlo vedere
    if (W.ing.stato === 'in-corso') document.documentElement.dataset.wizingest = '';
    if (W.corso) toast('Corso «' + W.corso + '» salvato: puoi riprendere quando vuoi', true);
  }

  var TITOLI = ['Nuovo corso', 'Materiali di studio', 'Elaborazione dei materiali', 'Analisi dei contenuti',
                'Opzioni e profilo', 'Composer degli indici', 'Scrittura dei capitoli'];
  var PANNELLI = [step0, step1, step2, stepAnalisi, stepOpzioni, stepComposer, step4];
  function render() {
    $('#wzSteps').textContent = 'Passo ' + (W.step + 1) + ' di ' + STEPS.length + ' · ' + STEPS[W.step];
    $('#wzTitle').textContent = TITOLI[W.step];
    $('#wzBack').disabled = (W.step === 0 || W.ing.stato === 'in-corso' || W.plan.stato === 'in-corso' || W.sch.stato === 'in-corso');
    $('#wzNext').textContent = W.step === P.OPZIONI ? 'Vai al composer'
      : (W.step === P.COMPOSER ? 'Approva le lezioni' : (W.step === P.CAPITOLI ? 'Chiudi' : 'Avanti'));
    $('#wzNext').disabled = (W.ing.stato === 'in-corso' || W.plan.stato === 'in-corso' || W.sch.stato === 'in-corso' ||
      W.cap.stato === 'in-corso' || (W.step >= P.OPZIONI && !(W.piano && W.piano.lezioni && W.piano.lezioni.length)));
    ($('#wzBody')).innerHTML = PANNELLI[W.step]();
    if (W.step === 0) {
      var n = $('#wzNome'); if (n && !W.corso) setTimeout(function () { n.focus(); }, 30);
    }
    aggiornaHint();
  }

  // ---------------------------------------------------------------- step 0
  function step0() {
    var b = W.brief || {};
    return '' +
      '<h3>Di che corso si tratta</h3>' +
      '<p>Un corso raccoglie le lezioni che nascono dallo stesso materiale. Il nome diventa la cartella dentro <code>Corsi/</code>.</p>' +
      '<label class="f">Nome del corso' +
      '<input type="text" id="wzNome" value="' + esc(b.title || W.corso || '') + '"' + (W.corso ? ' disabled' : '') + ' placeholder="Es. Tutor DSA"></label>' +
      '<label class="f">A cosa ti serve' +
      '<select id="wzObiettivo">' + opt(['', 'esame', 'professionale', 'curiosita'], ['— scegli —', 'Preparare un esame', 'Lavoro / formazione professionale', 'Interesse personale'], b.obiettivo) + '</select></label>' +
      '<label class="f">Cosa conta di più' +
      '<select id="wzPriorita">' + opt(['', 'comprensione', 'memorizzazione', 'applicazione'], ['— scegli —', 'Capire a fondo', 'Ricordare i contenuti', 'Saperli applicare'], b.priorita) + '</select></label>' +
      '<label class="f" style="margin-top:1.2rem;">Indicazioni per questo materiale <span style="font-weight:400;text-transform:none;letter-spacing:0;">(facoltative)</span>' +
      '<textarea id="wzIndicazioni" rows="3" placeholder="Es. la parte sui test standardizzati mi serve più approfondita del resto.">' + esc(b.indicazioni || '') + '</textarea></label>' +
      '<p>Queste indicazioni valgono <b>solo per questo corso</b> e descrivono come trattare il materiale, non quali argomenti includere. Il tuo profilo generale sta in ⚙ Impostazioni › Utente.</p>';
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
    if (W.corso) return window.vault.brief.set(W.corso, brief).then(function (r) {
      if (r && r.error) throw new Error(r.error);
      return W.corso;
    });
    if (!nome) return Promise.reject(new Error('dai un nome al corso'));
    return window.vault.course.create(nome, brief).then(function (r) {
      if (r && r.error) throw new Error(r.error);
      W.corso = r.id;
      // il brief va riscritto dopo la creazione: course:create scrive il file, brief:set fa l'upsert dei campi
      return window.vault.brief.set(W.corso, brief).then(function () { return W.corso; });
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
    return window.vault.cartella.scan(W.imp.cartella, W.imp.forzati, W.corso).then(function (p) {
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
    window.vault.cartella.apply(W.imp.cartella, W.imp.forzati, W.corso).then(function (r) {
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
        'Il menu a destra dice <b>che ruolo</b> ha la fonte: è l\'unica cosa che il file non sa di sé, e l\'analisi la userà per pesare le fonti quando costruisce le lezioni.</p>' +
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
        '<label class="wz-hint" for="wzLinguaOut">Lingua in cui scrivere la lezione&nbsp;</label>' +
        '<select id="wzLinguaOut">' + LINGUE_OUT.map(function (l) {
          return '<option value="' + esc(l[0]) + '"' + (l[0] === W.linguaOut ? ' selected' : '') + '>' + esc(l[1]) + '</option>';
        }).join('') + '</select>' +
        '</div>' +
        '<p class="wz-hint" style="display:block;margin-top:.35rem;">' +
        'Vale per tutto quello che scrive il modello: schede, titoli delle lezioni, capitoli, glossario, domande. ' +
        'Può essere diversa dalla lingua dei materiali — è il caso normale.' +
        (W.lingua !== 'auto' && W.lingua !== W.linguaOut
          ? ' Qui i materiali sono in <b>' + esc(nomeLingua(W.lingua)) + '</b> e la lezione uscirà in <b>' + esc(nomeLingua(W.linguaOut)) + '</b>: ' +
            'i minutaggi e i numeri di pagina restano corretti (sono numeri), e le <b>citazioni testuali restano nella lingua della fonte</b>, ' +
            'perché tradurre le parole di un relatore e attribuirgliele falsifica la fonte.'
          : '') +
        '</p>' +
        /* UN comando solo, che dice su che cosa agisce. Prima erano due, e il
           secondo — «Rielabora tutto» — non voleva dire «rifai questo corso»
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
        'Agisce solo su <b>' + esc(W.corso || 'questo corso') + '</b>. ' +
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
        'Elaborazione completata. Il passo successivo — la proposta dell\'indice delle lezioni — arriva con la prossima parte del wizard.</div>';
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
   * Avvia l'elaborazione dei materiali SCELTI, dentro il corso corrente.
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
    window.vault.ingest.start(force ? { force: true, lang: W.lingua, corso: W.corso } : { files: scelti, lang: W.lingua, corso: W.corso });
  }

  // ------------------------------------------------------------ step Analisi
  // Stadio 0: un agente legge ogni materiale per intero e ne scrive la scheda.
  // È la lettura che rende possibile un'architettura di qualità: senza schede,
  // l'indice si costruisce sulle sole parole chiave.

  function stepAnalisi() {
    var s = W.sch, inCorso = s.stato === 'in-corso';
    var h = '<h3>Lettura dei materiali</h3>' +
      '<p>Ogni materiale viene letto per intero dal modello, che ne scrive una scheda: di cosa tratta, i temi in sequenza con i minutaggi o le pagine, i concetti, i prerequisiti e i capitoli proposti. ' +
      'Le schede restano nel corso: si pagano una volta e servono poi all\'indice e alla generazione.</p>';

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
      h += '<div class="wz-ok">Tutti i materiali sono stati letti. Il passo successivo costruisce l\'architettura delle lezioni a partire dalle schede.</div>';
    }
    return h;
  }

  function caricaStatoSchede() {
    if (!window.vault.schede) return;
    window.vault.schede.stato(W.corso).then(function (st) {
      W.sch.totale = st.totale; W.sch.fatte = st.fatte; W.sch.mancanti = st.mancanti || [];
      if (W.step === P.ANALISI) render();
    });
  }

  function avviaSchede(rifai) {
    if (!window.vault.schede) { toast('Analisi disponibile solo nell\'app', false); return; }
    W.sch.stato = 'in-corso'; W.sch.errore = null; W.sch.righe = []; W.sch.corrente = 'Avvio…';
    render();
    window.vault.schede.build(W.corso, !!rifai);
  }

  // ------------------------------------------------------------- step OPZIONI
  /* Prima di far proporre qualcosa al modello si guarda con che regole lo farà.
     Il profilo esiste dal primo avvio e governa la FORMA di tutto — ma finora
     non si rivedeva mai: lo si compilava una volta e poi si dimenticava che
     stava decidendo la lunghezza dei capitoli, i quiz, il glossario. Qui torna
     sotto gli occhi nel momento in cui conta, e si corregge senza uscire.

     Il taglio delle lezioni invece NON si corregge più qui: si corregge nel
     composer, sulle righe, accanto agli indici che ne nascono. Un elenco che si
     modifica in due posti diversi diverge, e in mezzo ci sono i nomi delle
     cartelle. */

  var PROF_LEVE = [
    ['granularita', 'Grana dei capitoli', [['atomico', '1 capitolo = 1 concetto'], ['medio', 'pochi concetti legati'], ['ampio', 'un tema intero']]],
    ['capitoli_brevi', 'Lunghezza', [['true', 'testi corti'], ['false', 'testi distesi']]],
    ['stile_capitoli', 'Stile', [['discorsivo', 'discorsivo'], ['schematico', 'schematico'], ['esempi', 'per esempi'], ['domande', 'per domande']]],
    ['quiz', 'Quiz', [['frequenti', '2–3 per capitolo'], ['pochi', '1 per capitolo'], ['nessuno', 'nessuno']]],
    ['glossario', 'Glossario', [['esteso', 'esteso'], ['essenziale', 'essenziale'], ['nessuno', 'nessuno']]],
    ['approfondimenti', 'Approfondimenti', [['ricchi', 'ricchi, fuori dal corpo'], ['minimi', 'solo l\'essenziale']]]
  ];
  /* Il file usa snake_case, il serializzatore camelCase: la corrispondenza è la
     stessa delle Impostazioni, e sta scritta una volta sola. */
  var PROF_CHIAVI = { granularita: 'granularita', capitoli_brevi: 'capitoliBrevi', stile_capitoli: 'stileCapitoli',
    quiz: 'quiz', glossario: 'glossario', approfondimenti: 'approfondimenti',
    stile_corso: 'stileCorso', stile_lezioni: 'stileLezioni', esempi_concreti: 'esempiConcreti' };

  function stepOpzioni() {
    var inCorso = W.plan.stato === 'in-corso';
    var pr = W.profilo || {};
    var h = '<h3>Con che regole scrivo</h3>' +
      '<p>Queste opzioni valgono per <b>tutto</b> quello che il modello proporrà e scriverà in questo corso. ' +
      'Il taglio delle lezioni lo correggi dopo, nel composer, insieme agli indici.</p>';

    /* le esigenze dichiarate non si toccano qui: sono sette menu per area e
       stanno in Impostazioni, dove c'è spazio per spiegarle */
    var tok = (pr.bisogni || []);
    h += '<div class="wz-ok" style="margin-bottom:.9rem;">' +
      '<b style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;">Le tue esigenze dichiarate</b><br>' +
      (tok.length
        ? tok.map(function (t) { return '<span class="wc-chip">' + esc(t) + '</span>'; }).join(' ')
        : 'Nessuna dichiarata: il modello userà solo le opzioni qui sotto.') +
      (pr.comeImparo ? '<div class="wz-hint" style="display:block;margin-top:.4rem;">«' + esc(pr.comeImparo.slice(0, 160)) + (pr.comeImparo.length > 160 ? '…' : '') + '»</div>' : '') +
      '<div class="wz-hint" style="display:block;margin-top:.4rem;">Si cambiano in ⚙ Impostazioni › Utente.</div></div>';

    h += '<div class="wz-leve">' + PROF_LEVE.map(function (l) {
      var v = pr[l[0]];
      if (v === true || v === false) v = String(v);
      return '<label class="f">' + esc(l[1]) +
        '<select class="wz-prof" data-k="' + l[0] + '">' +
        l[2].map(function (o) {
          return '<option value="' + esc(o[0]) + '"' + (String(v || '') === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
        }).join('') + '</select></label>';
    }).join('') + '</div>' +
      '<p class="wz-hint" style="display:block;margin:-.4rem 0 1rem;">Si salvano nel profilo appena le cambi: valgono anche per i corsi successivi.</p>';

    h += '<label class="f">Indicazioni per questo materiale <span style="font-weight:400;text-transform:none;letter-spacing:0;">(solo per questo corso)</span>' +
      '<textarea id="wzIndicazioni2" rows="2" placeholder="Es. la parte sui test standardizzati mi serve più approfondita del resto.">' +
      esc((W.brief && W.brief.indicazioni) || '') + '</textarea></label>';

    h += '<h3 style="margin-top:1.2rem;">Quante alternative, quanto grosse</h3>';
    h += '<div class="wz-leve">' +
      '<label class="f">Grana delle lezioni' +
      '<select id="wzGran">' + ['atomico', 'medio', 'ampio'].map(function (g) {
        var et = { atomico: 'fine — molte lezioni piccole', medio: 'media', ampio: 'larga — poche lezioni grandi' }[g];
        return '<option value="' + g + '"' + (W.granularita === g ? ' selected' : '') + '>' + et + '</option>';
      }).join('') + '</select></label>' +
      '<label class="f">Alternative per lezione' +
      '<input type="number" id="wzNAlt" min="2" max="6" value="' + (W.nAlternative || 3) + '"></label>' +
      '<label class="f">Capitoli per lezione' +
      '<input type="number" id="wzNCap" min="2" max="30" placeholder="auto" value="' + (W.nCapitoli || '') + '"></label>' +
      '</div>' +
      '<p class="wz-hint" style="display:block;margin:-.4rem 0 1rem;">Le alternative sono gli indici fra cui sceglierai nel composer, uno per lezione e per personaggio. ' +
      '«Capitoli per lezione» vuoto vuol dire che decide il modello.</p>';

    h += '<div class="setrow" style="margin-bottom:.8rem;">' +
      '<button type="button" class="wz-btn primary" id="wzProponi"' + (inCorso ? ' disabled' : '') + '>' +
      (W.piano ? 'Rifai la proposta delle lezioni' : 'Proponi le lezioni') + '</button>' +
      (inCorso ? '<span class="wz-hint">' + esc(W.plan.msg || 'Sto lavorando…') + '</span>' : '') +
      '</div>';

    if (W.plan.errore) h += '<div class="wz-errore">Proposta non riuscita: ' + esc(W.plan.errore) + '</div>';
    if (W.plan.avviso) h += '<div class="wz-avviso">' + esc(W.plan.avviso) + '</div>';

    if (W.piano && W.piano.lezioni && W.piano.lezioni.length) {
      var nMat = W.piano.lezioni.reduce(function (s, c) { return s + c.materiali.length; }, 0);
      h += '<div class="wz-ok"><b>' + W.piano.lezioni.length + ' lezioni</b> · ' + nMat + ' materiali collocati' +
        (W.plan.origine === 'ai' ? ' · proposta rivista dal modello' : ' · proposta euristica locale') +
        '. Le correggi nel composer, riga per riga.</div>' +
        '<ol class="wz-hint" style="display:block;margin:.3rem 0 0 1.2rem;padding:0;">' +
        W.piano.lezioni.map(function (c) {
          return '<li>' + esc(c.title) + ' <span style="opacity:.7">(' + (c.materiali || []).length + ')</span></li>';
        }).join('') + '</ol>';
    } else if (!inCorso && !W.plan.errore) {
      h += '<p>Nessuna proposta ancora. Premi «Proponi le lezioni».</p>';
    }
    return h;
  }

  /** Le leve di forma finiscono nel profilo: si legge tutto, si cambia una chiave, si riscrive. */
  function salvaLeva(chiaveFile, valore) {
    if (!(window.vault && window.vault.profile)) return;
    var p = window.vault.profile.read() || {};
    var o = { bisogni: p.bisogni || [], bisogniAltro: p.bisogni_altro || '',
              comeImparo: p.comeImparo || '', cosaAffatica: p.cosaAffatica || '' };
    Object.keys(PROF_CHIAVI).forEach(function (k) {
      var v = p[k];
      if (v !== undefined && v !== '') o[PROF_CHIAVI[k]] = v;
    });
    o[PROF_CHIAVI[chiaveFile]] = (valore === 'true' || valore === 'false') ? (valore === 'true') : valore;
    var r = window.vault.profile.save(o);
    if (r && r.error) { toast('Profilo non salvato: ' + r.error, false); return; }
    W.profilo = window.vault.profile.read() || {};
  }

  // ------------------------------------------------------------ step COMPOSER
  /* Il composer è una pagina piena, non un pannello: qui c'è la porta e il
     riassunto di che cosa c'è dentro, così si sa se ci si deve entrare. */
  function stepComposer() {
    var lezioni = (W.piano && W.piano.lezioni) || [];
    var st = W.comp || {};
    var h = '<h3>Comporre i percorsi</h3>' +
      '<p>Nel composer ogni riga è una lezione e le card sono gli indici proposti. Lì dentro correggi il taglio delle lezioni, ' +
      'chiedi gli indici, trascini i personaggi e fai scrivere i capitoli.</p>';
    if (!lezioni.length) return h + '<div class="wz-avviso">Prima serve la proposta delle lezioni: torna indietro e premi «Proponi le lezioni».</div>';

    h += '<div class="wz-ok"><b>' + lezioni.length + ' lezioni</b>' +
      (st.scalette ? ' · ' + st.scalette + ' con gli indici proposti' : ' · nessun indice proposto ancora') +
      (st.percorsi ? ' · <b>' + st.percorsi + '</b> percorsi salvati' : '') +
      (st.coppieScritte ? ' · ' + st.coppieScritte + ' cartelle di capitoli scritte' : '') + '</div>';

    h += '<div style="margin-top:1rem">' +
      '<button type="button" class="wz-btn primary" id="wzApriComposer">Apri il composer</button></div>' +
      '<p class="wz-hint" style="display:block;margin-top:.6rem;">Il wizard si chiude mentre componi e si riapre qui quando chiudi il composer. ' +
      '«Approva le lezioni» crea le cartelle delle lezioni senza variante: serve solo se vuoi scrivere anche i capitoli della lezione singola, al passo dopo.</p>';
    return h;
  }

  /** Il riassunto del composer, letto dal disco: senza, il pannello direbbe zero su un corso pieno. */
  function caricaStatoComposer() {
    if (!(window.vault && window.vault.composer)) return;
    window.vault.composer.stato(W.corso).then(function (s) {
      if (!s || s.error) return;
      W.comp = { scalette: Object.keys(s.scalette || {}).length, percorsi: (s.percorsi || []).length };
      return window.vault.percorsi.coppie(W.corso).then(function (c) {
        if (c && !c.error) W.comp.coppieScritte = (c.coppie || []).filter(function (k) { return k.scritti; }).length;
        if (!$('#wizard').hidden && W.step === P.COMPOSER) render();
      });
    }).catch(function () {});
  }

  function chiediProposta() {
    if (!window.vault.plan) { toast('Proposta disponibile solo nell\'app', false); return; }
    W.plan = { stato: 'in-corso', msg: 'Preparo il digest dei materiali…', errore: null, avviso: null, origine: null };
    render();
    window.vault.plan.propose(W.corso, W.granularita);
  }

  // ---------------------------------------------------------------- step 5
  /* I capitoli si scrivono una lezione per volta. Prima si sceglie la lezione, poi si
     confrontano due o tre scalette alternative: cambiano ordine e raggruppamento,
     mai la copertura del materiale. Il costo si vede prima di spendere. */
  /* Quanti capitoli ha DAVVERO ogni lezione, contati sul disco.
     Il piano dice il suo, ma è un registro che si può disallineare — ed è già
     successo. Le cartelle no: se ci sono cinque file .md, i capitoli sono
     cinque. La spunta si fida di quelle. */
  function caricaStatoLezioni() {
    if (!W.corso || !window.vault.course || !window.vault.course.expandStato) return;
    window.vault.course.expandStato(W.corso).then(function (r) {
      if (!r || r.error) return;
      var m = {};
      (r.lezioni || []).forEach(function (c) { m[c.folder] = c.capitoli || 0; });
      W.cap.perLezione = m;
      if (!$('#wizard').hidden && W.step === P.CAPITOLI) render();
    }).catch(function () {});
  }

  function step4() {
    var lezioni = (W.piano && W.piano.lezioni) || [];
    if (!lezioni.length) return '<h3>Nessuna lezione approvata</h3><p>Torna indietro e approva l\'indice.</p>';

    if (!W.cap.folder) {
      var perLezione = W.cap.perLezione || null;
      var scritti = lezioni.filter(function (c) { return perLezione && perLezione[c.folder] > 0; }).length;
      return '<h3>La lezione singola, senza varianti</h3>' +
        '<p>Questo passo serve ancora in due casi: scrivere i capitoli di una lezione che <b>non</b> fa parte di un percorso, ' +
        'ed <b>estendere</b> una lezione già scritta. Se stai componendo percorsi, i capitoli si scrivono dal composer — ' +
        'una cartella per coppia lezione+indice, condivisa fra i percorsi che scelgono lo stesso indice.</p>' +
        '<div class="wz-ok" style="display:flex;gap:.7rem;align-items:center;flex-wrap:wrap;">' +
        '<span style="flex:1;min-width:220px">I percorsi si compongono al passo precedente.</span>' +
        '<button type="button" class="wz-btn" id="wzComposer">Torna al composer</button></div>' +
        (perLezione
          ? '<p class="wz-hint" style="display:block">' + (scritti
              ? '<b>' + scritti + '</b> lezioni su ' + lezioni.length + ' hanno già i capitoli scritti. Rifarli li riscrive da capo: serve a provare un taglio diverso sullo stesso materiale.'
              : 'Nessuna lezione ha ancora i capitoli.') + '</p>'
          : '') +
        '<ul class="wz-files">' + lezioni.map(function (c) {
          // la verità sta nella cartella; il piano è solo il ripiego se il conteggio non è ancora arrivato
          var n = perLezione ? (perLezione[c.folder] || 0)
                           : ((c.status === 'generato' || c.status === 'parziale') ? -1 : 0);
          var fatto = n !== 0;
          return '<li><span class="dest">' + esc(c.folder.slice(0, 2)) + '</span>' +
            '<span style="flex:1">' + esc(c.title) + ' <span class="wz-hint">(' + (c.materiali || []).length + ' materiali)</span></span>' +
            (fatto
              ? '<span class="dest">✓ ' + (n > 0 ? n + ' capitol' + (n === 1 ? 'o' : 'i') : esc(c.status)) + '</span>'
              : '<span class="wz-hint">da scrivere</span>') +
            '<button type="button" class="wc-btn wz-lezione-scelto" data-folder="' + esc(c.folder) + '">' +
            (fatto ? 'riscrivi' : 'scrivi i capitoli') + '</button></li>';
        }).join('') + '</ul>';
    }

    var lezione = lezioni.filter(function (c) { return c.folder === W.cap.folder; })[0] || {};
    var h = '<h3>' + esc(lezione.title || W.cap.folder) + '</h3>';
    if (W.cap.errore) h += '<div class="wz-errore">' + esc(W.cap.errore) + '</div>';

    // 1. le alternative non ci sono ancora
    if (!W.cap.alternative) {
      return h + '<p>Lo stesso materiale si può insegnare in modi diversi, tutti legittimi. Chiedo <b>due o tre scalette alternative</b> e ti dico in una frase che cosa cambia per te fra l\'una e l\'altra.</p>' +
        '<p class="wz-hint" style="display:block">Le tue preferenze di forma valgono per tutte: non sono una delle variabili in gioco.</p>' +
        '<div style="margin-top:1rem">' +
        '<button type="button" class="wz-btn primary" id="wzScalette"' + (W.cap.stato === 'scalette' ? ' disabled' : '') + '>' +
        (W.cap.stato === 'scalette' ? 'Ci penso…' : 'Proponi le scalette') + '</button> ' +
        '<button type="button" class="wz-btn" id="wzAltroLezione">Cambia lezione</button></div>';
    }

    // 2. confronto e scelta
    h += '<p>' + W.cap.alternative.length + ' modi di organizzare lo stesso materiale. Leggi la differenza, non i titoli.</p>';
    h += '<ul class="wz-lezioni">' + W.cap.alternative.map(function (a, i) {
      var sel = W.cap.scelta === i;
      return '<li class="wz-lezione" style="' + (sel ? 'border-color:var(--teal-strong)' : '') + '">' +
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
      h += '<div class="wz-ok">La lezione ha gi\u00e0 <b>' + (W.cap.giaScritti || 0) + '</b> capitoli: i nuovi partiranno dal <b>' +
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
      ' <button type="button" class="wz-btn" id="wzAltroLezione">Cambia lezione</button></div>';
    return h;
  }

  function scegliLezione(folder) {
    W.cap = { folder: folder, alternative: null, scelta: -1, stato: 'fermo', prog: null, log: [], esito: null,
              stima: null, errore: null, accoda: false, daOrdine: 0, giaScritti: 0 };
    render();
  }
  function chiediScalette() {
    if (!window.vault.scaletta) return;
    W.cap.stato = 'scalette'; W.cap.errore = null; render();
    window.vault.scaletta.proponi(W.corso, W.cap.folder).then(function (r) {
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
    if (window.vault.gen) window.vault.gen.stima(W.corso, W.cap.folder, alt.capitoli)
      .then(function (s) { W.cap.stima = s; render(); });
  }
  function avviaGenerazione() {
    if (W.cap.scelta < 0 || !window.vault.gen) return;
    W.cap.stato = 'in-corso'; W.cap.log = []; W.cap.esito = null; W.cap.errore = null; W.cap.prog = null;
    render();
    window.vault.gen.start(W.corso, W.cap.folder, W.cap.alternative[W.cap.scelta].capitoli, !!W.cap.accoda);
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
      caricaStatoLezioni();          // il conteggio è cambiato: la spunta si aggiorna da sé
      pittaCap();
    });
  }
  var attesaCap = false;
  function pittaCap() {
    if (attesaCap) return;
    attesaCap = true;
    setTimeout(function () { attesaCap = false; if (!$('#wizard').hidden && W.step === P.CAPITOLI) render(); }, 120);
  }

  /**
   * Crea le cartelle delle lezioni «senza variante» e passa alla scrittura della
   * lezione singola. Non è più il passaggio obbligato che era: chi lavora a
   * percorsi scrive dal composer, in cartelle `lezione--indice` che nascono da
   * sé. Qui si passa solo se serve ancora la lezione unica.
   */
  function approva() {
    if (!W.piano || !window.vault.plan) return;
    $('#wzNext').disabled = true;
    window.vault.plan.approve(W.corso).then(function (r) {
      $('#wzNext').disabled = false;
      if (r && r.error) { toast('Approvazione fallita: ' + r.error, false); return; }
      toast((r.creati || []).length + ' lezioni create sul disco', true);
      W.step = P.CAPITOLI; W.cap.folder = null; render(); caricaStatoLezioni();
    });
  }

  function aggiornaHint() {
    var h = $('#wzHint');
    if (!h) return;
    h.textContent = W.step === P.CORSO
      ? (W.corso ? 'Le modifiche al brief vengono salvate ora' : 'Il corso viene creato ora, prima di qualunque elaborazione')
      : (W.step === P.ELABORAZIONE && W.ing.stato === 'in-corso' ? 'Puoi chiudere: l\'elaborazione prosegue' : '');
  }

  function avanti() {
    if (W.step === P.CORSO) {
      $('#wzNext').disabled = true;
      salvaStep0().then(function (id) {
        $('#wzNext').disabled = false;
        toast('Corso «' + id + '» pronto', true);
        W.step = P.MATERIALI; render();
      }).catch(function (e) {
        $('#wzNext').disabled = false;
        toast('Non salvato: ' + e.message, false);
      });
      return;
    }
    if (W.step === P.MATERIALI) {
      W.step = P.ELABORAZIONE; render();
      if (window.vault.corpus) window.vault.corpus.list(W.corso).then(function (c) { W.corpus = c || []; render(); });
      return;
    }
    if (W.step === P.ELABORAZIONE) { W.step = P.ANALISI; render(); caricaStatoSchede(); return; }
    if (W.step === P.ANALISI) {
      W.step = P.OPZIONI; render();
      caricaProfilo();
      if (window.vault.plan) window.vault.plan.get(W.corso).then(function (p) {
        if (p && p.lezioni) { W.piano = p; W.granularita = p.granularity || W.granularita; W.plan.origine = p.origine; render(); }
      });
      return;
    }
    if (W.step === P.OPZIONI) { W.step = P.COMPOSER; render(); caricaStatoComposer(); return; }
    if (W.step === P.COMPOSER) { approva(); return; }   // le cartelle delle lezioni senza variante
    // ultimo passo: il tasto chiude e ricarica il lettore
    close();
    setTimeout(function () { location.reload(); }, 400);
  }

  /** Il profilo, per il recap del passo «Opzioni». Si rilegge a ogni ingresso: può essere cambiato altrove. */
  function caricaProfilo() {
    if (!(window.vault && window.vault.profile)) return;
    W.profilo = window.vault.profile.read() || {};
    try {
      var pr = (window.vault.prefs && window.vault.prefs.read()) || {};
      W.nAlternative = Number(pr.nAlternative) || 3;
      W.nCapitoli = Number(pr.capitoliPerLezione) || 0;
    } catch (e) {}
    if (!$('#wizard').hidden && W.step === P.OPZIONI) render();
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
    var sc = e.target.closest('.wz-lezione-scelto');
    if (sc) { scegliLezione(sc.getAttribute('data-folder')); return; }
    var al = e.target.closest('.wz-alt');
    if (al) { scegliAlternativa(Number(al.getAttribute('data-i'))); return; }
    if (e.target.closest('#wzScalette')) { chiediScalette(); return; }
    if (e.target.closest('#wzApriComposer') || e.target.closest('#wzComposer')) {
      // il wizard si chiude: il composer è una pagina piena, e due modali sovrapposte
      // si contendono Escape e il fondo cliccabile
      var p = W.corso, tornaA = W.step; close();
      if (window.studiaComposer) window.studiaComposer.apri(p, { tornaAlWizard: tornaA });
      return;
    }
    if (e.target.closest('#wzAltroLezione')) { W.cap.folder = null; render(); return; }
    if (e.target.closest('#wzGenVia')) { avviaGenerazione(); return; }
    if (e.target.closest('#wzGenStop')) { window.vault.gen.cancel(W.corso); toast('Mi fermo dopo questo capitolo', true); return; }

    if (e.target.closest('#newLessonBtn')) { open(null); return; }
    if (e.target === $('#wizard')) { close(); return; }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#wizard').hidden) close();
  });
  // titolo della lezione e grana: si applicano appena cambiano
  document.addEventListener('change', function (e) {
    if (!e.target.closest) return;
    if (e.target.id === 'wzGran') { W.granularita = e.target.value; return; }
    if (e.target.classList && e.target.classList.contains('wz-prof')) {
      salvaLeva(e.target.getAttribute('data-k'), e.target.value);
      return;
    }
    if (e.target.id === 'wzNAlt' || e.target.id === 'wzNCap') {
      var alt = e.target.id === 'wzNAlt';
      var n = Number(e.target.value) || 0;
      if (alt) W.nAlternative = Math.min(6, Math.max(2, n || 3)); else W.nCapitoli = n;
      if (window.vault && window.vault.prefs) {
        var pf = window.vault.prefs.read() || {};
        if (alt) pf.nAlternative = W.nAlternative; else pf.capitoliPerLezione = W.nCapitoli || null;
        var x = window.vault.prefs.save(pf);
        if (x && x.error) toast('Opzione non salvata: ' + x.error, false);
      }
      return;
    }
    if (e.target.id === 'wzIndicazioni2') {
      var testo = e.target.value.slice(0, 1200);
      W.brief = Object.assign({}, W.brief, { indicazioni: testo });
      if (W.corso && window.vault.brief) window.vault.brief.set(W.corso, { indicazioni: testo })
        .then(function (x) { if (x && x.error) toast('Indicazioni non salvate: ' + x.error, false); });
      return;
    }
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
      if (W.corso && window.vault.fonti) window.vault.fonti.set(W.corso, W.fonti)
        .then(function (x) { if (x && x.error) toast('Ruolo non salvato: ' + x.error, false); });
      return;
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
      toast('Proposta pronta: ' + ((W.piano && W.piano.lezioni.length) || 0) + ' lezioni', true);
    });
    window.vault.plan.onError(function (m) {
      W.plan.stato = 'errore'; W.plan.errore = String(m || 'errore sconosciuto');
      pitta3(); toast('Proposta non riuscita', false);
    });
  }
  function pitta3() { if (!$('#wizard').hidden && W.step === P.OPZIONI) render(); }
  function pittaAnalisi() { if (!$('#wizard').hidden && W.step === P.ANALISI) render(); }

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
   * Espansione: si riapre un corso già finito per aggiungergli capitoli.
   * Differenza unica ma decisiva rispetto a una generazione normale: i capitoli
   * scritti si ACCODANO a quelli che ci sono. Rinumerare romperebbe i rimandi
   * [[NN-lezione]] delle altre lezioni, di cui nessuno si accorgerebbe finché un
   * allievo non ci clicca sopra.
   */
  function espandi(corso, folder) {
    open(corso);
    W.step = P.CAPITOLI;
    caricaStatoLezioni();                       // pannello «Capitoli»
    if (folder) {
      scegliLezione(folder);
      W.cap.accoda = true;
      if (window.vault.course && window.vault.course.expandStato) {
        window.vault.course.expandStato(corso).then(function (r) {
          var c = r && (r.lezioni || []).find(function (x) { return x.folder === folder; });
          if (c) { W.cap.daOrdine = c.prossimoOrdine; W.cap.giaScritti = c.capitoli; render(); }
        }).catch(function () {});
      }
    }
    render();
  }

  window.studiaWizard = { open: open, close: close, espandi: espandi };
})();
