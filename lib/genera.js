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
const mat = require('./materiali');
const progettiLib = require('./progetti');   // i corsi vivono in CORSI/ (o nella radice, nei progetti vecchi)   // Trascrizioni/Indici: prima dentro il progetto, poi nel vault
const provider = require('./ai/provider');

function chiamaDefault(opts) { return provider.completa(opts); }

const SISTEMA = [
  // la lingua non si nomina qui: la impone provider.completa() a ogni chiamata (vedi lib/lingua.js)
  'Scrivi UN capitolo di un corso di studio, a partire dal materiale che ti viene dato.',
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

/* `progetto` (ultimo, facoltativo) chiude la ricerca dentro il progetto attivo.
   Senza, `mat.trova` scorre le cartelle di TUTTI i progetti: dopo la rinumerazione
   per progetto due materiali diversi possono chiamarsi «03 …», e il capitolo
   verrebbe scritto sul testo del progetto sbagliato. */

/** Il testo di un video fra due secondi. */
function testoVideo(vault, nome, da, a, progetto) {
  const stem = nome.replace(/\.[a-z0-9]+$/i, '');
  const tr = corpus.readJson(mat.trova(vault, 'Trascrizioni', stem + '.json', progetto, !!progetto));
  if (!tr || !Array.isArray(tr.segments)) return '';
  const dentro = tr.segments.filter((s) => {
    const ini = Number(s.start) || 0, fin = Number(s.end) || 0;
    return (da == null || fin >= da) && (a == null || ini <= a);
  });
  return chunk.testoConMinutaggi(dentro.length ? dentro : tr.segments, 60);
}

/** Il testo di un PDF fra due pagine. */
function testoPdf(vault, nome, da, a, progetto) {
  const stem = nome.replace(/\.[a-z0-9]+$/i, '');
  const idx = corpus.readJson(mat.trova(vault, 'Indice-PDF', stem + '.json', progetto, !!progetto));
  if (!idx || !Array.isArray(idx.pages)) return '';
  const dentro = idx.pages.filter((p) => (da == null || p.page >= da) && (a == null || p.page <= a));
  return chunk.testoConPagine(dentro.length ? dentro : idx.pages);
}

/** Il contenuto di una pagina web, eventualmente ridotto ai blocchi richiesti. */
function testoHtml(vault, nome, da, a, progetto) {
  const stem = nome.replace(/\.[a-z0-9]+$/i, '');
  const idx = corpus.readJson(mat.trova(vault, 'Indice-HTML', stem + '.json', progetto, !!progetto));
  if (!idx) return '';
  const blocchi = String(idx.testo || '').split(/\n{2,}/);
  if (da == null && a == null) return blocchi.join('\n\n');
  const dentro = blocchi.slice(Math.max(0, (da || 1) - 1), a || blocchi.length);
  return (dentro.length ? dentro : blocchi).join('\n\n');
}

/** Il testo della fonte di un capitolo, ritagliato sull'intervallo dichiarato. */
function testoFonte(vault, materiale, fonte, progetto) {
  if (!materiale) return '';
  const da = Number.isFinite(fonte.da) ? fonte.da : null;
  const a = Number.isFinite(fonte.a) ? fonte.a : null;
  if (materiale.tipo === 'pdf') return testoPdf(vault, materiale.nome, da, a, progetto);
  if (materiale.tipo === 'html') return testoHtml(vault, materiale.nome, da, a, progetto);
  return testoVideo(vault, materiale.nome, da, a, progetto);
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

/** Il blocco «materiale» del prompt: una fonte per volta, con la sua etichetta. */
function testoFonti(vault, capitolo, perNumero, progetto) {
  const pezzi = [];
  for (const f of (capitolo.fonti || [])) {
    const m = perNumero[f.materiale];
    if (!m) continue;
    const t = testoFonte(vault, m, f, progetto);
    if (!t) continue;
    const misura = m.tipo === 'video' ? 'video' : m.tipo === 'pdf' ? 'documento' : 'pagina web';
    pezzi.push('### Materiale [' + f.materiale + '] «' + m.titolo + '» (' + misura + ') — ' +
      comeCitare(m, f.materiale) + '\n' + t);
  }
  return pezzi.join('\n\n');
}

// ---------------------------------------------------------------- messaggio

/** Il messaggio utente per un capitolo. */
function messaggio(vault, corso, capitolo, ordine, totale, perNumero, opts) {
  const o = opts || {};
  return [
    '## Corso «' + (corso.title || corso.folder) + '»',
    'Capitolo ' + ordine + ' di ' + totale + ': «' + capitolo.titolo + '»',
    capitolo.sintesi ? 'Di che cosa deve trattare: ' + capitolo.sintesi : '',
    o.precedente ? 'Il capitolo precedente era: «' + o.precedente + '»' : '',
    o.successivo ? 'Il capitolo successivo sarà: «' + o.successivo + '»' : '',
    '',
    o.regoleForma || '',
    '',
    '## Materiale da cui scrivere',
    testoFonti(vault, capitolo, perNumero, o.progetto),
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
 * Genera UN capitolo: chiede, valida, e se serve chiede una sola correzione
 * mirata. Non scrive niente su disco — la scrittura è di chi chiama, così questa
 * funzione resta provabile senza toccare il filesystem.
 *
 * @returns {{dati, errori, uso, tentativi}}
 */
async function generaCapitolo(vault, corso, capitolo, ordine, totale, materiali, ai, opts) {
  const o = opts || {};
  const perNumero = {};
  for (const m of materiali || []) if (m.num) perNumero[m.num] = m;
  const mappe = mappeDelVault(materiali);
  // i rimandi [[NN-corso]] devono puntare a corsi che esistono davvero: chi
  // chiama passa l'elenco, altrimenti resta il solo controllo di forma
  if (Array.isArray(o.corsi) && o.corsi.length) mappe.corsi = o.corsi;
  /* Le fonti che il capitolo dichiara di usare sono anche le fonti che deve
     citare. Il validatore da solo non può saperlo: vede il testo, non la
     scaletta da cui il testo nasce. */
  mappe.attesi = fontiAttese(capitolo, perNumero);
  const utente = messaggio(vault, corso, capitolo, ordine, totale, perNumero, o);

  let uso = null, tentativi = 0, dati = null, errori = [];
  for (let giro = 0; giro < 2; giro++) {
    tentativi++;
    const extra = giro === 0 ? '' :
      '\n\nLa risposta precedente non è valida. Correggi ESATTAMENTE questi problemi e rispondi di nuovo:\n- ' +
      errori.join('\n- ');
    const r = await (ai.chiama || chiamaDefault)({
      fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua,
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
  return { dati, errori, uso, tentativi };
}

/** Somma due conteggi d'uso, tollerando i nulli. Stessi nomi di campo del resto della pipeline. */
function sommaUso(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return {
    fornitore: b.fornitore || a.fornitore, modello: b.modello || a.modello,
    inputTokens: (a.inputTokens || 0) + (b.inputTokens || 0),
    outputTokens: (a.outputTokens || 0) + (b.outputTokens || 0),
    chiamate: (a.chiamate || 1) + (b.chiamate || 1)
  };
}

// ------------------------------------------------------------------ scrittura

/** Scrive un file in modo atomico: o c'è quello nuovo, o resta quello vecchio. */
function scriviAtomico(file, testo) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, testo, 'utf-8');
  fs.renameSync(tmp, file);
}

/** Il capitolo come file `.md` dentro la cartella del corso. */
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
  const perNum = (a, b) => String(a.video || a.pdf).localeCompare(String(b.video || b.pdf), 'it', { numeric: true })
    || ((a.t != null ? a.t : a.page) - (b.t != null ? b.t : b.page));
  return { videoRefs: Array.from(video.values()).sort(perNum), sources: Array.from(pdf.values()).sort(perNum) };
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

function scriviCapitolo(vault, progetto, corsoFolder, ordine, dati, extra) {
  const nome = mdser.chapterFilename(ordine, dati.title);
  const file = path.join(progettiLib.corsoDir(vault, progetto, corsoFolder), nome);
  const trovati = rimandiDa(dati);
  const md = mdser.chapter(Object.assign({
    id: corsoFolder + '-c' + mdser.nn(ordine),
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
    sources: unisciRimandi(dati.sources, trovati.sources, 'pdf', 'page')
  }, extra || {}));
  scriviAtomico(file, md);
  return { file: nome, percorso: file };
}

/** Un capitolo scartato finisce in quarantena, con gli errori accanto: si indaga dopo. */
function scriviScarto(vault, progetto, corsoFolder, ordine, dati, errori) {
  const dir = path.join(progettiLib.lavorazione(vault, progetto), 'scarti');   // quarantena: sta con la lavorazione
  const nome = corsoFolder + '-c' + mdser.nn(ordine) + '.json';
  scriviAtomico(path.join(dir, nome), JSON.stringify({ corso: corsoFolder, ordine, errori, dati }, null, 1));
  return nome;
}

module.exports = {
  SISTEMA, testoVideo, testoPdf, testoHtml, testoFonte, testoFonti, comeCitare,
  messaggio, mappeDelVault, fontiAttese, generaCapitolo, sommaUso, etichettaUtile, rimandiDa, unisciRimandi,
  scriviCapitolo, scriviScarto, scriviAtomico
};
