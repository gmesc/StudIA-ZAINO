/* Il mockup d'approvazione della chat, GENERATO dal codice vero.
 *
 * ⚠️ Non si disegna a mano: il CSS è il blocco `<style>` di `App/StudIA.html`
 * più `App/assets/chat/ui.css`, e il markup della testa, del dialogo e della
 * scheda AI si LEGGE da `App/assets/chat/ui.js`. Così un mockup approvato non
 * può divergere dall'app al primo ritocco — se cambia il codice, o cambia
 * anche il mockup, o la generazione fallisce dicendolo.
 *
 *   node docs/mockup-chat/genera.js && open docs/mockup-chat/index.html
 */
'use strict';
const fs = require('fs');
const path = require('path');
const RADICE = path.join(__dirname, '..', '..');

const html = fs.readFileSync(path.join(RADICE, 'App/StudIA.html'), 'utf8');
const i = html.indexOf('<style>'), j = html.indexOf('</style>', i);
if (i < 0 || j < 0) throw new Error('Il blocco <style> di StudIA.html non si trova più.');
const cssApp = html.slice(i + 7, j);
const cssChat = fs.readFileSync(path.join(RADICE, 'App/assets/chat/ui.css'), 'utf8');
const js = fs.readFileSync(path.join(RADICE, 'App/assets/chat/ui.js'), 'utf8');

/** Il markup vero, preso dal punto in cui l'app lo scrive. Se l'ancora non c'è
 *  più, si ferma: un mockup che indovina non serve ad approvare niente. */
function markup(ancora) {
  const da = js.indexOf(ancora);
  if (da < 0) throw new Error('Ancora sparita da ui.js: ' + ancora);
  const apre = js.indexOf('`', da), chiude = js.indexOf('`', apre + 1);
  if (apre < 0 || chiude < 0) throw new Error('Template literal non chiuso dopo: ' + ancora);
  return js.slice(apre + 1, chiude);
}
/** Il tema scuro dell'app, riversato su un contenitore.
 *  ⚠️ Funziona SOLO perché `html[data-theme="scuro"]` ridichiara token e basta
 *  (è l'invariante del design system). Se un giorno ci finisse dentro una
 *  regola di componente, questa funzione la vedrebbe e si ferma: meglio un
 *  mockup che non si genera di un mockup che mente sul tema scuro. */
function tokenScuri() {
  const ancora = 'html[data-theme="scuro"]{';
  const da = cssApp.indexOf(ancora);
  if (da < 0) throw new Error('Il blocco del tema scuro non si trova più.');
  const chiude = cssApp.indexOf('}', da + ancora.length);
  const corpo = cssApp.slice(da + ancora.length, chiude);
  const intruse = corpo.split(';').map(r => r.trim()).filter(r => r && !r.startsWith('--') && !r.startsWith('/*'));
  if (intruse.length) throw new Error('Nel tema scuro non ci sono solo token: ' + intruse.join(' | '));
  return corpo;
}

const testa = markup('panel.innerHTML =');
const rinomina = markup('renameDialog.innerHTML =');
const schedaAI = markup("preserveLegacy('ai',");

/* Una risposta finta, ma con tutto ciò che la chat sa mostrare: markdown,
   fonti, i tre comandi sotto la risposta. Serve a guardare i pezzi che
   l'audit sull'app viva non vede finché non c'è una conversazione. */
const conversazione = `
  <article class="zchat-message zchat-message-user" aria-label="Tu">
    <div class="zchat-message-text">Che cos'è la fotosintesi? Spiegamela con un esempio 🌱</div>
  </article>
  <article class="zchat-message zchat-message-assistant" aria-label="Tutor AI">
    <div class="zchat-message-text zchat-markdown">
      <p>La <strong>fotosintesi</strong> è il modo in cui una pianta si costruisce il cibo con la luce.</p>
      <ul><li>entrano acqua, anidride carbonica e luce;</li><li>esce zucchero, e ossigeno come scarto.</li></ul>
      <pre>6 CO2 + 6 H2O + luce  →  C6H12O6 + 6 O2</pre>
      <blockquote>Una foglia al sole è una piccola officina che lavora solo di giorno.</blockquote>
    </div>
    <details class="zchat-sources"><summary>3 fonti</summary>
      <ul><li>01 Botanica.pdf · pagina 12</li><li>Fotosintesi.md</li><li>Wikipedia · Fotosintesi clorofilliana</li></ul></details>
    <div class="zchat-message-actions">
      <button class="tbtn zchat-copy" type="button" title="Copia risposta">⧉</button>
      <button class="tbtn zchat-speak" type="button" title="Leggi la risposta">▷</button>
      <button class="tbtn zchat-branch" type="button" title="Nuova conversazione da qui">↗︎</button>
    </div>
  </article>
  <article class="zchat-message zchat-message-assistant" aria-label="Tutor AI">
    <div class="zchat-message-text">Risposta interrotta.</div>
    <p class="zchat-hint zchat-error">Chiave non valida per il provider scelto.</p>
  </article>`;

const cronologia = `
  <div class="zchat-empty"><b>Da dove riprendiamo?</b><p>Scrivi un messaggio per iniziare una nuova chat.</p>
    <ul class="zchat-history" aria-label="Conversazioni precedenti">
      <li><button class="zchat-history-item" type="button"><span class="zchat-history-title">Ripasso di botanica</span><span class="zchat-history-date">4 set 2026</span></button><button class="tbtn zchat-history-delete" type="button" title="Elimina conversazione">×</button></li>
      <li><button class="zchat-history-item" type="button"><span class="zchat-history-title">Chat del 02/09/2026, 18:40</span><span class="zchat-history-date">2 set 2026</span></button><button class="tbtn zchat-history-delete" type="button" title="Elimina conversazione">×</button></li>
    </ul></div>`;

/* La finestra si mostra ferma nel flusso, non `position:fixed`: un mockup
   serve a confrontare due temi affiancati, non a rifare il trascinamento. */
const cssMockup = `
  body{ margin:0; padding:0; background:#8a8f96; }
  .mk-due{ display:grid; grid-template-columns:1fr 1fr; align-items:start; gap:2px; }
  .mk-tema{ background:var(--bg); color:var(--ink); min-width:0; }
  .mk-tema>h2{ margin:0; padding:.6rem .9rem; font-size:10px; text-transform:uppercase;
    letter-spacing:.2em; font-weight:700; color:var(--muted); border-bottom:1px solid var(--line); }
  .mk-pagina{ padding:18px; display:flex; flex-direction:column; gap:22px; }
  .mk-tit{ font-size:10px; text-transform:uppercase; letter-spacing:.18em; font-weight:700; color:var(--muted); }
  .mk-finestra{ position:static!important; width:auto!important; height:auto!important;
    max-width:none!important; max-height:none!important; min-height:0!important; resize:none!important; }
  .mk-finestra .zchat-messages{ max-height:none; overflow:visible; }
  .mk-dialogo{ position:static!important; display:block; margin:0; }
  .mk-imp{ background:var(--panel); border:1px solid var(--line); padding:1rem 1.2rem; }`;

/** Le superfici della chat, una sotto l'altra. Si genera due volte: una per
 *  tema, dentro la stessa pagina, così il confronto è a colpo d'occhio. */
function colonna(nome, classe) {
  return `<div class="mk-tema ${classe}"><h2>Tema ${nome}</h2><div class="mk-pagina">

  <p class="mk-tit">La testata dell'app: il bottone della chat, spento e acceso</p>
  <header class="topbar tbar-lg" style="position:static">
    <button class="brand" type="button"><span>StudIA - ZAINO</span></button>
    <div class="controls">
      <span class="tendina"><span class="tlab">Zaino</span><select><option>Biologia</option></select></span>
      <i class="tbsep" aria-hidden="true"></i>
      <button class="iconbtn" type="button" aria-controls="zchatWindow" aria-expanded="false">Chat AI</button>
      <button class="iconbtn" type="button" aria-controls="zchatWindow" aria-expanded="true">Chat AI</button>
      <button class="iconbtn" type="button">&#9881;</button>
    </div>
  </header>

  <p class="mk-tit">La finestra, con una conversazione</p>
  <section class="zchat-window mk-finestra">${testa}</section>

  <p class="mk-tit">La finestra vuota: le conversazioni di prima</p>
  <section class="zchat-window mk-finestra">${testa}</section>

  <p class="mk-tit">Il dialogo del nome</p>
  <div class="zchat-rename mk-dialogo">${rinomina}</div>

  <p class="mk-tit">Impostazioni &rarr; AI (scala dei controlli, 40px)</p>
  <div class="mk-imp set-body tbar-ctl"><div class="zchat-settings">${schedaAI}</div></div>

</div></div>`;
}

function pagina() {
  return `<!doctype html><html lang="it" data-theme="chiaro"><head><meta charset="utf-8">
<title>Mockup chat nei due temi &middot; StudIA - ZAINO</title>
<style>${cssApp}</style><style>${cssChat}</style>
<style>${cssMockup}
  /* Il tema scuro, riversato dai token dell'app su una colonna sola. */
  .mk-scuro{ ${tokenScuri()} }
</style></head>
<body><div class="mk-due">${colonna('chiaro', 'mk-chiaro')}${colonna('scuro', 'mk-scuro')}</div>
<script>
  // I riquadri della finestra si riempiono qui, per non ripetere la testa.
  document.querySelectorAll('.mk-tema').forEach(function (col) {
    var f = col.querySelectorAll('.zchat-window');
    f[0].querySelector('.zchat-messages').innerHTML = ${JSON.stringify(conversazione)};
    f[1].querySelector('.zchat-messages').innerHTML = ${JSON.stringify(cronologia)};
  });
<\/script></body></html>`;
}

fs.writeFileSync(path.join(__dirname, 'index.html'), pagina());
console.log('mockup generato: docs/mockup-chat/index.html');
console.log('  CSS dell app  ' + cssApp.split('\n').length + ' righe');
console.log('  CSS della chat ' + cssChat.split('\n').length + ' righe');
console.log('  markup letto da ui.js: testa, dialogo, scheda AI');
