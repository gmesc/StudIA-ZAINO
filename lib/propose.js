'use strict';
/**
 * propose — stadio 1 della pipeline: dal corpus alla PROPOSTA di indice delle lezioni.
 *
 * Flusso: digest → candidati euristici → (se c'è una chiave) revisione del modello
 * → normalizzazione → validazione → `_piano.json`.
 *
 * Due garanzie:
 *  - senza chiave API funziona lo stesso, con i soli candidati euristici;
 *  - qualunque cosa risponda il modello, la COPERTURA è ricontrollata qui:
 *    nessun materiale può sparire e nessuno può comparire dal nulla.
 */

const fs = require('fs');
const path = require('path');
const corpus = require('./corpus');
const grouping = require('./grouping');
const profiloLib = require('./profilo');
const validate = require('./validate');
const provider = require('./ai/provider');

// ------------------------------------------------------------------- prompt

const SISTEMA = [
  /* «progettista di percorsi di studio» diceva la cosa giusta finché «percorso»
     era una parola comune. Da quando il Percorso è un oggetto dell'app — la
     traversata che sceglie una variante d'indice per ogni lezione — quel nome
     prometteva al modello un lavoro che non è il suo. */
  'Sei un instructional designer. Ricevi l\'elenco dei materiali di un corpus e una proposta di raggruppamento fatta da euristiche.',
  'Il tuo compito è correggere il raggruppamento in lezioni coerenti e ordinarle in una sequenza didattica sensata.',
  'Vincoli non negoziabili:',
  '- ogni materiale dell\'elenco deve comparire in ESATTAMENTE una lezione: non inventarne, non ometterne;',
  '- usa i numeri dei materiali così come sono;',
  '- il titolo di una lezione descrive il contenuto, non il formato;',
  '- «rationale» spiega in una frase perché quei materiali stanno insieme.'
].join('\n');

/** Elenco dei materiali per il prompt (digest compatto, mai il testo integrale). */
function elencoMateriali(dg) {
  return corpus.testoPerPrompt(dg);
}

/** I candidati euristici, riassunti per il modello. */
function elencoCandidati(candidati) {
  return candidati.map((c, i) =>
    (i + 1) + '. ' + c.title + ' — materiali: ' + c.materiali.map((m) => m.num || m.source).join(', ') + ' (' + c.rationale + ')'
  ).join('\n');
}

/** Il brief del corso, se c'è. */
function testoBrief(brief) {
  const b = brief || {};
  const righe = [];
  if (b.obiettivo) righe.push('Obiettivo: ' + b.obiettivo);
  if (b.priorita) righe.push('Cosa conta di più: ' + b.priorita);
  // il ruolo delle fonti: si dichiarano solo le eccezioni, il resto è ufficiale
  const perRuolo = {};
  for (const [num, ruolo] of Object.entries(b.fonti || {})) (perRuolo[ruolo] = perRuolo[ruolo] || []).push(num);
  const ETICHETTA = {
    integrazione: 'Fonti esterne aggiunte dall\'utente (autorevoli ma non canoniche del corso)',
    appunti: 'Appunti personali dell\'utente (utili, ma meno affidabili: non farne dipendere la struttura)',
    riferimento: 'Materiali da consultare e non da studiare in sequenza (adatti a un modulo di consultazione)'
  };
  for (const ruolo of Object.keys(perRuolo).sort()) {
    righe.push((ETICHETTA[ruolo] || ruolo) + ': ' + perRuolo[ruolo].sort().join(', '));
  }
  if (Object.keys(perRuolo).length) righe.push('Tutti gli altri materiali sono materiale ufficiale del corso.');
  if (b.indicazioni) righe.push('Indicazioni: ' + b.indicazioni);
  return righe.join('\n');
}

/** Messaggio utente completo per lo stadio 1. */
function messaggio(dg, candidati, brief, profilo) {
  return [
    '## Materiali del corpus (' + dg.totale + ')',
    elencoMateriali(dg),
    '',
    '## Raggruppamento proposto dalle euristiche',
    elencoCandidati(candidati),
    '',
    brief ? '## Brief del corso\n' + testoBrief(brief) : '',
    '',
    profiloLib.promptBlock(profilo || {}, 'proposta'),
    '',
    'Restituisci il raggruppamento corretto.'
  ].filter(Boolean).join('\n');
}

/** Schema della risposta attesa dal modello (più permissivo di quello del piano). */
function schemaRisposta() {
  return {
    type: 'object',
    properties: {
      lezioni: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            area: { type: 'string' },
            rationale: { type: 'string' },
            materiali: { type: 'array', items: { type: 'string' } }
          },
          required: ['title', 'materiali']
        }
      }
    },
    required: ['lezioni']
  };
}

// ------------------------------------------------------- normalizzazione AI

/** Indice numero → materiale del digest. */
function indicePerNumero(dg) {
  const idx = new Map();
  for (const m of dg.materiali || []) if (m.num) idx.set(String(m.num).padStart(2, '0'), m);
  return idx;
}

/** Materiale del piano a partire da un digest. */
function materialeDiPiano(m) {
  return { source: m.nome, type: m.tipo, num: m.num, titolo: m.titolo, durata: m.durata || 0, pagine: m.npagine || 0 };
}

/** Converte la risposta del modello nella forma-lezione, scartando i numeri inesistenti. */
function lezioniDaRisposta(risposta, dg) {
  const idx = indicePerNumero(dg);
  const usati = new Set();
  const lezioni = [];
  for (const c of (risposta && risposta.lezioni) || []) {
    const materiali = [];
    for (const rif of c.materiali || []) {
      const nn = String(rif).trim().padStart(2, '0');
      const m = idx.get(nn);
      if (!m || usati.has(nn)) continue;            // niente doppioni, niente invenzioni
      usati.add(nn);
      materiali.push(materialeDiPiano(m));
    }
    if (!materiali.length) continue;
    lezioni.push({
      folder: '', title: String(c.title || '').slice(0, 120),
      area: String(c.area || '').slice(0, 80),
      rationale: String(c.rationale || '').slice(0, 600),
      status: 'proposto', materiali, capitoli: []
    });
  }
  return { lezioni, usati };
}

/** I materiali che il modello ha dimenticato tornano in coda, in una lezione loro. */
function recuperaMancanti(lezioni, usati, dg) {
  const mancanti = (dg.materiali || []).filter((m) => m.num && !usati.has(String(m.num).padStart(2, '0')));
  if (!mancanti.length) return lezioni;
  return lezioni.concat([{
    folder: '', title: 'DA COLLOCARE', area: '',
    rationale: 'Materiali che la proposta automatica non ha collocato: assegnali tu.',
    status: 'proposto', materiali: mancanti.map(materialeDiPiano), capitoli: []
  }]);
}

/** Toglie dal titolo l'intervallo numerico iniziale ("04-06 DISLESSIA" → "DISLESSIA"). */
function titoloSenzaNumeri(titolo) {
  return String(titolo || '').replace(/^\s*\d{1,3}(\s*[-–]\s*\d{1,3})?[\s.:·-]*/, '').trim() || String(titolo || '');
}

/** Assegna cartelle numerate progressive, coerenti con la regex del reader. */
function numeraCartelle(lezioni) {
  return lezioni.map((c, i) => Object.assign({}, c, {
    folder: String(i + 1).padStart(2, '0') + '-' + grouping.slug(titoloSenzaNumeri(c.title), 40)
  }));
}

// ------------------------------------------------------------------- piano

/** Percorso del piano di un corso (in `_lavorazione/`, col ripiego sul vecchio posto). */
const corsiLib = require('./corsi');
function pianoPath(vault, corso) { return corsiLib.servizio(vault, corso, '_piano.json'); }

/** Legge il piano (null se non c'è). */
function leggiPiano(vault, corso) {
  try { return JSON.parse(fs.readFileSync(pianoPath(vault, corso), 'utf-8')); } catch (e) { return null; }
}

/** Scrive il piano in modo atomico, dopo averlo validato. */
function scriviPiano(vault, corso, piano) {
  const r = validate.schemaErrors('piano', piano);
  if (r.length) return { error: 'piano non valido: ' + r.slice(0, 3).join(' · ') };
  const file = pianoPath(vault, corso);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(piano, null, 2), 'utf-8');
  fs.renameSync(file + '.tmp', file);
  return { ok: true };
}

/** Costruisce l'oggetto piano. */
function costruisciPiano(corso, lezioni, opts) {
  const o = opts || {};
  return {
    schema: 2, course: corso, wizardStep: 3, status: 'proposto',
    granularity: o.granularita || 'atomico',
    origine: o.origine || 'euristica',
    aggiornato: o.adesso || new Date().toISOString(),
    brief: o.brief || {},
    lezioni: numeraCartelle(lezioni)
  };
}

// ---------------------------------------------------------------- proposta

/**
 * Il corpus su cui si costruisce un piano, già ripulito di ciò che non può
 * entrarci, con l'avviso pronto da mostrare. Passa da qui **ogni** proposta: se
 * una sola non ci passasse, tornerebbe a costruire piani su un corpus che non
 * corrisponde a quello che l'utente ha sul disco.
 */
function corpusDelPiano(vault, corso) {
  const r = corpus.perIlPiano(corpus.digest(vault, corso));
  return { dg: r.dg, avviso: corpus.avvisoEsclusi(r.congelati, r.senzaIndice) || null };
}

/** Proposta di solo calcolo locale: nessuna rete, nessun costo. */
function proponiEuristica(vault, corso, opts) {
  const { dg, avviso } = corpusDelPiano(vault, corso);
  const candidati = grouping.proponi(dg, { granularita: (opts && opts.granularita) || 'atomico' });
  return { dg, avviso, piano: costruisciPiano(corso, candidati, Object.assign({ origine: 'euristica' }, opts)) };
}

/** Unisce due avvisi tenendo quello che c'è: nessuno dei due deve coprire l'altro. */
function uniscoAvvisi(a, b) { return [a, b].filter(Boolean).join(' '); }

/**
 * Proposta completa. Se manca la chiave (o la chiamata fallisce) resta l'euristica,
 * e il motivo viene riportato: il wizard lo mostra invece di fingere che sia normale.
 */
async function proponi(vault, corso, opts) {
  const o = opts || {};
  const base = proponiEuristica(vault, corso, o);
  if (!o.apiKey || !o.fornitore) {
    return { piano: base.piano, origine: 'euristica',
      avviso: uniscoAvvisi('Nessuna chiave API: proposta costruita solo con le euristiche locali.', base.avviso) };
  }
  const dg = base.dg;
  const r = await provider.completa({
    fornitore: o.fornitore, modello: o.modello, apiKey: o.apiKey, lingua: o.lingua,
    fase: 'proposta',
    sistema: SISTEMA,
    utente: messaggio(dg, base.piano.lezioni, o.brief, o.profilo),
    schema: schemaRisposta(),
    maxTokens: 8000
  });
  if (!r.ok) {
    return { piano: base.piano, origine: 'euristica',
      avviso: uniscoAvvisi('Il modello non ha risposto (' + r.errore + '): resta la proposta euristica.', base.avviso) };
  }
  const { lezioni, usati } = lezioniDaRisposta(r.dati, dg);
  if (!lezioni.length) {
    return { piano: base.piano, origine: 'euristica',
      avviso: uniscoAvvisi('Risposta del modello inutilizzabile: resta la proposta euristica.', base.avviso) };
  }
  const completi = recuperaMancanti(lezioni, usati, dg);
  const piano = costruisciPiano(corso, completi, Object.assign({}, o, { origine: 'ai' }));
  return { piano, origine: 'ai', uso: r.uso, avviso: base.avviso };
}

// ------------------------------------------------- proposta multiagente (SOTA)

/** Aggiunge alla lezione i campi che arrivano dall'architettura (area, tipo). */
function arricchisciLezione(lezione, sorgente) {
  const c = Object.assign({}, lezione);
  if (sorgente.area) c.area = String(sorgente.area).slice(0, 80);
  if (sorgente.tipo === 'modulo-fonte') c.tipo = 'modulo-fonte';
  return c;
}

/** Rimandi e decisioni ripuliti per lo schema del piano. */
function normalizzaRimandi(arch) {
  return ((arch && arch.rimandi) || []).slice(0, 60).map((r) => ({
    da: String(r.da || '').slice(0, 120), a: String(r.a || '').slice(0, 120), perche: String(r.perche || '').slice(0, 400)
  })).filter((r) => r.da && r.a);
}
function normalizzaDecisioni(arch) {
  return ((arch && arch.decisioni) || []).slice(0, 40).map((d) => String(d).slice(0, 600)).filter(Boolean);
}

/**
 * Proposta con la pipeline multiagente: presuppone che le schede esistano.
 * `deps` permette ai test di iniettare architettura/schede finti.
 */
async function proponiMultiagente(vault, corso, opts, deps) {
  const o = opts || {};
  const d = deps || {};
  const schedeLib = d.schede || require('./schede');
  const archLib = d.architettura || require('./architettura');

  const { dg, avviso } = corpusDelPiano(vault, corso);
  const mappa = schedeLib.tutte(vault, corso, dg.materiali);
  const quante = Object.keys(mappa).length;
  if (!quante) return { errore: 'nessuna scheda: analizza prima i materiali' };

  const r = await archLib.costruisci(mappa, o.ai || {}, { onProgress: o.onProgress, revisione: o.revisione });
  if (r.errore) return { errore: r.errore, uso: r.uso };

  const { lezioni, usati } = lezioniDaRisposta(r.architettura, dg);
  const arricchiti = lezioni.map((c, i) => arricchisciLezione(c, (r.architettura.lezioni || [])[i] || {}));
  const completi = recuperaMancanti(arricchiti, usati, dg);
  const piano = costruisciPiano(corso, completi, Object.assign({}, o, { origine: 'multiagente' }));
  piano.rimandi = normalizzaRimandi(r.architettura);
  piano.decisioni = normalizzaDecisioni(r.architettura);
  return { piano, origine: 'multiagente', uso: r.uso, revisione: r.revisione, giri: r.giri, schedeUsate: quante, avviso };
}

module.exports = {
  SISTEMA, elencoMateriali, elencoCandidati, testoBrief, messaggio, schemaRisposta,
  arricchisciLezione, normalizzaRimandi, normalizzaDecisioni, proponiMultiagente,
  indicePerNumero, materialeDiPiano, lezioniDaRisposta, recuperaMancanti, titoloSenzaNumeri, numeraCartelle,
  pianoPath, leggiPiano, scriviPiano, costruisciPiano, corpusDelPiano, uniscoAvvisi, proponiEuristica, proponi
};
