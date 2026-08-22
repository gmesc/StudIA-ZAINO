/* ============================================================================
   lettura/capitolo.js — il parser dei capitoli in markdown
   ============================================================================
   Da un file `.md` del vault all'oggetto che il lettore disegna: frontmatter,
   blocchi recintati (quiz, glossario, figure), markdown in linea, rimandi.

   ⚠️ PERCHÉ ESISTE QUESTO FILE. Fino a oggi queste 241 righe stavano dentro
   `App/StudIA.html`, e per provarle in Node `lib/reader-parser.js` **ritagliava
   il sorgente dell'HTML con due `indexOf`** (`function _unq(` → `function
   buildVaultCourses(`) e lo eseguiva in un sandbox `vm`. Funzionava, e teneva
   in piedi 915 controlli di `test/roundtrip.js` — ma bastava rinominare una
   funzione o spostarne una fuori dal recinto perché il ritaglio prendesse il
   pezzo sbagliato, in silenzio. Adesso è un modulo vero: l'app e le prove
   caricano LO STESSO file, che è la garanzia che il round-trip voleva dare.

   COME SI USA. `crea(ganci)` restituisce le funzioni legate al loro ambiente.
   I ganci sono le quattro cose che il parser non sa fare da sé:

     esc(s)          l'escape delle entità HTML
     mediaNum()      la mappa NN → file dei VIDEO del contenitore aperto
     pdfNum()        la mappa NN → file dei DOCUMENTI del contenitore aperto
     corsoAttivo()   quale contenitore è aperto (serve solo alle immagini
                     dell'album, che vivono dentro di lui)
     evidenza(id)    colore e tratto di un'evidenza → `{colore, tratto}` o null.
                     ⚠️ È un gancio e non un dato SCRITTO nel markdown: il
                     colore vive in un posto solo (`APPUNTI/_evidenze.json`), e
                     un appunto che ne portasse una copia mostrerebbe il colore
                     di ieri il giorno dopo averlo cambiato — la trappola ④ in
                     forma di file. Chi non lo passa (Node, le prove, un vault
                     chiuso) ottiene un segno neutro col testo intatto, non un
                     errore: un'evidenza tolta non deve portarsi via la frase.

   ⚠️ Sono ganci e non variabili perché la risposta CAMBIA nel tempo: durante
   l'analisi di un corpus valgono i numeri del corso in lavorazione, dopo quelli
   del contenitore aperto. Chi chiama `crea()` decide come rispondere; qui non
   si sa nemmeno che esistano i corsi.

   ⚠️ `typeof window` sopravvive dentro il modulo: in Node non c'è, e le figure
   e i ritagli devono degradare invece di sollevare. Era già così quando il
   blocco girava nel sandbox, ed è la ragione per cui l'estrazione è sicura —
   codice che gira in un `vm` senza DOM non ha dipendenze nascoste dal DOM.
   ============================================================================ */
/* ⚠️ Questo modulo DIPENDE da `rimandi/sintassi.js`: la grammatica dei rimandi
   sta lì, e leggerla qui con espressioni regolari proprie sarebbe la sesta
   copia della stessa cosa. Lo stesso vale per `misura.js`, che sa come una
   didascalia dice quanto è larga l'immagine — e lo sa anche per chi la SCRIVE,
   nel menu dell'appunto. La dipendenza si dichiara nei due modi che questo
   progetto usa — `require` in Node, il globale nel browser — e nell'`<head>`
   `sintassi.js` e `misura.js` vanno caricate PRIMA di questo file. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../rimandi/sintassi.js'), require('./identita.js'), require('./misura.js'));
  } else root.LetturaCapitolo = factory(root.RimandiSintassi, root.LetturaIdentita, root.LetturaMisura);
}(typeof self !== 'undefined' ? self : this, function (Rimandi, Identita, Misura) {
  'use strict';

  /** L'escape di ripiego: chi non passa il gancio non resta senza. */
  function escDiRipiego(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function crea(ganci) {
    var g = ganci || {};
    if (typeof g.esc !== 'function') g.esc = escDiRipiego;
    if (typeof g.mediaNum !== 'function') g.mediaNum = function () { return {}; };
    if (typeof g.pdfNum !== 'function') g.pdfNum = function () { return {}; };

  function _unq(v){ v=String(v==null?'':v).trim();
    if(v.length>=2 && v[0]===v[v.length-1] && (v[0]==='"'||v[0]==="'")){ var q=v[0]; v=v.slice(1,-1); v=(q==="'")?v.replace(/''/g,"'"):v.replace(/\\"/g,'"'); }
    return v; }
  function _splitFlow(s){ var out=[],cur='',q=null;
    for(var i=0;i<s.length;i++){ var ch=s[i];
      if(q){ if(ch===q) q=null; cur+=ch; }
      else if(ch==='"'||ch==="'"){ q=ch; cur+=ch; }
      else if(ch===','){ out.push(cur); cur=''; } else cur+=ch; }
    if(cur.trim()) out.push(cur); return out; }
  function _flowMap(s){ s=s.trim().replace(/^\{/,'').replace(/\}$/,''); var o={};
    _splitFlow(s).forEach(function(kv){ var i=kv.indexOf(':'); if(i<0) return; o[kv.slice(0,i).trim()]=_unq(kv.slice(i+1)); }); return o; }
  function parseFrontmatter(raw){ var fm={}; var m=/^---\n([\s\S]*?)\n---/.exec(raw); if(!m) return fm;
    var lines=m[1].split('\n'); var curKey=null;
    for(var i=0;i<lines.length;i++){ var ln=lines[i];
      var mi=/^\s+-\s+(\{.*\})\s*$/.exec(ln);
      if(mi && curKey){ (fm[curKey]=fm[curKey]||[]).push(_flowMap(mi[1])); continue; }
      var mk=/^([A-Za-z_]+):\s*(.*)$/.exec(ln); if(!mk) continue;
      var k=mk[1], v=mk[2].trim();
      if(v===''){ curKey=k; if(!fm[k]) fm[k]=[]; }
      else if(v.charAt(0)==='{'){ fm[k]=_flowMap(v); curKey=null; }
      else if(v.charAt(0)==='['){ fm[k]=v.replace(/^\[/,'').replace(/\]$/,'').split(',').map(function(x){return _unq(x);}).filter(Boolean); curKey=null; }
      else { fm[k]=_unq(v); curKey=null; } }
    return fm; }
  function parseFenced(raw, tag){ var re=new RegExp('```'+tag+'\\s*\\n([\\s\\S]*?)\\n```'); var m=re.exec(raw); if(!m) return [];
    var items=[], cur=null;
    m[1].split('\n').forEach(function(ln){
      var mi=/^\s*-\s+([A-Za-z_]+):\s*(.*)$/.exec(ln);
      if(mi){ if(cur) items.push(cur); cur={}; cur[mi[1]]=_unq(mi[2]); return; }
      var mk=/^\s+([A-Za-z_]+):\s*(.*)$/.exec(ln);
      if(mk && cur){ cur[mk[1]]=_unq(mk[2]); } });
    if(cur) items.push(cur); return items; }
  /**
   * Il nome del file di un ritaglio: `<stem del PDF>__pNNN_fK.webp`.
   *
   * ⚠️ Si ricostruisce dal rimando invece di leggerlo dall'indice, e la regola sta
   * scritta in due posti — qui e in `ocr.py` che lo scrive. È una duplicazione
   * dichiarata, non una svista: l'alternativa era caricare nel lettore l'indice
   * JSON di ogni PDF per risolvere una `<img>`. Il nome NON è quello che dà
   * Chandra (un hash dell'HTML del modello): quello cambia fra due letture e non
   * dice da quale pagina venga.
   */
  function figFile(nn, pg, i){
    var pdf=g.pdfNum()[String(nn).padStart(2,'0')]||'';
    if(!pdf) return '';
    return pdf.replace(/\.[^.]+$/,'') + '__p' + String(pg).padStart(3,'0') + '_f' + (i||1) + '.webp';
  }
  /**
   * La figura dentro il capitolo.
   *
   * È un `<a class="plink">` con dentro l'immagine: così il click che apre il PDF
   * alla pagina giusta è **quello che c'era già** — nessun secondo gestore, nessuna
   * seconda idea di che cosa voglia dire «vai alla fonte».
   *
   * ⚠️ `<span>` e non `<figure>`: il testo del capitolo finisce dentro `<p>`, e un
   * `<figure>` dentro un paragrafo è markup illegale che il browser spezza per
   * conto suo — il paragrafo si chiuderebbe prima e il testo dopo la figura
   * uscirebbe da un altro contenitore. Il ruolo lo dice `role="figure"`.
   */
  /**
   * Il vestito della misura: la classe che dice «questa figura una misura ce
   * l'ha» e la variabile che dice quanta.
   *
   * ⚠️ Una CLASSE e una variabile, non la sola variabile. Senza un appiglio nel
   * selettore il foglio di stile dovrebbe dare la larghezza sempre, con
   * `var(--figw, auto)` come ripiego — e un'ancora che si stringe addosso
   * all'immagine mentre l'immagine è larga quanto l'ancora è una misura che si
   * calcola da sé. La classe rompe l'anello: senza misura non si tocca niente e
   * vale il comportamento di sempre.
   */
  function _misuraVeste(percento){
    var n = Misura.limita(percento);
    return n ? { cls:' misurata', stile:' style="--figw:'+n+'%"' } : { cls:'', stile:'' };
  }
  /**
   * Un'immagine dell'album dentro il testo.
   *
   * Gemella di `figuraHtml`, con due differenze che contano: la sorgente la dà
   * l'album del corso (il nome del file lo sa solo il suo indice) e il click non
   * apre un documento — apre l'album, perché è lì che l'immagine si governa.
   *
   * ⚠️ `typeof window` per la stessa ragione di `figuraHtml`: questo blocco gira
   * anche in Node, estratto da `lib/reader-parser.js`. Là non c'è né `window` né
   * un vault, e la sola menzione del nome farebbe saltare tutto il parsing dei
   * capitoli. Senza vault si rende un segnaposto che DICE che manca, invece di un
   * `<img>` con la sorgente vuota — un'immagine rotta non spiega niente.
   */
  function albumHtml(didascalia, id){
    /* La didascalia arriva ancora attaccata alla sua misura (`Titolo|60%`): la
       grammatica la scioglie qui, in un posto solo, e quello che si scrive
       nell'`alt` e sotto la figura è il testo pulito. */
    var m=Misura.leggi(didascalia), d=String(m.didascalia||''), v=_misuraVeste(m.percento);
    var src=(typeof window!=='undefined' && window.vault && window.vault.album &&
             typeof g.corsoAttivo==='function')
      ? window.vault.album.srcUrl(g.corsoAttivo(), id) : '';
    if(!src) return '<span class="figmanca">'+(d?g.esc(d)+' — ':'')+'immagine dell\'album non trovata</span>';
    return '<span class="figura album'+v.cls+'" role="figure" aria-label="'+g.esc(d)+'"'+v.stile+'>'+
      '<a href="#" class="alink" data-album="'+g.esc(id)+'" title="Mostra questa immagine nell\'album">'+
        '<img class="figimg" src="'+g.esc(src)+'" alt="'+g.esc(d)+'" loading="lazy" onerror="figuraRotta(this)">'+
      '</a>'+
      (d ? '<span class="figcap">'+g.esc(d)+'</span>' : '')+
    '</span>';
  }
  function figuraHtml(didascalia, nn, pg, i){
    var mis=Misura.leggi(didascalia), veste=_misuraVeste(mis.percento);
    didascalia=mis.didascalia;
    var file=figFile(nn,pg,i);
    /* ⚠️ Due file diversi, e confonderli è un guasto silenzioso: l'immagine è il
       RITAGLIO (`…__p007_f2.webp`), il link apre il DOCUMENTO (`03 ….pdf`). Con
       il nome del ritaglio nel link, `openPdf` cercherebbe un PDF che non esiste
       e il click sulla figura non farebbe niente — visibile solo provandolo. */
    var pdf=g.pdfNum()[String(nn).padStart(2,'0')]||'';
    var d=String(didascalia||'');
    if(!file || !pdf) return d ? '<span class="figmanca">'+d+' — documento '+g.esc(String(nn))+' non trovato</span>' : '';
    /* ⚠️ `typeof window` e non `window`: questo blocco di funzioni gira anche in
       Node, estratto da `lib/reader-parser.js`, perché il parser dei capitoli
       resti UNO SOLO fra app e test. Là dentro `window` non esiste e la sola
       menzione del nome farebbe saltare tutto il parsing. */
    /* ⚠️ Il CONTENITORE si passa, come lo passa il ritaglio dell'album due
       funzioni più su: da quando `srcUrl` accetta il corso, chi non glielo dà
       si prende il primo omonimo in ordine alfabetico fra tutti i contenitori
       del vault — e la figura di un capitolo mostrerebbe la pagina di un altro
       corso senza dire niente. `g.corsoAttivo` può mancare (questo file gira
       anche in Node, dove non c'è nessun contenitore aperto): allora si chiede
       come prima, e il ripiego è quello di sempre. */
    var contenitore=(typeof g.corsoAttivo==='function') ? g.corsoAttivo() : undefined;
    var src=(typeof window!=='undefined' && window.vault && window.vault.srcUrl)
      ? window.vault.srcUrl(file, contenitore) : ('../Fonti/'+encodeURIComponent(file));
    return '<span class="figura'+veste.cls+'" role="figure" aria-label="'+d+'"'+veste.stile+'>'+
      '<a href="#" class="plink figlink" data-file="'+g.esc(pdf)+'" data-page="'+g.esc(String(pg))+'" data-label="'+d+'" '+
        'data-pdf="'+g.esc(String(nn))+'" title="Apri il documento a pagina '+g.esc(String(pg))+'">'+
        '<img class="figimg" src="'+g.esc(src)+'" alt="'+d+'" loading="lazy" onerror="figuraRotta(this)">'+
      '</a>'+
      (d ? '<span class="figcap">'+d+'</span>' : '')+
    '</span>';
  }
  /** Una figura che non c'è lo dice, invece di lasciare una casella vuota: il
   *  ritaglio può non essere mai stato prodotto (rilettura non fatta) o essere
   *  rimasto indietro in un'esportazione. */
  function figuraRotta(img){
    if(!img || !img.parentElement) return;
    var a=img.parentElement, cont=a.parentElement;
    var pag=a.getAttribute('data-page')||'?';
    a.innerHTML='<span class="figmanca">Figura non disponibile — apri il documento a p. '+g.esc(pag)+'</span>';
    if(cont) cont.classList.add('figvuota');
  }
  /* ====================== I richiami di nota ================================
     Una nota si scrive `[^1]` nel testo e `[^1]: …` in fondo al capitolo.

     Fino all'11 agosto 2026 il numeretto nel testo era un `<sup>` e basta,
     colorato d'accento dal foglio di stile: sembrava un link e non lo era. Chi
     lo premeva restava dov'era, e la nota — che sta in fondo al capitolo — se
     la doveva ritrovare a occhio. Le definizioni in fondo, invece, i loro link
     li avevano già. Adesso il numeretto è un'ancora alla sua voce in fondo, e
     ogni voce porta la freccia che riporta al punto da cui si era saltati: il
     salto senza il ritorno fa perdere il segno, che è il difetto di prima
     spostato di un metro.

     ⚠️ Gli id nascono dall'ID DEL CAPITOLO (`01-fondamenti-c03`) e non da un
     contatore della resa: lo stesso capitolo reso due volte deve dare gli
     stessi id. Un id che cambia a ogni resa romperebbe i rimandi di ciò che dal
     capitolo è già uscito — la pagina stampata, il pezzo copiato negli appunti.
     Ed è la stessa ragione per cui le note di due capitoli diversi non si
     pestano i piedi: il capitolo è già dentro l'id.

     ⚠️ `nota-…` e non `note-…`. `note-<capId>-<n>` è GIÀ l'id dei bottoni del
     riquadro «Note e materiali» del renderer, che è un'altra cosa (i materiali
     dichiarati nel frontmatter). Due elementi con lo stesso id nella stessa
     pagina e `getElementById` ne restituisce uno solo: metà dei salti
     finirebbe sull'elemento sbagliato, in silenzio.
  */
  /** Il pezzo di id che viene dal capitolo, ridotto a ciò che può stare in un
   *  attributo e in un selettore. Un id di cartella è già così; qui ci passa
   *  anche il nome di una lezione importata a mano, e basta uno spazio. */
  function notaCap(capId){ return String(capId == null ? '' : capId).replace(/[^A-Za-z0-9._-]+/g, '-'); }
  /**
   * Il contesto delle note di UN capitolo: chi è il capitolo, quali note sono
   * davvero definite in fondo, e quante volte ciascuna è già stata richiamata.
   *
   * ⚠️ È un parametro che si passa, non una variabile del modulo. Il conteggio
   * dei richiami è stato di una resa: tenuto nel modulo, due capitoli resi
   * nella stessa passata si conterebbero a vicenda, e una resa interrotta a
   * metà lascerebbe il contesto sporco addosso alla successiva.
   *
   * Senza contesto — gli appunti, il glossario, un testo qualunque — i richiami
   * restano il `<sup>` muto di prima: un'ancora verso una nota che lì non
   * esiste sarebbe un link che non porta da nessuna parte, cioè il difetto di
   * partenza con una freccia in più.
   */
  function notaContesto(capId, etichette){
    var definite = {};
    (etichette || []).forEach(function (n) { definite[n] = true; });
    return { cap: notaCap(capId), definite: definite, volte: {} };
  }
  function notaIdVoce(nota, n){ return 'nota-' + nota.cap + '-' + n; }
  /** L'id di un richiamo. Lo stesso `[^1]` può comparire due volte nel testo:
   *  la prima volta tiene l'id pulito — è quella a cui torna la freccia della
   *  nota — e le altre si numerano dietro, perché due id uguali sarebbero un
   *  salto che finisce sempre sul primo dei due. */
  function notaIdRif(nota, n, volta){ return 'rif-' + nota.cap + '-' + n + (volta > 1 ? ('-' + volta) : ''); }
  /** Il numeretto nel testo. `role="doc-noteref"` dice che cos'è a chi legge
   *  con la voce; è un `<a href>`, quindi la tastiera lo raggiunge senza che si
   *  debba inventare un `tabindex`. */
  function notaRifHtml(n, nota){
    if(!nota || !nota.definite[n]) return '<sup class="fnref">'+n+'</sup>';
    var volta=nota.volte[n]=(nota.volte[n]||0)+1;
    var bersaglio=notaIdVoce(nota,n);
    return '<sup class="fnref"><a id="'+notaIdRif(nota,n,volta)+'" class="fnsalta" href="#'+bersaglio+'"'+
      ' data-nota="'+bersaglio+'" role="doc-noteref" aria-label="Vai alla nota '+n+'">'+n+'</a></sup>';
  }
  /**
   * Il riquadro delle note in fondo al capitolo.
   *
   * ⚠️ Si costruisce DOPO la resa del testo, non insieme. La freccia «torna
   * indietro» si può scrivere solo se quel richiamo nel testo esiste davvero, e
   * lo si sa soltanto a testo reso (`nota.volte`). Una nota definita e mai
   * richiamata resta senza freccia, invece di averne una che cade nel vuoto.
   *
   * Il `tabindex="-1"` sulla voce non la mette nel giro del tabulatore: serve
   * perché chi arriva col salto possa ricevere il fuoco, altrimenti la tastiera
   * resta indietro sul numeretto e la lettura vocale non segue.
   */
  function notaRiquadroHtml(voci, nota){
    if(!voci.length) return '';
    return '<div class="fnotes"><b>Note</b><ol>'+voci.map(function(v){
      var rif=notaIdRif(nota,v.n,1);
      var torna=nota.volte[v.n]
        ? ' <a href="#'+rif+'" class="fnback" data-nota="'+rif+'" role="doc-backlink"'+
          ' aria-label="Torna al richiamo della nota '+v.n+'">↩</a>'
        : '';
      return '<li id="'+notaIdVoce(nota,v.n)+'" role="doc-endnote" tabindex="-1">'+_mdInline(v.txt, nota)+torna+'</li>';
    }).join('')+'</ol></div>';
  }
  /**
   * Il testo che è stato evidenziato, dentro un appunto.
   *
   * Il segno è `==…==` — l'evidenziatura di Obsidian, perché il vault si legge
   * anche di là — e il rimando dice QUALE evidenza: `[==la frase==](ev:9f2c…)`.
   *
   * ⚠️ Colore e tratto NON stanno nel markdown: si chiedono al gancio. È la
   * differenza fra citare e ricopiare — ricolorando una parola chiave, gli
   * appunti che la citano cambiano perché non c'è niente da aggiornare.
   *
   * ⚠️ Senza evidenza il segno resta, e resta MUTO: niente link (porterebbe a
   * un posto che l'indice non sa più dire) e niente colore, ma il testo c'è
   * tutto e il `title` dice perché è scolorito. È la regola dell'invariante 4 —
   * quello che sparisce si dice — applicata a una riga di testo.
   */
  /* ⚠️ Il testo arriva GIÀ passato dall'escape — `_mdInline` lo fa sulla riga
     intera, prima di qualunque regola — e ripassarlo qui darebbe `&amp;amp;` su
     una frase con una «e» commerciale. Stessa assunzione di `figuraHtml`. */
  function evidenzaHtml(testo, id){
    var t=String(testo==null?'':testo);
    var v=(typeof g.evidenza==='function') ? g.evidenza(id) : null;
    if(!v) return '<mark class="evid evorfana" title="Questa parola chiave non è più nell\'elenco">'+t+'</mark>';
    /* Il colore finisce in un attributo di stile: si ripulisce come lo ripulisce
       `lib/evidenze.js` prima di scriverlo su disco. Due porte, la stessa
       guardia — quella là difende il file, questa difende la pagina. */
    var col=String(v.colore==null?'':v.colore).replace(/[\x00-\x1f;"'<>]/g,'').trim().slice(0,40);
    var tratto=(v.tratto==='overlay') ? 'overlay' : 'sotto';
    var segno='<mark class="evid" data-tratto="'+tratto+'"'+(col?' style="--ev:'+col+'"':'')+'>'+t+'</mark>';
    var rim=Rimandi.scriviEv(id);
    if(!rim) return segno;
    return '<a href="#" class="evlink" data-ev="'+g.esc(id)+'" title="Torna dove l\'hai segnata">'+segno+'</a>';
  }
  function _mdInline(s, nota){ s=g.esc(s);
    /* ⚠️ La figura si riconosce PRIMA del rimando normale: la regex dei link
       matcha anche la parte `[…](…)` che sta dopo il punto esclamativo, e
       lascerebbe un «!» orfano davanti a un link che non è più una figura. */
    /* Un'immagine dell'ALBUM: un ritaglio fatto dall'utente, citato per id.
       ⚠️ Chi la usa la REFERENZIA, non la copia (decisione del 10 agosto): il file
       resta uno solo in `ALBUM/`, e cancellarlo può dire «è usata in tre posti»
       invece di lasciare tre riquadri rotti in giro. */
    s=s.replace(/!\[([^\]]*)\]\(album:([0-9a-f]{6,40})\)/g, function(m,cap,id){
      return albumHtml(cap, id); });
    s=s.replace(/!\[([^\]]*)\]\(fig:(\d+)#p=(\d+)(?:&amp;|&)i=(\d+)\)/g, function(m,cap,nn,pg,idx){
      return figuraHtml(cap, nn, pg, idx); });
    s=s.replace(/!\[([^\]]*)\]\(fig:(\d+)#p=(\d+)\)/g, function(m,cap,nn,pg){
      return figuraHtml(cap, nn, pg, 1); });
    /* ⚠️ PRIMA della regola dei link, per la stessa ragione già pagata dalle
       figure: la regex dei link matcha anche questo, e il testo uscirebbe da
       un'ancora normale con i due `==` a vista. */
    s=s.replace(/\[==([^\]]+?)==\]\(ev:([0-9a-f]{6,40})\)/g, function(m,txt,id){
      return evidenzaHtml(txt, id); });
    /* Un `==testo==` nudo: scritto a mano, o tornato da Obsidian, dove quella è
       l'evidenziatura di casa. Non cita nessuna evidenza, quindi non ha un
       colore da chiedere a nessuno — ma è un segno che l'utente ha fatto, e
       ignorarlo lascerebbe i due `==` in mezzo alla frase.
       ⚠️ Niente spazio subito dentro i due segni: senza questa condizione
       «a == b == c» diventerebbe un'evidenziatura, e una riga di codice o una
       formula si accenderebbero da sole. */
    s=s.replace(/==(\S[^=]*?)==/g, function(m,txt){
      return '<mark class="evid">'+txt+'</mark>'; });
    s=s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(m,txt,urlv){
      /* La grammatica la legge `rimandi/sintassi.js`: qui si decide solo che
         ANCORA disegnarci attorno. ⚠️ Il numero torna già a due cifre, che è la
         forma delle mappe NN→file — dimenticare quel `padStart` era il modo in
         cui un rimando smetteva di aprire senza sollevare niente. */
      var rif=Rimandi.leggi(urlv);
      if(rif && rif.tipo==='video'){ var f=g.mediaNum()[rif.numero]||'';
        return '<a href="#" class="vlink" data-file="'+g.esc(f)+'" data-t="'+rif.t+'" data-label="'+txt+'">'+txt+'</a>'; }
      if(rif && rif.tipo==='pdf'){ var pf=g.pdfNum()[rif.numero]||'';
        return '<a href="#" class="plink" data-file="'+g.esc(pf)+'" data-page="'+rif.pagina+'" data-label="'+txt+'">'+txt+'</a>'; }
      /* Rimando a un CAPITOLO preciso, che è cosa diversa dal wiki-link: `[[…]]`
         arriva alla lezione e `loadLesson` riparte dal primo capitolo, quindi non
         sa dire «quel punto lì». Serviva perché ogni frammento che si estrae dal
         testo porti con sé la propria origine.
         Si scrive l'id del capitolo per intero (`01-fondamenti-c03`) e non lezione
         più indice: è lo stesso identificatore che gli appunti già salvano in
         `capitoloId`, e due modi di dire dov'è un capitolo sarebbero due verità
         che prima o poi divergono. ⚠️ Quell'id nasce dall'ORDINE dei capitoli
         (`lessonId + '-c' + NN`): una rigenerazione che ne inserisce uno in mezzo
         sposta gli id di tutti quelli dopo, e i rimandi vecchi non si ritrovano.
         È un difetto che gli appunti hanno già oggi, non uno che nasce qui — ma
         va scritto, perché il giorno che si darà un'identità stabile ai capitoli
         questo è uno dei posti da correggere. */
      if(rif && rif.tipo==='cap'){ return '<a href="#" class="clink" data-cap="'+g.esc(rif.capitoloId)+'">'+txt+'</a>'; }
      if(rif && rif.tipo==='esterno') return '<a href="'+rif.url+'" target="_blank" rel="noopener">'+txt+'</a>';
      return txt; });
    s=s.replace(/\[\[([0-9]{2}-[a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, function(m,folder,label){ return '<a href="#" class="wlink" data-lesson="'+folder+'">'+(label||folder)+'</a>'; });
    s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    s=s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g,'$1<em>$2</em>');
    s=s.replace(/`([^`]+)`/g,'<code>$1</code>');
    s=s.replace(/\[\^([0-9A-Za-z]+)\]/g, function(m,n){ return notaRifHtml(n, nota); });
    return _autolink(s); }
  /**
   * Un indirizzo scritto NUDO diventa un link.
   *
   * ⚠️ Perché serve: `[ISS](https://www.iss.it)` era già un'ancora vera — e nel
   * PDF un'annotazione cliccabile, misurato — mentre `https://www.iss.it`
   * scritto e basta restava testo morto. Chi incolla un indirizzo in un appunto
   * lo incolla nudo: è il modo NORMALE di scrivere un link, e non funzionava.
   *
   * ⚠️ SI PASSA FRA I TAG, non sopra. Un `replace` sull'HTML già fatto
   * riscriverebbe anche gli indirizzi dentro gli `href` — un'ancora dentro
   * un'altra ancora — ed è il guasto classico dell'autolink. Qui la stringa si
   * spezza sui tag e si tocca solo il testo: i pezzi dispari dello `split` sono
   * i tag, e non si guardano nemmeno.
   *
   * ⚠️ E NON dentro `<a>`, `<code>` e `<pre>`: nel primo l'indirizzo è già un
   * link (o è l'etichetta di un altro), negli altri due è testo che deve restare
   * com'è scritto — è il motivo per cui uno scrive in un recinto.
   *
   * ⚠️ La coda della punteggiatura resta fuori: «vedi https://iss.it.» finisce
   * con un punto che appartiene alla frase, non all'indirizzo, e un link che si
   * porta via il punto porta a una pagina che non esiste.
   */
  var _URL_NUDO=/((?:https?:\/\/|www\.)[^\s<>"']*[^\s<>"'.,;:!?)\]])/g;
  function _autolink(html){
    if(!/(?:https?:\/\/|www\.)/.test(html)) return html;
    var pezzi=String(html).split(/(<[^>]+>)/), dentro=0, out='';
    for(var i=0;i<pezzi.length;i++){
      var pz=pezzi[i];
      if(i % 2){                                   // è un tag
        if(/^<(a|code|pre)\b/i.test(pz)) dentro++;
        else if(/^<\/(a|code|pre)\s*>/i.test(pz)) dentro=Math.max(0, dentro-1);
        out+=pz; continue;
      }
      out += dentro ? pz : pz.replace(_URL_NUDO, function(u){
        /* `www.iss.it` non è un indirizzo completo: senza schema il browser lo
           leggerebbe come un percorso relativo dentro l'app. */
        var href=(u.indexOf('www.')===0) ? ('https://'+u) : u;
        return '<a href="'+href+'" target="_blank" rel="noopener">'+u+'</a>';
      });
    }
    return out;
  }
  /**
   * Spezza un markdown in pezzi di CODICE (dentro ``` … ```) e pezzi di testo,
   * nell'ordine in cui stanno scritti.
   *
   * ⚠️ La lingua dichiarata dopo gli apici (```js) si legge e si butta: qui non
   * c'è nessun colorista, e una classe `language-js` che non colora niente
   * sarebbe una promessa scritta nel DOM e non mantenuta.
   */
  function _recinti(md){
    var righe=md.split('\n'), out=[], testo=[], codice=null;
    for(var i=0;i<righe.length;i++){
      var apre=/^\s*```/.test(righe[i]);
      if(codice===null){
        if(apre){ if(testo.length){ out.push({ codice:false, testo:testo.join('\n') }); testo=[]; } codice=[]; }
        else testo.push(righe[i]);
        continue;
      }
      if(apre){ out.push({ codice:true, testo:codice.join('\n') }); codice=null; }
      else codice.push(righe[i]);
    }
    // recinto aperto e mai chiuso: torna testo com'era, apici in testa compresi
    if(codice!==null) testo=testo.concat(['```'], codice);
    if(testo.length) out.push({ codice:false, testo:testo.join('\n') });
    return out;
  }
  /**
   * L'HTML di `n` righe vuote di seguito, negli appunti.
   *
   * ⚠️ LA REGOLA, ED È LA STESSA DELL'«A CAPO». La prima riga vuota separa due
   * paragrafi, e quello stacco lo dà già il margine del `<p>`: dalla seconda in
   * poi ognuna è una riga che chi scrive VEDE nell'editor e si aspetta di
   * ritrovare accanto. Prima si buttavano via tutte — dieci Invii rendevano
   * come uno — e l'unico modo di lasciare un bianco era una riga con lo spazio
   * insecabile: un trucco che bisognava sapere, scritto in fondo a una guida.
   * Il markdown classico collassa; qui no, per la stessa ragione per cui un
   * Invio solo vale come interruzione di riga (`aCapo`): un appunto è un testo
   * scritto a mano, non un sorgente da compilare.
   *
   * ⚠️ Il paragrafo è VUOTO DAVVERO, senza lo spazio insecabile di prima:
   * quel carattere finirebbe nel testo che la ricerca indicizza, che la voce
   * legge e che si copia via. L'altezza gliela dà il foglio di stile (`.md-vuota`),
   * che è il posto dove stanno le misure.
   *
   * ⚠️ Le righe scritte con ⌥+Spazio continuano a valere: sono CONTENUTO, non
   * righe vuote, e stanno già dentro gli appunti della gente. Un cambiamento di
   * regola non può riscrivere il passato.
   */
  function vuote(n){
    var q = Math.max(0, (n | 0) - 1), s = '';
    while (q--) s += '<p class="md-vuota"></p>';
    return s;
  }
  /* aCapo=true: l'Invio singolo vale come interruzione di riga (come in Obsidian).
     Serve nei testi scritti a mano — gli appunti — dove chi scrive si aspetta di
     andare a capo premendo Invio. I capitoli generati restano al comportamento
     markdown classico: riga singola = stesso paragrafo. */
  /* `nota` è il contesto delle note del capitolo (vedi `notaContesto`): si
     limita ad attraversare, perché a scrivere i richiami è `_mdInline` in fondo
     alla catena. Chi non ce l'ha — gli appunti, un markdown qualunque — lo
     lascia stare e ottiene la resa di sempre. */
  function mdToHtml(md, aCapo, nota){ if(!md) return '';
    // il <br> va inserito DOPO la resa inline, altrimenti _mdInline lo escaperebbe
    // ripulisce solo gli spazi ordinari ai bordi: trim() porterebbe via anche
    // lo spazio insecabile, che qui è contenuto voluto (la riga vuota)
    var orli = function(s){ return String(s).replace(/^[ \t]+|[ \t]+$/g, ''); };
    var unisci = aCapo
      ? function(righe){ return orli(righe.map(function(l){ return _mdInline(l, nota); }).join('<br>')); }
      : function(righe){ return _mdInline(orli(righe.join(' ')), nota); };
    /* ⚠️ I RECINTI SI RITAGLIANO PRIMA DELLO SPEZZETTAMENTO SUI BIANCHI.
       Un blocco ``` … ``` è l'unica cosa che può CONTENERE una riga vuota, e
       lo `split(/\n{2,}/)` qui sotto la tratterebbe da confine: il codice
       uscirebbe tagliato in due pezzi, ognuno con metà dei suoi apici.
       Solo negli appunti (`aCapo`): nei capitoli generati i recinti che
       contano — quiz, glossario — li ha già tolti `mdChapter`, e uno che
       arrivasse fin qui non è mai stato reso come codice. */
    if(aCapo && md.indexOf('```')>=0){
      var pezzi=_recinti(String(md).replace(/\r/g,''));
      /* ⚠️ Un recinto MAI CHIUSO torna indietro com'era, apici compresi: chi sta
         ancora scrivendo non deve vedere metà appunto diventare codice. Ed è
         anche la condizione d'uscita di questa ricorsione — senza il controllo
         qui sotto, quel pezzo rientrerebbe da capo e si girerebbe in tondo. */
      if(pezzi.length>1 || (pezzi[0] && pezzi[0].codice)){
        return pezzi.map(function(p){
          return p.codice ? '<pre class="md-code"><code>'+g.esc(p.testo)+'</code></pre>'
                          : mdToHtml(p.testo, aCapo, nota);
        }).filter(function(s){ return s; }).join('\n');
      }
    }
    /* ⚠️ I SEPARATORI SI TENGONO, non si buttano. `split(/\n{2,}/)` diceva
       «qui finisce un blocco» e perdeva QUANTE righe vuote c'erano: la
       differenza fra un Invio in più e dieci spariva prima di essere letta.
       Con la parentesi di cattura i separatori restano nell'array, ai posti
       dispari, e `vuote()` decide che cosa valgono.
       ⚠️ E una riga di soli spazi è una riga vuota: chi la guarda nell'editor
       vede il bianco, non i suoi caratteri. Lo spazio insecabile no — quello
       è contenuto, e resta un paragrafo suo (è il trucco di prima, che deve
       continuare a valere negli appunti già scritti). */
    var sorgente=md.replace(/\r/g,'');
    if(aCapo) sorgente=sorgente.replace(/^[ \t]+$/gm,'');
    var blocks=[], seps=[];
    sorgente.split(/(\n{2,})/).forEach(function(x, ix){ if(ix % 2) seps.push(x); else blocks.push(x); });
    var out=[];
    blocks.forEach(function(b, bi){ b=b.replace(/^\n+|\n+$/g,'');
      // NB: trim() tratta lo spazio insecabile (U+00A0) come spazio, quindi una riga
      // scritta con ⌥+Spazio per lasciare il bianco veniva scartata. Qui la conto come
      // contenuto: chi la scrive vuole proprio una riga vuota visibile.
      if(!b.replace(/[ \t\n\r]+/g,'').length) return;
      /* Il bianco fra QUESTO blocco e il precedente. Va qui e non in cima al
         giro perché lo si vuole solo FRA due cose che si vedono: `out.length`
         dice che qualcosa prima c'è, e un blocco vuoto (l'inizio del file) è
         già uscito di scena due righe sopra. */
      if(aCapo && out.length && seps[bi-1]){
        var bianco=vuote(seps[bi-1].length-1);
        if(bianco) out.push(bianco);            // una riga vuota sola non lascia niente da scrivere
      }
      var lines=b.split('\n');
      /* Un blocco può MESCOLARE testo, elenchi e titoli: prima si scorreva l'intero
         blocco e si riconosceva un titolo solo se stava sulla PRIMA riga del blocco —
         un «#» scritto senza riga vuota sopra (dopo un altro paragrafo, o dentro un
         callout) restava testo letterale con il cancelletto a vista. Qui si raggruppano
         invece le sequenze contigue per tipo: testo, poi ul, poi titolo, poi testo…
         Ogni riga di titolo chiude il proprio gruppo subito: due «#» consecutivi restano
         due titoli distinti, non un solo <hN> con le due righe unite. */
      var PUNTO=/^\s*[-*]\s+/, NUM=/^\s*\d+[.)]\s+/, TIT=/^(#{1,6})\s+(.*)$/;
      /* ⚠️ La citazione vale solo negli APPUNTI, e non è pignoleria: il bottone
         «"» della barra scrive «> testo» e finora quel testo usciva letterale,
         maggiore compreso. Nei capitoli generati la sintassi non si usa, e
         accenderla là vorrebbe dire cambiare la resa di file già scritti.
         ⚠️ Un riquadro NON è una citazione: `> [!nota]` lo prende `renderNoteMd`,
         che sta più in alto e non arriva mai qui. Il guardiano è comunque
         scritto, perché il corpo di un riquadro ripassa da questa funzione. */
      var CIT=/^\s*>(?!\s*\[!)/;
      var tipoDi=function(l){ return PUNTO.test(l) ? 'ul' : (NUM.test(l) ? 'ol' :
        (TIT.test(l) ? 'h' : ((aCapo && CIT.test(l)) ? 'q' : 'testo'))); };
      if(lines.some(function(l){ return l.trim() && tipoDi(l)!=='testo'; })){
        var gruppo=[], tipo=null;
        var chiudi=function(){
          if(!gruppo.length) return;
          if(tipo==='testo'){ var t=unisci(gruppo); if(t) out.push('<p>'+t+'</p>'); }
          else if(tipo==='ul'){
            out.push('<ul>'+gruppo.map(function(l){ return '<li>'+_mdInline(orli(l.replace(PUNTO,'')), nota)+'</li>'; }).join('')+'</ul>');
          } else if(tipo==='ol'){
            var inizio=parseInt((/^\s*(\d+)/.exec(gruppo[0])||[0,1])[1],10)||1;
            out.push('<ol'+(inizio!==1?' start="'+inizio+'"':'')+'>'+
              gruppo.map(function(l){ return '<li>'+_mdInline(orli(l.replace(NUM,'')), nota)+'</li>'; }).join('')+'</ol>');
          } else if(tipo==='q'){
            /* Dentro la citazione si torna da capo con la funzione intera invece
               di unire le righe a mano: là dentro ci possono stare un elenco, un
               titoletto o una seconda citazione, e riconoscerli una seconda volta
               qui sarebbe la stessa regola scritta in due posti. Il «>» si toglie
               a ogni giro, quindi la discesa finisce sempre. */
            out.push('<blockquote>'+
              mdToHtml(gruppo.map(function(l){ return l.replace(/^\s*>\s?/,''); }).join('\n'), aCapo, nota)+
              '</blockquote>');
          } else {
            var hm=TIT.exec(gruppo[0]);
            /* ⚠️ I titoli valgono due livelli diversi secondo chi scrive.
               In un CAPITOLO il markdown è il corpo di una pagina che ha già il
               suo h1 (il titolo della lezione) e il suo h2 (il capitolo): un
               «#» del testo esce come h3, o l'indice del documento avrebbe due
               teste. `mappa/genera.js` conta su questa relatività.
               In un APPUNTO — `aCapo`, cioè un testo scritto a mano — il
               markdown È il documento: «#» è l'h1, e i sei livelli restano sei.
               ⚠️ Con lo spostamento di due, «####», «#####» e «######»
               finivano TUTTI in h6: tre livelli scritti diversi e resi
               identici, mentre l'editor accanto li mostrava di tre misure —
               chi scriveva vedeva la differenza sparire nell'anteprima. */
            var lv=aCapo ? hm[1].length : Math.min(6,hm[1].length+2);
            out.push('<h'+lv+'>'+_mdInline(hm[2], nota)+'</h'+lv+'>');
          }
          gruppo=[]; tipo=null;
        };
        lines.forEach(function(l){
          if(!l.trim() && tipo!=='testo'){ return; }        // righe vuote fra le voci: ignorate
          var t=tipoDi(l);
          if(tipo && (t!==tipo || t==='h')) chiudi();        // un titolo non si fonde mai col precedente…
          tipo=t; gruppo.push(l);
          if(t==='h') chiudi();                              // …né col successivo: si chiude appena letto
        });
        chiudi();
        return;
      }
      out.push('<p>'+unisci(lines)+'</p>'); });
    return out.join('\n'); }
  function _stripFm(raw){ return raw.replace(/^---\n[\s\S]*?\n---\n?/,''); }
  function mdChapter(raw, lessonId, order){
    var fm=parseFrontmatter(raw);
    var body=_stripFm(raw).replace(/```(?:quiz|glossario)[\s\S]*?```/g,'');
    /* ⚠️ Dell'etichetta si tiene conto, non solo del testo: `[^1]` e `[^nota]`
       devono ritrovarsi, e il numero che si vede nel riquadro lo fa l'`<ol>`
       contando le voci — che è un'altra cosa dall'etichetta con cui la nota si
       richiama nel testo. */
    var fns=[]; body=body.replace(/^\[\^([0-9A-Za-z]+)\]:\s*(.*)$/gm, function(m,n,txt){ fns.push({ n:n, txt:txt }); return ''; });
    /* ⚠️ L'id del capitolo si PRENDE, non si inventa: quello scritto nel
       frontmatter è l'unico che una rigenerazione può conservare, mentre uno
       calcolato dalla posizione cambia appena qualcuno infila un capitolo in
       mezzo — e con lui si staccano appunti, evidenze e nodi di mappa scritti
       prima. Il posizionale resta come ALIAS, perché è il nome con cui tutto
       quello che l'utente ha scritto finora chiama questo capitolo. La catena
       sta in `lettura/identita.js`, e il perché con lei. */
    var ident=Identita.di(fm, lessonId, order);
    var capId=ident.id;
    /* Il contesto delle note vale per «In breve» e per «Contenuto» insieme:
       finiscono nella stessa pagina, e un richiamo scritto nel sommario deve
       saltare alla stessa voce in fondo di uno scritto nel testo. I punti
       chiave e il glossario restano com'erano — là un `[^1]` non si scrive, e
       cambiarne la resa sarebbe un secondo cambiamento dentro il primo. */
    var nota=notaContesto(capId, fns.map(function(f){ return f.n; }));
    var sec={}; var parts=body.split(/^##\s+(.+)$/m);
    for(var i=1;i<parts.length;i+=2){ sec[parts[i].trim()]=(parts[i+1]||''); }
    var brief=mdToHtml((sec['In breve']||'').trim(), false, nota);
    var html=mdToHtml((sec['Contenuto']||'').trim(), false, nota);
    html+=notaRiquadroHtml(fns, nota);
    var kp=[]; (sec['Punti chiave']||'').split('\n').forEach(function(l){ var m=/^\s*[-*]\s+(.*)$/.exec(l); if(m) kp.push(_mdInline(m[1])); });
    var glossary=parseFenced(raw,'glossario').map(function(g){ return {t:g.t, d:_mdInline(g.d||'')}; });
    var quiz=parseFenced(raw,'quiz').map(function(q){ var a=String(q.a).toLowerCase(); var isTf=(a==='true'||a==='false');
      return {q:q.q, type:'tf', answer:(a==='true'), explain:(isTf?'':('Risposta: '+q.a+'. '))+(q.perche||'')}; });
    var videoRefs=(fm.videoRefs||[]).map(function(v){ return {video:(g.mediaNum()[String(v.video).padStart(2,"0")]||v.video), t:parseInt(v.t,10)||0, label:v.label}; });
    var sources=(fm.sources||[]).map(function(s){ return {pdf:(g.pdfNum()[String(s.pdf).padStart(2,"0")]||s.pdf), page:parseInt(s.page,10)||0, label:s.label}; });
    /* Le figure dichiarate nel frontmatter. Servono al riquadro «Note e materiali»
       e al controllo del validatore; la figura che si VEDE nel testo nasce invece
       dal rimando `![…](fig:NN#p=…&i=…)`. Sono due facce della stessa cosa, come
       `sources` lo è dei link `pdf:` — e come là, la maggior parte vive qui. */
    var figure=(fm.figure||[]).map(function(f){
      var n=String(f.pdf||f.fig||'').padStart(2,'0');
      return { pdf:(g.pdfNum()[n]||n), numero:n, page:parseInt(f.p||f.page,10)||1,
               i:parseInt(f.i,10)||1, label:f.label||'' }; });
    return { id:capId, idLegacy:Identita.posizionale(lessonId, order), alias:ident.alias, title:(fm.title||('Capitolo '+order)), brief:brief, html:html, keypoints:kp, glossary:glossary, quiz:quiz, videoRefs:videoRefs, sources:sources, figure:figure }; }

    return {
      parseFrontmatter: parseFrontmatter, parseFenced: parseFenced,
      mdToHtml: mdToHtml, mdChapter: mdChapter,
      /* Serve a `renderNoteMd`, che sta nel monolite e le righe vuote le conta
         da sé: il bianco FRA due blocchi lo vede solo lui, perché è lui a
         spezzare l'appunto in blocchi prima di chiamare `mdToHtml`. La regola
         però è una sola, ed è questa — due funzioni che decidono quanto vale un
         Invio in più sarebbero due regole destinate a divergere. */
      vuote: vuote,
      _mdInline: _mdInline, _stripFm: _stripFm,
      figuraHtml: figuraHtml, albumHtml: albumHtml, figFile: figFile,
      evidenzaHtml: evidenzaHtml,
      figuraRotta: figuraRotta, _unq: _unq, _splitFlow: _splitFlow, _flowMap: _flowMap,
      /* Serve alle prove e a chi rende un pezzo di capitolo fuori da
         `mdChapter`: senza contesto i richiami di nota restano muti, e senza
         questa esportazione non ci sarebbe modo di dargliene uno. */
      notaContesto: notaContesto
    };
  }

  return { crea: crea };
}));
