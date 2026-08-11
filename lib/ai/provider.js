'use strict';
/**
 * provider — un'unica porta verso i tre fornitori AI.
 *
 * Il resto del codice chiama `completa()` e riceve un OGGETTO già validato:
 * non sa quale SDK c'è sotto, non vede chiavi, non fa parsing di testo libero.
 * Ogni fornitore ha il suo adattatore in un file a parte, con la stessa firma.
 *
 * È anche il punto in cui si impone la lingua di scrittura (`o.lingua`): i
 * prompt di sistema sono nove, sparsi in cinque moduli, e metterla in ciascuno
 * significava dimenticarsene in qualcuno. Qui passa tutto.
 */

const lingua = require('../lingua');

const MODELLI_DEFAULT = {
  anthropic: 'claude-opus-5',
  openai: 'gpt-5',
  google: 'gemini-2.5-pro',
  // Claude Code usa il modello con cui è configurato: si lascia decidere a lui,
  // salvo che l'utente ne indichi uno («opus», «sonnet», o un id per esteso)
  claudecode: ''
};

/** Fornitori che non hanno bisogno di una chiave API. */
const SENZA_CHIAVE = ['claudecode'];

/**
 * Prezzo per milione di token, [ingresso, uscita], in dollari.
 * Si dichiarano solo i modelli di cui il prezzo è noto: per gli altri la stima
 * torna null e l'app dice «non disponibile» invece di inventare una cifra.
 */
const PREZZI = {
  'claude-fable-5': [10, 50],
  'claude-opus-5': [5, 25],
  'claude-opus-4-8': [5, 25],
  'claude-opus-4-7': [5, 25],
  'claude-opus-4-6': [5, 25],
  'claude-sonnet-5': [3, 15],
  'claude-sonnet-4-6': [3, 15],
  'claude-haiku-4-5': [1, 5]
};

/**
 * Somma i consumi di più chiamate in un uso solo.
 *
 * ⚠️ Esisteva in due copie — `lib/genera.js` e `lib/schede.js` — e tutte e due
 * ricostruivano l'oggetto **campo per campo**, elencando quelli che conoscevano.
 * Il campo che non elencavano è `costoUsdDichiarato`, cioè il costo che Claude
 * Code riporta già a listino e che `registraUso` (`main.js`) fa vincere sul
 * calcolo nostro. Perso quello, il ripiego è `costoUsd(uso)`, che cerca il
 * modello nel listino — ma per Claude Code il modello è `''` per costruzione
 * (si lascia decidere a lui), quindi `PREZZI['']` è indefinito e il registro
 * scriveva **zero dollari**. Non una stima imprecisa: uno zero. Ogni capitolo e
 * ogni scheda scritti con Claude Code risultavano gratis.
 *
 * Un elenco di campi è una cosa che invecchia da sola: qualunque campo aggiunto
 * a monte muore qui in silenzio. Perciò la somma sta in un posto solo, ed è
 * questo — il modulo che l'`uso` lo produce.
 *
 * ⚠️ `chiamate` conta le invocazioni di `completa()`, non le richieste HTTP: gli
 * SDK ritentano al loro interno (vedi `ritentativi.js`) e quei tentativi da qui
 * non si vedono. È una sottostima dichiarata, non un difetto da correggere qui:
 * il numero vero non ce l'ha nessuno da questa parte.
 */
function sommaUso(usi) {
  const lista = (Array.isArray(usi) ? usi : [usi]).filter(Boolean);
  if (!lista.length) return null;
  const out = { inputTokens: 0, outputTokens: 0, chiamate: 0 };
  let dichiarato = null;
  for (const u of lista) {
    if (u.fornitore) out.fornitore = u.fornitore;
    if (u.modello) out.modello = u.modello;
    out.inputTokens += u.inputTokens || 0;
    out.outputTokens += u.outputTokens || 0;
    out.chiamate += u.chiamate || 1;
    /* Si somma solo ciò che è stato dichiarato: se nessuno lo dichiara il campo
       resta assente, e `registraUso` ripiega sul listino invece di credere a uno
       zero che nessuno ha mai detto. */
    if (typeof u.costoUsdDichiarato === 'number') dichiarato = (dichiarato || 0) + u.costoUsdDichiarato;
  }
  if (dichiarato !== null) out.costoUsdDichiarato = dichiarato;
  return out;
}

/** Costo in dollari di un uso, o null se il modello non è a listino. */
function costoUsd(uso) {
  const p = PREZZI[(uso && uso.modello) || ''];
  if (!p) return null;
  return ((uso.inputTokens || 0) * p[0] + (uso.outputTokens || 0) * p[1]) / 1e6;
}

/** Stima a priori: quanto costerà, dati i token previsti. */
function stimaCosto(o) {
  return costoUsd({ modello: (o && o.modello) || '', inputTokens: (o && o.input) || 0, outputTokens: (o && o.output) || 0 });
}

/** Carica l'adattatore del fornitore. Ritorna null se il nome non è noto. */
function adattatore(fornitore) {
  try { return require('./' + fornitore + '.js'); } catch (e) { return null; }
}

/** Il modello da usare: quello scelto dall'utente, altrimenti il default del fornitore. */
function modelloDi(fornitore, prefs) {
  const chiave = { anthropic: 'modelAnthropic', openai: 'modelOpenai', google: 'modelGoogle', claudecode: 'modelClaudecode' }[fornitore];
  return (prefs && prefs[chiave]) || MODELLI_DEFAULT[fornitore] || null;
}

/** Primo fornitore con una chiave disponibile, dando la precedenza a quello preferito. */
function fornitoreDisponibile(chiavi, preferito) {
  const ordine = [preferito, 'claudecode', 'anthropic', 'openai', 'google'].filter(Boolean);
  for (const f of ordine) if (chiavi && chiavi[f]) return f;
  return null;
}

/** Estrae il primo oggetto JSON da un testo che potrebbe avere contorno. */
function estraiJson(testo) {
  const t = String(testo || '').trim();
  const pulito = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { return JSON.parse(pulito); } catch (e) {}
  const a = pulito.indexOf('{'), b = pulito.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(pulito.slice(a, b + 1)); } catch (e) {} }
  return null;
}

/**
 * Il motivo leggibile di un'eccezione degli SDK.
 *
 * ⚠️ Prima si teneva il solo `e.message`, e su un errore di rete quel messaggio
 * spesso non contiene il numero: dopo l'ultimo ritentativo Gemini lancia
 * `Retryable HTTP Error: Service Unavailable` — lo `status` c'è sull'oggetto ma
 * non nel testo, perché il suo `throwErrorIfNotOK` non viene mai raggiunto. Una
 * cascata di 503 diventava così un errore senza codice: illeggibile nel registro
 * e impossibile da riconoscere a colpo d'occhio. Qui il codice si rimette
 * davanti, quando c'è.
 */
function motivoDi(e) {
  const msg = String((e && e.message) || e || 'errore sconosciuto');
  const stato = e && (e.status || e.statusCode);
  const tipo = e && (e.type || (e.error && e.error.type));
  const pezzi = [];
  if (stato) pezzi.push('HTTP ' + stato);
  if (tipo && String(tipo) !== 'error') pezzi.push(String(tipo));
  return pezzi.length ? pezzi.join(' ') + ': ' + msg : msg;
}

/**
 * Chiede al modello un oggetto JSON conforme a `schema`.
 * opts: { fornitore, modello, apiKey, sistema, utente, schema, maxTokens }
 * Ritorna { ok, dati, errore, uso:{inputTokens,outputTokens,modello,fornitore} }.
 *
 * ## Qui NON c'è un ciclo di ritentativi, ed è una decisione
 *
 * Ogni adattatore ritenta per conto suo — gli SDK di Anthropic e OpenAI lo fanno
 * da sé, Gemini lo fa da quando `google.js` glielo accende, Claude Code ha il
 * suo ciclo. Il numero è uno solo e sta in `lib/ai/ritentativi.js`.
 *
 * Metterne un altro qui li moltiplicherebbe invece di sommarcisi: un capitolo
 * passa da `lib/genera.js`, che fa **due giri**, quindi tre tentativi qui
 * diventano diciotto richieste HTTP fatturate. E ci sono tre ragioni oltre al
 * costo: `genera.js` tratterebbe l'errore di rete come una risposta invalida e
 * brucerebbe un giro di riparazione; questa funzione non ha una callback in
 * firma, quindi durante le attese l'interfaccia resterebbe muta; il pulsante
 * «Ferma» viene letto solo fra un capitolo e l'altro.
 *
 * Il posto giusto per ritentare è il più vicino alla connessione: là si riusa la
 * stessa sessione, si rispetta il `retry-after` del server e non si rispedisce
 * il prompt da capo.
 */
async function completa(opts) {
  const o = opts || {};
  const ad = adattatore(o.fornitore);
  if (!ad) return { ok: false, errore: 'fornitore sconosciuto: ' + o.fornitore };
  if (!o.apiKey && !SENZA_CHIAVE.includes(o.fornitore)) return { ok: false, errore: 'nessuna chiave API per ' + o.fornitore };
  try {
    const r = await ad.chiedi({
      modello: o.modello || MODELLI_DEFAULT[o.fornitore],
      apiKey: o.apiKey,
      sistema: lingua.conDirettiva(o.sistema, o.lingua),
      utente: o.utente || '',
      schema: o.schema || null,
      maxTokens: o.maxTokens || 8000
    });
    const dati = r && r.dati !== undefined ? r.dati : estraiJson(r && r.testo);
    if (!dati) return { ok: false, errore: 'risposta non interpretabile come JSON', uso: r && r.uso };
    return { ok: true, dati, uso: Object.assign({ fornitore: o.fornitore, modello: o.modello }, r && r.uso) };
  } catch (e) {
    return { ok: false, errore: motivoDi(e) };
  }
}

module.exports = { MODELLI_DEFAULT, SENZA_CHIAVE, PREZZI, costoUsd, stimaCosto,
  adattatore, modelloDi, fornitoreDisponibile, estraiJson, motivoDi, sommaUso, completa };
