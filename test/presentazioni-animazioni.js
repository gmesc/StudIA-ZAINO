'use strict';
const assert=require('node:assert/strict'),A=require('../App/assets/presentazioni/animazioni'),M=require('../App/assets/presentazioni/modello'),R=require('../App/assets/presentazioni/reveal-adapter'),V=require('../lib/validate');
assert.equal(A.catalogo.length,36);assert.equal(new Set(A.catalogo.map(e=>e.id)).size,36);
const azioni=[{targetId:'a',effect:'fade-in',step:1,duration:1},{targetId:'b',effect:'pulse',step:1,duration:2,start:'after',delay:.3},{targetId:'c',effect:'grow',step:1,start:'with',duration:.5},{targetId:'a',effect:'fade-out',step:2,start:'click'}];
assert.deepEqual(A.tempi(azioni).map(a=>[a.step,a.inizio,a.fine]),[[1,0,1],[1,1.3,3.3],[1,1.3,1.8],[2,0,.6]]);
assert.equal(A.normalizza(azioni.slice(1))[0].start,'click');assert.equal(azioni[1].start,'after');
assert.equal(A.errore({effect:'words'},'image'),'Effetto non compatibile con questo oggetto.');
assert(A.errore({effect:'fade-in',duration:0},'title'));assert(A.errore({effect:'fade-in',delay:21},'title'));assert(A.errore({effect:'path-orbit',distance:Infinity},'title'));
for(const effetto of A.catalogo){
 let d=M.crea('00000000-0000-4000-8000-000000000001','Effetto '+effetto.id),s=d.stacks[0].slides[0].id;
 const type=effetto.tipi[0],block=type==='list'?{type,slot:'body',items:[{id:'p1',markdown:'Uno'},{id:'p2',markdown:'Due'}]}:type==='table'?{type,slot:'body',table:[['Pianeta','Lune'],['Terra','1']]}:type==='shape'?{type,slot:'body',shape:'arrow'}:{type,slot:'body',markdown:'Il Sole e la Terra'};
 d=M.applica(d,{tipo:'inserisciBlocco',slideId:s,block});const id=d.stacks[0].slides[0].blocks[0].id;
 d=M.applica(d,{tipo:'animazioni',slideId:s,animations:[{targetId:id,effect:effetto.id,step:1,start:'click',duration:1.4,delay:.2,distance:40}]});
 assert(V.validatePresentazione(d).ok,effetto.id);assert.equal(M.pubblica(d).stacks[0].slides[0].animations[0].duration,1.4);
 const html=R.compila(d).html;assert(html.includes('data-effetto="'+effetto.id+'"'));assert(html.includes('&quot;inizio&quot;:0.2'));
 const h=M.cronologia(d);h.applica({tipo:'animazioni',slideId:s,animations:[]});assert.deepEqual(h.annulla(),d);
}
// Un ingresso successivo non deve nascondere il primo effetto sullo stesso oggetto.
let doppio=M.crea('00000000-0000-4000-8000-000000000001','Due ingressi');const sid=doppio.stacks[0].slides[0].id;
doppio=M.applica(doppio,{tipo:'inserisciBlocco',slideId:sid,block:{type:'text',slot:'body',markdown:'Sempre visibile fra due clic'}});const bid=doppio.stacks[0].slides[0].blocks[0].id;
doppio=M.applica(doppio,{tipo:'animazioni',slideId:sid,animations:[{targetId:bid,effect:'fade-in',step:1},{targetId:bid,effect:'words',step:2}]});
assert.equal((R.compila(doppio).html.match(/data-entrata="true"/g)||[]).length,1,'un solo ingresso determina la visibilità iniziale');
console.log('✓ 36 effetti, compatibilità, tempi concatenati, limiti, compilazione, privacy e annullamento');
