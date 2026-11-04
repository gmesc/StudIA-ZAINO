/* Esperimento isolato: dimostra sia capacità sia perdite, non la parità con APPUNTI.
 * Nessun accesso al vault, a Electron o alle dipendenze dell'app.
 * Eseguire dalla copia temporanea descritta in VERIFICA-TIPTAP-APPUNTI.md.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://zaino.invalid' });
for (const k of ['window', 'document', 'navigator', 'Node', 'HTMLElement', 'Element', 'MutationObserver', 'DOMParser', 'getComputedStyle']) {
  Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true });
}
const { Editor } = require('@tiptap/core');
const { Markdown } = require('@tiptap/markdown');
const { StarterKit } = require('@tiptap/starter-kit');
const { TableKit } = require('@tiptap/extension-table');
const { Image } = require('@tiptap/extension-image');
const { Highlight } = require('@tiptap/extension-highlight');
const { TextStyleKit } = require('@tiptap/extension-text-style');
const { Mathematics } = require('@tiptap/extension-mathematics');
function crea(configurato = false) {
  return new Editor({
    extensions: [
      configurato ? StarterKit.configure({ link: { protocols: ['pdf', 'video', 'cap', 'fig', 'ev', 'album', 'zaino-pdf'], openOnClick: false } }) : StarterKit,
      Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
      TableKit, Image, Highlight.configure({ multicolor: true }), TextStyleKit, Mathematics,
    ], content: '',
  });
}
const campioni = {
  base: '# Titolo\n\n**Forte**, *corsivo*, ~~barrato~~ e `codice`.\n\n- uno\n- due',
  callout: '> [!nota] Titolo\n> Corpo **forte**\n> [!attenzione] Secondo\n> Altro corpo',
  rimandi: '[PDF](pdf:03#p=7) [Video](video:01#t=160) [Fonte](https://example.org) [Capitolo](cap:01-fondamenti-c03)',
  evidenza: '[==la memoria==](ev:9f2c1a4b7e01)',
  wiki: 'Vedi [[02-comorbidita]] e [[02-comorbidita|Titolo]].',
  immagine: '![Sole e Luna|93%](album:abcdef123456)',
  sottolineato: 'Un <u>testo sottolineato</u>.',
  colore: 'Un <span style="color:#ff0000">testo rosso</span>.',
  highlight: '<mark data-color="#ff0000" style="background-color:#ff0000">rosso</mark>',
  acapo: 'Prima\nSeconda',
  formula: 'Vale $x^2$ e\n\n$$\nE=mc^2\n$$',
  tabella: '| A | B |\n| --- | --- |\n| uno | due |',
  nota: 'Frase[^1].\n\n[^1]: Nota con **grassetto**.',
  html: 'Prima <!-- commento --> dopo.',
  // Il frontmatter deve restare fuori dall'editor: questo è un controllo negativo.
  frontmatter: '---\ntitolo: Prova\nlezione: esempio\n---\n\nCorpo',
};
for (let n = 2; n <= 7; n++) campioni['a_capo_' + n] = 'Uno' + '\n'.repeat(n) + 'Due';
const esiti = {};
const controlli = [];
const ed = crea();
function verifica(nome, condizione) {
  assert.ok(condizione, nome);
  controlli.push(nome);
}
function nodi(json, tipo) {
  return [json, ...(json.content || []).flatMap(n => nodi(n, tipo))].filter(n => n.type === tipo);
}
function contieneTipo(json, tipo) { return nodi(json, tipo).length > 0; }
function contieneMark(json, tipo) {
  return nodi(json, 'text').some(n => n.marks?.some(m => m.type === tipo));
}
try {
  for (const [nome, ingresso] of Object.entries(campioni)) {
    ed.commands.setContent(ingresso, { contentType: 'markdown', emitUpdate: false });
    esiti[nome] = { ingresso, json: ed.getJSON(), html: ed.getHTML(), uscita: ed.getMarkdown() };
  }
  verifica('titolo, grassetto, corsivo, codice ed elenco riconosciuti',
    contieneTipo(esiti.base.json, 'heading') && contieneTipo(esiti.base.json, 'bulletList') &&
    ['bold', 'italic', 'strike', 'code'].every(t => contieneMark(esiti.base.json, t)));
  verifica('il callout non è riconosciuto come tale', contieneTipo(esiti.callout.json, 'blockquote') && !contieneTipo(esiti.callout.json, 'callout'));
  verifica('i due callout contigui confluiscono in una citazione', nodi(esiti.callout.json, 'blockquote').length === 1);
  verifica('il serializer cambia il marcatore callout', !esiti.callout.uscita.includes('> [!nota]'));
  verifica('i link interni conservano href nel JSON ma non nella resa standard', esiti.rimandi.uscita.includes('pdf:03#p=7') && esiti.rimandi.html.includes('href=""'));
  verifica('il rimando evidenza conserva ID e sintassi ma non il routing', esiti.evidenza.uscita === campioni.evidenza && esiti.evidenza.html.includes('href=""'));
  verifica('il wikilink viene riscritto con escape', esiti.wiki.uscita !== campioni.wiki && esiti.wiki.uscita.includes('\\['));
  verifica('album conserva src e didascalia ma non risolve immagine e percentuale',
    esiti.immagine.json.content[0].attrs.src === 'album:abcdef123456' && esiti.immagine.json.content[0].attrs.width === null);
  verifica('sottolineato HTML conservato', esiti.sottolineato.uscita === campioni.sottolineato);
  verifica('colore visibile in HTML ma perso nel Markdown', esiti.colore.html.includes('rgb(255, 0, 0)') && !esiti.colore.uscita.includes('span'));
  verifica('colore highlight perso nel Markdown', esiti.highlight.html.includes('data-color="#ff0000"') && esiti.highlight.uscita === '==rosso==');
  verifica('a capo singolo riconosciuto con breaks:true', contieneTipo(esiti.acapo.json, 'hardBreak'));
  verifica('tre newline diventano due', esiti.a_capo_3.uscita === 'Uno\n\nDue');
  verifica('cinque newline diventano quattro', esiti.a_capo_5.uscita === 'Uno\n\n\n\nDue');
  verifica('formule inline e blocco riconosciute', contieneTipo(esiti.formula.json, 'inlineMath') && contieneTipo(esiti.formula.json, 'blockMath'));
  verifica('tabella semplice riconosciuta', contieneTipo(esiti.tabella.json, 'table'));
  verifica('note a piè pagina non interpretate e riscritte', esiti.nota.uscita.includes('\\[^1\\]'));
  verifica('commento HTML eliminato', !esiti.html.uscita.includes('commento'));
  verifica('frontmatter reinterpretato: non va passato al parser del corpo', esiti.frontmatter.uscita !== campioni.frontmatter);
} finally { ed.destroy(); }

const a = crea(true), b = crea(true);
const comandi = {};
try {
  a.commands.setContent(campioni.rimandi, { contentType: 'markdown', emitUpdate: false });
  comandi.linkConfigurati = a.getHTML();
  verifica('configurare i protocolli conserva href nella resa', comandi.linkConfigurati.includes('href="pdf:03#p=7"') && comandi.linkConfigurati.includes('href="video:01#t=160"'));
  // Non basta abilitare il protocollo: l'apertura negli split resta compito dell'app.
  let aggiornamenti = 0;
  a.on('update', () => aggiornamenti++);
  a.commands.setContent('Uno', { contentType: 'markdown', emitUpdate: false });
  b.commands.setContent('Altro', { contentType: 'markdown', emitUpdate: false });
  verifica('caricamento silenzioso disponibile per autosave', aggiornamenti === 0);
  comandi.caricamentoInCronologia = b.can().undo();
  verifica('emitUpdate:false non azzera la cronologia del caricamento', comandi.caricamentoInCronologia);
  a.commands.setTextSelection({ from: 1, to: 4 });
  verifica('comando grassetto utilizzabile dalla toolbar esterna', a.commands.toggleBold() && a.getMarkdown() === '**Uno**');
  verifica('modifica notifica update', aggiornamenti === 1);
  verifica('undo disponibile', a.commands.undo() && a.getMarkdown() === 'Uno');
  verifica('redo disponibile', a.commands.redo() && a.getMarkdown() === '**Uno**');
  verifica('seconda istanza conserva il contenuto dopo undo e redo della prima', b.getMarkdown() === 'Altro');
  b.commands.setTextSelection({ from: 1, to: 6 });
  b.commands.toggleItalic();
  verifica('modifica della seconda non cambia la prima', b.getMarkdown() === '*Altro*' && a.getMarkdown() === '**Uno**');
  comandi.aggiornamenti = aggiornamenti;
} finally { a.destroy(); b.destroy(); dom.window.close(); }

const risultato = {
  data: '2026-11-04', tiptap: JSON.parse(fs.readFileSync(path.resolve(path.dirname(require.resolve('@tiptap/core')), '../package.json'), 'utf8')).version,
  ambiente: { node: process.version, jsdom: require('jsdom/package.json').version },
  ambito: 'Campioni sintetici e API in JSDOM. Nessuna prova UI Electron o parità completa.',
  campioni: Object.keys(esiti).length, controlli: controlli.length, controlliSuperati: controlli,
  paritaAppunti: false, comandi, esiti,
};
const json = JSON.stringify(risultato, null, 2) + '\n';
if (process.argv[2]) fs.writeFileSync(process.argv[2], json); else process.stdout.write(json);
process.stderr.write(`${risultato.campioni} campioni, ${controlli.length} controlli della diagnosi superati; parità APPUNTI non raggiunta.\n`);
