'use strict';
/**
 * pacchetto — un progetto che diventa un file solo, e torna indietro.
 *
 * Serve a una cosa concreta: un docente prepara un corso e lo passa agli
 * allievi. Il pacchetto deve bastare da solo — capitoli, appunti se li si vuole
 * dare, video, PDF, pagine salvate, trascrizioni e indici — perché chi lo riceve
 * non ha il vault di chi lo ha fatto.
 *
 * Che cosa NON entra:
 *  - `_lavorazione/` — piano, schede, marcatore di protezione: roba della
 *    pipeline di chi ha costruito il corso, si rigenera, e il marcatore
 *    renderebbe il progetto di sola lettura a casa di chi lo riceve;
 *  - `APPUNTI/` quando l'autore sceglie di non darli: sono note personali;
 *  - i `.DS_Store` del Finder.
 *
 * Le funzioni qui dentro non eseguono niente: preparano comandi e verificano
 * elenchi, così si provano senza toccare il disco. L'esecuzione sta in main.js.
 */

const path = require('path');

/** Estensione del pacchetto: si riconosce a occhio ed è uno zip normale. */
const EXT = '.studia.zip';

/** Nome file proposto per un progetto. */
function nomeFile(id) { return String(id || 'progetto').replace(/[/\\:]/g, '-') + EXT; }

/**
 * I formati già compressi non si ricomprimono: su 10 GB di video significa
 * minuti risparmiati e nessun byte guadagnato.
 */
const GIA_COMPRESSI = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'mpeg', 'mpg',
  'm4a', 'mp3', 'aac', 'flac', 'ogg', 'opus', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'zip'];

/** I percorsi da lasciare fuori, in forma di pattern per `zip -x`. */
function esclusioni(id, opts) {
  const o = opts || {};
  const fuori = [id + '/_lavorazione/*', id + '/_lavorazione', '*/.DS_Store', '.DS_Store'];
  if (!o.appunti) fuori.push(id + '/APPUNTI/*', id + '/APPUNTI');
  return fuori;
}

/**
 * Comando per costruire il pacchetto. Gira con `cwd` = cartella `Progetti/`,
 * così dentro lo zip il primo livello è la cartella del progetto e chi lo apre
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
 * Che cosa contiene il pacchetto: l'id del progetto (la cartella al primo
 * livello) e un motivo, se non è un pacchetto StudIA valido.
 */
function esamina(righe) {
  const voci = (righe || []).map((r) => String(r).trim()).filter(Boolean);
  if (!voci.length) return { ok: false, motivo: 'il file è vuoto o non è uno zip leggibile' };
  const radici = new Set(voci.map((v) => v.split('/')[0]).filter(Boolean));
  if (radici.size !== 1) {
    return { ok: false, motivo: 'dentro non c\'è un progetto solo, ma ' + radici.size + ' cartelle di primo livello' };
  }
  const id = [...radici][0];
  if (!voci.includes(id + '/_progetto.md')) {
    return { ok: false, motivo: 'manca ' + id + '/_progetto.md: non sembra un progetto StudIA' };
  }
  const conta = (pre) => voci.filter((v) => v.startsWith(id + '/MATERIALI/' + pre + '/') && !v.endsWith('/')).length;
  const corsi = new Set(voci
    .map((v) => v.split('/'))
    .filter((p) => p.length > 2 && /\.md$/.test(p[p.length - 1]) && !p[1].startsWith('_') &&
                   !['APPUNTI', 'MATERIALI'].includes(p[1]))
    .map((p) => p[1]));
  return {
    ok: true, id, corsi: corsi.size,
    video: conta('Video'), audio: conta('Audio'), pdf: conta('PDF'), web: conta('Web'),
    trascrizioni: conta('Trascrizioni'),
    appunti: voci.some((v) => v.startsWith(id + '/APPUNTI/') && v.endsWith('.md'))
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
  if (info.corsi) pezzi.push(info.corsi + (info.corsi === 1 ? ' corso' : ' corsi'));
  if (info.video) pezzi.push(info.video + ' video');
  if (info.audio) pezzi.push(info.audio + ' audio');
  if (info.pdf) pezzi.push(info.pdf + ' PDF');
  if (info.web) pezzi.push(info.web + ' pagine web');
  if (info.appunti) pezzi.push('gli appunti dell\'autore');
  return pezzi.join(' · ');
}

module.exports = { EXT, GIA_COMPRESSI, nomeFile, esclusioni, comandoEsporta, comandoElenca,
  comandoEstrai, esamina, idLibero, descrizione, path };
