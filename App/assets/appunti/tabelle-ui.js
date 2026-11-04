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
  const dialog=E('dialog',null,'note-tabella-dialog tbar-ctl'),bar=E('div',null,'tbar'),azioni=E('div',null,'tbar'),stili=E('div',null,'tbar'),griglia=E('div',null,'note-tabella-celle'),errore=E('output');errore.setAttribute('role','status');
  let r=0,c=0,attivo;
  function disegna(){griglia.replaceChildren();griglia.style.gridTemplateColumns='repeat('+tab.rows[0].length+',minmax(120px,1fr))';tab.rows.forEach((row,i)=>row.forEach((v,j)=>{const lab=E('label','Riga '+(i+1)+' · Colonna '+(j+1)),area=E('textarea');area.value=v;area.setAttribute('aria-label',lab.textContent);area.oninput=()=>tab.rows[i][j]=area.value;area.onfocus=()=>{r=i;c=j;attivo=area;};lab.append(area);griglia.append(lab);}));}
  function elimina(asse){if((asse==='riga'?tab.rows.length:tab.rows[0].length)<=1)return;const pieni=asse==='riga'?tab.rows[r].some(Boolean):tab.rows.some(row=>row[c]);if(pieni&&!confirm('Eliminare '+asse+' e contenuto?'))return;if(asse==='riga'){tab.rows.splice(r,1);r=Math.max(0,r-1);}else{tab.rows.forEach(row=>row.splice(c,1));c=Math.max(0,c-1);}disegna();}
  bar.append(E('strong','Tabella'),E('span',null,'tbspazio'),bottone('Annulla',()=>dialog.close()),bottone('Applica',()=>{
   try{if(s.versione!==versione||s.cur?.file!==file||cm.getValue()!==originale)throw Error('L’appunto è cambiato. Chiudi e riapri la tabella.');
    cm.replaceRange((nuovo?'\n\n':'')+T.scrivi(tab)+(nuovo?'\n\n':''),from,to,'+tabella');noteAnteprimaRidisegna(s);dialog.close();
   }catch(e){errore.textContent=e.message;}
  }));
  azioni.append(bottone('+ Riga',()=>{if(tab.rows.length>=50){errore.textContent='Massimo 50 righe.';return;}tab.rows.splice(r+1,0,tab.rows[0].map(()=>''));r++;disegna();}),bottone('+ Colonna',()=>{if(tab.rows[0].length>=20){errore.textContent='Massimo 20 colonne.';return;}tab.rows.forEach(row=>row.splice(c+1,0,''));c++;disegna();}),bottone('Elimina riga',()=>elimina('riga')),bottone('Elimina colonna',()=>elimina('colonna')));
  for(const [nome,segno] of [['Grassetto','**'],['Corsivo','*'],['Codice','`']])stili.append(bottone(nome,()=>{if(!attivo)return;const da=attivo.selectionStart,a=attivo.selectionEnd,v=tab.rows[r][c];tab.rows[r][c]=v.slice(0,da)+segno+v.slice(da,a)+segno+v.slice(a);attivo.value=tab.rows[r][c];attivo.focus();attivo.setSelectionRange(da+segno.length,a+segno.length);}));
  const header=E('label','Intestazione '),check=E('input');check.type='checkbox';check.checked=tab.header;check.onchange=()=>tab.header=check.checked;header.append(check);stili.append(header);
  function campo(nome,key,tipo,base){const lab=E('label',nome+' '),input=E('input');input.type=tipo;input.value=tab.style[key]||base;if(tipo==='number'){input.min=8;input.max=100;}input.onchange=()=>tab.style[key]=tipo==='number'?+input.value:input.value;lab.append(input);stili.append(lab);}
  campo('Testo','color','color','#111111');campo('Sfondo','background','color','#ffffff');campo('Bordi','borderColor','color','#999999');campo('Dimensione','size','number',17);
  for(const [key,nome]of [['bold','Grassetto tabella'],['italic','Corsivo tabella'],['underline','Sottolineato tabella']]){const lab=E('label',nome+' '),x=E('input');x.type='checkbox';x.checked=!!tab.style[key];x.onchange=()=>tab.style[key]=x.checked;lab.append(x);stili.append(lab);}
  const fontLab=E('label','Font '),fontSel=E('select');for(const font of [...new Set([tab.style.font||'Arial','Arial','"Helvetica Neue",Helvetica,Arial,sans-serif','Georgia,"Times New Roman",serif','Verdana,Geneva,sans-serif','"Courier New",Courier,monospace'])]){const o=E('option',font.split(',')[0].replace(/"/g,''));o.value=font;fontSel.append(o);}fontSel.value=tab.style.font||'Arial';fontSel.onchange=()=>tab.style.font=fontSel.value;fontLab.append(fontSel);stili.append(fontLab);
  const lab=E('label','Allineamento '),select=E('select');for(const [v,n] of [['left','Sinistra'],['center','Centro'],['right','Destra']]){const o=E('option',n);o.value=v;select.append(o);}select.value=tab.style.align||'left';select.onchange=()=>tab.style.align=select.value;lab.append(select);stili.append(lab);
  dialog.setAttribute('aria-label','Modifica tabella negli appunti');dialog.append(bar,azioni,stili,E('p','Clicca una cella per scegliere dove aggiungere o eliminare righe e colonne. Puoi usare la formattazione Markdown nelle celle.'),griglia,errore);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);disegna();dialog.showModal();griglia.querySelector('textarea').focus();
 }
 function incolla(e){
  const s=noteStatoDaNodo(e.target);if(!s?.cur||!s.mde||e.target.closest('.editor-toolbar'))return;
  const testo=e.clipboardData?.getData('text/plain')||'';if(!testo.startsWith('```zaino-tabella\n'))return;
  e.preventDefault();e.stopPropagation();try{const t=T.leggi(testo.split('\n'));if(!t||t.fine!==testo.trim().split('\n').length-1)throw Error('Tabella copiata non valida.');mdbChiudi(true,s);s.mde.codemirror.replaceSelection('\n\n'+T.scrivi(t.tabella)+'\n\n','end','+tabella');noteAnteprimaRidisegna(s);}catch(err){toast('Tabella non incollata: '+err.message,false);}
 }
 document.addEventListener('paste',incolla,true);
 window.AppuntiTabelleUI={apri};
}());
