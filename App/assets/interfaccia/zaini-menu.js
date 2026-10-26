(function(){
 'use strict';
 var ordine={criterio:'alfa',verso:'asc'},apertura=0;
 try{ordine=ParoleOrdine.stato(JSON.parse(localStorage.getItem('studia.zaini.ordine')));}catch(e){}
 var pop=document.getElementById('zainiMenu'),bottone=document.getElementById('zainoScegli');
 function disegna(){
  var alfa=ordine.criterio==='alfa'?ParoleOrdine.etichetta(ordine):'AZ';
  var data=ordine.criterio==='data'?ordine:{criterio:'data',verso:'desc'};
  var dataTitolo=ordine.criterio==='data'?(ordine.verso==='asc'?'Creazione: dal meno recente al più recente — premi per invertire':'Creazione: dal più recente al meno recente — premi per invertire'):'Ordina per data di creazione: più recenti prima';
  pop.innerHTML='<div class="tbar"><strong>Zaini</strong><span class="tbspazio"></span>'+
   '<button id="zainiAlfa" class="tbtn" type="button" data-zaini-ordine="alfa" aria-pressed="'+(ordine.criterio==='alfa')+'" title="Ordina '+(alfa==='AZ'?'da A a Z':'da Z a A')+'">'+alfa+'</button><span class="tbsep"></span>'+
   '<button id="zainiData" class="tbtn" type="button" data-zaini-ordine="data" aria-pressed="'+(ordine.criterio==='data')+'" title="'+dataTitolo+'" aria-label="'+dataTitolo+'">'+UiIcone.svg('calendar-days')+UiIcone.svg(ParoleOrdine.freccia(data))+'</button></div><div class="zaini-elenco"></div>'+
   '<div class="tbar"><button id="zainiCrea" class="tbtn" type="button" title="Crea uno zaino nuovo">'+UiIcone.svg('plus')+' Crea uno zaino</button></div>';
  var lista=ParoleOrdine.ordina((MODO.zaini||[]).map(function(z){return {...z,exact:z.title};}),ordine);
  pop.querySelector('.zaini-elenco').innerHTML=lista.length?lista.map(function(z){
   return '<button type="button" class="zaini-voce" data-zaino-scegli="'+escHtml(z.id)+'" aria-current="'+(z.id===zainoAttivo())+'" title="'+escHtml(z.title+' · '+ParoleOrdine.data(z.creato)+(z.erroreConteggio?' · '+z.erroreConteggio:''))+'"><span>'+escHtml(z.title)+'</span><span class="zaini-conto">'+(z.documenti==null?'Conteggio non disponibile':z.documenti+' PDF')+'</span></button>';
  }).join(''):'<p class="zaini-stato">Nessuno zaino. Crea il primo.</p>';
  popPosiziona(pop,bottone);
 }
 window.zainiMenuApri=async function(){
  if(pop.hasAttribute('open')){closePops();bottone.focus();return;}
  var turno=++apertura;pop.innerHTML='<p class="zaini-stato" role="status">Leggo gli zaini…</p>';
  popAt(pop,bottone);bottone.setAttribute('aria-expanded','true');
  try{
   var lista=await window.vault.zaino.list();
   if(turno!==apertura||!pop.hasAttribute('open'))return;
   if(!Array.isArray(lista))throw Error(lista?.error||'Elenco non disponibile');
   MODO.zaini=lista;disegna();
   (pop.querySelector('[aria-current="true"]')||pop.querySelector('.zaini-voce')||document.getElementById('zainiCrea')).focus();
  }catch(e){if(pop.hasAttribute('open'))pop.innerHTML='<p class="zaini-stato" role="alert">'+escHtml(e.message)+'</p>';}
 };
 pop.addEventListener('click',function(e){
  e.stopPropagation(); // Il ridisegno stacca il bersaglio: il listener esterno non deve scambiarlo per un clic fuori.
  var ord=e.target.closest('[data-zaini-ordine]');
  if(ord){ordine=ParoleOrdine.scegli(ordine,ord.dataset.zainiOrdine);try{localStorage.setItem('studia.zaini.ordine',JSON.stringify(ordine));}catch(err){}var id=ord.id;disegna();document.getElementById(id).focus();return;}
  var voce=e.target.closest('[data-zaino-scegli]');if(voce){closePops();cambiaZaino(voce.dataset.zainoScegli);bottone.focus();return;}
  if(e.target.closest('#zainiCrea'))zainoPopApri(bottone);
 });
 pop.addEventListener('keydown',function(e){
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePops();bottone.focus();return;}
  if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
  e.preventDefault();var v=Array.from(pop.querySelectorAll('button:not(:disabled)')),n=v.indexOf(document.activeElement);
  n=e.key==='Home'?0:e.key==='End'?v.length-1:(n+(e.key==='ArrowDown'?1:-1)+v.length)%v.length;v[n]?.focus();
 });
 document.getElementById('matZaino').addEventListener('change',async function(e){
  var id=e.target.value;MATERIALI.zaino=id;MATERIALI.lista=null;
  document.getElementById('matLista').innerHTML='<div class="ep-empty">Carico le fonti…</div>';
  try{await caricaMateriali();if(id===MATERIALI.zaino)disegnaMateriali();}
  catch(err){if(id===MATERIALI.zaino)document.getElementById('matLista').innerHTML='<div class="ep-empty">'+escHtml(err.message)+'</div>';}
 });
}());
