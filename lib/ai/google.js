'use strict';
/** Adattatore Google (Gemini). Struttura via responseSchema. */

const R = require('./ritentativi');

/** Parole chiave di JSON Schema che Gemini non digerisce. */
const FUORI = new Set(['additionalProperties', '$schema', '$id', 'title',
  'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'uniqueItems']);

/**
 * Toglie da uno schema le parole chiave che Gemini rifiuta.
 *
 * Attenzione all'omonimia, che qui è costata una proposta d'indice intera:
 * dentro `properties` le chiavi NON sono parole chiave, sono **nomi di campo**.
 * Una lezione ha un campo che si chiama `title`, e la ripulitura lo cancellava
 * insieme al `title` di metadati — lasciando `required: ['title']` a puntare a
 * una proprietà che non esisteva più. Gemini rifiutava tutta la richiesta con
 * «property is not defined», e sembrava un problema di contenuto.
 *
 * Perciò dentro `properties` si scende nei VALORI e non si guardano le chiavi.
 */
function schemaPulito(s) {
  if (!s || typeof s !== 'object') return s;
  if (Array.isArray(s)) return s.map(schemaPulito);
  const out = {};
  for (const k of Object.keys(s)) {
    if (FUORI.has(k)) continue;
    const v = s[k];
    if (k === 'properties' && v && typeof v === 'object' && !Array.isArray(v)) {
      const campi = {};
      for (const nome of Object.keys(v)) campi[nome] = schemaPulito(v[nome]);
      out[k] = campi;
      continue;
    }
    out[k] = (v && typeof v === 'object') ? schemaPulito(v) : v;
  }
  return out;
}

/** Testo della risposta. */
function testoDi(r) { return (r && (r.text || (r.response && r.response.text))) || ''; }

/**
 * Le opzioni del client. Sta fuori da `chiedi` per essere provabile: qui dentro
 * c'è l'unico ritentativo che a Gemini non arriva da nessun'altra parte, e un
 * campo scritto male lo spegnerebbe **in silenzio**.
 *
 * ⚠️ `apiCall()` dell'SDK comincia con «se non c'è `httpOptions.retryOptions`,
 * `fetch` nudo»: senza queste righe Gemini non ritenta **mai**, ed è il solo dei
 * quattro fornitori a non farlo. La cascata di 503 che ha ucciso una generazione
 * a metà è passata di qui.
 *
 * ⚠️ `timeout` per Gemini vale come **header `X-Server-Timeout`**: è il server a
 * tagliare, non noi. Un socket appeso dal nostro lato non lo chiude — l'SDK non
 * espone un `signal` — ma è comunque meglio dell'attesa senza fine di prima, ed
 * è meglio dirlo qui che scoprirlo un giorno aspettando.
 */
function opzioniClient(o) {
  return {
    apiKey: (o && o.apiKey) || undefined,
    httpOptions: {
      // `attempts` conta ANCHE la prima chiamata: l'SDK fa `retries: attempts - 1`
      retryOptions: { attempts: R.tentativi() },
      timeout: R.TIMEOUT_MS
    }
  };
}

async function chiedi(o) {
  const { GoogleGenAI } = require('@google/genai');
  const client = new GoogleGenAI(opzioniClient(o));
  const config = { maxOutputTokens: o.maxTokens, systemInstruction: o.sistema };
  if (o.schema) { config.responseMimeType = 'application/json'; config.responseSchema = schemaPulito(o.schema); }
  const r = await client.models.generateContent({ model: o.modello, contents: o.utente, config });
  const u = r && r.usageMetadata;
  return { testo: testoDi(r), uso: { inputTokens: u && u.promptTokenCount, outputTokens: u && u.candidatesTokenCount } };
}

module.exports = { chiedi, opzioniClient, schemaPulito, testoDi };
