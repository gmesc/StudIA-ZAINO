'use strict';
const assert=require('node:assert/strict'),P=require('../App/assets/chat/percorso-studio');
const cards=[{sourceId:'a',preset:'sintesi',title:'Sintesi',file:'MATERIALI/A.pdf',status:'current'}];
const questions=[{id:'q',saved:true,question:'Perché la luce?',sources:[{file:'MATERIALI/A.pdf'}],attempts:[{id:'t'}]}, {id:'draft',saved:false,question:'Bozza',sources:[]}];
const rows=P.raccolta(cards,questions);
assert.equal(rows.length,2);assert.equal(rows[1].id,'q');assert.equal(rows[1].tipo,'domanda');assert.equal(rows[0].tipo,'scheda');
assert.deepEqual(P.filtra(rows,'luce','domanda').map(r=>r.id),['q']);assert.equal(P.filtra(rows,'','scheda').length,1);
assert.equal(P.fontePreferita([{id:'a',file:'MATERIALI/PDF/A.pdf'},{id:'b',file:'APPUNTI/B.md'}],['APPUNTI/B.md'],'a'),'b');
assert.equal(P.fontePreferita([{id:'a',file:'x/A.pdf'},{id:'b',file:'y/A.pdf'}],['A.pdf'],''),'','un nome ambiguo non sceglie il file sbagliato');
assert.match(P.riassunto({mode:'selected',sourceIds:['a','missing']},[{id:'a',file:'A.pdf'}]),/1 non disponibile/);
assert.match(P.riassunto({mode:'all'},[]),/Nessun materiale/);
const qs=[{id:'one',saved:true,esito:'buono'},{id:'two',saved:true},{id:'three',saved:true,esito:'buono'}];
assert.deepEqual(P.coda(qs,['one','two'],'due').map(q=>q.id),['one','two']);
assert.deepEqual(P.coda(qs,['one','two'],'new').map(q=>q.id),['two']);
assert.deepEqual(P.coda(qs,['one','two'],'later').map(q=>q.id),['three']);
assert.equal(P.configurato({provider:'openai',model:'x'},{openai:{set:false}}),false);
assert.equal(P.configurato({provider:'openai',model:'x'},{openai:{set:true}}),true);
console.log('percorso-studio: raccolta comune, filtri, fonti non ambigue e coda OK');

assert.deepEqual(P.ambitoDomanda({mode:'all',sourceIds:[]},{sources:[{sourceId:'b'}]}),{mode:'all',sourceIds:[]});
assert.deepEqual(P.ambitoDomanda({mode:'selected',sourceIds:['a']},{sources:[{sourceId:'b'}]}).sourceIds,['a','b']);

assert.equal(P.riprendi(qs,['one','two'],'three').id,'three','Riprendi mantiene la domanda in pausa anche se non dovuta');
assert.equal(P.riprendi(qs,['one','two'],'rimossa').id,'one','Una domanda rimossa lascia posto alla prima dovuta');
assert.equal(P.riprendi(qs,[],null),null,'Nessuna domanda dovuta: invita a scegliere, senza anticipare una scadenza');
assert.equal(P.riprendi([{id:'bozza',saved:false}],['bozza'],'bozza'),null);
