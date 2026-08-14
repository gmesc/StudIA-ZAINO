/* Che cosa entra nell'album delle foto, e con che misure.
 *
 * ⚠️ Il controllo che vale più di tutti: il formato si legge dai BYTE. Un `.png`
 * che dentro è un JPEG è un file normale — basta rinominarlo — e crederci vuol
 * dire scrivere nel vault un'immagine la cui estensione mente, cioè un file che
 * un giorno non si apre e nessuno sa perché.
 *
 *   node test/foto.js
 */
const F = require('../App/assets/album/foto.js');

let ko = 0;
function ok(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + nome); return; }
  ko++; console.log('  KO  ' + nome + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

/* Le firme vere dei formati, come le scriverebbe chi salva l'immagine. */
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const JPG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1];
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 10, 0, 10, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 40, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const HEIC = [0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63];  // ....ftypheic

sezione('Il formato lo dicono i byte');
ok('PNG', { ext: '.png', mime: 'image/png' }, F.tipoDaiByte(PNG));
ok('JPEG', { ext: '.jpg', mime: 'image/jpeg' }, F.tipoDaiByte(JPG));
ok('GIF', { ext: '.gif', mime: 'image/gif' }, F.tipoDaiByte(GIF));
ok('WebP', { ext: '.webp', mime: 'image/webp' }, F.tipoDaiByte(WEBP));
/* ⚠️ Il RIFF da solo non basta: un WAV comincia allo stesso modo, e senza il
   secondo controllo un file audio entrerebbe nell'album come immagine. */
const WAV = [0x52, 0x49, 0x46, 0x46, 40, 0, 0, 0, 0x57, 0x41, 0x56, 0x45];
ok('un WAV non è una WebP, benché cominci uguale', null, F.tipoDaiByte(WAV));
ok('HEIC si riconosce dopo la lunghezza del box', 'heic', F.tipoDaiByte(HEIC));
ok('del testo non è niente', null, F.tipoDaiByte([0x43, 0x69, 0x61, 0x6f]));
ok('e nemmeno il vuoto', null, F.tipoDaiByte([]));

sezione('Il nome è solo un\'ipotesi, e serve a dire di NO');
ok('.jpeg e .jpg sono la stessa cosa', { ext: '.jpg', mime: 'image/jpeg' }, F.tipoDalNome('gita.JPEG'));
ok('.heif è heic', 'heic', F.tipoDalNome('IMG_0042.heif'));
ok('.txt non è un\'immagine', null, F.tipoDalNome('appunti.txt'));
ok('nemmeno senza estensione', null, F.tipoDalNome('Makefile'));
/* E quando i due si contraddicono, comanda il contenuto: è la ragione per cui
   `tipoDaiByte` esiste separata. */
ok('un JPEG chiamato .png resta un JPEG', { ext: '.jpg', mime: 'image/jpeg' }, F.tipoDaiByte(JPG));

sezione('Il tetto delle misure non ingrandisce mai');
ok('sotto il tetto non si tocca niente', { w: 800, h: 600, ridotta: false }, F.misure(800, 600, 3000));
ok('sopra si riduce tenendo le proporzioni', { w: 3000, h: 2250, ridotta: true }, F.misure(4000, 3000, 3000));
ok('e vale anche in verticale', { w: 2250, h: 3000, ridotta: true }, F.misure(3000, 4000, 3000));
ok('un\'immagine minuscola resta minuscola', { w: 10, h: 4, ridotta: false }, F.misure(10, 4, 3000));
ok('misure assurde non producono NaN', { w: 0, h: 0, ridotta: false }, F.misure(0, -5, 3000));

sezione('⚠️ Che cosa passa dal canvas, e che cosa no');
/* Un JPEG porta l'orientamento nei metadati: va ricodificato o un ritaglio
   fatto dopo prenderebbe l'area ruotata. */
ok('un JPEG si ricodifica sempre', true, F.daRicodificare({ ext: '.jpg' }, 800, 600));
/* Una GIF NO: dal canvas tornerebbe un fotogramma solo. */
ok('una GIF animata non si tocca mai', false, F.daRicodificare({ ext: '.gif' }, 4000, 3000));
ok('un PNG piccolo si copia com\'è', false, F.daRicodificare({ ext: '.png' }, 800, 600));
ok('ma un PNG enorme si riduce', true, F.daRicodificare({ ext: '.png' }, 5000, 4000));
ok('l\'HEIC passa sempre di lì', true, F.daRicodificare('heic', 100, 100));

sezione('La didascalia di partenza');
ok('è il nome del file senza estensione', 'Gita al lago', F.didascaliaDa('Gita al lago.HEIC'));
ok('senza la cartella', 'IMG_0042', F.didascaliaDa('/Users/x/Foto/IMG_0042.jpg'));
ok('e un nome vuoto non lascia una riga muta', 'immagine', F.didascaliaDa(''));

sezione('Chi non entra lo sa, e sa perché');
const r = F.accetta([
  { nome: 'a.png', dimensione: 1000 },
  { nome: 'note.txt', dimensione: 20 },
  { nome: 'enorme.jpg', dimensione: 40 * 1024 * 1024 },
  { nome: 'vuota.png', dimensione: 0 },
  { nome: 'b.HEIC', dimensione: 3 * 1024 * 1024 }
]);
ok('entrano le immagini vere', ['a.png', 'b.HEIC'], r.buone.map((x) => x.nome));
ok('e le altre sono tre', 3, r.scartate.length);
ok('il testo dice che non è un\'immagine', 'non è un\'immagine',
  r.scartate.find((x) => x.nome === 'note.txt').motivo);
/* ⚠️ Il motivo dice il PESO VERO e il limite: «troppo grande» non insegna
   niente a chi deve decidere che cosa farne. */
ok('il file grosso dice quanto pesa e qual è il limite', '40 MB, il limite è 15 MB',
  r.scartate.find((x) => x.nome === 'enorme.jpg').motivo.replace('pesa ', ''));
ok('e il file vuoto lo dice', 'il file è vuoto',
  r.scartate.find((x) => x.nome === 'vuota.png').motivo);
ok('il tetto si può stringere', 1,
  F.accetta([{ nome: 'a.png', dimensione: 5000 }], 1000).scartate.length);

sezione('I pesi si scrivono come li legge una persona');
ok('sotto il mega, in KB', '500 KB', F.mega(512000));
ok('sopra, in MB con la virgola', '1,5 MB', F.mega(1024 * 1024 * 1.5));
ok('e 15 MB tondi', '15 MB', F.mega(F.MAX_BYTE));

console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
process.exit(ko ? 1 : 0);
