'use strict';
const assert = require('node:assert/strict');
const { safeLink, sourceLabel } = require('../App/assets/chat/ui');

// I riferimenti ricevuti da un modello o da un file non aprono URL eseguibili.
for (const url of ['javascript:alert(1)', 'data:text/html,<script>1</script>', 'file:///etc/passwd', 'http://example.com', '//example.com', 'https://user:password@example.com', '', null]) {
  assert.equal(safeLink(url), '', 'URL non ammesso: ' + url);
}
assert.equal(safeLink('https://it.wikipedia.org/wiki/Acqua'), 'https://it.wikipedia.org/wiki/Acqua');
assert.equal(safeLink('https://platform.openai.com/api-keys'), 'https://platform.openai.com/api-keys');
assert.equal(sourceLabel({file: 'Biologia.pdf', page: 3, citation: '[F1]'}), '[F1] · Biologia.pdf · pagina 3');
assert.equal(sourceLabel({file: 'Biologia.pdf', page: 3, citation: '[Biologia.pdf, p. 3]'}), '[Biologia.pdf, p. 3]');
assert.equal(sourceLabel({}), 'Fonte');
console.log('chat-ui: URL delle fonti e citazioni verificati');
