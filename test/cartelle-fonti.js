'use strict';
const assert = require('assert/strict'), fs = require('fs'), os = require('os'), path = require('path');
const F = require('../lib/fonti'), Z = require('../lib/zaini'), M = require('../lib/materiali');
const A = require('../lib/gruppi-fonti'), G = require('../App/assets/fonti/gruppi');
const C = require('../lib/cartelle-fonti'), AI = require('../lib/fonti-ai');
// Il drop riconosce le cartelle prima dell'estensione, anche quando finiscono in .mp4.
const html = fs.readFileSync(path.join(__dirname, '../App/StudIA.html'), 'utf8'), ricevuti = {};
const drop = { window: { vault: { fonti: { eCartella: f => !!f.cartella } } },
  Lettore: { tipoDi: n => n.endsWith('.mp4') }, AlbumFoto: { tipoDalNome: n => n.endsWith('.png') },
  AppuntiImporta: { tipoDalNome: n => n.endsWith('.txt') } };
for (const tipo of ['fonti', 'media', 'foto', 'testi']) drop[tipo + 'Trascinat' + (['media', 'testi'].includes(tipo) ? 'i' : 'e')] = f => { ricevuti[tipo] = f; };
require('vm').runInNewContext(html.match(/function zainoTrascinati\(files\)\{[\s\S]*?\n\}/)[0], drop);
const caduti = [{ name: 'Lezioni.mp4', cartella: true }, { name: 'Teoria.pdf' }, { name: 'Video.mp4' }, { name: 'Foto.png' }, { name: 'Nota.txt' }];
assert.equal(drop.zainoTrascinati(caduti), true);
assert.deepEqual(Array.from(ricevuti.fonti), caduti.slice(0, 2));
assert.deepEqual(Array.from(ricevuti.media), [caduti[2]]);
assert.deepEqual(Array.from(ricevuti.foto), [caduti[3]]);
assert.deepEqual(Array.from(ricevuti.testi), [caduti[4]]);
const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zaino-cartelle-')));
const vault = path.join(tmp, 'vault'), sorgente = path.join(tmp, 'Lezioni di storia');
function salva(id, stato) { const r = A.salva(vault, id, stato); assert.equal(r.error, ''); return r.stato; }
function snapshot(dir) {
  return fs.readdirSync(dir, { recursive: true }).sort().map(f => {
    const p = path.join(dir, f); return [f, fs.statSync(p).isFile() ? fs.readFileSync(p).toString('base64') : null];
  });
}
(async () => {
  try {
    fs.mkdirSync(vault); fs.mkdirSync(path.join(sorgente, 'Esercizi'), { recursive: true });
    fs.writeFileSync(path.join(sorgente, 'Teoria.pdf'), '%PDF-1.4 teoria');
    fs.writeFileSync(path.join(sorgente, 'Esercizi', 'Teoria.PDF'), '%PDF-1.4 esercizi');
    fs.writeFileSync(path.join(sorgente, 'ignora.txt'), 'resta fuori');
    const id = Z.crea(vault, 'Cartelle').id, altro = Z.crea(vault, 'Altro').id;
    const dir = F.dirPdf(vault, id), registro = path.join(dir, '..', A.FILE);
    const originali = snapshot(sorgente), r = F.importa(vault, id, [sorgente]);
    assert.equal(r.error, ''); assert.equal(r.copiati.length, 2); assert.equal(r.scartati.length, 1);
    let stato = A.leggi(vault, id).stato, gruppo = stato.gruppi[0];
    assert.equal(gruppo.nome, path.basename(sorgente)); assert.equal(gruppo.files.length, 2);
    assert.deepEqual(F.elenco(vault, id).sort(), gruppo.files.slice().sort());
    assert.equal(Z.quantiDocumenti(vault, id), 2); assert.equal(Z.quantiDocumenti(vault, altro), 0);
    const primo = gruppo.files[0], secondo = gruppo.files[1];
    const inGruppo = (nome, file) => path.join(dir, 'Gruppi', nome, file);
    assert.equal(M.trova(vault, 'Fonti', primo, id, true), inGruppo(gruppo.nome, primo));
    assert.deepEqual(snapshot(sorgente), originali);
    assert.equal(F.scriviIndice(vault, id, primo, [{ page: 1, text: 'Teoria e storia' }]).error, '');
    const fontiAI = AI.sincronizza(vault, id).sources;
    stato = salva(id, G.rinomina(stato, gruppo.id, 'Ripasso'));
    assert(!fs.existsSync(path.join(dir, 'Gruppi', gruppo.nome)));
    assert(fs.existsSync(inGruppo('Ripasso', primo)));
    assert.deepEqual(AI.sincronizza(vault, id).sources.map(s => s.id).sort(), fontiAI.map(s => s.id).sort());
    stato = salva(id, G.rinomina(stato, gruppo.id, 'ripasso'));
    assert(fs.readdirSync(path.join(dir, 'Gruppi')).includes('ripasso'));
    stato = salva(id, G.sposta(G.crea(stato, 'esame', 'Esame'), primo, 'esame'));
    assert(fs.existsSync(inGruppo('Esame', primo))); assert(!fs.existsSync(inGruppo('ripasso', primo)));
    const rinominato = F.rinomina(vault, id, primo, 'Nuovo titolo');
    assert.equal(rinominato.error, ''); assert(fs.existsSync(inGruppo('Esame', rinominato.nome)));
    assert(fs.existsSync(F.percorsoIndice(vault, id, rinominato.nome)));
    stato = A.leggi(vault, id).stato;
    assert.deepEqual(stato.gruppi.find(g => g.id === 'esame').files, [rinominato.nome]);
    stato = salva(id, G.sposta(stato, rinominato.nome, ''));
    assert.equal(F.percorso(vault, id, rinominato.nome), path.join(dir, rinominato.nome));

    // Un salvataggio fallito dopo gli spostamenti deve ripristinare file, cartelle e registro.
    const prima = snapshot(path.join(dir, '..')), rename = fs.renameSync;
    fs.renameSync = (da, a) => { if (a === registro) throw new Error('scrittura negata simulata'); return rename(da, a); };
    try { assert.match(A.salva(vault, id, G.rinomina(stato, gruppo.id, 'Non salvato')).error, /scrittura negata/); }
    finally { fs.renameSync = rename; }
    assert.deepEqual(snapshot(path.join(dir, '..')), prima);

    stato = salva(id, G.elimina(stato, gruppo.id));
    assert.equal(F.percorso(vault, id, secondo), path.join(dir, secondo));
    assert(!fs.existsSync(path.join(dir, 'Gruppi', 'ripasso')));
    const secondoImport = F.importa(vault, id, [sorgente]);
    assert.equal(secondoImport.copiati[0].nome.slice(0, 2), '03');
    assert.equal(secondoImport.copiati.length, 2);
    assert.equal(F.importa(vault, id, [sorgente]).copiati.length, 2);
    stato = A.leggi(vault, id).stato;
    const omonimi = stato.gruppi.filter(g => g.nome === path.basename(sorgente)), nomi = C.nomiCartelle(stato);
    assert.equal(omonimi.length, 2); assert.notEqual(nomi.get(omonimi[0].id), nomi.get(omonimi[1].id));
    const primaOrdine = snapshot(dir);
    stato = salva(id, G.ordinaGruppo(stato, omonimi[1].id, 0));
    assert.deepEqual(snapshot(dir), primaOrdine);
    const duplicatiAI = AI.sincronizza(vault, id).sources.map(s => s.id).sort();
    stato = salva(id, G.rinomina(stato, omonimi[1].id, 'Secondo gruppo'));
    assert.deepEqual(AI.sincronizza(vault, id).sources.map(s => s.id).sort(), duplicatiAI);
    for (const nome of ['../fuori', 'CON', '...', '_privato', 'A/B', 'A\\B', '📚'.repeat(100)]) {
      stato = salva(id, G.rinomina(stato, 'esame', nome));
      const sicuro = C.nomiCartelle(stato).get('esame');
      assert(!/[\\/]/.test(sicuro)); assert(!sicuro.startsWith('.')); assert(!sicuro.startsWith('_'));
      assert(fs.statSync(path.join(dir, 'Gruppi', sicuro)).isDirectory());
    }
    // Un collegamento a una cartella esterna non viene attraversato né importato.
    const alias = path.join(tmp, 'alias'); fs.symlinkSync(sorgente, alias, 'dir');
    assert.equal(F.importa(vault, id, [alias]).copiati.length, 0);
    const esterna = path.join(dir, 'Gruppi', 'esterna'); fs.symlinkSync(sorgente, esterna, 'dir');
    assert(A.salva(vault, id, stato).error); assert(A.leggi(vault, id).error);
    assert.deepEqual(snapshot(sorgente), originali); fs.unlinkSync(esterna);

    // Rimozione e ritorno del PDF raggruppato conservano il numero e i rimandi storici.
    const f = omonimi[0].files[0], bytes = fs.readFileSync(F.percorso(vault, id, f));
    assert.equal((await F.elimina(vault, id, f)).error, ''); assert(!F.percorso(vault, id, f));
    const ritorno = path.join(tmp, 'ritorno.pdf'); fs.writeFileSync(ritorno, bytes);
    assert.equal(F.importa(vault, id, [ritorno]).copiati[0].nome, f);
    // Il temporaneo occupato impedisce l'organizzazione, ma le copie restano accessibili e l'avviso lo dice.
    fs.writeFileSync(registro + '.tmp-' + process.pid, 'occupato');
    const parziale = F.importa(vault, id, [sorgente]);
    assert.equal(parziale.error, ''); assert(parziale.avvisi[0].includes('senza raggruppamento'));
    assert(parziale.copiati.every(f => fs.existsSync(path.join(dir, f.nome))));
    fs.unlinkSync(registro + '.tmp-' + process.pid);
    fs.writeFileSync(registro, '{guasto');
    const primaGuasto = snapshot(dir);
    assert(F.importa(vault, id, [sorgente]).error); assert.deepEqual(snapshot(dir), primaGuasto);
    assert.deepEqual(snapshot(sorgente), originali);
    console.log('✓ cartelle PDF: import, percorsi, rinomina, assegnazione, rollback, omonimi e ritorno');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
})().catch(e => { console.error(e); process.exitCode = 1; });
