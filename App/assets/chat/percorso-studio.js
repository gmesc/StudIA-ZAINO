/* Decisioni del percorso: gli archivi restano distinti, la raccolta li rende riconoscibili. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../fonti/nomi'));else root.ZainoPercorso=factory(root.FontiNomi);}(typeof self!=='undefined'?self:this,function(FontiNomi){
 'use strict';
 function raccolta(cards=[],questions=[]){return [...cards.map(c=>({...c,tipo:'scheda'})),...questions.filter(q=>q.saved).map(q=>({...q,tipo:'domanda',title:q.question,file:[...new Set(q.sources.map(s=>s.file))].join(' · ')}))];}
 function filtra(rows,query='',tipo='all'){const q=query.trim().toLocaleLowerCase('it');return rows.filter(r=>(tipo==='all'||r.tipo===tipo)&&((r.file||'')+' '+r.title+' '+(r.tipo==='domanda'?'Domanda Ripasso':'')).toLocaleLowerCase('it').includes(q));}
 function fontePreferita(sources,candidates=[],old=''){for(const file of candidates.filter(Boolean)){const exact=sources.filter(s=>s.file===file),found=exact.length?exact:sources.filter(s=>s.file.split('/').pop()===file);if(found.length===1)return found[0].id;}return sources.some(s=>s.id===old)?old:'';}
 function riassunto(scope,sources=[]){const chosen=scope.mode==='all'?sources:sources.filter(s=>scope.sourceIds.includes(s.id)),missing=scope.mode==='selected'?scope.sourceIds.filter(id=>!sources.some(s=>s.id===id)).length:0;return (chosen.length?chosen.slice(0,3).map(s=>s.kind==='appunto'||s.file.startsWith('APPUNTI/')?s.file.split('/').pop():FontiNomi.visibile(s.file.split('/').pop())).join(' · ')+(chosen.length>3?' · e altri '+(chosen.length-3):''):'Nessun materiale')+(missing?' · '+missing+' non disponibile':'');}
 function domande(questions=[],cardQuestions=[]){const all=new Map(cardQuestions.map(q=>[q.id,q]));for(const q of questions)if(q.saved)all.set(q.id,{...all.get(q.id),...q,scheda:q.scheda||all.get(q.id)?.scheda});return [...all.values()];}
 function coda(questions,due,filter='due',query='',scheda='all'){
  const text=query.trim().toLocaleLowerCase('it');
  return questions.filter(q=>(q.saved||q.scheda)&&(filter==='all'||filter==='new'&&!q.esito||filter==='due'&&(due.includes(q.id)||!q.saved&&q.scheda)||filter==='later'&&q.saved&&!due.includes(q.id))
   &&(scheda==='all'||scheda==='none'&&!q.scheda||q.scheda?.sourceId===scheda)
   &&(!text||[q.question,q.scheda?.title,q.scheda?.file,...(q.sources||[]).map(s=>s.file)].join(' ').toLocaleLowerCase('it').includes(text)));
 }
 function gruppiDomande(rows){
  const groups=new Map();for(const q of rows){
   const files=[...new Set((q.sources||[]).map(s=>s.file))].sort(),id=JSON.stringify(files);
   if(!groups.has(id))groups.set(id,{id,files,questions:[],schede:[]});const group=groups.get(id);
   if(!q.scheda){group.questions.push(q);continue;}
   let card=group.schede.find(s=>s.sourceId===q.scheda.sourceId);
   if(!card){card={...q.scheda,questions:[]};group.schede.push(card);}card.questions.push(q);
  }return [...groups.values()].sort((a,b)=>a.id.localeCompare(b.id,'it'));
 }
 function ambitoDomanda(scope,q){if(scope.mode==='all')return scope;return {...scope,sourceIds:[...new Set([...scope.sourceIds,...q.sources.map(s=>s.sourceId)])]};}
 function configurato(config,keys){return !!(config?.provider&&config.model&&(keys?.[config.provider]===true||keys?.[config.provider]?.set));}
 function riprendi(questions,due,pausedId){return questions.find(q=>q.saved&&q.id===pausedId)||coda(questions,due)[0]||null;}
 return {riprendi,ambitoDomanda,configurato,raccolta,filtra,fontePreferita,riassunto,coda,domande,gruppiDomande};
}));
