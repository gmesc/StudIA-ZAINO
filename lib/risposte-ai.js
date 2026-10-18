'use strict';
// Una copia è un appunto indipendente: nessun dato deve sparire eliminando la chat.
const F = require('./fonti-ai'), P = require('./chat-profili'), A = require('./appunti');
const R = require('../App/assets/rimandi/sintassi');
const citazioni = require('../App/assets/chat/citazioni');
function testoSicuro(text) {
  return String(text || '').replace(/!?(\[[^\]\n]*\])\([^)]*\)/g, '$1')
    .replace(/\[\[/g,'［［').replace(/\]\]/g,'］］').replace(/[<>]/g,c=>c==='<'?'&lt;':'&gt;');
}
function prepara(message, sessionId, title='Risposta del tutor AI') {
  const marker = '<!-- zaino-ai:' + sessionId + ':' + message.id + ' -->';
  const cited = citazioni.citate(message.content,message.context?.sources);
  function linkFonte(s,label){
    const n=s.kind==='pdf' && require('./materiali').numero(s.file.split('/').pop());
    return n && s.sourceId ? R.link(label,R.scriviPdf(n,s.page || 1,s)) : label;
  }
  const riferimenti = cited.map((s,i) => {
    const label = testoSicuro((s.file || s.label || s.citation).split('/').pop() + (s.page ? ' · p. '+s.page : '')).replace(/[\[\]]/g,'');
    const quote=typeof s.text==='string'?s.text:s.quote;
    const nota=s.quoteComplete!==true && typeof s.text!=='string' && quote?.length>=800
      ? '\n\n   *Estratto storico abbreviato: sono conservati solo i primi '+quote.length+' caratteri. Apri la fonte per leggere il passaggio completo.*' : '';
    return (i+1) + '. ' + linkFonte(s,label) + nota + (quote ? '\n\n   > ' + testoSicuro(quote).replace(/\n/g,'\n   > ') : '');
  });
  // I segnaposto permettono di sanificare anche link del modello che avvolgono
  // una citazione, prima di inserire i soli rimandi verificati.
  let prefix='ZAINOCITAZIONEVERIFICATA';while(message.content.includes(prefix))prefix+='X';
  let from=0,content='';const links=[];
  for(const ref of citazioni.analizza(message.content,message.context?.sources).occorrenze){
    const token=prefix+links.length+'FINE';
    links.push([token,linkFonte(ref.source,String(ref.numero).replace(/\d/g,d=>'⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]))]);
    content+=message.content.slice(from,ref.start)+token;from=ref.end;
  }
  content=testoSicuro(content+message.content.slice(from));
  for(const [token,link] of links)content=content.replaceAll(token,link);
  const heading=testoSicuro(title).replace(/[\r\n]+/g,' ').replace(/[\\`*_\[\]]/g,'\\$&');
  const body = '### '+heading+'\n\n' + content + '\n\n' +
    (riferimenti.length ? 'Fonti della risposta (versione citata):\n\n' + riferimenti.join('\n\n') + '\n\n' : 'Nessuna fonte verificabile citata.\n\n') +
    'Provenienza AI: ' + testoSicuro([message.provider,message.model,message.createdAt].filter(Boolean).join(' · ')) +
    '\nConversazione: ' + sessionId + ' · Messaggio: ' + message.id + '\n\n' + marker;
  return { body, marker };
}
function salva(vault,zaino,id,messageId,target={}) {
  const session = require('./chat').leggi(vault,zaino,id);
  const message = session.messages.find(m=>m.id===messageId && m.role==='assistant');
  if(!message) throw new Error('Risposta non trovata.');
  const {body,marker}=prepara(message,id);
  const file=target.file || 'Risposta AI '+message.id+'.md';
  if(!A.nomeValido(file) || !/\.md$/i.test(file) || file.startsWith('_')) throw new Error('Appunto di destinazione non valido.');
  const parti=[...F.parti(zaino),'APPUNTI',file];
  P.percorsoSicuro(vault,parti);
  let raw=null;
  try{raw=P.leggiFileSicuro(vault,parti,2*1024*1024).toString('utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  const old=raw===null?null:A.parse(raw);
  if(old?.body.includes(marker)) return {file,duplicate:true,appended:'',body:old.body};
  if(target.file && (typeof target.expectedBody!=='string' || !old || old.body.trimEnd()!==target.expectedBody.replace(/^\n+/,'').trimEnd())) throw new Error('Appunto cambiato sul disco: riaprilo prima di aggiungere la risposta.');
  if(!target.file && old) throw new Error('Il nome del nuovo appunto è già occupato.');
  const base=target.file?target.expectedBody:'', appended=(base?'\n\n':'')+body;
  // save usa tmp+rename e ricostruisce l'indice; il confronto avviene nello stesso turno sincrono.
  const now=new Date().toISOString(),meta={...(old?.meta || {title:'Risposta AI',creato:now}),modificato:now};
  P.scriviAtomico(vault,parti,A.serialize(meta,base+appended));
  A.reindex(vault,zaino);
  return {file,duplicate:false,appended,body:base+appended};
}
module.exports={testoSicuro,prepara,salva};
