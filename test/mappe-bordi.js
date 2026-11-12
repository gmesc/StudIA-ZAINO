'use strict';
const A=require('node:assert/strict'),D=require('../App/assets/mappa/disegna'),L=require('../App/assets/mappa/layouts'),S=require('../App/assets/mappa/aspetto'),Q=require('../App/assets/squig/tratti');
const grafo={nodi:[{id:'neutro',testo:'Senza colore'},{id:'manuale',testo:'Manuale',colore:'#ef4444',origine:'utente'},{id:'ramo',testo:'Ramo',gruppo:2}],archi:[{da:'neutro',a:'manuale'}]};
const svg=aspetto=>D.svg(L.run(grafo,{}),{aspetto}).markup;
const card=(s,id)=>s.match(new RegExp('<g class="mnodo" data-id="'+id+'"[^]*?</g>'))[0];
let s=svg();A(!s.includes('class="mbarra"'),'le barre dei rami sono sostituite dai bordi');A(card(s,'neutro').includes('stroke="#9ca3af"'),'nodo neutro gray400');A(card(s,'manuale').includes('stroke="#ef4444"'),'il colore esplicito veste tutto il bordo');A(card(s,'ramo').includes('stroke="#a16207"'),'gruppo assegnato conservato');
s=svg({...S.DEFAULT,bordo:'none'});A(card(s,'manuale').includes('stroke="#ef4444"'),'Senza bordo neutro conserva il colore assegnato');A(card(s,'neutro').includes('stroke="none"'));
A.equal(S.normalizza({bordo:'#64748b'}).bordo,'#9ca3af','stili precedenti migrati al neutro');A.equal(S.normalizza({bordiColorati:1,bordo:'#737373'}).bordo,'#737373','nuova scelta del neutro conservata');A.equal(S.normalizza({freccia:999}).freccia,20);A.equal(S.normalizza({freccia:0}).freccia,3);
function punta(aspetto){return svg(aspetto).match(/<polygon points="([^"]+)"/)[1];}
A.notEqual(punta({...S.DEFAULT,spessore:1}),punta({...S.DEFAULT,spessore:4}),'la punta segue lo spessore');A.notEqual(punta({...S.DEFAULT,freccia:4}),punta({...S.DEFAULT,freccia:16}),'la dimensione della punta è regolabile');
for(const spessore of [.5,1,4])for(const raggio of [0,3,24]){
 const d=Q.contorno(150,80,{raggio,spessore,seme:1});A.equal((d.match(/M/g)||[]).length,1,'un contorno continuo elimina i tagli tra segmenti');A(d.endsWith('Z'),'contorno Squig chiuso');
 const foto=Q.contorno(150,80,{raggio,spessore,seme:1,angoliSuperioriRetti:true});A(/^M0 0/.test(foto),'angolo superiore sinistro retto');A(!foto.includes('M150 24'),'angolo superiore destro retto');
}
const imm={nodi:[{id:'foto',testo:'Albero',colore:'#16a34a',immagine:{id:'prova',w:400,h:300}}],archi:[]};
s=D.svg(L.run(imm,{}),{aspetto:{...S.DEFAULT,tratto:'squig',raggio:24,spessore:4},srcImmagine:()=> 'data:image/png;base64,AA=='}).markup;A(s.includes('class="mbordo mcontorno-squig"'));A(s.includes('stroke="#16a34a"'));A(s.includes('stroke-linejoin="miter"'));A(!s.includes('mbarra'));
for(const tratto of ['squig','drawably']){const m=D.svg(L.run(imm,{}),{aspetto:{...S.DEFAULT,tratto,raggio:24,spessore:4},srcImmagine:()=> 'data:image/png;base64,AA=='}).markup;A(m.includes('class="mbordo mcontorno-'+tratto+'"'));A(m.includes('stroke="#16a34a"'));A(!m.includes('mbarra'));}
console.log('✓ Bordi mappe: colori e neutri, migrazione, punte proporzionate/regolabili, contorni Squig continui e angoli immagini.');
