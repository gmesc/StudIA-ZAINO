/* Il piano conta tutte le chiamate prima della conferma, senza scartare contenuti per similarità. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ZainoSchedePiano=factory();}(typeof self!=='undefined'?self:this,function(){
 'use strict';
 const CARATTERI=24000,FUSIONE=32000;
 function dividi(lista,misura,max,numero=Infinity){
  const gruppi=[];let gruppo=[],size=0;
  for(const item of lista){const n=misura(item);if(n>max)throw Error('Un elemento supera la dimensione prevista per l’analisi.');if(gruppo.length&&(size+n>max||gruppo.length>=numero)){gruppi.push(gruppo);gruppo=[];size=0;}gruppo.push(item);size+=n;}
  if(gruppo.length)gruppi.push(gruppo);return gruppi;
 }
 const parti=chunks=>dividi(chunks,c=>c.text.length,CARATTERI);
 const candidati=items=>items.map(({title,text},id)=>({id,title,text}));
 function confronti(items){
  const gruppi=dividi(candidati(items),i=>JSON.stringify(i).length+1,FUSIONE,48),jobs=[];
  // ponytail: confronto di tutti i gruppi, quadratico; il costo massimo è dichiarato nella stima.
  if(gruppi.length===1)return gruppi[0].length>1?gruppi:[];
  for(let a=0;a<gruppi.length;a++)for(let b=a+1;b<gruppi.length;b++)jobs.push(gruppi[a].concat(gruppi[b]));
  return jobs;
 }
 function unisci(items,gruppi=[]){
  const parent=items.map((_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i]));
  for(const gruppo of gruppi){for(const id of gruppo)if(!Number.isInteger(id)||id<0||id>=items.length)throw Error('Elemento da unire non disponibile.');for(const id of gruppo.slice(1))parent[find(id)]=find(gruppo[0]);}
  const normalizza=s=>s.normalize('NFC').replace(/\s+/g,' ').trim(),identici=new Map();
  items.forEach((i,id)=>{const key=JSON.stringify([normalizza(i.title),normalizza(i.text)]);if(identici.has(key))parent[find(id)]=find(identici.get(key));else identici.set(key,id);});
  const tutti=new Map();items.forEach((item,id)=>{const key=find(id),g=tutti.get(key)||[];g.push(item);tutti.set(key,g);});
  return [...tutti.values()].map(g=>({...g.reduce((a,b)=>b.text.length>a.text.length?b:a),refs:[...new Set(g.flatMap(i=>i.refs))]}));
 }
 function stima(chunks,schema){
  const p=parti(chunks),n=p.length;
  // Il formato atteso viene dallo stesso schema inviato al modello, non da un secondo tetto.
  const item=schema.properties.items,fields=item.items.properties;
  const capienza=Math.max(1,Math.floor(FUSIONE/(fields.title.maxLength+fields.text.maxLength+50)));
  const gruppi=Math.ceil(n*item.maxItems/capienza),merge=n>1?Math.max(1,gruppi*(gruppi-1)/2):0,calls=n+merge;
  const input=p.reduce((v,g)=>v+Math.ceil(JSON.stringify(g).length/3)+3500,0);
  return {parts:n,mergeCalls:merge,estimatedCalls:calls,estimatedInputTokens:input+merge*(Math.ceil(2*FUSIONE/3)+3500),estimatedOutputTokens:calls*8192,minInputTokens:input,minOutputTokens:n*1500,maxCalls:calls*2};
 }
 function tariffa(provider,model,data=new Date().toISOString().slice(0,10)){
  const m=String(model||'').replace(/^models\//,'');
  const listino={google:{'gemini-4-argon':data<'2026-12-01'?[2,10]:[4,20],'gemini-2.5-flash':[.30,2.50],'gemini-2.5-pro':[1.25,10],'gemini-2.5-flash-lite':[.10,.40]},openai:{'gpt-4.1-mini':[.40,1.60],'gpt-4.1-mini-2025-04-14':[.40,1.60]},anthropic:{'claude-sonnet-4-6':[3,15],'claude-sonnet-4-5':[3,15],'claude-haiku-4-5':[1,5]}};
  const prezzi=listino[provider]?.[m];return prezzi?{input:prezzi[0],output:prezzi[1],verifiedAt:'2026-10-27',url:{google:'https://ai.google.dev/gemini-api/docs/pricing',openai:'https://developers.openai.com/api/docs/models/gpt-4.1-mini',anthropic:'https://platform.claude.com/docs/en/about-claude/pricing'}[provider]}:null;
 }
 function costo(piano,prezzi){
  if(!prezzi||!['input','output'].every(k=>typeof prezzi[k]==='number'&&Number.isFinite(prezzi[k])&&prezzi[k]>=0&&prezzi[k]<=10000))return null;
  return {min:(piano.minInputTokens*prezzi.input+piano.minOutputTokens*prezzi.output)/1e6,max:((piano.estimatedInputTokens*2+piano.maxCalls*400)*prezzi.input+piano.estimatedOutputTokens*2*prezzi.output)/1e6};
 }
 return {parti,confronti,unisci,stima,tariffa,costo};
}));
