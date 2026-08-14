'use strict';
/**
 * heic — le foto dell'iPhone, tradotte in un formato che il browser sa disegnare.
 *
 * ⚠️ PERCHÉ ESISTE QUESTO FILE. Chromium **non decodifica l'HEIC**: un
 * `<img src="…​.heic">` resta bianco, e non solleva niente — quindi senza questo
 * passaggio le foto dell'iPhone entrerebbero nell'album come riquadri vuoti,
 * che è il modo peggiore di fallire (la trappola ④: si perde in silenzio).
 *
 * ⚠️ E PERCHÉ NON UNA LIBRERIA. Un decodificatore HEIC in npm porta con sé un
 * binario nativo o un wasm da qualche mega, da ricompilare a ogni versione di
 * Electron e da firmare nel pacchetto. `sips` è in dotazione a macOS
 * (`/usr/bin/sips`), non si aggiorna e non si firma. Il prezzo è dichiarato:
 * **questa strada è solo macOS**. Su un altro sistema `disponibile()` dice di
 * no e l'import lo racconta all'utente invece di lasciargli un buco.
 *
 * Il modulo non lancia mai: torna `{ dati, error }` come tutto il resto di
 * `lib/`, perché un'importazione che va male deve poterlo dire.
 *
 *   node test/heic.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const SIPS = '/usr/bin/sips';
/* Trenta secondi: `sips` su una foto da dodici megapixel ne impiega meno di
   uno, e un tempo così largo serve solo a non lasciare l'app appesa per sempre
   se il processo si pianta. */
const TEMPO_MAX = 30000;

/** C'è `sips` su questa macchina? Si guarda il file, non il sistema operativo:
 *  la domanda vera è «posso convertire», non «sono su un Mac». */
function disponibile() {
  try { return fs.existsSync(SIPS); } catch (e) { return false; }
}

/** Il messaggio da mostrare quando non c'è. Sta qui e non in chi chiama perché
 *  lo dicono in due — l'import e la diagnostica — e due copie della stessa
 *  spiegazione divergono al primo ripensamento. */
const SENZA_SIPS = 'le foto HEIC si convertono con «sips», che c\'è solo su macOS: ' +
  'esportale in JPEG prima di portarle dentro';

/**
 * Converte un file HEIC in JPEG. `{ dati, error }`, dove `dati` è un data URL —
 * la stessa forma che `album.salva` accetta già dal renderer, così non nasce una
 * seconda strada per portare un'immagine dentro l'archivio.
 *
 * ⚠️ Il file temporaneo si scrive nella cartella temporanea del SISTEMA, non nel
 * vault: un `.jpg` di passaggio dentro `ALBUM/` che rimanesse lì dopo un
 * errore diventerebbe un file che l'indice non conosce e nessuno cancella mai.
 * E si cancella sempre, anche quando la conversione fallisce.
 */
function converti(percorso, opt) {
  const o = opt || {};
  const src = String(percorso || '');
  if (!src) return { dati: '', error: 'nessun file da convertire' };
  if (!disponibile()) return { dati: '', error: SENZA_SIPS };
  try { if (!fs.statSync(src).isFile()) return { dati: '', error: 'non è un file: ' + src }; }
  catch (e) { return { dati: '', error: 'file non leggibile: ' + (e.message || src) }; }

  const fuori = path.join(os.tmpdir(), 'studia-heic-' + crypto.randomBytes(6).toString('hex') + '.jpg');
  let r;
  try {
    /* `-s format jpeg` è la conversione; `--out` il file di destinazione.
       ⚠️ Gli argomenti si passano come ARRAY, mai come stringa da far
       interpretare a una shell: un nome di file con uno spazio o un apice
       diventerebbe due argomenti, o peggio un comando. */
    r = spawnSync(SIPS, ['-s', 'format', 'jpeg', src, '--out', fuori],
      { timeout: Number(o.tempoMax) || TEMPO_MAX, encoding: 'utf-8' });
  } catch (e) {
    return { dati: '', error: 'conversione non riuscita: ' + (e.message || 'sips') };
  }

  const pulisci = () => { try { fs.unlinkSync(fuori); } catch (e) { /* passi */ } };

  if (r.error) { pulisci(); return { dati: '', error: 'conversione non riuscita: ' + (r.error.message || 'sips') }; }
  if (r.status !== 0) {
    pulisci();
    /* Il messaggio di `sips` è in inglese ma è preciso («Error 4: no decoder
       available»): si riporta invece di sostituirlo con un nostro «non è
       riuscito», che non aiuterebbe nessuno a capire. */
    const detto = String(r.stderr || r.stdout || '').split('\n').filter(Boolean).pop() || ('uscito con ' + r.status);
    return { dati: '', error: 'sips: ' + detto };
  }

  let buf;
  try { buf = fs.readFileSync(fuori); }
  catch (e) { pulisci(); return { dati: '', error: 'il file convertito non si è potuto leggere' }; }
  pulisci();
  if (!buf.length) return { dati: '', error: 'la conversione ha prodotto un file vuoto' };

  return { dati: 'data:image/jpeg;base64,' + buf.toString('base64'), error: '' };
}

module.exports = { SIPS, SENZA_SIPS, disponibile, converti };
