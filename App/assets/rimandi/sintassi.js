/* ============================================================================
   rimandi/sintassi.js — come si scrive, e come si legge, «da dove viene»
   ============================================================================
   Un rimando è la frase con cui un pezzo di testo dice da dove è stato preso:

     [p. 7](pdf:03#p=7)          la pagina 7 del documento numero 03
     [vai a 2:40](video:01#t=160)  il secondo 160 della videolezione 01
     [il punto](cap:01-fondamenti-c03)  un capitolo preciso di una lezione
     [[01-fondamenti|La lezione]]  una lezione intera (wiki-link)
     [==la frase==](ev:9f2c1a4b7e)  un'EVIDENZA: dove è stata segnata, e come

   ⚠️ `ev:` è l'unico che non nomina un posto ma un'ANNOTAZIONE dell'utente, e
   la differenza si vede in due punti. Primo: dove porta lo decide l'evidenza —
   la pagina di un documento o un capitolo, secondo dov'è stata fatta — quindi
   la risoluzione passa dal suo indice (`APPUNTI/_evidenze.json`), non dal
   numero del materiale. Secondo: chi lo scrive negli appunti ne prende ANCHE
   l'aspetto — colore e tratto — invece di copiarselo accanto. Due copie di un
   colore divergono al primo ricolora; una citazione no.

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
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../fonti/nomi'));
  else root.RimandiSintassi = factory(root.FontiNomi);
}(typeof self !== 'undefined' ? self : this, function (FontiNomi) {
  'use strict';

  /* Le tre forme, in un posto solo. ⚠️ `&amp;` fra i parametri della figura non
     è una svista: la stringa arriva già passata dall'escape dell'HTML, e
     cercare solo `&` la mancherebbe. */
  const RE = {
    pdfZaino: /^zaino-pdf:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})#(?:p=([1-9]\d{0,5})(?:&amp;|&))?r=([0-9a-f]{64})(?:(?:&amp;|&)q=([A-Za-z0-9._~%\-]+)(?:&amp;|&)o=(0|[1-9]\d{0,7}))?$/,
    video: /^video:(\d+)#t=(\d+)$/,
    pdf: /^pdf:(\d+)#p=(\d+)$/,
    pdfSenzaPagina: /^pdf:(\d+)$/,
    cap: /^cap:([A-Za-z0-9][A-Za-z0-9._-]*)$/,
    fig: /^fig:(\d+)#p=(\d+)(?:(?:&amp;|&)i=(\d+))?$/,
    /* L'id di un'evidenza è uno sha1 tagliato a dodici cifre esadecimali
       (`lib/evidenze.js` → `identita`). Si accettano da sei in su per la stessa
       ragione dell'album: la lunghezza è una scelta di quel file, e inchiodarla
       qui vorrebbe dire due posti da cambiare insieme. */
    ev: /^ev:([0-9a-f]{6,40})$/,
    /* Un'immagine dell'ALBUM: un ritaglio o una foto, citata per id. La
       grammatica esisteva già — la scrivono gli appunti come
       `![didascalia](album:<id>)` — ma la leggeva solo il costruttore del
       markdown, con una regex sua. Da Q4 passa da QUI: chi deve sapere che cosa
       c'è dall'altra parte di un rimando lo chiede alla porta unica, e una
       seconda funzione che interpreta un rimando è la seconda grammatica che
       l'invariante 7 vieta. */
    album: /^album:([0-9a-f]{6,40})$/
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
  function scriviPdf(numero, pagina, fonte) {
    const n = nn(numero); if (!n) return '';
    const p = parseInt(pagina, 10);
    const base = 'pdf:' + n + (p > 0 ? '#p=' + p : '');
    return fonte && /^[a-zA-Z0-9_-]{1,100}$/.test(fonte.sourceId) && /^[0-9a-f]{64}$/.test(fonte.revision)
      ? base + '&s=' + fonte.sourceId + '&r=' + fonte.revision : base;
  }

  /** Identità portabili; pagina null indica l'intero PDF. La selezione non è un'annotazione. */
  function scriviPdfZaino(zainoId, sourceId, pagina, revision, selezione) {
    let s='zaino-pdf:'+zainoId+'/'+sourceId+'#'+(pagina===null?'':'p='+pagina+'&')+'r='+revision;
    if(selezione){
      if(!Number.isInteger(selezione.inizio)||selezione.inizio<0||selezione.inizio>10000000||typeof selezione.testo!=='string'||!selezione.testo.length||selezione.testo.length>100000||selezione.testo.includes('\0'))return '';
      try{s+='&q='+encodeURIComponent(selezione.testo).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())+'&o='+selezione.inizio;}catch(e){return '';}
    }
    return leggi(s)?.tipo==='pdf-zaino'?s:'';
  }
  function letterale(s){return String(s||'').replace(/[\\`*\[\]#_!|>]/g,'\\$&');}
  function citazionePdfZaino(info, testo) {
    const r=leggi(info.rimando);if(!r||r.tipo!=='pdf-zaino')return '';
    const titolo=String(info.file||'PDF').replace(/[\r\n]/g,' '),pagina=r.intero?'':'; p. '+r.pagina;
    const label=String(info.zainoTitolo+' › '+titolo+(r.intero?'':' · p. '+r.pagina)).replace(/[\[\]\r\n]/g,'');
    const estratto=String(testo||'').trim(),righe=[];
    if(estratto)estratto.split(/\r?\n/).forEach(l=>righe.push(l?'*'+letterale(l)+'*':''));
    righe.push(letterale(FontiNomi.visibile(titolo)+pagina),link(letterale(label),info.rimando));
    return righe.map(l=>'> '+l).join('  \n');
  }
  /** Offset verificato sul testo; se il layout cambia si accetta solo un riscontro univoco. */
  function trovaSelezione(pagina, selezione){
    if(!selezione||!selezione.testo)return null;
    const t=String(pagina),q=selezione.testo,o=selezione.inizio;
    if(t.slice(o,o+q.length)===q)return {inizio:o,fine:o+q.length};
    const i=t.indexOf(q);return i>=0&&t.indexOf(q,i+1)<0?{inizio:i,fine:i+q.length}:null;
  }
  /** Solo resa: le vecchie citazioni includono il link nella barra senza riscrivere gli appunti.
   *  Il numero di righe resta identico, perché l'editor usa quelle coordinate. */
  function normalizzaCitazioni(md){
    const righe=String(md||'').split('\n');let recinto='';
    for(let i=0;i<righe.length;i++){
      const f=/^\s*(`{3,}|~{3,})/.exec(righe[i]);
      if(f){if(!recinto)recinto=f[1][0];else if(recinto===f[1][0])recinto='';continue;}
      if(recinto)continue;
      const m=/^(>\s*)?\[([^\]]+)\]\((zaino-pdf:[^)]+)\)\s*$/.exec(righe[i]);
      const ref=m&&leggi(m[3]);if(ref?.tipo!=='pdf-zaino')continue;
      // Solo la riga di titolo riconoscibile della citazione: il link conserva
      // il nome interno, e il testo scritto dall'utente non viene riscritto.
      const t=/^(>\s*)(.+?\.pdf)(; p\. \d+)?([ \t]*)$/i.exec(righe[i-1]||'');
      if(t&&(t[3]||'')===(ref.intero?'':'; p. '+ref.pagina)&&m[2].endsWith(' › '+t[2]+(ref.intero?'':' · p. '+ref.pagina)))righe[i-1]=t[1]+FontiNomi.visibile(t[2])+(t[3]||'')+t[4];
      if(m[1])continue;
      let j=i-1;while(j>=0&&!righe[j].trim())j--;
      if(j>=0&&/^>/.test(righe[j])){
        let a=j;while(a>0&&/^>/.test(righe[a-1]))a--;
        if(!/^>\s*\[!/.test(righe[a]))for(let k=j+1;k<i;k++)righe[k]='>';
      }
      righe[i]='> '+righe[i];
    }
    return righe.join('\n');
  }

  function scriviCap(capitoloId) {
    const id = String(capitoloId == null ? '' : capitoloId);
    return RE.cap.test('cap:' + id) ? 'cap:' + id : '';
  }

  /** L'evidenza con quell'id. Vuoto se l'id non è uno dei nostri: chi chiama
   *  scrive il testo nudo invece di un rimando che non apre niente — la stessa
   *  regola di `numeroDi`. */
  function scriviEv(id) {
    const v = String(id == null ? '' : id).trim().toLowerCase();
    return RE.ev.test('ev:' + v) ? 'ev:' + v : '';
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
    if(s.length<=1000000 && (m = RE.pdfZaino.exec(s))){
      const r={tipo:'pdf-zaino',zainoId:m[1],sourceId:m[2],pagina:Number(m[3]||1),revision:m[4]};
      if(!m[3])r.intero=true;
      if(m[5]){try{const testo=decodeURIComponent(m[5]),inizio=Number(m[6]);
        if(r.intero||!testo.length||testo.length>100000||testo.includes('\0')||inizio>10000000)return null;
        r.selezione={testo:testo,inizio:inizio};
      }catch(e){return null;}}
      return r;
    }
    // I rimandi AI conservano la revisione: il numero da solo non autorizza l'apertura.
    const snap = /^(pdf:\d+(?:#p=\d+)?)(?:&amp;|&)s=([a-zA-Z0-9_-]{1,100})(?:&amp;|&)r=([0-9a-f]{64})$/.exec(s);
    if (snap) return Object.assign(leggi(snap[1]), { sourceId:snap[2], revision:snap[3] });
    if ((m = RE.video.exec(s))) return { tipo: 'video', numero: nn(m[1]), t: parseInt(m[2], 10) };
    if ((m = RE.pdf.exec(s))) return { tipo: 'pdf', numero: nn(m[1]), pagina: parseInt(m[2], 10) };
    if ((m = RE.pdfSenzaPagina.exec(s))) return { tipo: 'pdf', numero: nn(m[1]), pagina: 1 };
    if ((m = RE.cap.exec(s))) return { tipo: 'cap', capitoloId: m[1] };
    if ((m = RE.fig.exec(s))) {
      return { tipo: 'fig', numero: nn(m[1]), pagina: parseInt(m[2], 10), i: parseInt(m[3] || '1', 10) };
    }
    if ((m = RE.ev.exec(s))) return { tipo: 'ev', id: m[1] };
    if ((m = RE.album.exec(s))) return { tipo: 'album', id: m[1] };
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
    scriviVideo: scriviVideo, scriviPdf: scriviPdf, scriviPdfZaino:scriviPdfZaino, scriviCap: scriviCap,
    scriviEv: scriviEv, citazionePdfZaino:citazionePdfZaino, trovaSelezione:trovaSelezione, normalizzaCitazioni:normalizzaCitazioni,
    link: link, leggi: leggi
  };
}));
