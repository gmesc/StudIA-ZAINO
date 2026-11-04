'use strict';
// Solo il vault sintetico del runner: due editor, un'immagine vera nell'album,
// dialogo di salvataggio pilotato dal main di prova, nessun dato personale.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {unzipSync,strFromU8}=require('fflate');
const c=require('./cdp'),q=JSON.stringify;
async function aspetta(expr){for(let i=0;i<150;i++){if(await c.val(expr))return;await c.pausa(100);}throw Error('Attesa scaduta: '+expr);}
(async()=>{
  await c.collega();await aspetta(`typeof bancoStato==='function'&&zainoAttivo()==='biologia'`);
  const vault=await c.val('window.vault.path');assert(vault.includes('studia-zaino-prova-'));
  await c.partiPulito();
  const prima=await c.val(`(()=>{noteFlush();return {banco:JSON.parse(JSON.stringify(bancoStato())),memoria:Object.fromEntries(Object.entries(localStorage)),riquadri:RIQ.mem,note:noteStati().map(s=>s.cur&&s.cur.file)};})()`);
  const marker=path.join(path.dirname(vault),'dati/dialogo-salvataggio.json'),precedente=fs.existsSync(marker)?fs.readFileSync(marker):null;
  const docx='/private/tmp/zaino-docx-prova.docx',pdf='/private/tmp/zaino-docx-prova.pdf';
  for(const f of [docx,pdf])if(fs.existsSync(f))fs.unlinkSync(f);
  let files=[];
  try{
    files=await c.val(`(()=>{
      const tela=document.createElement('canvas');tela.width=800;tela.height=300;
      const ctx=tela.getContext('2d');ctx.fillStyle='#e7f5f2';ctx.fillRect(0,0,800,300);
      ctx.fillStyle='#0f766e';ctx.fillRect(60,160,140,100);ctx.fillRect(280,100,140,160);ctx.fillRect(500,40,140,220);
      ctx.fillStyle='#111111';ctx.font='24px Arial';ctx.fillText('Campione per verificare immagini e proporzioni',40,290);
      const imm=window.vault.album.salva(corsoAttivo(),{origine:'foto',materiale:'campione-docx.png',didascalia:'Immagine di prova',dati:tela.toDataURL('image/png')});
      if(imm.error)throw Error(imm.error);
      window.__docxAlbum=imm.voce.id;
      const md='# Appunti: prova di esportazione\\n\\nTesto **in grassetto**, *in corsivo* e ==evidenziato==. Link: https://example.org\\n\\n> [!nota] Una nota personalizzata\\n> Il callout resta **modificabile** nel documento Word.\\n>\\n> 1. Osservare la figura.\\n> 2. Confrontare la fonte.\\n\\n![Didascalia del campione|70%](album:'+imm.voce.id+')\\n\\n[Leggi la fonte](pdf:01#p=2)\\n\\n| Elemento | Valore |\\n| --- | --- |\\n| Campione A | 12 |\\n| Campione B | 24 |\\n\\n'+Array.from({length:22},(_,i)=>'## Osservazione '+(i+1)+'\\n\\nLa formattazione deve restare leggibile anche sulle pagine successive. Un appunto esportato conserva contenuti, figure e riferimenti alle fonti.').join('\\n\\n');
      const files=[notesApi().save(corsoAttivo(),null,{title:'Prova DOCX — Appunti'},md).file,notesApi().save(corsoAttivo(),null,{title:'Secondo appunto DOCX'},'Contenuto indipendente nel secondo editor.').file];
      notesReload();bancoForma('due-col');bancoAssegna('A','appunti');bancoAssegna('C','appunti2');
      noteOpen(files[0],NOTES);appuntiParalleli.open(files[1]);
      RIQ.mem=Object.assign({},riquadriOvr(),{nota:{col:'#A855F7',ink:'#6B21A8'}});calloutStiliApplica();
      return files;
    })()`);
    await aspetta(`noteStati().every(s=>s.cur&&s.mde)&&document.getElementById('notePdf2')`);
    await c.val(`NOTES.mde.value(NOTES.mde.value()+'\\n\\nModifica appena scritta: da esportare subito.')`);
    const modello=await c.val('documentoAppuntoDocx(NOTES)');
    assert(modello.albero.figli.length>20);
    const seriale=JSON.stringify(modello);
    assert(seriale.includes('a855f7')&&seriale.includes('6b21a8'),'colori callout personalizzati');
    assert(seriale.includes('Botanica')&&seriale.includes('p. 2'),'fonte leggibile fuori dall’app');
    assert(seriale.includes('data:image/png;base64,'),'immagini incorporate');
    for(const id of ['notePdf','notePdf2']){
      await c.val(`document.getElementById(${q(id)}).click()`);
      assert(await c.val(`document.querySelector('#noteExportMenu[open]')&&document.getElementById(${q(id)}).getAttribute('aria-expanded')==='true'`));
      assert.deepEqual(await c.val(`[...document.querySelectorAll('#noteExportMenu button')].map(b=>b.textContent)`),['.PDF','.DOCX']);
      await c.invia('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
      assert.equal(await c.val(`document.querySelector('#noteExportMenu').hasAttribute('open')`),false);
    }
    fs.writeFileSync(marker,JSON.stringify({filePath:docx}));
    await c.val(`document.getElementById('notePdf').click();noteStati()[1].mde.codemirror.focus();document.querySelector('[data-note-export="docx"]').click()`);
    for(let i=0;i<150&&!fs.existsSync(docx);i++)await c.pausa(100);
    assert(fs.existsSync(docx),'DOCX scritto dal main reale');
    const zip=unzipSync(fs.readFileSync(docx)),xml=strFromU8(zip['word/document.xml']),footer=strFromU8(zip['word/footer1.xml']);
    assert(xml.includes('Modifica appena scritta')&&!xml.includes('Contenuto indipendente'));
    assert(xml.includes('A855F7')||xml.includes('a855f7'));assert(xml.includes('Didascalia del campione'));
    assert(Object.keys(zip).filter(k=>k.startsWith('word/media/')).length>=2,'figura e icona del callout');
    assert(footer.includes('Prova DOCX')&&footer.includes('NUMPAGES')&&footer.includes('PAGE'));
    fs.writeFileSync(marker,JSON.stringify({filePath:pdf}));
    await c.val(`document.getElementById('notePdf').click();document.querySelector('[data-note-export="pdf"]').click()`);
    for(let i=0;i<150&&!fs.existsSync(pdf);i++)await c.pausa(100);
    assert(fs.existsSync(pdf),'PDF rimane disponibile nello stesso menu');
    const docx2='/private/tmp/zaino-docx-secondo.docx';if(fs.existsSync(docx2))fs.unlinkSync(docx2);
    fs.writeFileSync(marker,JSON.stringify({filePath:docx2}));
    await c.val(`document.getElementById('notePdf2').click();document.querySelector('[data-note-export="docx"]').click()`);
    for(let i=0;i<150&&!fs.existsSync(docx2);i++)await c.pausa(100);
    const zip2=unzipSync(fs.readFileSync(docx2));assert(strFromU8(zip2['word/document.xml']).includes('Contenuto indipendente'));
    assert(strFromU8(zip2['word/footer1.xml']).includes('Secondo appunto DOCX'));
    fs.writeFileSync(marker,JSON.stringify({canceled:true}));assert.equal(await c.val('salvaDocx(NOTES)'),null);
    assert(await c.val(`(async()=>{const old=NOTES.mde.value();try{NOTES.mde.value('![Assente](album:abcdef123456)');await documentoAppuntoDocx(NOTES);return false;}catch(e){return /Immagine|immagine/.test(e.message);}finally{NOTES.mde.value(old);}})()`),'immagine mancante: errore esplicito');
    console.log('✓ Menu PDF/DOCX nei due editor; modifiche correnti, immagini e colori reali, fonti, footer, annullamento e immagine mancante.');
  }finally{
    await c.val(`(()=>{closePops();noteMolla();RIQ.mem=${q(prima.riquadri)};calloutStiliApplica();notesReload();noteStati().forEach((s,i)=>{if(${q(prima.note)}[i])noteOpen(${q(prima.note)}[i],s);});localStorage.clear();for(const [k,v] of Object.entries(${q(prima.memoria)}))localStorage.setItem(k,v);BANCO.stato=${q(prima.banco)};bancoDisegna();})()`);
    const A=require('../../lib/appunti');for(const f of files)A.remove(vault,'biologia',f);
    const id=await c.val('window.__docxAlbum');if(id)require('../../lib/album').rimuovi(vault,'biologia',id);
    if(precedente)fs.writeFileSync(marker,precedente);else if(fs.existsSync(marker))fs.unlinkSync(marker);
    await c.val('notesReload();refreshNoteUI()');
  }
  c.ws().close();
})().catch(e=>{console.error(e);if(c.ws)c.ws().close();process.exitCode=1;});
