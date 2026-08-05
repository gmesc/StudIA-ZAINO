'use strict';
/**
 * materiali — dove stanno i video, i PDF, le trascrizioni e gli indici.
 *
 * Storicamente il corpus era unico per tutto il vault: `Media/`, `Fonti/`,
 * `Trascrizioni/`, `Indice-PDF/`. Comodo finché il vault è di una persona sola,
 * inutilizzabile quando si vuole **passare a qualcuno un intero progetto**: la
 * cartella `Progetti/<id>/` da sola non conteneva niente da guardare.
 *
 * Da qui in avanti ogni progetto può avere i suoi materiali dentro di sé:
 *
 *     Progetti/<id>/MATERIALI/{Media,Fonti,Trascrizioni,Indice-PDF}
 *
 * Chi cerca un materiale passa da questo modulo, che guarda **prima** dentro i
 * progetti e **poi** nelle cartelle globali. Così un progetto ricevuto da fuori
 * funziona anche in un vault che non ha mai visto quei file, e un vault vecchio
 * continua a funzionare senza toccare niente.
 *
 * Nel vault dell'autore le due copie sono hardlink dello stesso file: lo spazio
 * si paga una volta, ma copiando la cartella del progetto il pacchetto è completo.
 */

const fs = require('fs');
const path = require('path');

const CARTELLA = 'MATERIALI';
/** Materiali non ancora attribuiti a un progetto: fuori dal corpus, in attesa. */
const ATTESA = 'MATERIALI-DA-ASSEGNARE';

/**
 * Dentro un progetto le cartelle dicono cosa contengono, e **una per tipo di
 * sorgente**: i PDF originali stanno insieme, i video insieme, l'audio pure —
 * uno studente che carica una registrazione della lezione deve avere un posto
 * ovvio dove metterla, senza mescolarla ai documenti.
 *
 * Il codice continua a ragionare per «sub» storici (`Media` = tutto ciò che si
 * trascrive, `Fonti` = tutto ciò che si legge): qui quei due si aprono a
 * ventaglio sulle cartelle vere.
 */
const NOMI = {
  'Media': ['Video', 'Audio'],
  'Fonti': ['PDF', 'Web', 'Documenti'],       // «Documenti» resta per i vault già organizzati così
  'Trascrizioni': ['Trascrizioni'],
  'Indice-PDF': ['Indici-PDF'],
  'Indice-HTML': ['Indici-Web'],
  // i ritagli delle figure trovate dentro i PDF: derivati come le trascrizioni,
  // e come quelle devono viaggiare col progetto, o un capitolo che mostra uno
  // schema arriverebbe altrove con la casella vuota
  'Figure': ['Figure']
};
const SOTTO = Object.keys(NOMI);

const EXT_VIDEO = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.mpeg', '.mpg'];
const EXT_AUDIO = ['.m4a', '.mp3', '.wav', '.aac', '.flac', '.ogg', '.opus', '.aiff'];
const EXT_WEB = ['.html', '.htm'];

/** Le cartelle (dentro un progetto) che possono contenere quel «sub». */
function nomiInProgetto(sub) { return NOMI[sub] || [sub]; }
/** La prima, cioè quella dove si scrive quando non si guarda il singolo file. */
function nomeInProgetto(sub) { return nomiInProgetto(sub)[0]; }

/**
 * In quale cartella del progetto va un file, guardando l'estensione.
 * È la regola che decide dove finisce un materiale nuovo: un `.mp3` caricato
 * da uno studente va in `Audio/`, non fra i video.
 */
function cartellaPerFile(nome) {
  const ext = path.extname(String(nome || '')).toLowerCase();
  if (EXT_VIDEO.includes(ext)) return 'Video';
  if (EXT_AUDIO.includes(ext)) return 'Audio';
  if (ext === '.pdf') return 'PDF';
  if (EXT_WEB.includes(ext)) return 'Web';
  return 'Documenti';                         // qualunque altro allegato
}

function dirs(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('.')).map(d => d.name); }
  catch (e) { return []; }
}

/** Gli id dei progetti che hanno una cartella `MATERIALI/`. */
function progettiConMateriali(vault) {
  if (!vault) return [];
  return dirs(path.join(vault, 'Progetti'))
    .filter(id => fs.existsSync(path.join(vault, 'Progetti', id, CARTELLA)));
}

/** Vero se il progetto si porta dentro i propri materiali. */
function haMateriali(vault, id) {
  return !!vault && !!id && fs.existsSync(path.join(vault, 'Progetti', id, CARTELLA));
}

/**
 * Le cartelle in cui cercare `sub` (Media, Fonti, …), in ordine di precedenza.
 * `progetto` (facoltativo) mette in testa quello attivo: se lo stesso numero
 * esiste in due progetti, vince il suo.
 *
 * `solo` (facoltativo) è la differenza fra «prima il mio» e «solo il mio».
 * Serve perché i materiali NON sono più un pozzo comune: da quando ogni
 * progetto se li porta dentro, guardare in tutti significa costruire un corso
 * sulla conferenza OECD leggendo anche quaranta lezioni sulla dislessia — e
 * pagandole. Con `solo` un progetto che ha la sua cartella MATERIALI vede
 * quella e basta; uno che non ce l'ha (vault vecchio) continua a pescare dal
 * corpus globale, che è l'unico posto dove i suoi file possono stare.
 */
function cartelle(vault, sub, progetto, solo) {
  if (!vault) return [];
  const out = [];
  const agg = (p) => { if (p && !out.includes(p) && fs.existsSync(p)) out.push(p); };
  // dentro un progetto: le cartelle per tipo, poi il nome interno (vault già in uso)
  const dentro = (id) => {
    for (const n of nomiInProgetto(sub)) agg(path.join(vault, 'Progetti', id, CARTELLA, n));
    agg(path.join(vault, 'Progetti', id, CARTELLA, sub));
  };
  if (progetto) dentro(progetto);
  // il confine si decide sulla cartella MATERIALI, non su `sub`: un progetto che
  // ha i video ma non ancora gli indici resta comunque chiuso in se stesso
  if (solo && haMateriali(vault, progetto)) return out;
  for (const id of progettiConMateriali(vault)) dentro(id);
  agg(path.join(vault, sub));                       // impianto storico: corpus del vault
  return out;
}

/** Il percorso di un file materiale, o '' se non esiste da nessuna parte. */
function trova(vault, sub, nome, progetto, solo) {
  if (!vault || !nome) return '';
  for (const dir of cartelle(vault, sub, progetto, solo)) {
    const p = path.join(dir, nome);
    try { if (fs.existsSync(p)) return p; } catch (e) {}
  }
  return '';
}

/**
 * Elenca i file di `sub` una volta sola per nome (il primo che si incontra
 * vince, quindi la copia dentro il progetto ha la precedenza).
 * → [{ nome, dir, dentroProgetto }]
 */
function elenca(vault, sub, progetto, solo) {
  const visti = new Set(); const out = [];
  for (const dir of cartelle(vault, sub, progetto, solo)) {
    let files; try { files = fs.readdirSync(dir); } catch (e) { continue; }
    for (const nome of files.sort()) {
      if (nome.startsWith('.') || visti.has(nome)) continue;
      visti.add(nome);
      out.push({ nome, dir, dentroProgetto: dir.includes(path.sep + CARTELLA + path.sep) });
    }
  }
  return out;
}

/**
 * Dove scrivere un derivato (trascrizione, indice) di un materiale: **accanto
 * al materiale**. Se il file di partenza vive dentro un progetto, il derivato
 * resta nel progetto — altrimenti quel progetto, spostato altrove, avrebbe i
 * video senza le trascrizioni.
 */
function destinazioneDerivato(vault, sorgente, sub) {
  const dir = path.dirname(String(sorgente || ''));
  const m = dir.split(path.sep + CARTELLA + path.sep)[0];
  if (m !== dir && m.includes(path.sep + 'Progetti' + path.sep)) return path.join(m, CARTELLA, nomeInProgetto(sub));
  return path.join(vault, sub);
}

/** Le cartelle che un progetto nuovo si porta dietro, nell'ordine in cui si leggono. */
function cartelleProgetto() { return ['Video', 'Audio', 'PDF', 'Web', 'Trascrizioni', 'Indici-PDF', 'Indici-Web', 'Figure']; }

/** Il numero iniziale del nome di un materiale ("07 …" → 7), o null. */
function numero(nome) { const m = /^(\d{1,3})\b/.exec(String(nome || '')); return m ? parseInt(m[1], 10) : null; }

module.exports = { SOTTO, NOMI, CARTELLA, ATTESA, EXT_VIDEO, EXT_AUDIO, EXT_WEB,
  nomeInProgetto, nomiInProgetto, cartellaPerFile, cartelleProgetto, progettiConMateriali,
  haMateriali, cartelle, trova, elenca, destinazioneDerivato, numero };
