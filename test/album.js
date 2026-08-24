'use strict';
/**
 * Test dell'album delle immagini ritagliate (lib/album.js), e del posto che
 * l'album occupa nell'esportazione di un corso (lib/pacchetto.js).
 *
 * La promessa da difendere è quella degli appunti e delle mappe — sono file
 * dell'UTENTE, e non devono sparire né restare a metà — con due paure in più che
 * appartengono solo a questa cartella.
 *
 * La prima: un ritaglio è un gesto della mano, e la mano non ripete mai due
 * volte gli stessi decimali. Se l'identità fosse l'uguaglianza esatta, passare
 * di nuovo sulla stessa figura riempirebbe l'album di doppioni indistinguibili;
 * se fosse troppo larga, due ritagli diversi si mangerebbero a vicenda. Metà dei
 * controlli qui sotto sta su quel crinale.
 *
 * La seconda: un'immagine dell'album non vive da sola — un appunto la mostra con
 * `![…](album:<id>)`, un nodo di mappa la porta. Cancellarla senza dirlo lascia
 * un buco che si scopre mesi dopo, quando non si sa più che cosa c'era. Perciò
 * `rimuovi` deve RIFIUTARE, e per rifiutare deve prima saper contare gli usi —
 * anche quando l'id non è scritto con il prefisso davanti.
 *
 * Gira su una cartella temporanea creata e ripulita qui: il vault vero non si
 * tocca mai.
 *
 *   node test/album.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const A = require('../lib/album');
const APP = require('../lib/appunti');
const M = require('../lib/mappe');
const PAC = require('../lib/pacchetto');

let ko = 0, ok = 0;
function check(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { ok++; return; }
  ko++;
  console.log('  ✗ ' + nome + '\n      atteso: ' + a + '\n      avuto:  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

const VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'studia-album-'));
const CORSO = 'TD74-DSA';
const DIR = A.dir(VAULT, CORSO);
const QUANDO = '2026-08-10T09:00:00.000Z';

/** Album, appunti e mappe del corso di prova, azzerati fra una sezione e
 *  l'altra: ogni sezione dev'essere leggibile da sola. */
function pulisci() {
  for (const d of [DIR, APP.dir(VAULT, CORSO), M.dir(VAULT, CORSO)]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {}
  }
}
/** Le immagini che stanno davvero in ALBUM/, indice escluso. */
function suDisco() {
  try { return fs.readdirSync(DIR).filter((f) => f !== A.INDICE).sort(); } catch (e) { return []; }
}

/* ---------------------------------------------------------------------------
   Un PNG vero, non uno finto.

   Serve perché due controlli guardano i BYTE: che il modulo LEGGA le misure
   dall'IHDR invece di credere a chi le dichiara, e che ciò che finisce su disco
   sia identico a ciò che è stato mandato (`writeAtomic` passa 'utf-8', e la
   promessa è che Node lo ignori davanti a un Buffer). Con un'immagine inventata
   quei due controlli proverebbero l'invenzione.
   --------------------------------------------------------------------------- */
const CRC = (function () {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(tipo, dati) {
  const len = Buffer.alloc(4); len.writeUInt32BE(dati.length, 0);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dati]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(corpo), 0);
  return Buffer.concat([len, corpo, crc]);
}
function png(w, h, tinta) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;                 // 8 bit per canale, colore RGB
  const righe = [];
  for (let y = 0; y < h; y++) righe.push(Buffer.from([0]), Buffer.alloc(w * 3, tinta == null ? 0x80 : tinta));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(righe))),
    chunk('IEND', Buffer.alloc(0))
  ]);
}
function dataUrl(buf, mime) { return 'data:' + (mime || 'image/png') + ';base64,' + buf.toString('base64'); }

/** Un ritaglio verosimile: un PDF del corpus, una pagina, un'area con i decimali
 *  che un trascinamento vero si porta dietro. */
function ritaglio(over) {
  return Object.assign({
    materiale: '03 La disortografia - Galton.pdf',
    pagina: 7,
    rect: { x: 72.5, y: 120.25, w: 300.75, h: 210.5 },
    didascalia: 'I quattro processi',
    dati: dataUrl(png(120, 84))
  }, over || {});
}

sezione('Un ritaglio salvato è un file più una riga nell\'indice');
{
  pulisci();
  const r = A.salva(VAULT, CORSO, ritaglio(), QUANDO);
  check('il salvataggio non ha niente da ridire', '', r.error);
  check('e non è un doppione di niente', false, r.giaCera);
  check('l\'id è corto ed esadecimale: si scrive a mano in ![…](album:…)', true, /^[0-9a-f]{10}$/.test(r.voce.id));
  check('il nome del file dice documento, pagina e id',
    '03 La disortografia - Galton__p007_' + r.voce.id + '.png', r.voce.file);
  check('e su disco c\'è quel file, uno solo', [r.voce.file], suDisco());
  check('le misure sono LETTE dall\'immagine, non dichiarate', [120, 84], [r.voce.w, r.voce.h]);
  check('i byte scritti sono quelli mandati, non un testo', true,
    fs.readFileSync(path.join(DIR, r.voce.file)).equals(png(120, 84)));

  const e = A.elenco(VAULT, CORSO);
  check('rileggendo l\'album, la sua riga c\'è', 1, e.voci.length);
  check('con la didascalia', 'I quattro processi', e.voci[0].didascalia);
  check('la pagina e il materiale', ['03 La disortografia - Galton.pdf', 7], [e.voci[0].materiale, e.voci[0].pagina]);
  check('e l\'ora in cui è nata', QUANDO, e.voci[0].creato);
  check('l\'indice sta accanto alle immagini', true, fs.existsSync(A.percorso(VAULT, CORSO)));
  check('e dichiara la forma che ha, come fanno le mappe',
    1, JSON.parse(fs.readFileSync(A.percorso(VAULT, CORSO), 'utf-8')).formato);
  check('l\'immagine si sa anche dove sta, per mostrarla', true,
    A.percorsoImmagine(VAULT, CORSO, r.voce.id).endsWith(r.voce.file));
}

sezione('Ritagliare due volte la stessa area non fa due immagini');
{
  pulisci();
  const primo = A.salva(VAULT, CORSO, ritaglio(), QUANDO);
  /* Lo stesso gesto rifatto a mano: due punti di scarto per lato, che è quanto
     una mano sbaglia. ⚠️ I due rettangoli hanno id DIVERSI — l'arrotondamento da
     solo non basta, e il controllo qui sotto lo dimostra invece di prometterlo.
     A decidere è `gemello`, che confronta le distanze e non ha bordi di cella. */
  const b = ritaglio({
    rect: { x: 74.9, y: 122.1, w: 299.2, h: 212.4 },
    didascalia: 'Un altro nome',
    dati: dataUrl(png(122, 86))
  });
  check('due trascinamenti sulla stessa figura danno due id diversi',
    false, A.identita(ritaglio()) === A.identita(b));
  check('ma sono lo stesso ritaglio', true, A.vicini(ritaglio().rect, b.rect));

  const ancora = A.salva(VAULT, CORSO, b, '2026-08-10T10:00:00.000Z');
  check('e salvandolo si torna quello di prima', true, ancora.giaCera);
  check('con lo stesso id', primo.voce.id, ancora.voce.id);
  check('e la didascalia di prima: cambiarla è mestiere di rinomina',
    'I quattro processi', ancora.voce.didascalia);
  check('nessun secondo file', [primo.voce.file], suDisco());
  check('e nessuna seconda riga', 1, A.elenco(VAULT, CORSO).voci.length);

  const altra = A.salva(VAULT, CORSO, ritaglio({
    rect: { x: 72, y: 400, w: 300, h: 180 }, didascalia: 'La scala', dati: dataUrl(png(60, 36))
  }), QUANDO);
  check('un\'altra area della stessa pagina è un\'altra immagine', false, altra.giaCera);
  check('e adesso i file sono due', 2, suDisco().length);
  check('come le righe', 2, A.elenco(VAULT, CORSO).voci.length);

  const altrove = A.salva(VAULT, CORSO, ritaglio({ pagina: 9 }), QUANDO);
  check('lo stesso rettangolo su un\'altra pagina è un altro ritaglio', false, altrove.giaCera);
  check('e si vede dal nome del file', true, altrove.voce.file.indexOf('__p009_') > 0);
}

sezione('Il rettangolo sopravvive identico: è l\'unica cosa che riporta alla pagina');
{
  pulisci();
  const rect = { x: 72.53125, y: 120.25, w: 300.75, h: 210.5 };
  const r = A.salva(VAULT, CORSO, ritaglio({ rect }), QUANDO);
  check('si salva com\'è, decimali compresi', rect, r.voce.rect);
  check('e rileggendolo dal file torna uguale', rect, A.elenco(VAULT, CORSO).voci[0].rect);
  check('l\'arrotondamento vive dentro l\'id e non tocca il dato', true, /^[0-9a-f]{10}$/.test(r.voce.id));

  check('un rettangolo tirato all\'indietro si raddrizza, invece di essere rifiutato',
    { x: 120, y: 260, w: 80, h: 40 }, A.normalizzaRect({ x: 200, y: 300, w: -80, h: -40 }));
  check('uno alto zero non è un ritaglio', null, A.normalizzaRect({ x: 1, y: 1, w: 10, h: 0 }));
  check('e nemmeno uno con una coordinata vuota', null, A.normalizzaRect({ x: null, y: '', w: 10, h: 10 }));
  check('una casella di testo consegna «120», non 120, e va bene lo stesso',
    { x: 120, y: 30, w: 10, h: 10 }, A.normalizzaRect({ x: '120', y: '30', w: '10', h: '10' }));
}

sezione('La didascalia si cambia, il nome del file no');
{
  pulisci();
  const r = A.salva(VAULT, CORSO, ritaglio(), QUANDO);
  const n = A.rinomina(VAULT, CORSO, r.voce.id, '  Le quattro vie dell\'ortografia  ');
  check('la didascalia cambia, ripulita ai bordi', 'Le quattro vie dell\'ortografia', n.voce.didascalia);
  check('il file resta quello: è l\'identità a cui puntano appunti e mappe', r.voce.file, n.voce.file);
  check('e su disco non si è mosso niente', [r.voce.file], suDisco());
  check('l\'id nemmeno', r.voce.id, n.voce.id);
  check('rileggendo, la didascalia nuova è scritta',
    'Le quattro vie dell\'ortografia', A.elenco(VAULT, CORSO).voci[0].didascalia);
  check('una didascalia vuota si rifiuta', true, /senza didascalia/.test(A.rinomina(VAULT, CORSO, r.voce.id, '   ').error));
  check('e quella di prima resta al suo posto',
    'Le quattro vie dell\'ortografia', A.elenco(VAULT, CORSO).voci[0].didascalia);
  check('un\'immagine che non c\'è lo dice', true, /non è nell'album/.test(A.rinomina(VAULT, CORSO, 'ffffffffff', 'x').error));

  pulisci();
  const muto = A.salva(VAULT, CORSO, ritaglio({ didascalia: '' }), QUANDO);
  check('senza didascalia si dice almeno da dove viene, invece di lasciare una riga muta',
    '03 La disortografia - Galton — p. 7', muto.voce.didascalia);
}

sezione('L\'album si sfoglia nell\'ordine in cui si è sfogliato il documento');
{
  pulisci();
  A.salva(VAULT, CORSO, ritaglio({ materiale: '05 Metodo di studio.pdf', pagina: 2, didascalia: 'd' }), '2026-08-10T09:00:03.000Z');
  A.salva(VAULT, CORSO, ritaglio({ pagina: 9, didascalia: 'c' }), '2026-08-10T09:00:02.000Z');
  A.salva(VAULT, CORSO, ritaglio({ pagina: 7, rect: { x: 10, y: 10, w: 50, h: 50 }, didascalia: 'b' }), '2026-08-10T09:00:01.000Z');
  A.salva(VAULT, CORSO, ritaglio({ pagina: 7, didascalia: 'a' }), '2026-08-10T09:00:00.000Z');
  check('prima il documento, poi la pagina, poi quando è stata ritagliata',
    ['a', 'b', 'c', 'd'], A.elenco(VAULT, CORSO).voci.map((v) => v.didascalia));
  check('e il file dell\'indice è ordinato allo stesso modo, così un diff si legge',
    ['a', 'b', 'c', 'd'],
    JSON.parse(fs.readFileSync(A.percorso(VAULT, CORSO), 'utf-8')).voci.map((v) => v.didascalia));
}

sezione('Chi usa un\'immagine la referenzia, e si può contare dove');
{
  pulisci();
  const r = A.salva(VAULT, CORSO, ritaglio(), QUANDO);
  const id = r.voce.id;
  /* L'immagine è la PRIMA riga dell'appunto: così l'id finisce anche dentro
     `_indice.md`, che appunti.js rigenera a ogni salvataggio. Contarlo
     raddoppierebbe gli usi con un file che non ha scritto nessuno. */
  const nota = APP.save(VAULT, CORSO, null, { title: 'Ortografia' },
    '![I quattro processi](album:' + id + ')\n\nLo schema chiarisce il resto.');
  // e una mappa il cui nodo la porta: lì l'id sta in un campo JSON, senza prefisso
  M.salva(VAULT, CORSO, 'quadro.json', {
    titolo: 'Il quadro', nodi: [{ id: 'n1', testo: 'Schema', album: id }], archi: []
  });
  check('la mappa conserva davvero l\'id sul nodo', id,
    (M.apri(VAULT, CORSO, 'quadro.json').mappa.nodi[0] || {}).album);

  const u = A.usi(VAULT, CORSO, id);
  check('l\'appunto che la mostra si trova', [nota.file], u.appunti);
  check('e la mappa che la porta pure — dove «album:<id>» non è scritto da nessuna parte',
    ['quadro.json'], u.mappe);
  check('in tutto due usi', 2, u.quanti);
  check('l\'id compare anche nell\'indice generato degli appunti', true,
    fs.readFileSync(path.join(APP.dir(VAULT, CORSO), '_indice.md'), 'utf-8').indexOf(id) > 0);
  check('ma quello non conta: si riscrive da solo', 1, u.appunti.length);
  check('un\'immagine che nessuno cita non risulta usata', 0, A.usi(VAULT, CORSO, 'a1b2c3d4e5').quanti);
  check('e niente è rimasto illeggibile', [], u.illeggibili);
}

sezione('Cancellare un\'immagine usata non è un\'operazione silenziosa');
{
  // si riparte dallo stato della sezione precedente: l'immagine è usata due volte
  const id = A.elenco(VAULT, CORSO).voci[0].id;
  const file = A.elenco(VAULT, CORSO).voci[0].file;

  const rifiuto = A.rimuovi(VAULT, CORSO, id);
  check('la cancellazione si rifiuta', false, rifiuto.tolto);
  check('dicendo quanti usi ha trovato', 2, rifiuto.usi.quanti);
  check('e perché non lo fa', true, /riferimento rotto/.test(rifiuto.error));
  check('il file è ancora al suo posto', true, fs.existsSync(path.join(DIR, file)));
  check('e la riga nell\'indice anche', 1, A.elenco(VAULT, CORSO).voci.length);

  const forzato = A.rimuovi(VAULT, CORSO, id, { insisti: true });
  check('insistendo si toglie', true, forzato.tolto);
  check('il file sparisce', [], suDisco());
  check('e l\'album resta vuoto', 0, A.elenco(VAULT, CORSO).voci.length);
  /* L'appunto che la citava non si tocca, e il suo riferimento resta rotto e
     visibile. È la regola già presa per le evidenze orfane: il posto è sparito,
     la storia no — e un rimando che non porta da nessuna parte va detto, non
     ricucito di nascosto da chi cancella. */
  check('l\'appunto che la citava è ancora lì', 1, APP.read(VAULT, CORSO).notes.length);
  check('e porta ancora il riferimento, adesso rotto in chiaro', true,
    APP.read(VAULT, CORSO).notes[0].body.indexOf('album:' + id) > 0);
}

sezione('Un\'immagine libera si toglie e basta');
{
  pulisci();
  const r = A.salva(VAULT, CORSO, ritaglio(), QUANDO);
  const t = A.rimuovi(VAULT, CORSO, r.voce.id);
  check('nessun uso, nessuna obiezione', true, t.tolto);
  check('senza lasciare file dietro', [], suDisco());
  check('togliere due volte lo stesso id lo dice', true,
    /non è nell'album/.test(A.rimuovi(VAULT, CORSO, r.voce.id).error));
}

sezione('«Non lo so» non è «no»: un file che non si legge ferma la cancellazione');
{
  pulisci();
  const r = A.salva(VAULT, CORSO, ritaglio(), QUANDO);
  /* Una cartella che si chiama come un appunto: è il modo portabile di ottenere
     una lettura che fallisce, senza dipendere dai permessi del sistema. */
  fs.mkdirSync(path.join(APP.dir(VAULT, CORSO), 'strana.md'), { recursive: true });
  const u = A.usi(VAULT, CORSO, r.voce.id);
  check('il file che non si è potuto leggere si dichiara', ['strana.md'], u.illeggibili);
  check('e non si spaccia per «nessun uso»', 0, u.quanti);
  const t = A.rimuovi(VAULT, CORSO, r.voce.id);
  check('davanti a un dubbio la cancellazione si ferma', false, t.tolto);
  check('dicendo che cosa non ha potuto guardare', true, /strana\.md/.test(t.error));
  check('l\'immagine è ancora lì', 1, A.elenco(VAULT, CORSO).voci.length);
  check('e insistendo si toglie lo stesso', true, A.rimuovi(VAULT, CORSO, r.voce.id, { insisti: true }).tolto);
}

sezione('Ciò che non è un\'immagine non entra, e non lascia tracce');
{
  pulisci();
  const storto = A.salva(VAULT, CORSO, ritaglio({ dati: 'data:image/png;base64,questo non è base64' }), QUANDO);
  check('un data URL che non porta un PNG si rifiuta', true, /non sono un'immagine/.test(storto.error));
  check('senza lasciare il file', [], suDisco());
  check('senza lasciare la riga', 0, A.elenco(VAULT, CORSO).voci.length);
  check('e senza nemmeno creare l\'indice', false, fs.existsSync(A.percorso(VAULT, CORSO)));

  check('un percorso al posto dei byte lo dice', true,
    /data URL/.test(A.salva(VAULT, CORSO, ritaglio({ dati: '/Users/x/foto.png' }), QUANDO).error));
  check('un formato che nessuno sa disegnare pure', true,
    /formato non supportato/.test(A.salva(VAULT, CORSO, ritaglio({
      dati: 'data:image/svg+xml;base64,' + Buffer.from('<svg/>').toString('base64')
    }), QUANDO).error));
  check('e un PNG spacciato per JPEG non passa la firma', true,
    /non sono un'immagine/.test(A.salva(VAULT, CORSO, ritaglio({ dati: dataUrl(png(10, 10), 'image/jpeg') }), QUANDO).error));

  check('un ritaglio senza pagina non si salva', true,
    /da quale/.test(A.salva(VAULT, CORSO, ritaglio({ pagina: 0 }), QUANDO).error));
  check('né uno senza documento', true,
    /da quale/.test(A.salva(VAULT, CORSO, ritaglio({ materiale: '   ' }), QUANDO).error));
  check('né uno senza area', true,
    /da quale/.test(A.salva(VAULT, CORSO, ritaglio({ rect: null }), QUANDO).error));
  check('dopo tutto questo la cartella è ancora pulita', [], suDisco());
}

sezione('Un id che è un percorso non tocca niente fuori dall\'album');
{
  pulisci();
  A.salva(VAULT, CORSO, ritaglio(), QUANDO);
  const fuori = path.join(APP.dir(VAULT, CORSO), 'prezioso.md');
  fs.mkdirSync(path.dirname(fuori), { recursive: true });
  fs.writeFileSync(fuori, 'un appunto che nessuno deve toccare', 'utf-8');

  const cattivo = A.rimuovi(VAULT, CORSO, '../APPUNTI/prezioso.md');
  check('non cancella niente', false, cattivo.tolto);
  check('e lo dice, invece di rispondere «fatto»', true, /id non valido/.test(cattivo.error));
  check('l\'appunto è ancora lì', true, fs.existsSync(fuori));
  check('rinominare con quell\'id si ferma allo stesso modo', true,
    /id non valido/.test(A.rinomina(VAULT, CORSO, '../x', 'y').error));
  check('chiederne gli usi non fa scandire niente', 0, A.usi(VAULT, CORSO, '../x').quanti);
  check('e non ha nessun percorso da mostrare', '', A.percorsoImmagine(VAULT, CORSO, '../APPUNTI/prezioso.md'));

  /* L'indice modificato a mano. ⚠️ La difesa vera non è il controllo sull'id: è
     che il nome del file lo dà l'INDICE, mai chi chiama. Perciò una voce che
     punta fuori dalla cartella va scartata in lettura — altrimenti `rimuovi`
     seguirebbe quel percorso con la coscienza a posto. */
  const indice = JSON.parse(fs.readFileSync(A.percorso(VAULT, CORSO), 'utf-8'));
  indice.voci.push(Object.assign({}, indice.voci[0], { id: 'deadbeef01', file: '../APPUNTI/prezioso.md' }));
  fs.writeFileSync(A.percorso(VAULT, CORSO), JSON.stringify(indice), 'utf-8');
  check('una voce che punta fuori dall\'album non si legge nemmeno', 1, A.elenco(VAULT, CORSO).voci.length);
  check('e quindi non si può cancellare', false, A.rimuovi(VAULT, CORSO, 'deadbeef01').tolto);
  check('l\'appunto è intatto', true, fs.existsSync(fuori));

  check('un corso che è un percorso non esce dal vault', true,
    /corso non valido/.test(A.elenco(VAULT, '../../altrove').error));
  check('e non lo si può nemmeno riempire', true,
    /corso non valido/.test(A.salva(VAULT, 'a/b', ritaglio(), QUANDO).error));
}

sezione('Un file sparito dalla cartella si rifà, con l\'id di prima');
{
  pulisci();
  const r = A.salva(VAULT, CORSO, ritaglio(), QUANDO);
  fs.unlinkSync(path.join(DIR, r.voce.file));
  const di_nuovo = A.salva(VAULT, CORSO, ritaglio(), '2026-08-10T12:00:00.000Z');
  check('il file torna', [r.voce.file], suDisco());
  check('con lo stesso id, così gli appunti che la citano tornano a vederla', r.voce.id, di_nuovo.voce.id);
  check('e con la data di nascita di prima', QUANDO, di_nuovo.voce.creato);
  check('l\'area risulta comunque «già in album»', true, di_nuovo.giaCera);
  check('e l\'album non è cresciuto', 1, A.elenco(VAULT, CORSO).voci.length);
}

sezione('Un indice illeggibile non si spaccia per «album vuoto»');
{
  pulisci();
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(A.percorso(VAULT, CORSO), '{ questo non è json', 'utf-8');
  const e = A.elenco(VAULT, CORSO);
  check('lo dice', 'l\'indice dell\'album non è JSON valido', e.error);
  check('e non inventa immagini', 0, e.voci.length);
  const s = A.salva(VAULT, CORSO, ritaglio(), QUANDO);
  check('e non ci si salva sopra: riscriverlo perderebbe tutte le altre righe', true,
    /non è JSON valido/.test(s.error));
  check('quindi nessuna immagine finisce su disco', [], suDisco());
}

sezione('L\'album viaggia col corso, e chi lo riceve lo sa');
{
  const voci = ['TD/_corso.md', 'TD/01-lez/01-cap.md', 'TD/APPUNTI/nota.md',
    'TD/ALBUM/', 'TD/ALBUM/' + A.INDICE,
    'TD/ALBUM/03 dispensa__p007_a1b2c3d4e5.png', 'TD/ALBUM/03 dispensa__p009_b2c3d4e5f6.png'];
  const info = PAC.esamina(voci);
  check('il pacchetto conta le immagini dell\'album', 2, info.album);
  check('l\'indice non è un\'immagine', 0, PAC.esamina(['TD/_corso.md', 'TD/ALBUM/' + A.INDICE]).album);
  check('l\'album non diventa una lezione', 1, info.lezioni);
  check('e lo dice a parole, come le mappe', true, PAC.descrizione(info).indexOf('2 immagini dell\'album') >= 0);
  check('al singolare quando è una sola', true,
    PAC.descrizione(PAC.esamina(['TD/_corso.md', 'TD/ALBUM/x.png'])).indexOf('1 immagine dell\'album') >= 0);

  check('senza gli appunti l\'album resta a casa', true, PAC.esclusioni('TD', { appunti: false }).includes('TD/ALBUM/*'));
  check('con gli appunti parte', false, PAC.esclusioni('TD', { appunti: true }).some((x) => /ALBUM/.test(x)));
  check('e il comando di esportazione lo esclude davvero', true,
    PAC.comandoEsporta('TD', '/tmp/x.zip', { appunti: false }).args.includes('TD/ALBUM/*'));
  check('le mappe invece non hanno interruttore e partono sempre', false,
    PAC.esclusioni('TD', { appunti: false }).some((x) => /MAPPE/.test(x)));
}

/* ---------------- il ritaglio viene da un PUNTO, e il punto ha due forme -----
   Un documento ha pagine, un video ha secondi. Non è la stessa cosa scritta in
   due modi: una pagina parte da 1 e non ha decimali, un secondo parte da 0 — il
   primo fotogramma — e ne ha. */
sezione('Un ritaglio può venire da un video, e allora il punto è un secondo');
{
  pulisci();
  function fermo(over) {
    return Object.assign({
      materiale: '05 lezione dislessia.mp4',
      t: 132.4,
      rect: { x: 40, y: 30, w: 200, h: 150 },
      dati: dataUrl(png(100, 75))
    }, over || {});
  }
  const r = A.salva(VAULT, CORSO, fermo(), QUANDO);
  check('un fermo immagine si salva', '', r.error);
  check('il secondo si conserva col decimo', 132.4, r.voce.t);
  check('e la pagina non compare: sarebbe un secondo punto inventato', undefined, r.voce.pagina);
  check('il nome del file dice il TEMPO, non una pagina',
    '05 lezione dislessia__t0132_' + r.voce.id + '.png', r.voce.file);
  check('la didascalia di ripiego parla in minuti', '05 lezione dislessia — 2:12', r.voce.didascalia);

  /* ⚠️ Fermare un video due volte non dà mai lo stesso millisecondo: chiedere
     l'uguaglianza esatta darebbe un doppione a ogni ritaglio ripetuto. Mezzo
     secondo è la precisione della mano, come i sei punti sul rettangolo. */
  const q = A.salva(VAULT, CORSO, fermo({ t: 132.7 }), QUANDO);
  check('lo stesso fermo a un decimo di distanza è lo STESSO ritaglio', true, q.giaCera);
  check('e non ha creato un secondo file', 1, suDisco().length);
  const lontano = A.salva(VAULT, CORSO, fermo({ t: 140 }), QUANDO);
  check('otto secondi più in là è un altro ritaglio', false, lontano.giaCera);

  /* Il tipo del punto entra nell'identità: senza, la pagina 12 di un PDF e il
     secondo 12 di un video darebbero lo stesso id per due immagini diverse. */
  pulisci();
  const a = A.salva(VAULT, CORSO, { materiale: 'x.pdf', pagina: 12,
    rect: { x: 10, y: 10, w: 50, h: 50 }, dati: dataUrl(png(10, 10)) }, QUANDO);
  const b = A.salva(VAULT, CORSO, { materiale: 'x.pdf', t: 12,
    rect: { x: 10, y: 10, w: 50, h: 50 }, dati: dataUrl(png(10, 10)) }, QUANDO);
  check('pagina 12 e secondo 12 non sono la stessa immagine', false, a.voce.id === b.voce.id);
  check('e nemmeno lo stesso file', false, a.voce.file === b.voce.file);

  /* Senza né pagina né secondo non si sa da dove viene: non è un ritaglio. */
  pulisci();
  const senza = A.salva(VAULT, CORSO, { materiale: 'x.pdf',
    rect: { x: 1, y: 1, w: 9, h: 9 }, dati: dataUrl(png(9, 9)) }, QUANDO);
  check('un ritaglio senza punto viene rifiutato', true, /da quale/.test(senza.error));
  check('il secondo 0 invece è legittimo: è il primo fotogramma', '',
    A.salva(VAULT, CORSO, { materiale: 'v.mp4', t: 0,
      rect: { x: 1, y: 1, w: 9, h: 9 }, dati: dataUrl(png(9, 9)) }, QUANDO).error);
  check('mentre la pagina 0 no: nessun documento comincia da lì', true,
    /da quale/.test(A.salva(VAULT, CORSO, { materiale: 'x.pdf', pagina: 0,
      rect: { x: 1, y: 1, w: 9, h: 9 }, dati: dataUrl(png(9, 9)) }, QUANDO).error));
}

sezione('Le FOTO: stesso archivio, altra provenienza');
{
  pulisci();
  const byte = png(200, 150);
  const foto = { origine: 'foto', materiale: 'Gita al lago.jpg', dati: dataUrl(byte) };
  const r = A.salva(VAULT, CORSO, foto, QUANDO);
  check('una foto entra senza pagina e senza rettangolo', '', r.error);
  check('e si dichiara per quello che è', 'foto', r.voce.origine);
  /* ⚠️ L'identità di una foto sono i BYTE: è la sola cosa che è davvero lei. */
  check('l\'id è l\'impronta dei byte', A.identitaByte(byte), r.voce.id);
  check('il nome del file la distingue nel Finder', 'foto Gita al lago_' + r.voce.id + '.png', r.voce.file);
  check('la didascalia di partenza è il nome del file', 'Gita al lago', r.voce.didascalia);
  check('le misure sono lette dall\'immagine', [200, 150], [r.voce.w, r.voce.h]);

  /* Lo STESSO file trascinato di nuovo, con un altro nome: è la stessa foto. */
  const ancora = A.salva(VAULT, CORSO, { origine: 'foto', materiale: 'copia (1).jpg', dati: dataUrl(byte) }, QUANDO);
  check('la stessa immagine due volte non fa due voci', true, ancora.giaCera);
  check('e resta il nome della prima', 'Gita al lago', ancora.voce.didascalia);
  check('sul disco c\'è un file solo', 1, suDisco().length);

  /* Un'immagine diversa invece è un'altra voce, anche con lo stesso nome. */
  const altra = A.salva(VAULT, CORSO, { origine: 'foto', materiale: 'Gita al lago.jpg', dati: dataUrl(png(40, 40)) }, QUANDO);
  check('un\'immagine diversa è un\'altra voce', false, altra.voce.id === r.voce.id);

  /* Senza il nome del file non si sa nemmeno come chiamarla. */
  check('una foto senza provenienza viene rifiutata', true,
    /da quale file/.test(A.salva(VAULT, CORSO, { origine: 'foto', dati: dataUrl(png(10, 10)) }, QUANDO).error));

  /* Le due viste dell'app sono due filtri sullo STESSO indice. */
  A.salva(VAULT, CORSO, ritaglio(), QUANDO);
  check('l\'archivio le tiene tutte insieme', 3, A.elenco(VAULT, CORSO).voci.length);
  check('«Album Foto» ne vede due', 2, A.elenco(VAULT, CORSO, 'foto').voci.length);
  check('«Ritagli» ne vede uno', 1, A.elenco(VAULT, CORSO, 'ritaglio').voci.length);
  check('e un filtro inventato non nasconde niente', 3, A.elenco(VAULT, CORSO, 'chissà').voci.length);
  /* ⚠️ Il campo nuovo deve TORNARE INDIETRO DAL DISCO, non solo esistere in
     memoria: è la trappola delle liste bianche, pagata su appunti e mappe. */
  /* I ritagli davanti, le foto dopo: due popolazioni con due criteri di
     ricerca — un ritaglio si cerca per «da dove viene», una foto per nome. */
  check('e l\'origine sopravvive alla riscrittura dell\'indice', ['ritaglio', 'foto', 'foto'],
    A.elenco(VAULT, CORSO).voci.map((v) => v.origine));
}

sezione('La miniatura di una foto: un francobollo, e se manca non è un guasto');
{
  pulisci();
  const r = A.salva(VAULT, CORSO, { origine: 'foto', materiale: 'grande.jpg',
    dati: dataUrl(png(300, 200)), mini: dataUrl(png(48, 32)) }, QUANDO);
  check('la voce dice dove sta la sua miniatura', A.MINI + '/' + r.voce.id + '.png', r.voce.mini);
  check('e il file c\'è', true, fs.existsSync(path.join(DIR, r.voce.mini)));
  check('con dentro i byte del francobollo, non della foto', true,
    fs.readFileSync(path.join(DIR, r.voce.mini)).equals(png(48, 32)));
  check('la miniatura torna indietro dal disco', A.MINI + '/' + r.voce.id + '.png',
    A.elenco(VAULT, CORSO, 'foto').voci[0].mini);

  /* Una miniatura storta non deve impedire alla foto di entrare: chi disegna sa
     ripiegare sull'immagine vera, ma una foto persa è persa. */
  const senza = A.salva(VAULT, CORSO, { origine: 'foto', materiale: 'altra.jpg',
    dati: dataUrl(png(30, 30)), mini: 'data:image/png;base64,questo-non-è-base64' }, QUANDO);
  check('una miniatura illeggibile non fa perdere la foto', '', senza.error);
  check('semplicemente la voce non ne dichiara una', undefined, senza.voce.mini);

  /* E cancellando la foto se ne va anche il francobollo: un file orfano non si
     vede, non dà errore, e resta nel vault per sempre. */
  const tolto = A.rimuovi(VAULT, CORSO, r.voce.id);
  check('la foto si toglie', true, tolto.tolto);
  check('e la sua miniatura con lei', false, fs.existsSync(path.join(DIR, A.MINI, r.voce.id + '.png')));
}

sezione('La GIF entra com\'è: passarla da un canvas la ridurrebbe a un fotogramma');
{
  pulisci();
  /* Una GIF89a minima: firma più abbastanza byte da non sembrare troncata. */
  const gif = Buffer.concat([Buffer.from('GIF89a', 'ascii'), Buffer.alloc(20, 7)]);
  const r = A.salva(VAULT, CORSO, { origine: 'foto', materiale: 'ciclo.gif',
    dati: 'data:image/gif;base64,' + gif.toString('base64') }, QUANDO);
  check('una GIF è un formato accettato', '', r.error);
  check('e il file finisce con .gif', true, /\.gif$/.test(r.voce.file));
  check('coi byte intatti', true, fs.readFileSync(path.join(DIR, r.voce.file)).equals(gif));
  /* ⚠️ E una firma che non è una GIF non entra dichiarandosi tale: `firmaOk`
     guarda i byte, non il `data:image/gif` scritto davanti. */
  check('un finto GIF non passa', true,
    /non sono un\'immagine/.test(A.salva(VAULT, CORSO, { origine: 'foto', materiale: 'finto.gif',
      dati: 'data:image/gif;base64,' + Buffer.from('non una gif').toString('base64') }, QUANDO).error));
}

/* --------------------------------------------------------------------------
   `cestina` iniettata: l'immagine va nel Cestino, non nel nulla.

   Il patto di `fonti.elimina` portato sull'album: chi passa `cestina`
   (nell'app è `shell.trashItem`) ottiene una Promise, e nel Cestino finiscono
   l'immagine E la sua miniatura; chi non la passa, la cancellazione sincrona
   delle sezioni sopra.

   ⚠️ Da qui in poi la prova è asincrona: il `return` interrompe il modulo, e
   la pulizia e il conto finale vivono in fondo alla catena. Chi aggiunge
   sezioni sincrone le metta PRIMA di questa. */
sezione('`cestina` iniettata: l\'immagine va nel Cestino, non nel nulla');
{
  pulisci();
  const CESTINO = path.join(VAULT, '_cestino-finto');
  fs.mkdirSync(CESTINO, { recursive: true });
  const cestinati = [];
  const cestina = (p) => { cestinati.push(path.basename(p)); fs.renameSync(p, path.join(CESTINO, path.basename(p))); };

  const r = A.salva(VAULT, CORSO, ritaglio(), QUANDO);
  const voce = r.voce;
  return Promise.resolve(A.rimuovi(VAULT, CORSO, voce.id, { cestina })).then((t) => {
    check('con `cestina` si toglie', [true, ''], [t.tolto, t.error]);
    check('l\'immagine è nel cestino', true, cestinati.indexOf(voce.file) >= 0);
    check('e la miniatura con lei', true, !voce.mini || cestinati.indexOf(path.basename(voce.mini)) >= 0);
    check('l\'indice non la elenca più', 0, A.elenco(VAULT, CORSO).voci.length);
    check('e in ALBUM/ non resta niente', [], suDisco());

    /* Un Cestino che rifiuta non è «fatto»: l'errore si dice e l'indice non si
       tocca — un indice ripulito con il file ancora lì sarebbe la riga vuota
       al contrario. */
    const r2 = A.salva(VAULT, CORSO, ritaglio({ pagina: 5 }), QUANDO);
    return Promise.resolve(A.rimuovi(VAULT, CORSO, r2.voce.id, {
      cestina: () => Promise.reject(new Error('il Cestino ha detto no'))
    })).then((t2) => {
      check('se il Cestino rifiuta, non è tolto', false, t2.tolto);
      check('e l\'errore lo dice', 'il Cestino ha detto no', t2.error);
      check('l\'indice la elenca ancora', 1, A.elenco(VAULT, CORSO).voci.length);
      check('e il file è ancora lì', true, fs.existsSync(path.join(DIR, r2.voce.file)));

      /* Il file già sparito dal Finder: l'indice va ripulito lo stesso, e
         `cestina` non si chiama su un file che non c'è. */
      fs.unlinkSync(path.join(DIR, r2.voce.file));
      if (r2.voce.mini) { try { fs.unlinkSync(path.join(DIR, r2.voce.mini)); } catch (e) {} }
      const prima = cestinati.length;
      return Promise.resolve(A.rimuovi(VAULT, CORSO, r2.voce.id, { cestina })).then((t3) => {
        check('un file già sparito si toglie dall\'indice lo stesso', [true, ''], [t3.tolto, t3.error]);
        check('senza chiamare `cestina` a vuoto', prima, cestinati.length);
        check('e l\'indice è vuoto', 0, A.elenco(VAULT, CORSO).voci.length);

        try { fs.rmSync(VAULT, { recursive: true, force: true }); } catch (e) { /* la cartella era temporanea */ }
        console.log('\n' + (ko ? '✗ ' + ko + ' controlli falliti' : '✓ tutti i controlli passati') + ' (' + ok + ' ok)');
        process.exit(ko ? 1 : 0);
      });
    });
  });
}
