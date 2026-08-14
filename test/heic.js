/* La conversione delle foto dell'iPhone.
 *
 * ⚠️ Che cosa si può provare qui e che cosa no. Un HEIC vero non si può
 * fabbricare senza un codificatore, quindi la conversione VERA la si prova con
 * un'immagine che `sips` sa leggere comunque (un PNG scritto qui sopra): la
 * domanda a cui questa prova risponde è «la strada funziona — comando,
 * temporaneo, data URL, pulizia», non «sips sa leggere l'HEIC», che è una
 * garanzia del sistema.
 *
 * L'altra metà — che cosa succede quando la conversione fallisce — è quella che
 * conta di più, perché è il caso in cui l'utente deve capire qualcosa invece di
 * ritrovarsi un riquadro bianco.
 *
 *   node test/heic.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const H = require('../lib/heic.js');

let ko = 0;
function ok(nome, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + nome); return; }
  ko++; console.log('  KO  ' + nome + '\n      atteso ' + a + '\n      avuto  ' + b);
}
function sezione(t) { console.log('\n== ' + t); }

sezione('Quando qualcosa non va, si dice — non si torna un\'immagine vuota');
ok('senza file, un errore', true, !!H.converti('').error);
ok('e i dati restano vuoti', '', H.converti('').dati);
const inesistente = H.converti(path.join(os.tmpdir(), 'questo-file-non-esiste-mai.heic'));
ok('un file che non c\'è lo dice', true, /non leggibile/.test(inesistente.error));
ok('senza sollevare', '', inesistente.dati);

sezione('La spiegazione per chi non è su un Mac sta in un posto solo');
ok('il messaggio nomina sips e dice che fare', true,
  /sips/.test(H.SENZA_SIPS) && /JPEG/.test(H.SENZA_SIPS));

sezione('La conversione vera');
if (!H.disponibile()) {
  console.log('  -- sips non c\'è su questa macchina: salto (ed è il caso che il messaggio sopra racconta)');
} else {
  /* Un PNG minimo, scritto qui: 1×1 pixel. Serve solo come cosa da convertire. */
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');
  const src = path.join(os.tmpdir(), 'studia-prova-heic-' + Date.now() + '.png');
  fs.writeFileSync(src, png);
  const primaTmp = fs.readdirSync(os.tmpdir()).filter((n) => n.indexOf('studia-heic-') === 0).length;

  const r = H.converti(src);
  ok('non c\'è errore', '', r.error);
  ok('e torna un data URL JPEG', true, /^data:image\/jpeg;base64,/.test(r.dati));
  /* I byte devono essere un JPEG VERO, non una stringa che ci somiglia: se
     `sips` fallisse a metà, un data URL con dentro spazzatura passerebbe questo
     controllo solo se non lo si guardasse. */
  const buf = Buffer.from(r.dati.split(',')[1], 'base64');
  ok('con la firma di un JPEG', true, buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff);
  ok('e non è vuoto', true, buf.length > 100);

  /* ⚠️ Il file di passaggio non deve restare in giro: uno per foto importata,
     e in una cartella che nessuno guarda mai. */
  const dopoTmp = fs.readdirSync(os.tmpdir()).filter((n) => n.indexOf('studia-heic-') === 0).length;
  ok('il temporaneo è stato cancellato', primaTmp, dopoTmp);

  fs.unlinkSync(src);

  /* E un file che NON è un'immagine: `sips` esce con un errore, e quell'errore
     deve arrivare all'utente invece di diventare un'immagine vuota. */
  const finto = path.join(os.tmpdir(), 'studia-prova-heic-' + Date.now() + '.heic');
  fs.writeFileSync(finto, 'questo non è un\'immagine');
  const male = H.converti(finto);
  ok('un file storto non produce un\'immagine', '', male.dati);
  ok('e l\'errore riporta quello che ha detto sips', true, /sips:/.test(male.error));
  console.log('   ' + male.error);
  fs.unlinkSync(finto);
}

console.log(ko ? `\n✗ ${ko} controlli falliti` : `\n✓ tutti i controlli passati`);
process.exit(ko ? 1 : 0);
