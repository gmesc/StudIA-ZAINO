/* La fonte appartiene al documento: il player non può chiedere un link arbitrario. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../rimandi/sintassi'),require('./testo'));else root.PresentaFonti=factory(root.RimandiSintassi,root.PresentaTesto);})(typeof window==='undefined'?this:window,function(R,T){
 'use strict';
 function rimando(blocco){const s=blocco?.source;if(!['keyword','album','pdf','file'].includes(s?.kind)||typeof s.link!=='string')return '';const r=R.leggi(s.link);return r?.tipo==='pdf-zaino'||r?.tipo==='pdf'&&Number.isInteger(r.pagina)&&r.pagina>0&&r.pagina<=999999?s.link:'';}
 function dallaSessione(doc,stato,e){
  if(e.sequence!==stato.sequence||e.slideId!==stato.slideId||e.h!==stato.h||e.v!==stato.v||e.fragmentIndex!==stato.fragmentIndex)throw Error('La slide o il passaggio sono cambiati: riapri il menu della fonte.');
  const b=doc.stacks[stato.h]?.slides[stato.v]?.blocks.find(b=>b.id===e.blockId&&!b.hidden),link=rimando(b);
  if(!link)throw Error('Questo oggetto non ha una fonte PDF disponibile.');return link;
 }
 function collegamento(info){
  const ref=R.leggi(info?.rimando);if(ref?.tipo!=='pdf-zaino')throw Error('Scegli una fonte PDF valida.');
  const nome=String(info.nome||'Fonte PDF').trim().slice(0,240),testo=nome+(ref.intero?' · PDF':' · p. '+ref.pagina);
  return {type:'text',slot:'body',markdown:T.markdown([{text:testo}]),richText:[{text:testo}],source:{kind:'pdf',id:ref.sourceId,title:nome,link:info.rimando},style:{underline:true}};
 }
 return {rimando,dallaSessione,collegamento};
});
