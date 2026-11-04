/* Comandi a celle: si sostituisce solo l'intervallo originale, in un passo Undo. */
(function(){
 'use strict';
 const T=AppuntiTabelle,E=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 function bottone(t,fn){const b=E('button',t,'tbtn');b.type='button';b.onclick=fn;return b;}
 function apri(s,box){
  s=s||noteStatoAttivo();if(!s.mde||!s.cur){toast('Apri un appunto per inserire una tabella.',false);return;}
  mdbChiudi(true,s);
  const cm=s.mde.codemirror,originale=cm.getValue(),versione=s.versione,file=s.cur.file;
  let da=box?+box.dataset.da:null,a=box?+box.dataset.a:null,tab=null;
  if(da!==null){try{tab=T.leggi(originale.split('\n'),da)?.tabella;}catch(e){toast(e.message,false);return;}}
  else{const lines=originale.split('\n'),riga=cm.getCursor().line;for(let i=0;i<lines.length;i++){let t;try{t=T.leggi(lines,i);}catch(e){}if(t){if(i<=riga&&riga<=t.fine){tab=t.tabella;da=i;a=t.fine;break;}i=t.fine;}}}
  tab=tab||{version:1,rows:[['Colonna 1','Colonna 2'],['',''],['','']],header:true,style:{}};
  const nuovo=da===null,from=nuovo?cm.getCursor('from'):{line:da,ch:0},to=nuovo?cm.getCursor('to'):{line:a,ch:cm.getLine(a).length};
  const dialog=E('dialog',null,'note-tabella-dialog tbar-ctl'),bar=E('div',null,'tbar note-tabella-bar'),sezioni=E('div',null,'tbar note-tabella-sezioni'),opzioni=E('div',null,'note-tabella-opzioni'),griglia=E('div',null,'note-tabella-celle'),errore=E('output');errore.setAttribute('role','status');
  const M=PresentaModello,aiuto='Clicca una cella per scegliere dove aggiungere o eliminare righe e colonne. Puoi usare la formattazione Markdown nelle celle.';
  let r=0,c=0,attivo,sezione='testo',aperto;
  function popup(classe,contenuto,x,y){aperto?.remove();const pop=E('div',null,'popmenu presenta-menu '+classe);pop.popover='auto';pop.append(contenuto);dialog.append(pop);pop.showPopover();const b=pop.getBoundingClientRect();pop.style.left=Math.max(8,Math.min(x,innerWidth-b.width-8))+'px';pop.style.top=Math.max(8,Math.min(y,innerHeight-b.height-8))+'px';pop.addEventListener('toggle',e=>{if(e.newState==='closed')pop.remove();});aperto=pop;return pop;}
  const typo=ZainoTipografia.crea({popup,contesto:()=>()=>dialog.open});
  function aggiornaCelle(){for(const area of griglia.querySelectorAll('textarea')){const i=+area.dataset.riga,st=tab.style;Object.assign(area.style,{fontFamily:st.font||M.CARATTERI.zaino.css,fontSize:(st.size||17)+'px',fontWeight:st.weight||(st.bold?700:400),fontStyle:st.italic?'italic':'normal',textDecoration:st.underline?'underline':'none',textAlign:st.align||'left',lineHeight:st.lineHeight||1.4,color:!i&&tab.header?st.headerColor||st.color||'var(--ink)':st.color||'var(--ink)',background:!i&&tab.header?st.headerBackground||st.background||'var(--bg)':st.background||'var(--bg)'});}}
  function disegna(){griglia.replaceChildren();griglia.style.gridTemplateColumns='repeat('+tab.rows[0].length+',minmax(120px,1fr))';tab.rows.forEach((row,i)=>row.forEach((v,j)=>{const lab=E('label','Riga '+(i+1)+' · Colonna '+(j+1)),area=E('textarea');area.value=v;area.dataset.riga=i;area.title=aiuto;area.setAttribute('aria-label',lab.textContent);area.oninput=()=>tab.rows[i][j]=area.value;area.onfocus=()=>{r=i;c=j;attivo=area;};lab.append(area);griglia.append(lab);}));aggiornaCelle();attivo=griglia.children[r*tab.rows[0].length+c]?.querySelector('textarea');}
  function cambia(k,v){tab.style[k]=v;aggiornaCelle();}
  function elimina(asse){if((asse==='riga'?tab.rows.length:tab.rows[0].length)<=1)return;const pieni=asse==='riga'?tab.rows[r].some(Boolean):tab.rows.some(row=>row[c]);if(pieni&&!confirm('Eliminare '+asse+' e contenuto?'))return;if(asse==='riga'){tab.rows.splice(r,1);r=Math.max(0,r-1);}else{tab.rows.forEach(row=>row.splice(c,1));c=Math.max(0,c-1);}disegna();attivo?.focus();}
  function campo(nome,key,{tipo='number',base,min,max,step,scelte,classe=''}={}){const lab=E('label',null,'presenta-campo '+classe),input=E(scelte?'select':'input');input.setAttribute('aria-label',nome);if(scelte)for(const [v,n]of scelte)input.append(new Option(n,v));else{input.type=tipo;if(min!=null)input.min=min;if(max!=null)input.max=max;if(step)input.step=step;}input.value=tab.style[key]??base;input.onchange=()=>{const v=tipo==='number'&&!scelte?+input.value:scelte&&typeof base==='number'?+input.value:input.value;if(tipo==='number'&&!scelte&&!input.checkValidity()){input.reportValidity();return;}cambia(key,v);};lab.append(E('span',nome),input);return lab;}
  function testo(){const box=E('div',null,'presenta-tipografia'),fontId=Object.keys(M.CARATTERI).find(k=>M.CARATTERI[k].css===tab.style.font||M.CARATTERI[k].nome===tab.style.font)||'zaino';
   box.append(typo.sceltaCarattere('Font',fontId,id=>{cambia('font',M.CARATTERI[id].css);if(!PresentaTesto.pesi(id).includes(tab.style.weight))delete tab.style.weight;mostra();}),typo.sceltaPeso('Peso',fontId,tab.style.weight||(tab.style.bold?700:400),v=>{cambia('weight',v);tab.style.bold=v>=600;mostra();}),campo('Dimensione','size',{base:17,min:8,max:100,classe:'presenta-dimensione'}));
   const formati=E('div',null,'tbar presenta-bar presenta-formati');
   for(const [k,n,l]of [['bold','Grassetto','G'],['italic','Corsivo','C'],['underline','Sottolineato','S']]){const b=bottone(l,()=>{cambia(k,!tab.style[k]);if(k==='bold')delete tab.style.weight;mostra();});b.title=n+' · intera tabella';b.setAttribute('aria-label',n);b.dataset.formato=k;b.setAttribute('aria-pressed',String(!!tab.style[k]));formati.append(b);}
   box.append(formati,typo.sceltaAllineamento('Allineamento del testo',tab.style.align||'left',false,v=>cambia('align',v)),typo.sceltaAllineamento('Posizione nella cella',({top:'start',middle:'center',bottom:'end'})[tab.style.verticalAlign]||'start',true,v=>cambia('verticalAlign',({start:'top',center:'middle',end:'bottom'})[v])),campo('Interlinea','lineHeight',{base:1.4,scelte:[[1,'Compatta · 1'],[1.15,'Stretta · 1,15'],[1.4,'Normale · 1,4'],[1.6,'Ampia · 1,6'],[2,'Doppia · 2']],classe:'presenta-interlinea'}));
   opzioni.append(box);
   const dettagli=E('div',null,'tbar note-tabella-formati-cella');for(const [nome,segno]of [['Grassetto nella cella','**'],['Corsivo nella cella','*'],['Codice nella cella','`']])dettagli.append(bottone(nome,()=>{if(!attivo)return;const da=attivo.selectionStart,a=attivo.selectionEnd,v=tab.rows[r][c];tab.rows[r][c]=v.slice(0,da)+segno+v.slice(da,a)+segno+v.slice(a);attivo.value=tab.rows[r][c];attivo.focus();attivo.setSelectionRange(da+segno.length,a+segno.length);}));opzioni.append(dettagli);
  }
  function mostra(){opzioni.replaceChildren();for(const b of sezioni.children)b.setAttribute('aria-selected',String(b.dataset.sezione===sezione));if(sezione==='testo')testo();
   if(sezione==='bordi'){const box=E('div',null,'presenta-tipografia');box.append(campo('Bordi','borderMode',{base:'rows',scelte:[['rows','Righe'],['grid','Griglia'],['none','Nessuno']]}),campo('Tratto','borderStyle',{base:'solid',scelte:[['solid','Continuo'],['dashed','Tratteggiato'],['dotted','Puntinato']]}),campo('Spessore','borderWidth',{base:1,min:0,max:6,step:.5}),campo('Colore dei bordi','borderColor',{tipo:'color',base:'#999999'}));opzioni.append(box);}
   if(sezione==='colore'){const box=E('div',null,'presenta-tipografia');for(const [nome,key,base]of [['Testo','color','#111111'],['Sfondo','background','#ffffff'],['Testo intestazione','headerColor','#111111'],['Sfondo intestazione','headerBackground','#ffffff']])box.append(campo(nome,key,{tipo:'color',base}));opzioni.append(box);}
  }
  const stile=bottone('Stile',()=>{const lista=E('div',null,'note-tabella-stili');for(const tema of Object.values(M.STILI)){const b=bottone(tema.nome,()=>{tab=T.daTema(tab,tema,M.CARATTERI[tema.font].css,M.contrasto(tema.accento));aperto.hidePopover();disegna();mostra();}),sample=E('div',null,'note-tabella-sample');sample.innerHTML=T.html(T.daTema({version:1,header:true,rows:[['A','B'],['1','2'],['3','4']]},tema,M.CARATTERI[tema.font].css,M.contrasto(tema.accento)));b.setAttribute('aria-label',tema.nome);b.prepend(sample);lista.append(b);}const b=stile.getBoundingClientRect();popup('note-tabella-presets',lista,b.left,b.bottom+4);});stile.setAttribute('aria-haspopup','menu');
  bar.append(E('strong','Tabella'),bottone('+ Riga',()=>{if(tab.rows.length>=50){errore.textContent='Massimo 50 righe.';return;}tab.rows.splice(r+1,0,tab.rows[0].map(()=>''));r++;disegna();attivo?.focus();}),bottone('+ Colonna',()=>{if(tab.rows[0].length>=20){errore.textContent='Massimo 20 colonne.';return;}tab.rows.forEach(row=>row.splice(c+1,0,''));c++;disegna();attivo?.focus();}),bottone('Elimina riga',()=>elimina('riga')),bottone('Elimina colonna',()=>elimina('colonna')),stile,E('span',null,'tbspazio'),bottone('Annulla',()=>dialog.close()),bottone('Applica',()=>{
   try{if(s.versione!==versione||s.cur?.file!==file||cm.getValue()!==originale)throw Error('L’appunto è cambiato. Chiudi e riapri la tabella.');
    cm.replaceRange((nuovo?'\n\n':'')+T.scrivi(tab)+(nuovo?'\n\n':''),from,to,'+tabella');noteAnteprimaRidisegna(s);dialog.close();
   }catch(e){errore.textContent=e.message;}
  }));
  sezioni.setAttribute('role','tablist');for(const [id,n]of [['testo','Testo'],['bordi','Bordi'],['colore','Colore']]){const b=bottone(n,()=>{sezione=id;mostra();});b.dataset.sezione=id;b.setAttribute('role','tab');sezioni.append(b);}
  const header=E('label',null,'note-tabella-intestazione'),check=E('input');check.type='checkbox';check.checked=tab.header;check.onchange=()=>{tab.header=check.checked;aggiornaCelle();};header.append(check,E('span','Prima riga di intestazione'));opzioni.id='noteTabellaOpzioni';opzioni.setAttribute('role','tabpanel');
  dialog.setAttribute('aria-label','Modifica tabella negli appunti');dialog.append(bar,sezioni,opzioni,header,griglia,errore);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);disegna();mostra();dialog.showModal();griglia.querySelector('textarea').focus();
 }
 function incolla(e){
  const s=noteStatoDaNodo(e.target);if(!s?.cur||!s.mde||e.target.closest('.editor-toolbar'))return;
  const testo=e.clipboardData?.getData('text/plain')||'';if(!testo.startsWith('```zaino-tabella\n'))return;
  e.preventDefault();e.stopPropagation();try{const t=T.leggi(testo.split('\n'));if(!t||t.fine!==testo.trim().split('\n').length-1)throw Error('Tabella copiata non valida.');mdbChiudi(true,s);s.mde.codemirror.replaceSelection('\n\n'+T.scrivi(t.tabella)+'\n\n','end','+tabella');noteAnteprimaRidisegna(s);}catch(err){toast('Tabella non incollata: '+err.message,false);}
 }
 document.addEventListener('paste',incolla,true);
 window.AppuntiTabelleUI={apri};
}());
