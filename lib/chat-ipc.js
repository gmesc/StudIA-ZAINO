'use strict';
// Solo il processo principale vede le chiavi; il renderer riceve stato ed esiti.
function ponte(ipc) {
  const invoca = (azione, ...args) => ipc.invoke('chat:' + azione, ...args);
  return {
    catalogo: () => invoca('catalogo'), settings: () => invoca('settings'),
    saveSettings: (o) => invoca('saveSettings', o), models: (o) => invoca('models', o),
    keysStatus: () => ipc.invoke('keys:status'),
    setKey: (o) => ipc.invoke('keys:set', o), clearKey: (o) => ipc.invoke('keys:clear', o),
    profiles: () => invoca('profiles'), saveProfile: (o) => invoca('saveProfile', o),
    cloneProfile: (id) => invoca('cloneProfile', id), deleteProfile: (id) => invoca('deleteProfile', id),
    activateProfile: (id) => invoca('activateProfile', id),
    list: (zaino) => invoca('list', { zaino }), read: (zaino, id) => invoca('read', { zaino, id }),
    create: (zaino, o) => invoca('create', { zaino, ...o }), remove: (zaino, id) => invoca('remove', { zaino, id }),
    send: (zaino, o) => invoca('send', { zaino, ...o }), cancel: () => invoca('cancel')
  };
}
function registra({ ipcMain, app, vaultDir, readCfg, writeCfg, readKey }) {
  const chat = require('./chat'), profili = require('./chat-profili'), provider = require('./chat-provider');
  const { zainoValido } = require('./zaino-only');
  const pending = new Map();
  const validaProvider = (id) => { if (!provider.catalogo().some(p => p.id === id)) throw new Error('Provider non valido.'); };
  const settings = () => readCfg().chat || { provider: '', model: '' };
  const handle = (nome, fn) => ipcMain.handle('chat:' + nome, async (e, o) => {
    try { return await fn(e, o); } catch (err) { return { ok: false, error: err.message || 'Operazione non riuscita.' }; }
  });
  const zaino = (o) => {
    const v = vaultDir();
    if (!o || !zainoValido(v, o.zaino)) throw new Error('Apri uno zaino valido.');
    return v;
  };
  handle('catalogo', () => provider.catalogo());
  handle('settings', () => settings());
  handle('saveSettings', (_, o) => {
    validaProvider(o.provider);
    if (typeof o.model !== 'string' || o.model.length > 200) throw new Error('Modello non valido.');
    const c = readCfg(); c.chat = { provider: o.provider, model: o.model }; writeCfg(c);
    return { ok: true, ...c.chat };
  });
  handle('models', async (_, o) => {
    validaProvider(o.provider);
    const key = readKey(o.provider); if (!key) throw new Error('Salva prima la chiave API di questo provider.');
    return { ok: true, models: await provider.modelli(o.provider, key) };
  });
  handle('profiles', () => ({ ok: true, ...profili.leggi(vaultDir()) }));
  for (const [nome, fn] of Object.entries({ saveProfile: 'salva', cloneProfile: 'clona', deleteProfile: 'elimina', activateProfile: 'attiva' })) {
    handle(nome, (_, o) => ({ ok: true, ...profili[fn](vaultDir(), o) }));
  }
  handle('list', (_, o) => ({ ok: true, sessions: chat.elenco(zaino(o), o.zaino) }));
  handle('read', (_, o) => ({ ok: true, session: chat.leggi(zaino(o), o.zaino, o.id) }));
  handle('create', (_, o) => ({ ok: true, session: chat.crea(zaino(o), o.zaino, o) }));
  handle('remove', (_, o) => { chat.elimina(zaino(o), o.zaino, o.id); return { ok: true }; });
  handle('send', async (e, o) => {
    const v = zaino(o); validaProvider(o.provider);
    if (typeof o.model !== 'string' || !o.model.trim() || o.model.length > 200) throw new Error('Scegli un modello AI.');
    if (pending.has(e.sender.id)) throw new Error('Attendi la risposta o premi Interrompi.');
    const apiKey = readKey(o.provider); if (!apiKey) throw new Error('Configura la chiave API nelle impostazioni.');
    const ctrl = new AbortController(); pending.set(e.sender.id, ctrl);
    try {
      const r = await chat.invia(v, o.zaino, o, { apiKey, signal: ctrl.signal });
      return { ok: !r.error, ...r };
    } finally { if (pending.get(e.sender.id) === ctrl) pending.delete(e.sender.id); }
  });
  handle('cancel', (e) => { pending.get(e.sender.id)?.abort(); return { ok: true }; });
  app.on('web-contents-created', (_, contents) => {
    const annulla = () => { pending.get(contents.id)?.abort(); };
    contents.on('did-start-navigation', (details) => { if (details.isMainFrame && !details.isInPlace) annulla(); });
    contents.on('destroyed', () => { annulla(); pending.delete(contents.id); });
  });
  app.on('before-quit', () => { for (const ctrl of pending.values()) ctrl.abort(); });
}
module.exports = { ponte, registra };
