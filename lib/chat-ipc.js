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
    rename: (zaino, id, title) => invoca('rename', { zaino, id, title }),
    branch: (zaino, id, messageId) => invoca('branch', { zaino, id, messageId }),
    sources: (zaino) => invoca('sources', { zaino }),
    resolveSource: (zaino, source) => invoca('resolveSource', { zaino, source }),
    saveAnswer: (zaino, id, messageId, target) => ipc.sendSync('chat:saveAnswer', { zaino, id, messageId, target }),
    scope: (zaino, id, scope) => invoca('scope', { zaino, id, scope }),
    citation: (zaino, id, messageId, alias) => invoca('citation', { zaino, id, messageId, alias }),
    send: (zaino, o) => invoca('send', { zaino, ...o }), cancel: () => invoca('cancel')
  };
}
function registra({ ipcMain, app, vaultDir, readCfg, writeCfg, readKey, recupera }) {
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
    const c = readCfg(),prodotto=provider.validaProdotto(o.infomaniakProductId ?? c.chat?.infomaniakProductId);
    c.chat = { provider:o.provider, model:o.model, ...(prodotto?{infomaniakProductId:prodotto}:{}) }; writeCfg(c);
    return { ok: true, ...c.chat };
  });
  handle('models', async (_, o) => {
    validaProvider(o.provider);
    const key = readKey(o.provider); if (!key) throw new Error('Salva prima la chiave API di questo provider.');
    return { ok: true, models: await provider.modelli(o.provider, key,{productId:settings().infomaniakProductId}) };
  });
  handle('profiles', () => ({ ok: true, ...profili.leggi(vaultDir()) }));
  for (const [nome, fn] of Object.entries({ saveProfile: 'salva', cloneProfile: 'clona', deleteProfile: 'elimina', activateProfile: 'attiva' })) {
    handle(nome, (_, o) => ({ ok: true, ...profili[fn](vaultDir(), o) }));
  }
  ipcMain.on('chat:saveAnswer', (e, o) => {
    try { e.returnValue = { ok:true, ...require('./risposte-ai').salva(zaino(o),o.zaino,o.id,o.messageId,o.target) }; }
    catch(error) { e.returnValue = { ok:false,error:error.message }; }
  });
  handle('resolveSource', (_,o) => ({ ok:true, ...require('./fonti-ai').risolvi(zaino(o),o.zaino,o.source) }));
  handle('sources', (_, o) => ({ ok: true, ...require('./fonti-ai').sincronizza(zaino(o), o.zaino) }));
  handle('scope', (_, o) => ({ ok: true, session: chat.salvaAmbito(zaino(o), o.zaino, o.id, o.scope) }));
  handle('citation', (_, o) => ({ ok: true, ...chat.citazione(zaino(o), o.zaino, o.id, o.messageId, o.alias) }));
  handle('list', (_, o) => ({ ok: true, sessions: chat.elenco(zaino(o), o.zaino) }));
  handle('read', (_, o) => ({ ok: true, session: chat.leggi(zaino(o), o.zaino, o.id) }));
  handle('create', (_, o) => ({ ok: true, session: chat.crea(zaino(o), o.zaino, o) }));
  handle('rename', (_, o) => ({ ok: true, session: chat.rinomina(zaino(o), o.zaino, o.id, o.title) }));
  handle('branch', (_, o) => ({ ok: true, session: chat.ramifica(zaino(o), o.zaino, o.id, o.messageId) }));
  handle('remove', (_, o) => { chat.elimina(zaino(o), o.zaino, o.id); return { ok: true }; });
  handle('send', async (e, o) => {
    const v = zaino(o); validaProvider(o.provider);
    if (typeof o.model !== 'string' || !o.model.trim() || o.model.length > 200) throw new Error('Scegli un modello AI.');
    if (pending.has(e.sender.id)) throw new Error('Attendi la risposta o premi Interrompi.');
    const apiKey = readKey(o.provider); if (!apiKey) throw new Error('Configura la chiave API nelle impostazioni.');
    const ctrl = new AbortController(); pending.set(e.sender.id, ctrl);
    try {
      const r = await chat.invia(v, o.zaino, o, { apiKey, productId:settings().infomaniakProductId, signal: ctrl.signal, recupera,rispondi:async request=>{
        const result=await require('./costi-zaino').misura(v,o.zaino,{provider:o.provider,model:o.model,operation:'Chat',sourceIds:o.scope?.sourceIds||[]},()=>provider.rispondi(request));
        if(!e.sender.isDestroyed?.())e.sender.send?.('costs:updated');return result;
      } });
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
