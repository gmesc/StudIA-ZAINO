/* Tutor flottante e preferenze. Le risposte AI restano testo: soltanto gli URL
 * delle fonti ricevute dal backend diventano collegamenti, mai HTML remoto. */
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
  function init() {
    if (document.getElementById('zchatWindow')) return;
    const api = window.vault && window.vault.chat;
    const $ = id => document.getElementById(id);
    const state = { zaino: null, session: null, sessions: [], profiles: [], activeId: '', catalog: [], keys: {},
      settings: { provider: '', model: '' }, modelCache: {}, sending: false, loading: false, epoch: 0, readEpoch: 0,
      configEpoch: 0, pending: '', drafts: new Map(), ready: false, returnFocus: null };
    const descriptions = {
      socratico: 'Ti accompagna nel ragionamento con una domanda alla volta e piccoli indizi.',
      spiegamelo: 'Spiega con il tuo profilo di apprendimento. Può consultare Wikipedia e indicare le fonti.',
      chiedimelo: 'Ti propone una domanda alla volta, aspetta la tua risposta e adatta il ripasso al tuo profilo.'
    };
    const fields = {
      lettura: ['Lettura', [['semplice','Frasi semplici e termini spiegati'],['standard','Lettura standard'],['avanzata','Linguaggio articolato']]],
      caricoCognitivo: ['Carico cognitivo', [['ridotto','Una sola idea, pochi passaggi'],['moderato','Piccoli blocchi di idee'],['alto','Più passaggi e collegamenti']]],
      conoscenze: ['Conoscenze di partenza', [['principiante','Parto dalle basi'],['intermedio','Conosco già le basi'],['esperto','Ho conoscenze approfondite']]],
      stile: ['Come preferisco affrontare un concetto', [['passo-passo','Passo dopo passo'],['dialogo','Attraverso il dialogo'],['schema','Con uno schema'],['analogie','Con analogie e confronti']]],
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
    const panel = el('section', undefined, 'zchat-window tbar-ctl'); panel.id = 'zchatWindow'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Chat AI dello zaino'); panel.setAttribute('aria-modal', 'false');
    panel.innerHTML = `
      <div class="zchat-head" id="zchatHandle" tabindex="0" aria-label="Sposta finestra chat: trascina o usa i tasti freccia">
        <div><b>Il tuo tutor AI</b><span id="zchatZaino" class="zchat-subtitle"></span></div>
        <button class="tbtn" type="button" id="zchatSettings" aria-label="Impostazioni della chat" title="Profili e provider AI">⚙</button>
        <button class="tbtn" type="button" id="zchatClose" aria-label="Chiudi la chat">✕</button>
      </div>
      <div class="zchat-controls">
        <div class="zchat-session-row"><label class="zchat-grow">Conversazione<select id="zchatSession"></select></label>
          <button class="tbtn" type="button" id="zchatNew">Nuova</button>
          <button class="tbtn" type="button" id="zchatDelete" aria-label="Elimina conversazione" title="Elimina conversazione">Elimina</button></div>
        <div class="zchat-two"><label>Ruolo<select id="zchatRole"><option value="socratico">Tutor socratico</option><option value="spiegamelo">Spiegamelo</option><option value="chiedimelo">Chiedimelo</option></select></label>
          <label>Profilo<select id="zchatProfile"></select></label></div>
        <p id="zchatRoleHelp" class="zchat-hint"></p>
        <div class="zchat-two"><label>Provider<select id="zchatProvider"></select></label><label>Modello<select id="zchatModel"></select></label></div>
      </div>
      <div id="zchatMessages" class="zchat-messages" role="log" aria-label="Messaggi" aria-live="polite" aria-relevant="additions"></div>
      <form id="zchatForm" class="zchat-composer">
        <p id="zchatStatus" class="zchat-hint" role="status" aria-live="polite"></p>
        <label for="zchatInput" class="zchat-sr">Messaggio al tutor</label>
        <textarea id="zchatInput" rows="3" maxlength="12000" placeholder="Da quale argomento vuoi partire?"></textarea>
        <div class="zchat-send-row"><span class="zchat-hint">Invio invia · Maiusc+Invio a capo</span><button type="button" class="tbtn" id="zchatStop" hidden>Interrompi</button><button type="submit" class="tbtn acc" id="zchatSend">Invia</button></div>
        <details class="zchat-context-note"><summary>Contesto e salvataggio</summary><p>A ogni invio la chat rilegge PDF con testo, documenti di testo e appunti salvati nello zaino. I passaggi pertinenti, la conversazione e il profilo sono inviati al provider scelto. Le chat vengono salvate nel vault dello zaino. Con Spiegamelo, una ricerca sull’argomento può essere inviata a Wikipedia.</p></details>
      </form>`;
    document.body.appendChild(panel);
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
      <div class="zchat-profile-actions"><a id="zchatKeyLink" target="_blank" rel="noopener noreferrer">Crea una API key</a><button type="button" class="tbtn" id="zchatModelsRefresh">Aggiorna elenco modelli</button></div>
      <p id="zchatKeyStatus" class="set-note"></p><form id="zchatKeyForm"><label class="zchat-field">Nuova API key<input id="zchatKeyInput" type="password" autocomplete="new-password" spellcheck="false" placeholder="Incolla una nuova chiave" maxlength="1000"></label><div class="zchat-profile-actions"><button type="submit" class="tbtn acc" id="zchatKeySave">Salva chiave</button><button type="button" class="tbtn" id="zchatKeyRemove">Rimuovi chiave</button></div></form>
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
      const selected = $('zchatProfile').value;
      options($('zchatProfile'), state.profiles, selected || state.activeId);
      if (!$('zchatProfile').value) $('zchatProfile').value = state.activeId;
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
      const id = $('zchatProfileEdit').value; applyProfiles(await call('activateProfile', id)); $('zchatProfile').value = state.activeId;
      editProfile(id); status('zchatProfileStatus', 'Profilo predefinito aggiornato.');
    }));
    function drawConfig() {
      const provider = state.settings.provider;
      const known = state.catalog.find(item => item.id === provider);
      const choices = state.catalog.map(item => ({ ...item, nome: item.nome + (hasKey(item.id) ? ' · chiave salvata' : '') }));
      ['zchatProvider','zchatSettingsProvider'].forEach(id => options($(id), choices, provider, 'Scegli provider'));
      const models = state.modelCache[provider] || [];
      ['zchatModel','zchatSettingsModel'].forEach(id => options($(id), models, state.settings.model, hasKey(provider) ? 'Scegli modello' : 'Inserisci una API key'));
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
    ['zchatProvider','zchatSettingsProvider'].forEach(id => $(id).addEventListener('change', () => selectProvider($(id).value)));
    ['zchatModel','zchatSettingsModel'].forEach(id => $(id).addEventListener('change', () => selectModel($(id).value)));
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
      const sources = context.sources || [];
      if (sources.length) {
        const details = el('details', undefined, 'zchat-sources'); details.appendChild(el('summary', 'Fonti consultate · ' + sources.length));
        const list = el('ul');
        sources.forEach(source => {
          const li = el('li'); const href = safeLink(source.url);
          if (href) { const a = el('a', sourceLabel(source)); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; li.appendChild(a); }
          else li.textContent = sourceLabel(source);
          list.appendChild(li);
        }); details.appendChild(list); parent.appendChild(details);
      }
      if (context.warnings?.length) parent.appendChild(el('p', context.warnings.join('\n'), 'zchat-hint zchat-context-warning'));
    }
    function drawMessages() {
      const box = $('zchatMessages'); box.replaceChildren();
      const messages = state.session?.messages || [];
      if (!messages.length && !state.pending) {
        const empty = el('div', undefined, 'zchat-empty');
        empty.appendChild(el('b', state.zaino ? 'Uno spazio per capire, insieme.' : 'Scegli uno zaino per iniziare.'));
        empty.appendChild(el('p', state.zaino ? 'Scegli il ruolo del tutor e scrivi una domanda sui tuoi documenti o appunti. Ogni conversazione rimane in questo zaino.' : 'Apri o crea uno zaino dalla barra in alto. Qui ritroverai le sue conversazioni.'));
        box.appendChild(empty);
      }
      function appendMessage(message) {
        if (!['user','assistant'].includes(message.role)) return;
        const article = el('article', undefined, 'zchat-message zchat-message-' + message.role);
        const label = message.role === 'user' ? 'Tu' : 'Tutor AI';
        article.appendChild(el('div', label, 'zchat-message-author'));
        article.appendChild(el('div', message.content || '', 'zchat-message-text'));
        if (message.status === 'error' || message.status === 'cancelled') article.appendChild(el('p', message.error || 'Risposta interrotta. Puoi inviare di nuovo il messaggio.', 'zchat-hint zchat-error'));
        drawSources(article, message.context); box.appendChild(article);
      }
      messages.forEach(appendMessage);
      if (state.pending) appendMessage({ role: 'user', content: state.pending });
      if (state.sending) box.appendChild(el('p', 'Il tutor sta preparando la risposta…', 'zchat-thinking'));
      box.scrollTop = box.scrollHeight;
    }
    function updateControls() {
      const busy = state.sending || state.loading;
      ['zchatSession','zchatNew','zchatRole','zchatProfile'].forEach(id => { $(id).disabled = !state.zaino || busy; });
      $('zchatDelete').disabled = !state.session || busy;
      ['zchatProvider','zchatModel','zchatSettingsProvider','zchatSettingsModel'].forEach(id => { $(id).disabled = state.sending || !state.ready; });
      $('zchatInput').disabled = !state.zaino || state.loading || !api;
      const validModel = (state.modelCache[state.settings.provider] || []).some(model => model.id === state.settings.model);
      $('zchatSend').disabled = !state.zaino || busy || !api || !state.ready || !hasKey(state.settings.provider) || !validModel || !$('zchatInput').value.trim();
      $('zchatStop').hidden = !state.sending;
      $('zchatRoleHelp').textContent = descriptions[$('zchatRole').value];
    }
    function drawSessions() {
      options($('zchatSession'), state.sessions.map(s => ({ ...s, title: s.title || 'Nuova conversazione' })), state.session?.id || '', 'Nuova conversazione');
      updateControls();
    }
    function restoreSession(session) {
      state.session = session;
      if (session) {
        $('zchatRole').value = session.role || 'socratico';
        $('zchatProfile').value = state.profiles.some(p => p.id === session.profileId) ? session.profileId : state.activeId;
      }
      drawSessions(); drawMessages();
    }
    async function loadSessions() {
      const zaino = state.zaino; const epoch = state.epoch; const readEpoch = ++state.readEpoch;
      if (!zaino) { state.sessions = []; restoreSession(null); return; }
      state.loading = true; updateControls();
      try {
        const result = await call('list', zaino);
        if (!current(epoch, zaino) || readEpoch !== state.readEpoch) return;
        state.sessions = result.sessions || []; const id = state.session?.id || state.sessions[0]?.id;
        const session = id ? (await call('read', zaino, id)).session : null;
        if (!current(epoch, zaino) || readEpoch !== state.readEpoch) return;
        restoreSession(session);
        status('zchatStatus', state.ready && !hasKey(state.settings.provider) ? 'Configura un provider e una API key nelle impostazioni AI.' : '');
      } catch (error) { if (current(epoch, zaino) && readEpoch === state.readEpoch) status('zchatStatus', errorText(error), true); }
      finally { if (current(epoch, zaino) && readEpoch === state.readEpoch) { state.loading = false; updateControls(); } }
    }
    async function syncZaino() {
      const zaino = currentZaino();
      if (zaino === state.zaino) return;
      if (state.zaino) state.drafts.set(state.zaino, $('zchatInput').value);
      const wasSending = state.sending; const epoch = ++state.epoch; ++state.readEpoch;
      state.zaino = zaino; state.session = null; state.sessions = []; state.pending = ''; state.sending = false; state.loading = false;
      $('zchatInput').value = state.drafts.get(zaino) || '';
      const title = window.MODO?.zaini?.find(z => z.id === zaino)?.title || zaino || 'Nessuno zaino aperto';
      $('zchatZaino').textContent = title; drawSessions(); drawMessages(); status('zchatStatus', '');
      if (wasSending) { state.loading = true; updateControls(); try { await call('cancel'); } catch (_) {} }
      if (!current(epoch, zaino)) return;
      await loadSessions();
    }
    $('zchatSession').addEventListener('change', async () => {
      const id = $('zchatSession').value; const zaino = state.zaino; const epoch = state.epoch; const readEpoch = ++state.readEpoch;
      if (!id) { restoreSession(null); return; }
      state.loading = true; updateControls();
      try { const result = await call('read', zaino, id); if (current(epoch, zaino) && readEpoch === state.readEpoch) restoreSession(result.session); }
      catch (error) { if (current(epoch, zaino)) status('zchatStatus', errorText(error), true); }
      finally { if (current(epoch, zaino) && readEpoch === state.readEpoch) { state.loading = false; updateControls(); } }
    });
    $('zchatNew').addEventListener('click', async () => {
      const zaino = state.zaino; const epoch = state.epoch; state.loading = true; updateControls();
      try {
        const result = await call('create', zaino, { role: $('zchatRole').value, profileId: $('zchatProfile').value });
        if (!current(epoch, zaino)) return;
        state.sessions.unshift(result.session); restoreSession(result.session); status('zchatStatus', 'Nuova conversazione salvata nello zaino.');
      } catch (error) { if (current(epoch, zaino)) status('zchatStatus', errorText(error), true); }
      finally { if (current(epoch, zaino)) { state.loading = false; updateControls(); $('zchatInput').focus(); } }
    });
    $('zchatDelete').addEventListener('click', async () => {
      if (!state.session || !window.confirm('Eliminare questa conversazione dal vault dello zaino?')) return;
      const zaino = state.zaino; const epoch = state.epoch; state.loading = true; updateControls();
      try { await call('remove', zaino, state.session.id); if (!current(epoch, zaino)) return; state.session = null; await loadSessions(); }
      catch (error) { if (current(epoch, zaino)) status('zchatStatus', errorText(error), true); }
      finally { if (current(epoch, zaino)) { state.loading = false; updateControls(); } }
    });
    $('zchatRole').addEventListener('change', updateControls);
    $('zchatInput').addEventListener('input', updateControls);
    $('zchatInput').addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!$('zchatSend').disabled) $('zchatForm').requestSubmit(); }
    });
    $('zchatForm').addEventListener('submit', async event => {
      event.preventDefault(); if (state.sending || state.loading) return;
      if (state.zaino !== currentZaino()) { await syncZaino(); return; }
      updateControls(); if ($('zchatSend').disabled) return;
      const zaino = state.zaino; const epoch = ++state.epoch;
      const request = { text: $('zchatInput').value.trim(), role: $('zchatRole').value, profileId: $('zchatProfile').value, provider: state.settings.provider, model: state.settings.model };
      try {
        if (typeof window.noteFlush === 'function') window.noteFlush();
        if (window.NOTES?.dirty) throw new Error('Salva l’appunto aperto prima di inviare il messaggio: il tutor deve leggerne la versione aggiornata.');
        state.sending = true; state.pending = request.text; $('zchatInput').value = ''; status('zchatStatus', 'Aggiorno il contesto dello zaino e preparo la risposta…'); updateControls(); drawMessages();
        if (!state.session) {
          const created = await call('create', zaino, { role: request.role, profileId: request.profileId });
          if (!current(epoch, zaino)) return;
          state.session = created.session; state.sessions.unshift(created.session); drawSessions();
        }
        request.sessionId = state.session.id;
        const result = await api.send(zaino, request);
        if (!current(epoch, zaino)) return;
        state.pending = ''; if (result.session) state.session = result.session;
        if (result.ok === false || result.error) throw new Error(result.error || 'Il provider non ha completato la risposta.');
        state.sessions = state.sessions.filter(s => s.id !== state.session.id); state.sessions.unshift(state.session);
        status('zchatStatus', 'Conversazione salvata nel vault dello zaino.');
      } catch (error) {
        if (current(epoch, zaino)) {
          status('zchatStatus', errorText(error), true);
          if (!$('zchatInput').value) $('zchatInput').value = request.text;
        }
      } finally {
        if (current(epoch, zaino)) { state.sending = false; state.pending = ''; drawSessions(); drawMessages(); updateControls(); $('zchatInput').focus(); }
      }
    });
    $('zchatStop').addEventListener('click', async () => {
      const epoch = state.epoch; status('zchatStatus', 'Interruzione della risposta…'); $('zchatStop').disabled = true;
      try { await call('cancel'); } catch (error) { if (epoch === state.epoch) status('zchatStatus', errorText(error), true); }
      finally { $('zchatStop').disabled = false; }
    });
    function close() { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); (state.returnFocus?.isConnected ? state.returnFocus : toggle).focus(); }
    function open() {
      state.returnFocus = document.activeElement; panel.hidden = false; toggle.setAttribute('aria-expanded', 'true');
      syncZaino().then(() => { if (!panel.hidden) $('zchatInput').focus(); });
      if (!state.zaino) $('zchatHandle').focus();
    }
    toggle.addEventListener('click', () => panel.hidden ? open() : close());
    $('zchatClose').addEventListener('click', close);
    $('zchatSettings').addEventListener('click', () => { $('settingsBtn')?.click(); const tab = document.querySelector('.set-tab[data-tab="ai"]'); if (tab) tab.click(); });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden && panel.contains(document.activeElement) && document.documentElement.dataset.settings !== '1') { event.preventDefault(); event.stopPropagation(); close(); }
    }, true);
    const handle = $('zchatHandle'); let drag = null;
    function move(x, y) {
      const rect = panel.getBoundingClientRect();
      panel.style.left = Math.max(0, Math.min(x, window.innerWidth - rect.width)) + 'px';
      panel.style.top = Math.max(0, Math.min(y, window.innerHeight - Math.min(rect.height, window.innerHeight))) + 'px';
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
    }
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest('button')) return;
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
  return { init, safeLink, sourceLabel };
}));
