'use strict';
/* Le prove dei crediti e delle licenze.
 *
 * Non provano «il codice gira»: provano che la schermata dice la VERITÀ. Un
 * inventario di licenze fermo a ieri è una dichiarazione falsa, e la prova che
 * conta è proprio quella di freschezza: se qualcuno aggiunge una dipendenza e
 * non rigenera, `npm test` deve fallire con l'elenco di ciò che manca. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crediti = require('../lib/crediti');

const RADICE = path.join(__dirname, '..');
let fatte = 0;
function prova(nome, fn) { fn(); fatte++; console.log('  ✓ ' + nome); }

console.log('crediti e licenze');

const inventario = crediti.leggi();

prova('l\'inventario committato si legge ed è pieno', () => {
  assert.ok(!inventario.errore, 'errore di lettura: ' + inventario.errore);
  assert.ok(inventario.voci.length > 50, 'troppe poche voci: ' + inventario.voci.length);
  assert.ok(inventario.app && inventario.app.nome, 'manca la scheda dell\'app');
  assert.ok((inventario.obblighi || []).length >= 5, 'gli obblighi sono la parte legale: non possono mancare');
});

prova('ogni voce dichiara nome, categoria e licenza', () => {
  for (const v of inventario.voci) {
    assert.ok(v.nome, 'voce senza nome: ' + JSON.stringify(v).slice(0, 120));
    assert.ok(v.categoria, 'voce senza categoria: ' + v.nome);
    assert.ok(v.licenza, 'voce senza licenza: ' + v.nome);
  }
});

prova('ogni pacchetto npm ha il testo della licenza o un avviso che spiega perché no', () => {
  for (const v of inventario.voci.filter((x) => x.categoria === 'npm')) {
    assert.ok(v.testo || v.avviso, 'npm senza testo né avviso: ' + v.id);
    assert.ok(v.versione, 'npm senza versione: ' + v.id);
  }
});

prova('le voci senza testo di licenza sono solo quelle che non possono averlo', () => {
  // servizi remoti, pesi scaricati a parte, e il rimando all'elenco Chromium:
  // per tutto il resto un testo mancante è un buco di attribuzione
  const senza = inventario.voci.filter((v) => !v.testo);
  for (const v of senza) {
    const ammessa = v.categoria === 'servizio' || v.categoria === 'dati' || /Chromium/i.test(v.nome);
    assert.ok(ammessa, 'voce senza testo di licenza e senza motivo: ' + v.nome);
    assert.ok(v.url || v.avviso, 'senza testo servono almeno un rimando o un avviso: ' + v.nome);
  }
});

prova('i file di licenza citati dal file dichiarativo esistono davvero', () => {
  const extra = JSON.parse(fs.readFileSync(crediti.EXTRA, 'utf8'));
  for (const v of extra.voci) {
    if (!v.licenzaFile) continue;
    const p = path.join(crediti.LICENZE, v.licenzaFile);
    assert.ok(fs.existsSync(p), 'manca il testo ' + v.licenzaFile + ' (' + v.nome + ')');
    assert.ok(fs.readFileSync(p, 'utf8').trim().length > 200, 'testo di licenza sospettosamente corto: ' + v.licenzaFile);
  }
});

prova('gli obblighi che non si possono dimenticare ci sono tutti', () => {
  const tutto = JSON.stringify(inventario.obblighi);
  // «1F392» è l'icona dell'app: opera derivata da OpenMoji, quindi CC BY-SA anche lei
  for (const parola of ['OpenMoji', 'CC BY-SA', 'LGPL', 'Chromium', 'Apache-2.0', 'consulenza legale', '1F392']) {
    assert.ok(tutto.includes(parola), 'obbligo mancante o riscritto: ' + parola);
  }
});

prova('OpenMoji, ffmpeg e Chromium sono nominati con la loro licenza', () => {
  const per = (n) => inventario.voci.find((v) => v.nome.toLowerCase().includes(n));
  assert.match((per('openmoji') || {}).licenza || '', /CC BY-SA 4\.0/);
  assert.match((per('ffmpeg') || {}).licenza || '', /LGPL/);
  assert.ok(per('chromium'), 'Chromium non è dichiarato');
});

prova('l\'inventario è aggiornato rispetto ai pacchetti installati', () => {
  const installati = crediti.elencoNpm(RADICE).map((p) => p.nome + '@' + p.versione);
  const dentro = new Set(inventario.voci.filter((v) => v.categoria === 'npm').map((v) => v.id));
  const mancanti = installati.filter((id) => !dentro.has(id));
  const spariti = [...dentro].filter((id) => !installati.includes(id));
  assert.deepStrictEqual(
    { mancanti, spariti }, { mancanti: [], spariti: [] },
    'crediti.json è rimasto indietro: rigeneralo con «npm run crediti»'
  );
});

prova('il NOTICE esportabile contiene app, voci e testi', () => {
  const testo = crediti.notice(inventario);
  assert.ok(testo.includes(inventario.app.nome));
  assert.ok(testo.includes('OpenMoji'));
  assert.ok(testo.includes('Permission is hereby granted'), 'nel NOTICE manca il testo delle licenze MIT');
  assert.ok(testo.length > 100000, 'NOTICE troppo corto: ' + testo.length);
});

prova('l\'app spedisce l\'inventario e i testi delle licenze', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(RADICE, 'package.json'), 'utf8'));
  const files = pkg.build.files.join(' ');
  assert.ok(/App\/\*\*/.test(files), 'App/ non è nel pacchetto: le licenze non arriverebbero all\'utente');
  const extra = JSON.stringify(pkg.build.extraResources || []);
  assert.ok(extra.includes('LICENSES.chromium.html'), 'l\'elenco Chromium non viene spedito con l\'app');
  assert.strictEqual(pkg.scripts.crediti, 'node lib/crediti.js');
});

console.log('crediti: ' + fatte + ' prove passate');
