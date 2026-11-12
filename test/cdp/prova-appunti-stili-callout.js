'use strict';
const A=require('node:assert/strict'),c=require('./cdp'),q=JSON.stringify;
const fs=require('node:fs');
async function shot(nome){fs.writeFileSync('/private/tmp/'+nome+'.png',Buffer.from((await c.invia('Page.captureScreenshot',{format:'png'})).result.data,'base64'));}
async function wait(e){for(let i=0;i<160;i++){if(await c.val(e))return;await c.pausa(100);}throw Error('Attesa: '+e);}
(async()=>{
 await c.collega();await wait("typeof AppuntiStrumenti!=='undefined'&&zainoAttivo()==='biologia'");await c.partiPulito();
 const prima=await c.val('({...localStorage})'),prefs=await c.val('vault.prefs.read()'),vault=await c.val('vault.path');A(vault.includes('studia-zaino-prova-'));let file;const marker=require('node:path').join(require('node:path').dirname(vault),'dati','dialogo-salvataggio.json');
 try{
  file=await c.val(`(()=>{const n=notesApi().save('biologia',null,{title:'Stili e callout'},'Una frase da trasformare.');notesReload();bancoForma('uno');bancoAssegna('A','appunti');noteOpen(n.file,NOTES);riquadriScrivi('dafare',{etichetta:'PASS DIMENTICATA',emoji:'🔐'});return n.file;})()`);
  await wait("!!document.querySelector('#noteHost .note-stile-testo')");
  A.match(await c.val("calloutIcona(calloutDef('dafare'))"),/data-icona="lock-keyhole"/,'anche l’emoji personalizzata deve rispettare Lucide');
  A.equal(await c.val("document.querySelector('#noteHost .note-stile-testo').tagName"),'BUTTON');
  A.equal(await c.val("document.querySelector('#noteHost .note-stile-testo svg').dataset.icona"),'pilcrow');
  await c.clicca('#noteHost .note-stile-testo');await wait("!!document.querySelector('.note-stili-menu:popover-open')");
  A.equal(await c.val("document.querySelectorAll('.note-stili-menu:popover-open [data-livello]').length"),7);
  await shot('zaino-stili-menu');
  const sizes=await c.val("[...document.querySelectorAll('.note-stili-menu:popover-open [data-livello]')].map(b=>parseFloat(getComputedStyle(b.querySelector('.note-stile-anteprima')).fontSize))");
  A(sizes.slice(1).every((n,i,a)=>i===0||n<a[i-1]),'anteprime H1–H6 in proporzione decrescente');
  await c.clicca('.note-stili-menu:popover-open [data-livello="6"]');A.equal(await c.val('NOTES.mde.codemirror.getLine(0)'),'###### Una frase da trasformare.');
  A.match(await c.val("document.querySelector('#noteHost .note-stile-testo').title"),/# 6 · Sottotitolo 5/);
  await c.val('NOTES.mde.codemirror.undo()');A.equal(await c.val('NOTES.mde.codemirror.getLine(0)'),'Una frase da trasformare.');
  A.equal(await c.val("getComputedStyle(document.querySelector('#noteHost .note-stile-testo svg')).width"),await c.val("getComputedStyle(document.querySelector('#noteHost .bold svg')).width"),'¶ ha la misura delle altre icone');
  await c.val("NOTES.mde.codemirror.setValue('# Titolo\\nUn paragrafo.');NOTES.mde.codemirror.setSelection({line:0,ch:0},{line:1,ch:13})");
  A.match(await c.val("document.querySelector('#noteHost .note-stile-testo').title"),/Stili diversi/);
  await c.clicca('#noteHost .note-stile-testo');
  A.equal(await c.val("document.querySelectorAll('.note-stili-menu:popover-open [aria-checked=true]').length"),0);
  await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'End',code:'End',windowsVirtualKeyCode:35});
  A.equal(await c.val('document.activeElement.dataset.livello'),'6');
  await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await c.invia('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  A.equal(await c.val('NOTES.mde.value()'),'###### Titolo\n###### Un paragrafo.');
  await c.clicca('#noteHost .note-stile-testo');
  await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  A.equal(await c.val("document.querySelectorAll('.note-stili-menu:popover-open').length"),0);
  A.equal(await c.val("document.activeElement.classList.contains('note-stile-testo')"),true);
  await c.val('riquadriApri()');
  await c.val("document.querySelector('#riquadriBody [data-k=\"dafare\"] .riq-emoji').scrollIntoView({block:'center'})");
  await c.clicca('#riquadriBody [data-k="dafare"] .riq-emoji');await wait("!!document.querySelector('.riq-icone-menu:popover-open')");
  await c.clicca('.riq-icone-menu:popover-open button:has([data-icona="lock-keyhole"])');
  A.equal(await c.val("vault.prefs.read().riquadri.dafare.icona"),'lock-keyhole');
  for(const stile of ['openmoji','android','lucide']){
   await c.val(`(()=>{const s=document.querySelector('#riquadriStileIcone');s.value=${q(stile)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   const d=await c.val(`(()=>{RIQ.mem=null;const html=calloutMenuHTML()+renderNoteMd('> [!dafare] PASS DIMENTICATA\\n> Recupera la password.');const p=document.createElement('div');p.innerHTML=html;return {stili:[...p.querySelectorAll('.callout-icona')].map(e=>e.dataset.stile),pref:vault.prefs.read().riquadriStileIcone};})()`);
   A(d.stili.length===8&&d.stili.every(s=>s===stile));A.equal(d.pref,stile);
   await c.val("document.querySelector('#riquadriBody').scrollTop=0");
   await shot('zaino-callout-'+stile);
   await c.val("riquadriChiudi();NOTES.mde.codemirror.setValue('# Icone dei riquadri\\n\\n'+CALLOUTS.map(d=>'> [!'+d.k+'] '+calloutDef(d.k).label+'\\n> Un simbolo leggibile anche sul foglio stampato.').join('\\n\\n'))");
   const pdf='/private/tmp/zaino-callout-'+stile+'.pdf';
   fs.writeFileSync(marker,JSON.stringify({filePath:pdf}));
   A.equal(await c.val("salvaPdf('appunto',NOTES)"),pdf);
   A(fs.statSync(pdf).size>10000);
   const pixel=await c.val(`(async()=>{
    pdfjsAvvia();const task=pdfjsLib.getDocument({data:Uint8Array.from(atob(${q(fs.readFileSync(pdf).toString('base64'))}),c=>c.charCodeAt(0))}),doc=await task.promise,pag=await doc.getPage(1),vp=pag.getViewport({scale:2}),canvas=document.createElement('canvas');canvas.width=vp.width;canvas.height=vp.height;
    const ctx=canvas.getContext('2d');await pag.render({canvasContext:ctx,viewport:vp}).promise;
    const t=(await pag.getTextContent()).items.find(t=>t.str==='NOTA');if(!t)throw Error('Titolo Nota non trovato nel PDF');
    const x=Math.round((t.transform[4]-27)*2),y=Math.round((pag.view[3]-t.transform[5]-14)*2),d=ctx.getImageData(x,y,36,36).data;let scuri=0;
    for(let i=0;i<d.length;i+=4)if(Math.min(d[i],d[i+1],d[i+2])<180)scuri++;
    await task.destroy();return scuri;
   })()`);
   A(pixel>35,'il PDF '+stile+' deve contenere il disegno dell’icona, non un riquadro bianco: '+pixel);

   await c.val('riquadriApri()');
   await c.val("document.fonts.ready.then(()=>true)");
   A.equal(await c.val("[...document.querySelectorAll('#riquadriBody .callout-icona')].every(e=>getComputedStyle(e).width!=='0px')"),true);
  }
  A.equal(await c.val("getComputedStyle(document.querySelector('#riquadriBody .callout-icona svg')).strokeWidth"),'2.5px');
  await c.invia('Emulation.setEmulatedMedia',{media:'print'});
  A.equal(await c.val("getComputedStyle(document.querySelector('#riquadriBody .callout-icona')).backgroundColor"),'rgb(255, 255, 255)');
  A.equal(await c.val("getComputedStyle(document.querySelector('#riquadriBody .callout-icona')).color"),'rgb(24, 24, 27)');
  await c.invia('Emulation.setEmulatedMedia',{media:''});
  console.log('✓ Menu H1–H6, anteprime proporzionate, Undo, callout uniformi, tre famiglie persistenti e contrasto stampa');
 }finally{
  await c.invia('Emulation.setEmulatedMedia',{media:''});
  await c.val(`riquadriChiudi();noteMolla();vault.prefs.save(${q(prefs)});RIQ.mem=null;calloutStiliApplica();localStorage.clear();Object.entries(${q(prima)}).forEach(([k,v])=>localStorage.setItem(k,v));`);
  if(fs.existsSync(marker))fs.unlinkSync(marker);
  if(file)require('../../lib/appunti').remove(vault,'biologia',file);c.ws().close();
 }
})().catch(e=>{console.error(e);c.ws()?.close();process.exitCode=1;});
