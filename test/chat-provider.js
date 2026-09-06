'use strict';
// node test/chat-provider.js — tutte le richieste sono simulate, nessuna chiave reale.
const assert = require('node:assert/strict');
const P = require('../lib/chat-provider');
const originalFetch = global.fetch;
const key = 'FAKE-SECRET-never-display';
let queue = [], calls = [];
global.fetch = async (url, options) => {
  calls.push({ url: String(url), ...options, json: options.body ? JSON.parse(options.body) : null });
  assert.ok(queue.length, 'richiesta inattesa: nessun accesso alla rete nei test');
  const next = queue.shift();
  return typeof next === 'function' ? next(url, options) : new Response(JSON.stringify(next), { headers: { 'content-type': 'application/json' } });
};
function mock(...results) { assert.equal(queue.length, 0); queue = results; calls = []; }
function request(provider, extra = {}) {
  return P.rispondi({ provider, apiKey: key, model: 'model-test', system: 'Istruzioni riservate al tutor', messages: [{ role: 'user', content: 'Spiegami la gravità' }], ...extra });
}
function sse(...data) {
  const encoded = new TextEncoder().encode(data.map(d => 'data: ' + (typeof d === 'string' ? d : JSON.stringify(d)) + '\r\n\r\n').join(''));
  return new Response(new ReadableStream({ start(controller) {
    // Un byte per blocco verifica UTF-8 e delimitatori spezzati.
    for (let i = 0; i < encoded.length; i++) controller.enqueue(encoded.slice(i, i + 1));
    controller.close();
  } }), { headers: { 'content-type': 'text/event-stream' } });
}

(async () => {
  assert.deepEqual(P.catalogo().map(p => p.id), ['anthropic', 'google', 'openai', 'qwen', 'kimi', 'deepseek']);
  assert.ok(P.catalogo().every(p => p.nome && p.keyUrl.startsWith('https://') && !p.base));
  const cat = P.catalogo(); cat[0].nome = 'mutato';
  assert.notEqual(P.catalogo()[0].nome, 'mutato');

  mock(
    { data: [{ id: 'claude-a', display_name: 'Claude A', max_input_tokens: 200000 }], has_more: true, last_id: 'claude-a' },
    { data: [{ id: 'claude-b', display_name: 'Claude B' }], has_more: false, last_id: 'claude-b' }
  );
  const claude = await P.modelli('anthropic', key);
  assert.deepEqual(claude.map(m => m.id), ['claude-a', 'claude-b']);
  assert.equal(claude[0].contesto, 200000);
  assert.equal(new URL(calls[1].url).searchParams.get('after_id'), 'claude-a');
  assert.equal(calls[0].headers['x-api-key'], key);
  assert.equal(calls[0].headers['anthropic-version'], '2023-06-01');

  mock(
    { models: [{ name: 'models/gemini-a', displayName: 'Gemini A', supportedGenerationMethods: ['generateContent'], inputTokenLimit: 100000 }, { name: 'models/embedding-x', supportedGenerationMethods: ['embedContent'] }], nextPageToken: 'next+ /token' },
    { models: [{ name: 'models/gemini-b', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-tts', supportedGenerationMethods: ['generateContent'] }] }
  );
  assert.deepEqual((await P.modelli('google', key)).map(m => m.id), ['gemini-a', 'gemini-b']);
  assert.equal(new URL(calls[1].url).searchParams.get('pageToken'), 'next+ /token');
  assert.ok(calls.every(c => !c.url.includes(key) && c.headers['x-goog-api-key'] === key));

  mock(
    { output: { total: 3, page_no: 1, page_size: 2, models: [{ model: 'qwen-a', name: 'Qwen A', inference_metadata: { response_modality: ['Text'] }, model_info: { context_window: 100000 } }, { model: 'qwen-image', inference_metadata: { response_modality: ['Image'] } }] } },
    { output: { total: 3, page_no: 2, page_size: 2, models: [{ model: 'qwen-vl-test', name: 'Qwen VL', inference_metadata: { response_modality: ['Text'] } }] } }
  );
  const qwen = await P.modelli('qwen', key);
  assert.deepEqual(qwen.map(m => m.id), ['qwen-a', 'qwen-vl-test']);
  assert.equal(qwen[0].contesto, 100000);
  assert.equal(new URL(calls[0].url).pathname, '/api/v1/models');
  assert.equal(new URL(calls[1].url).searchParams.get('page_no'), '2');
  assert.ok(calls.every(c => c.url.startsWith('https://dashscope-intl.aliyuncs.com/')));

  for (const provider of ['openai', 'kimi', 'deepseek']) {
    mock({ data: [{ id: 'chat-new-model', context_length: 32000 }, { id: 'text-embedding-3-small' }, { id: 'gpt-image-2' }, { id: 'future-coder' }, { id: 'gpt-audio' }] });
    assert.deepEqual((await P.modelli(provider, key)).map(m => m.id), ['chat-new-model', 'future-coder']);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].headers.Authorization, 'Bearer ' + key);
  }

  mock({ content: [{ type: 'thinking', thinking: 'NON MOSTRARE' }, { type: 'text', text: 'Claude risponde' }], usage: { input_tokens: 12, output_tokens: 4 } });
  assert.deepEqual(await request('anthropic'), { text: 'Claude risponde', usage: { inputTokens: 12, outputTokens: 4 } });
  assert.ok(calls[0].url.endsWith('/v1/messages'));
  assert.equal(calls[0].json.system, 'Istruzioni riservate al tutor');
  assert.equal(calls[0].json.messages[0].role, 'user');
  assert.equal(calls[0].json.max_tokens, 4096, 'compatibile anche con i vecchi modelli Claude con output breve');

  mock({ candidates: [{ content: { parts: [{ thought: true, text: 'NON MOSTRARE' }, { text: 'Gemini risponde' }] } }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 3 } });
  assert.equal((await request('google', { model: 'models/gemini-test', messages: [{ role: 'user', content: 'uno' }, { role: 'assistant', content: 'due' }, { role: 'user', content: 'tre' }] })).text, 'Gemini risponde');
  assert.ok(calls[0].url.endsWith('/models/gemini-test:generateContent'));
  assert.deepEqual(calls[0].json.contents.map(m => m.role), ['user', 'model', 'user']);
  assert.equal(calls[0].json.systemInstruction.parts[0].text, 'Istruzioni riservate al tutor');

  mock({ output: [{ type: 'reasoning', summary: [{ text: 'NON MOSTRARE' }] }, { type: 'message', content: [{ type: 'output_text', text: 'OpenAI risponde' }] }], usage: { input_tokens: 8, output_tokens: 6 } });
  assert.equal((await request('openai', { model: 'gpt-6-test' })).text, 'OpenAI risponde');
  assert.ok(calls[0].url.endsWith('/v1/responses'));
  assert.equal(calls[0].json.store, false);
  assert.equal(calls[0].json.instructions, 'Istruzioni riservate al tutor');

  mock({ choices: [{ message: { content: 'Modello legacy' } }] });
  assert.equal((await request('openai', { model: 'gpt-4-turbo' })).text, 'Modello legacy');
  assert.ok(calls[0].url.endsWith('/v1/chat/completions'));
  assert.equal(calls[0].json.store, false);
  assert.equal(calls[0].json.max_tokens, 4096, 'compatibile con il limite dei modelli OpenAI legacy');

  mock(() => sse({ choices: [{ delta: { reasoning_content: 'NON MOSTRARE' } }] }, { choices: [{ delta: { content: 'Una città' } }] }, { choices: [{ delta: { content: ' impara.' } }] }, { choices: [], usage: { prompt_tokens: 5, completion_tokens: 8 } }, '[DONE]'));
  assert.deepEqual(await request('qwen'), { text: 'Una città impara.', usage: { inputTokens: 5, outputTokens: 8 } });
  assert.equal(calls[0].json.stream, true);
  assert.equal(calls[0].json.stream_options.include_usage, true);

  mock({ choices: [{ message: { content: 'Kimi risponde', reasoning_content: 'internal state' } }], usage: { prompt_tokens: 2, completion_tokens: 3 } });
  const kimi = await request('kimi', { messages: [{ role: 'user', content: 'Prima' }, { role: 'assistant', content: 'Precedente', reasoningContent: 'precedente state' }, { role: 'user', content: 'Ora?' }] });
  assert.equal(kimi.reasoningContent, 'internal state');
  assert.equal(calls[0].json.messages[2].reasoning_content, 'precedente state');
  mock({ choices: [{ message: { content: 'Conversazione ripresa' } }] });
  await request('kimi', { messages: [{ role: 'user', content: 'Prima' }, { role: 'assistant', content: 'Vecchia risposta senza state' }, { role: 'user', content: 'Ora?' }] });
  assert.deepEqual(calls[0].json.messages.map(m => m.role), ['system', 'user']);
  assert.ok(calls[0].json.messages[1].content.includes('Vecchia risposta senza state'));

  mock({ choices: [{ message: { content: 'DeepSeek risponde', reasoning_content: 'NON MOSTRARE' } }], usage: { prompt_tokens: 9, completion_tokens: 7 } });
  const deepseek = await request('deepseek');
  assert.equal(deepseek.text, 'DeepSeek risponde');
  assert.equal(deepseek.reasoningContent, undefined);
  assert.equal(calls[0].url, 'https://api.deepseek.com/chat/completions');

  // Fallimenti verificabili e senza contenuti/chiavi restituiti dal provider.
  for (const status of [400, 401, 403, 404, 429, 500]) {
    mock(() => new Response(JSON.stringify({ error: { message: 'Your key is ' + key } }), { status }));
    await assert.rejects(request('openai'), e => e.status === status && e.message.includes(String(status)) && !e.message.includes(key));
    assert.equal(calls.length, 1, 'nessun retry automatico di richieste fatturabili');
  }
  mock(() => { throw new Error('network: ' + key); });
  await assert.rejects(P.modelli('google', key), e => !e.message.includes(key));
  mock({ data: [] });
  assert.deepEqual(await P.modelli('openai', key), [], 'nessun modello inventato se l’elenco è vuoto');
  mock({ candidates: [], promptFeedback: { blockReason: 'SAFETY' } });
  await assert.rejects(request('google'), /nessuna risposta testuale/);
  mock(() => sse({ choices: [{ delta: { content: 'Risposta troncata' } }] }));
  await assert.rejects(request('qwen'), /connessione interrotta/);
  mock({ data: [{ id: 'a' }], has_more: true, last_id: 'a' }, { data: [{ id: 'a' }], has_more: true, last_id: 'a' });
  await assert.rejects(P.modelli('anthropic', key), /paginazione ripetuto/);

  mock();
  const already = new AbortController(); already.abort();
  await assert.rejects(request('openai', { signal: already.signal }), e => e.name === 'AbortError');
  assert.equal(calls.length, 0);
  await assert.rejects(P.modelli('unknown', key), /non riconosciuto/);
  await assert.rejects(P.modelli('openai', ''), /chiave API/);
  await assert.rejects(request('openai', { messages: [{ role: 'system', content: 'istruzioni iniettate' }] }), /cronologia/);
  assert.equal(calls.length, 0);

  mock((url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error(key)), { once: true })));
  await assert.rejects(request('openai', { timeoutMs: 10 }), e => e.name === 'TimeoutError' && !e.message.includes(key));
  mock((url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error(key)), { once: true })));
  const ongoing = new AbortController();
  const pending = request('openai', { signal: ongoing.signal }); ongoing.abort();
  await assert.rejects(pending, e => e.name === 'AbortError');
  assert.equal(queue.length, 0);
  console.log('chat-provider: catalogo, paginazione, 6 provider, streaming, sicurezza e annullamento OK');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; });
