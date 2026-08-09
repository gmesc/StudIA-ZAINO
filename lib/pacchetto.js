'use strict';
/**
 * pacchetto — un corso che diventa un file solo, e torna indietro.
 *
 * Serve a una cosa concreta: un docente prepara un corso e lo passa agli
 * allievi. Il pacchetto deve bastare da solo — capitoli, appunti se li si vuole
 * dare, video, PDF, pagine salvate, trascrizioni e indici — perché chi lo riceve
 * non ha il vault di chi lo ha fatto.
 *
 * Che cosa NON entra:
 *  - `_lavorazione/` — piano, schede, marcatore di protezione: roba della
 *    pipeline di chi ha costruito il corso, si rigenera, e il marcatore lo
 *    renderebbe di sola lettura a casa di chi lo riceve;
 *  - `APPUNTI/` quando l'autore sceglie di non darli: sono note personali;
 *  - i `.DS_Store` del Finder.
 *
 * `MAPPE/` invece entra SEMPRE, e non ha una casella per escluderla: una mappa
 * è lavoro che non si rigenera — la vista generata sì, la copia che l'utente ha
 * modificato no — e un'esportazione che la perde non lo dice a nessuno. Il
 * silenzio è il guasto che in StudIA è già costato caro; qui si paga
 * qualche kilobyte per non ripeterlo.
 *
 * Le funzioni qui dentro non eseguono niente: preparano comandi e verificano
 * elenchi, così si provano senza toccare il disco. L'esecuzione sta in main.js.
 */

const path = require('path');
const mappe = require('./mappe');   // il nome della cartella si dichiara in un posto solo

/** Estensione del pacchetto: si riconosce a occhio ed è uno zip normale. */
const EXT = '.studia.zip';

/** Nome file proposto per un corso. */
function nomeFile(id) { return String(id || 'corso').replace(/[/\\:]/g, '-') + EXT; }

/**
 * I formati già compressi non si ricomprimono: su 10 GB di video significa
 * minuti risparmiati e nessun byte guadagnato.
 */
const GIA_COMPRESSI = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'mpeg', 'mpg',
  'm4a', 'mp3', 'aac', 'flac', 'ogg', 'opus', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'zip'];

/**
 * I percorsi da lasciare fuori, in forma di pattern per `zip -x`.
 * `MAPPE/` non compare e non deve comparire: vedi la nota in testa al file.
 */
function esclusioni(id, opts) {
  const o = opts || {};
  const fuori = [id + '/_lavorazione/*', id + '/_lavorazione', '*/.DS_Store', '.DS_Store'];
  if (!o.appunti) fuori.push(id + '/APPUNTI/*', id + '/APPUNTI');
  return fuori;
}

/**
 * Comando per costruire il pacchetto. Gira con `cwd` = cartella `Corsi/`,
 * così dentro lo zip il primo livello è la cartella del corso e chi lo apre
 * si ritrova `TD74-DSA/` e non un mucchio di file.
 */
function comandoEsporta(id, destZip, opts) {
  const args = ['-r', '-y', '-n', GIA_COMPRESSI.join(':'), destZip, id, '-x'].concat(esclusioni(id, opts));
  return { cmd: 'zip', args };
}

/** Comando per leggere l'indice di un pacchetto senza estrarlo. */
function comandoElenca(zip) { return { cmd: 'unzip', args: ['-Z1', zip] }; }

/** Comando per estrarre un pacchetto dentro `dove`. */
function comandoEstrai(zip, dove) { return { cmd: 'unzip', args: ['-q', '-o', zip, '-d', dove] }; }

/**
 * Che cosa contiene il pacchetto: l'id del corso (la cartella al primo
 * livello) e un motivo, se non è un pacchetto StudIA valido.
 */
function esamina(righe) {
  const voci = (righe || []).map((r) => String(r).trim()).filter(Boolean);
  if (!voci.length) return { ok: false, motivo: 'il file è vuoto o non è uno zip leggibile' };
  const radici = new Set(voci.map((v) => v.split('/')[0]).filter(Boolean));
  if (radici.size !== 1) {
    return { ok: false, motivo: 'dentro non c\'è un corso solo, ma ' + radici.size + ' cartelle di primo livello' };
  }
  const id = [...radici][0];
  if (!voci.includes(id + '/_corso.md')) {
    return { ok: false, motivo: 'manca ' + id + '/_corso.md: non sembra un corso StudIA' };
  }
  const conta = (pre) => voci.filter((v) => v.startsWith(id + '/MATERIALI/' + pre + '/') && !v.endsWith('/')).length;
  const lezioni = new Set(voci
    .map((v) => v.split('/'))
    .filter((p) => p.length > 2 && /\.md$/.test(p[p.length - 1]) && !p[1].startsWith('_') &&
                   !['APPUNTI', 'MATERIALI', mappe.CARTELLA].includes(p[1]))
    .map((p) => p[1]));
  return {
    ok: true, id, lezioni: lezioni.size,
    video: conta('Video'), audio: conta('Audio'), pdf: conta('PDF'), web: conta('Web'),
    trascrizioni: conta('Trascrizioni'),
    appunti: voci.some((v) => v.startsWith(id + '/APPUNTI/') && v.endsWith('.md')),
    /* Contate e dette: chi importa deve poter verificare che le mappe siano
       arrivate. Una cosa che nessuno nomina è una cosa che si perde senza che
       nessuno se ne accorga. */
    mappe: voci.filter((v) => v.startsWith(id + '/' + mappe.CARTELLA + '/') && v.toLowerCase().endsWith(mappe.EXT)).length
  };
}

/** Un id libero: se «TD74-DSA» esiste già si prova «TD74-DSA-2», e via così. */
function idLibero(id, esiste) {
  if (!esiste(id)) return id;
  for (let i = 2; i < 100; i++) { const c = id + '-' + i; if (!esiste(c)) return c; }
  return id + '-' + Date.now();
}

/** Riassunto in italiano di che cosa si sta per importare. */
function descrizione(info) {
  if (!info || !info.ok) return '';
  const pezzi = [];
  if (info.lezioni) pezzi.push(info.lezioni + (info.lezioni === 1 ? ' lezione' : ' lezioni'));
  if (info.video) pezzi.push(info.video + ' video');
  if (info.audio) pezzi.push(info.audio + ' audio');
  if (info.pdf) pezzi.push(info.pdf + ' PDF');
  if (info.web) pezzi.push(info.web + ' pagine web');
  if (info.mappe) pezzi.push(info.mappe + (info.mappe === 1 ? ' mappa' : ' mappe'));
  if (info.appunti) pezzi.push('gli appunti dell\'autore');
  return pezzi.join(' · ');
}

module.exports = { EXT, GIA_COMPRESSI, MAPPE: mappe.CARTELLA, nomeFile, esclusioni, comandoEsporta,
  comandoElenca, comandoEstrai, esamina, idLibero, descrizione, path };
