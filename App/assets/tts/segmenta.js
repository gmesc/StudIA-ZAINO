/* ============================================================================
   tts/segmenta.js — dal testo di un capitolo ai segmenti da leggere ad alta voce
   ============================================================================
   Sigle sciolte, cifre lette come si leggono, frasi spezzate dove la
   punteggiatura lo chiede, e per ciascuna la sua intonazione e la sua pausa.
   Niente DOM: qui dentro c'è solo testo che entra e testo che esce.

   ⚠️ PERCHÉ È UN FILE. Era un blocco dentro `App/StudIA.html` delimitato dal
   commento `@tts-puro-inizio`, e `lib/reader-parser.js` lo ritagliava da lì per
   provarlo in Node dentro un sandbox `vm`. Le prove pendevano da un COMMENTO:
   chi lo cancellava riordinando portava via 200 controlli senza accorgersene.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TtsSegmenta = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Abbreviazioni: sciolte per esteso, perché lette a sigla suonano male.
     Il punto finale si tiene solo dove l'abbreviazione può chiudere una frase
     («ecc.», «a.C.»); altrove va tolto, o spezzerebbe il periodo a metà. */
  var TTS_ABBR=[
    [/\bp\.\s*es\./gi,'per esempio'],
    [/\ba\.\s*C\.(?=\s*(?:[A-ZÀ-Þ«(]|$))/g,'avanti Cristo.'],
    [/\ba\.\s*C\./g,'avanti Cristo'],
    [/\bd\.\s*C\.(?=\s*(?:[A-ZÀ-Þ«(]|$))/g,'dopo Cristo.'],
    [/\bd\.\s*C\./g,'dopo Cristo'],
    [/\b[Ee]cc\.(?=\s*(?:[A-ZÀ-Þ«(]|$))/g,'eccetera.'],   /* niente flag «i»: il lookahead deve distinguere le maiuscole */
    [/\becc\./gi,'eccetera'],
    [/\bcfr\./gi,'confronta'],
    [/\bes\./gi,'esempio'],
    [/\bpp\.\s*(?=\d)/gi,'pagine '],
    [/\bp\.\s*(?=\d)/gi,'pagina '],
    [/\bn\.\s*(?=\d)/gi,'numero '],
    [/\bn°\s*/gi,'numero '],
    [/\bfig\.\s*/gi,'figura '],
    [/\btab\.\s*/gi,'tabella '],
    [/\bcap\.\s*/gi,'capitolo '],
    [/\bvol\.\s*/gi,'volume '],
    [/\bartt?\.\s*(?=\d)/gi,'articolo '],
    [/\bca\.\s*(?=\d)/gi,'circa '],
    [/\bdott\.ssa\s*/gi,'dottoressa '],
    [/\bdott\.\s*/gi,'dottor '],
    [/\bprof\.ssa\s*/gi,'professoressa '],
    [/\bprof\.\s*/gi,'professor '],
    [/\bsig\.ra\s*/gi,'signora '],
    [/\bsig\.\s*/gi,'signor '],
    [/\bvs\.\s*/gi,'contro '],
    [/\bNB[:.]\s*/g,'nota bene: '],
    [/\bRacc\.\s*(?=\d)/g,'Raccomandazione '],   // 55 volte nei capitoli: «(Racc. 9.1)»
    [/\bet\s+al\./gi,'e altri']
  ];
  function ttsNormalizza(s){
    s=String(s==null?'':s);
    s=s.replace(/\[\^[0-9A-Za-z]+\]/g,'');                  // note markdown superstiti
    s=s.replace(/\[\[\s*\d{1,3}\s*\]\]/g,'');               // marcatori [[n]] non risolti
    s=s.replace(/­/g,'');                              // trattini di sillabazione invisibili
    s=s.replace(/[‘’ʼ]/g,"'");               // apostrofo tipografico → dritto
    s=s.replace(/[«»“”„‟"]/g,'');       // virgolette: la voce non deve nominarle
    /* I puntini di sospensione chiudono il periodo solo se dopo ricomincia da capo;
       in mezzo a una frase sono un respiro, e farne un punto la spezzerebbe in due. */
    s=s.replace(/…\s*(?=[A-ZÀ-Þ«("])/g,'. ');
    s=s.replace(/…/g,', ');
    TTS_ABBR.forEach(function(r){ s=s.replace(r[0],r[1]); });
    s=s.replace(/([A-Za-z])[-‑](\d)/g,'$1 $2');        // DSM-5, PML-2: niente «meno»
    s=s.replace(/(\d)\s*[-‑–]\s*(\d)/g,'$1 $2');  // intervalli tipo 16-30
    s=s.replace(/\s*[—–]\s*/g,', ');              // lineette → pausa d'inciso
    s=s.replace(/\s*\(\s*/g,', ').replace(/\s*\)\s*/g,', ');// parentesi → inciso
    /* La barra fra un'unità e l'altra non è una scelta ma un rapporto: «6-7 sill/sec»
       va detto «sillabe al secondo», non «sill o sec». Prima i rapporti, poi le
       alternative vere («vero/falso», «e/o»). */
    s=s.replace(/\bsill\b(?=\s*\/)/gi,'sillabe');
    /* Il punto dell'abbreviazione può essere anche il punto fermo della frase:
       se dopo si ricomincia da capo va restituito, o due periodi si saldano. */
    s=s.replace(/\s*\/\s*[Ss]ec\.(?=\s*(?:[A-ZÀ-Þ«("]|$))/g,' al secondo.');
    s=s.replace(/\s*\/\s*[Mm]in\.(?=\s*(?:[A-ZÀ-Þ«("]|$))/g,' al minuto.');
    s=s.replace(/\s*\/\s*(?:secondi|secondo|sec\.?)(?![a-zà-ÿ])/gi,' al secondo');
    s=s.replace(/\s*\/\s*(?:minuti|minuto|min\.?)(?![a-zà-ÿ])/gi,' al minuto');
    s=s.replace(/\s*\/\s*(?:ora|h)\b/gi," all'ora");
    s=s.replace(/\be\s*\/\s*o\b/gi,'e o');          // «e/o»: la barra è già la «o»
    s=s.replace(/([A-Za-zÀ-ÿ])\s*\/\s*([A-Za-zÀ-ÿ])/g,'$1 o $2');
    /* Simboli che il motore tace: senza sostituzione le due parole si incollano
       («grosso→fine» diventa «grossofine»). La freccia vale una virgola. */
    s=s.replace(/\s*[→←↔⇒⇐⇔]\s*/g,', ');
    s=s.replace(/\s*×\s*/g,' per ').replace(/\s*÷\s*/g,' diviso ');
    s=s.replace(/≈/g,' circa uguale a ').replace(/≤/g,' minore o uguale a ')
       .replace(/≥/g,' maggiore o uguale a ').replace(/±/g,' più o meno ');
    s=s.replace(/(\d)\s*\bmin\b\.?/gi,'$1 minuti').replace(/(\d)\s*\bsec\b\.?/gi,'$1 secondi');
    s=s.replace(/%/g,' per cento').replace(/&/g,' e ').replace(/§\s*/g,'paragrafo ');
    s=s.replace(/≠/g,' diverso da ').replace(/\s=\s/g,' uguale a ');
    s=s.replace(/[•·]/g,', ');
    s=s.replace(/[\[\]{}<>|*_#`~^]/g,' ');
    s=s.replace(/\s+/g,' ');
    s=s.replace(/\s+([,.;:!?])/g,'$1');
    /* Quando due segni si toccano vince il più forte, non l'ultimo arrivato.
       Contava: le parentesi diventano virgole, e con la regola «vince l'ultimo»
       una virgola iniettata retrocedeva i due punti che introducono un elenco e i
       punti e virgola che separano le voci — misurato, l'elenco perdeva le sue
       cesure e si appiattiva. */
    s=s.replace(/\.[\s,;:]*[,;:](?=\s*[A-ZÀ-Þ«"(])/g,'.');
    s=s.replace(/\.[\s,;:]*,(?=\s*[a-zà-ÿ])/g,',');   // «ecc., ma»: la virgola regge la frase
    s=s.replace(/\.[\s,;:]*[,;:]/g,'.');
    s=s.replace(/[,;:][\s,;:]*\./g,'.');
    /* Un punto interrogativo seguito dal punto che chiudeva la citazione fra
       virgolette («…al bambino?».) veniva letto come un'affermazione: misurata,
       l'intonazione finale crollava da 258 a 148 Hz. */
    s=s.replace(/([?!])[\s,;:]*\./g,'$1');
    s=s.replace(/([?!])[\s,;:]*[,;:]/g,'$1');
    s=s.replace(/([,;:])[\s,;:]*([,;:])/g,function(m){
      return m.indexOf(':')>=0 ? ':' : (m.indexOf(';')>=0 ? ';' : ',');
    });
    s=s.replace(/^[\s,;:.]+/,'');
    return s.trim();
  }
  /* Taglio in frasi. Non basta spezzare a ogni punto: «1.000», le iniziali
     puntate e le abbreviazioni sciolte con il punto chiudono una frase solo se
     quello che segue comincia davvero da capo (maiuscola, cifra, o fine testo). */
  function ttsFrasi(s){
    s=String(s==null?'':s).trim(); if(!s) return [];
    var out=[], inizio=0, i=0, n=s.length;
    while(i<n){
      var ch=s.charAt(i);
      if(ch==='.'||ch==='!'||ch==='?'){
        var j=i; while(j+1<n && /[.!?]/.test(s.charAt(j+1))) j++;
        var prima=s.charAt(i-1), dopo=s.slice(j+1);
        var numero=(ch==='.') && /\d/.test(prima) && /^\d/.test(dopo);
        var iniziale=(ch==='.') && /[A-ZÀ-Þ]/.test(prima) && (i<2 || /[\s(«"']/.test(s.charAt(i-2)));
        var apre=/^\s*$/.test(dopo) || /^\s+["'«(‘“A-ZÀ-ÖØ-Þ0-9]/.test(dopo);
        if(!numero && !iniziale && apre){ out.push(s.slice(inizio,j+1).trim()); inizio=j+1; }
        i=j+1; continue;
      }
      i++;
    }
    var coda=s.slice(inizio).trim(); if(coda) out.push(coda);
    return out.filter(function(f){ return /[A-Za-zÀ-ÿ0-9]/.test(f); });
  }
  /* I periodi molto lunghi vanno detti a respiri: si taglia su punto e virgola o
     due punti se ci sono, altrimenti sulla virgola, mai a metà di un sintagma. */
  function ttsSpezzaLunga(f,max){
    f=String(f==null?'':f).trim(); max=max||240;
    if(f.length<=max) return f?[f]:[];
    var parti=[], resto=f;
    while(resto.length>max){
      var min=Math.floor(max*0.35), taglio=-1, forte=-1, re=/[;:,]/g, m;
      while((m=re.exec(resto))){
        // la virgola fra due cifre è il separatore decimale: tagliare lì spezza
        // «-1,5» in «-1, 5», e il motore ci mette dentro mezzo secondo di pausa
        if(/\d/.test(resto.charAt(m.index-1)) && /\d/.test(resto.charAt(m.index+1))) continue;
        if(m.index>=min && m.index<max){ taglio=m.index; if(/[;:]/.test(m[0])) forte=m.index; }
      }
      if(forte>=0) taglio=forte;
      if(taglio<0){ taglio=resto.lastIndexOf(' ',max); if(taglio<min) break; }
      parti.push(resto.slice(0,taglio+1).trim());
      resto=resto.slice(taglio+1).trim();
    }
    if(resto) parti.push(resto);
    return parti;
  }
  /* Da punteggiatura e ruolo del blocco alla prosodia: quanto respirare dopo,
     quanto alzare la voce, quanto rallentare. I titoli si annunciano più lenti e
     con una pausa prima; le domande salgono di tono; la virgola stacca appena. */
  function ttsProsodia(t,tipo){
    var fine=(String(t).match(/[.!?;:,]\s*$/)||[''])[0].trim();
    var p={ pausa:300, pitch:1, rate:1, prima:0, tipo:tipo||'frase' };
    if(tipo==='titolo'){ p.rate=.94; p.pitch=1.03; p.pausa=560; p.prima=420; }
    else if(tipo==='etichetta'){ p.rate=.95; p.pitch=1.02; p.pausa=460; p.prima=380; }
    else if(tipo==='voce'){ p.pausa=380; }
    if(fine==='?'){ p.pitch=Math.max(p.pitch,1.07); p.rate=Math.min(p.rate,.98); p.pausa=Math.max(p.pausa,430); }
    else if(fine==='!'){ p.pitch=Math.max(p.pitch,1.04); p.rate=Math.max(p.rate,1.02); p.pausa=Math.max(p.pausa,410); }
    else if(fine===':'){ p.pausa=Math.max(p.pausa,320); }
    else if(fine===';'){ p.pausa=Math.max(p.pausa,280); }
    else if(fine===','){ p.pausa=180; }
    return p;
  }
  /* testo grezzo di un blocco → segmenti pronti da pronunciare */
  function ttsSegmenti(testo,tipo){
    tipo=tipo||'frase';
    var t=ttsNormalizza(testo);
    if(!t) return [];
    // titoli ed elenchi arrivano senza punto: senza, la voce li lascia sospesi
    if((tipo==='titolo'||tipo==='voce'||tipo==='etichetta') && !/[.!?:;]$/.test(t)) t+='.';
    var segs=[];
    ttsFrasi(t).forEach(function(f){
      // 200 caratteri ≈ 13 secondi di parlato: sotto la soglia oltre la quale
      // certe implementazioni di speechSynthesis troncano l'utterance
      var parti=ttsSpezzaLunga(f,200);
      parti.forEach(function(p,k){
        var s=ttsProsodia(p,tipo); s.t=p;
        if(k<parti.length-1) s.pausa=Math.min(s.pausa,170);   // stesso periodo: respiro corto
        if(k>0) s.prima=0;
        segs.push(s);
      });
    });
    if(segs.length) segs[segs.length-1].fineBlocco=true;
    return segs;
  }

  return {
    ttsNormalizza: ttsNormalizza,
    ttsFrasi: ttsFrasi,
    ttsSpezzaLunga: ttsSpezzaLunga,
    ttsProsodia: ttsProsodia,
    ttsSegmenti: ttsSegmenti
  };
}));
