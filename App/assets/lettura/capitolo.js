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

   ⚠️ Sono ganci e non variabili perché la risposta CAMBIA nel tempo: durante
   l'analisi di un corpus valgono i numeri del corso in lavorazione, dopo quelli
   del contenitore aperto. Chi chiama `crea()` decide come rispondere; qui non
   si sa nemmeno che esistano i corsi.

   ⚠️ `typeof window` sopravvive dentro il modulo: in Node non c'è, e le figure
   e i ritagli devono degradare invece di sollevare. Era già così quando il
   blocco girava nel sandbox, ed è la ragione per cui l'estrazione è sicura —
   codice che gira in un `vm` senza DOM non ha dipendenze nascoste dal DOM.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LetturaCapitolo = factory();
}(typeof self !== 'undefined' ? self : this, function () {
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
    var d=String(didascalia||'');
    var src=(typeof window!=='undefined' && window.vault && window.vault.album &&
             typeof g.corsoAttivo==='function')
      ? window.vault.album.srcUrl(g.corsoAttivo(), id) : '';
    if(!src) return '<span class="figmanca">'+(d?g.esc(d)+' — ':'')+'immagine dell\'album non trovata</span>';
    return '<span class="figura album" role="figure" aria-label="'+g.esc(d)+'">'+
      '<a href="#" class="alink" data-album="'+g.esc(id)+'" title="Mostra questa immagine nell\'album">'+
        '<img class="figimg" src="'+g.esc(src)+'" alt="'+g.esc(d)+'" loading="lazy" onerror="figuraRotta(this)">'+
      '</a>'+
      (d ? '<span class="figcap">'+g.esc(d)+'</span>' : '')+
    '</span>';
  }
  function figuraHtml(didascalia, nn, pg, i){
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
    var src=(typeof window!=='undefined' && window.vault && window.vault.srcUrl)
      ? window.vault.srcUrl(file) : ('../Fonti/'+encodeURIComponent(file));
    return '<span class="figura" role="figure" aria-label="'+d+'">'+
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
  function _mdInline(s){ s=g.esc(s);
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
    s=s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(m,txt,urlv){
      var mv=/^video:(\d+)#t=(\d+)/.exec(urlv);
      if(mv){ var f=g.mediaNum()[mv[1].padStart(2,"0")]||''; return '<a href="#" class="vlink" data-file="'+g.esc(f)+'" data-t="'+mv[2]+'" data-label="'+txt+'">'+txt+'</a>'; }
      var mp=/^pdf:(\d+)#p=(\d+)/.exec(urlv);
      if(mp){ var pf=g.pdfNum()[mp[1].padStart(2,"0")]||''; return '<a href="#" class="plink" data-file="'+g.esc(pf)+'" data-page="'+mp[2]+'" data-label="'+txt+'">'+txt+'</a>'; }
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
      var mc=/^cap:([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(urlv);
      if(mc){ return '<a href="#" class="clink" data-cap="'+g.esc(mc[1])+'">'+txt+'</a>'; }
      if(/^https?:/.test(urlv)) return '<a href="'+urlv+'" target="_blank" rel="noopener">'+txt+'</a>';
      return txt; });
    s=s.replace(/\[\[([0-9]{2}-[a-z0-9-]+)(?:\|([^\]]+))?\]\]/g, function(m,folder,label){ return '<a href="#" class="wlink" data-lesson="'+folder+'">'+(label||folder)+'</a>'; });
    s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    s=s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g,'$1<em>$2</em>');
    s=s.replace(/`([^`]+)`/g,'<code>$1</code>');
    s=s.replace(/\[\^([0-9A-Za-z]+)\]/g, function(m,n){ return '<sup class="fnref">'+n+'</sup>'; });
    return s; }
  /* aCapo=true: l'Invio singolo vale come interruzione di riga (come in Obsidian).
     Serve nei testi scritti a mano — gli appunti — dove chi scrive si aspetta di
     andare a capo premendo Invio. I capitoli generati restano al comportamento
     markdown classico: riga singola = stesso paragrafo. */
  function mdToHtml(md, aCapo){ if(!md) return '';
    // il <br> va inserito DOPO la resa inline, altrimenti _mdInline lo escaperebbe
    // ripulisce solo gli spazi ordinari ai bordi: trim() porterebbe via anche
    // lo spazio insecabile, che qui è contenuto voluto (la riga vuota)
    var orli = function(s){ return String(s).replace(/^[ \t]+|[ \t]+$/g, ''); };
    var unisci = aCapo
      ? function(righe){ return orli(righe.map(function(l){ return _mdInline(l); }).join('<br>')); }
      : function(righe){ return _mdInline(orli(righe.join(' '))); };
    var blocks=md.replace(/\r/g,'').split(/\n{2,}/); var out=[];
    blocks.forEach(function(b){ b=b.replace(/^\n+|\n+$/g,'');
      // NB: trim() tratta lo spazio insecabile (U+00A0) come spazio, quindi una riga
      // scritta con ⌥+Spazio per lasciare il bianco veniva scartata. Qui la conto come
      // contenuto: chi la scrive vuole proprio una riga vuota visibile.
      if(!b.replace(/[ \t\n\r]+/g,'').length) return;
      var lines=b.split('\n');
      /* Un blocco può MESCOLARE testo, elenchi e titoli: prima si scorreva l'intero
         blocco e si riconosceva un titolo solo se stava sulla PRIMA riga del blocco —
         un «#» scritto senza riga vuota sopra (dopo un altro paragrafo, o dentro un
         callout) restava testo letterale con il cancelletto a vista. Qui si raggruppano
         invece le sequenze contigue per tipo: testo, poi ul, poi titolo, poi testo…
         Ogni riga di titolo chiude il proprio gruppo subito: due «#» consecutivi restano
         due titoli distinti, non un solo <hN> con le due righe unite. */
      var PUNTO=/^\s*[-*]\s+/, NUM=/^\s*\d+[.)]\s+/, TIT=/^(#{1,6})\s+(.*)$/;
      var tipoDi=function(l){ return PUNTO.test(l) ? 'ul' : (NUM.test(l) ? 'ol' : (TIT.test(l) ? 'h' : 'testo')); };
      if(lines.some(function(l){ return l.trim() && tipoDi(l)!=='testo'; })){
        var gruppo=[], tipo=null;
        var chiudi=function(){
          if(!gruppo.length) return;
          if(tipo==='testo'){ var t=unisci(gruppo); if(t) out.push('<p>'+t+'</p>'); }
          else if(tipo==='ul'){
            out.push('<ul>'+gruppo.map(function(l){ return '<li>'+_mdInline(orli(l.replace(PUNTO,'')))+'</li>'; }).join('')+'</ul>');
          } else if(tipo==='ol'){
            var inizio=parseInt((/^\s*(\d+)/.exec(gruppo[0])||[0,1])[1],10)||1;
            out.push('<ol'+(inizio!==1?' start="'+inizio+'"':'')+'>'+
              gruppo.map(function(l){ return '<li>'+_mdInline(orli(l.replace(NUM,'')))+'</li>'; }).join('')+'</ol>');
          } else {
            var hm=TIT.exec(gruppo[0]); var lv=Math.min(6,hm[1].length+2);
            out.push('<h'+lv+'>'+_mdInline(hm[2])+'</h'+lv+'>');
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
    var fns=[]; body=body.replace(/^\[\^([0-9A-Za-z]+)\]:\s*(.*)$/gm, function(m,n,txt){ fns.push(txt); return ''; });
    var sec={}; var parts=body.split(/^##\s+(.+)$/m);
    for(var i=1;i<parts.length;i+=2){ sec[parts[i].trim()]=(parts[i+1]||''); }
    var brief=mdToHtml((sec['In breve']||'').trim());
    var html=mdToHtml((sec['Contenuto']||'').trim());
    if(fns.length){ html+='<div class="fnotes"><b>Note</b><ol>'+fns.map(function(t){return '<li>'+_mdInline(t)+'</li>';}).join('')+'</ol></div>'; }
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
    return { id:lessonId+'-c'+String(order).padStart(2,'0'), title:(fm.title||('Capitolo '+order)), brief:brief, html:html, keypoints:kp, glossary:glossary, quiz:quiz, videoRefs:videoRefs, sources:sources, figure:figure }; }

    return {
      parseFrontmatter: parseFrontmatter, parseFenced: parseFenced,
      mdToHtml: mdToHtml, mdChapter: mdChapter,
      _mdInline: _mdInline, _stripFm: _stripFm,
      figuraHtml: figuraHtml, albumHtml: albumHtml, figFile: figFile,
      figuraRotta: figuraRotta, _unq: _unq, _splitFlow: _splitFlow, _flowMap: _flowMap
    };
  }

  return { crea: crea };
}));
