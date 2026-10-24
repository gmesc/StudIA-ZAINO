/* Decisioni del percorso: gli archivi restano distinti, la raccolta li rende riconoscibili. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ZainoPercorso=factory();}(typeof self!=='undefined'?self:this,function(){
 'use strict';
 function raccolta(cards=[],questions=[]){return [...cards.map(c=>({...c,tipo:'scheda'})),...questions.filter(q=>q.saved).map(q=>({...q,tipo:'domanda',title:q.question,file:[...new Set(q.sources.map(s=>s.file))].join(' · ')}))];}
 function filtra(rows,query='',tipo='all'){const q=query.trim().toLocaleLowerCase('it');return rows.filter(r=>(tipo==='all'||r.tipo===tipo)&&((r.file||'')+' '+r.title+' '+(r.tipo==='domanda'?'Domanda Ripasso':'')).toLocaleLowerCase('it').includes(q));}
 function fontePreferita(sources,candidates=[],old=''){for(const file of candidates.filter(Boolean)){const exact=sources.filter(s=>s.file===file),found=exact.length?exact:sources.filter(s=>s.file.split('/').pop()===file);if(found.length===1)return found[0].id;}return sources.some(s=>s.id===old)?old:'';}
 function riassunto(scope,sources=[]){const chosen=scope.mode==='all'?sources:sources.filter(s=>scope.sourceIds.includes(s.id)),missing=scope.mode==='selected'?scope.sourceIds.filter(id=>!sources.some(s=>s.id===id)).length:0;return (chosen.length?chosen.slice(0,3).map(s=>s.file.split('/').pop()).join(' · ')+(chosen.length>3?' · e altri '+(chosen.length-3):''):'Nessun materiale')+(missing?' · '+missing+' non disponibile':'');}
 function coda(questions,due,filter='due'){return questions.filter(q=>q.saved&&(filter==='all'||filter==='new'&&!q.esito||filter==='due'&&due.includes(q.id)||filter==='later'&&!due.includes(q.id)));}
 function ambitoDomanda(scope,q){if(scope.mode==='all')return scope;return {...scope,sourceIds:[...new Set([...scope.sourceIds,...q.sources.map(s=>s.sourceId)])]};}
 function configurato(config,keys){return !!(config?.provider&&config.model&&(keys?.[config.provider]===true||keys?.[config.provider]?.set));}
 function riprendi(questions,due,pausedId){return questions.find(q=>q.saved&&q.id===pausedId)||coda(questions,due)[0]||null;}
 return {riprendi,ambitoDomanda,configurato,raccolta,filtra,fontePreferita,riassunto,coda};
}));
