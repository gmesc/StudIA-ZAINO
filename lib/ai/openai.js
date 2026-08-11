'use strict';
/** Adattatore OpenAI. Struttura garantita da response_format json_schema. */

const R = require('./ritentativi');

/** Involucro richiesto da OpenAI attorno allo schema. */
function formatoDaSchema(schema) {
  return { type: 'json_schema', json_schema: { name: 'risposta', strict: false, schema } };
}

/** Testo della prima scelta. */
function testoDi(risposta) {
  const c = risposta && risposta.choices && risposta.choices[0];
  return (c && c.message && c.message.content) || '';
}

/**
 * Le opzioni del client. Come per Anthropic: `maxRetries` sono le RIPETIZIONI,
 * l'SDK ritenta già da sé, e qui si dichiara il numero invece di ereditarlo.
 */
function opzioniClient(o) {
  return { apiKey: (o && o.apiKey) || undefined, maxRetries: R.ripetizioni() };
}

async function chiedi(o) {
  const OpenAI = require('openai');
  const client = new OpenAI(opzioniClient(o));
  const richiesta = {
    model: o.modello, max_completion_tokens: o.maxTokens,
    messages: [{ role: 'system', content: o.sistema }, { role: 'user', content: o.utente }]
  };
  if (o.schema) richiesta.response_format = formatoDaSchema(o.schema);
  const r = await client.chat.completions.create(richiesta);
  const uso = { inputTokens: r.usage && r.usage.prompt_tokens, outputTokens: r.usage && r.usage.completion_tokens };
  return { testo: testoDi(r), uso };
}

module.exports = { chiedi, opzioniClient, formatoDaSchema, testoDi };
