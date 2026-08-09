'use strict';
/**
 * schede — STADIO 0: un agente legge ogni materiale per intero e ne scrive la scheda.
 *
 * È il pezzo che riproduce il lavoro fatto a mano sul corpus di prova: là tre agenti
 * avevano letto tutti i 40 materiali e da quella lettura erano uscite le aree, i
 * capitoli con i minutaggi e le decisioni di merito. Le parole chiave non bastano:
 * qui si legge tutto, porzione per porzione, e si fonde in una scheda sola.
 *
 * Le schede si scrivono nel vault (`Corsi/<corso>/_schede/NN.json`): si pagano una
 * volta, poi le usano proposta, scalette e generazione.
 *
 * Ogni chiamata al modello passa da `chiama`, iniettabile: i test girano senza rete.
 */

const fs = require('fs');
const path = require('path');
const chunk = require('./chunk');
const corpus = require('./corpus');
const validate = require('./validate');
const mat = require('./materiali');   // Trascrizioni/Indici: prima dentro il corso, poi nel vault
const provider = require('./ai/provider');

// -------------------------------------------------------------------- prompt

const SISTEMA_PORZIONE = [
  'Sei un analista di materiali didattici. Leggi la porzione di materiale che ti viene data e descrivila con precisione.',
  'Regole:',
  '- non riassumere in modo generico: elenca i TEMI nell\'ordine in cui compaiono;',
  '- per ogni tema riporta il riferimento esatto che trovi nel testo: i marcatori [m:ss = Ns] per i video, [p. N] per i PDF;',
  '- «concetti» sono i termini tecnici realmente spiegati, non parole generiche;',
  '- se il materiale presuppone qualcosa di non spiegato qui, mettilo in «prerequisiti»;',
  '- non inventare: se un riferimento non c\'è, ometti il campo.'
].join('\n');

const SISTEMA_FUSIONE = [
  'Sei un analista di materiali didattici. Ricevi le analisi parziali delle porzioni di UN SOLO materiale, in ordine.',
  'Fondile in una scheda unica e coerente:',
  '- «sintesi»: che cosa insegna questo materiale, in 4-8 righe, concreto;',
  '- «temi»: la sequenza completa, senza doppioni fra porzioni contigue, con i riferimenti conservati;',
  '- «capitoliProposti»: come spezzeresti questo materiale in unità di studio, ognuna con il suo intervallo;',
  '- «prerequisiti» e «collegamenti»: cosa serve prima, e a cosa questo materiale si lega;',
  '- «livello»: teorico, applicativo, strumentale, normativo o misto.'
].join('\n');

/** Schema della risposta per una porzione (sottoinsieme della scheda). */
function schemaPorzione() {
  return {
    type: 'object',
    properties: {
      temi: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            titolo: { type: 'string' }, sintesi: { type: 'string' },
            da: { type: 'integer' }, a: { type: 'integer' }, pagine: { type: 'string' }
          },
          required: ['titolo']
        }
      },
      concetti: { type: 'array', items: { type: 'string' } },
      prerequisiti: { type: 'array', items: { type: 'string' } },
      note: { type: 'string' }
    },
    required: ['temi']
  };
}

/** Schema della scheda completa richiesta al modello. */
function schemaScheda() {
  const s = {
    type: 'object',
    properties: {
      sintesi: { type: 'string' },
      disciplina: { type: 'string' },
      livello: { type: 'string', enum: ['teorico', 'applicativo', 'strumentale', 'normativo', 'misto'] },
      temi: schemaPorzione().properties.temi,
      concetti: { type: 'array', items: { type: 'string' } },
      prerequisiti: { type: 'array', items: { type: 'string' } },
      collegamenti: { type: 'array', items: { type: 'string' } },
      capitoliProposti: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            titolo: { type: 'string' }, outline: { type: 'string' },
            da: { type: 'integer' }, a: { type: 'integer' }, pagine: { type: 'string' }
          },
          required: ['titolo']
        }
      },
      note: { type: 'string' }
    },
    required: ['sintesi', 'temi']
  };
  /* I tetti si dicono al modello, non solo al validatore.
     Erano dichiarati soltanto in schema/scheda.schema.json, cioè dove la
     risposta veniva GIUDICATA: chi doveva scriverla non li vedeva mai, e si
     sentiva rifiutare la scheda per una regola che nessuno gli aveva detto —
     dopo aver pagato ogni porzione e la fusione. Copiarli qui li rende una
     richiesta invece che una trappola. */
  const tetti = ((validate.schemaDi('scheda') || {}).properties) || {};
  for (const campo of Object.keys(s.properties)) {
    const max = tetti[campo] && tetti[campo].maxItems;
    if (max && s.properties[campo].type === 'array') s.properties[campo].maxItems = max;
  }
  return s;
}

/** Come si presenta una fonte, quando l'utente ne ha dichiarato il ruolo. */
const RUOLO_FONTE = {
  integrazione: 'fonte esterna aggiunta dall\'utente: autorevole, ma non fa parte del corso ufficiale',
  appunti: 'appunti personali dell\'utente: utili come traccia, ma possono essere incompleti o imprecisi',
  riferimento: 'materiale da consultare, non da studiare in sequenza'
};

/** Intestazione che accompagna ogni porzione. */
function intestazione(materiale, porzione, i, n) {
  const righe = [
    'Materiale [' + (materiale.num || '--') + '] «' + materiale.titolo + '»',
    'Tipo: ' + (materiale.tipo === 'pdf' ? 'documento PDF'
      : materiale.tipo === 'html' ? 'pagina web della lezione'
        : 'video/audio di lezione')
  ];
  if (RUOLO_FONTE[materiale.ruolo]) righe.push('Ruolo della fonte: ' + RUOLO_FONTE[materiale.ruolo]);
  righe.push('Porzione ' + (i + 1) + ' di ' + n + ' (' + chunk.etichetta(porzione, materiale.tipo) + ')');
  return righe.join('\n');
}

// ------------------------------------------------------------------ lettura

/** Porzioni di un materiale, a partire dai file già elaborati nel vault. */
function porzioniDi(vault, materiale) {
  const stem = materiale.nome.replace(/\.[a-z0-9]+$/i, '');
  if (materiale.tipo === 'pdf') {
    const idx = corpus.readJson(mat.trova(vault, 'Indice-PDF', stem + '.json'));
    return chunk.porzioniPdf(idx && idx.pages);
  }
  if (materiale.tipo === 'html') {
    const idx = corpus.readJson(mat.trova(vault, 'Indice-HTML', stem + '.json'));
    return chunk.porzioniHtml(idx && idx.testo);
  }
  const tr = corpus.readJson(mat.trova(vault, 'Trascrizioni', stem + '.json'));
  return chunk.porzioniTrascrizione(tr && tr.segments);
}

// ------------------------------------------------------------ persistenza

/** Cartella delle schede di un corso (in `_lavorazione/`, col ripiego sul vecchio posto). */
const corsiLib = require('./corsi');
function cartella(vault, corso) {
  const vecchia = path.join(corsiLib.radice(vault), corso, '_schede');
  if (fs.existsSync(vecchia)) return vecchia;
  return path.join(corsiLib.lavorazione(vault, corso), 'schede');
}

/** Nome file della scheda di un materiale. */
function nomeFile(materiale) {
  return (materiale.num || 'x') + '-' + String(materiale.nome).replace(/\.[a-z0-9]+$/i, '').replace(/[^A-Za-z0-9]+/g, '-').slice(0, 50) + '.json';
}

/** Legge la scheda già scritta, o null. */
function leggi(vault, corso, materiale) {
  try { return JSON.parse(fs.readFileSync(path.join(cartella(vault, corso), nomeFile(materiale)), 'utf-8')); }
  catch (e) { return null; }
}

/** Scrive la scheda in modo atomico. */
function scrivi(vault, corso, materiale, scheda) {
  const dir = cartella(vault, corso);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, nomeFile(materiale));
  fs.writeFileSync(file + '.tmp', JSON.stringify(scheda, null, 2), 'utf-8');
  fs.renameSync(file + '.tmp', file);
  return file;
}

/** Tutte le schede presenti per un corso, indicizzate per numero di materiale. */
function tutte(vault, corso, materiali) {
  const out = {};
  for (const m of materiali || []) {
    const s = leggi(vault, corso, m);
    if (s) out[m.num || m.nome] = s;
  }
  return out;
}

// ------------------------------------------------------------------ analisi

/** Chiamata di default al modello: quella vera. Nei test si inietta un'altra. */
function chiamaDefault(opts) { return provider.completa(opts); }

/** Analizza UNA porzione. */
async function analizzaPorzione(materiale, porzione, i, n, ai) {
  const r = await (ai.chiama || chiamaDefault)({
    fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua,
    fase: 'porzione',
    sistema: SISTEMA_PORZIONE,
    utente: intestazione(materiale, porzione, i, n) + '\n\n---\n' + porzione.testo,
    schema: schemaPorzione(),
    maxTokens: 4000
  });
  return r;
}

/** Fonde le analisi parziali in una scheda unica. */
async function fondiPorzioni(materiale, parziali, ai) {
  const testo = parziali.map((p, i) => '### Porzione ' + (i + 1) + '\n' + JSON.stringify(p, null, 1)).join('\n\n');
  const r = await (ai.chiama || chiamaDefault)({
    fornitore: ai.fornitore, modello: ai.modello, apiKey: ai.apiKey, lingua: ai.lingua,
    fase: 'fusione',
    sistema: SISTEMA_FUSIONE,
    utente: 'Materiale [' + (materiale.num || '--') + '] «' + materiale.titolo + '» (' +
      (materiale.tipo === 'pdf' ? materiale.npagine + ' pagine'
        : materiale.tipo === 'html' ? materiale.parole + ' parole'
          : Math.round((materiale.durata || 0) / 60) + ' minuti') + ')\n\n' + testo,
    schema: schemaScheda(),
    maxTokens: 6000
  });
  return r;
}

/** Somma i token usati da più chiamate. */
function sommaUso(usi) {
  return (usi || []).filter(Boolean).reduce((acc, u) => ({
    fornitore: u.fornitore || acc.fornitore, modello: u.modello || acc.modello,
    inputTokens: (acc.inputTokens || 0) + (u.inputTokens || 0),
    outputTokens: (acc.outputTokens || 0) + (u.outputTokens || 0),
    chiamate: (acc.chiamate || 0) + 1
  }), { inputTokens: 0, outputTokens: 0, chiamate: 0 });
}

/** Scheda di un solo materiale: legge tutte le porzioni e le fonde. */
async function analizzaMateriale(vault, corso, materiale, ai) {
  const porzioni = porzioniDi(vault, materiale);
  if (!porzioni.length) return { errore: 'materiale non elaborato (manca trascrizione o indice)' };
  const usi = [], parziali = [];
  for (let i = 0; i < porzioni.length; i++) {
    const r = await analizzaPorzione(materiale, porzioni[i], i, porzioni.length, ai);
    usi.push(r && r.uso);
    if (!r || !r.ok) return { errore: 'porzione ' + (i + 1) + ': ' + ((r && r.errore) || 'nessuna risposta'), uso: sommaUso(usi) };
    parziali.push(r.dati);
  }
  // con una sola porzione la fusione è inutile: si completa la scheda in una passata
  const rf = await fondiPorzioni(materiale, parziali, ai);
  usi.push(rf && rf.uso);
  if (!rf || !rf.ok) return { errore: 'fusione: ' + ((rf && rf.errore) || 'nessuna risposta'), uso: sommaUso(usi) };

  const scheda = Object.assign({}, entroSchema(rf.dati), {
    materiale: { num: materiale.num, nome: materiale.nome, tipo: materiale.tipo, titolo: materiale.titolo,
      durata: materiale.durata || 0, pagine: materiale.npagine || 0, sezioni: materiale.nsezioni || 0 },
    porzioni: porzioni.length,
    generata: ai.adesso || new Date().toISOString()
  });
  const v = validate.schemaErrors('scheda', omettiExtra(scheda));
  if (v.length) return { errore: 'scheda fuori schema: ' + v.slice(0, 2).join(' · '), uso: sommaUso(usi) };
  return { scheda, uso: sommaUso(usi) };
}

/** Accorcia una stringa senza spezzare l'ultima parola, quando si può. */
function accorcia(s, max) {
  const t = String(s).slice(0, max);
  const sp = t.lastIndexOf(' ');
  return (sp > max * 0.6 ? t.slice(0, sp) : t).trim();
}

/**
 * Rende un valore conforme al suo pezzo di schema, ricorsivamente.
 *
 * Restituisce `undefined` per dire «questo campo va tolto»: è il caso di un
 * valore fuori da un `enum`, che non si può accorciare né tagliare.
 */
function conforma(v, def, tagli, dove) {
  if (!def || v === undefined || v === null) return v;

  if (def.type === 'string' && typeof v === 'string') {
    if (Array.isArray(def.enum) && !def.enum.includes(v)) { tagli.push(dove + ' fuori elenco'); return undefined; }
    if (def.maxLength && v.length > def.maxLength) {
      tagli.push(dove + ' ' + v.length + '→' + def.maxLength + ' caratteri');
      return accorcia(v, def.maxLength);
    }
    return v;
  }

  if (def.type === 'integer' || def.type === 'number') {
    if (typeof v === 'number' && def.minimum != null && v < def.minimum) return def.minimum;
    return v;
  }

  if (def.type === 'array' && Array.isArray(v)) {
    let lista = v;
    if (def.maxItems && lista.length > def.maxItems) {
      tagli.push(dove + ' ' + lista.length + '→' + def.maxItems + ' voci');
      lista = lista.slice(0, def.maxItems);
    }
    return lista.map((x, i) => conforma(x, def.items, tagli, dove + '/' + i)).filter((x) => x !== undefined);
  }

  if (def.type === 'object' && v && typeof v === 'object') {
    const props = def.properties || {};
    const out = {};
    for (const k of Object.keys(v)) {
      // `additionalProperties: false` significa che un campo in più fa fallire
      // TUTTA la scheda: meglio toglierlo che perdere l'analisi di un materiale
      if (!props[k]) { if (def.additionalProperties === false) tagli.push(dove + '/' + k + ' campo non previsto'); continue; }
      const q = conforma(v[k], props[k], tagli, dove + '/' + k);
      if (q !== undefined) out[k] = q;
    }
    return out;
  }
  return v;
}

/**
 * Riporta la scheda dentro lo schema invece di buttarla via.
 *
 * La validazione è tutto-o-niente: un concetto di 81 caratteri, o un campo che
 * il modello ha aggiunto di testa sua, facevano scartare la scheda intera —
 * dopo aver pagato ogni porzione *e* la fusione. Ma il contenuto è buono: sono
 * eccessi di forma, non errori di merito.
 *
 * Si sistema quel che si può sistemare — liste troppo lunghe tagliate in coda
 * (temi e concetti arrivano in ordine di importanza, quindi la fine è la parte
 * meno caratterizzante), stringhe accorciate all'ultima parola intera, campi
 * inventati rimossi — e si scrive nella nota che cosa è stato toccato: una
 * riduzione silenziosa sarebbe peggio dell'errore.
 *
 * Quel che NON si può aggiustare (una sintesi troppo corta, un campo
 * obbligatorio mancante) resta un errore, ed è giusto così.
 *
 * I limiti si leggono dallo schema: cambiarli lì basta e avanza.
 */
function entroSchema(dati) {
  const schema = validate.schemaDi('scheda') || {};
  const tagli = [];
  const c = conforma(dati, schema, tagli, '');
  if (tagli.length) {
    const props = schema.properties || {};
    const max = (props.note && props.note.maxLength) || 800;
    const avviso = 'Ricondotta allo schema (' + tagli.join('; ') + ').';
    c.note = ((c.note ? c.note + ' ' : '') + avviso).slice(0, max);
  }
  return c;
}

/** Toglie i campi che aggiungiamo noi, per validare contro lo schema puro. */
function omettiExtra(scheda) {
  const c = Object.assign({}, scheda);
  delete c.materiale; delete c.porzioni; delete c.generata;
  return c;
}

/**
 * Analizza tutti i materiali, in parallelo controllato.
 * `opts`: { concorrenza, rifai, onProgress(evento), ai }
 * Riprendibile: le schede già scritte si saltano, salvo `rifai`.
 */
async function analizzaTutti(vault, corso, materiali, opts) {
  const o = opts || {};
  const conc = Math.max(1, o.concorrenza || 3);
  const avanti = o.onProgress || function () {};
  const lista = materiali.slice();
  const esiti = { fatte: 0, saltate: 0, errori: [], uso: { inputTokens: 0, outputTokens: 0, chiamate: 0 } };
  let indice = 0;

  async function operaio() {
    while (indice < lista.length) {
      const mio = indice++;
      const m = lista[mio];
      if (!o.rifai && leggi(vault, corso, m)) {
        esiti.saltate++;
        avanti({ fase: 'scheda', num: m.num, titolo: m.titolo, stato: 'già fatta', fatti: esiti.fatte + esiti.saltate, totale: lista.length });
        continue;
      }
      avanti({ fase: 'scheda', num: m.num, titolo: m.titolo, stato: 'in lettura', fatti: esiti.fatte + esiti.saltate, totale: lista.length });
      const r = await analizzaMateriale(vault, corso, m, o.ai || {});
      if (r.uso) { esiti.uso.inputTokens += r.uso.inputTokens || 0; esiti.uso.outputTokens += r.uso.outputTokens || 0; esiti.uso.chiamate += r.uso.chiamate || 0; }
      if (r.errore) {
        esiti.errori.push({ num: m.num, titolo: m.titolo, errore: r.errore });
        avanti({ fase: 'scheda', num: m.num, titolo: m.titolo, stato: 'errore: ' + r.errore, fatti: esiti.fatte + esiti.saltate, totale: lista.length });
        continue;
      }
      scrivi(vault, corso, m, r.scheda);
      esiti.fatte++;
      avanti({ fase: 'scheda', num: m.num, titolo: m.titolo, stato: 'letto', fatti: esiti.fatte + esiti.saltate, totale: lista.length });
    }
  }

  await Promise.all(Array.from({ length: Math.min(conc, lista.length) }, operaio));
  return esiti;
}

/** Riga compatta di una scheda, per i prompt dello stadio successivo. */
function rigaPerPrompt(num, scheda) {
  const m = scheda.materiale || {};
  const misura = m.tipo === 'pdf' ? (m.pagine + ' pagine')
    : m.tipo === 'html' ? (m.parole + ' parole')
      : (Math.round((m.durata || 0) / 60) + ' min');
  const temi = (scheda.temi || []).map((t) => t.titolo).slice(0, 12).join(' · ');
  return [
    '[' + num + '] «' + (m.titolo || '') + '» (' + (m.tipo || '') + ', ' + misura + ', livello: ' + (scheda.livello || '?') + ')',
    '  sintesi: ' + String(scheda.sintesi || '').replace(/\s+/g, ' ').slice(0, 700),
    '  temi: ' + temi,
    (scheda.concetti || []).length ? '  concetti: ' + scheda.concetti.slice(0, 14).join(', ') : '',
    (scheda.prerequisiti || []).length ? '  presuppone: ' + scheda.prerequisiti.slice(0, 6).join(' | ') : '',
    (scheda.collegamenti || []).length ? '  si lega a: ' + scheda.collegamenti.slice(0, 6).join(' | ') : ''
  ].filter(Boolean).join('\n');
}

/** Tutte le schede come testo per il prompt. */
function testoPerPrompt(schede) {
  return Object.keys(schede).sort().map((k) => rigaPerPrompt(k, schede[k])).join('\n\n');
}

module.exports = {
  SISTEMA_PORZIONE, SISTEMA_FUSIONE, schemaPorzione, schemaScheda, intestazione,
  porzioniDi, cartella, nomeFile, leggi, scrivi, tutte,
  analizzaPorzione, fondiPorzioni, sommaUso, analizzaMateriale, entroSchema, omettiExtra, analizzaTutti,
  rigaPerPrompt, testoPerPrompt
};
