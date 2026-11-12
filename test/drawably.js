'use strict';
const A=require('node:assert/strict'),D=require('../App/assets/drawably/catalogo'),T=require('../App/assets/drawably/tratti'),V=require('../App/assets/presentazioni/vettori');
const base=D.disegno(D.nuova());
A(!V.valida({...base,drawably:{...base.drawably,seme:-1}}),'metadati Drawably invalidi rifiutati anche dal disegno salvato');
(async()=>{
 A.equal(D.catalogo.length,23);
 for(const d of D.catalogo)A(V.valida(D.disegno(D.nuova(d.kind))),'default originale valido: '+d.kind);
 for(const d of D.catalogo)for(const fattore of [.5,1,1.5]){
  const v=D.nuova(d.kind);v.larghezza=Math.max(32,v.larghezza*fattore);v.altezza=Math.max(32,v.altezza*fattore);const svg=D.disegno(v);
  A(V.valida(svg),d.kind);A(svg.nodes.length,d.kind);A.deepEqual(svg,D.disegno(v));A(svg.nodes.every(n=>['g','path','text'].includes(n.tag)));
 }
 for(const d of D.catalogo)for(const [larghezza,altezza]of [[32,32],[32,2000],[2000,32],[2000,2000]]){
  const svg=D.disegno({...D.nuova(d.kind),larghezza,altezza});A(V.valida(svg),d.kind+' agli estremi');
  const visita=n=>{if(n.attrs['font-size']!==undefined)A(Number(n.attrs['font-size'])>0,d.kind+' caratteri positivi');A(!JSON.stringify(n.attrs).includes('NaN'));n.children.forEach(visita);};svg.nodes.forEach(visita);
 }
 const v=D.nuova();v.proprieta.testo='<script>alert(1)</script>';A(!V.html(D.disegno(v)).includes('<script>'));A(V.html(D.disegno(v)).includes('&lt;'));
 for(const patch of [{componente:'__proto__'},{larghezza:Infinity},{altezza:0},{seme:-1},{proprieta:{colore:'url(http://example.com)'}},{proprieta:{variante:'javascript'}},{proprieta:{onclick:'x'}}])A.throws(()=>D.disegno({...D.nuova(),...patch}));
 for(const immagine of [false,true])for(const spessore of [.5,2,4]){const d=T.contorno(160,90,{immagine,spessore,raggio:24,seme:8});A.equal((d.match(/M/g)||[]).length,1);A(d.endsWith('Z'));A(!d.includes('NaN'));A.equal(d,T.contorno(160,90,{immagine,spessore,raggio:24,seme:8}));}
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),M=require('../App/assets/presentazioni/modello'),P=require('../lib/presentazioni'),X=require('../lib/presentazioni-export'),valida=require('../lib/validate').validatePresentazione;
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'zaino-drawably-'));
 try{
  require('../lib/zaini').crea(tmp,'Scienze');let d=await P.crea(tmp,'scienze','Drawably offline'),sid=d.stacks[0].slides[0].id;
  d=M.applica(d,{tipo:'inserisciBlocco',slideId:sid,block:{type:'drawing',slot:'body',drawing:base,style:{box:{x:20,y:30,width:40,height:20}}}});A(valida(d).ok,JSON.stringify(valida(d).errors));
  d=await P.salva(tmp,'scienze',d,d.revision);A.deepEqual(P.leggi(tmp,'scienze',d.id).stacks[0].slides[0].blocks.find(b=>b.type==='drawing').drawing,base);
  const out=await X.esporta(tmp,'scienze',d.id,tmp,d.revision),html=fs.readFileSync(path.join(out.cartella,'index.html'),'utf8');A(html.includes('Procedi'));A(html.includes('Patrick Hand'));A(!html.includes('drawably/catalogo.js'));A(fs.statSync(path.join(out.cartella,'licenze/drawably.txt')).size>1000);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 console.log('✓ Drawably: 23 elementi × 3 misure, geometrie originali, sicurezza SVG/metadati, tratti chiusi, persistenza e export offline.');
})().catch(e=>{console.error(e);process.exitCode=1});
