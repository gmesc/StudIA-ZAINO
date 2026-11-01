/* Cablaggio contenteditable: il contenuto salvato passa sempre dal modello puro del testo. */
(function(){
 'use strict';
 window.PresentaScrittura=function({invia,metadati,pronto,seleziona,bubble}){
  const T=PresentaTesto,M=PresentaModello;let attiva=null,range=null,sequenza=0;
  function misura(n){if(n.nodeType===3)return n.length;if(n.nodeType!==1)return 0;if(n.hasAttribute('data-atomo'))return 1;if(n.tagName==='BR')return 1;return [...n.childNodes].reduce((s,c)=>s+misura(c),0);}
  function offset(root,n,o){let p=0,trovato=false;function visita(x){if(trovato)return;if(x===n){p+=x.nodeType===3?o:[...x.childNodes].slice(0,o).reduce((s,c)=>s+misura(c),0);trovato=true;return;}if(x.nodeType===1&&(x.hasAttribute('data-atomo')||x.tagName==='BR')||x.nodeType===3){p+=misura(x);return;}for(const c of x.childNodes)visita(c);}visita(root);return p;}
  function memorizza(){if(!attiva)return;const sel=getSelection();if(!sel.rangeCount)return;const r=sel.getRangeAt(0);if(attiva.el.contains(r.startContainer)&&attiva.el.contains(r.endContainer)){range={inizio:offset(attiva.el,r.startContainer,r.startOffset),fine:offset(attiva.el,r.endContainer,r.endOffset)};notificaFormati();}}
  function notificaFormati(){if(!attiva||!range)return;const css=getComputedStyle(attiva.el),nome=css.fontFamily.split(',')[0].replace(/["']/g,'').trim().toLowerCase(),base={fontFamily:Object.keys(M.CARATTERI).find(k=>M.CARATTERI[k].css.split(',')[0].replace(/["']/g,'').trim().toLowerCase()===nome)||'zaino',fontSize:parseFloat(css.fontSize),fontWeight:Number(css.fontWeight),bold:Number(css.fontWeight)>=600,italic:css.fontStyle==='italic',underline:css.getPropertyValue('--sottolineato-testo').trim()==='underline'};
   let pos=0;const scelti=attiva.nodes.filter(n=>{const a=pos;pos+=n.text?.length??1;return n.text!==undefined&&pos>range.inizio&&a<(range.fine||range.inizio+1);});const formati={};for(const k of Object.keys(base)){const v=scelti.map(n=>k==='fontWeight'?T.peso(n.style,base.fontWeight):k==='bold'?T.peso(n.style,base.fontWeight)>=600:n.style?.[k]??base[k]);formati[k]=v.length&&v.every(x=>x===v[0])?v[0]:v.length?null:base[k];}invia('formatiParole',{sessione:attiva.identita.sessione,formati});
  }
  function punto(pos){let rimane=pos,risultato;function visita(n){if(risultato)return;if(n.nodeType===3){if(rimane<=n.length){risultato=[n,rimane];return;}rimane-=n.length;return;}if(n.nodeType!==1)return;if(n.hasAttribute('data-atomo')||n.tagName==='BR'){const i=[...n.parentNode.childNodes].indexOf(n);if(rimane<=1){risultato=[n.parentNode,i+(rimane?1:0)];return;}rimane--;return;}for(const c of n.childNodes)visita(c);}visita(attiva.el);return risultato||[attiva.el,attiva.el.childNodes.length];}
  function ripristina(){if(!attiva||!range)return;const a=punto(range.inizio),b=punto(range.fine),r=document.createRange();r.setStart(...a);r.setEnd(...b);const s=getSelection();s.removeAllRanges();s.addRange(r);}
  function disegna(){const {el,nodes,atomi}=attiva;el.replaceChildren();for(const n of nodes){
   const span=document.createElement('span');
   if(n.text!==undefined){span.dataset.stile=JSON.stringify(n.style||{});if(n.link)span.dataset.link=n.link;span.style.cssText=T.css(n.style,M.CARATTERI);span.textContent=n.text;}
   else{const k=JSON.stringify(n);span.dataset.atomo=k;span.contentEditable='false';span.innerHTML=atomi.get(k)||'';span.title='Contenuto Markdown o formula: modificabile dal campo sorgente';}
   el.append(span);
  }if(!nodes.length)el.append(document.createElement('br'));}
  function leggi(){const out=[];function visita(n,style={},link){if(n.nodeType===3){out.push({text:n.data,...(Object.keys(style).length?{style}:{}),...(link?{link}:{})});return;}if(n.nodeType!==1)return;
   if(n.hasAttribute('data-atomo')){const atom=n.dataset.atomo;if(attiva.atomi.has(atom))out.push(JSON.parse(atom));return;}
   if(n.tagName==='BR'){out.push({text:'\n'});return;}
   if(n.dataset.stile){try{const s=JSON.parse(n.dataset.stile);if(T.stileValido(s))style={...style,...s};}catch(_){}}
   if(n.dataset.link&&T.linkValido(n.dataset.link))link=n.dataset.link;
   const blocco=['DIV','P'].includes(n.tagName);if(blocco&&out.length&&!out.at(-1).text?.endsWith('\n'))out.push({text:'\n'});
   for(const c of n.childNodes)visita(c,style,link);
  }for(const c of attiva.el.childNodes)visita(c);return T.normalizza(out);}
  function salva(){if(!attiva)return null;try{const nodes=leggi();if(JSON.stringify(nodes)===JSON.stringify(attiva.nodes))return null;attiva.nodes=nodes;invia('testoInLinea',{...attiva.identita,richText:nodes});bubble(attiva.blocco);return null;}catch(e){invia('errore',{error:e.message});return e.message;}}
  function termina(avvisa=true){if(!attiva)return;salva();const a=attiva;attiva=null;range=null;a.el.removeAttribute('contenteditable');a.el.removeAttribute('role');a.el.removeAttribute('aria-multiline');a.blocco.removeAttribute('data-scrittura');if(avvisa)invia('fineScrittura',a.identita);}
  function avvia(el){if(!el||!pronto())return false;if(attiva?.el===el)return true;termina();const dati=metadati(),blocco=el.closest('[data-block-id]'),id=el.dataset.testoId,t=dati.testi?.[id];if(!t||!blocco)return false;
   seleziona(blocco);attiva={el,blocco,nodes:T.normalizza(t.nodes),atomi:new Map(t.nodes.flatMap((n,i)=>n.text===undefined?[[JSON.stringify(n),t.atomi[i]]]:[])),identita:{sessione:++sequenza,blockId:blocco.dataset.blockId,itemId:id,slideId:dati.slideId,firma:dati.firma}};
   disegna();el.dataset.ricco='true';el.contentEditable='true';el.setAttribute('role','textbox');el.setAttribute('aria-label','Testo sulla slide');el.setAttribute('aria-multiline','true');blocco.dataset.scrittura='true';el.focus();range={inizio:T.lunghezza(attiva.nodes),fine:T.lunghezza(attiva.nodes)};ripristina();invia('inizioScrittura',attiva.identita);notificaFormati();bubble(blocco);return true;
  }
  function formatta(patch){if(!attiva)return;memorizza();if(salva())return;if(!range||range.inizio===range.fine){invia('errore',{error:'Seleziona le parole da formattare.'});return;}try{const base=getComputedStyle(attiva.el);let pos=0;const selezionati=attiva.nodes.filter(n=>{const a=pos;pos+=n.text?.length??1;return n.text!==undefined&&pos>range.inizio&&a<range.fine;});
   for(const [k,v]of Object.entries(patch))if(v==='toggle'){const eredita=k==='bold'?Number(base.fontWeight)>=600:k==='italic'?base.fontStyle==='italic':base.getPropertyValue('--sottolineato-testo').trim()==='underline';patch[k]=!selezionati.every(n=>n.style?.[k]??eredita);}
   attiva.nodes=Object.hasOwn(patch,'link')?T.collega(attiva.nodes,range.inizio,range.fine,patch.link):T.formatta(attiva.nodes,range.inizio,range.fine,patch);disegna();attiva.el.focus();ripristina();invia('testoInLinea',{...attiva.identita,richText:attiva.nodes});notificaFormati();bubble(attiva.blocco);}catch(e){invia('errore',{error:e.message});}}
  function inserisci(testo){memorizza();ripristina();const s=getSelection();if(!attiva||!s.rangeCount)return;const r=s.getRangeAt(0);if(!attiva.el.contains(r.commonAncestorContainer))return;r.deleteContents();const n=document.createTextNode(testo);r.insertNode(n);r.setStartAfter(n);r.collapse(true);s.removeAllRanges();s.addRange(r);salva();memorizza();}
  document.addEventListener('selectionchange',memorizza);
  document.addEventListener('input',e=>{if(attiva?.el.contains(e.target)){salva();memorizza();}});
  document.addEventListener('beforeinput',e=>{if(!attiva?.el.contains(e.target))return;if(['insertParagraph','insertLineBreak'].includes(e.inputType)){e.preventDefault();inserisci('\n');}else if(e.inputType.startsWith('format'))e.preventDefault();});
  document.addEventListener('paste',e=>{if(!attiva?.el.contains(e.target))return;e.preventDefault();inserisci(e.clipboardData.getData('text/plain'));});
  document.addEventListener('drop',e=>{if(attiva?.el.contains(e.target))e.preventDefault();});
  return {salva,avvia,termina,formatta,memorizza,get attiva(){return attiva;},keydown(e){if(!attiva)return false;if((e.metaKey||e.ctrlKey)&&['b','i','u'].includes(e.key.toLowerCase())){e.preventDefault();const k={b:'bold',i:'italic',u:'underline'}[e.key.toLowerCase()];memorizza();formatta({[k]:'toggle'});return true;}return !(e.metaKey||e.ctrlKey)||!['s','z','y'].includes(e.key.toLowerCase());}};
 };
})();
