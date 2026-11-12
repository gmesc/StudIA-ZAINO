/* Le selezioni di CodeMirror usano offset, quelle di lettura Range DOM.
   Entrambe passano dalle stesse azioni e dallo stesso archivio di FONTI. */
(function(){
 'use strict';
 const segni=new WeakMap();
 function valida(range){
  const a=range?.appunto;
  return !!a&&a.stato.cur?.file===a.file&&a.stato.courseId===corsoAttivo()&&a.stato.versione===a.versione&&a.stato.mde.value()===a.testo;
 }
 function menu(s,e){
  if(!s.cur||s.courseId!==corsoAttivo())return false;
  const cm=s.mde.codemirror,selezioni=cm.listSelections();
  if(selezioni.length!==1||!cm.somethingSelected())return false;
  const from=cm.getCursor('from'),to=cm.getCursor('to'),pos=cm.coordsChar({left:e.clientX,top:e.clientY});
  const inizio=cm.indexFromPos(from),fine=cm.indexFromPos(to),clic=cm.indexFromPos(pos);
  if(clic<inizio||clic>fine||pos.outside||(clic===fine&&e.clientX>cm.charCoords(to,'window').left))return false;
  const testo=cm.getRange(from,to);if(!testo.trim())return false;
  e.preventDefault();e.stopPropagation();
  document.querySelectorAll('.note-strumenti-menu:popover-open').forEach(p=>p.hidePopover());
  const range={appunto:{tipo:'appunto',file:s.cur.file,stato:s,versione:s.versione,testo:cm.getValue()},offset:{inizio,fine}};
  selMenuApri(e.clientX,e.clientY,{testo,range});
  return true;
 }
 function superficie(range){
  const el=range.startContainer?.parentElement;
  const radice=el?.closest('.editor-preview,.editor-preview-side,.note-a4');
  if(!radice||!radice.contains(range.endContainer))return null;
  const s=noteStati().find(s=>s.cur&&s.courseId===corsoAttivo()&&noteHost(s)?.contains(radice));
  return s?{tipo:'appunto',file:s.cur.file,stato:s,radice}:null;
 }
 function superfici(){
  return noteStati().flatMap(s=>!s.cur||s.courseId!==corsoAttivo()?[]:[...noteHost(s).querySelectorAll('.editor-preview-active,.editor-preview-active-side,.note-a4')].filter(r=>r.getClientRects().length&&!r.hidden).map(radice=>({tipo:'appunto',file:s.cur.file,stato:s,radice})));
 }
 function disegnaStato(s){
  const cm=s.mde?.codemirror;if(!cm)return;
  cm.operation(()=>{
   (segni.get(s)||[]).forEach(m=>m.clear());segni.set(s,[]);
   if(!s.cur||s.courseId!==corsoAttivo())return;
   if(EVIDENZE.corso!==corsoAttivo())evidenzeCarica();
   const v=EvidenzeStrati.visibili(evidenzeDi({tipo:'appunto',file:s.cur.file}),evViste());
   const r=EvidenzeAncoraggio.risolvi(cm.getValue(),v);
   const tutti=r.trovate.concat(r.sovrapposte),pile=EvidenzeStrati.livelli(tutti.map(t=>({id:t.voce.id,tratto:evTrattoDi(t.voce),inizio:t.inizio,fine:t.fine})));
   for(const t of tutti){
    const col=t.voce.colore||'currentColor';
    const css=evTrattoDi(t.voce)==='overlay'?'background-color:'+evidenzeFondo(col,pile.per[t.voce.id]?.pila||1)+';color:#111':'text-decoration:underline '+col+' var(--ev-spessore);text-underline-offset:var(--ev-stacco)';
    segni.get(s).push(cm.markText(cm.posFromIndex(t.inizio),cm.posFromIndex(t.fine),{className:'note-evidenza',css,title:t.voce.nota||'Parola chiave · clic destro sulla selezione'}));
   }
  });
 }
 function disegna(){noteStati().forEach(disegnaStato);}
 function installa(s){
  let timer;const cm=s.mde.codemirror;
  cm.on('changes',()=>{
   if(SELMENU.range?.appunto?.stato===s)selMenuChiudi();
   clearTimeout(timer);timer=setTimeout(()=>disegnaStato(s),150);
  });
  cm.on('scroll',()=>{if(SELMENU.range?.appunto?.stato===s)selMenuChiudi();});
  disegnaStato(s);
 }
 function vai(ev,opt={}){
  let s=noteStati().find(s=>s.cur?.file===ev.appunto&&s.courseId===corsoAttivo())||null;
  if(opt.anteprima){
   s=s||noteStati().find(n=>n!==opt.da&&!n.cur&&(!n.mde||!n.mde.value().trim()));
   if(!s||(!bancoVisibile(s.id)&&!bancoFormaPiuGrande()&&!bancoBlocchiVisibili().some(b=>!bancoDisponibile(bancoStrumentoIn(b))))){toast('Non c’è un banco libero: chiudine uno per aprire l’appunto di origine.',false);return;}
  }
  s=s||noteStatoAttivo();
  if(!noteOpen(ev.appunto,s))return;
  if(opt.anteprima){
   if(AppuntiA4.attiva(opt.da)){AppuntiA4.scegli(s,'a4');}
   else{if(!AppuntiA4.scegli(s,'scrittura'))return;if(!s.mde.isPreviewActive())s.mde.togglePreview();}
   return;
  }
  if(!AppuntiA4.scegli(s,'scrittura'))return;
  const cm=s.mde.codemirror,r=EvidenzeAncoraggio.risolvi(cm.getValue(),[ev]),t=r.trovate[0];
  s.puntoRicerca=true;
  if(t){cm.setSelection(cm.posFromIndex(t.inizio),cm.posFromIndex(t.fine));cm.scrollIntoView({from:cm.posFromIndex(t.inizio),to:cm.posFromIndex(t.fine)},80);cm.focus();}
  else toast('Appunto aperto: il testo della parola chiave è stato modificato.',false);
 }
 window.EvidenzeAppunti={valida,menu,superficie,superfici,disegna,installa,vai};
})();
