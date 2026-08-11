'use strict';
/**
 * genera — dalla scaletta approvata ai capitoli `.md` sul disco.
 *
 * Un capitolo per chiamata. Il modello NON scrive markdown: restituisce una
 * struttura, che viene validata e poi serializzata da `mdser`. È la garanzia che
 * il file finisca sempre nella forma esatta che il lettore sa riparsare — se
 * lasciassimo scrivere il markdown al modello, il primo apostrofo fuori posto
 * romperebbe il capitolo e ce ne accorgeremmo solo aprendo l'app.
 *
 * Il testo delle fonti arriva ritagliato sull'intervallo del capitolo: mai il
 * corpus intero, mai un materiale intero se il capitolo ne usa dieci minuti.
 */

const fs = require('fs');
const path = require('path');
const corpus = require('./corpus');
const chunk = require('./chunk');
const mdser = require('./mdser');
const validate = require('./validate');
const mat = require('./materiali');    // Trascrizioni/Indici: prima dentro il corso, poi nel vault
const corsiLib = require('./corsi');   // le lezioni vivono in LEZIONI/ (o nella radice, nei corsi vecchi)
const provider = require('./ai/provider');

function chiamaDefault(opts) { return provider.completa(opts); }

const SISTEMA = [
  // la lingua non si nomina qui: la impone provider.completa() a ogni chiamata (vedi lib/lingua.js)
  'Scrivi UN capitolo di una lezione di studio, a partire dal materiale che ti viene dato.',
  '',
  'Regole non negoziabili:',
  '- usa SOLO il materiale fornito: non aggiungere nozioni che non ci sono, non inventare esempi',
  '  attribuendoli alla fonte; se il materiale non basta per un punto, ometti quel punto;',
  '- «contenuto» è markdown semplice: paragrafi, elenchi con «-», **grassetto**, *corsivo*.',
  '  NON usare HTML, NON usare intestazioni, NON usare blocchi di codice;',
  /* Il riferimento alla fonte ha UNA forma sola, e vale per tutti i tipi di
     materiale. Finché le forme ammesse erano due — il link oppure la nota a piè
     di pagina — il modello sceglieva la nota ogni volta che la fonte era un
     documento scritto, perché è così che si cita un libro. Misurato sul corpus
     vero: i video citati con un link in 123 capitoli su 123, i PDF in 17 su 87.
     Gli altri 70 dicevano «Materiale 03, p. 7» in prosa: chi legge non ci può
     cliccare, e il riquadro delle fonti in fondo al capitolo resta un elenco a
     cui il testo non rimanda mai. */
  '- OGNI riferimento alla fonte è un LINK, mai una frase:',
  '      video      → [vai a 12:30](video:05#t=750)   dopo «t=» ci sono i SECONDI;',
  '      documento  → [p. 7](pdf:03#p=7)              dopo «p=» c\'è il numero di PAGINA.',
  '      figura     → ![che cosa mostra](fig:03#p=7&i=2)   SOLO se il blocco del materiale',
  '                   elenca quella figura: sono ritagli veri, e uno che non è in elenco non esiste.',
  '  Una figura si inserisce dove il testo la sta spiegando, e la didascalia dice che cosa mostra —',
  '  non «Figura 2»: quello lo si vede già. Se una figura non aggiunge niente, non metterla;',
  '  Il numero del materiale è quello fra parentesi quadre nell\'intestazione del blocco;',
  '  secondi e pagine si leggono dai marcatori dentro al testo che ricevi: [12:30 = 750s] e [p. 7];',
  '- ogni materiale che il capitolo usa va citato almeno una volta con un link. Un documento si',
  '  cita a pagina esattamente come un video si cita al minuto: non «più avanti nella dispensa»;',
  '- non scrivere MAI in prosa il numero del materiale, la pagina o il minuto — «Materiale 03»,',
  '  «a p. 7», «al minuto 12», «nella lezione 5». Quell\'informazione è il link, e in prosa è morta;',
  '- «quiz»: ogni domanda è un\'AFFERMAZIONE da giudicare vera o falsa, mai una domanda aperta.',
  '  «a» è true se l\'affermazione è vera. «perche» spiega la risposta;',
  '- «glossario»: i termini tecnici che il capitolo introduce, spiegati in una riga;',
  '- «title» non comincia con una cifra e non ripete il numero del capitolo;',
  '- «footnotes» sono note di CONTENUTO: una precisazione, un\'obiezione, un riferimento esterno.',
  '  NON sono il posto dove indicare la fonte del capitolo — per quella c\'è il link.',
  '  Se citi una nota, usa [^1] nel testo e mettine il testo in «footnotes», nell\'ordine.'
].join('\n');

// ------------------------------------------------------------ testo di fonte

/* `corso` (ultimo, facoltativo) chiude la ricerca dentro il corso attivo.
   Senza, `mat.trova` scorre le cartelle di TUTTI i corsi: dopo la rinumerazione
   per corso due materiali diversi possono chiamarsi «03 …», e il capitolo
   verrebbe scritto sul testo del corso sbagliato. */

/** Il testo di un video fra due secondi. */
function testoVideo(vault, nome, da, a, corso) {
  const stem = nome.replace(/\.[a-z0-9]+$/i, '');
  const tr = corpus.readJson(mat.trova(vault, 'Trascrizioni', stem + '.json', corso, !!corso));
  if (!tr || !Array.isArray(tr.segments)) return '';
  const dentro = tr.segments.filter((s) => {
    const ini = Number(s.start) || 0, fin = Number(s.end) || 0;
    return (da == null || fin >= da) && (a == null || ini <= a);
  });
  return chunk.testoConMinutaggi(dentro.length ? dentro : tr.segments, 60);
}

/** Il testo di un PDF fra due pagine. */
function testoPdf(vault, nome, da, a, corso) {
  const stem = nome.replace(/\.[a-z0-9]+$/i, '');
  const idx = corpus.readJson(mat.trova(vault, 'Indice-PDF', stem + '.json', corso, !!corso));
  if (!idx || !Array.isArray(idx.pages)) return '';
  const dentro = idx.pages.filter((p) => (da == null || p.page >= da) && (a == null || p.page <= a));
  return chunk.testoConPagine(dentro.length ? dentro : idx.pages);
}

/** Il contenuto di una pagina web, eventualmente ridotto ai blocchi richiesti. */
function testoHtml(vault, nome, da, a, corso) {
  const stem = nome.replace(/\.[a-z0-9]+$/i, '');
  const idx = corpus.readJson(mat.trova(vault, 'Indice-HTML', stem + '.json', corso, !!corso));
  if (!idx) return '';
  const blocchi = String(idx.testo || '').split(/\n{2,}/);
  if (da == null && a == null) return blocchi.join('\n\n');
  const dentro = blocchi.slice(Math.max(0, (da || 1) - 1), a || blocchi.length);
  return (dentro.length ? dentro : blocchi).join('\n\n');
}

/**
 * Le figure che la rilettura avanzata ha ritagliato da questo documento, nelle
 * pagine che il capitolo copre.
 *
 * Perché offrirle: senza, il modello non può citare uno schema che non sa che
 * esiste — e le ore di rilettura producono ritagli che nessun capitolo mostra.
 * Si offrono con **la didascalia generata**, che è ciò che permette di scegliere
 * quale serve: un elenco di «figura 1, figura 2» sarebbe un elenco di scatole
 * chiuse, e il modello sceglierebbe a caso.
 */
function figureDelPdf(vault, nome, da, a, corso) {
  const stem = nome.replace(/\.[a-z0-9]+$/i, '');
  const idx = corpus.readJson(mat.trova(vault, 'Indice-PDF', stem + '.json', corso, !!corso));
  if (!idx || !Array.isArray(idx.figure) || !idx.figure.length) return [];
  const perPagina = new Map();
  return idx.figure
    .filter((f) => f && Number.isFinite(Number(f.p)))
    .filter((f) => (da == null || f.p >= da) && (a == null || f.p <= a))
    .map((f) => {
      /* L'indice dentro la pagina lo conta chi legge, non chi ha scritto il
         file: `ocr.py` numera i ritagli nell'ordine in cui li trova, e quello
         stesso ordine è il nome del file (`__p007_f2.webp`). Ricavarlo qui
         significa non dover leggere anche i nomi dei file per citarli. */
      const n = (perPagina.get(f.p) || 0) + 1;
      perPagina.set(f.p, n);
      return { p: Number(f.p), i: n, tipo: f.tipo || 'figura', didascalia: String(f.didascalia || '').trim() };
    });
}

/** Il testo della fonte di un capitolo, ritagliato sull'intervallo dichiarato. */
function testoFonte(vault, materiale, fonte, corso) {
  if (!materiale) return '';
  const da = Number.isFinite(fonte.da) ? fonte.da : null;
  const a = Number.isFinite(fonte.a) ? fonte.a : null;
  if (materiale.tipo === 'pdf') return testoPdf(vault, materiale.nome, da, a, corso);
  if (materiale.tipo === 'html') return testoHtml(vault, materiale.nome, da, a, corso);
  return testoVideo(vault, materiale.nome, da, a, corso);
}

/**
 * Come si cita QUESTO materiale, scritto accanto al materiale stesso.
 *
 * La forma del rimando sta già nelle regole di sistema, ma là è una regola fra
 * dieci e parla di un materiale generico. Ripeterla qui, con il numero vero
 * davanti agli occhi, è la differenza fra «so che i PDF si citano a pagina» e
 * «questo blocco si cita con pdf:03».
 */
function comeCitare(m, num) {
  if (m.tipo === 'pdf') return 'citalo così: [etichetta](pdf:' + num + '#p=PAGINA), la pagina dai marcatori [p. N]';
  if (m.tipo === 'video') return 'citalo così: [etichetta](video:' + num + '#t=SECONDI), i secondi dai marcatori [m:ss = Ns]';
  return 'citalo per esteso nel testo: questo materiale non ha un rimando puntuale';
}

/**
 * Il paragrafo che elenca le figure disponibili di un materiale, con la forma
 * esatta con cui si citano. Vuoto se non ce ne sono: un elenco vuoto nel prompt
 * insegnerebbe al modello che la sintassi esiste ma non c'è niente da citare, e
 * qualcuno la userebbe a vuoto.
 */
function elencoFigure(vault, m, f, corso) {
  if (m.tipo !== 'pdf') return '';
  const da = Number.isFinite(f.da) ? f.da : null;
  const a = Number.isFinite(f.a) ? f.a : null;
  const figs = figureDelPdf(vault, m.nome, da, a, corso);
  if (!figs.length) return '';
  const righe = figs.map((g) => '- p. ' + g.p + ' · ' + g.tipo + (g.didascalia ? ' — ' + g.didascalia : '') +
    '  →  ![didascalia](fig:' + f.materiale + '#p=' + g.p + '&i=' + g.i + ')');
  return '\n\n**Figure ritagliate da questo documento** (inseriscile nel testo SOLO dove aggiungono ' +
    'qualcosa a ciò che stai spiegando, con una didascalia tua che dica che cosa mostrano):\n' + righe.join('\n');
}

/** Il blocco «materiale» del prompt: una fonte per volta, con la sua etichetta. */
function testoFonti(vault, capitolo, perNumero, corso) {
  const pezzi = [];
  for (const f of (capitolo.fonti || [])) {
    const m = perNumero[f.materiale];
    if (!m) continue;
    const t = testoFonte(vault, m, f, corso);
    if (!t) continue;
    const misura = m.tipo === 'video' ? 'video' : m.tipo === 'pdf' ? 'documento' : 'pagina web';
    pezzi.push('### Materiale [' + f.materiale + '] «' + m.titolo + '» (' + misura + ') — ' +
      comeCitare(m, f.materiale) + '\n' + t + elencoFigure(vault, m, f, corso));
  }
  return pezzi.join('\n\n');
}

// ---------------------------------------------------------------- messaggio

/** Il messaggio utente per un capitolo. */
function messaggio(vault, lezione, capitolo, ordine, totale, perNumero, opts) {
  const o = opts || {};
  return [
    '## Lezione «' + (lezione.title || lezione.folder) + '»',
    'Capitolo ' + ordine + ' di ' + totale + ': «' + capitolo.titolo + '»',
    capitolo.sintesi ? 'Di che cosa deve trattare: ' + capitolo.sintesi : '',
    o.precedente ? 'Il capitolo precedente era: «' + o.precedente + '»' : '',
    o.successivo ? 'Il capitolo successivo sarà: «' + o.successivo + '»' : '',
    '',
    o.regoleForma || '',
    '',
    /* I wikilink erano l'unica cosa che il modello doveva indovinare: le regole
       di forma gli chiedono rimandi [[NN-slug]], ma l'elenco delle lezioni che
       esistono non gli arrivava mai. Se ne inventava uno plausibile, il
       validatore lo rifiutava, e dopo due giri il capitolo finiva negli scarti —
       sempre lo stesso, a ogni riscrittura. Qui l'elenco c'è. */
    Array.isArray(o.lezioni) && o.lezioni.length ? [
      '## Lezioni di questo corso (gli UNICI rimandi ammessi)',
      o.lezioni.map((l) => '- [[' + l + ']]').join('\n'),
      'Un rimando si scrive [[NN-slug]] copiato ALLA LETTERA da questa lista, o',
      '[[NN-slug|testo visibile]]. Non inventare nomi, non citare la lezione che stai',
      'scrivendo: se il rimando che vorresti non è in lista, scrivi la frase senza rimando.'
    ].join('\n') : '',
    '',
    '## Materiale da cui scrivere',
    testoFonti(vault, capitolo, perNumero, o.corso),
    '',
    'Scrivi il capitolo. Rispondi solo con la struttura richiesta.'
  ].filter((r) => r !== '').join('\n');
}

// ------------------------------------------------------------------ genera

/** Le mappe numero→file che servono al validatore per sciogliere i rimandi. */
function mappeDelVault(materiali) {
  const mediaByNum = {}, pdfByNum = {}, durate = {}, npagine = {};
  for (const m of materiali || []) {
    if (!m.num) continue;
    if (m.tipo === 'pdf') { pdfByNum[m.num] = m.nome; npagine[m.num] = m.npagine || 0; }
    else if (m.tipo === 'video') { mediaByNum[m.num] = m.nome; durate[m.num] = m.durata || 0; }
  }
  return { mediaByNum, pdfByNum, durate, npagine };
}

/**
 * I materiali che questo capitolo è tenuto a citare: quelli della sua scaletta
 * che il vault sa risolvere, senza doppioni.
 */
function fontiAttese(capitolo, perNumero) {
  const visti = new Set(); const out = [];
  for (const f of ((capitolo && capitolo.fonti) || [])) {
    const num = String(f.materiale || '').padStart(2, '0');
    const m = perNumero[f.materiale];
    if (!m || visti.has(num)) continue;
    visti.add(num); out.push({ num, tipo: m.tipo });
  }
  return out;
}

/**
 * Sostituisce i wikilink che non puntano a una lezione esistente col loro testo
 * visibile: `[[03-x|le comorbilità]]` → «le comorbilità», `[[03-x]]` → «x».
 * Quelli validi restano. `lezioni` vuoto = si controlla solo la forma.
 */
function togliWikilinkRotti(testo, lezioni) {
  const valide = Array.isArray(lezioni) ? lezioni : [];
  return testo.replace(/\[\[([^\]]+)\]\]/g, (tutto, dentro) => {
    const parti = String(dentro).split('|');
    const target = parti[0].trim();
    const ok = /^\d{2}-[a-z0-9-]+$/.test(target) && (!valide.length || valide.indexOf(target) >= 0);
    if (ok) return tutto;
    const etichetta = (parti[1] || '').trim();
    return etichetta || target.replace(/^\d{2}-/, '').replace(/-/g, ' ');
  });
}

/**
 * Genera UN capitolo: chiede, valida, e se serve chiede una sola correzione
 * mirata. Non scrive niente su disco — la scrittura è di chi chiama, così questa
 * funzione resta provabile senza toccare il filesystem.
 *
 * @returns {{dati, errori, uso, tentativi}}
 */
async function generaCapitolo(vault, lezione, capitolo, ordine, totale, materiali, ai, opts) {
  const o = opts || {};
  const perNumero = {};
  for (const m of materiali || []) if (m.num) perNumero[m.num] = m;
  const mappe = mappeDelVault(materiali);
  // i rimandi [[NN-lezione]] devono puntare a lezioni che esistono davvero: chi
  // chiama passa l'elenco, altrimenti resta il solo controllo di forma
  if (Array.isArray(o.lezioni) && o.lezioni.length) mappe.lezioni = o.lezioni;
  /* Le fonti che il capitolo dichiara di usare sono anche le fonti che deve
     citare. Il validatore da solo non può saperlo: vede il testo, non la
     scaletta da cui il testo nasce. */
  mappe.attesi = fontiAttese(capitolo, perNumero);
  const utente = messaggio(vault, lezione, capitolo, ordine, totale, perNumero, o);

  let uso = null, tentativi = 0, dati = null, errori = [];
  for (let giro = 0; giro < 2; giro++) {
    tentativi++;
    const extra = giro === 0 ? '' :
      '\n\nLa risposta precedente non è valida. Correggi ESATTAMENTE questi problemi e rispondi di nuovo:\n- ' +
      errori.join('\n- ');
    const r = await (ai.chiama || chiamaDefault)({
      fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua,
      fase: 'capitolo',
      sistema: SISTEMA, utente: utente + extra,
      schema: validate.schemaCapitolo(),
      maxTokens: 12000
    });
    uso = sommaUso(uso, r && r.uso);
    if (!r || !r.ok) { errori = [(r && r.errore) || 'nessuna risposta']; continue; }
    const v = validate.validateCapitolo(r.dati, mappe);
    if (v.ok) return { dati: r.dati, errori: [], uso, tentativi };
    dati = r.dati; errori = v.errors;
  }
  /* Rete di sicurezza: se dopo due giri restano SOLO wikilink rotti, il capitolo
     è buono e il difetto è un rimando. Buttarlo via costa un capitolo intero per
     un link; toglierlo lascia la frase leggibile. Se restano altri errori non si
     tocca niente: lì il testo è davvero da rifare. */
  if (dati && errori.length && errori.every((e) => /^wikilink /.test(e))) {
    const pulito = Object.assign({}, dati, { contenuto: togliWikilinkRotti(String(dati.contenuto || ''), mappe.lezioni) });
    const v = validate.validateCapitolo(pulito, mappe);
    if (v.ok) return { dati: pulito, errori: [], uso, tentativi, riparato: true };
  }
  return { dati, errori, uso, tentativi };
}

/**
 * Somma due conteggi d'uso, tollerando i nulli.
 *
 * ⚠️ Non ricostruisce più l'oggetto campo per campo: quell'elenco perdeva
 * `costoUsdDichiarato` e faceva finire nel registro **zero dollari** per tutto
 * ciò che si scrive con Claude Code. La somma vive in `lib/ai/provider.js`, dove
 * l'`uso` nasce, così un campo aggiunto là non muore qui.
 */
function sommaUso(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return provider.sommaUso([a, b]);
}

// ------------------------------------------------------------------ scrittura

/** Scrive un file in modo atomico: o c'è quello nuovo, o resta quello vecchio. */
function scriviAtomico(file, testo) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, testo, 'utf-8');
  fs.renameSync(tmp, file);
}

/** Il capitolo come file `.md` dentro la cartella della lezione. */
/**
 * I rimandi citati DENTRO il capitolo, raccolti dai link che il modello ha scritto.
 *
 * Il frontmatter ha `videoRefs` e `sources`, ed è da lì che il lettore costruisce
 * il riquadro delle fonti in fondo al capitolo. Nessuno però li riempiva: il
 * prompt chiede al modello di citare con `[vai a 12:30](video:05#t=750)` e lui
 * lo fa, ma gli elenchi restavano vuoti — così un capitolo pieno di rimandi non
 * mostrava nessuna fonte raccolta.
 *
 * Si ricavano qui, dal testo, invece di chiedere al modello una seconda lista
 * che ripete la prima: una cosa scritta due volte è una cosa che prima o poi
 * diverge, e questa non può, perché è la stessa.
 */
/**
 * L'etichetta di un rimando, ma solo se dice qualcosa.
 *
 * Nel testo il link si scrive «[vai a 12:30](video:01#t=750)», e quel «vai a
 * 12:30» è il testo giusto lì: sta in mezzo a una frase. Portato però nel
 * riquadro delle fonti diventa una riga che ripete se stessa —
 * «vai a 12:30 / Videolezione · 12:30» — dove ci si aspetta di leggere di che
 * cosa si parla in quel punto. Erano 86 voci su 996. Meglio nessuna etichetta:
 * senza, il lettore ripiega sul titolo del materiale, che almeno informa.
 */
function etichettaUtile(txt) {
  const t = String(txt || '').trim();
  if (!t) return undefined;
  const nudo = t.replace(/^(vai a|vedi|guarda|apri|ascolta|qui|cfr\.?)\s+/i, '')
    .replace(/^(a\s+)?(p\.|pag\.?|pagina|pagg\.)\s*/i, '')
    .replace(/^(al\s+)?(min\.|minuto)\s*/i, '')
    .replace(/[\s.,;:—–-]+$/, '').trim();
  // ciò che resta è solo un puntatore (12:30, 7, 1-4) oppure niente: non informa
  if (!nudo || /^[\d:\s.,\u2013\u2014-]+$/.test(nudo)) return undefined;
  return t;
}

function rimandiDa(dati) {
  const testo = [dati.contenuto, dati.inBreve]
    .concat(dati.puntiChiave || [], (dati.footnotes || []))
    .filter((x) => typeof x === 'string').join('\n');
  const video = new Map(), pdf = new Map();
  let m;
  const reV = /\[([^\]]*)\]\(video:(\d{1,3})#t=(\d+)\)/g;
  while ((m = reV.exec(testo))) {
    const k = m[2].padStart(2, '0') + '#' + m[3];
    if (!video.has(k)) video.set(k, { video: m[2].padStart(2, '0'), t: Number(m[3]), label: etichettaUtile(m[1]) });
  }
  const reP = /\[([^\]]*)\]\(pdf:(\d{1,3})#p=(\d+)\)/g;
  while ((m = reP.exec(testo))) {
    const k = m[2].padStart(2, '0') + '#' + m[3];
    if (!pdf.has(k)) pdf.set(k, { pdf: m[2].padStart(2, '0'), page: Number(m[3]), label: etichettaUtile(m[1]) });
  }
  /* Le figure: `![didascalia](fig:NN#p=7&i=2)`. Il punto esclamativo davanti è
     ciò che le distingue da un rimando normale, e la chiave comprende l'indice
     — due figure sulla stessa pagina sono due cose diverse, e senza `i` la
     seconda scomparirebbe dall'elenco restando visibile nel testo. */
  const fig = new Map();
  const reF = /!\[([^\]]*)\]\(fig:(\d{1,3})#p=(\d+)(?:&i=(\d+))?\)/g;
  while ((m = reF.exec(testo))) {
    const i = Number(m[4] || 1);
    const k = m[2].padStart(2, '0') + '#' + m[3] + '#' + i;
    if (!fig.has(k)) fig.set(k, { pdf: m[2].padStart(2, '0'), p: Number(m[3]), i, label: etichettaUtile(m[1]) });
  }
  const perNum = (a, b) => String(a.video || a.pdf).localeCompare(String(b.video || b.pdf), 'it', { numeric: true })
    || ((a.t != null ? a.t : a.page) - (b.t != null ? b.t : b.page));
  const perFig = (a, b) => String(a.pdf).localeCompare(String(b.pdf), 'it', { numeric: true }) || (a.p - b.p) || (a.i - b.i);
  return { videoRefs: Array.from(video.values()).sort(perNum), sources: Array.from(pdf.values()).sort(perNum),
           figure: Array.from(fig.values()).sort(perFig) };
}

/**
 * Fonde i rimandi dichiarati dal modello con quelli trovati nel testo.
 *
 * Non è un aut-aut: il modello ne dichiara alcuni e ne cita altri, e chi legge
 * deve ritrovare nel riquadro delle fonti tutti i punti che il capitolo tocca.
 * A parità di rimando (stesso materiale, stesso minuto o stessa pagina) vince
 * quello dichiarato: la sua etichetta è scritta per essere letta lì —
 * «Automazione: definizione ed esempi» invece di «vai a 2:11».
 */
function unisciRimandi(dichiarati, trovati, campoNum, campoPos) {
  const per = new Map();
  const chiave = (r) => String(r[campoNum] || '').padStart(2, '0') + '#' + (Number(r[campoPos]) || 0);
  for (const r of (Array.isArray(dichiarati) ? dichiarati : [])) {
    if (r && r[campoNum] != null) per.set(chiave(r), Object.assign({}, r, { [campoNum]: String(r[campoNum]).padStart(2, '0') }));
  }
  for (const r of (trovati || [])) if (!per.has(chiave(r))) per.set(chiave(r), r);
  return Array.from(per.values()).sort((a, b) =>
    String(a[campoNum]).localeCompare(String(b[campoNum]), 'it', { numeric: true }) ||
    ((Number(a[campoPos]) || 0) - (Number(b[campoPos]) || 0)));
}

/**
 * Le figure dichiarate dal modello più quelle citate nel testo, senza doppioni.
 *
 * Gemella di `unisciRimandi`, e separata per una ragione sola: qui l'identità è
 * la COPPIA pagina+indice. Passando da `unisciRimandi` — che chiave su un campo
 * solo — la seconda figura di una pagina sparirebbe dall'elenco pur restando
 * visibile nel testo, cioè il tipo di silenzio che questo progetto paga caro.
 */
function unisciFigure(dichiarate, trovate) {
  const per = new Map();
  const chiave = (f) => String(f.pdf || '').padStart(2, '0') + '#' + (Number(f.p || f.page) || 0) + '#' + (Number(f.i) || 1);
  for (const f of (Array.isArray(dichiarate) ? dichiarate : [])) {
    if (f && f.pdf != null) per.set(chiave(f), { pdf: String(f.pdf).padStart(2, '0'), p: Number(f.p || f.page) || 1, i: Number(f.i) || 1, label: f.label });
  }
  for (const f of (trovate || [])) if (!per.has(chiave(f))) per.set(chiave(f), f);
  return Array.from(per.values()).sort((a, b) =>
    String(a.pdf).localeCompare(String(b.pdf), 'it', { numeric: true }) || (a.p - b.p) || (a.i - b.i));
}

/**
 * L'id di un capitolo che ESISTE GIÀ in questa lezione, se lo si riconosce.
 *
 * ⚠️ È l'ultima cosa che tiene insieme il lavoro dell'utente attraverso una
 * rigenerazione. Appunti, evidenze, nodi di mappa e rimandi `cap:…` nominano un
 * capitolo col suo id: ricalcolarlo dall'ORDINE — com'era fino all'11 agosto
 * 2026 — significa che basta un capitolo infilato in mezzo perché tutti quelli
 * dopo cambino nome, e ogni riferimento scritto prima punti a un altro. Senza un
 * errore da nessuna parte: le parole chiave semplicemente non si accendono più.
 *
 * Si riconosce per TITOLO, non per posizione né per nome di file: il nome del
 * file contiene l'ordine (`03-slug.md`), quindi cambia proprio nel caso da cui
 * ci si vuole difendere. Il titolo è ciò che resta lo stesso quando un capitolo
 * scala di un posto.
 *
 * ⚠️ Un titolo cambiato è un capitolo che non si riconosce, e prende un id
 * nuovo. È il limite di questo rimedio, ed è dichiarato: l'identità vera si
 * darebbe alla scaletta, prima che il capitolo esista.
 */
/** I capitoli già scritti in questa lezione: `[{ file, titolo, id }]`.
 *  ⚠️ Le virgolette del frontmatter si tolgono qui: `id: "01-lez-c02"` letto con
 *  le virgolette dentro le riscriverebbe a ogni giro (`"\"01-lez-c02\""`), e
 *  dopo due rigenerazioni l'id non somiglia più a niente. Misurato. */
function capitoliSuDisco(vault, corso, lezioneFolder) {
  const d = corsiLib.lezioneDir(vault, corso, lezioneFolder);
  let files;
  try { files = fs.readdirSync(d); } catch (e) { return []; }
  const via = (v) => String(v == null ? '' : v).trim().replace(/^["']|["']$/g, '');
  const out = [];
  for (const f of files.sort()) {
    if (!/\.md$/i.test(f) || f.charAt(0) === '_') continue;
    let testo;
    try { testo = fs.readFileSync(path.join(d, f), 'utf-8').slice(0, 2000); } catch (e) { continue; }
    const mt = /^title:\s*(.*)$/m.exec(testo);
    const mi = /^id:\s*(.*)$/m.exec(testo);
    out.push({ file: f, titolo: mt ? via(mt[1]) : '', id: mi ? via(mi[1]) : '' });
  }
  return out;
}

function idEsistente(vault, corso, lezioneFolder, titolo) {
  const t = String(titolo == null ? '' : titolo).trim().toLowerCase();
  if (!t) return '';
  const trovato = capitoliSuDisco(vault, corso, lezioneFolder)
    .filter((c) => c.id && c.titolo.toLowerCase() === t)[0];
  return trovato ? trovato.id : '';
}

/**
 * Un id per un capitolo NUOVO, che non pesti quello di nessun altro.
 *
 * ⚠️ Il posizionale da solo non basta, e la prova lo ha smascherato: infilando
 * un capitolo al secondo posto, quello prendeva `…-c02` — che è l'id del
 * capitolo che stava lì e che intanto è scalato al terzo. Due capitoli con lo
 * stesso id vogliono dire che ogni appunto e ogni evidenza dell'uno si
 * ritrovano addosso all'altro: il danno che tutto questo lavoro esiste per
 * evitare, prodotto dal rimedio stesso.
 */
function idNuovo(presi, lezioneFolder, ordine) {
  const base = lezioneFolder + '-c' + mdser.nn(ordine);
  if (presi.indexOf(base) < 0) return base;
  for (let k = 2; k < 100; k++) {
    const tentativo = base + '-' + k;
    if (presi.indexOf(tentativo) < 0) return tentativo;
  }
  return base + '-' + Date.now();
}

function scriviCapitolo(vault, corso, lezioneFolder, ordine, dati, extra) {
  const nome = mdser.chapterFilename(ordine, dati.title);
  const file = path.join(corsiLib.lezioneDir(vault, corso, lezioneFolder), nome);
  const trovati = rimandiDa(dati);
  /* L'id si CONSERVA se questo capitolo c'era già; solo un capitolo nuovo ne
     riceve uno — e nuovo o vecchio, non deve mai coincidere con quello di un
     altro capitolo della stessa lezione. */
  const suDisco = capitoliSuDisco(vault, corso, lezioneFolder);
  const suo = (suDisco.filter((c) => c.id && c.titolo.toLowerCase() === String(dati.title || '').trim().toLowerCase())[0] || {}).id;
  const altrui = suDisco.filter((c) => c.id !== suo).map((c) => c.id);
  const md = mdser.chapter(Object.assign({
    id: suo || idNuovo(altrui, lezioneFolder, ordine),
    order: ordine,
    status: 'draft'
  }, dati, {
    /* DOPO `dati`, non prima: se il modello dichiara `videoRefs: []` — cosa che
       fa spesso — un valore calcolato messo prima verrebbe sovrascritto
       dall'elenco vuoto.
       E UNIONE, non aut-aut: la prima versione teneva la lista del modello
       *per intero* appena conteneva una voce, e i rimandi in più scritti nel
       testo sparivano. Su 258 capitoli erano 38 riquadri monchi e 87 rimandi
       persi: il capitolo citava un minuto che poi non compariva fra le fonti. */
    videoRefs: unisciRimandi(dati.videoRefs, trovati.videoRefs, 'video', 't'),
    sources: unisciRimandi(dati.sources, trovati.sources, 'pdf', 'page'),
    /* ⚠️ Le figure si fondono sulla coppia pagina+indice, non sulla sola
       pagina: `unisciRimandi` chiave su un campo solo, e due figure della
       stessa pagina si mangerebbero a vicenda. Qui la chiave la fa `figuraKey`. */
    figure: unisciFigure(dati.figure, trovati.figure)
  }, extra || {}));
  scriviAtomico(file, md);
  return { file: nome, percorso: file };
}

/** Un capitolo scartato finisce in quarantena, con gli errori accanto: si indaga dopo. */
function scriviScarto(vault, corso, lezioneFolder, ordine, dati, errori) {
  const dir = path.join(corsiLib.lavorazione(vault, corso), 'scarti');   // quarantena: sta con la lavorazione
  const nome = lezioneFolder + '-c' + mdser.nn(ordine) + '.json';
  scriviAtomico(path.join(dir, nome), JSON.stringify({ lezione: lezioneFolder, ordine, errori, dati }, null, 1));
  return nome;
}

module.exports = {
  SISTEMA, testoVideo, testoPdf, testoHtml, testoFonte, testoFonti, comeCitare,
  messaggio, mappeDelVault, fontiAttese, generaCapitolo, togliWikilinkRotti, sommaUso, etichettaUtile, rimandiDa, unisciRimandi, unisciFigure,
  scriviCapitolo, scriviScarto, scriviAtomico, idEsistente, capitoliSuDisco, idNuovo
};
