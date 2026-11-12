'use strict';
const A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const radice=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),origine=require('../vendor/pretext/provenienza.json');
for(const [file,h]of Object.entries(origine.files))A.equal(hash(fs.readFileSync(path.join(radice,'vendor/pretext',file))),h,'sorgente fissato: '+file);
A.equal(fs.readFileSync(path.join(radice,'App/assets/licenze/pretext.txt'),'utf8'),fs.readFileSync(path.join(radice,'vendor/pretext/LICENSE'),'utf8'));
A.match(fs.readFileSync(path.join(radice,'App/assets/licenze/pretext.txt'),'utf8'),/Chromium[\s\S]*WebKit[\s\S]*UNICODE LICENSE V3/);
// La misura iniettata è deliberatamente deterministica. La parità dei font veri
// si prova nel browser; qui si difendono cursori, cache e scelte del chiamante.
let misure=0;const segmenter=new Intl.Segmenter('it',{granularity:'grapheme'}),canvasPrima=global.OffscreenCanvas;
global.OffscreenCanvas=class{getContext(){return {font:'10px sans-serif',measureText(t){misure++;return {width:[...segmenter.segment(t)].length*10};}};}};
try{
 const P=require('../App/assets/presentazioni/vendor/pretext'),I=require('../App/assets/pretext/impaginazione').crea(P),op={font:'10px Arial',larghezza:50,interlinea:12};
 const r=I.misura('uno due tre',op);A.deepEqual(r.lines.map(l=>l.text.trimEnd()),['uno','due','tre']);A.equal(r.height,36);A.deepEqual(I.gruppiParole('uno due tre',op),[0,1,2]);
 const prima=misure,ridimensionato=I.misura('uno due tre',{...op,larghezza:90});A.deepEqual(ridimensionato.lines.map(l=>l.text.trimEnd()),['uno due','tre']);A.equal(misure,prima,'un resize cambia le righe riusando le misure');
 A.equal(I.gruppiParole('lunghissima',op),null,'non impone al DOM span una parola spezzata');
 A.deepEqual(I.gruppiParole('   uno   due  ',op),[0,1]);A.equal(I.misura('',op).lineCount,0);
 A.throws(()=>I.misura('x',{...op,larghezza:NaN}));A.throws(()=>I.misura('x',{...op,interlinea:0}));
 I.invalida();I.misura('uno due tre',op);A(misure>prima,'font caricati: le misure precedenti sono scartate');
 const altro=misure;I.misura('uno due tre',{...op,dpr:2});A(misure>altro,'cambio DPR: misure ricreate');
 const X=require('../lib/presentazioni-export'),M=require('../App/assets/presentazioni/modello'),d=M.crea(crypto.randomUUID(),'Pretext');
 const html=X.html(d).html;A(html.includes('runtime/pretext.js'));A(html.indexOf('runtime/pretext.js')<html.indexOf('impaginazione.js'));A(html.indexOf('impaginazione.js')<html.indexOf('animazioni-dom.js'));
 const runtime=X.runtime();A(runtime.some(f=>f.nome==='pretext.js'));A(runtime.some(f=>f.nome==='licenze/pretext.txt'));
 console.log('✓ Pretext: sorgenti e licenza fissati, motore reale con metriche iniettate, righe, cache, fallback e runtime offline.');
}finally{if(canvasPrima===undefined)delete global.OffscreenCanvas;else global.OffscreenCanvas=canvasPrima;}
