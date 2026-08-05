'use strict';
/** Adattatore Google (Gemini). Struttura via responseSchema. */

/** Parole chiave di JSON Schema che Gemini non digerisce. */
const FUORI = new Set(['additionalProperties', '$schema', '$id', 'title',
  'minItems', 'maxItems', 'minLength', 'maxLength', 'pattern', 'uniqueItems']);

/**
 * Toglie da uno schema le parole chiave che Gemini rifiuta.
 *
 * Attenzione all'omonimia, che qui è costata una proposta d'indice intera:
 * dentro `properties` le chiavi NON sono parole chiave, sono **nomi di campo**.
 * Un corso ha un campo che si chiama `title`, e la ripulitura lo cancellava
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

async function chiedi(o) {
  const { GoogleGenAI } = require('@google/genai');
  const client = new GoogleGenAI({ apiKey: o.apiKey });
  const config = { maxOutputTokens: o.maxTokens, systemInstruction: o.sistema };
  if (o.schema) { config.responseMimeType = 'application/json'; config.responseSchema = schemaPulito(o.schema); }
  const r = await client.models.generateContent({ model: o.modello, contents: o.utente, config });
  const u = r && r.usageMetadata;
  return { testo: testoDi(r), uso: { inputTokens: u && u.promptTokenCount, outputTokens: u && u.candidatesTokenCount } };
}

module.exports = { chiedi, schemaPulito, testoDi };
