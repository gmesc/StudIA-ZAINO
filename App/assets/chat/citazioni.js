/* La stessa citazione si riconosce nella chat, nel main e nella copia personale.
 * I nomi restituiti dal modello valgono solo se presenti nel contesto salvato. */
(function(root,factory){
  if(typeof module==='object' && module.exports)module.exports=factory();
  else root.ZainoCitazioni=factory();
}(typeof self!=='undefined'?self:this,function(){
  'use strict';
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  function chiave(s){return JSON.stringify([s.sourceId || s.url || s.file || s.citation,s.revision || '',s.page || null]);}
  // I passaggi restano prove distinte; il lettore apre una sola volta la stessa pagina.
  function perRiferimenti(refs,sources){
    const chunks=new Map((sources || []).map(s=>[s.chunkId,s])),visti=new Set(),fonti=[];
    for(const id of refs || []){const s=chunks.get(id);if(!s)continue;const key=chiave(s);if(visti.has(key))continue;visti.add(key);fonti.push(s);}
    return fonti;
  }
  function analizza(text,sources){
    text=String(text || '');
    const tokens=new Map(),fonti=[],numeri=new Map(),occorrenze=[];
    for(const source of sources || [])for(const token of [source.citation,source.label,source.url]){
      if(typeof token==='string' && token && !tokens.has(token))tokens.set(token,source);
    }
    if(tokens.size){
      // I backtick che avvolgono il solo riferimento sono presentazione del
      // modello: si eliminano insieme al tag, senza eseguire il markdown.
      const re=new RegExp('(`?)('+[...tokens.keys()].sort((a,b)=>b.length-a.length).map(escape).join('|')+')\\1','g');
      for(const match of text.matchAll(re)){
        const source=tokens.get(match[2]),key=chiave(source);
        if(!numeri.has(key)){numeri.set(key,fonti.length+1);fonti.push(source);}
        occorrenze.push({start:match.index,end:match.index+match[0].length,source,numero:numeri.get(key)});
      }
    }
    return {fonti,occorrenze};
  }
  function sostituisci(text,sources,render){
    text=String(text || '');let from=0,out='';
    for(const ref of analizza(text,sources).occorrenze){out+=text.slice(from,ref.start)+render(ref);from=ref.end;}
    return out+text.slice(from);
  }
  function normalizza(text,sources){return sostituisci(text,sources,r=>r.source.citation);}
  function apice(n){return String(n).replace(/\d/g,d=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);}
  function numerata(text,sources){return sostituisci(text,sources,r=>apice(r.numero));}
  function citate(text,sources){
    const found=analizza(text,sources).fonti;
    // Compatibilità con le chat anteriori agli UUID, che citavano i file in prosa.
    const norm=s=>String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' '),body=norm(text);
    for(const source of sources || []){
      if(source.sourceId || found.some(s=>chiave(s)===chiave(source)))continue;
      const name=norm(String(source.file || '').split('/').pop()).trim();if(!name)continue;
      for(let i=body.indexOf(name);i>=0;i=body.indexOf(name,i+1)){
        if(!source.page || new RegExp('^[^\\n]{0,12}?\\bp(?:ag(?:ina)?)?\\.? ?'+source.page+'(?!\\d)').test(body.slice(i+name.length))){found.push(source);break;}
      }
    }
    return found;
  }
  return {analizza,citate,normalizza,numerata,chiave,perRiferimenti};
}));
