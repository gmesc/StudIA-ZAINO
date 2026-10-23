'use strict';
/* Il cablaggio dei due editor deve essere lo stesso: la prova passa da barre,
 * campi e tastiera e controlla anche il markdown scritto nel vault sintetico.
 * La logica di scelta delle istanze è già coperta dalle prove Node. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const c = require('./cdp');
const appunti = require('../../lib/appunti');
const q = JSON.stringify;
let prima;
const prefisso = 'Parità editor ' + Date.now();
async function aspetta(expr) {
  const fino = Date.now() + 10000;
  while (Date.now() < fino) {
    if (await c.val(expr)) return;
    await c.pausa(80);
  }
  throw new Error('Attesa scaduta: ' + expr + '\n' + JSON.stringify(await c.val(`({
    aperti:typeof __pariStati==='function' ? __pariStati().map(s=>({file:s.cur&&s.cur.file,dirty:s.dirty})) : [],
    modale:document.querySelector('#uiModal[open]')?.textContent,
    attivo:document.activeElement?.outerHTML?.slice(0,300)
  })`)));
}
async function click(sel) {
  await aspetta(`(()=>{const e=document.querySelector(${q(sel)});return !!e&&e.getBoundingClientRect().height>0;})()`);
  await c.val(`document.querySelector(${q(sel)}).scrollIntoView({block:'nearest'})`);
  await c.pausa(100);
  await c.clicca(sel);
}
async function campo(sel, testo) {
  await c.val(`(()=>{const e=document.querySelector(${q(sel)});e.focus();e.select();})()`);
  await c.invia('Input.insertText', {text:testo});
}
async function tasto(key, code, vk, modifiers) {
  const dati = {key, code, windowsVirtualKeyCode:vk, modifiers:modifiers||0};
  await c.invia('Input.dispatchKeyEvent', Object.assign({type:'keyDown'}, dati));
  await c.invia('Input.dispatchKeyEvent', Object.assign({type:'keyUp'}, dati));
}
const corpo = i => c.val(`__pariStati()[${i}].mde.value()`);
const aperto = i => c.val(`__pariStati()[${i}].cur.file`);
async function scrivi(i, testo) {
  await c.val(`(()=>{const cm=__pariStati()[${i}].mde.codemirror;
    cm.focus();cm.setCursor({line:cm.lastLine(),ch:cm.getLine(cm.lastLine()).length});})()`);
  await c.invia('Input.insertText', {text:testo});
}
const disco = file => fs.readFileSync(path.join(appunti.dir(prima.vault, prima.corso), file), 'utf8');
async function salva(i) {
  await click('#noteSave' + (i ? '2' : ''));
  await aspetta(`!__pariStati()[${i}].dirty`);
}
async function pulisci() {
  if (!prima) return;
  await c.val(`(()=>{closePops();document.querySelector('#umCancel')?.click();
    for(const s of __pariStati()){
      if(s.mde?.isSideBySideActive())s.mde.toggleSideBySide();
      if(s.mde?.isPreviewActive())s.mde.togglePreview();
    }
    noteMolla();notesReload();
    const vecchi=${q(prima.note)};
    __pariStati().forEach((s,i)=>{
      if(vecchi[i].file){if(i)appuntiParalleli.open(vecchi[i].file);else noteOpen(vecchi[i].file,s);}
      else if(s.mde){s.caricando=true;s.loading=true;s.mde.value(vecchi[i].body||'');s.caricando=false;s.loading=false;s.dirty=false;}
      if(s.mde&&vecchi[i].preview&&!s.mde.isPreviewActive())s.mde.togglePreview();
      if(s.mde&&vecchi[i].affiancata&&!s.mde.isSideBySideActive())s.mde.toggleSideBySide();
    });
    document.documentElement.dataset.editor=${q(prima.editor||'')};
    BANCO.stato=${q(prima.banco)};bancoSalva();bancoZoomScrivi(${q(prima.zoom)});bancoDisegna();
    return true;})()`);
  // Le sole note con questo titolo sono nate nella prova, mai nella raccolta della persona.
  for (const n of appunti.list(prima.vault, prima.corso)) {
    if (n.title.startsWith(prefisso)) appunti.remove(prima.vault, prima.corso, n.file);
  }
  await c.pausa(150);
  await c.val(`(()=>{notesReload();refreshNoteUI();
    localStorage.clear();Object.entries(${q(prima.memoria)}).forEach(([k,v])=>localStorage.setItem(k,v));delete window.__pariStati;return true;})()`);
}
(async () => {
  await c.collega();
  await aspetta(`typeof bancoStato==='function' && zainoAttivo()==='biologia'`);
  assert((await c.val('window.vault.path')).includes('studia-zaino-prova-'),
    'questa prova richiede il vault sintetico di bin/prova-zaino.sh');
  await c.partiPulito();
  await c.val(`window.__pariStati=()=>typeof noteStati==='function'?noteStati():[NOTES,appuntiParalleli.stato]`);
  prima = await c.val(`(()=>{noteFlush();return {vault:window.vault.path,corso:corsoAttivo(),
    banco:JSON.parse(JSON.stringify(bancoStato())),zoom:bancoZoomLeggi(),editor:document.documentElement.dataset.editor,memoria:Object.fromEntries(Object.entries(localStorage)),
    note:__pariStati().map(s=>({file:s.cur&&s.cur.file,body:s.mde?s.mde.value():'',
      preview:!!s.mde?.isPreviewActive(),affiancata:!!s.mde?.isSideBySideActive()}))};})()`);
  try {
    const file = await c.val(`(()=>{const file=[0,1].map(i=>{
      const r=notesApi().save(corsoAttivo(),null,{title:${q(prefisso)}+' '+(i+1)},'Testo iniziale '+(i+1)+${q('.\n\n- '+'Una voce lunga che va a capo senza perdere il rientro. '.repeat(10)+'\n- Seconda voce.\n\n1. Primo passo.\n2. Secondo passo.')});
      if(!r||r.error)throw new Error(r&&r.error||'Creazione fallita');return r.file;});
      notesReload();bancoForma('due-col');bancoAssegna('A','appunti');bancoAssegna('C','appunti2');
      noteOpen(file[0],NOTES);appuntiParalleli.open(file[1]);
      __pariStati().forEach(s=>{
        if(s.mde.isSideBySideActive())s.mde.toggleSideBySide();
        if(s.mde.isPreviewActive())s.mde.togglePreview();});return file;})()`);
    await aspetta(`__pariStati().every(s=>s.mde&&s.cur) && bancoVisibile('appunti') && bancoVisibile('appunti2')`);
    const barre = await c.val(`__pariStati().map((s,i)=>Array.from(document.querySelector(i?'#noteHost2':'#noteHost').querySelectorAll('.editor-toolbar button'))
      .map(b=>({id:b.id.replace(/2$/,''),titolo:b.title,classe:b.className.replace(/\\bactive\\b/g,'').trim()})))`);
    assert(barre[0].length > 15, 'la barra deve contenere gli strumenti completi: '+JSON.stringify(barre));
    assert.deepEqual(barre[1], barre[0], 'stessi comandi, ordine e scorciatoie nei due editor');
    const comandi = ['noteSelect','noteNew','noteSave','noteRen','noteDel','noteStampa','notePdf','noteClose'];
    assert.deepEqual(await c.val(`${q(comandi)}.map(id=>[!!document.getElementById(id),!!document.getElementById(id+'2')])`),
      comandi.map(()=>[true,true]), 'anche i comandi del documento sono presenti in entrambi');
    console.log('  ok  toolbar e comandi del documento identici');
    assert.deepEqual(await c.val(`__pariStati().map(s=>document.querySelector('.blocco[data-blocco="'+bancoBloccoDi(s.id)+'"] .bdoc').textContent)`),[prefisso+' 1',prefisso+' 2']);
    assert(await c.val(`(()=>{
      const s=__pariStati()[0],prima=s.cur.title;s.cur.title='Un documento con un titolo molto lungo '.repeat(12);refreshNoteUI();
      const h=document.querySelector('.blocco[data-blocco="'+bancoBloccoDi(s.id)+'"] .bhead'),d=h.querySelector('.bdoc'),t=h.querySelector('.tendina'),st=getComputedStyle(d);
      const ok=d.textContent===s.cur.title && d.title===s.cur.title && st.fontWeight==='400' && st.textAlign==='right' && st.textOverflow==='ellipsis' && d.scrollWidth>d.clientWidth && d.getBoundingClientRect().right<=h.getBoundingClientRect().right && t.getBoundingClientRect().right<d.getBoundingClientRect().right;
      s.cur.title=prima;refreshNoteUI();return ok;
    })()`),'titolo completo accessibile, normale, a destra e troncato quando lungo');
    for(const tema of ['chiaro','scuro']){
      const precedente=await c.val('document.documentElement.dataset.theme');
      await c.val(`document.documentElement.dataset.theme=${q(tema)}`);
      assert(await c.val(`(()=>{
        const e=document.createElement('canvas'),ctx=e.getContext('2d');
        return Array.from(document.querySelectorAll('#banco .blocco:not([hidden]) .bhead')).every(h=>{
          ctx.fillStyle=getComputedStyle(h).backgroundColor;ctx.fillRect(0,0,1,1);const [r,g,b]=ctx.getImageData(0,0,1,1).data;
          return g>r && g>b && getComputedStyle(h).justifyContent==='flex-start' && getComputedStyle(h.querySelector('.tendina'),'::after').content.includes('▾');
        });
      })()`),'testate verdi, selettore a sinistra e chevron in tema '+tema);
      await c.val(`document.documentElement.dataset.theme=${q(precedente)}`);
    }


    for(const i of [0,1])for(const mode of ['preview','side']){
      await c.val(`__pariStati()[${i}].mde.${mode==='preview'?'togglePreview':'toggleSideBySide'}()`);
      await aspetta(`!!document.querySelector('${i?'#noteHost2':'#noteHost'} .${mode==='preview'?'editor-preview-active':'editor-preview-active-side'} ul')`);
      const lists=await c.val(`(()=>{const p=document.querySelector('${i?'#noteHost2':'#noteHost'} .${mode==='preview'?'editor-preview-active':'editor-preview-active-side'}');return [...p.querySelectorAll('ul,ol')].map(e=>({tag:e.tagName,padding:parseFloat(getComputedStyle(e).paddingInlineStart),font:parseFloat(getComputedStyle(e).fontSize),inset:e.firstElementChild.getBoundingClientRect().left-p.getBoundingClientRect().left,wrap:e.firstElementChild.getBoundingClientRect().height>parseFloat(getComputedStyle(e).lineHeight)*2}));})()`);
      assert(lists.some(x=>x.tag==='UL'&&x.wrap),'La voce lunga va davvero a capo');assert(lists.some(x=>x.tag==='OL'));
      for(const e of lists){assert(e.padding>=e.font*1.5,JSON.stringify({i,mode,...e}));assert(e.inset>=e.font*1.5,JSON.stringify({i,mode,...e}));}
      await c.val(`__pariStati()[${i}].mde.${mode==='preview'?'togglePreview':'toggleSideBySide'}()`);
    }
    console.log('  ok  pallini, numeri e righe a capo rientrano nelle due anteprime di entrambi gli editor');

    for (const i of [0,1]) {
      const altro = await corpo(1-i), testo = '\nScrittura separata ' + (i+1) + '.';
      await scrivi(i, testo);await salva(i);
      assert(disco(file[i]).includes(testo));
      assert.equal(await corpo(1-i), altro, 'scrivere e salvare lascia intatto l’altro editor');
    }
    console.log('  ok  tastiera e salvataggio scrivono nei due file distinti');

    for (const i of [0,1]) {
      const host=i?'#noteHost2':'#noteHost', altro=await corpo(1-i), prima=await corpo(i);
      await c.val(`__pariStati()[${i}].mde.codemirror.clearHistory()`);
      await scrivi(i,'\nPasso da annullare.');
      await click(host+' .ncb-undo');
      assert.equal(await corpo(i),prima,'Annulla toglie la scrittura dal suo editor');
      assert.equal(await corpo(1-i),altro,'Annulla lascia intatto l’altro appunto');
      await click(host+' .ncb-redo');
      assert.equal(await corpo(i),prima+'\nPasso da annullare.','Ripeti rimette il testo');
      await click(host+' .ncb-undo'); await scrivi(i,'\nStrada nuova.');
      assert.equal(await c.val(`document.querySelector(${q(host+' .ncb-redo')}).getAttribute('aria-disabled')`),'true');
      await salva(i);
    }
    console.log('  ok  Undo/Redo indipendenti nei due appunti e futuro azzerato da una nuova scrittura');

    const primo = await corpo(0);
    await scrivi(1, '\n');await click('#noteHost2 .ncb-emoji');
    await aspetta(`!!document.querySelector('#emojiPop[open] #emojiGrid button')`);
    const emoji = await c.val(`document.querySelector('#emojiGrid button').dataset.emo`);
    await click('#emojiGrid button');
    assert((await corpo(1)).includes(emoji));assert.equal(await corpo(0), primo);
    await salva(1);assert(disco(file[1]).includes(emoji));
    console.log('  ok  la tavolozza del secondo editor inserisce nel secondo file');

    await scrivi(1, '\n');await click('#noteHost2 .ncb-mat');
    await click('#matLista [data-mat="01 Botanica.pdf"]');
    await aspetta(`!!document.querySelector('#uiModal[open]')`);
    await campo('#umInput', '2');
    // Un evento di focus concorrente non deve dirottare la risposta della modale già aperta.
    await c.val('__pariStati()[0].mde.codemirror.focus()');
    await click('#umOk');
    await aspetta(`__pariStati()[1].mde.value().includes('pdf:01#p=2')`);
    assert.equal(await corpo(0), primo);
    await salva(1);assert(disco(file[1]).includes('pdf:01#p=2'));
    console.log('  ok  la citazione conserva il destinatario attraverso il dialogo pagina');

    await click('#noteHost2 .preview');
    await click('#noteHost2 .editor-preview-active .mdb > p');
    await aspetta(`!!document.querySelector('#noteHost2 .mdb-edit')`);
    await campo('#noteHost2 .mdb-edit', 'Paragrafo modificato nella seconda anteprima.');
    await tasto('Enter','Enter',13,4);
    await aspetta(`!document.querySelector('#noteHost2 .mdb-edit')`);
    assert((await corpo(1)).includes('Paragrafo modificato nella seconda anteprima.'));
    assert.equal(await corpo(0), primo);
    assert((await c.val(`document.querySelector('#noteHost2 .editor-preview-active').textContent`)).includes('Paragrafo modificato'));
    await salva(1);assert(disco(file[1]).includes('Paragrafo modificato nella seconda anteprima.'));
    await click('#noteHost2 .ncb-undo');
    assert(!(await c.val(`document.querySelector('#noteHost2 .editor-preview-active').textContent`)).includes('Paragrafo modificato'));
    await click('#noteHost2 .ncb-redo');
    assert((await c.val(`document.querySelector('#noteHost2 .editor-preview-active').textContent`)).includes('Paragrafo modificato'));
    await click('#noteHost2 .preview');
    console.log('  ok  l’anteprima del secondo editor modifica e salva il suo markdown');

    for (const i of [0,1]) {
      const altro = await aperto(1-i), titolo = prefisso + ' nuovo ' + (i+1);
      await click('#noteNew' + (i ? '2' : ''));
      await aspetta(`!!document.querySelector('#uiModal[open] #umSel')`);
      await campo('#umInput', titolo);
      await c.val(`(()=>{const s=document.querySelector('#umSel');s.value='02 Biologia cellulare.pdf';
        s.dispatchEvent(new Event('change',{bubbles:true}));__pariStati()[${1-i}].mde.codemirror.focus();})()`);
      await click('#umOk');
      await aspetta(`__pariStati()[${i}].cur?.title===${q(titolo)}`);
      assert.deepEqual(await c.val(`__pariStati()[${i}].mde.codemirror.historySize()`),{undo:0,redo:0},'il nuovo appunto non eredita la cronologia precedente');
      assert.equal(await aperto(1-i), altro, 'il dialogo Nuovo non sostituisce l’altro appunto');
      assert.equal(await c.val(`__pariStati()[${i}].cur.materiale`), '02 Biologia cellulare.pdf');
      assert.equal(await c.val(`document.querySelector('.blocco[data-blocco="'+bancoBloccoDi(__pariStati()[${i}].id)+'"] .bdoc').textContent`),titolo);
      const nuovo = await aperto(i), testo = 'Appunto nato nel riquadro ' + (i+1) + '.';
      await scrivi(i, testo);await salva(i);
      assert(disco(nuovo).includes(testo));assert(!disco(altro).includes(testo));
    }
    console.log('  ok  entrambi creano appunti con origine e conservano la destinazione del dialogo');
    const foto=await c.invia('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync('/tmp/studia-zaino-editor-pari.png',Buffer.from(foto.result.data,'base64'));
  } finally { await pulisci(); }
  console.log('✓ editor pari: barre, scrittura, salvataggio, emoji, citazioni, anteprima e creazione indipendenti');
  process.exit(0);
})().catch(async e=>{console.error(e);try{const r=await c.invia('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync('/tmp/studia-zaino-editor-pari-failure.png',Buffer.from(r.result.data,'base64'));}catch(_){}
  process.exit(1);
});
