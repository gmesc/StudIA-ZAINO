'use strict';
const schema=require('../App/guida-zaino/download/stili/stile.schema.json');
const verifica=new (require('ajv'))({strict:false,ownProperties:true}).compile(schema);
const LIMITE=3*1024*1024;
function leggi(testo,tipo){
 if(typeof testo!=='string'||Buffer.byteLength(testo)>LIMITE)throw Error('Lo stile deve essere un JSON entro 3 MiB.');
 let p;try{p=JSON.parse(testo.replace(/^\uFEFF/,''));}catch(_){throw Error('JSON non leggibile: controlla virgolette, parentesi e virgole.');}
 if(p?.formato!=='zaino-stile')throw Error('Il file non è uno stile ZAINO.');
 if(p.versione!==1)throw Error('Versione dello stile non supportata: serve la versione 1.');
 if(p.tipo!==tipo)throw Error('In questo pannello puoi aprire soltanto uno stile di tipo '+tipo+'.');
 if(!verifica(p)){
  const e=verifica.errors[0],campo=(e.instancePath||'file')+(e.params.additionalProperty?'/'+e.params.additionalProperty:'');
  throw Error('Stile non valido ('+campo+'): '+(e.keyword==='additionalProperties'?'proprietà sconosciuta':e.keyword==='required'?'manca '+e.params.missingProperty:'controlla il valore nella guida')+'.');
 }
 if(p.stile.sfondoPersonale)require('../App/assets/interfaccia/sfondi').esigi(p.stile.sfondoPersonale);
 if(p.tipo==='mappa'&&p.stile.sfondo==='personale'&&!p.stile.sfondoPersonale)throw Error('Lo sfondo personale richiede un’immagine incorporata.');
 if(p.tipo==='slide'&&p.stile.carta&&p.stile.sfondoPersonale)throw Error('Scegli una carta oppure uno sfondo personale.');
 if(p.tipo==='slide'&&p.stile.sfondoPersonale?.modo==='pattern')throw Error('Gli sfondi slide sono immagini, non pattern.');
 return p;
}
function demo(d){
 const M=require('../App/assets/presentazioni/modello');M.esigi(d);
 if(Object.keys(d.assets).length||M.posizioni(d).length!==9||M.posizioni(d).some(p=>p.slide.blocks.some(b=>!['title','text','list','navbar'].includes(b.type))))throw Error('La demo degli stili accetta solo testo e navbar, senza risorse esterne.');
 return require('../App/assets/presentazioni/reveal-adapter').compila(d);
}
module.exports={leggi,demo};
