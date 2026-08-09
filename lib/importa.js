'use strict';
/**
 * importa — porta dentro il vault una cartella preparata dall'utente.
 *
 * Il materiale scaricato da internet non arriva quasi mai nella forma che
 * StudIA si aspetta: sta in sottocartelle tematiche (MEDIA, PDF, HTML,
 * SOTTOTITOLI), i nomi cominciano con la sigla della lezione invece che con il
 * numero del materiale, e insieme ai contenuti veri viaggiano gli asset delle
 * pagine salvate. Questo modulo guarda una cartella qualsiasi e ne ricava un
 * PIANO: dove va ogni file, come si chiamerà, che cosa viene abbinato a che
 * cosa, e che cosa resta fuori — con il motivo scritto accanto.
 *
 * La pianificazione non tocca il disco: prende un elenco di file e restituisce
 * un oggetto. Così si può mostrare in anteprima, correggere e testare senza
 * copiare niente. La copia vera è `applica()`, in fondo.
 */

const fs = require('fs');
const path = require('path');
const mat = require('./materiali');   // dove va ogni tipo di file dentro un corso

const MEDIA_EXT = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.mpeg', '.mpg', '.m4a', '.mp3', '.wav', '.aac', '.flac'];
const PDF_EXT = ['.pdf'];
const WEB_EXT = ['.html', '.htm'];
const TRASCR_EXT = ['.txt', '.vtt', '.srt'];
const IMG_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'];
// nomi che nelle pagine salvate indicano sempre decorazione, mai contenuto
const IMG_DECORO = /(logo|avatar|icon|profile|badge|spacer|pixel|tracking|sprite|favicon)/i;
// asset che accompagnano le pagine salvate: mai contenuto didattico
const ASSET_EXT = ['.css', '.js', '.mjs', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.map',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.avif', '.json', '.xml'];

/** Dove finiva ogni tipo di materiale quando il corpus era unico per tutto il vault. */
const DESTINAZIONE = { media: 'Media', pdf: 'Fonti', html: 'Fonti' };

/**
 * Dove finisce un materiale importato.
 *
 * Con `corso` va DENTRO il corso, nella cartella del suo tipo:
 * `Corsi/<id>/MATERIALI/{Video,Audio,PDF,Web,Documenti}`. È la condizione
 * perché un corso si possa passare a qualcuno copiando una cartella sola —
 * e perché la numerazione per corso abbia senso: se i file atterrano nella
 * radice comune, «il prossimo numero di questo corso» non vuol dire niente.
 *
 * Senza `corso` resta la radice del vault, per i vault a corpus unico.
 */
function destinazione(tipo, nomeFile, corso) {
  if (!corso) return DESTINAZIONE[tipo] || 'Fonti';
  return path.join('Corsi', corso, mat.CARTELLA, mat.cartellaPerFile(nomeFile));
}

// ------------------------------------------------------------------ scansione

/**
 * Percorre una cartella e restituisce i file trovati, con il percorso relativo.
 * Non segue i link simbolici e non si ferma sugli errori di lettura.
 */
function scansiona(dir, base, out) {
  base = base || dir; out = out || [];
  let voci;
  try { voci = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const v of voci.sort((a, b) => a.name.localeCompare(b.name, 'it'))) {
    if (v.name.startsWith('.')) continue;                 // .DS_Store e compagnia
    const abs = path.join(dir, v.name);
    if (v.isDirectory()) { scansiona(abs, base, out); continue; }
    if (!v.isFile()) continue;
    let size = 0; try { size = fs.statSync(abs).size; } catch (e) {}
    out.push({ abs, rel: path.relative(base, abs), nome: v.name, ext: path.extname(v.name).toLowerCase(), size });
  }
  return out;
}

// ------------------------------------------------------- riconoscimento tipo

/** Vero se il file sta dentro la cartella di asset di una pagina salvata. */
function dentroAsset(rel) {
  return path.dirname(rel).split(path.sep).some((seg) => /_files$/i.test(seg));
}

/** Il tipo di materiale, o la ragione per cui non lo è. */
function classifica(file) {
  if (dentroAsset(file.rel)) return 'asset';
  if (MEDIA_EXT.includes(file.ext)) return 'media';
  if (PDF_EXT.includes(file.ext)) return 'pdf';
  if (WEB_EXT.includes(file.ext)) return 'html';
  if (TRASCR_EXT.includes(file.ext)) return 'trascrizione';
  if (ASSET_EXT.includes(file.ext)) return 'asset';
  return 'ignoto';
}

/**
 * La sigla iniziale con cui l'utente ha raggruppato i file: «1A», «2B», «05».
 * È il solo modo per capire che un video, la sua trascrizione e la pagina della
 * lezione parlano della stessa cosa. Restituisce null se il nome non ne ha una.
 */
function siglaDi(nome) {
  const m = /^(\d{1,3})\s*([A-Za-z])?(?=[\s._-]|$)/.exec(String(nome || ''));
  if (!m) return null;
  return m[1].padStart(2, '0') + (m[2] ? m[2].toUpperCase() : '');
}

/** Ordinamento naturale delle sigle: 01 < 01A < 01B < 02 < 02A. */
function chiaveSigla(sigla) { return sigla || '￿'; }

/** Quale materiale viene prima, a parità di sigla: la lezione, poi i suoi allegati. */
const RANGO = { media: 0, html: 1, pdf: 2 };

// ------------------------------------------------------------------ scarti

/**
 * Pagine di servizio: esistono nelle lezioni salvate da internet ma non insegnano
 * niente. Si escludono con il motivo in chiaro, e l'utente può rimetterle.
 */
function pagineDiServizio(nome) {
  if (/certificat/i.test(nome)) return 'pagina di servizio: certificato, nessun contenuto didattico';
  return null;
}

// ---------------------------------------------------------------- pianifica

/**
 * Dall'elenco dei file al piano d'importazione.
 *
 * @param {Array} files  come li restituisce scansiona()
 * @param {Object} opz   { numeraDa: 1, forzati: [percorsi relativi], corso } — `forzati`
 *                       sono i file ripescati dagli scarti nell'anteprima; `corso`
 *                       fa atterrare tutto dentro di lui invece che nella radice
 * @returns {{materiali: Array, esclusi: Array}}
 */
function pianifica(files, opz) {
  const numeraDa = (opz && opz.numeraDa) || 1;
  const corso = (opz && opz.corso) || null;
  const forzati = new Set((opz && opz.forzati) || []);
  const candidati = [], trascrizioni = [], esclusi = [];

  for (const f of (files || [])) {
    const tipo = classifica(f);
    const voluto = forzati.has(f.rel);
    if (tipo === 'asset' && !voluto) { esclusi.push({ ...f, tipo, motivo: 'asset della pagina salvata' }); continue; }
    if (tipo === 'ignoto' && !voluto) { esclusi.push({ ...f, tipo, motivo: 'tipo di file non gestito (' + (f.ext || 'senza estensione') + ')' }); continue; }
    const servizio = pagineDiServizio(f.nome);
    if (servizio && !voluto) { esclusi.push({ ...f, tipo, motivo: servizio, ribaltabile: true }); continue; }
    const voce = { ...f, tipo, sigla: siglaDi(f.nome) };
    if (tipo === 'trascrizione') trascrizioni.push(voce); else candidati.push(voce);
  }

  // ordine di lettura: per sigla, e a parità di sigla prima la lezione
  candidati.sort((a, b) => {
    const s = chiaveSigla(a.sigla).localeCompare(chiaveSigla(b.sigla));
    if (s) return s;
    const r = (RANGO[a.tipo] ?? 9) - (RANGO[b.tipo] ?? 9);
    return r || a.nome.localeCompare(b.nome, 'it');
  });

  // ogni materiale prende il numero che StudIA usa nei rimandi (video:NN, pdf:NN)
  const materiali = candidati.map((c, i) => {
    const num = String(numeraDa + i).padStart(2, '0');
    return {
      tipo: c.tipo, sigla: c.sigla, num,
      origine: c.rel, abs: c.abs, size: c.size,
      dir: destinazione(c.tipo, c.nome, corso),    // un file ripescato a mano finisce fra le fonti
      nome: num + ' ' + c.nome,                       // il nome originale resta intero
      abbinati: []
    };
  });

  // Le immagini di una pagina salvata viaggiano con lei: la pagina le cita, e
  // qualcuna può essere un grafico o uno schema, cioè materiale di studio. Si
  // portano dentro tutte; a separare il contenuto dalla decorazione ci pensa
  // l'estrazione, che vede dimensioni e testo alternativo.
  const immaginiPrese = new Set();
  for (const m of materiali) {
    if (m.tipo !== 'html') continue;
    const gambo = path.basename(m.origine, path.extname(m.origine));
    const cartellaAsset = path.join(path.dirname(m.abs), gambo + '_files');
    let dentro; try { dentro = fs.readdirSync(cartellaAsset); } catch (e) { continue; }
    const stemFinale = m.nome.replace(/\.[a-z0-9]+$/i, '');
    for (const f of dentro.sort()) {
      if (!IMG_EXT.includes(path.extname(f).toLowerCase())) continue;
      const abs = path.join(cartellaAsset, f);
      let size = 0; try { size = fs.statSync(abs).size; } catch (e) { continue; }
      // prefiltro grossolano: il nome e il peso bastano a riconoscere marchi e
      // icone. Il giudizio fine (dimensioni, testo alternativo) è dell'estrazione.
      if (IMG_DECORO.test(f) || size < 4096) continue;
      // le immagini seguono la pagina che le cita: stessa cartella, con la coda «_files»
      m.abbinati.push({ ruolo: 'immagine-pagina', origine: path.join(gambo + '_files', f),
        abs, size, dir: path.join(m.dir, stemFinale + '_files'), nome: f });
    }
  }
  // quelle portate dentro non sono più «scarti»
  for (let i = esclusi.length - 1; i >= 0; i--) if (immaginiPrese.has(esclusi[i].rel)) esclusi.splice(i, 1);

  // le trascrizioni già pronte non sono materiali a sé: sono il testo di un video
  for (const t of trascrizioni) {
    const video = t.sigla ? materiali.find((m) => m.tipo === 'media' && m.sigla === t.sigla) : null;
    if (!video) {
      esclusi.push({ ...t, motivo: t.sigla
        ? 'trascrizione senza video con la sigla ' + t.sigla
        : 'trascrizione senza sigla: non so a quale video appartiene', ribaltabile: true });
      continue;
    }
    const stem = video.nome.replace(/\.[a-z0-9]+$/i, '');
    // la trascrizione sta accanto al suo video: dentro il corso se il video ci sta
    video.abbinati.push({
      ruolo: 'trascrizione-ufficiale', origine: t.rel, abs: t.abs, size: t.size,
      dir: corso ? path.join('Corsi', corso, mat.CARTELLA, mat.nomeInCorso('Trascrizioni'))
                    : 'Trascrizioni',
      nome: stem + '.ufficiale.txt'
    });
  }

  return { materiali, esclusi };
}

// ------------------------------------------------------------------ riepilogo

/** Due righe in italiano da mostrare sopra la tabella di anteprima. */
function riepilogo(piano) {
  const per = (t) => piano.materiali.filter((m) => m.tipo === t).length;
  const abbinate = piano.materiali.reduce((s, m) => s + m.abbinati.length, 0);
  return {
    materiali: piano.materiali.length,
    media: per('media'), pdf: per('pdf'), html: per('html'),
    trascrizioniAbbinate: abbinate,
    esclusi: piano.esclusi.length
  };
}

// -------------------------------------------------------------------- applica

/** Un nome libero nella cartella di destinazione: non si sovrascrive mai niente. */
function nomeLibero(dir, nome) {
  const ext = path.extname(nome), gambo = nome.slice(0, nome.length - ext.length);
  let tentativo = nome, i = 1;
  while (fs.existsSync(path.join(dir, tentativo))) tentativo = gambo + ' (' + (++i) + ')' + ext;
  return tentativo;
}

/** Copia un file nel vault, restituendo l'esito. */
function copia(vault, sub, nome, abs) {
  const dir = path.join(vault, sub);
  fs.mkdirSync(dir, { recursive: true });
  const finale = nomeLibero(dir, nome);
  fs.copyFileSync(abs, path.join(dir, finale));
  return sub + '/' + finale;
}

/**
 * Esegue il piano. Ogni file è indipendente: se uno fallisce gli altri passano
 * lo stesso, e l'errore finisce nell'esito invece di fermare l'importazione.
 */
function applica(vault, piano) {
  const esiti = [];
  for (const m of (piano.materiali || [])) {
    try {
      const dest = copia(vault, m.dir, m.nome, m.abs);
      const voce = { origine: m.origine, dest, tipo: m.tipo, num: m.num, abbinati: [] };
      for (const a of m.abbinati) {
        try { voce.abbinati.push({ origine: a.origine, dest: copia(vault, a.dir, a.nome, a.abs), ruolo: a.ruolo }); }
        catch (err) { voce.abbinati.push({ origine: a.origine, errore: err.message }); }
      }
      esiti.push(voce);
    } catch (err) { esiti.push({ origine: m.origine, errore: err.message }); }
  }
  return { esiti, importati: esiti.filter((e) => !e.errore).length };
}

/** Scansione + pianificazione in un colpo solo: quello che serve all'anteprima. */
function esamina(dir, opz) {
  const piano = pianifica(scansiona(dir), opz);
  return { cartella: dir, ...piano, riepilogo: riepilogo(piano) };
}

module.exports = {
  MEDIA_EXT, PDF_EXT, WEB_EXT, TRASCR_EXT, IMG_EXT, DESTINAZIONE, destinazione,
  scansiona, dentroAsset, classifica, siglaDi, pagineDiServizio,
  pianifica, riepilogo, esamina, applica, nomeLibero
};
