/* Un contenitore per raccolte e anteprime. Gli archivi e i visualizzatori restano quelli esistenti. */
(function(root){
  'use strict';
  var C=root.AlbumCatalogo, p=C.preferenze(), chiave='', anteprima='', media=[], errore='', giro=0;
  var titoli={ritagli:'Ritagli',immagini:'Immagini',video:'Video',audio:'Audio'};
  function el(id){return document.getElementById(id);}
  function contesto(){
    var k='studia.album.'+(root.vault?.path||'')+'.'+root.corsoAttivo();
    if(k===chiave) return;
    chiave=k; anteprima=''; media=[]; errore=''; giro++;
    try{p=C.preferenze(JSON.parse(localStorage.getItem(k)||'null'));}catch(_){p=C.preferenze();}
  }
  function salva(){try{localStorage.setItem(chiave,JSON.stringify(p));}catch(_){} }
  function init(){
    var host=el('albumViste'); if(!host) return;
    ['albumPane','fotoPane','playerPane'].forEach(function(id){var n=el(id);if(n && n.parentNode!==host) host.appendChild(n);});
    contesto(); facce();
  }
  function facce(){
    var host=el('albumSpazio'); if(!host) return;
    host.dataset.tipo=p.tipo; host.dataset.anteprima=anteprima;
    host.style.setProperty('--album-card',p.dimensione+'px');
    host.style.setProperty('--album-immagine',Math.round(p.dimensione*.7)+'px');
    host.querySelectorAll('[data-album-tab]').forEach(function(b){b.setAttribute('aria-pressed',String(b.dataset.albumTab===p.tipo));});
    el('albumDimensione').value=p.dimensione;
    el('albumOrdina').textContent=C.etichetta(p);
    el('albumOrdina').title='Inverti ordine '+(p.criterio==='nome'?'alfabetico':'per data di caricamento');
    el('albumOrdina').setAttribute('aria-label',el('albumOrdina').title+': '+C.etichetta(p));
    el('albumOrdineMenu').querySelectorAll('[data-album-ordine]').forEach(function(b){b.setAttribute('aria-checked',String(b.dataset.albumOrdine===p.criterio));});
    el('albumPane').hidden=!!anteprima || p.tipo!=='ritagli';
    el('fotoPane').hidden=anteprima==='player' || (!anteprima && p.tipo!=='immagini');
    el('playerPane').hidden=anteprima!=='player';
    el('albumMediaLista').hidden=!!anteprima || !['audio','video'].includes(p.tipo);
  }
  function chiudi(){
    var prima=anteprima; anteprima='';
    if(prima==='foto') root.fotoChiudiVista();
    if(prima==='player') root.playerChiudi();
    facce();
  }
  function scegli(tipo){
    contesto(); chiudi(); p.tipo=C.tipi.includes(tipo)?tipo:'ritagli'; salva();
    root.albumAggiorna(); root.fotoAggiorna(); disegnaMedia(); facce();
  }
  function apri(tipo,quale){
    contesto();
    if(anteprima && anteprima!==quale) chiudi();
    p.tipo=tipo; anteprima=quale; salva(); facce(); root.bancoMostra('album'); root.bancoAttivaBlocco(root.bancoBloccoDi('album'));
  }
  function ritorna(quale){if(anteprima===quale){anteprima='';facce();disegnaMedia();}}
  function voci(){
    var a=(root.ALBUMVISTA?.voci||[]).concat(root.FOTOVISTA?.voci||[]).map(function(v){return Object.assign({},v,{tipo:v.origine==='foto'?'immagini':'ritagli'});});
    return a.concat(media);
  }
  function apriVoce(v){
    root.closePops();
    if(v.tipo==='audio' || v.tipo==='video') root.playerApri(v.file,null,v.nome);
    else root.fotoApri(v.id);
  }
  function disegnaMedia(){
    var lista=el('albumMediaLista'); if(!lista) return;
    var viste=C.ordina(media.filter(function(v){return v.tipo===p.tipo;}),p);
    if(errore){lista.innerHTML='<div class="alvuoto">'+root.escHtml(errore)+'</div>';return;}
    if(!viste.length){lista.innerHTML='<div class="alvuoto">Nessun '+(p.tipo==='audio'?'audio':'video')+'. Trascina i file sulla finestra per importarli.</div>';return;}
    lista.innerHTML=viste.map(function(v){
      var src=root.vault.srcUrl(v.file,root.corsoAttivo()), esc=root.escHtml;
      return '<button type="button" class="alcard" data-album-media="'+esc(v.file)+'" title="Apri '+esc(v.nome)+'">'+
        (v.tipo==='video'?'<video preload="metadata" muted tabindex="-1" aria-hidden="true" src="'+esc(src)+'#t=0.1"></video>':'<span class="albumAudio" aria-hidden="true">'+root.UiIcone.svg('music')+'</span>')+
        '<span class="alcap">'+esc(v.nome)+'</span></button>';
    }).join('');
  }
  async function aggiorna(){
    init(); var mio=++giro, corso=root.corsoAttivo();
    root.albumAggiorna(); root.fotoAggiorna();
    try{
      var dati=corso?await root.vault.corpus.list(corso):[];
      if(mio!==giro || corso!==root.corsoAttivo()) return;
      media=dati.filter(function(v){return v.tipo==='media' && root.Lettore.tipoDi(v.name);}).map(function(v){
        return {file:v.name,nome:root.FontiNomi.visibile(v.name),creato:v.creato,tipo:root.Lettore.tipoDi(v.name)};
      }); errore='';
    }catch(e){if(mio!==giro)return;media=[];errore='Materiali non leggibili: '+e.message;}
    disegnaMedia(); facce(); cerca();
  }
  function cerca(){
    var box=el('albumCercaRisultati'); if(!box) return;
    var risultati=C.ordina(C.cerca(voci(),el('albumCercaInput').value),p), esc=root.escHtml;
    box.innerHTML=C.tipi.map(function(tipo){
      var r=risultati.filter(function(v){return v.tipo===tipo;});if(!r.length)return '';
      return '<div class="sr-lesson">'+titoli[tipo]+' · '+r.length+'</div>'+r.map(function(v){
        return '<button class="sr-item" type="button" data-album-risultato="'+esc(v.id||v.file)+'"><span class="sr-head">'+esc(C.nome(v))+'</span>'+
          (v.materiale?'<span class="sr-snip">'+esc(v.materiale)+'</span>':'')+'</button>';
      }).join('');
    }).join('') || '<div class="sr-empty">Nessun materiale trovato.</div>';
    var problemi=Array.from(new Set([errore,root.ALBUMVISTA?.errore,root.FOTOVISTA?.errore].filter(Boolean)));
    problemi.forEach(function(t){box.innerHTML+='<div class="sr-empty">'+esc(t)+'</div>';});
    if(el('albumCercaPop').hasAttribute('open'))root.popPosiziona(el('albumCercaPop'),el('albumCerca'));
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest?.('[data-album-tab], [data-album-media], [data-album-risultato], [data-album-ordine], #albumOrdina, #albumOrdine, #albumCerca');
    if(!b)return;
    if(b.dataset.albumTab){scegli(b.dataset.albumTab);return;}
    if(b.dataset.albumMedia){var m=media.find(function(v){return v.file===b.dataset.albumMedia;});if(m)apriVoce(m);return;}
    if(b.dataset.albumRisultato){var v=voci().find(function(v){return (v.id||v.file)===b.dataset.albumRisultato;});if(v)apriVoce(v);return;}
    if(b.id==='albumCerca'){root.popAt(el('albumCercaPop'),b);cerca();el('albumCercaInput').focus();aggiorna();return;}
    if(b.id==='albumOrdine'){root.popAt(el('albumOrdineMenu'),b);return;}
    if(b.dataset.albumOrdine){p.criterio=b.dataset.albumOrdine;root.closePops();}
    else p.verso=p.verso==='asc'?'desc':'asc';
    salva();root.albumAggiorna();root.fotoAggiorna();disegnaMedia();facce();cerca();
  });
  document.addEventListener('input',function(e){
    if(e.target.id==='albumDimensione'){p.dimensione=Number(e.target.value);salva();facce();}
    if(e.target.id==='albumCercaInput')cerca();
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Enter' && e.target.matches?.('#albLista .alcard, #fotoLista .alcard')){e.preventDefault();root.fotoApri(e.target.dataset.id);return;}
    if(e.key!=='Escape' || !anteprima || !root.bancoVisibile('album'))return;
    // Esc chiude prima un menu o un dialogo, poi l'anteprima del riquadro attivo.
    if(document.querySelector('.popmenu[open], dialog[open], #uiModal[open], .ctx-menu.open, #albMenu.open, #albBolla.open'))return;
    if(Array.from(document.querySelectorAll('[aria-modal="true"]')).some(function(d){return d.getBoundingClientRect().width>0;}))return;
    if(root.bancoStrumentoIn(root.bancoBloccoAttivo())!=='album')return;
    e.preventDefault();e.stopImmediatePropagation();chiudi();
  },true);
  root.AlbumSpazio={init:init,aggiorna:aggiorna,scegli:scegli,apri:apri,ritorna:ritorna,
    preferenze:function(){contesto();return p;},visibile:function(quale){return quale==='player'?anteprima==='player':anteprima==='foto'||(!anteprima && p.tipo==='immagini');}};
})(window);
