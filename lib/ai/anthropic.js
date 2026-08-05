'use strict';
/** Adattatore Anthropic. Struttura garantita da un tool forzato. */
const NOME_TOOL = 'rispondi';

/** Definisce il tool che impone lo schema alla risposta. */
function toolDaSchema(schema) {
  return [{ name: NOME_TOOL, description: 'Restituisce la risposta strutturata.', input_schema: schema }];
}

/** Trova il blocco tool_use nella risposta. */
function inputDelTool(msg) {
  const blocchi = (msg && msg.content) || [];
  for (const b of blocchi) if (b.type === 'tool_use' && b.name === NOME_TOOL) return b.input;
  return null;
}

/** Concatena i blocchi di testo (usato quando non c'è schema). */
function testoDi(msg) {
  return ((msg && msg.content) || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

async function chiedi(o) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: o.apiKey });
  const richiesta = {
    model: o.modello, max_tokens: o.maxTokens,
    system: o.sistema,
    messages: [{ role: 'user', content: o.utente }]
  };
  if (o.schema) { richiesta.tools = toolDaSchema(o.schema); richiesta.tool_choice = { type: 'tool', name: NOME_TOOL }; }
  const msg = await client.messages.create(richiesta);
  const uso = { inputTokens: msg.usage && msg.usage.input_tokens, outputTokens: msg.usage && msg.usage.output_tokens };
  return o.schema ? { dati: inputDelTool(msg), uso } : { testo: testoDi(msg), uso };
}

module.exports = { chiedi, toolDaSchema, inputDelTool, testoDi };
