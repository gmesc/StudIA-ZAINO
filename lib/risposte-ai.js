'use strict';
// Una copia è un appunto indipendente: nessun dato deve sparire eliminando la chat.
const F = require('./fonti-ai'), P = require('./chat-profili'), A = require('./appunti');
const R = require('../App/assets/rimandi/sintassi');
const citazioni = require('../App/assets/chat/citazioni');
function testoSicuro(text) {
  return String(text || '').replace(/!?(\[[^\]\n]*\])\([^)]*\)/g, '$1')
    .replace(/\[\[/g,'［［').replace(/\]\]/g,'］］').replace(/[<>]/g,c=>c==='<'?'&lt;':'&gt;');
}
function prepara(message, sessionId) {
  const marker = '<!-- zaino-ai:' + sessionId + ':' + message.id + ' -->';
  const cited = citazioni.citate(message.content,message.context?.sources);
  const riferimenti = cited.map((s,i) => {
    const label = testoSicuro((s.file || s.label || s.citation).split('/').pop() + (s.page ? ' · p. '+s.page : '')).replace(/[\[\]]/g,'');
    const n = s.kind === 'pdf' && require('./materiali').numero(s.file.split('/').pop());
    const link = n && s.sourceId ? R.link(label,R.scriviPdf(n,s.page || 1,s)) : label;
    return (i+1) + '. ' + link + (s.quote ? '\n   > ' + testoSicuro(s.quote).replace(/\n/g,'\n   > ') : '');
  });
  const body = '### Risposta del tutor AI\n\n' + testoSicuro(citazioni.numerata(message.content,message.context?.sources)) + '\n\n' +
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
