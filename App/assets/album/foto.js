/* ============================================================================
   album/foto.js — che cosa entra nell'album, e in che misura
   ============================================================================
   Le decisioni che si prendono quando qualcuno lascia cadere dei file sulla
   finestra: questo è un'immagine? di che formato, davvero? quanto grande la si
   tiene? come si chiamerà? — e, per ciò che non entra, PERCHÉ non entra.

   ⚠️ IL FORMATO SI LEGGE DAI BYTE, NON DAL NOME. Un `.png` che dentro è un JPEG
   è normale (basta rinominare un file), e crederci vuol dire scrivere nel vault
   un file la cui estensione mente — che è esattamente il guasto che `firmaOk`
   di `lib/album.js` esiste per impedire, un piano più sotto. Qui si guardano i
   primi byte, che sono l'unica cosa che un'immagine dichiara di sé.

   ⚠️ E CHI NON ENTRA LO DEVE SAPERE. Un import che ingoia in silenzio i file
   che non gli piacciono è la trappola ④ applicata all'utente: si trascinano
   venti foto, ne compaiono diciassette, e nessuno sa quali tre mancano né
   perché. Ogni scarto porta con sé il suo motivo, in italiano.

   Nessun DOM, nessun `fs`: `<script src>` nel browser, `require()` in Node.

     node test/foto.js
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AlbumFoto = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Il tetto: 15 MB per file. Non è una difesa dal disco — è che oltre quella
     soglia si tratta quasi sempre di un'immagine che va guardata altrove, e il
     vault è un archivio di studio, non un rullino. */
  var MAX_BYTE = 15 * 1024 * 1024;

  /* Il lato lungo a cui si riporta una foto ricodificata, e il lato della
     miniatura. 3000px è più della risoluzione di qualunque schermo su cui la si
     guarderà; 480 è il doppio abbondante della card da 104px, così regge anche
     uno schermo a densità doppia. */
  var LATO_MAX = 3000;
  var LATO_MINI = 480;
  /* La qualità del JPEG che esce dal canvas. 0,9 è il punto in cui l'occhio non
     distingue più l'originale e il file pesa un terzo. */
  var QUALITA = 0.9;

  /* I formati che entrano, con la firma che li dichiara. L'ordine non conta: si
     confrontano tutti. `mime` è quello che serve al canvas e a `lib/album.js`. */
  var FORMATI = [
    { ext: '.png',  mime: 'image/png',  magia: [0x89, 0x50, 0x4e, 0x47] },
    { ext: '.jpg',  mime: 'image/jpeg', magia: [0xff, 0xd8, 0xff] },
    { ext: '.gif',  mime: 'image/gif',  magia: [0x47, 0x49, 0x46, 0x38] },   // GIF8(7a|9a)
    { ext: '.webp', mime: 'image/webp', magia: [0x52, 0x49, 0x46, 0x46], magia2: { da: 8, byte: [0x57, 0x45, 0x42, 0x50] } }
  ];

  /* HEIC/HEIF: la firma non sta all'inizio ma dopo la lunghezza del box —
     `....ftypheic`. Non è un formato che il browser sappia disegnare: lo
     converte il main con `sips`, e per questo ha una voce sua invece di stare
     in `FORMATI`. */
  var HEIC_MARCHI = ['heic', 'heix', 'heif', 'hevc', 'mif1', 'msf1'];

  function byte(dati, i) {
    if (!dati) return -1;
    var v = dati[i];
    return (typeof v === 'number') ? v : -1;
  }
  function ascii(dati, da, quanti) {
    var s = '';
    for (var i = 0; i < quanti; i++) {
      var c = byte(dati, da + i);
      if (c < 0) return '';
      s += String.fromCharCode(c);
    }
    return s;
  }
  function combacia(dati, da, magia) {
    for (var i = 0; i < magia.length; i++) if (byte(dati, da + i) !== magia[i]) return false;
    return true;
  }

  /**
   * Che formato è, guardando i byte. Torna `{ ext, mime }`, `'heic'`, o `null`.
   *
   * ⚠️ Il nome del file non entra in questa decisione, mai. Serve solo quando i
   * byte non ci sono (per esempio in un elenco che si sta ancora leggendo), e
   * allora la risposta è dichiaratamente un'ipotesi: `tipoDalNome`.
   */
  function tipoDaiByte(dati) {
    for (var i = 0; i < FORMATI.length; i++) {
      var f = FORMATI[i];
      if (!combacia(dati, 0, f.magia)) continue;
      if (f.magia2 && !combacia(dati, f.magia2.da, f.magia2.byte)) continue;
      return { ext: f.ext, mime: f.mime };
    }
    if (ascii(dati, 4, 4) === 'ftyp' && HEIC_MARCHI.indexOf(ascii(dati, 8, 4)) >= 0) return 'heic';
    return null;
  }

  /** L'ipotesi che si può fare dal solo nome. Serve a dire «questo non è
   *  un'immagine» prima ancora di leggere il file — non a decidere che lo è. */
  function tipoDalNome(nome) {
    var m = /\.([A-Za-z0-9]+)$/.exec(String(nome || ''));
    if (!m) return null;
    var e = '.' + m[1].toLowerCase();
    if (e === '.jpeg') e = '.jpg';
    if (e === '.heic' || e === '.heif') return 'heic';
    for (var i = 0; i < FORMATI.length; i++) if (FORMATI[i].ext === e) return { ext: e, mime: FORMATI[i].mime };
    return null;
  }

  /**
   * Va ricodificata passando dal canvas?
   *
   * ⚠️ La risposta NON è «sempre», ed è la scelta che difende due cose insieme.
   * Un JPEG da telefono sì: porta l'orientamento nei metadati EXIF — il browser
   * lo applica quando la disegna, un `canvas` no — quindi un ritaglio fatto
   * dopo prenderebbe l'area ruotata di novanta gradi, e sembrerebbe un difetto
   * del ritaglio. Ricodificandola, l'orientamento entra nei pixel (e i metadati
   * GPS restano fuori dal vault, che non è poco).
   * Una GIF invece NO, mai: dal canvas tornerebbe un fotogramma solo, cioè non
   * sarebbe più lei. PNG e WebP nemmeno: non hanno orientamento EXIF, e
   * ricodificarli è solo un modo di perdere qualità o di gonfiare il file.
   */
  function daRicodificare(tipo, larghezza, altezza) {
    if (tipo === 'heic') return true;                       // arriva già convertita, ma il tetto vale lo stesso
    var ext = (tipo && tipo.ext) || String(tipo || '');
    if (ext === '.gif') return false;
    if (ext === '.jpg') return true;
    return misure(larghezza, altezza, LATO_MAX).ridotta;    // solo se sfora il tetto
  }

  /**
   * Le misure a cui portare un'immagine perché il lato lungo non superi `max`.
   * `ridotta` dice se si è toccato qualcosa — un'immagine più piccola del tetto
   * non si ingrandisce MAI: ingrandire non aggiunge informazione, aggiunge byte.
   */
  function misure(w, h, max) {
    var lw = Number(w) || 0, lh = Number(h) || 0, m = Number(max) || 0;
    if (!(lw > 0) || !(lh > 0) || !(m > 0)) return { w: Math.max(0, Math.round(lw)), h: Math.max(0, Math.round(lh)), ridotta: false };
    var lungo = Math.max(lw, lh);
    if (lungo <= m) return { w: Math.round(lw), h: Math.round(lh), ridotta: false };
    var k = m / lungo;
    return { w: Math.max(1, Math.round(lw * k)), h: Math.max(1, Math.round(lh * k)), ridotta: true };
  }

  /** La didascalia di partenza: il nome del file senza estensione. È
   *  modificabile subito dopo (`album.rinomina`), ed è comunque meglio di una
   *  riga muta. */
  function didascaliaDa(nome) {
    var n = String(nome || '').replace(/^.*[\\/]/, '').replace(/\.[A-Za-z0-9]{1,5}$/, '').trim();
    return n || 'immagine';
  }

  /**
   * Chi entra e chi no. `elenco` è fatto di `{ nome, dimensione }` — oggetti
   * semplici, non `File`, così questa funzione si prova in Node.
   *
   * Il controllo sui byte non è qui: quello si può fare solo dopo aver letto il
   * file, e leggere venti file per scoprire che tre non erano immagini sarebbe
   * lavoro sprecato. Qui si scartano i casi che si vedono dal nome e dalla
   * dimensione; i byte hanno l'ultima parola, dopo.
   */
  function accetta(elenco, max) {
    var tetto = Number(max) > 0 ? Number(max) : MAX_BYTE;
    var buone = [], scartate = [];
    (elenco || []).forEach(function (f) {
      var nome = String((f && f.nome) || '');
      var quanto = Number((f && f.dimensione) || 0);
      var tipo = tipoDalNome(nome);
      if (!tipo) { scartate.push({ nome: nome, motivo: 'non è un\'immagine' }); return; }
      if (quanto > tetto) {
        scartate.push({ nome: nome, motivo: 'pesa ' + mega(quanto) + ', il limite è ' + mega(tetto) });
        return;
      }
      if (!quanto) { scartate.push({ nome: nome, motivo: 'il file è vuoto' }); return; }
      buone.push({ nome: nome, dimensione: quanto, tipo: tipo });
    });
    return { buone: buone, scartate: scartate };
  }

  /** «3,4 MB», come lo legge una persona. */
  function mega(byte) {
    var n = Number(byte) || 0;
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + ' KB';
    return (Math.round(n / (1024 * 1024) * 10) / 10).toString().replace('.', ',') + ' MB';
  }

  return {
    MAX_BYTE: MAX_BYTE, LATO_MAX: LATO_MAX, LATO_MINI: LATO_MINI, QUALITA: QUALITA,
    FORMATI: FORMATI, HEIC_MARCHI: HEIC_MARCHI,
    tipoDaiByte: tipoDaiByte, tipoDalNome: tipoDalNome, daRicodificare: daRicodificare,
    misure: misure, didascaliaDa: didascaliaDa, accetta: accetta, mega: mega
  };
}));
