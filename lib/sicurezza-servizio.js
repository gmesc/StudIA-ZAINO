'use strict';
const path=require('node:path');
const D=require('./permessi-disco');
const {fs}=D;
const {pathToFileURL}=require('node:url');
const GIORNI_FIRME=7;
const MAX_COPIE=2*1024*1024*1024;
function crea({userData,risorse,tempRoot,readCfg,writeCfg,invia=()=>{},limiteCopie=MAX_COPIE}) {
  if(!Number.isSafeInteger(limiteCopie)||limiteCopie<0||limiteCopie>MAX_COPIE)throw Error('Limite delle copie PDF non valido.');
  tempRoot=fs.realpathSync(tempRoot);
  const radice=path.join(userData,'sicurezza');
  let inCorso=false,progress=null,ultimo=null,coda=Promise.resolve(),byteCopie=0;
  const snapshot=new Set(),perHash=new Map();
  function ambito(fn,scrive=false) {
    const p=D.corrente()||{lettura:[],scrittura:[],metadati:[]};
    D.percorso(userData,radice);
    return D.esegui({lettura:[...p.lettura,radice,risorse,tempRoot],scrittura:[...p.scrittura,tempRoot,...(scrive?[radice]:[])],metadati:p.metadati},fn);
  }
  function notifica(p){progress=p;invia({progress:p});}
  const installer=require('./sicurezza-installazione').crea({radice,risorse,onProgress:notifica});
  function preferenze(){const p=readCfg().sicurezza||{};return {qpdf:p.qpdf===true,clamav:p.clamav===true};}
  const motore=require('./sicurezza-pdf').crea({tempRoot,preferenze,onProgress:notifica,strumenti:()=>{
    const p=preferenze(),out={};for(const id of ['qpdf','clamav'])if(p[id])out[id]=installer.percorsi(id);return out;
  }});
  function stato() {
    return ambito(()=>{
      const s=installer.stato(),p=preferenze();
      const data=Date.parse(s.firme.aggiornatoAl);
      const scadute=!Number.isFinite(data)||data>Date.now()+86400000||Date.now()-data>GIORNI_FIRME*86400000;
      const firme={...s.firme,scadute};
      return {ok:true,...s,firme,inCorso,progress,ultimo,motori:s.motori.map(m=>{
        const pronto=m.installato&&(m.id!=='clamav'||firme.pronte&&!scadute);
        const motivo=m.errore||(!m.installato?'Installa il componente per attivarlo.':m.id==='clamav'&&!firme.pronte?'Scarica e verifica le firme antivirus.':m.id==='clamav'&&scadute?'La verifica delle firme è scaduta o ha una data non valida: aggiornale per riprendere i controlli.':'');
        return {...m,attivo:p[m.id],operativo:p[m.id]&&pronto,pronto,motivo};
      })};
    });
  }
  function seriale(fn) {
    const lavoro=coda.then(()=>ambito(async()=>{inCorso=true;try{return await fn();}finally{inCorso=false;invia({stato:stato()});}}));
    coda=lavoro.catch(()=>{});return lavoro;
  }
  async function operazione(id,azione) {
    if(inCorso)throw Error('Attendi il completamento del controllo o dell’installazione in corso.');
    if(!['qpdf','clamav'].includes(id))throw Error('Motore di sicurezza non valido.');
    await seriale(()=>ambito(async()=>{
      try {
        if(azione==='installa')await installer.installa(id);
        if(id==='clamav')await installer.aggiornaFirme();
        motore.svuotaCache();notifica({fase:'pronto',id,messaggio:'Componente pronto. Puoi attivare il controllo.'});
      }catch(e){notifica({fase:'errore',id,messaggio:e.message});throw e;}
    },true));
    return stato();
  }
  function attiva(id,valore) {
    if(!['qpdf','clamav'].includes(id)||typeof valore!=='boolean')throw Error('Preferenza di sicurezza non valida.');
    if(inCorso)throw Error('Attendi il completamento dell’operazione in corso.');
    const m=stato().motori.find(m=>m.id===id);
    if(valore&&!m.pronto)throw Error(m.motivo||'Completa prima l’installazione.');
    const cfg=readCfg();cfg.sicurezza={...preferenze(),[id]:valore};writeCfg(cfg);
    motore.svuotaCache();
    notifica({fase:'preferenza',messaggio:(id==='qpdf'?'Controllo struttura PDF':'Antivirus ClamAV')+(valore?' attivato.':' disattivato.')});
    const s=stato();invia({stato:s});return s;
  }
  function ricorda(r) {
    ultimo={quando:new Date().toISOString(),totale:r.esiti.length,bloccati:r.esiti.filter(e=>!e.ok).length,
      avvisi:r.esiti.filter(e=>e.avvisi?.length).length,
      dettagli:r.esiti.filter(e=>!e.ok||e.avvisi?.length).slice(0,30).map(e=>({file:path.basename(e.percorso),ok:e.ok,error:e.error||'',avvisi:e.avvisi||[]}))};
    notifica({fase:'completato',messaggio:ultimo.bloccati?`${ultimo.bloccati} PDF bloccati. Apri Impostazioni → Sicurezza per i dettagli.`:`Controllo completato: ${ultimo.totale} PDF, ${ultimo.avvisi} con avvisi.`,bloccati:ultimo.bloccati});
  }
  async function controlla(percorsi) {
    return seriale(async()=>{
      const r=await motore.controlla(percorsi);
      // Non sovrascrivere il riepilogo del lotto per ogni richiesta range già approvata.
      if(Object.values(preferenze()).some(Boolean)&&r.esiti.some(e=>!e.cache))ricorda(r);
      return r;
    });
  }
  function richiediSync(file){return ambito(()=>motore.richiediSync(file));}
  async function urlVerificata(file) {
    const r=await controlla([file]),esito=r.esiti[0];
    if(!esito?.ok)throw Error(esito?.error||'PDF non verificato.');
    if(!esito.hash || snapshot.has(file))return null;
    return ambito(()=>{
      // Chromium riceve gli stessi byte approvati, anche se l’originale viene
      // sostituito dopo il controllo. Le copie private spariscono alla chiusura.
      let copia=perHash.get(esito.hash);
      if(!copia){
        const dimensione=fs.statSync(file).size;
        if(byteCopie+dimensione>limiteCopie){
          const messaggio='Raggiunto il limite di 2 GB delle copie PDF temporanee. Chiudi e riapri ZAINO per liberarle.';
          notifica({fase:'errore',messaggio});throw Error(messaggio);
        }
        const dir=path.join(tempRoot,'pdf-approvati');fs.mkdirSync(dir,{recursive:true,mode:0o700});
        copia=path.join(dir,esito.hash+'.pdf');
        require('./formati-sicuri').copiaVerificata(file,copia,{estensioni:['.pdf'],hashAtteso:esito.hash});
        snapshot.add(copia);perHash.set(esito.hash,copia);byteCopie+=dimensione;
      }
      return pathToFileURL(copia).href;
    });
  }
  async function aggiornaAutomaticamente() {
    if(!preferenze().clamav||inCorso)return;
    const s=stato();
    if(s.firme.pronte&&!s.firme.scadute&&Date.now()-Date.parse(s.firme.aggiornatoAl)<86400000)return;
    try{await operazione('clamav','firme');}catch(_){/* Lo stato visibile conserva la causa; nessuna falsa attivazione. */}
  }
  return {stato,attiva,controlla,richiediSync,urlVerificata,installa:id=>operazione(id,'installa'),aggiornaFirme:()=>operazione('clamav','firme'),aggiornaAutomaticamente};
}
module.exports={crea};
