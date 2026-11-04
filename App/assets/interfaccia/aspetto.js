/* La preferenza veste i comandi, non riscrive i font dei documenti. */
(function(){
 'use strict';const chiave='zaino.aspetto.font',font={zaino:'"Helvetica Neue",Helvetica,Arial',atkinson:'"Atkinson Hyperlegible",Arial'};
 function applica(id,salva){if(!Object.hasOwn(font,id))id='zaino';document.documentElement.style.setProperty('--font-text',font[id]);document.documentElement.dataset.fontUi=id;const sel=document.getElementById('aspettoFont');if(sel)sel.value=id;if(salva)try{localStorage.setItem(chiave,id);}catch(e){toast('Impossibile ricordare il carattere dell’interfaccia.',false);}document.fonts.ready.then(()=>window.dispatchEvent(new Event('resize')));}
 let id='zaino';try{id=localStorage.getItem(chiave)||id;}catch(e){}applica(id,false);
 document.getElementById('aspettoFont').addEventListener('change',e=>applica(e.target.value,true));document.getElementById('aspettoRipristina').onclick=()=>applica('zaino',true);
}());
