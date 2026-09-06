/* La chat porta il vestito di StudIA, e lo porta nei due temi.
 *
 * Che cosa si promette qui (§ della skill `studia-app-layout`):
 *   · nessun angolo tondo, in nessuna superficie della chat — la prima
 *     stesura ne aveva undici, e la finestra sembrava un'app diversa
 *     incollata dentro StudIA;
 *   · due sole altezze: `--tb-h` per i comandi di barra, `--ctl-h` per i
 *     controlli. Mai una terza, nemmeno quella che decide il browser;
 *   · l'ombra esiste solo su ciò che galleggia (la finestra, il dialogo) e
 *     vale `--sh-3d`, così cambia con il tema invece di restare nera;
 *   · ogni `font-family` dichiarato tiene `--emoji-font` PRIMA del generico,
 *     o le emoji tornano quelle di sistema;
 *   · la testa della chat è la stessa `.tbar` di tutte le altre barre, con la
 *     grammatica del §5bis: che cosa guardi · il verbo · spazio · la coda.
 *
 * ⚠️ Si misura sull'app viva e negli stati DINAMICI (conversazione aperta,
 * dialogo del nome, le due schede di Impostazioni): un audit statico su questa
 * superficie dava zero anomalie mentre il campo della chiave stava a 38,2px.
 *
 *   npm run test:ui        (la lancia insieme a prova-chat-zaino.js)
 */
'use strict';
const c = require('./cdp');

let ko = 0;
function ok(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + nome); return; }
  ko++; console.log('  KO  ' + nome + '\n      atteso ' + a + '\n      avuto  ' + b);
}
async function aspetta(expr, diagnosi, ms) {
  const fine = Date.now() + (ms || 15000);
  while (Date.now() < fine) { if (await c.val(expr)) return; await c.pausa(120); }
  if (diagnosi) console.log('      stato al momento della scadenza: ' + JSON.stringify(await c.val(diagnosi)));
  throw new Error('Attesa scaduta: ' + expr);
}
/* Perché il bottone d'invio è spento: i predicati di `updateControls`, letti
   dal DOM e dal ponte, senza indovinare. */
const PERCHE_SPENTO = `(async()=>{
  const s = await window.vault.chat.settings();
  const m = document.getElementById('zchatSettingsModel');
  return {
    zaino: typeof zainoAttivo==='function' ? zainoAttivo() : null,
    provider: s && s.provider, modello: s && s.model,
    modelloScelto: m && m.value, modelliInElenco: m ? m.options.length : 0,
    tendineSpente: !!(m && m.disabled),
    testo: (document.getElementById('zchatInput')||{}).value ? 'c e' : 'vuoto',
    stato: (document.getElementById('zchatStatus')||{}).textContent
  };
})()`;
const testo = (id, v) => c.val(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()`);
const scegli = (id, v) => c.val(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('change',{bubbles:true}));return 1;})()`);

/* Il rilevatore, tutto dentro la pagina: torna una riga per ogni difformità,
   già in forma leggibile. ⚠️ Le famiglie ammesse sono TRE — 30 (`--tb-h`), 33
   (`--tbig-h`, solo la testata) e 40 (`--ctl-h`) — e si leggono dai token, non
   si scrivono qui: se un giorno `--tb-h` cambia, cambia anche la prova. */
const RILEVA = `((selettori) => {
  const d = getComputedStyle(document.documentElement);
  const num = n => parseFloat(d.getPropertyValue(n)) || 0;
  const famiglie = [num('--tb-h'), num('--tb-h') * (parseFloat(d.getPropertyValue('--tb-piu')) || 1.1), num('--ctl-h')];
  /* ⚠️ L'ombra --sh-3d non si confronta come testo: il token vale
     \"-5px 6px 12px rgba(...)\" e il motore restituisce
     \"rgba(...) -5px 6px 12px 0px\" — stesso valore, due scritture. Si fa
     calcolare al motore l'ombra giusta su una sonda, e si confrontano due
     valori calcolati.
     ⚠️ E questo commento NON porta apici inversi: dentro un template literal
     lo chiudono a metà, e la prova muore in SyntaxError (pagata qui). */
  const sonda = document.createElement('div');
  sonda.style.cssText = 'position:absolute;left:-9999px;box-shadow:var(--sh-3d)';
  document.body.appendChild(sonda);
  const sh3d = getComputedStyle(sonda).boxShadow;
  sonda.remove();
  /* Ciò che galleggia PUÒ avere l'ombra: è la sola eccezione, ed è chiusa. */
  const flottanti = '.zchat-window, .zchat-rename';
  const guasti = [];
  const nome = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
  document.querySelectorAll(selettori).forEach(el => {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    const s = getComputedStyle(el);
    if (s.borderTopLeftRadius !== '0px' || s.borderBottomRightRadius !== '0px')
      guasti.push('ANGOLO ' + nome(el) + ' ' + s.borderTopLeftRadius);
    const interattivo = ['button','input','select','textarea'].includes(el.tagName.toLowerCase());
    /* Una textarea cresce con quello che ci si scrive: quello che deve stare
       in famiglia è il MINIMO dichiarato. Se non è dichiarato si misura
       l'altezza vera — così una textarea senza "min-height" resta un rosso. */
    const alto = el.tagName.toLowerCase() === 'textarea' ? (parseFloat(s.minHeight) || r.height) : r.height;
    if (interattivo && !famiglie.some(f => Math.abs(alto - f) <= 1.2))
      guasti.push('ALTEZZA ' + nome(el) + ' ' + Math.round(alto * 10) / 10 + 'px');
    if (s.boxShadow !== 'none') {
      if (!el.matches(flottanti)) guasti.push('OMBRA A RIPOSO ' + nome(el));
      else if (s.boxShadow !== sh3d) guasti.push('OMBRA NON --sh-3d ' + nome(el) + ' ' + s.boxShadow);
    }
    /* L'emoji-font si controlla dove il font è DICHIARATO da noi: se il testo
       è ereditato dal body, il body ce l'ha già. */
    if (el.textContent.trim() && !el.children.length && !/OpenMoji|Noto Color Emoji|Apple Color Emoji/.test(s.fontFamily))
      guasti.push('STACK SENZA EMOJI ' + nome(el) + ' ' + s.fontFamily);
  });
  return guasti;
})`;
const rileva = sel => c.val(RILEVA + '(' + JSON.stringify(sel) + ')');

const SUPERFICI = {
  'finestra della chat': '#zchatWindow, #zchatWindow *',
  'bottone in testata': '#chatBtn',
  'dialogo del nome': '#zchatRenameDialog, #zchatRenameDialog *',
  'impostazioni · utente': '.set-pane[data-pane="utente"] .zchat-settings, .set-pane[data-pane="utente"] .zchat-settings *',
  'impostazioni · AI': '.set-pane[data-pane="ai"] .zchat-settings, .set-pane[data-pane="ai"] .zchat-settings *'
};

(async () => {
  await c.collega();
  await aspetta(`!!document.getElementById('chatBtn') && zainoAttivo()==='biologia'`);

  /* ⚠️ Questa prova gira dopo un'altra sulla stessa app: se la finestra della
     chat è rimasta aperta, copre il bottone delle impostazioni e il click
     finisce dentro di lei. Si parte sempre dallo stesso stato. */
  await c.val(`(()=>{const w=document.getElementById('zchatWindow'); if(w&&!w.hidden) document.getElementById('zchatClose').click(); return 1;})()`);
  await c.pausa(250);

  console.log('== Si configura il provider finto e si fa parlare la chat');
  await c.clicca('#settingsBtn'); await c.clicca('[data-tab="ai"]');
  await aspetta(`document.getElementById('zchatSettingsProvider').options.length>1`);
  /* ⚠️ Solo se serve. Risalvare la chiave che c'è già fa ricaricare l'elenco
     dei modelli, e in quella finestra l'invio resta spento: la prova falliva
     una corsa su sei dicendo «bottone disabilitato», che era vero e non era
     il difetto. */
  const gia = await c.val(`(async()=>{const s=await window.vault.chat.settings();return s && s.provider==='openai' && s.model==='modello-locale-di-prova';})()`);
  if (!gia) {
    await scegli('zchatSettingsProvider', 'openai');
    await testo('zchatKeyInput', 'chiave-finta-della-prova'); await c.clicca('#zchatKeySave');
    await aspetta(`document.getElementById('zchatSettingsModel').options.length>1`);
    await scegli('zchatSettingsModel', 'modello-locale-di-prova');
  }
  /* Si aspetta che la configurazione sia ASSESTATA prima di andare avanti:
     le tendine tornano vive quando il ponte ha finito di rileggere tutto. */
  await aspetta(`(()=>{const m=document.getElementById('zchatSettingsModel');return !m.disabled && m.value==='modello-locale-di-prova';})()`, PERCHE_SPENTO);
  await c.clicca('[data-tab="utente"]');
  await aspetta(`document.getElementById('zchatProfileEdit').options.length>0`);
  /* Le due schede si misurano da aperte, quindi si lasciano montate e si
     chiude il modale solo dopo. */
  const guastiUtente = {}, guastiAI = {};

  console.log('\n== I due temi, una superficie per volta');
  const temi = ['chiaro', 'scuro'];
  for (const tema of temi) {
    await c.val(`document.documentElement.dataset.theme=${JSON.stringify(tema)}`);
    await c.pausa(150);
    guastiUtente[tema] = await rileva(SUPERFICI['impostazioni · utente']);
    await c.clicca('[data-tab="ai"]'); await c.pausa(200);
    guastiAI[tema] = await rileva(SUPERFICI['impostazioni · AI']);
    await c.clicca('[data-tab="utente"]'); await c.pausa(150);
  }
  await c.clicca('#settingsClose'); await c.pausa(200);

  await c.clicca('#chatBtn');
  await aspetta(`!document.getElementById('zchatInput').disabled`);
  /* ⚠️ Non si conta «una risposta» ma «una in più»: questa prova gira dopo
     un'altra sulla stessa app, e la chat riapre la conversazione di prima con
     le sue risposte già dentro. Con un numero fisso il rosso arrivava a corse
     alterne — cioè diceva una cosa sullo stato ereditato, non sul vestito. */
  const prima = await c.val(`document.querySelectorAll('.zchat-message-assistant').length`);
  await testo('zchatInput', 'Che cosa è la fotosintesi?');
  await aspetta(`!document.getElementById('zchatSend').disabled`, PERCHE_SPENTO, 25000);
  await c.clicca('#zchatSend');
  await aspetta(`document.querySelectorAll('.zchat-message-assistant').length > ${prima}`);
  /* La risposta porta con sé markdown, fonti e i tre comandi: sono i pezzi che
     un audit senza conversazione non vede mai. */
  ok('l ultima risposta ha i suoi tre comandi', 3,
    await c.val(`[...document.querySelectorAll('.zchat-message-actions')].at(-1).querySelectorAll('.tbtn').length`));

  for (const tema of temi) {
    await c.val(`document.documentElement.dataset.theme=${JSON.stringify(tema)}`);
    await c.pausa(150);
    console.log('\n-- tema ' + tema);
    ok('finestra della chat · ' + tema, [], await rileva(SUPERFICI['finestra della chat']));
    ok('bottone in testata · ' + tema, [], await rileva(SUPERFICI['bottone in testata']));
    await c.val(`document.getElementById('zchatRenameDialog').showModal()`); await c.pausa(200);
    ok('dialogo del nome · ' + tema, [], await rileva(SUPERFICI['dialogo del nome']));
    await c.val(`document.getElementById('zchatRenameDialog').close()`);
    ok('impostazioni · utente · ' + tema, [], guastiUtente[tema]);
    ok('impostazioni · AI · ' + tema, [], guastiAI[tema]);
  }

  console.log('\n== La testa della chat è la stessa barra di tutte le altre');
  const barra = await c.val(`(()=>{
    const head = document.querySelector('#zchatHandle');
    const d = getComputedStyle(document.documentElement);
    const figli = [...head.children];
    const spazio = figli.findIndex(e => e.classList.contains('tbspazio'));
    return {
      classe: head.classList.contains('tbar'),
      spazioElastico: spazio >= 0,
      alta: Math.round(head.getBoundingClientRect().height),
      attesa: Math.round(parseFloat(d.getPropertyValue('--ctl-h')) - 1),
      barrette: head.querySelectorAll('.tbsep').length,
      /* La grammatica: chiudere viene DOPO lo spazio elastico, aprire prima. */
      codaDopoLoSpazio: ['zchatSettings','zchatCollapse','zchatClose'].every(id => figli.findIndex(e => e.id === id) > spazio),
      verboPrimaDelloSpazio: figli.findIndex(e => e.id === 'zchatNew') < spazio,
      ruoloInTesta: figli[0].contains(document.getElementById('zchatRole'))
    };
  })()`);
  ok('porta la classe .tbar', true, barra.classe);
  ok('ha lo spazio elastico', true, barra.spazioElastico);
  ok('alta come una barra dell app', barra.attesa, barra.alta);
  ok('una barretta sola, dove cambia il mestiere', 1, barra.barrette);
  ok('il ruolo apre la barra', true, barra.ruoloInTesta);
  ok('il verbo (+) sta prima dello spazio', true, barra.verboPrimaDelloSpazio);
  ok('la coda (⚙ − ×) sta dopo lo spazio', true, barra.codaDopoLoSpazio);

  console.log('\n== L errore si legge nei due temi (non è un rosso fisso)');
  const rossi = [];
  for (const tema of temi) {
    await c.val(`document.documentElement.dataset.theme=${JSON.stringify(tema)}`); await c.pausa(120);
    rossi.push(await c.val(`getComputedStyle(document.documentElement).getPropertyValue('--err-ink').trim()`));
  }
  ok('--err-ink cambia col tema', true, !!rossi[0] && !!rossi[1] && rossi[0] !== rossi[1]);

  /* Si rimette tutto com'era: tema chiaro e finestra chiusa. */
  await c.val(`document.documentElement.dataset.theme='chiaro'`);
  await c.val(`(()=>{const w=document.getElementById('zchatWindow'); if(w&&!w.hidden) document.getElementById('zchatClose').click(); return 1;})()`);
  await c.pausa(200);
  console.log('');
  if (ko) { console.log('✗ ' + ko + ' promesse rotte'); process.exit(1); }
  console.log('OK: la chat porta il vestito di StudIA — angoli vivi, due altezze, --sh-3d, emoji-font, e una testa che è una .tbar.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
