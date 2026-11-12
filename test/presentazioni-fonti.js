'use strict';
const assert=require('node:assert/strict'),M=require('../App/assets/presentazioni/modello'),R=require('../App/assets/rimandi/sintassi'),C=require('../App/assets/presentazioni/reveal-adapter');
const F=require('../App/assets/presentazioni/fonti');
const z='00000000-0000-4000-8000-000000000001',link=R.scriviPdfZaino(z,'00000000-0000-4000-8000-000000000002',2,'b'.repeat(64));
assert(link,'rimando della prova valido');
let d=M.crea(z,'Consultare e tornare');const sid=d.stacks[0].slides[0].id;
d=M.applica(d,{tipo:'inserisciBlocco',slideId:sid,block:{type:'text',slot:'body',markdown:'La fotosintesi',source:{kind:'keyword',id:'kw1',title:'Botanica',link}}});
const b=d.stacks[0].slides[0].blocks[0];d=M.applica(d,{tipo:'animazioni',slideId:sid,animations:[{targetId:b.id,effect:'fade-in',step:1,duration:3}]});
assert.equal(F.rimando(b),link);assert.equal(F.rimando({...b,source:{...b.source,kind:'album'}}),link);
for(const source of [undefined,{kind:'keyword',link:'https://example.com'},{kind:'album',link:'file:///private.pdf'},{kind:'album',link:'ev:123'}])assert.equal(F.rimando({source}),'');
assert(!C.compila(d).html.includes('data-fonte'),'export privo di collegamenti al vault');
const html=C.compila(d,{fonti:true}).html;assert(html.includes('data-fonte="true"'));assert(!html.includes(link)&&!html.includes('kw1'),'il player riceve un indicatore, non riferimenti o percorsi privati');
const s=require('../lib/presentazioni-sessione').crea(),avvio=s.avvia(d,'pubblico'),e={...avvio.stato,token:avvio.token,blockId:b.id};
const prima=s.stato();assert.equal(s.fonte(e),link);assert.deepEqual(s.stato(),prima,'consultare non cambia slide, animazione o sequenza');
assert.throws(()=>s.fonte({...e,token:'falso'}));assert.throws(()=>s.fonte({...e,sequence:99}));assert.throws(()=>s.fonte({...e,slideId:'altra'}));assert.throws(()=>s.fonte({...e,blockId:'assente',link}));
const cmd=s.comando({...e,azione:'avanti'});s.conferma({...cmd,h:0,v:0,fragmentIndex:0});
assert.throws(()=>s.fonte(e),'richiesta di un passaggio precedente');assert.equal(s.fonte({...s.stato(),token:avvio.token,blockId:b.id}),link);
console.log('✓ Fonti PRESENTA: keyword/ritagli, privacy, revisione, passaggio e autorità del player');
// La clip crea un oggetto indipendente, modificabile e annullabile.
const diretto=F.collegamento({rimando:link,nome:'Botanica [lezione]'});
assert.equal(diretto.source.kind,'pdf');assert.equal(diretto.source.id,R.leggi(link).sourceId);assert.equal(diretto.richText[0].text,'Botanica [lezione] · p. 2');
assert(F.collegamento({rimando:R.scriviPdfZaino(z,R.leggi(link).sourceId,null,'b'.repeat(64)),nome:'Botanica'}).richText[0].text.endsWith(' · PDF'));
assert.equal(F.rimando(diretto),link);assert.throws(()=>F.collegamento({rimando:'https://example.com',nome:'Web'}));
const conLink=M.applica(d,{tipo:'inserisciBlocco',slideId:sid,block:diretto});
assert(require('../lib/validate').validatePresentazione(conLink).ok);assert(C.compila(conLink,{fonti:true}).html.includes('class="presenta-link-fonte"'));
assert(!C.compila(conLink).html.includes('presenta-link-fonte'));assert(!JSON.stringify(M.pubblica(conLink)).includes(link));
const h=M.cronologia(d);h.applica({tipo:'inserisciBlocco',slideId:sid,block:diretto});assert.deepEqual(h.annulla(),d);
console.log('✓ Clip PRESENTA: collegamento PDF tipizzato, etichetta, validazione, undo e privacy export');

for(const kind of ['keyword','album','file','pdf']){
 assert.equal(F.rimando({source:{kind,link}}),link);
 assert.equal(F.rimando({source:{kind,link:'pdf:0001#p=2'}}),'pdf:0001#p=2');
}
assert.equal(F.rimando({source:{kind:'file',link:'file:///privato.pdf'}}),'');
