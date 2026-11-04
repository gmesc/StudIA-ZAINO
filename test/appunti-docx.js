'use strict';
const assert=require('node:assert/strict');
const {crea}=require('../lib/appunti-docx');
const M=require('../App/assets/appunti/documento');
const {unzipSync,strFromU8}=require('fflate');
const t=testo=>({tag:'#text',testo});
const e=(tag,figli=[],extra={})=>({tag,figli,...extra});
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=';
(async()=>{
  const dati={titolo:'Esperimento & fonti',font:'Arial',albero:e('root',[
    e('h1',[t('Titolo')]),
    e('p',[t('Prima '),e('strong',[e('em',[t('grassetto corsivo')])]),t(' dopo '),e('mark',[t('Segno')],{colore:'12ABEF'}),e('u',[t('sottolineato')]),e('s',[t('barrato')])]),
    e('p',[e('a',[t('Sito')],{href:'https://example.org/a?x=1&y=2'}),e('a',[t('Citazione')],{href:'#',riferimento:'Biologia.pdf, p. 7'})]),
    e('callout',[e('p',[t('ATTENZIONE')],{testata:true,colore:'B45309'}),e('p',[t('Contenuto modificabile')]),e('ol',[e('li',[t('Primo')]),e('li',[e('p',[t('Secondo')]),e('p',[t('Continuazione senza numero')])])],{inizio:3})],{colore:'F59E0B'}),
    e('figura',[e('img',[],{dati:png,larghezza:600,altezza:400,percento:50,alt:'Campione'}),e('p',[t('Didascalia')],{didascalia:true})]),
    e('table',[t('\n'),e('tr',[e('th',[t('Colonna')]),e('th',[t('Valore')])]),e('tr',[e('td',[t('Uno')]),e('td',[t('Due')])])]),
    e('pre',[t('riga uno\nriga due')]),e('p',[])
  ])};
  const buffer=await crea(dati),zip=unzipSync(buffer);
  const leggi=n=>strFromU8(zip[n]);
  const xml=leggi('word/document.xml');
  const rel=leggi('word/_rels/document.xml.rels');
  const foot=leggi('word/footer1.xml');
  assert(xml.includes('grassetto corsivo')&&xml.includes('<w:b/>')&&xml.includes('<w:i/>'));
  assert(xml.includes('12ABEF')&&xml.includes('<w:strike/>')&&xml.includes('<w:u'));
  assert(xml.includes('<w:caps/>')&&xml.includes('Contenuto modificabile')&&xml.includes('F59E0B')&&xml.includes(M.carta('F59E0B')));
  assert(xml.includes('[Fonte: Biologia.pdf, p. 7]'));
  assert(rel.includes('https://example.org/a?x=1&amp;y=2')&&!rel.includes('Target="#"'));
  assert(Object.keys(zip).filter(n=>/^word\/media\/.*\.png$/.test(n)).length===1);
  assert(xml.includes('Didascalia')&&xml.includes('Colonna')&&xml.includes('<w:br/>'));
  const num=leggi('word/numbering.xml');assert(num.includes('<w:start w:val="3"'));
  assert.equal((xml.match(/<w:numPr>/g)||[]).length,2,'continuazione senza un numero aggiunto');
  assert(foot.includes('Esperimento &amp; fonti')&&foot.includes('PAGE')&&foot.includes('NUMPAGES'));
  assert((leggi('word/settings.xml')).includes('updateFields'));
  assert(xml.includes('w:w="11906"')&&xml.includes('w:h="16838"'),'A4');
  await assert.rejects(()=>crea({titolo:'No',albero:e('root',[e('img',[],{dati:'file:///etc/passwd',larghezza:1,altezza:1})])}),/incorporata/);
  await assert.rejects(()=>crea({titolo:'No',albero:e('root',[e('script',[t('alert(1)')])])}),/non supportato/);
  await assert.rejects(()=>crea({titolo:'No',albero:e('root',[e('img',[],{dati:'data:image/png;base64,YQ==',larghezza:1,altezza:1})])}),/PNG non valida/);
  let profondo=t('fondo');for(let i=0;i<65;i++)profondo=e('span',[profondo]);
  assert.throws(()=>M.valida({titolo:'No',albero:profondo}),/complesso/);
  console.log('✓ DOCX: formattazioni, callout, immagini, fonti, liste, tabella, footer e validazione');
})().catch(e=>{console.error(e);process.exitCode=1;});
