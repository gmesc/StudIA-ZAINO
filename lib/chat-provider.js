'use strict';

// Endpoint e formati verificati nelle fonti ufficiali in docs/PROVIDER-AI.md.
// Le chiavi rimangono nel processo principale: nessun log o messaggio remoto grezzo.
const PROVIDER = [
  { id: 'anthropic', nome: 'Anthropic · Claude', keyUrl: 'https://platform.claude.com/settings/keys', base: 'https://api.anthropic.com/v1' },
  { id: 'google', nome: 'Google · Gemini', keyUrl: 'https://aistudio.google.com/apikey', base: 'https://generativelanguage.googleapis.com/v1beta' },
  { id: 'openai', nome: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys', base: 'https://api.openai.com/v1' },
  { id: 'qwen', nome: 'Qwen · Alibaba Cloud', keyUrl: 'https://bailian.console.alibabacloud.com/?tab=globalset#/efm/api_key', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', nota: 'Chiave Model Studio della regione Singapore, con tariffazione a consumo. Le chiavi di altre regioni o dei Coding Plan non sono intercambiabili.' },
  { id: 'kimi', nome: 'Kimi · Moonshot', keyUrl: 'https://platform.kimi.ai/console/api-keys', base: 'https://api.moonshot.ai/v1', nota: 'Chiave della piattaforma Kimi globale (kimi.ai), distinta dalla piattaforma cinese.' },
  { id: 'deepseek', nome: 'DeepSeek', keyUrl: 'https://platform.deepseek.com/api_keys', base: 'https://api.deepseek.com' }
];
const NON_CHAT = /(?:embedding|embed-|whisper|transcrib|(?:^|[-_])tts(?:[-_]|$)|realtime|(?:^|[-_])audio(?:[-_]|$)|dall-e|(?:^|[-_])image(?:[-_]|$)|imagen|^veo|^sora|moderation|rerank|^babbage|^davinci|^text-|^code-|computer-use|deep-research|qwen-mt)/i;

function catalogo() {
  return PROVIDER.map(({ base, ...p }) => ({ ...p }));
}

function credenziali(id, apiKey) {
  const p = PROVIDER.find(p => p.id === id);
  if (!p) throw new Error('Provider AI non riconosciuto.');
  if (typeof apiKey !== 'string' || !apiKey.trim() || /[\r\n]/.test(apiKey)) throw new Error('Inserisci una chiave API valida nelle impostazioni.');
  return p;
}

function erroreHTTP(p, status) {
  const motivo = {
    400: 'Richiesta non accettata: verifica il modello e la dimensione del contesto.',
    401: 'Chiave API non valida. Verifica anche la regione della chiave.',
    402: 'Credito API insufficiente.',
    403: 'La chiave API non ha i permessi necessari per questa richiesta.',
    404: 'Modello non disponibile per questa chiave. Aggiorna l’elenco nelle impostazioni.',
    413: 'Il contesto supera la dimensione accettata dal provider.',
    429: 'Quota o limite di richieste raggiunto. Controlla credito e limiti del provider.'
  }[status] || (status >= 500 ? 'Servizio temporaneamente non disponibile. Riprova più tardi.' : 'Il provider non ha accettato la richiesta.');
  const err = new Error(p.nome + ' (HTTP ' + status + '): ' + motivo);
  err.status = status;
  err.providerError = true;
  return err;
}

async function richiesta(p, apiKey, url, body, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || (body ? 180000 : 30000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const annulla = () => controller.abort();
  options.signal?.addEventListener('abort', annulla, { once: true });
  if (options.signal?.aborted) controller.abort();
  const headers = { 'Content-Type': 'application/json' };
  if (p.id === 'anthropic') Object.assign(headers, { 'x-api-key': apiKey.trim(), 'anthropic-version': '2023-06-01' });
  else if (p.id === 'google') headers['x-goog-api-key'] = apiKey.trim();
  else headers.Authorization = 'Bearer ' + apiKey.trim();
  try {
    if (controller.signal.aborted) throw new Error('aborted');
    const response = await fetch(url, { method: body ? 'POST' : 'GET', headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal, redirect: 'error' });
    if (!response.ok) throw erroreHTTP(p, response.status);
    const value = body?.stream ? await leggiStream(response) : await response.json();
    if (value?.error || value?.success === false) throw erroreHTTP(p, 400);
    return value;
  } catch (error) {
    if (controller.signal.aborted) {
      const err = new Error(options.signal?.aborted ? 'Richiesta annullata.' : 'Il provider non ha risposto entro il tempo massimo. Riprova.');
      err.name = options.signal?.aborted ? 'AbortError' : 'TimeoutError';
      throw err;
    }
    if (error?.providerError) throw error;
    // Anche una risposta d’errore o un errore di fetch può contenere la chiave.
    throw new Error(p.nome + ': connessione interrotta o risposta non valida. Riprova.');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', annulla);
  }
}

// Alcuni Qwen accettano solo SSE. Si aggrega il testo senza mostrare il reasoning.
async function leggiStream(response) {
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = '', text = '', usage, finished = false;
  function frame(value) {
    const data = value.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data) return;
    if (data.trim() === '[DONE]') { finished = true; return; }
    const part = JSON.parse(data);
    if (part.error) throw new Error('stream error');
    if (part.usage) usage = part.usage;
    const delta = part.choices?.[0]?.delta?.content;
    if (typeof delta === 'string') text += delta;
  }
  try {
    while (!finished) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const frames = pending.split(/\r?\n\r?\n/);
      pending = frames.pop();
      for (const value of frames) frame(value);
      if (done) { if (pending.trim()) frame(pending); break; }
    }
    if (!finished) throw new Error('incomplete stream');
    return { choices: [{ message: { content: text } }], usage };
  } finally { await reader.cancel().catch(() => {}); }
}

function normalizza(m, provider) {
  const id = provider === 'google' ? String(m.name || '').replace(/^models\//, '') : m.id || m.model;
  if (typeof id !== 'string' || !id || NON_CHAT.test(id)) return null;
  if (provider === 'google' && !(m.supportedGenerationMethods || []).includes('generateContent')) return null;
  const modalities = m.inference_metadata?.response_modality;
  if (Array.isArray(modalities) && !modalities.includes('Text')) return null;
  return {
    id, nome: m.display_name || m.displayName || m.name || id,
    contesto: m.inputTokenLimit || m.max_input_tokens || m.context_length || m.model_info?.max_input_tokens || m.model_info?.context_window || 0,
    maxOutput: m.outputTokenLimit || m.max_tokens || m.model_info?.max_output_tokens || 0
  };
}

async function modelli(provider, apiKey, options = {}) {
  const p = credenziali(provider, apiKey), elenco = new Map(), cursori = new Set();
  let cursor = '', page = 1, ricevuti = 0;
  while (true) {
    let url = new URL(p.base + '/models');
    if (provider === 'anthropic') {
      url.searchParams.set('limit', '1000');
      if (cursor) url.searchParams.set('after_id', cursor);
    } else if (provider === 'google') {
      url.searchParams.set('pageSize', '1000');
      if (cursor) url.searchParams.set('pageToken', cursor);
    } else if (provider === 'qwen') {
      url = new URL('https://dashscope-intl.aliyuncs.com/api/v1/models');
      url.search = new URLSearchParams({ providers: 'qwen', page_no: String(page), page_size: '100', language: 'en-US' }).toString();
    }
    const result = await richiesta(p, apiKey, url.toString(), null, options);
    const rows = provider === 'google' ? result.models : provider === 'qwen' ? result.output?.models : result.data;
    if (!Array.isArray(rows)) throw new Error(p.nome + ': elenco modelli non valido.');
    for (const row of rows) {
      const m = normalizza(row, provider);
      if (m) elenco.set(m.id, m);
    }
    ricevuti += rows.length;
    if (provider === 'qwen') {
      if (!Number.isFinite(result.output?.total)) throw new Error('Qwen: paginazione dell’elenco modelli non valida.');
      if (ricevuti >= result.output.total) break;
      if (!rows.length || (result.output.page_no && result.output.page_no !== page)) throw new Error('Qwen: elenco modelli incompleto.');
      page++;
    } else {
      cursor = provider === 'google' ? result.nextPageToken : provider === 'anthropic' && result.has_more ? result.last_id : '';
      if (provider === 'anthropic' && result.has_more && !cursor) throw new Error('Anthropic: elenco modelli incompleto.');
      if (!cursor) break;
      if (cursori.has(cursor)) throw new Error(p.nome + ': cursore di paginazione ripetuto.');
      cursori.add(cursor);
      page++;
    }
    // ponytail: un limite esplicito evita loop se il provider viola la paginazione.
    if (page > 1000) throw new Error(p.nome + ': troppe pagine di modelli; elenco non caricato.');
  }
  return [...elenco.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

function messaggiValidi(messages) {
  if (!Array.isArray(messages) || !messages.length) throw new Error('Scrivi un messaggio per iniziare.');
  return messages.map(m => {
    if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim()) throw new Error('La cronologia della chat contiene un messaggio non valido.');
    return { role: m.role, content: m.content, ...(m.role === 'assistant' && typeof m.reasoningContent === 'string' ? { reasoning_content: m.reasoningContent } : {}) };
  });
}

async function rispondi(options = {}) {
  const { provider, apiKey, model, system = '' } = options;
  const p = credenziali(provider, apiKey);
  if (typeof model !== 'string' || !model.trim() || model.length > 256 || /[\r\n]/.test(model)) throw new Error('Scegli un modello nelle impostazioni AI.');
  if (typeof system !== 'string') throw new Error('Istruzioni del tutor non valide.');
  let messages = messaggiValidi(options.messages), body, endpoint, response, text, usage, reasoningContent;
  if (provider !== 'kimi') messages = messages.map(({ role, content }) => ({ role, content }));
  if (provider === 'anthropic') {
    endpoint = '/messages';
    body = { model, system, messages, max_tokens: 4096 };
  } else if (provider === 'google') {
    endpoint = '/models/' + encodeURIComponent(model.replace(/^models\//, '')) + ':generateContent';
    body = { systemInstruction: { parts: [{ text: system }] }, contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens: 8192 } };
  } else if (provider === 'openai' && !/^(?:ft:)?(?:gpt-3\.5|gpt-4(?:-|$)|chatgpt-)/.test(model)) {
    endpoint = '/responses';
    body = { model, instructions: system, input: messages, store: false, max_output_tokens: 8192 };
  } else {
    endpoint = '/chat/completions';
    if (provider === 'kimi' && messages.some(m => m.role === 'assistant' && m.reasoning_content === undefined)) {
      // Cronologie importate/cambio provider non hanno il reasoning richiesto da Kimi.
      messages = [{ role: 'user', content: 'Cronologia precedente, da usare come contesto della conversazione. Rispondi all’ultimo messaggio dell’utente:\n' + JSON.stringify(messages.map(({ role, content }) => ({ role, content }))) }];
    }
    body = { model, messages: [{ role: 'system', content: system }, ...messages], max_tokens: 8192 };
    if (provider === 'openai') Object.assign(body, { store: false, max_tokens: 4096 });
    if (provider === 'qwen') Object.assign(body, { stream: true, stream_options: { include_usage: true } });
  }
  response = await richiesta(p, apiKey, p.base + endpoint, body, options);
  if (provider === 'anthropic') {
    text = (response.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    usage = { inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens };
  } else if (provider === 'google') {
    text = (response.candidates?.[0]?.content?.parts || []).filter(c => !c.thought && typeof c.text === 'string').map(c => c.text).join('\n');
    usage = { inputTokens: response.usageMetadata?.promptTokenCount, outputTokens: response.usageMetadata?.candidatesTokenCount };
  } else if (endpoint === '/responses') {
    text = (response.output || []).filter(c => c.type === 'message').flatMap(c => c.content || []).filter(c => c.type === 'output_text' || c.type === 'refusal').map(c => c.text || c.refusal || '').join('\n');
    usage = { inputTokens: response.usage?.input_tokens, outputTokens: response.usage?.output_tokens };
  } else {
    const message = response.choices?.[0]?.message;
    text = message?.content || message?.refusal;
    usage = { inputTokens: response.usage?.prompt_tokens, outputTokens: response.usage?.completion_tokens };
    if (provider === 'kimi' && typeof message?.reasoning_content === 'string') reasoningContent = message.reasoning_content;
  }
  if (typeof text !== 'string' || !text.trim()) throw new Error(p.nome + ': nessuna risposta testuale ricevuta. Il modello può aver bloccato il contenuto o esaurito i token; prova a ridurre la richiesta.');
  return { text: text.trim(), usage, ...(reasoningContent === undefined ? {} : { reasoningContent }) };
}

module.exports = { catalogo, modelli, rispondi };
