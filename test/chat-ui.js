'use strict';
const assert = require('node:assert/strict');
const { safeLink, citedSources, sourceLabel, datedTitle, speechText, notesSaved, copyFormatting } = require('../App/assets/chat/ui');

// I riferimenti ricevuti da un modello o da un file non aprono URL eseguibili.
for (const url of ['javascript:alert(1)', 'data:text/html,<script>1</script>', 'file:///etc/passwd', 'http://example.com', '//example.com', 'https://user:password@example.com', '', null]) {
  assert.equal(safeLink(url), '', 'URL non ammesso: ' + url);
}
assert.equal(safeLink('https://it.wikipedia.org/wiki/Acqua'), 'https://it.wikipedia.org/wiki/Acqua');
assert.equal(safeLink('https://platform.openai.com/api-keys'), 'https://platform.openai.com/api-keys');
assert.equal(sourceLabel({file: 'Biologia.pdf', page: 3, citation: '[F1]'}), '[F1] · Biologia.pdf · pagina 3');
assert.equal(sourceLabel({file: 'Biologia.pdf', page: 3, citation: '[Biologia.pdf, p. 3]'}), '[Biologia.pdf, p. 3]');
assert.equal(sourceLabel({}), 'Fonte');
// Il riquadro «Fonti» elenca solo i file e le pagine che la risposta nomina.
const inviate = [
  {file: 'MATERIALI/Biologia.pdf', page: 3, citation: '[MATERIALI/Biologia.pdf, p. 3]'},
  {file: 'MATERIALI/Biologia.pdf', page: 30, citation: '[MATERIALI/Biologia.pdf, p. 30]'},
  {file: 'APPUNTI/cellula.md', citation: '[APPUNTI/cellula.md]'},
  {file: 'Wikipedia: Mitosi', citation: '[Wikipedia: Mitosi]', url: 'https://it.wikipedia.org/wiki/Mitosi'}];
const citate = (testo) => citedSources(testo, inviate).map(s => s.citation);
assert.deepEqual(citate('Vedi [MATERIALI/Biologia.pdf, p. 3].'), ['[MATERIALI/Biologia.pdf, p. 3]']);
assert.deepEqual(citate('Come dice Biologia.pdf (pag. 30) e cellula.md.'), ['[MATERIALI/Biologia.pdf, p. 30]', '[APPUNTI/cellula.md]']);
assert.deepEqual(citate('Fonte: https://it.wikipedia.org/wiki/Mitosi'), ['[Wikipedia: Mitosi]']);
assert.deepEqual(citate('Una risposta senza riferimenti a Biologia.'), []);
assert.deepEqual(citedSources('qualcosa', undefined), []);
// Gemini può ripetere l’etichetta completa al posto dell’alias: è sempre la
// pagina ricevuta dal backend, anche quando il modello la mette fra backtick.
const pagineRag = [1, 2].map(page => ({sourceId:'fonte-energia', revision:'versione',
  file:'MATERIALI/PDF/01 Energia nelle cellule.pdf', page, citation:'[S'+page+']',
  label:'[MATERIALI/PDF/01 Energia nelle cellule.pdf, p. '+page+']'}));
assert.deepEqual(citedSources('L’ATP trasferisce energia `[MATERIALI/PDF/01 Energia nelle cellule.pdf, p. 1]`. I mitocondri partecipano alla respirazione `[MATERIALI/PDF/01 Energia nelle cellule.pdf, p. 2]`.', pagineRag).map(s=>s.citation), ['[S1]','[S2]']);
const citazioni = require('../App/assets/chat/citazioni');
assert.equal(citazioni.normalizza('ATP `'+pagineRag[0].label+'` e [S2].',pagineRag),'ATP [S1] e [S2].');
assert.equal(citazioni.numerata('Prima [S2], poi [S1], ancora [S2].',pagineRag),'Prima ¹, poi ², ancora ¹.');
assert.deepEqual(citedSources('Pagina sbagliata [MATERIALI/PDF/01 Energia nelle cellule.pdf, p. 10], alias inventato [S10] e nome in prosa Energia nelle cellule.pdf.',pagineRag),[]);
assert.equal(citazioni.normalizza('[S1] [S10]',pagineRag),'[S1] [S10]');
assert.equal(citazioni.numerata('[S1] [S3]',[...pagineRag,{...pagineRag[0],citation:'[S3]'}]),'¹ ¹','due passaggi della stessa pagina condividono la nota');
// Il nome iniziale resta datato anche quando la prima domanda contiene dati privati.
const quando = new Date(2026, 8, 6, 16, 7);
assert.equal(datedTitle(quando), 'Chat del 06/09/2026, 16:07');
assert.match(datedTitle('non è una data'), /^Chat del /);
// Copia e voce leggono il solo testo pubblico, senza ragionamento o metadati.
assert.equal(speechText({role: 'assistant', content: '  La risposta.  ', reasoning: 'segreto', reasoning_content: 'interno'}), 'La risposta.');
assert.equal(speechText({role: 'user', content: 'una domanda'}), '');
assert.equal(speechText(null), '');
// Un salvataggio fallito del secondo editor blocca l’invio anche se il primo è pulito.
assert.equal(notesSaved({dirty:false}, {dirty:false}, true), true);
assert.equal(notesSaved(undefined, undefined, undefined), true);
assert.equal(notesSaved({dirty:true}, {dirty:false}, true), false);
assert.equal(notesSaved({dirty:false}, {dirty:true}, true), false);
assert.equal(notesSaved({dirty:false}, {dirty:false}, false), false);

// Si ricopia solo la struttura formattata: neppure HTML ostile passato dal parser
// può inserire attributi, link attivi, richieste di immagini o eventi nel documento.
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const parser = require('../App/assets/lettura/capitolo').crea();
const doc = new DOMParser().parseFromString('<root/>', 'text/xml');
function formatted(html) {
  const source = new DOMParser().parseFromString('<root>' + html + '</root>', 'text/xml').documentElement;
  return new XMLSerializer().serializeToString(copyFormatting(source, doc));
}
assert.equal(formatted(parser.mdToHtml('La **fotosintesi**.\n\n- Prima\n- Dopo', true)), '<p>La <strong>fotosintesi</strong>.</p>\n<ul><li>Prima</li><li>Dopo</li></ul>');
assert.equal(formatted('<p onclick="evil()" id="settingsBtn">Sicuro <strong style="display:none">grassetto</strong><a href="javascript:evil()">testo</a><img src="https://evil.test/pixel" onerror="evil()"/><script>evil()</script><svg><script>evil()</script></svg></p>'), '<p>Sicuro <strong>grassetto</strong>testo</p>');
const escaped = formatted(parser.mdToHtml('<img src=x onerror=evil()> **ok**', true));
assert.ok(escaped.includes('&lt;img src=x onerror=evil()&gt;'));
assert.ok(escaped.includes('<strong>ok</strong>'));
assert.ok(!escaped.includes('<img'));
console.log('chat-ui: fonti, titoli, guardia appunti, lettura e markdown senza XSS verificati');
