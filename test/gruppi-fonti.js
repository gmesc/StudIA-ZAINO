'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const G = require('../App/assets/fonti/gruppi');
const archivio = require('../lib/gruppi-fonti');
const zaini = require('../lib/zaini');
const fonti = require('../lib/fonti');
const mappe = require('../lib/mappe');
let controlli = 0;
function uguali(attuale, atteso) { assert.deepEqual(attuale, atteso); controlli++; }
function vero(valore) { assert.ok(valore); controlli++; }
function congela(v) {
  Object.freeze(v);
  for (const x of Object.values(v)) if (x && typeof x === 'object') congela(x);
  return v;
}
function tutti(s) { return s.gruppi.flatMap((g) => g.files).concat(s.liberi); }

const appunti = require('../lib/appunti');
const files = ['01 Teoria.pdf', '02 Esercizi.pdf', '03 Lezione.mp4', '04 Audio.opus'];
const partenza = congela({ versione: 1, gruppi: [
  { id: 'teoria', nome: '  Teoria  ', chiuso: true, files: [files[0], files[0], 'scomparso.pdf'] },
  { id: 'pratica', nome: 'Pratica', chiuso: false, files: [files[0], files[1]] }
], liberi: [files[2], files[1]] });
const pulito = G.normalizza(partenza, files);
uguali(pulito, { versione: 1, gruppi: [
  { id: 'teoria', nome: 'Teoria', chiuso: true, files: [files[0]] },
  { id: 'pratica', nome: 'Pratica', chiuso: false, files: [files[1]] }
], liberi: [files[2], files[3]] });
uguali(G.normalizza(pulito, files), pulito);
uguali(G.normalizza(null, files.concat(files[0])).liberi, files);
uguali(G.normalizza({ gruppi: [null, { id: 'x', nome: '', files: files }] }, files).liberi, files);
congela(pulito);

let s = G.crea(pulito, 'lezioni', ' Lezioni ');
uguali(s.gruppi[2], { id: 'lezioni', nome: 'Lezioni', chiuso: false, files: [] });
uguali(G.crea(s, 'lezioni', 'Duplicato'), s);
uguali(G.crea(s, '', 'Invalido'), s);
uguali(G.rinomina(s, 'lezioni', '   '), s);
s = G.rinomina(s, 'lezioni', 'In classe');
uguali(s.gruppi[2].nome, 'In classe');
s = G.sposta(s, files[2], 'lezioni');
s = G.sposta(s, files[3], 'lezioni', 0);
uguali(s.gruppi[2].files, [files[3], files[2]]);
s = G.sposta(s, files[3], 'lezioni', 1);
uguali(s.gruppi[2].files, [files[2], files[3]]);
uguali(G.sposta(s, 'inventato.pdf', 'lezioni'), s);
uguali(G.sposta(s, files[2], 'inesistente'), s);
s = G.sposta(s, files[2], '', 0);
uguali(s.liberi, [files[2]]);
s = G.ordinaGruppo(s, 'lezioni', 0);
uguali(s.gruppi.map((g) => g.id), ['lezioni', 'teoria', 'pratica']);
s = G.toggle(s, 'teoria');
uguali(s.gruppi[1].chiuso, false);
uguali(G.toggle(s, 'inesistente'), s);
s = G.elimina(s, 'teoria');
uguali(s.liberi, [files[2], files[0]]);
uguali(tutti(s).slice().sort(), files.slice().sort());
uguali(pulito.gruppi[0].chiuso, true);
const rinominato = G.rinominaFile(pulito, files[0], '01 Fondamenti.pdf');
uguali(rinominato.gruppi[0], { id: 'teoria', nome: 'Teoria', chiuso: true, files: ['01 Fondamenti.pdf'] });
uguali(G.rinominaFile(pulito, files[0], files[1]), pulito);
uguali(G.rinominaFile(pulito, files[0], '../fuori.pdf'), pulito);
uguali(G.rinominaFile(pulito, 'mai-esistito.pdf', 'nuovo.pdf'), pulito);
uguali(G.rinominaFile(pulito, files[2], '03 Filmato.mp4').liberi, ['03 Filmato.mp4', files[3]]);

// Spostare ripetutamente verso inizio/fondo non duplica e non fa sparire una fonte.
for (let i = 0; i < 80; i++) {
  s = G.sposta(s, files[i % files.length], i % 3 ? 'lezioni' : '', i % 2 ? 999 : -1);
  uguali(tutti(s).slice().sort(), files.slice().sort());
}

// Il puntatore può cadere prima/dopo un item, sul gruppo chiuso o fra i liberi.
let drag=G.normalizza({gruppi:[{id:'a',nome:'A',files:files.slice(0,3)},{id:'b',nome:'B',files:[]}],liberi:[files[3]]},files);
drag=congela(drag);
uguali(G.trascina(drag,{file:files[0]},{file:files[2],gruppo:'a',dopo:true}).gruppi[0].files,[files[1],files[2],files[0]]);
uguali(G.trascina(drag,{file:files[2]},{file:files[0],gruppo:'a'}).gruppi[0].files,[files[2],files[0],files[1]]);
uguali(G.trascina(drag,{file:files[0]},{gruppo:'b'}).gruppi[1].files,[files[0]]);
uguali(G.trascina(drag,{file:files[0]},{gruppo:''}).liberi,[files[3],files[0]]);
uguali(G.trascina(drag,{file:files[0]},{gruppo:'a',file:files[0],dopo:true}),drag);
uguali(G.trascina(drag,{file:files[0]},{gruppo:'assente'}),drag);
uguali(G.trascina(drag,{gruppo:'a'},{gruppo:'b',dopo:true}).gruppi.map(g=>g.id),['b','a']);
uguali(G.trascina(drag,{gruppo:'b'},{gruppo:'a'}).gruppi.map(g=>g.id),['b','a']);
for(const file of files)for(const dest of files)for(const dopo of [true,false]){
  const gid=dest===files[3]?'':'a';
  uguali(tutti(G.trascina(drag,{file},{gruppo:gid,file:dest,dopo})).sort(),files.slice().sort());
}

const vault = fs.mkdtempSync(path.join(os.tmpdir(), 'zaino-gruppi-'));
const fuori = fs.mkdtempSync(path.join(os.tmpdir(), 'zaino-gruppi-fuori-'));
try {
  const id = zaini.crea(vault, 'Gruppi').id;
  const altro = zaini.crea(vault, 'Altro').id;
  const dir = path.join(vault, 'Zaini', id, 'MATERIALI');
  const registro = path.join(dir, archivio.FILE);
  function creaFile(cartella, nome) {
    fs.mkdirSync(path.join(dir, cartella), { recursive: true });
    fs.writeFileSync(path.join(dir, cartella, nome), 'contenuto');
  }
  for (const f of files.slice(0, 2)) creaFile('PDF', f);
  creaFile('Video', files[2]);
  creaFile('Audio', files[3]);
  creaFile('Fonti', '05 Storico.pdf');
  creaFile('PDF', '.nascosto.pdf');
  creaFile('PDF', 'ignorato.txt');
  fs.writeFileSync(path.join(vault, 'Zaini', altro, 'MATERIALI', 'PDF', '99 Altro.pdf'), 'altro');
  fs.mkdirSync(path.join(vault, 'Fonti'));
  fs.writeFileSync(path.join(vault, 'Fonti', '98 Globale.pdf'), 'globale');

  const nuovo = archivio.leggi(vault, id);
  uguali(nuovo.error, '');
  uguali(nuovo.stato.liberi, files.slice(0,2).concat('05 Storico.pdf'));
  uguali(fs.existsSync(registro), false);
  let scelta = G.crea(nuovo.stato, 'esame', 'Esame');
  scelta = G.sposta(scelta, files[0], 'esame');
  scelta = G.toggle(scelta, 'esame');
  const salvato = archivio.salva(vault, id, scelta);
  uguali(salvato, { stato: scelta, error: '' });
  uguali(archivio.leggi(vault, id), salvato);
  uguali(JSON.parse(fs.readFileSync(registro, 'utf8')).fonti, scelta);
  uguali(archivio.leggi(vault,id,'media').stato.liberi, files.slice(2));
  uguali(fs.readdirSync(dir).filter((n) => n.startsWith(archivio.FILE)), [archivio.FILE]);
  uguali(archivio.leggi(vault, altro).stato.liberi, ['99 Altro.pdf']);
  appunti.save(vault, altro, '.personale.md', {title:'Importato'}, 'Nota importata');
  uguali(archivio.leggi(vault, altro, 'appunti').stato.liberi, appunti.list(vault, altro).map(n=>n.file));

  // Regressione: copie vuote ereditate in Media, stessi identificatori delle Fonti.
  const clone = {versione:2,fonti:scelta,media:{versione:1,gruppi:scelta.gruppi.map(g=>({...g,files:[]})),liberi:files.slice(2)}};
  fs.writeFileSync(registro,JSON.stringify(clone));
  uguali(archivio.leggi(vault,id,'media').stato.gruppi,[]);
  uguali(archivio.leggi(vault,id,'fonti').stato,scelta);
  uguali(JSON.parse(fs.readFileSync(registro,'utf8')),clone);

  // La pulizia è una migrazione, mai una regola per cancellare gruppi vuoti in v3.
  fs.writeFileSync(registro,JSON.stringify({...clone,versione:3}));
  uguali(archivio.leggi(vault,id,'media').stato,clone.media);
  uguali(archivio.salva(vault,id,scelta).error,'');
  uguali(archivio.leggi(vault,id,'media').stato,clone.media);
  fs.writeFileSync(registro,JSON.stringify({versione:2,fonti:clone.media,media:clone.media}));
  uguali(archivio.leggi(vault,id).stato.gruppi.length,1);
  uguali(archivio.leggi(vault,id,'media').stato.gruppi,[]);

  // Stesso nome ma id autonomo: il gruppo Media vuoto è intenzionale e resta.
  const autonomo = G.crea(G.normalizza(null,files.slice(2)),'autonomo','Esame');
  fs.writeFileSync(registro,JSON.stringify({...clone,media:autonomo}));
  uguali(archivio.leggi(vault,id,'media').stato,autonomo);
  uguali(archivio.salva(vault,id,scelta).error,'');
  uguali(JSON.parse(fs.readFileSync(registro,'utf8')).versione,3);
  uguali(archivio.leggi(vault,id,'media').stato,autonomo);
  const soloFonti=G.crea(scelta,'solo-fonti','Solo Fonti');
  uguali(archivio.salva(vault,id,soloFonti).error,'');
  uguali(archivio.leggi(vault,id,'media').stato,autonomo);
  uguali(archivio.salva(vault,id,G.rinomina(autonomo,'autonomo','Solo Media'),'media').error,'');
  uguali(archivio.leggi(vault,id).stato,soloFonti);

  // Anche il clone vuoto in Fonti di un gruppo Media popolato viene recuperato.
  const soloMedia=G.sposta(G.crea(G.normalizza(null,files.slice(2)),'audio','Audio'),files[2],'audio');
  const fontiVuoto={versione:1,gruppi:soloMedia.gruppi.map(g=>({...g,files:[]})),liberi:files.slice(0,2)};
  fs.writeFileSync(registro,JSON.stringify({versione:2,fonti:fontiVuoto,media:soloMedia}));
  uguali(archivio.leggi(vault,id).stato.gruppi,[]);
  uguali(archivio.leggi(vault,id,'media').stato,soloMedia);

  // Un gruppo ereditato ma rinominato in una sezione non è più una copia da eliminare.
  fs.writeFileSync(registro,JSON.stringify({...clone,media:G.rinomina(clone.media,'esame','Rinominato')}));
  uguali(archivio.leggi(vault,id,'media').stato.gruppi[0].nome,'Rinominato');

  // I vecchi gruppi solo PDF e quelli ancora vuoti appartengono a Fonti.
  const soloPdf=G.crea(scelta,'vuoto','Da riempire');
  fs.writeFileSync(registro,JSON.stringify(soloPdf));
  uguali(archivio.leggi(vault,id,'media').stato.gruppi,[]);
  uguali(archivio.leggi(vault,id).stato,soloPdf);
  uguali(archivio.salva(vault,id,soloPdf).error,'');
  uguali(archivio.leggi(vault,id,'media').stato.gruppi,[]);
  fs.writeFileSync(registro,JSON.stringify(soloMedia));
  uguali(archivio.leggi(vault,id).stato.gruppi,[]);
  uguali(archivio.leggi(vault,id,'media').stato,soloMedia);

  // Il vecchio registro misto si separa senza scrivere durante la lettura.
  const storico = G.sposta(G.sposta(G.crea(G.normalizza(null,files.concat('05 Storico.pdf')),'comune','Lezione'),files[0],'comune'),files[2],'comune');
  fs.writeFileSync(registro,JSON.stringify(storico));
  uguali(archivio.leggi(vault,id).stato.gruppi[0].files,[files[0]]);
  let media = archivio.leggi(vault,id,'media').stato;
  uguali(media.gruppi[0].files,[files[2]]);
  uguali(JSON.parse(fs.readFileSync(registro,'utf8')),storico);
  uguali(archivio.salva(vault,id,scelta).error,'');
  uguali(archivio.leggi(vault,id,'media').stato,media);
  // Entrambe le metà del gruppo misto restano autonome dopo la migrazione,
  // anche svuotando e sciogliendo quella Media (nessuna nuova pulizia in v3).
  const mediaVuoto=G.sposta(media,files[2],'');
  uguali(archivio.salva(vault,id,mediaVuoto,'media').error,'');
  uguali(archivio.leggi(vault,id,'media').stato.gruppi.length,1);
  uguali(archivio.salva(vault,id,G.elimina(mediaVuoto,'comune'),'media').error,'');
  uguali(archivio.leggi(vault,id).stato,scelta);
  media=G.rinomina(media,'comune','Registrazioni');
  uguali(archivio.salva(vault,id,media,'media').error,'');
  uguali(archivio.leggi(vault,id).stato,scelta);
  const n1=appunti.save(vault,id,null,{title:'Primo'},'Testo da conservare').file;
  const n2=appunti.save(vault,id,null,{title:'Secondo'},'Altra nota').file;
  const notePrima=G.sposta(G.crea(archivio.leggi(vault,id,'appunti').stato,'note','Ripasso'),n1,'note');
  uguali(archivio.salva(vault,id,notePrima,'appunti').error,'');
  const nR=appunti.rinomina(vault,id,n1,'Rinominato');
  vero(!nR.error);
  uguali(archivio.leggi(vault,id,'appunti').stato.gruppi[0].files,[nR.file]);
  uguali(archivio.leggi(vault,id).stato,scelta);
  const registroNote=path.join(vault,'Zaini',id,'APPUNTI',archivio.FILE);
  const noteBuone=fs.readFileSync(registroNote,'utf8');
  fs.writeFileSync(registroNote,'{rotto');
  vero(appunti.rinomina(vault,id,nR.file,'Impossibile').error);
  uguali(fs.readFileSync(registroNote,'utf8'),'{rotto');
  vero(appunti.apri(vault,id,nR.file).nota.body.includes('Testo da conservare'));
  fs.writeFileSync(registroNote,noteBuone);
  const tmpNote=registroNote+'.tmp-'+process.pid;
  fs.writeFileSync(tmpNote,'occupato');
  vero(appunti.rinomina(vault,id,nR.file,'Ripristinato').error);
  uguali(archivio.leggi(vault,id,'appunti').stato.gruppi[0].files,[nR.file]);
  vero(appunti.apri(vault,id,nR.file).nota.body.includes('Testo da conservare'));
  uguali(appunti.list(vault,id).map(n=>n.file).sort(),[nR.file,n2].sort());
  fs.unlinkSync(tmpNote);
  vero(archivio.leggi(vault,id,'../APPUNTI').error);

  // Mappe: registro separato, rinomina nello stesso gruppo e rollback se non si può salvarlo.
  const m1=mappe.salva(vault,id,null,{titolo:'Prima mappa',nodi:[],archi:[]}).file;
  const m2=mappe.salva(vault,id,null,{titolo:'Seconda mappa',nodi:[],archi:[]}).file;
  const mLetto=archivio.leggi(vault,id,'mappe');
  uguali(mLetto.error,'');
  uguali(mLetto.stato.liberi,[m1,m2]);
  let mStato=G.sposta(G.crea(mLetto.stato,'mappe','Concetti'),m1,'mappe');
  uguali(archivio.salva(vault,id,mStato,'mappe').error,'');
  const registroMappe=path.join(vault,'Zaini',id,'MAPPE',archivio.FILE);
  uguali(JSON.parse(fs.readFileSync(registroMappe,'utf8')),mStato);
  const mR=mappe.rinomina(vault,id,m1,'Mappa rinominata');vero(!mR.error);
  mStato=G.rinominaFile(mStato,m1,mR.file);
  uguali(archivio.leggi(vault,id,'mappe').stato,mStato);
  uguali(archivio.leggi(vault,id,'appunti').stato.gruppi[0].files,[nR.file]);
  uguali(archivio.leggi(vault,id,'media').stato,media);
  uguali(archivio.leggi(vault,altro,'mappe').stato.liberi,[]);
  const mappeBuone=fs.readFileSync(registroMappe,'utf8');
  const mOriginale=fs.readFileSync(path.join(path.dirname(registroMappe),mR.file),'utf8');
  fs.writeFileSync(registroMappe,'{rotto');
  vero(mappe.rinomina(vault,id,mR.file,'Impossibile').error);
  uguali(fs.readFileSync(registroMappe,'utf8'),'{rotto');
  fs.writeFileSync(registroMappe,mappeBuone);
  const tmpMappe=registroMappe+'.tmp-'+process.pid;fs.writeFileSync(tmpMappe,'occupato');
  vero(mappe.rinomina(vault,id,mR.file,'Ripristinata').error);
  uguali(fs.readFileSync(path.join(path.dirname(registroMappe),mR.file),'utf8'),mOriginale);
  uguali(archivio.leggi(vault,id,'mappe').stato,mStato);
  uguali(mappe.elenco(vault,id).mappe.map(m=>m.file).sort(),[mR.file,m2].sort());
  fs.unlinkSync(tmpMappe);
  fs.writeFileSync(path.join(path.dirname(registroMappe),'.nascosta.json'),'{}');
  uguali(archivio.leggi(vault,id,'mappe').stato,mStato);

  const rinomina = fonti.rinomina(vault, id, files[0], 'Fondamenti');
  uguali(rinomina.error, '');
  uguali(archivio.leggi(vault, id).stato, G.rinominaFile(scelta, files[0], rinomina.nome));
  uguali(fs.existsSync(path.join(dir, 'PDF', rinomina.nome)), true);
  uguali(fs.existsSync(path.join(dir, 'PDF', files[0])), false);
  uguali(fonti.rinomina(vault, id, rinomina.nome, 'Teoria').error, '');
  uguali(archivio.leggi(vault, id).stato, scelta);

  // Il renderer non può inventare file né nascondere quelli importati dopo la sua lettura.
  creaFile('PDF', '06 Nuovo.pdf');
  fs.unlinkSync(path.join(dir, 'PDF', files[1]));
  const aggiornato = archivio.salva(vault, id, scelta);
  uguali(tutti(aggiornato.stato).slice().sort(), files.slice(0,2).filter((f) => f !== files[1]).concat('05 Storico.pdf', '06 Nuovo.pdf').sort());
  const prima = fs.readFileSync(registro, 'utf8');
  vero(archivio.salva(vault, id, { versione: 2, gruppi: [], liberi: [] }).error);
  uguali(fs.readFileSync(registro, 'utf8'), prima);
  for (const errato of ['../Gruppi', '..', 'Gruppi/../Altro', 'Gruppi\\..\\Altro', 'inesistente']) {
    vero(archivio.leggi(vault, errato).error);
    vero(archivio.salva(vault, errato, scelta).error);
  }

  for (const rotto of ['{ non json', '{}', '{"versione":2,"gruppi":[],"liberi":[]}']) {
    fs.writeFileSync(registro, rotto);
    uguali(archivio.leggi(vault, id).stato, null);
    vero(archivio.leggi(vault, id).error);
    vero(archivio.salva(vault, id, scelta).error);
    uguali(fs.readFileSync(registro, 'utf8'), rotto);
    vero(fonti.rinomina(vault, id, files[0], 'Non rinominato').error);
    uguali(fs.existsSync(path.join(dir, 'PDF', files[0])), true);
    uguali(fs.existsSync(path.join(dir, 'PDF', '01 Non rinominato.pdf')), false);
  }
  fs.writeFileSync(registro, prima);

  const esterno = path.join(fuori, 'intatto.json');
  fs.writeFileSync(esterno, prima);
  fs.unlinkSync(registro);
  fs.symlinkSync(esterno, registro);
  vero(archivio.leggi(vault, id).error);
  vero(archivio.salva(vault, id, scelta).error);
  uguali(fs.readFileSync(esterno, 'utf8'), prima);
  fs.unlinkSync(registro);
  fs.writeFileSync(registro, prima);
  const tmp = registro + '.tmp-' + process.pid;
  fs.symlinkSync(esterno, tmp);
  vero(archivio.salva(vault, id, scelta).error);
  vero(fonti.rinomina(vault, id, files[0], 'Non rinominato').error);
  uguali(fs.existsSync(path.join(dir, 'PDF', files[0])), true);
  uguali(fs.existsSync(path.join(dir, 'PDF', '01 Non rinominato.pdf')), false);
  uguali(fs.readFileSync(registro, 'utf8'), prima);
  uguali(fs.readFileSync(esterno, 'utf8'), prima);
  fs.unlinkSync(tmp);
  fs.symlinkSync(path.join(fuori, 'assente'), tmp);
  vero(archivio.salva(vault, id, scelta).error);
  uguali(fs.existsSync(path.join(fuori, 'assente')), false);
  fs.unlinkSync(tmp);

  const video = path.join(dir, 'Video');
  fs.renameSync(video, path.join(dir, 'Video-salvati'));
  fs.symlinkSync(fuori, video, 'dir');
  vero(archivio.leggi(vault, id).error);
  vero(archivio.salva(vault, id, scelta).error);
  fs.unlinkSync(video);
  fs.renameSync(path.join(dir, 'Video-salvati'), video);

  const alias = path.join(vault, 'Zaini', 'alias');
  fs.symlinkSync(path.join(vault, 'Zaini', id), alias, 'dir');
  vero(archivio.leggi(vault, 'alias').error);
  vero(archivio.salva(vault, 'alias', scelta).error);
  fs.renameSync(dir, dir + '-salvati');
  fs.symlinkSync(fuori, dir, 'dir');
  vero(archivio.leggi(vault, id).error);
  vero(archivio.salva(vault, id, scelta).error);
  uguali(fs.readFileSync(esterno, 'utf8'), prima);
} finally {
  fs.rmSync(vault, { recursive: true, force: true });
  fs.rmSync(fuori, { recursive: true, force: true });
}

console.log('✓ gruppi delle fonti: ' + controlli + ' controlli passati');
