'use strict';
// node test/chat-ipc.js — IPC simulato: nessun Electron, rete o segreto reale.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const IPC = require('../lib/chat-ipc');
const chat = require('../lib/chat');
const provider = require('../lib/chat-provider');
const guard = require('../lib/zaino-only');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-chat-ipc-'));
const original = { invia: chat.invia, crea: chat.crea, modelli: provider.modelli };
const secret = 'test-secret-visible-only-to-main';
let cfg = { keys: { openai: { data: secret } }, chat: { provider: 'openai', model: 'model-a' } };
let keyReads = 0, sends = [], listed = [];
const ipcMain = new EventEmitter(), app = new EventEmitter(), handlers = new Map();
ipcMain.handle = (name, fn) => { assert.ok(!handlers.has(name)); handlers.set(name, fn); };
const event = (id = 1) => ({ sender: { id } });
const call = (name, data, id = 1) => handlers.get('chat:' + name)(event(id), data);

(async () => {
  fs.mkdirSync(path.join(root, 'Zaini', 'primo'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Zaini', 'primo', '_zaino.md'), '# Primo');
  fs.mkdirSync(path.join(root, 'Corsi', 'corso'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Corsi', 'corso', '_corso.md'), '# Corso');
  guard.proteggiIpc(ipcMain, () => root);
  provider.modelli = async (id, key) => { listed.push({ id, key }); return [{ id: 'model-a', nome: 'Modello A' }]; };
  chat.crea = () => ({ id: 'session-1', messages: [] });
  chat.invia = (vault, zaino, input, options) => new Promise(resolve => {
    sends.push({ vault, zaino, input, options, resolve });
    options.signal.addEventListener('abort', () => resolve({ session: { id: input.sessionId }, error: 'Risposta interrotta.' }), { once: true });
  });
  IPC.registra({ ipcMain, app, vaultDir: () => root,
    readCfg: () => cfg, writeCfg: value => { cfg = value; }, readKey: () => { keyReads++; return secret; } });

  const sent = [];
  const bridge = IPC.ponte({ invoke: async (...args) => { sent.push(args); return 'ok'; } });
  await bridge.list('primo'); await bridge.read('primo', 'abc'); await bridge.cancel();
  await bridge.setKey({ provider: 'openai', value: 'temporary-test-key' });
  assert.deepEqual(sent, [['chat:list', { zaino: 'primo' }], ['chat:read', { zaino: 'primo', id: 'abc' }], ['chat:cancel'], ['keys:set', { provider: 'openai', value: 'temporary-test-key' }]]);

  assert.deepEqual(await call('settings'), { provider: 'openai', model: 'model-a' });
  const saved = await call('saveSettings', { provider: 'kimi', model: 'model-k', apiKey: 'must-not-be-saved', other: true });
  assert.equal(saved.ok, true);
  assert.deepEqual(cfg.chat, { provider: 'kimi', model: 'model-k' });
  assert.equal(cfg.keys.openai.data, secret, 'salvare preferenze preserva il contenitore chiavi');
  assert.ok(!JSON.stringify(await call('settings')).includes(secret));
  assert.ok(!JSON.stringify(await call('catalogo')).includes(secret));
  assert.equal((await call('saveSettings', { provider: 'unknown', model: 'a' })).ok, false);

  const models = await call('models', { provider: 'openai', apiKey: 'renderer-cannot-override-key' });
  assert.deepEqual(listed, [{ id: 'openai', key: secret }]);
  assert.equal(models.ok, true);
  assert.ok(!JSON.stringify(models).includes(secret));
  assert.equal((await call('models', { provider: 'unknown' })).ok, false);

  const base = { zaino: 'primo', sessionId: 'session-1', text: 'Domanda', provider: 'openai', model: 'model-a' };
  const reads = keyReads;
  for (const zaino of ['corso', '../Corsi/corso', 'inesistente']) assert.equal((await call('send', { ...base, zaino })).ok, false);
  assert.equal(keyReads, reads, 'zaino invalido rifiutato prima di leggere la chiave');
  assert.equal((await call('send', { ...base, provider: 'unknown' })).ok, false);
  assert.equal(sends.length, 0);
  assert.equal((await call('create', { zaino: 'primo' })).session.id, 'session-1');

  const first = call('send', base);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].vault, root);
  assert.equal(sends[0].zaino, 'primo');
  assert.equal(sends[0].options.apiKey, secret);
  assert.equal((await call('send', base)).ok, false, 'una sola richiesta per finestra');
  await call('cancel', undefined, 2);
  assert.equal(sends[0].options.signal.aborted, false, 'una finestra non annulla un’altra');
  await call('cancel');
  assert.equal((await first).ok, false);
  assert.equal(sends[0].options.signal.aborted, true);

  const second = call('send', base);
  sends.at(-1).resolve({ session: { id: base.sessionId, messages: [{ role: 'assistant', content: 'Risposta' }] } });
  assert.equal((await second).ok, true, 'il lock si libera dopo annullamento');
  const contents = new EventEmitter(); contents.id = 42;
  app.emit('web-contents-created', {}, contents);
  const navigating = call('send', base, 42);
  contents.emit('did-start-navigation', { isMainFrame: false, isInPlace: false });
  assert.equal(sends.at(-1).options.signal.aborted, false, 'aprire una fonte non annulla la chat');
  contents.emit('did-start-navigation', { isMainFrame: true, isInPlace: false });
  assert.equal((await navigating).ok, false, 'reload e cambio vault annullano la richiesta precedente');
  const destroyed = call('send', base, 42);
  contents.emit('destroyed');
  assert.equal((await destroyed).ok, false);
  assert.equal(sends.at(-1).options.signal.aborted, true);

  const quitA = call('send', base, 11), quitB = call('send', base, 12);
  app.emit('before-quit');
  assert.equal((await quitA).ok, false);
  assert.equal((await quitB).ok, false);
  console.log('chat-ipc: cablaggio, chiavi main-only, zaini validi, lock e annullamento OK');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  Object.assign(chat, { invia: original.invia, crea: original.crea }); provider.modelli = original.modelli;
  fs.rmSync(root, { recursive: true, force: true });
});
