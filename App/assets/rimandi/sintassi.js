/* ============================================================================
   rimandi/sintassi.js — come si scrive, e come si legge, «da dove viene»
   ============================================================================
   Un rimando è la frase con cui un pezzo di testo dice da dove è stato preso:

     [p. 7](pdf:03#p=7)          la pagina 7 del documento numero 03
     [vai a 2:40](video:01#t=160)  il secondo 160 della videolezione 01
     [il punto](cap:01-fondamenti-c03)  un capitolo preciso di una lezione
     [[01-fondamenti|La lezione]]  una lezione intera (wiki-link)

   ⚠️ PERCHÉ È UN FILE SUO. Questa sintassi era scritta in **cinque punti
   diversi**: quattro che la compongono (cita un video, cita un PDF, il rimando
   di un'evidenza, l'origine di un appunto) e uno che la legge, con tre
   espressioni regolari a mano. Cinque copie della stessa grammatica sono cinque
   cose da tenere d'accordo, e il 10-11 agosto 2026 tre guasti su otto sono nati
   proprio lì: un rimando scritto con un numero che nessuno sapeva risolvere, un
   `#p=` che si perdeva, un capitolo sbagliato di uno.

   ⚠️ IL NUMERO, NON IL NOME. Un rimando nomina il MATERIALE per numero (`03`),
   non per nome di file: il nome può cambiare — l'utente rinomina, la pipeline
   rigenera — mentre il numero è l'identità che il contenitore assegna una volta.
   È anche il motivo per cui i numeri delle fonti tolte restano prenotati
   (`lib/fonti.js`): un numero riciclato farebbe puntare i vecchi rimandi
   altrove, in silenzio.

   Qui non si apre niente e non si disegna niente: si passa da una coppia di
   dati alla stringa, e viceversa.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RimandiSintassi = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Le tre forme, in un posto solo. ⚠️ `&amp;` fra i parametri della figura non
     è una svista: la stringa arriva già passata dall'escape dell'HTML, e
     cercare solo `&` la mancherebbe. */
  const RE = {
    video: /^video:(\d+)#t=(\d+)$/,
    pdf: /^pdf:(\d+)#p=(\d+)$/,
    pdfSenzaPagina: /^pdf:(\d+)$/,
    cap: /^cap:([A-Za-z0-9][A-Za-z0-9._-]*)$/,
    fig: /^fig:(\d+)#p=(\d+)(?:(?:&amp;|&)i=(\d+))?$/
  };

  function nn(n) {
    const s = String(n == null ? '' : n).replace(/\D/g, '');
    return s ? s.padStart(2, '0') : '';
  }

  /** Il secondo di una videolezione. Mai negativo, sempre intero: un rimando a
   *  «-3 secondi» aprirebbe il video all'inizio senza dire perché. */
  function scriviVideo(numero, secondo) {
    const n = nn(numero); if (!n) return '';
    return 'video:' + n + '#t=' + Math.max(0, Math.floor(Number(secondo) || 0));
  }

  /** La pagina di un documento. Le pagine si contano da 1: `#p=0` non esiste, e
   *  un rimando che ci finisse aprirebbe il documento senza saltare. */
  function scriviPdf(numero, pagina) {
    const n = nn(numero); if (!n) return '';
    const p = parseInt(pagina, 10);
    return 'pdf:' + n + (p > 0 ? '#p=' + p : '');
  }

  function scriviCap(capitoloId) {
    const id = String(capitoloId == null ? '' : capitoloId);
    return RE.cap.test('cap:' + id) ? 'cap:' + id : '';
  }

  /** Il rimando dentro le parentesi di un link markdown, già montato. */
  function link(etichetta, rimando) {
    if (!rimando) return String(etichetta == null ? '' : etichetta);
    return '[' + String(etichetta == null ? '' : etichetta) + '](' + rimando + ')';
  }

  /**
   * Da una stringa a che cosa dice. `null` se non è un rimando nostro — un URL
   * esterno, o del testo qualunque fra parentesi.
   *
   * ⚠️ Il numero torna SEMPRE a due cifre (`'03'`), perché è così che è scritto
   * nelle mappe NN→file. Chi leggeva con la propria espressione regolare doveva
   * ricordarsi il `padStart` ogni volta, e dimenticarlo dava un rimando che non
   * apriva niente senza sollevare un errore.
   */
  function leggi(url) {
    const s = String(url == null ? '' : url).trim();
    let m;
    if ((m = RE.video.exec(s))) return { tipo: 'video', numero: nn(m[1]), t: parseInt(m[2], 10) };
    if ((m = RE.pdf.exec(s))) return { tipo: 'pdf', numero: nn(m[1]), pagina: parseInt(m[2], 10) };
    if ((m = RE.pdfSenzaPagina.exec(s))) return { tipo: 'pdf', numero: nn(m[1]), pagina: 1 };
    if ((m = RE.cap.exec(s))) return { tipo: 'cap', capitoloId: m[1] };
    if ((m = RE.fig.exec(s))) {
      return { tipo: 'fig', numero: nn(m[1]), pagina: parseInt(m[2], 10), i: parseInt(m[3] || '1', 10) };
    }
    if (/^https?:/i.test(s)) return { tipo: 'esterno', url: s };
    return null;
  }

  /** Il numero di un materiale a partire dal suo nome di file, data la mappa
   *  NN→file del contenitore. `null` quando il materiale non è numerato: chi
   *  chiama scrive il testo nudo invece di un rimando che non apre niente. */
  function numeroDi(file, mappa) {
    for (const k in (mappa || {})) { if (mappa[k] === file) return k; }
    return null;
  }

  return {
    RE: RE, nn: nn, numeroDi: numeroDi,
    scriviVideo: scriviVideo, scriviPdf: scriviPdf, scriviCap: scriviCap,
    link: link, leggi: leggi
  };
}));
