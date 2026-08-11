'use strict';
/**
 * validate — validazione degli oggetti che entrano nel vault.
 *
 * Due livelli:
 *  1. SCHEMA (ajv, schema/*.json): forma e vocabolari chiusi.
 *  2. SEMANTICA: ciò che lo schema non può sapere — riferimenti a materiali che
 *     esistono davvero, minutaggi dentro la durata, pagine dentro il PDF, niente
 *     HTML/fenced dentro `contenuto` (romperebbe il parser ristretto del renderer).
 *
 * Ritorna sempre { ok, errors[] } — mai eccezioni per input non valido.
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'schema');
let ajv = null;
const cache = {};

function getAjv() {
  if (ajv) return ajv;
  const Ajv = require('ajv');
  ajv = new Ajv({ allErrors: true, strict: false });
  return ajv;
}
function getValidator(name) {
  if (cache[name]) return cache[name];
  const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, name + '.schema.json'), 'utf-8'));
  cache[name] = getAjv().compile(schema);
  return cache[name];
}
function schemaErrors(name, obj) {
  const v = getValidator(name);
  if (v(obj)) return [];
  return (v.errors || []).map((e) => (e.instancePath || '/') + ' ' + e.message +
    (e.params && e.params.allowedValues ? ' (' + e.params.allowedValues.join('|') + ')' : ''));
}

// ------------------------------------------------------------------ profilo

function validateProfilo(p) {
  return { ok: schemaErrors('profilo', p).length === 0, errors: schemaErrors('profilo', p) };
}

// ----------------------------------------------------------------- capitolo

const LINK_RE = /\[[^\]]*\]\(([^)]+)\)/g;

/** Il corpo del capitolo: dove un rimando alla fonte deve comparire. */
function testoCitabile(c) {
  return [c.contenuto, c.inBreve].concat(c.puntiChiave || [])
    .filter((x) => typeof x === 'string').join('\n');
}

/**
 * Tutto ciò che l'allievo legge, note comprese.
 *
 * Le note vanno guardate proprio perché sono il nascondiglio preferito della
 * fonte scritta a parole: «Definizione ripresa da D. Hammill; Materiale 01
 * (video), min. 2:40». Il posto sembra giusto — è dove si mette una fonte in un
 * libro — ma qui la fonte è un oggetto che si apre, e una nota in prosa non si
 * apre.
 */
function testoLetto(c) {
  return [testoCitabile(c)].concat(c.footnotes || [])
    .filter((x) => typeof x === 'string').join('\n');
}

/**
 * Il numero del materiale detto a parole invece che con un link.
 *
 * «Materiale 03», «al minuto 12», «a p. 7»: informazione giusta in una forma
 * morta. Chi legge non ci può cliccare, e il riquadro delle fonti in fondo al
 * capitolo diventa un elenco a cui niente nel testo rimanda. Si cerca sul testo
 * PRIVATO dei link, altrimenti l'etichetta consigliata — «[p. 7](pdf:03#p=7)» —
 * si autodenuncerebbe.
 */
const PROSA_RE = [
  { re: /\bmateriale\s+n?\.?\s*\d{1,3}\b/i, che: 'il numero del materiale' },
  { re: /\b(?:video|lezione|videolezione)\s+n?\.?\s*\d{1,3}\b/i, che: 'il numero della lezione' },
  { re: /\bminut[oi]\s+\d{1,3}\b/i, che: 'il minuto' },
  { re: /\bmin\.\s*\d{1,3}\b/i, che: 'il minuto' },
  { re: /\bpagg?\.\s*\d{1,3}\b/i, che: 'la pagina' },
  { re: /\bp\.\s*\d{1,3}\b/i, che: 'la pagina' },
  { re: /\bpagin[ae]\s+\d{1,3}\b/i, che: 'la pagina' }
];
function citazioniInProsa(testo) {
  const nudo = String(testo || '').replace(/\[[^\]]*\]\([^)]*\)/g, ' ');
  return PROSA_RE.filter((p) => p.re.test(nudo)).map((p) => p.che);
}

/**
 * ctx (facoltativo): { mediaByNum, pdfByNum, durate: {NN: secondi}, pagine: {NN: n},
 *                      attesi: [{num, tipo}] }
 * Senza ctx si controlla solo ciò che non dipende dal corpus.
 */
function validateCapitolo(c, ctx) {
  ctx = ctx || {};
  const errors = schemaErrors('capitolo', c);
  if (!c || typeof c !== 'object') return { ok: false, errors: errors.concat(['capitolo non è un oggetto']) };

  const testo = String(c.contenuto || '');

  // 1. niente HTML grezzo né blocchi fenced: mdToHtml del renderer non li regge
  if (/<[a-zA-Z][^>]*>/.test(testo)) errors.push('contenuto: HTML grezzo non ammesso');
  if (/```/.test(testo)) errors.push('contenuto: blocchi fenced non ammessi (quiz e glossario sono campi a parte)');

  // 2. link: solo video:NN#t=, pdf:NN#p=, https:, wikilink [[NN-slug]]
  let m;
  while ((m = LINK_RE.exec(testo))) {
    const href = m[1].trim();
    const mv = /^video:(\d{2})#t=(\d+)$/.exec(href);
    const mp = /^pdf:(\d{2})#p=(\d+)$/.exec(href);
    if (mv) {
      const nn = mv[1], t = parseInt(mv[2], 10);
      if (ctx.mediaByNum && !ctx.mediaByNum[nn]) errors.push('link video:' + nn + ' — materiale inesistente');
      if (ctx.durate && ctx.durate[nn] != null && t > ctx.durate[nn]) errors.push('link video:' + nn + '#t=' + t + ' oltre la durata (' + ctx.durate[nn] + 's)');
    } else if (mp) {
      const nn = mp[1], pg = parseInt(mp[2], 10);
      if (ctx.pdfByNum && !ctx.pdfByNum[nn]) errors.push('link pdf:' + nn + ' — materiale inesistente');
      if (pg < 1) errors.push('link pdf:' + nn + '#p=' + pg + ' — pagina < 1');
      if (ctx.pagine && ctx.pagine[nn] != null && pg > ctx.pagine[nn]) errors.push('link pdf:' + nn + '#p=' + pg + ' oltre le pagine (' + ctx.pagine[nn] + ')');
    } else if (/^fig:/.test(href)) {
      /* La figura ritagliata da un documento: `![didascalia](fig:NN#p=7&i=2)`.
         Si controlla come un `pdf:` — è lo stesso documento, alla stessa pagina
         — più l'indice della figura dentro la pagina, che parte da 1: un `i=0`
         non punterebbe a nessun ritaglio e nel capitolo lascerebbe una casella
         vuota, cioè un guasto che si vede solo leggendo. */
      const mf = /^fig:(\d{2})#p=(\d+)(?:&i=(\d+))?$/.exec(href);
      if (!mf) { errors.push('link figura malformato: ' + href + ' — atteso fig:NN#p=PAGINA&i=INDICE'); continue; }
      const nn = mf[1], pg = parseInt(mf[2], 10), idx = mf[3] == null ? 1 : parseInt(mf[3], 10);
      if (ctx.pdfByNum && !ctx.pdfByNum[nn]) errors.push('link fig:' + nn + ' — materiale inesistente');
      if (pg < 1) errors.push('link fig:' + nn + '#p=' + pg + ' — pagina < 1');
      if (ctx.pagine && ctx.pagine[nn] != null && pg > ctx.pagine[nn]) errors.push('link fig:' + nn + '#p=' + pg + ' oltre le pagine (' + ctx.pagine[nn] + ')');
      if (idx < 1) errors.push('link fig:' + nn + '#p=' + pg + '&i=' + idx + ' — l\'indice della figura parte da 1');
    } else if (!/^https:\/\//.test(href)) {
      errors.push('link non ammesso: ' + href);
    }
  }

  // 3. wikilink nella forma che il reader riconosce, e verso una lezione che esiste.
  //    Il secondo controllo conta soprattutto quando un corso cresce: un
  //    rimando a una lezione mai scritta (o rinominata) manda l'allievo nel vuoto.
  const wl = testo.match(/\[\[([^\]]+)\]\]/g) || [];
  for (const w of wl) {
    const dentro = w.slice(2, -2);
    const target = dentro.split('|')[0].trim();      // [[02-comorbidita|le comorbilità]]
    if (!/^\d{2}-[a-z0-9-]+$/.test(target)) { errors.push('wikilink fuori formato: ' + w + ' (atteso NN-slug)'); continue; }
    if (Array.isArray(ctx.lezioni) && ctx.lezioni.length && ctx.lezioni.indexOf(target) < 0) {
      errors.push('wikilink [[' + target + ']] — nel corso non c\'è una lezione con questo nome');
    }
  }

  // 4. footnote: ogni [^n] citata deve esistere nell'array e viceversa
  const usate = new Set((testo.match(/\[\^(\d+)\]/g) || []).map((s) => parseInt(s.slice(2, -1), 10)));
  const n = Array.isArray(c.footnotes) ? c.footnotes.length : 0;
  for (const u of usate) if (u < 1 || u > n) errors.push('footnote [^' + u + '] senza testo corrispondente');
  for (let i = 1; i <= n; i++) if (!usate.has(i)) errors.push('footnote ' + i + ' mai citata nel testo');

  // 5. riferimenti dichiarati nel frontmatter
  for (const v of (c.videoRefs || [])) {
    if (ctx.mediaByNum && !ctx.mediaByNum[v.video]) errors.push('videoRefs: materiale ' + v.video + ' inesistente');
    if (ctx.durate && ctx.durate[v.video] != null && v.t > ctx.durate[v.video]) errors.push('videoRefs: t=' + v.t + ' oltre la durata di ' + v.video);
  }
  for (const s of (c.sources || [])) {
    if (ctx.pdfByNum && !ctx.pdfByNum[s.pdf]) errors.push('sources: materiale ' + s.pdf + ' inesistente');
    if (ctx.pagine && ctx.pagine[s.pdf] != null && s.page > ctx.pagine[s.pdf]) errors.push('sources: pagina ' + s.page + ' oltre il PDF ' + s.pdf);
  }

  /* 6. le fonti del capitolo vanno citate, e citate con un link.
        Una regola scritta solo nel prompt è una raccomandazione: il modello la
        segue per i video e la disattende per i documenti, e nessuno se ne
        accorge finché non si contano i capitoli. Qui diventa un errore, e
        l'errore rientra nel giro di correzione già previsto da generaCapitolo. */
  const citabile = testoCitabile(c);
  const citati = new Set();
  let mm;
  const CIT_RE = /\[[^\]]*\]\((video|pdf):(\d{1,3})#[tp]=\d+\)/g;
  while ((mm = CIT_RE.exec(citabile))) citati.add(mm[1] + ':' + mm[2].padStart(2, '0'));
  for (const a of (ctx.attesi || [])) {
    if (a.tipo !== 'video' && a.tipo !== 'pdf') continue;      // le pagine web non hanno un punto a cui rimandare
    const nn = String(a.num || '').padStart(2, '0');
    if (!nn || citati.has(a.tipo + ':' + nn)) continue;
    errors.push('il materiale ' + nn + ' (' + (a.tipo === 'pdf' ? 'documento' : 'video') +
      ') non è mai citato: serve almeno un link ' +
      (a.tipo === 'pdf' ? '[etichetta](pdf:' + nn + '#p=PAGINA)' : '[etichetta](video:' + nn + '#t=SECONDI)'));
  }
  for (const che of citazioniInProsa(testoLetto(c))) {
    errors.push('compare ' + che + ' scritto a parole: va sostituito con un link alla fonte');
  }

  // 7. quiz vero/falso: `q` deve essere un'affermazione, non una domanda
  for (const q of (c.quiz || [])) {
    if (/\?\s*$/.test(q.q || '')) errors.push('quiz: «' + String(q.q).slice(0, 40) + '…» è una domanda; per il vero/falso serve un\'affermazione');
    if (!String(q.perche || '').trim()) errors.push('quiz: campo «perche» vuoto');
  }

  return { ok: errors.length === 0, errors };
}

/** Lo schema grezzo, per chiederlo come structured output al modello. */
function schemaDi(nome) {
  return JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, nome + '.schema.json'), 'utf-8'));
}
function schemaCapitolo() { return schemaDi('capitolo'); }

module.exports = { validateProfilo, validateCapitolo, schemaErrors, schemaDi, schemaCapitolo,
  testoCitabile, testoLetto, citazioniInProsa };
