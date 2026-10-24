'use strict';
const assert = require('node:assert/strict');
const native = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const P = require('../lib/permessi-disco');
const fs = P.fs;
const rifiutato = /Accesso al disco negato|Collegamento|hard link|simbolico/i;

(async () => {
  const root = native.mkdtempSync(path.join(os.tmpdir(), 'zaino-permessi-'));
  const dentro = path.join(root, 'vault'), fuori = path.join(root, 'fuori');
  native.mkdirSync(dentro); native.mkdirSync(fuori);
  const letto = path.join(dentro, 'letto.txt'), scritto = path.join(dentro, 'scritto.txt');
  const esterno = path.join(fuori, 'prezioso.txt');
  native.writeFileSync(letto, 'contenuto'); native.writeFileSync(esterno, 'originale');
  try {
    P.esegui({ lettura: [dentro], scrittura: [dentro] }, () => {
      assert.throws(() => fs.writeFileSync(esterno, 'alterato'), rifiutato);
      assert.equal(fs.readFileSync(letto, 'utf8'), 'contenuto');
      fs.writeFileSync(scritto, 'consentito');
      assert.throws(() => fs.readFileSync(esterno), rifiutato);
      assert.throws(() => fs.existsSync(esterno), rifiutato);
      assert.throws(() => fs.copyFileSync(letto, esterno), rifiutato);
      assert.throws(() => fs.renameSync(letto, esterno), rifiutato);
      assert.throws(() => fs.chmodSync(esterno, 0o600), rifiutato);
      assert.throws(() => fs.linkSync(letto, path.join(dentro, 'alias')), rifiutato);
    });
    P.esegui({ lettura: [dentro], scrittura: [] }, () => {
      assert.equal(fs.statSync(letto).size, 9);
      assert.throws(() => fs.unlinkSync(letto), rifiutato);
      assert.throws(() => fs.openSync(letto, 'r+'), rifiutato);
    });
    P.esegui({ lettura: [], scrittura: [scritto] }, () => {
      fs.writeFileSync(scritto, 'solo scrittura');
      assert.throws(() => fs.readFileSync(scritto), rifiutato);
      assert.throws(() => fs.openSync(scritto, 'r+'), rifiutato);
      assert.throws(() => fs.statSync(scritto), rifiutato);
      assert.throws(() => fs.mkdtempSync(scritto), rifiutato);
    });
    P.esegui({ lettura: [], scrittura: [path.join(dentro, 'nuova', 'annidata')] }, () => {
      assert.throws(() => fs.mkdirSync(path.join(dentro, 'nuova', 'annidata'), { recursive: true }), rifiutato);
    });
    P.esegui({ metadati: [root], lettura: [dentro], scrittura: [] }, () => {
      assert.equal(fs.statSync(esterno).size, 9);
      assert.equal(fs.existsSync(esterno), true);
      assert.throws(() => fs.readdirSync(fuori), rifiutato);
      assert.throws(() => fs.readFileSync(esterno), rifiutato);
      assert.throws(() => fs.writeFileSync(esterno, 'alterato'), rifiutato);
    });
    assert.equal(P.corrente(), undefined);
    P.esegui({ lettura: [dentro], scrittura: [scritto] }, () => {
      assert.equal(P.verifica(scritto, 'scrittura'), native.realpathSync(scritto));
      assert.throws(() => P.verifica(letto, 'scrittura'), rifiutato);
      const prima = P.corrente(), temp = path.join(dentro, '.scritto.txt.tmp-prova');
      P.esegui({ ...prima, scrittura: prima.scrittura.concat(temp) }, () => {
        fs.writeFileSync(temp, 'atomico', { flag: 'wx', mode: 0o600 });
        fs.renameSync(temp, scritto);
      });
      assert.throws(() => fs.writeFileSync(temp, 'fuori ambito'), rifiutato);
    });
    native.symlinkSync(esterno, path.join(dentro, 'foglia.txt'));
    native.symlinkSync(fuori, path.join(dentro, 'cartella'), 'dir');
    native.linkSync(esterno, path.join(dentro, 'duro.txt'));
    P.esegui({ lettura: [dentro], scrittura: [dentro] }, () => {
      for (const p of ['foglia.txt', 'cartella/prezioso.txt', 'duro.txt']) {
        assert.throws(() => fs.readFileSync(path.join(dentro, p)), rifiutato);
        assert.throws(() => fs.writeFileSync(path.join(dentro, p), 'alterato'), rifiutato);
      }
      assert.throws(() => fs.rmSync(dentro, { recursive: true }), rifiutato);
      assert.throws(() => P.percorso(dentro, path.join(dentro, '../fuori/prezioso.txt')), rifiutato);
    });
    native.unlinkSync(path.join(dentro, 'duro.txt'));
    native.symlinkSync(dentro, path.join(root, 'radice-alias'), 'dir');
    P.esegui({ lettura: [path.join(root, 'radice-alias')], scrittura: [] }, () => {
      assert.equal(fs.readFileSync(letto, 'utf8'), 'contenuto');
      assert.equal(fs.readFileSync(path.join(root, 'radice-alias', 'letto.txt'), 'utf8'), 'contenuto');
    });
    const fd = fs.openSync(letto, 'r');
    P.esegui({ lettura: [], scrittura: [] }, () => assert.throws(() => fs.readFileSync(fd), rifiutato));
    P.esegui({ lettura: [dentro], scrittura: [] }, () => assert.equal(fs.readFileSync(fd, 'utf8'), 'contenuto'));
    fs.closeSync(fd);
    await P.esegui({ lettura: [dentro], scrittura: [] }, async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      assert.equal(await fs.promises.readFile(letto, 'utf8'), 'contenuto');
      await assert.rejects(fs.promises.writeFile(letto, 'alterato'), rifiutato);
      await assert.rejects(fs.promises.readFile(esterno), rifiutato);
      const handle = await fs.promises.open(letto, 'r');
      try {
        assert.equal(await handle.readFile('utf8'), 'contenuto');
        await assert.rejects(handle.writeFile('alterato'), rifiutato);
      } finally { await handle.close(); }
      let testo = '';
      for await (const chunk of fs.createReadStream(letto)) testo += chunk;
      assert.equal(testo, 'contenuto');
      assert.throws(() => fs.createReadStream(esterno), rifiutato);
      assert.throws(() => fs.createWriteStream(letto), rifiutato);
    });
    await Promise.all([
      P.esegui({ lettura: [dentro], scrittura: [] }, async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        assert.throws(() => fs.readFileSync(esterno), rifiutato);
      }),
      P.esegui({ lettura: [fuori], scrittura: [] }, async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        assert.equal(fs.readFileSync(esterno, 'utf8'), 'originale');
        assert.throws(() => fs.readFileSync(letto), rifiutato);
      })
    ]);
    assert.equal(native.readFileSync(esterno, 'utf8'), 'originale');
    assert.equal(native.readFileSync(letto, 'utf8'), 'contenuto');
    console.log('permessi-disco: confini, sola lettura/scrittura, link, descriptor, async e stream OK');
  } finally { native.rmSync(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
