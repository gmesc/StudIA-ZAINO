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
 * Chiede al modello un oggetto JSON conforme a `schema`.
 * opts: { fornitore, modello, apiKey, sistema, utente, schema, maxTokens }
 * Ritorna { ok, dati, errore, uso:{inputTokens,outputTokens,modello,fornitore} }.
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
    return { ok: false, errore: String((e && e.message) || e) };
  }
}

module.exports = { MODELLI_DEFAULT, SENZA_CHIAVE, PREZZI, costoUsd, stimaCosto,
  adattatore, modelloDi, fornitoreDisponibile, estraiJson, completa };
