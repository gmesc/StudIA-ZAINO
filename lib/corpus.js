'use strict';
/**
 * corpus — costruisce il DIGEST dei materiali elaborati.
 *
 * Il digest è la sola cosa che viene mandata al modello nella fase di proposta:
 * mai il corpus intero (trappola «contesto lungo» del piano). Per ogni materiale:
 * numero, titolo, tipo, durata o pagine, un estratto di apertura e le parole
 * caratterizzanti calcolate localmente.
 *
 * Ogni passaggio è una funzione a sé: si testano e si sostituiscono uno per uno.
 */

const fs = require('fs');
const path = require('path');
const mat = require('./materiali');   // i materiali possono stare dentro il corso (o nel vault)

// ⚠️ La lista la dice `materiali.js`: la copia che stava qui non aveva
// `.ogg .opus .aiff`, e quei file non potevano entrare in un piano
const MEDIA_EXT = mat.EXT_MEDIA;

/**
 * I tipi che oggi possono entrare in un piano.
 *
 * `html` è **in freezer**: `schema/piano.schema.json` ammette solo video e pdf, e
 * la decisione presa è di non aprire quell'enum finché non si sa se le pagine web
 * passeranno da un OCR che ne cambia il tipo. Finché resta qui fuori, un corso
 * con dentro delle pagine web produce comunque un piano valido — prima non lo
 * produceva affatto, e l'errore di validazione arrivava all'utente come «piano
 * non valido» senza dire che il colpevole era l'HTML.
 */
const TIPI_PIANIFICABILI = ['video', 'pdf'];

// ------------------------------------------------------------------- lettura

/** Legge un JSON, o null se manca/è illeggibile. Non solleva mai. */
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch (e) { return null; }
}

/** Elenca i file di una cartella del vault (array vuoto se non esiste). */
function listDir(dir) {
  try { return fs.readdirSync(dir).sort(); } catch (e) { return []; }
}

/** "05 TD 74 LA DISLESSIA edu.galton.it.mp4" → "05" (o null). */
function numeroDi(nome) {
  const m = /^(\d{1,3})\b/.exec(String(nome || ''));
  return m ? m[1].padStart(2, '0') : null;
}

/** Toglie estensione, numero iniziale e code ricorrenti: resta il titolo utile. */
function titoloDi(nome) {
  return String(nome || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/^\d{1,3}[\s._-]*/, '')
    .replace(/\bTD\s*\d+\b/gi, '')
    .replace(/edu\.galton\.it/gi, '')
    .replace(/[\s._-]+/g, ' ')
    .trim();
}

// ------------------------------------------------------------ testo e durata

/** Concatena il testo dei segmenti di una trascrizione. */
function testoTrascrizione(tr) {
  if (!tr || !Array.isArray(tr.segments)) return '';
  return tr.segments.map((s) => String(s.text || '').trim()).filter(Boolean).join(' ');
}

/** Durata in secondi = fine dell'ultimo segmento. */
function durataTrascrizione(tr) {
  if (!tr || !Array.isArray(tr.segments) || !tr.segments.length) return 0;
  return Math.round(Number(tr.segments[tr.segments.length - 1].end) || 0);
}

/**
 * Il testo ufficiale che accompagna un video, quando esiste: le trascrizioni
 * fornite dall'autore della lezione hanno la terminologia giusta, dove Whisper può
 * sbagliare un nome proprio. I minutaggi restano quelli di Whisper: il testo
 * ufficiale non ne ha.
 */
function testoUfficiale(vault, stem, corso) {
  const f = mat.trova(vault, 'Trascrizioni', stem + '.ufficiale.txt', corso, !!corso);
  try { return f ? fs.readFileSync(f, 'utf-8').trim() : ''; }
  catch (e) { return ''; }
}

/** Il contenuto informativo di una pagina web indicizzata. */
function testoHtml(idx) {
  return idx ? String(idx.testo || '').trim() : '';
}

/** Concatena il testo delle pagine di un indice PDF. */
function testoPdf(idx) {
  if (!idx || !Array.isArray(idx.pages)) return '';
  return idx.pages.map((p) => String(p.text || '').trim()).filter(Boolean).join(' ');
}

/** Titolo di copertina: la prima riga sensata della prima pagina. */
function titoloCopertina(idx) {
  if (!idx || !Array.isArray(idx.pages) || !idx.pages.length) return '';
  const t = String(idx.pages[0].text || '').trim();
  return t.split(/\s{2,}|\n/)[0].slice(0, 120).trim();
}

/**
 * Titolo di un PDF: il nome del file batte quasi sempre la copertina, che nelle
 * lezioni è un frontespizio uguale per tutte («Corso di Formazione Tutor DSA…»).
 * La copertina si usa solo se il nome del file non dice niente.
 */
function titoloPdf(nome, idx) {
  const daNome = titoloDi(nome);
  if (daNome && daNome.replace(/[^a-zà-ÿ]/gi, '').length >= 8) return daNome;
  return titoloCopertina(idx) || daNome || nome;
}

/** Estratto di apertura, tagliato su un confine di parola. */
function estratto(testo, max) {
  const t = String(testo || '').replace(/\s+/g, ' ').trim();
  if (t.length <= (max || 400)) return t;
  return t.slice(0, max || 400).replace(/\s+\S*$/, '') + '…';
}

/** Marcatori temporali grezzi: ogni N secondi la frase che inizia lì. */
function ancoraggi(tr, ogniSec, max) {
  if (!tr || !Array.isArray(tr.segments)) return [];
  const passo = ogniSec || 300, out = [];
  let prossimo = 0;
  for (const s of tr.segments) {
    const t = Math.round(Number(s.start) || 0);
    if (t >= prossimo) {
      out.push({ t, testo: estratto(s.text, 90) });
      prossimo = t + passo;
      if (out.length >= (max || 12)) break;
    }
  }
  return out;
}

// ------------------------------------------------------------ parole chiave

// Le parole vuote di due lingue: le lezioni che l'utente porta dentro non sono
// sempre in italiano, e senza le inglesi le parole caratterizzanti di un corpus
// in inglese diventano «this», «that», «with».
const STOPWORDS = new Set((
  'di a da in con su per tra fra il lo la i gli le un uno una del dello della dei degli delle al allo alla ai agli alle dal dallo dalla dai dagli dalle nel nello nella nei negli nelle sul sullo sulla sui sugli sulle e ed o oppure ma però anche come che chi cui non più meno molto poco tutto tutti tutte questo questa questi queste quello quella quelli quelle è sono era erano essere stato stata sia siano ha hanno avere aveva avevano ci si se ne lo la li le mi ti vi loro suo sua sue suoi mio mia noi voi io tu egli quindi perché cioè cosa quando dove ecco proprio già ancora poi allora invece quasi circa dopo prima sempre mai qui qua lì là bene molto ogni fare fa fatto dice detto vedere visto grazie dunque insomma diciamo praticamente ok ' +
  'the this that these those there their them they then than with without within from into onto about above after before between during under over again once here when where while what which whom whose ' +
  'and but for nor yet so because although though unless until whether ' +
  'have has had having been being will would shall should could can cannot may might must does did doing done ' +
  'your yours you our ours we us its his her hers him she he it they i me my mine ' +
  'not only just very more most much many some any each every other another such own same both all none ' +
  'also however therefore thus hence indeed rather quite really actually simply well like well going get got make made take taken give given ' +
  'youll youre youve theyre thats dont doesnt cant wont isnt arent lets ' +
  'one two three four five first second third next last new way thing things use used using'
).split(' '));

/** Normalizza una parola: minuscolo, senza punteggiatura né accenti finali. */
function normalizzaParola(p) {
  return String(p || '').toLowerCase().replace(/[^a-zà-ÿ0-9-]/g, '');
}

/** Conta le parole significative di un testo. */
function conta(testo) {
  const freq = new Map();
  for (const grezza of String(testo || '').split(/\s+/)) {
    const p = normalizzaParola(grezza);
    if (p.length < 4 || STOPWORDS.has(p) || /^\d+$/.test(p)) continue;
    freq.set(p, (freq.get(p) || 0) + 1);
  }
  return freq;
}

/** Le n parole più frequenti del testo. */
function paroleChiave(testo, n) {
  return Array.from(conta(testo).entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n || 12)
    .map((e) => e[0]);
}

// ------------------------------------------------------------------- digest

/**
 * Il materiale che c'è sul disco ma non è ancora stato elaborato.
 *
 * Prima queste funzioni restituivano `null` e il materiale **spariva in silenzio**
 * dal digest. Un digest amputato non si vede: rende ciechi in modo coerente tutti
 * quelli che lo leggono — le schede ne fanno 12 su 37, il gate dell'80% confronta
 * 12 con 12 ed è sempre soddisfatto, `recuperaMancanti` cerca i mancanti dentro lo
 * stesso elenco monco e non ne trova. Così è nato un intero corpus di capitoli con
 * 156 citazioni video e zero PDF: i PDF non erano nel piano perché al momento della
 * proposta non erano ancora indicizzati, e nessuno lo ha detto.
 *
 * Ora il materiale resta, marcato: chi costruisce il piano lo esclude di proposito
 * e lo DICHIARA, invece di non saperlo.
 */
function nonElaborato(nome, tipo) {
  return { num: numeroDi(nome), nome, tipo, titolo: titoloDi(nome) || nome, indicizzato: false };
}

/** Digest di un singolo video/audio a partire dalla sua trascrizione. */
function digestMedia(vault, nome, corso) {
  const stem = nome.replace(/\.[a-z0-9]+$/i, '');
  const tr = readJson(mat.trova(vault, 'Trascrizioni', stem + '.json', corso, !!corso));
  if (!tr) return nonElaborato(nome, 'video');
  const daWhisper = testoTrascrizione(tr);
  const ufficiale = testoUfficiale(vault, stem, corso);
  const testo = ufficiale || daWhisper;          // per leggere: il testo migliore
  return {
    num: numeroDi(nome), nome, tipo: 'video', indicizzato: true,
    titolo: titoloDi(nome),
    durata: durataTrascrizione(tr),
    segmenti: (tr.segments || []).length,
    ufficiale: !!ufficiale,
    parole: testo.split(/\s+/).filter(Boolean).length,
    apertura: estratto(testo, 420),
    paroleChiave: paroleChiave(testo, 14),
    ancoraggi: ancoraggi(tr, 300, 12)            // per citare: i minuti restano di Whisper
  };
}

/** Digest di una pagina web a partire dal suo indice. */
function digestHtml(vault, nome, corso) {
  const stem = nome.replace(/\.[a-z0-9]+$/i, '');
  const idx = readJson(mat.trova(vault, 'Indice-HTML', stem + '.json', corso, !!corso));
  if (!idx) return nonElaborato(nome, 'html');
  const testo = testoHtml(idx);
  const immagini = (idx.immagini || []).filter((i) => !i.scartata);
  return {
    num: numeroDi(nome), nome, tipo: 'html', indicizzato: true,
    titolo: idx.titolo || titoloDi(nome),
    parole: testo.split(/\s+/).filter(Boolean).length,
    nimmagini: immagini.length,
    immagini: immagini.map((i) => ({ file: i.file, alt: i.alt, larghezza: i.larghezza, altezza: i.altezza })),
    apertura: estratto(testo, 420),
    paroleChiave: paroleChiave(testo, 14)
  };
}

/** Digest di un PDF a partire dal suo indice. */
function digestPdf(vault, nome, corso) {
  const stem = nome.replace(/\.[a-z0-9]+$/i, '');
  const idx = readJson(mat.trova(vault, 'Indice-PDF', stem + '.json', corso, !!corso));
  if (!idx) return nonElaborato(nome, 'pdf');
  const testo = testoPdf(idx);
  return {
    num: numeroDi(nome), nome, tipo: 'pdf', indicizzato: true,
    titolo: titoloPdf(nome, idx),
    npagine: Number(idx.npages) || (idx.pages || []).length,
    parole: testo.split(/\s+/).filter(Boolean).length,
    apertura: estratto(testo, 420),
    paroleChiave: paroleChiave(testo, 14),
    pagine: (idx.pages || []).slice(0, 40).map((p) => ({ p: p.page, testo: estratto(p.text, 70) }))
  };
}

/**
 * Elenca i materiali elaborati.
 *
 * Con `corso` guarda SOLO i suoi (vedi `mat.cartelle(..., solo)`): senza
 * questo confine il digest di un corso conteneva i materiali di tutti gli
 * altri, e chi legge il digest — le schede, la proposta dell'indice — li
 * trattava come propri.
 */
function materiali(vault, corso) {
  const out = [];
  const visti = new Set();
  for (const sub of ['Media', 'Fonti']) {
    for (const { nome: f } of mat.elenca(vault, sub, corso, !!corso)) {
      if (visti.has(f)) continue; visti.add(f);
      const ext = path.extname(f).toLowerCase();
      if (ext === '.pdf') out.push(digestPdf(vault, f, corso));
      else if (ext === '.html' || ext === '.htm') out.push(digestHtml(vault, f, corso));
      else if (MEDIA_EXT.includes(ext)) out.push(digestMedia(vault, f, corso));
    }
  }
  return out;
}

/** Ordina per numero (i senza numero in fondo, in ordine alfabetico). */
function ordina(lista) {
  return lista.slice().sort((a, b) => {
    if (a.num && b.num) return a.num.localeCompare(b.num);
    if (a.num) return -1;
    if (b.num) return 1;
    return a.nome.localeCompare(b.nome, 'it');
  });
}

/**
 * Digest completo del corpus, pronto da riassumere in un prompt.
 * Con `corso` è il corpus di QUEL corso; senza, tutto il vault (uso
 * storico: la riga di comando e i vault a corpus unico).
 *
 * `materiali` contiene i soli materiali ELABORATI: sono gli unici di cui si possa
 * dire qualcosa al modello. Quelli che stanno sul disco senza trascrizione né
 * indice non spariscono più, stanno in `senzaIndice`: chi decide qualcosa sul
 * corpus (il gate delle schede, l'approvazione del piano) deve poterli contare.
 */
function digest(vault, corso) {
  const tutti = ordina(materiali(vault, corso));
  const lista = tutti.filter((m) => m.indicizzato);
  const fuori = tutti.filter((m) => !m.indicizzato);
  return {
    totale: lista.length,
    video: lista.filter((m) => m.tipo === 'video').length,
    pdf: lista.filter((m) => m.tipo === 'pdf').length,
    html: lista.filter((m) => m.tipo === 'html').length,
    durataTotale: lista.reduce((s, m) => s + (m.durata || 0), 0),
    materiali: lista,
    senzaIndice: fuori,
    suDisco: tutti.length
  };
}

/**
 * Il digest ridotto a ciò che può davvero finire in un piano.
 *
 * Restituisce sempre le due liste: quella che va avanti e quella che resta fuori
 * col perché. Chi chiama è tenuto a dire all'utente che cosa ha lasciato indietro
 * — un materiale che sparisce senza una riga è esattamente il guasto da cui
 * nasce questa funzione.
 */
function perIlPiano(dg) {
  const dentro = (dg.materiali || []).filter((m) => TIPI_PIANIFICABILI.includes(m.tipo));
  const congelati = (dg.materiali || []).filter((m) => !TIPI_PIANIFICABILI.includes(m.tipo));
  return {
    dg: Object.assign({}, dg, {
      totale: dentro.length,
      video: dentro.filter((m) => m.tipo === 'video').length,
      pdf: dentro.filter((m) => m.tipo === 'pdf').length,
      html: 0,
      durataTotale: dentro.reduce((s, m) => s + (m.durata || 0), 0),
      materiali: dentro
    }),
    congelati,
    senzaIndice: dg.senzaIndice || []
  };
}

/** Una riga sola che dice che cosa è rimasto fuori dal piano, o '' se non è rimasto niente. */
function avvisoEsclusi(congelati, senzaIndice) {
  const righe = [];
  const elenco = (l) => l.map((m) => m.num || m.nome).join(', ');
  if (senzaIndice && senzaIndice.length) {
    righe.push(senzaIndice.length + ' materiali non ancora elaborati restano fuori dal piano (' +
      elenco(senzaIndice) + '): trascrivili o indicizzali, poi rifai la proposta.');
  }
  if (congelati && congelati.length) {
    righe.push(congelati.length + ' pagine web restano fuori dal piano (' + elenco(congelati) +
      '): l\'uso degli HTML è sospeso.');
  }
  return righe.join(' ');
}

/** Riga compatta per il prompt: una per materiale, poche centinaia di caratteri. */
function rigaPerPrompt(m) {
  const misura = m.tipo === 'video' ? Math.round((m.durata || 0) / 60) + ' min'
    : m.tipo === 'html' ? Math.round((m.parole || 0) / 200) + ' min di lettura' +
      (m.nimmagini ? ', ' + m.nimmagini + ' immagini' : '')
      : (m.npagine || 0) + ' pagine';
  return '[' + (m.num || '--') + '] (' + m.tipo + ', ' + misura + ') ' + m.titolo +
    '\n    parole chiave: ' + (m.paroleChiave || []).slice(0, 10).join(', ') +
    '\n    apertura: ' + estratto(m.apertura, 240);
}

/** Il digest intero come testo per il prompt. */
function testoPerPrompt(dg) {
  return (dg.materiali || []).map(rigaPerPrompt).join('\n\n');
}

module.exports = {
  TIPI_PIANIFICABILI, nonElaborato, perIlPiano, avvisoEsclusi,
  readJson, listDir, numeroDi, titoloDi,
  testoTrascrizione, durataTrascrizione, testoUfficiale, testoHtml, testoPdf,
  titoloCopertina, titoloPdf, estratto, ancoraggi,
  normalizzaParola, conta, paroleChiave,
  digestMedia, digestPdf, digestHtml, materiali, ordina, digest,
  rigaPerPrompt, testoPerPrompt
};
