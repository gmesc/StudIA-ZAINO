'use strict';
// I privilegi descrivono l'operazione, mai un percorso liberamente scelto dal renderer.
const path = require('node:path');
const {fileURLToPath} = require('node:url');
const disco = require('./permessi-disco');
function urlEsterna(value) {
  try { const u=new URL(value); return ['https:','http:'].includes(u.protocol) && !!u.hostname && !u.username && !u.password; }
  catch (_) { return false; }
}
const GLOBALE = new Set(['sicurezza:stato','sicurezza:installa','sicurezza:attiva','sicurezza:firme','cfg:get','vault:choose','file:selezionato','file:verifica','keys:status','keys:set','keys:clear','profile:get','profile:skip','profile:skipped','costs:summary','costs:log','voce:elenco','voce:rendi','voce:scarta','profilo:atlante','crediti:leggi','crediti:chromium','crediti:notice','stampa:pdf','stampa:mostra','guida:apri','ambiente:rileva','onboarding:stato','onboarding:pipelineVista','onboarding:fatto','file:reveal','ocrpdf:apri','ocrpdf:pagina','ocrpdf:chiudi']);
const ZAINO = new Set(['zaino:list','zaino:create','zaino:rinomina','zaino:elimina','zaino:gruppi-leggi','zaino:gruppi-salva','lettura:leggi','lettura:segna','ascolto:leggi','ascolto:segna','riga:leggi','riga:segna','riga:dimentica','media:importa','media:elenco','media:elimina','media:usi','fonti:importa','fonti:elimina','fonti:rinomina','fonti:rimossi','fonti:usi','fonti:dimentica','fonti:indiceScrivi','fonti:indiceServe','fonti:indici','ocrpdf:applica','ripasso:leggi','ripasso:salva','ripasso:registra','ripasso:ids','ripasso:pota','corpus:list','mappe:elenco','mappe:apri','mappe:salva','mappe:rimuovi','note:rimuovi','album:rimuovi','mappe:rinomina','mappe:semina']);
const CHAT = new Set(['catalogo','settings','saveSettings','models','profiles','saveProfile','cloneProfile','deleteProfile','activateProfile','list','read','create','remove','rename','branch','sources','resolveSource','saveAnswer','scope','citation','send','cancel']);
const RAG = new Set(['state','install','cancel','watch','index','search','reset','resolve']);
const STUDIO = new Set(['presets','fromCard','estimate','cards','card','analyze','copyCard','state','start','answer','keep','outcome','resume','cancel']);
function idValido(id) { return typeof id==='string' && id.length<=180 && !!id && !id.startsWith('.') && !/[/\\\x00-\x1f]/.test(id); }
function privilegi(canale, o={}, ctx) {
  o=o||{};
  const {vault,appDir,userData,temporanei,risorse}=ctx;
  const p={lettura:[appDir],scrittura:[],metadati:[appDir,...(vault?[vault]:[]),'/usr/bin/sips','/usr/bin/say']};
  if(['crediti:leggi','crediti:chromium'].includes(canale) && typeof risorse==='string' && path.isAbsolute(risorse))p.metadati.push(path.join(risorse,'LICENSES.chromium.html'));
  const read = (...f) => p.lettura.push(...f.filter(Boolean));
  const write = (...f) => p.scrittura.push(...f.filter(Boolean));
  let id=o.corso||o.zaino;
  if(canale==='vault:sync') {
    const sync=require('./vault-sincrono');
    if(!sync.consentito(o.gruppo,o.metodo))throw Error('Funzione non autorizzata.');
    if(['notes','evidenze','album','mappe'].includes(o.gruppo) && !['identita','heic','heicDisponibile'].includes(o.metodo))id=o.args?.[0];
    if(o.gruppo==='materiali')id=o.args?.[1];
    if(o.gruppo==='iniziale')read(vault&&path.join(vault,'Zaini'));
    if(o.gruppo==='prefs' && vault){const area=path.join(vault,'.studia');read(area);if(sync.scrive(o.gruppo,o.metodo))write(area);}
    if(o.gruppo==='album' && o.metodo==='heic'){read(temporanei);write(temporanei);}
  } else if(!GLOBALE.has(canale) && !ZAINO.has(canale)) {
    const [famiglia,azione]=canale.split(':');
    if(!({chat:CHAT,rag:RAG,studio:STUDIO}[famiglia]?.has(azione)))throw Error('Funzione non autorizzata.');
  }
  if(id!=null && id!=='' && !idValido(id))throw Error('Zaino non valido.');
  const z=vault&&id?path.join(vault,'Zaini',id):null;
  if(z)read(z);
  const area = s => z && path.join(z,s);
  const famiglia=canale.split(':')[0],azione=canale.split(':')[1];
  if(canale==='vault:sync' && z && require('./vault-sincrono').scrive(o.gruppo,o.metodo))write(area({notes:'APPUNTI',evidenze:'APPUNTI',album:'ALBUM'}[o.gruppo]));
  if(['zaino:list','zaino:create','zaino:rinomina','zaino:elimina'].includes(canale) && vault) {
    read(path.join(vault,'Zaini'));if(canale!=='zaino:list')write(path.join(vault,'Zaini'));
  }
  if(canale==='zaino:gruppi-salva'){const sub=o.sezione==='appunti'?'APPUNTI':o.sezione==='mappe'?'MAPPE':'MATERIALI';write(area(sub+'/_gruppi.json'));if(!o.sezione||o.sezione==='fonti')write(...['PDF','Fonti','Documenti','Web'].map(d=>area('MATERIALI/'+d)));}
  if(/^mappe:(salva|rimuovi|rinomina|semina)$/.test(canale))write(area('MAPPE'));
  if(canale==='note:rimuovi')write(area('APPUNTI'));
  if(canale==='album:rimuovi')write(area('ALBUM'));
  if(/^riga:(segna|dimentica)$/.test(canale))write(area('APPUNTI'));
  if(canale==='lettura:segna')write(area('_lettura.json'));
  if(canale==='ascolto:segna')write(area('_ascolto.json'));
  if(/^ripasso:(salva|registra|pota)$/.test(canale))write(area('RIPASSO'));
  if(['fonti:importa','media:importa'].includes(canale))write(area('MATERIALI'),area('_gruppi.json'));
  if(['fonti:elimina','fonti:rinomina','media:elimina'].includes(canale))write(area('MATERIALI'),area('APPUNTI'),area('MAPPE'),area('ALBUM'),area('_lettura.json'),area('_ascolto.json'),area('_gruppi.json'));
  if(canale==='fonti:dimentica')write(area('MATERIALI'));
  if(canale==='fonti:indiceScrivi')write(area('MATERIALI/Indici-PDF'));
  if(canale==='ocrpdf:applica')write(area('MATERIALI'));
  if(['voce:rendi','voce:scarta','stampa:pdf','ocrpdf:apri','ocrpdf:pagina','ocrpdf:chiudi','ocrpdf:applica'].includes(canale)){read(temporanei);write(temporanei);}
  if(canale==='file:reveal')read(vault&&path.join(vault,'Zaini'));
  if(canale==='profilo:atlante'||canale==='profile:get')read(vault&&path.join(vault,'_profilo.md'));
  if(famiglia==='costs' && vault){read(path.join(vault,'Costi'));if(azione==='log')write(path.join(vault,'Costi'));}
  if(famiglia==='chat') {
    if(vault)read(path.join(vault,'.studia'));
    if(['saveProfile','cloneProfile','deleteProfile','activateProfile'].includes(azione)&&vault)write(path.join(vault,'.studia'));
    if(['create','remove','rename','branch','scope','send'].includes(azione))write(area('CHAT'));
    if(azione==='saveAnswer')write(area('APPUNTI'));
  }
  // Inventario e cache sono derivati: l'AI legge le fonti, scrive solo risultati/registri.
  if(z && ['rag','chat','studio'].includes(famiglia)) {
    write(area('_fonti-ai.json'));
    if(famiglia==='rag'||(famiglia==='chat'&&azione==='send')||(famiglia==='studio'&&['estimate','analyze','start'].includes(azione)))write(area('_lavorazione/rag'));
    if(famiglia==='studio'&&azione==='copyCard')write(area('APPUNTI'));
    if(famiglia==='studio'&&['fromCard','start','answer','keep','outcome','resume'].includes(azione))write(area('RIPASSO'));
    if((famiglia==='chat'&&azione==='send')||(famiglia==='studio'&&['analyze','start','answer'].includes(azione)))write(vault&&path.join(vault,'Costi'));
  }
  if(['rag','chat','studio'].includes(famiglia))read(path.join(userData,'rag-model'));
  if(famiglia==='studio'&&vault)read(path.join(vault,'.studia'));
  if(canale==='rag:install')write(path.join(userData,'rag-model'));
  return p;
}
function registra({ipcMain,contesto,finestra,appFile,concessioni}) {
  const handle=ipcMain.handle.bind(ipcMain),on=ipcMain.on.bind(ipcMain);
  const esegui=(e,canale,o,fn)=>{
    const w=finestra();
    if(!w || w.isDestroyed() || e.sender!==w.webContents || e.senderFrame!==w.webContents.mainFrame || e.senderFrame.url.split('#')[0]!==appFile)throw Error('Richiesta non autorizzata da questa finestra.');
    const ctx=contesto(),p=privilegi(canale,o,ctx);
    if(['fonti:importa','media:importa'].includes(canale)) {
      if(!Array.isArray(o?.percorsi)||o.percorsi.length>1000)throw Error('Selezione di file non valida.');
      for(const f of o.percorsi){if(!concessioni.ha(e.sender.id,f))throw Error('Importa soltanto file selezionati o trascinati nell’app.');p.lettura.push(f);}
    }
    if(canale==='vault:sync'&&o?.gruppo==='album'&&o.metodo==='heic'){
      const f=o.args?.[0];if(!concessioni.ha(e.sender.id,f))throw Error('Seleziona prima la foto da importare.');p.lettura.push(f);
    }
    // Le aree interne non diventano autorizzazioni se sono state sostituite con link.
    for(const roots of [p.lettura,p.scrittura,p.metadati])for(const r of roots){
      if(ctx.vault&&(r===ctx.vault||r.startsWith(ctx.vault+path.sep)))disco.percorso(ctx.vault,r);
      if(r===ctx.userData||r.startsWith(ctx.userData+path.sep))disco.percorso(ctx.userData,r);
    }
    return disco.esegui(p,fn);
  };
  ipcMain.handle=(c,fn)=>handle(c,async(e,o,...rest)=>{try{return await esegui(e,c,o,()=>fn(e,o,...rest));}catch(error){return {ok:false,error:error.message};}});
  ipcMain.on=(c,fn)=>on(c,(e,o,...rest)=>{try{return esegui(e,c,o,()=>fn(e,o,...rest));}catch(error){e.returnValue={ok:false,error:error.message};}});
}
function percorsoUrl(url) { try { const u=new URL(url);if(u.protocol!=='file:')return '';u.hash='';u.search='';return fileURLToPath(u); }catch(_){return '';} }
module.exports={urlEsterna,privilegi,registra,percorsoUrl};
