/* Tutor flottante e preferenze. Il markdown delle risposte conserva solo
 * formattazione locale; i link attivi appartengono alle fonti del backend. */
(function (root, factory) {
  'use strict';
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  else {
    root.ZainoChatUI = exported;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', exported.init);
    else exported.init();
  }
}(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  function safeLink(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch (_) { return ''; }
  }
  function sourceLabel(source) {
    const name = source.file || source.title || '';
    const citation = source.citation || '';
    return [citation, name && !citation.includes(name) ? name : '', source.page && !citation.includes('p. ' + source.page) ? 'pagina ' + source.page : ''].filter(Boolean).join(' · ') || 'Fonte';
  }
  function datedTitle(value) {
    const date = new Date(value || Date.now());
    const valid = Number.isNaN(date.getTime()) ? new Date() : date;
    return 'Chat del ' + valid.toLocaleString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }
  function speechText(message) {
    // Si legge soltanto la risposta mostrata, mai metadati o ragionamento del provider.
    return message?.role === 'assistant' ? String(message.content || '').trim() : '';
  }
  function notesSaved(first, second, flushed) {
    return flushed !== false && !first?.dirty && !second?.dirty;
  }
  function copyFormatting(source, doc) {
    const fragment = doc.createDocumentFragment();
    const allowed = new Set(['p','br','strong','em','b','i','code','pre','ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote','sup','sub','hr']);
    function copy(node, target) {
      if (node.nodeType === 3) { target.appendChild(doc.createTextNode(node.nodeValue)); return; }
      if (node.nodeType !== 1) return;
      const tag = node.nodeName.toLowerCase();
      if (['script','style','template','svg','math','iframe','object'].includes(tag)) return;
      // Il modello non può creare attributi, eventi, immagini, link o comandi dell’app.
      const out = allowed.has(tag) ? doc.createElement(tag) : target;
      if (out !== target) target.appendChild(out);
      Array.from(node.childNodes).forEach(child => copy(child, out));
    }
    Array.from(source.childNodes).forEach(node => copy(node, fragment));
    return fragment;
  }
  function init() {
    if (document.getElementById('zchatWindow')) return;
    const api = window.vault && window.vault.chat;
    const $ = id => document.getElementById(id);
    const markdown = window.LetturaCapitolo?.crea();
    const state = { zaino: null, session: null, sessions: [], profiles: [], activeId: '', catalog: [], keys: {},
      settings: { provider: '', model: '' }, modelCache: {}, sending: false, loading: false, epoch: 0, readEpoch: 0,
      configEpoch: 0, pending: '', drafts: new Map(), ready: false, returnFocus: null,
      sendPromise: null, cancelSending: false, finishing: false, naming: null, speechToken: 0, speaking: '', audio: null };
    const descriptions = {
      socratico: 'Ti accompagna nel ragionamento con una domanda alla volta e piccoli indizi.',
      spiegamelo: 'Spiega con il tuo profilo di apprendimento. Può consultare Wikipedia e indicare le fonti.',
      chiedimelo: 'Ti propone una domanda alla volta, aspetta la tua risposta e adatta il ripasso al tuo profilo.'
    };
    const fields = {
      lettura: ['Lettura', [['semplice','Frasi semplici e termini spiegati'],['standard','Lettura standard'],['avanzata','Linguaggio articolato']]],
      caricoCognitivo: ['Carico cognitivo', [['ridotto','Una sola idea, pochi passaggi'],['moderato','Piccoli blocchi di idee'],['alto','Più passaggi e collegamenti']]],
      conoscenze: ['Conoscenze di partenza', [['principiante','Parto dalle basi'],['intermedio','Conosco già le basi'],['esperto','Ho conoscenze approfondite']]],
      stile: ['Preferisco affrontare un concetto...', [['passo-passo','Passo dopo passo'],['dialogo','Attraverso il dialogo'],['schema','Con uno schema'],['analogie','Con analogie e confronti']]],
      lunghezza: ['Lunghezza delle risposte', [['breve','Breve'],['media','Media'],['dettagliata','Dettagliata']]],
      esempi: ['Esempi', [['quotidiani','Situazioni quotidiane'],['visivi-descritti','Immagini descritte a parole'],['tecnici','Esempi tecnici'],['nessuno','Solo quando li chiedo']]],
      verifiche: ['Verifiche di comprensione', [['frequenti','Frequenti, una alla volta'],['alla-fine','Alla fine della spiegazione'],['su-richiesta','Quando le chiedo']]]
    };
    const presets = {
      equilibrato: { nome: 'Equilibrato', lettura: 'standard', caricoCognitivo: 'moderato', conoscenze: 'intermedio', stile: 'passo-passo', lunghezza: 'media', esempi: 'quotidiani', verifiche: 'alla-fine' },
      eli5: { nome: "Explain like I'm 5", lettura: 'semplice', caricoCognitivo: 'ridotto', conoscenze: 'principiante', stile: 'analogie', lunghezza: 'breve', esempi: 'quotidiani', verifiche: 'frequenti' },
      feynman: { nome: 'Mr Feynman', lettura: 'semplice', caricoCognitivo: 'moderato', conoscenze: 'intermedio', stile: 'analogie', lunghezza: 'media', esempi: 'quotidiani', verifiche: 'frequenti' }
    };
    function el(tag, text, className) {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = String(text);
      if (className) node.className = className;
      return node;
    }
    function options(select, items, value, placeholder) {
      select.replaceChildren();
      if (placeholder) select.appendChild(new Option(placeholder, ''));
      items.forEach(item => select.appendChild(new Option(item.nome || item.title || item.id, item.id)));
      select.value = items.some(item => item.id === value) ? value : '';
    }
    function errorText(error) { return String(error && error.message || error || 'Operazione non riuscita.').slice(0, 600); }
    function status(id, message, error) {
      const target = $(id); target.textContent = message || ''; target.classList.toggle('zchat-error', !!error);
    }
    async function call(method, ...args) {
      if (!api || typeof api[method] !== 'function') throw new Error('La chat è disponibile nell’app desktop StudIA - ZAINO.');
      const result = await api[method](...args);
      if (result && result.ok === false) throw new Error(result.error || 'Operazione non riuscita.');
      return result;
    }
    function currentZaino() { return typeof window.zainoAttivo === 'function' ? window.zainoAttivo() : null; }
    function current(epoch, zaino) { return state.epoch === epoch && state.zaino === zaino && currentZaino() === zaino; }
    function hasKey(provider) {
      const value = state.keys[provider];
      return value === true || !!(value && typeof value === 'object' && (value.set || value.present || value.saved || value.configured || value.exists));
    }
    function preserveLegacy(paneName, markup) {
      const pane = document.querySelector('.set-pane[data-pane="' + paneName + '"]');
      if (!pane) return;
      const legacy = el('div', undefined, 'zchat-legacy'); legacy.hidden = true; legacy.inert = true;
      while (pane.firstChild) legacy.appendChild(pane.firstChild);
      pane.appendChild(legacy);
      const added = el('div', undefined, 'zchat-settings'); added.innerHTML = markup; pane.appendChild(added);
      // La voce di lettura resta una preferenza dello zaino, con il suo cablaggio esistente.
      if (paneName === 'utente' && $('voceBox')) {
        const voce = $('voceBox'); added.appendChild(voce);
        const nota = voce.querySelector('.set-note');
        if (nota) nota.textContent = nota.textContent.replace('legge i capitoli', 'legge documenti e appunti');
      }
    }
    let toggle = $('chatBtn');
    if (!toggle) {
      toggle = el('button', 'Chat AI', 'iconbtn'); toggle.id = 'chatBtn'; toggle.type = 'button';
      const settingsButton = $('settingsBtn');
      if (settingsButton) settingsButton.before(toggle);
      else document.querySelector('.topbar').appendChild(toggle);
    }
    toggle.hidden = false; toggle.setAttribute('aria-haspopup', 'dialog'); toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'zchatWindow'); toggle.title = 'Apri il tutor AI dello zaino';
    const panel = el('section', undefined, 'zchat-window'); panel.id = 'zchatWindow'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chat AI dello zaino'); panel.setAttribute('aria-modal', 'false');
    panel.innerHTML = `
      <div class="tbar zchat-head" id="zchatHandle" tabindex="0" aria-label="Sposta finestra chat: trascina o usa i tasti freccia">
        <label class="zchat-role-label"><span class="zchat-sr">Ruolo del tutor</span><select id="zchatRole"><option value="socratico">Socratico</option><option value="spiegamelo">Spiegamelo</option><option value="chiedimelo">Chiedimelo</option></select></label>
        <i class="tbsep" aria-hidden="true"></i>
        <button class="tbtn" type="button" id="zchatNew" aria-label="Nuova conversazione" title="Nuova conversazione">+</button>
        <span class="tbspazio"></span>
        <button class="tbtn" type="button" id="zchatSettings" aria-label="Impostazioni AI" title="Impostazioni AI">⚙</button>
        <button class="tbtn" type="button" id="zchatCollapse" aria-label="Collassa la chat" aria-expanded="true" title="Collassa la chat">−</button>
        <button class="tbtn" type="button" id="zchatClose" aria-label="Chiudi la chat" title="Chiudi la chat">×</button>
      </div>
      <div id="zchatMessages" class="zchat-messages" role="log" aria-label="Messaggi" aria-live="polite" aria-relevant="additions"></div>
      <form id="zchatForm" class="zchat-composer">
        <p id="zchatStatus" class="zchat-hint" role="status" aria-live="polite"></p>
        <div class="zchat-compose-row tbar-ctl"><label for="zchatInput" class="zchat-sr">Messaggio al tutor. Invio per inviare, Maiusc più Invio per andare a capo.</label>
          <textarea id="zchatInput" rows="1" maxlength="12000" placeholder="Scrivi un messaggio…"></textarea>
          <button type="button" class="tbtn" id="zchatStop" hidden aria-label="Interrompi la risposta" title="Interrompi la risposta">■︎</button>
          <button type="submit" class="tbtn acc" id="zchatSend" aria-label="Invia messaggio" title="Invia messaggio">↑︎</button>
        </div>
      </form>`;
    document.body.appendChild(panel);
    const renameDialog = el('dialog', undefined, 'zchat-rename'); renameDialog.id = 'zchatRenameDialog';
    renameDialog.setAttribute('aria-labelledby', 'zchatRenameTitle'); renameDialog.setAttribute('aria-describedby', 'zchatRenameNote');
    renameDialog.innerHTML = `<form id="zchatRenameForm"><h2 id="zchatRenameTitle">Dai un nome alla conversazione</h2><p id="zchatRenameNote">La chat è già salvata nello zaino.</p><label for="zchatRenameInput">Nome</label><input id="zchatRenameInput" class="ctl-input" type="text" maxlength="160" required><div class="zchat-rename-actions"><button class="tbtn" type="button" id="zchatRenameDefault">Mantieni data</button><button class="tbtn acc" type="submit" id="zchatRenameSave">Salva nome</button></div></form>`;
    document.body.appendChild(renameDialog);
    try { const role = localStorage.getItem('studia-zaino.chat-role'); if (descriptions[role]) $('zchatRole').value = role; } catch (_) {}
    preserveLegacy('utente', `
      <div class="set-sec-h">Il tuo modo di imparare</div>
      <p class="set-note">Queste preferenze aiutano il tutor a rendere le risposte accessibili. Spiegamelo e Chiedimelo le leggono a ogni messaggio. Descrivi ciò che ti aiuta a studiare: non servono diagnosi.</p>
      <div class="zchat-profile-actions"><label class="zchat-grow">Profilo da modificare<select id="zchatProfileEdit"></select></label><button type="button" class="tbtn" id="zchatProfileNew">Nuovo</button><button type="button" class="tbtn" id="zchatProfileClone">Clona</button><button type="button" class="tbtn" id="zchatProfileDelete">Elimina</button></div>
      <p id="zchatActiveProfile" class="set-note"></p>
      <form id="zchatProfileForm"><div class="setgrid" id="zchatProfileFields"><label>Nome del profilo<input type="text" id="zchatProfileName" required maxlength="80"></label><label>Lingua delle risposte<input type="text" id="zchatProfileLanguage" required maxlength="40" value="Italiano"></label></div>
      <label class="zchat-field">Altre preferenze<textarea id="zchatProfilePreferences" rows="3" maxlength="1200" placeholder="Per esempio: uso la sintesi vocale; spiegami i termini nuovi; evita tabelle larghe."></textarea></label>
      <p class="set-note">Sono preferenze modificabili, non una valutazione delle tue capacità. Il profilo selezionato viene inviato al provider insieme alla richiesta.</p>
      <div class="zchat-profile-actions"><button type="submit" class="tbtn acc">Salva profilo</button><button type="button" class="tbtn" id="zchatProfileActivate">Usa come predefinito</button></div></form>
      <div class="set-sec-h">Prova un preset</div><p class="set-note">Crea una copia modificabile e confronta modi diversi di studiare.</p><div class="zchat-profile-actions" id="zchatPresets"></div>
      <p id="zchatProfileStatus" class="set-note" role="status" aria-live="polite"></p>`);
    preserveLegacy('ai', `
      <div class="set-sec-h">Provider e modelli della chat</div>
      <p class="set-note">Inserisci una chiave personale del provider scelto. L’elenco dei modelli viene richiesto con quella chiave; disponibilità e costi dipendono dal tuo account.</p>
      <div class="setgrid"><label>Provider<select id="zchatSettingsProvider"></select></label><label>Modello per la chat<select id="zchatSettingsModel"></select></label></div>
      <p id="zchatProviderNote" class="set-note"></p>
      <p class="set-note">La chat usa il profilo predefinito scelto in Impostazioni → Utente. A ogni invio rilegge documenti e appunti dello zaino; invia al provider i passaggi pertinenti, la cronologia e il profilo. Spiegamelo può cercare l’argomento su Wikipedia. Le conversazioni restano nel vault.</p>
      <div class="zchat-profile-actions"><a id="zchatKeyLink" target="_blank" rel="noopener noreferrer">Crea una API key</a><button type="button" class="tbtn" id="zchatModelsRefresh">Aggiorna elenco modelli</button></div>
      <p id="zchatKeyStatus" class="set-note"></p><form id="zchatKeyForm"><label class="zchat-field">Nuova API key<input id="zchatKeyInput" class="ctl-input" type="password" autocomplete="new-password" spellcheck="false" placeholder="Incolla una nuova chiave" maxlength="1000"></label><div class="zchat-profile-actions"><button type="submit" class="tbtn acc" id="zchatKeySave">Salva chiave</button><button type="button" class="tbtn" id="zchatKeyRemove">Rimuovi chiave</button></div></form>
      <p id="zchatAIStatus" class="set-note" role="status" aria-live="polite"></p>`);
    for (const [key, [labelText, choices]] of Object.entries(fields)) {
      const label = el('label', labelText); const select = el('select'); select.id = 'zchatField-' + key;
      choices.forEach(([value, label]) => select.appendChild(new Option(label, value))); label.appendChild(select); $('zchatProfileFields').appendChild(label);
    }
    Object.entries(presets).forEach(([id, preset]) => {
      const button = el('button', preset.nome, 'tbtn'); button.type = 'button';
      button.addEventListener('click', () => profileAction(async () => {
        const result = await call('saveProfile', { ...preset, lingua: 'Italiano', preferenze: '' });
        applyProfiles(result); const saved = result.profile || result.profiles.find(p => !state.previousProfileIds.has(p.id));
        editProfile(saved && saved.id || state.activeId); status('zchatProfileStatus', 'Preset creato. Puoi modificarlo o usarlo come predefinito.');
      })); $('zchatPresets').appendChild(button);
    });
    function profileName(id) { const found = state.profiles.find(p => p.id === id); return found ? found.nome : ''; }
    function applyProfiles(result) {
      state.previousProfileIds = new Set(state.profiles.map(p => p.id));
      state.profiles = result.profiles || []; state.activeId = result.activeId || state.profiles[0]?.id || '';
      const editing = $('zchatProfileEdit').value;
      options($('zchatProfileEdit'), state.profiles, editing || state.activeId);
      $('zchatActiveProfile').textContent = 'Predefinito: ' + (profileName(state.activeId) || 'nessuno');
    }
    function editProfile(id) {
      const profile = state.profiles.find(p => p.id === id) || { ...presets.equilibrato, nome: '', lingua: 'Italiano', preferenze: '' };
      $('zchatProfileEdit').value = id || '';
      $('zchatProfileName').value = profile.nome || ''; $('zchatProfileLanguage').value = profile.lingua || 'Italiano';
      $('zchatProfilePreferences').value = profile.preferenze || '';
      for (const key of Object.keys(fields)) $('zchatField-' + key).value = profile[key] || presets.equilibrato[key];
      $('zchatProfileClone').disabled = !id; $('zchatProfileDelete').disabled = !id;
      $('zchatProfileActivate').disabled = !id || id === state.activeId;
    }
    let profileBusy = false;
    async function profileAction(action) {
      if (profileBusy) return; profileBusy = true;
      const controls = document.querySelectorAll('.set-pane[data-pane="utente"] .zchat-settings button');
      controls.forEach(button => { button.disabled = true; });
      try { await action(); } catch (error) { status('zchatProfileStatus', errorText(error), true); }
      finally { profileBusy = false; controls.forEach(button => { button.disabled = false; });
        const id = $('zchatProfileEdit').value;
        $('zchatProfileClone').disabled = !id; $('zchatProfileDelete').disabled = !id; $('zchatProfileActivate').disabled = !id || id === state.activeId;
      }
    }
    $('zchatProfileEdit').addEventListener('change', () => { editProfile($('zchatProfileEdit').value); status('zchatProfileStatus', ''); });
    $('zchatProfileNew').addEventListener('click', () => { editProfile(''); $('zchatProfileName').focus(); status('zchatProfileStatus', 'Nuovo profilo: compila i campi e salva.'); });
    $('zchatProfileForm').addEventListener('submit', event => {
      event.preventDefault(); profileAction(async () => {
        const profile = { id: $('zchatProfileEdit').value || undefined, nome: $('zchatProfileName').value.trim(), lingua: $('zchatProfileLanguage').value.trim(), preferenze: $('zchatProfilePreferences').value.trim() };
        for (const key of Object.keys(fields)) profile[key] = $('zchatField-' + key).value;
        const result = await call('saveProfile', profile); applyProfiles(result);
        const saved = result.profile || result.profiles.find(p => p.id === profile.id || !state.previousProfileIds.has(p.id));
        editProfile(saved?.id || state.activeId); status('zchatProfileStatus', 'Profilo salvato.');
      });
    });
    $('zchatProfileClone').addEventListener('click', () => profileAction(async () => {
      const result = await call('cloneProfile', $('zchatProfileEdit').value); applyProfiles(result);
      const copy = result.profile || result.profiles.find(p => !state.previousProfileIds.has(p.id));
      editProfile(copy?.id || state.activeId); status('zchatProfileStatus', 'Copia creata. Puoi rinominarla e modificarla.');
    }));
    $('zchatProfileDelete').addEventListener('click', () => {
      const id = $('zchatProfileEdit').value;
      if (!id || !window.confirm('Eliminare il profilo “' + profileName(id) + '”? Le conversazioni salvate restano nello zaino.')) return;
      profileAction(async () => { applyProfiles(await call('deleteProfile', id)); editProfile(state.activeId); status('zchatProfileStatus', 'Profilo eliminato.'); });
    });
    $('zchatProfileActivate').addEventListener('click', () => profileAction(async () => {
      const id = $('zchatProfileEdit').value; applyProfiles(await call('activateProfile', id));
      editProfile(id); status('zchatProfileStatus', 'Profilo predefinito aggiornato.');
    }));
    function drawConfig() {
      const provider = state.settings.provider;
      const known = state.catalog.find(item => item.id === provider);
      const choices = state.catalog.map(item => ({ ...item, nome: item.nome + (hasKey(item.id) ? ' · chiave salvata' : '') }));
      ['zchatSettingsProvider'].forEach(id => options($(id), choices, provider, 'Scegli provider'));
      const models = state.modelCache[provider] || [];
      ['zchatSettingsModel'].forEach(id => options($(id), models, state.settings.model, hasKey(provider) ? 'Scegli modello' : 'Inserisci una API key'));
      $('zchatProviderNote').textContent = known?.nota || '';
      const href = safeLink(known?.keyUrl); const link = $('zchatKeyLink');
      link.hidden = !href; if (href) link.href = href; else link.removeAttribute('href');
      link.textContent = 'Crea una API key ' + (known?.nome || '');
      $('zchatKeyStatus').textContent = hasKey(provider) ? 'Chiave salvata. Per sicurezza non viene mostrata.' : 'Nessuna chiave salvata per questo provider.';
      $('zchatKeyRemove').disabled = !hasKey(provider); $('zchatKeySave').disabled = !provider;
      $('zchatModelsRefresh').disabled = !provider || !hasKey(provider);
      updateControls();
    }
    let modelsEpoch = 0;
    async function refreshModels() {
      const provider = state.settings.provider; const epoch = ++modelsEpoch;
      if (!provider || !hasKey(provider)) { drawConfig(); return; }
      $('zchatModelsRefresh').disabled = true; status('zchatAIStatus', 'Caricamento dei modelli disponibili…');
      try {
        const result = await call('models', { provider });
        if (epoch !== modelsEpoch || provider !== state.settings.provider) return;
        state.modelCache[provider] = (result.models || []).map(item => typeof item === 'string' ? {id: item, nome: item} : item);
        if (!state.modelCache[provider].some(model => model.id === state.settings.model)) {
          state.settings.model = ''; await call('saveSettings', state.settings);
          if (epoch !== modelsEpoch || provider !== state.settings.provider) return;
        }
        drawConfig(); status('zchatAIStatus', state.modelCache[provider].length ? state.modelCache[provider].length + ' modelli disponibili. Seleziona quello da usare nella chat.' : 'Il provider non ha restituito modelli per la chat con questa chiave.');
      } catch (error) {
        if (epoch !== modelsEpoch || provider !== state.settings.provider) return;
        delete state.modelCache[provider]; drawConfig(); status('zchatAIStatus', errorText(error), true);
      }
    }
    async function selectProvider(provider) {
      if (state.sending) return; const epoch = ++state.configEpoch;
      state.settings = { provider, model: '' }; $('zchatKeyInput').value = ''; drawConfig();
      try { if (provider) await call('saveSettings', state.settings); if (epoch === state.configEpoch) await refreshModels(); }
      catch (error) { if (epoch === state.configEpoch) status('zchatAIStatus', errorText(error), true); }
    }
    async function selectModel(model) {
      if (state.sending) return; state.settings.model = model; drawConfig();
      try { await call('saveSettings', state.settings); status('zchatAIStatus', 'Modello per la chat salvato.'); }
      catch (error) { status('zchatAIStatus', errorText(error), true); }
    }
    ['zchatSettingsProvider'].forEach(id => $(id).addEventListener('change', () => selectProvider($(id).value)));
    ['zchatSettingsModel'].forEach(id => $(id).addEventListener('change', () => selectModel($(id).value)));
    $('zchatModelsRefresh').addEventListener('click', refreshModels);
    let keyBusy = false;
    $('zchatKeyForm').addEventListener('submit', async event => {
      event.preventDefault(); if (keyBusy) return;
      const provider = state.settings.provider; const value = $('zchatKeyInput').value.trim();
      if (!provider || !value) { status('zchatAIStatus', 'Scegli il provider e inserisci la nuova API key.', true); return; }
      keyBusy = true; $('zchatKeySave').disabled = true;
      try {
        await call('setKey', { provider, value }); $('zchatKeyInput').value = '';
        state.keys = await call('keysStatus'); delete state.modelCache[provider]; drawConfig();
        status('zchatAIStatus', 'Chiave salvata.'); if (provider === state.settings.provider) await refreshModels();
      } catch (error) { status('zchatAIStatus', errorText(error), true); }
      finally { keyBusy = false; $('zchatKeyInput').value = ''; drawConfig(); }
    });
    $('zchatKeyRemove').addEventListener('click', async () => {
      const provider = state.settings.provider;
      if (keyBusy || !provider || !window.confirm('Rimuovere la chiave API di ' + (state.catalog.find(p => p.id === provider)?.nome || provider) + '?')) return;
      keyBusy = true;
      try {
        await call('clearKey', { provider }); state.keys = await call('keysStatus'); delete state.modelCache[provider];
        if (provider === state.settings.provider) { state.settings.model = ''; await call('saveSettings', state.settings); }
        drawConfig(); status('zchatAIStatus', 'Chiave rimossa.');
      } catch (error) { status('zchatAIStatus', errorText(error), true); }
      finally { keyBusy = false; drawConfig(); }
    });
    function drawSources(parent, context) {
      if (!context) return;
      const sources = context.sources || [], warnings = context.warnings || [];
      if (!sources.length && !warnings.length) return;
      const details = el('details', undefined, 'zchat-sources');
      details.appendChild(el('summary', sources.length ? 'Fonti · ' + sources.length + (warnings.length ? ' · Note' : '') : 'Note sulla risposta'));
      if (sources.length) {
        const list = el('ul');
        sources.forEach(source => {
          const li = el('li'); const href = safeLink(source.url);
          if (href) { const a = el('a', sourceLabel(source)); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); }
          else li.textContent = sourceLabel(source);
          list.appendChild(li);
        }); details.appendChild(list);
      }
      if (warnings.length) details.appendChild(el('p', warnings.join('\n'), 'zchat-hint zchat-context-warning'));
      parent.appendChild(details);
    }
    function messageButton(text, label, className, message, action) {
      const button = el('button', text, 'tbtn ' + className); button.type = 'button';
      button.setAttribute('aria-label', label); button.title = label; button.dataset.messageId = message.id;
      button.addEventListener('click', action); return button;
    }
    function updateSpeechButtons() {
      panel.querySelectorAll('.zchat-speak').forEach(button => {
        const active = button.dataset.messageId === state.speaking;
        button.textContent = active ? '■︎' : '▷'; button.setAttribute('aria-pressed', String(active));
        button.title = active ? 'Ferma la lettura' : 'Leggi la risposta'; button.setAttribute('aria-label', button.title);
      });
    }
    function stopSpeech() {
      const wasSpeaking = !!state.speaking; ++state.speechToken; state.speaking = '';
      if (state.audio) { state.audio.pause(); state.audio.removeAttribute('src'); state.audio.load(); state.audio = null; }
      if (wasSpeaking && window.speechSynthesis) window.speechSynthesis.cancel();
      updateSpeechButtons();
    }
    async function speak(message) {
      const again = state.speaking === message.id; stopSpeech(); if (again) return;
      const text = speechText(message); if (!text) return;
      if (typeof window.stopTTS === 'function') window.stopTTS();
      const token = state.speechToken; state.speaking = message.id; updateSpeechButtons();
      const segmenti = window.TtsSegmenta?.ttsSegmenti(text) || [{t: text, rate: 1, pausa: 0}];
      const voce = window.vault?.voce;
      let prefs = {}; try { prefs = window.vault?.prefs?.read() || {}; } catch (_) {}
      const rate = typeof ttsRate === 'number' ? ttsRate : 1;
      try {
        if (voce?.disponibile && prefs.voce !== '__web') {
          let nome = prefs.voce || (typeof TTS !== 'undefined' ? TTS.voceSistema : null);
          if (!nome) nome = (await voce.elenco()).migliore;
          if (token !== state.speechToken) return;
          status('zchatStatus', 'Preparo la lettura…');
          // La chiave unica evita collisioni con file audio di altri zaini o risposte modificate.
          const key = 'chat-' + Date.now() + '-' + token;
          const result = await voce.rendi(segmenti, nome, rate, key);
          if (token !== state.speechToken) return;
          if (!result?.ok || !result.url) throw new Error(result?.errore || 'La lettura di sistema non è disponibile.');
          const audio = new Audio(result.url); state.audio = audio;
          audio.onended = () => { if (token === state.speechToken) stopSpeech(); };
          audio.onerror = () => { if (token === state.speechToken) { stopSpeech(); status('zchatStatus', 'Impossibile riprodurre la risposta.', true); } };
          await audio.play(); if (token === state.speechToken) status('zchatStatus', '');
          return;
        }
        if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) throw new Error('Sintesi vocale non disponibile su questo sistema.');
        const voices = window.speechSynthesis.getVoices(); const voice = voices.find(v => /^it(?:-|_)/i.test(v.lang));
        let index = 0;
        const next = () => {
          if (token !== state.speechToken) return;
          if (index >= segmenti.length) { stopSpeech(); return; }
          const utterance = new SpeechSynthesisUtterance(segmenti[index++].t);
          utterance.lang = voice?.lang || 'it-IT'; if (voice) utterance.voice = voice; utterance.rate = rate;
          utterance.onend = next;
          utterance.onerror = () => { if (token === state.speechToken) { stopSpeech(); status('zchatStatus', 'Lettura vocale interrotta.', true); } };
          window.speechSynthesis.speak(utterance);
        }; next();
      } catch (error) { if (token === state.speechToken) { stopSpeech(); status('zchatStatus', errorText(error), true); } }
    }
    function drawMessages() {
      const box = $('zchatMessages'); box.replaceChildren();
      const messages = state.session?.messages || [];
      if (!messages.length && !state.pending) {
        const empty = el('div', undefined, 'zchat-empty');
        empty.appendChild(el('b', state.zaino ? 'Da dove riprendiamo?' : 'Scegli uno zaino per iniziare.'));
        empty.appendChild(el('p', state.zaino ? 'Scrivi un messaggio per iniziare una nuova chat.' : 'Apri o crea uno zaino dalla barra in alto.'));
        if (state.zaino && state.sessions.length) {
          const list = el('ul', undefined, 'zchat-history'); list.setAttribute('aria-label', 'Conversazioni precedenti');
          state.sessions.forEach(session => {
            const li = el('li'); const button = el('button', undefined, 'zchat-history-item'); button.type = 'button'; button.dataset.sessionId = session.id;
            button.appendChild(el('span', session.title || datedTitle(session.createdAt), 'zchat-history-title'));
            const date = new Date(session.updatedAt || session.createdAt);
            if (!Number.isNaN(date.getTime())) button.appendChild(el('span', date.toLocaleDateString('it-IT', {day:'numeric',month:'short',year:'numeric'}), 'zchat-history-date'));
            button.disabled = state.loading || state.finishing; button.addEventListener('click', () => resumeSession(session.id)); li.appendChild(button);
            const remove = el('button', '×', 'tbtn zchat-history-delete'); remove.type = 'button'; remove.title = 'Elimina conversazione'; remove.setAttribute('aria-label', 'Elimina conversazione ' + (session.title || '')); remove.disabled = state.loading || state.finishing;
            remove.addEventListener('click', () => removeSession(session)); li.appendChild(remove); list.appendChild(li);
          }); empty.appendChild(list);
        }
        box.appendChild(empty);
      }
      function appendMessage(message) {
        if (!['user','assistant'].includes(message.role)) return;
        const article = el('article', undefined, 'zchat-message zchat-message-' + message.role);
        article.setAttribute('aria-label', message.role === 'user' ? 'Tu' : 'Tutor AI');
        const body = el('div', message.content || '', 'zchat-message-text');
        if (message.role === 'assistant' && markdown) {
          try {
            const template = document.createElement('template');
            template.innerHTML = markdown.mdToHtml(String(message.content || ''), true);
            body.replaceChildren(copyFormatting(template.content, document)); body.classList.add('zchat-markdown');
          } catch (_) { /* Un testo non formattabile rimane leggibile per intero. */ }
        }
        article.appendChild(body);
        if (message.status === 'error' || message.status === 'cancelled') article.appendChild(el('p', message.error || 'Risposta interrotta. Puoi inviare di nuovo il messaggio.', 'zchat-hint zchat-error'));
        drawSources(article, message.context);
        if (message.role === 'assistant' && speechText(message)) {
          const actions = el('div', undefined, 'zchat-message-actions');
          actions.appendChild(messageButton('⧉', 'Copia risposta', 'zchat-copy', message, async () => {
            try { await navigator.clipboard.writeText(speechText(message)); status('zchatStatus', 'Risposta copiata.'); }
            catch (error) { status('zchatStatus', 'Impossibile copiare la risposta: ' + errorText(error), true); }
          }));
          actions.appendChild(messageButton('▷', 'Leggi la risposta', 'zchat-speak', message, () => speak(message)));
          const branch = messageButton('↗︎', 'Nuova conversazione da qui', 'zchat-branch', message, () => branchSession(message.id));
          branch.disabled = state.sending || state.loading || state.finishing; actions.appendChild(branch); article.appendChild(actions);
        }
        box.appendChild(article);
      }
      messages.forEach(appendMessage);
      if (state.pending) appendMessage({ role: 'user', content: state.pending });
      if (state.sending) box.appendChild(el('p', 'Il tutor sta scrivendo…', 'zchat-thinking'));
      updateSpeechButtons(); box.scrollTop = messages.length || state.pending ? box.scrollHeight : 0;
    }
    function resizeInput() { const input = $('zchatInput'); input.style.height = 'auto'; input.style.height = Math.min(128, input.scrollHeight) + 'px'; }
    function updateControls() {
      const busy = state.sending || state.loading || state.finishing;
      $('zchatRole').disabled = !state.zaino || busy;
      $('zchatRole').title = descriptions[$('zchatRole').value];
      $('zchatNew').disabled = !state.zaino || state.loading || state.finishing;
      ['zchatSettingsProvider','zchatSettingsModel'].forEach(id => { $(id).disabled = state.sending || !state.ready; });
      $('zchatInput').disabled = !state.zaino || state.sending || state.loading || state.finishing || !api;
      const validModel = (state.modelCache[state.settings.provider] || []).some(model => model.id === state.settings.model);
      $('zchatSend').disabled = !state.zaino || busy || !api || !state.ready || !hasKey(state.settings.provider) || !validModel || !$('zchatInput').value.trim();
      $('zchatStop').hidden = !state.sending; $('zchatSend').hidden = state.sending;
      panel.querySelectorAll('.zchat-branch,.zchat-history-item,.zchat-history-delete').forEach(button => { button.disabled = busy; });
    }
    function rememberSession(session) {
      if (!session) return;
      state.sessions = state.sessions.filter(s => s.id !== session.id); state.sessions.unshift(session);
    }
    function restoreSession(session) {
      stopSpeech(); state.session = session;
      if (session) $('zchatRole').value = session.role || 'socratico';
      drawMessages(); updateControls();
    }
    async function loadSessions() {
      const zaino = state.zaino; const epoch = state.epoch; const readEpoch = ++state.readEpoch;
      if (!zaino) { state.sessions = []; restoreSession(null); return; }
      state.loading = true; updateControls();
      try {
        const result = await call('list', zaino);
        if (!current(epoch, zaino) || readEpoch !== state.readEpoch) return;
        state.sessions = result.sessions || []; drawMessages();
        status('zchatStatus', state.ready && !hasKey(state.settings.provider) ? 'Configura il provider e il modello con l’ingranaggio.' : '');
      } catch (error) { if (current(epoch, zaino) && readEpoch === state.readEpoch) status('zchatStatus', errorText(error), true); }
      finally { if (current(epoch, zaino) && readEpoch === state.readEpoch) { state.loading = false; updateControls(); } }
    }
    function dismissNaming(title) {
      if (!state.naming) return;
      const resolve = state.naming; state.naming = null; if (renameDialog.open) renameDialog.close(); resolve(title);
    }
    function askName(session) {
      const title = datedTitle(session.createdAt);
      $('zchatRenameInput').value = session.title || title; $('zchatRenameDefault').onclick = () => dismissNaming(title);
      return new Promise(resolve => { state.naming = resolve; renameDialog.showModal(); $('zchatRenameInput').focus(); $('zchatRenameInput').select(); });
    }
    $('zchatRenameForm').addEventListener('submit', event => { event.preventDefault(); dismissNaming($('zchatRenameInput').value.trim() || datedTitle(state.session?.createdAt)); });
    renameDialog.addEventListener('cancel', event => { event.preventDefault(); dismissNaming(null); });
    async function syncZaino() {
      const zaino = currentZaino(); if (zaino === state.zaino) return;
      if (state.zaino) state.drafts.set(state.zaino, $('zchatInput').value || state.pending);
      dismissNaming(null); stopSpeech();
      const wasSending = state.sending; const epoch = ++state.epoch; ++state.readEpoch; state.cancelSending = true;
      state.zaino = zaino; state.session = null; state.sessions = []; state.pending = ''; state.sending = false; state.loading = false;
      $('zchatInput').value = state.drafts.get(zaino) || ''; resizeInput(); drawMessages(); updateControls(); status('zchatStatus', '');
      if (wasSending) { state.loading = true; updateControls(); try { await call('cancel'); } catch (_) {} }
      if (!current(epoch, zaino)) return;
      await loadSessions();
    }
    async function resumeSession(id) {
      if (state.loading || state.finishing || state.sending) return;
      const zaino = state.zaino; const epoch = state.epoch; const readEpoch = ++state.readEpoch;
      state.loading = true; updateControls();
      try { const result = await call('read', zaino, id); if (current(epoch, zaino) && readEpoch === state.readEpoch) { restoreSession(result.session); status('zchatStatus', ''); } }
      catch (error) { if (current(epoch, zaino)) status('zchatStatus', errorText(error), true); }
      finally { if (current(epoch, zaino) && readEpoch === state.readEpoch) { state.loading = false; updateControls(); $('zchatInput').focus(); } }
    }
    async function removeSession(session) {
      if (state.loading || state.finishing || state.sending) return;
      if (!window.confirm('Eliminare “' + (session.title || datedTitle(session.createdAt)) + '” dal vault dello zaino?')) return;
      const zaino = state.zaino, epoch = state.epoch; state.loading = true; updateControls();
      try { await call('remove', zaino, session.id); if (current(epoch, zaino)) { state.sessions = state.sessions.filter(s => s.id !== session.id); drawMessages(); } }
      catch (error) { if (current(epoch, zaino)) status('zchatStatus', errorText(error), true); }
      finally { if (current(epoch, zaino)) { state.loading = false; updateControls(); } }
    }
    async function finishConversation(action) {
      if (state.finishing) return; state.finishing = true; ++state.readEpoch; state.loading = false; updateControls(); stopSpeech();
      const zaino = state.zaino;
      try {
        if (state.sending) { state.cancelSending = true; try { await call('cancel'); } catch (_) {} await state.sendPromise; }
        if (zaino !== state.zaino || zaino !== currentZaino()) return;
        const session = state.session;
        if (session?.messages?.length) {
          const title = await askName(session);
          if (zaino !== state.zaino || zaino !== currentZaino()) return;
          if (title) {
            try {
              const result = await call('rename', zaino, session.id, title);
              if (zaino !== state.zaino || zaino !== currentZaino()) return;
              state.session = result.session; rememberSession(result.session);
            } catch (error) {
              if (zaino !== state.zaino || zaino !== currentZaino()) return;
              const text = 'La chat è salvata, ma non ho potuto rinominarla: ' + errorText(error); status('zchatStatus', text, true); window.toast?.(text, false);
            }
          }
        }
        if (zaino !== state.zaino || zaino !== currentZaino()) return;
        restoreSession(null); action();
      } finally { state.finishing = false; updateControls(); if (!panel.hidden && !panel.classList.contains('is-collapsed')) $('zchatInput').focus(); }
    }
    async function branchSession(messageId) {
      if (!state.session || state.sending || state.loading || state.finishing) return;
      const zaino = state.zaino, epoch = state.epoch, id = state.session.id;
      state.loading = true; updateControls();
      try {
        const result = await call('branch', zaino, id, messageId);
        if (!current(epoch, zaino)) return;
        rememberSession(result.session); restoreSession(result.session); status('zchatStatus', 'Nuova chat creata da questa risposta.');
      } catch (error) { if (current(epoch, zaino)) status('zchatStatus', errorText(error), true); }
      finally { if (current(epoch, zaino)) { state.loading = false; updateControls(); $('zchatInput').focus(); } }
    }
    $('zchatNew').addEventListener('click', () => finishConversation(() => { setCollapsed(false); status('zchatStatus', ''); $('zchatInput').focus(); }));
    $('zchatRole').addEventListener('change', () => { try { localStorage.setItem('studia-zaino.chat-role', $('zchatRole').value); } catch (_) {} updateControls(); });
    $('zchatInput').addEventListener('input', () => { resizeInput(); updateControls(); });
    $('zchatInput').addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!$('zchatSend').disabled) $('zchatForm').requestSubmit(); }
    });
    async function sendMessage() {
      if (state.sending || state.loading || state.finishing) return;
      if (state.zaino !== currentZaino()) { await syncZaino(); return; }
      updateControls(); if ($('zchatSend').disabled) return;
      const zaino = state.zaino; const epoch = ++state.epoch;
      const request = { text: $('zchatInput').value.trim(), role: $('zchatRole').value, profileId: state.activeId, provider: state.settings.provider, model: state.settings.model };
      state.sending = true; state.cancelSending = false; updateControls();
      try {
        if (typeof window.noteFlush === 'function') await window.noteFlush();
        const secondSaved = window.appuntiParalleli?.flush ? await window.appuntiParalleli.flush() : undefined;
        if (!notesSaved(window.NOTES, window.appuntiParalleli?.stato, secondSaved)) throw new Error('Salva gli appunti aperti prima di inviare il messaggio: il tutor deve leggerne la versione aggiornata.');
        if (!current(epoch, zaino) || state.cancelSending) return;
        state.pending = request.text; $('zchatInput').value = ''; resizeInput(); status('zchatStatus', ''); drawMessages();
        if (!state.session) {
          const created = await call('create', zaino, { role: request.role, profileId: request.profileId });
          if (!current(epoch, zaino)) return;
          state.session = created.session; rememberSession(created.session);
        }
        if (state.cancelSending) { if (!$('zchatInput').value) $('zchatInput').value = request.text; return; }
        request.sessionId = state.session.id;
        const result = await api.send(zaino, request);
        if (!current(epoch, zaino)) return;
        state.pending = ''; if (result.session) { state.session = result.session; rememberSession(result.session); }
        if (result.ok === false || result.error) throw new Error(result.error || 'Il provider non ha completato la risposta.');
        status('zchatStatus', '');
      } catch (error) {
        if (current(epoch, zaino)) {
          status('zchatStatus', errorText(error), true);
          if (!$('zchatInput').value) $('zchatInput').value = request.text;
        }
      } finally {
        if (current(epoch, zaino)) { state.sending = false; state.pending = ''; resizeInput(); drawMessages(); updateControls(); if (!state.finishing && !panel.hidden) $('zchatInput').focus(); }
      }
    }
    $('zchatForm').addEventListener('submit', event => { event.preventDefault(); if (!state.sending) state.sendPromise = sendMessage(); });
    $('zchatStop').addEventListener('click', async () => {
      const epoch = state.epoch; state.cancelSending = true; status('zchatStatus', 'Interruzione della risposta…'); $('zchatStop').disabled = true;
      try { await call('cancel'); } catch (error) { if (epoch === state.epoch) status('zchatStatus', errorText(error), true); }
      finally { $('zchatStop').disabled = false; }
    });
    function setCollapsed(collapsed) {
      panel.classList.toggle('is-collapsed', collapsed);
      $('zchatMessages').hidden = collapsed; $('zchatForm').hidden = collapsed;
      const button = $('zchatCollapse'); button.textContent = collapsed ? '□' : '−'; button.setAttribute('aria-expanded', String(!collapsed));
      button.title = collapsed ? 'Espandi la chat' : 'Collassa la chat'; button.setAttribute('aria-label', button.title);
      if (!collapsed) { const rect = panel.getBoundingClientRect(); move(rect.left, rect.top); resizeInput(); $('zchatInput').focus(); }
    }
    function close() { return finishConversation(() => { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); (state.returnFocus?.isConnected ? state.returnFocus : toggle).focus(); }); }
    function open() {
      state.returnFocus = document.activeElement; panel.hidden = false; setCollapsed(false); toggle.setAttribute('aria-expanded', 'true');
      const oldZaino = state.zaino;
      syncZaino().then(async () => { if (oldZaino === state.zaino && !state.session) await loadSessions(); if (!panel.hidden) $('zchatInput').focus(); });
      if (!state.zaino) $('zchatHandle').focus();
    }
    toggle.addEventListener('click', () => panel.hidden ? open() : panel.classList.contains('is-collapsed') ? setCollapsed(false) : close());
    $('zchatClose').addEventListener('click', close);
    $('zchatCollapse').addEventListener('click', () => setCollapsed(!panel.classList.contains('is-collapsed')));
    $('zchatSettings').addEventListener('click', () => { $('settingsBtn')?.click(); const tab = document.querySelector('.set-tab[data-tab="ai"]'); if (tab) tab.click(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !renameDialog.open && !panel.hidden && panel.contains(document.activeElement) && document.documentElement.dataset.settings !== '1') { event.preventDefault(); event.stopPropagation(); close(); }
    }, true);
    window.addEventListener('beforeunload', stopSpeech);
    const handle = $('zchatHandle'); let drag = null;
    function move(x, y) {
      const rect = panel.getBoundingClientRect();
      panel.style.left = Math.max(0, Math.min(x, window.innerWidth - rect.width)) + 'px';
      panel.style.top = Math.max(0, Math.min(y, window.innerHeight - Math.min(rect.height, window.innerHeight))) + 'px';
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
    }
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button,select,label')) return;
      const rect = panel.getBoundingClientRect(); drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      handle.setPointerCapture(event.pointerId); event.preventDefault(); handle.focus();
    });
    handle.addEventListener('pointermove', event => { if (drag) move(event.clientX - drag.x, event.clientY - drag.y); });
    handle.addEventListener('pointerup', () => { drag = null; }); handle.addEventListener('pointercancel', () => { drag = null; });
    handle.addEventListener('keydown', event => {
      if (event.target !== handle || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault(); const rect = panel.getBoundingClientRect(); const step = event.shiftKey ? 40 : 10;
      move(rect.left + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), rect.top + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0));
    });
    window.addEventListener('resize', () => { if (!panel.hidden) { const rect = panel.getBoundingClientRect(); move(rect.left, rect.top); } });
    window.addEventListener('studia:zaino-changed', syncZaino); document.addEventListener('studia:zaino-changed', syncZaino);
    $('zainoSelect')?.addEventListener('change', () => { queueMicrotask(syncZaino); });
    async function start() {
      try {
        const [catalog, settings, keys, profiles] = await Promise.all([call('catalogo'), call('settings'), call('keysStatus'), call('profiles')]);
        state.catalog = catalog || []; state.settings = settings || {}; state.keys = keys || {}; applyProfiles(profiles); editProfile(state.activeId);
        state.ready = true; drawConfig(); await syncZaino(); if (state.settings.provider) await refreshModels();
      } catch (error) { status('zchatStatus', errorText(error), true); status('zchatAIStatus', errorText(error), true); }
      finally { updateControls(); }
    }
    drawMessages(); start();
  }
  return { init, safeLink, sourceLabel, datedTitle, speechText, notesSaved, copyFormatting };
}));
