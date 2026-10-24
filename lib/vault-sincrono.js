'use strict';
// Il preload non apre file: il main ammette soltanto queste operazioni nominate.
// Il sincrono conserva anche l'ultimo salvataggio durante beforeunload.
const fs = require('./permessi-disco').fs;
const path = require('path');
const { pathToFileURL } = require('url');
const mat = require('./materiali');
const corsi = require('./corsi');
const appunti = require('./appunti');
const evidenze = require('./evidenze');
const album = require('./album');
const mappe = require('./mappe');
const heic = require('./heic');
const voce = require('./voce');
const { zainoValido } = require('./zaino-only');
const formati = require('./formati-sicuri');
const { percorso } = require('./permessi-disco');

function foglia(nome) { return typeof nome === 'string' && nome && nome !== '.' && nome !== '..' && !/[\\/\x00-\x1f]/.test(nome); }
function urlMateriale(v, file, id, opzioni) {
  if (!foglia(file)) return '';
  for (const sub of ['Fonti', 'Media', 'Figure']) {
    const p = mat.trova(v, sub, file, id, true);
    if (p) return urlVerificata(v, p, opzioni);
  }
  return '';
}
function urlVerificata(v, p, opzioni) {
  const dentro = percorso(v, p);
  if (!formati.verificaFile(dentro, { estensioni: formati.PDF.concat(formati.MEDIA,formati.IMMAGINI) }).ok) return '';
  return opzioni.urlPerFile ? opzioni.urlPerFile(dentro) : pathToFileURL(dentro).href;
}
function numeri(v) {
  const out = {};
  if (!v) return out;
  let dirs; try { dirs = fs.readdirSync(path.join(v, 'Zaini'), {withFileTypes:true}); } catch (_) { return out; }
  const lista = (dirs, exts) => {
    const found = {};
    for (const dir of dirs) {
      let names; try { names = fs.readdirSync(dir); } catch (_) { continue; }
      for (const f of names.sort()) {
        const n = /^(\d+)\b/.exec(f);
        if (n && exts.includes(path.extname(f).toLowerCase()) && !found[n[1].padStart(2,'0')]) found[n[1].padStart(2,'0')] = f;
      }
    }
    return found;
  };
  for (const d of dirs) {
    if (!d.isDirectory() || !zainoValido(v,d.name)) continue;
    out[d.name] = {
      media:lista(mat.cartelle(v,'Media',d.name,true).concat(mat.cartelle(v,'Fonti',d.name,true)),mat.EXT_MEDIA),
      pdf:lista(mat.cartelle(v,'Fonti',d.name,true),['.pdf'])
    };
  }
  return out;
}
function prefsPath(v) { return percorso(v,path.join(v,'.studia','prefs.json')); }
function prefsRead(v) {
  if (!v) return {};
  try { return JSON.parse(fs.readFileSync(prefsPath(v),'utf8')); }
  catch(e) { if (e.code === 'ENOENT') return {}; throw e; }
}
function prefsSave(v,o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('Preferenze non valide.');
  const text = JSON.stringify(o,null,2);
  if (text.length > 1024*1024) throw new Error('Preferenze troppo grandi.');
  const p = prefsPath(v); fs.mkdirSync(path.dirname(p),{recursive:true}); appunti.writeAtomic(p,text); return {ok:true};
}
const metodi = {
  iniziale: {
    leggi: v => ({numeriPerCorso:numeri(v),heicDisponibile:heic.disponibile(),senzaHeic:heic.SENZA_SIPS,voceDisponibile:voce.disponibile()})
  },
  materiali: { srcUrl:(v,a,o)=>urlMateriale(v,a[0],a[1],o) },
  notes: {
    leggi:(v,a)=>appunti.read(v,a[0]), list:(v,a)=>appunti.read(v,a[0]).notes,
    save:(v,a)=>appunti.save(v,a[0],a[1],a[2]||{},a[3]||'',null,a[4]||{}),
    rename:(v,a)=>appunti.rinomina(v,...a), reindex:(v,a)=>appunti.reindex(v,...a),
    versioni:(v,a)=>appunti.versioni(v,...a), cartellaVersioni:(v,a)=>appunti.dirVersioni(v,a[0]),
    indexPath:(v,a)=>path.join(appunti.dir(v,a[0]),'_indice.md')
  },
  evidenze: {
    leggi:(v,a)=>evidenze.leggi(v,...a), salva:(v,a)=>evidenze.salva(v,...a), aggiungi:(v,a)=>evidenze.aggiungi(v,...a),
    rimuovi:(v,a)=>evidenze.rimuovi(v,...a), colora:(v,a)=>evidenze.colora(v,...a), postilla:(v,a)=>evidenze.postilla(v,...a),
    tratta:(v,a)=>evidenze.tratta(v,...a), creaStrato:(v,a)=>evidenze.creaStrato(v,...a),
    rinominaStrato:(v,a)=>evidenze.rinominaStrato(v,...a), rimuoviStrato:(v,a)=>evidenze.rimuoviStrato(v,...a),
    identita:(_v,a)=>{const n=evidenze.normalizzaVoce(a[0]);return {id:n?n.id:'',error:n?'':'evidenza senza testo'};}
  },
  album: {
    elenco:(v,a)=>album.elenco(v,...a), salva:(v,a)=>album.salva(v,...a), rinomina:(v,a)=>album.rinomina(v,...a), usi:(v,a)=>album.usi(v,...a),
    srcUrl:(v,a,o)=>{const p=(a[2]==='mini' && album.percorsoMini(v,a[0],a[1])) || album.percorsoImmagine(v,a[0],a[1]);return p?urlVerificata(v,p,o):'';},
    heic:(_v,a,o)=>{if(typeof a[0]!=='string' || !o.autorizzaLettura || o.autorizzaLettura(a[0])!==true) throw new Error('Scegli o trascina prima questa immagine.');return heic.converti(a[0],{tempRoot:o.tempRoot});},
    heicDisponibile:()=>heic.disponibile()
  },
  mappe: {nodi:(v,a)=>{const r=mappe.read(v,a[0]);return {mappe:(r.mappe||[]).map(m=>({file:m.file||'',titolo:m.titolo||'',errore:m.errore||'',nodi:(m.nodi||[]).map(n=>({id:n.id,testo:n.testo,nota:n.nota}))})),error:r.error||''};}},
  prefs: {read:v=>prefsRead(v),save:(v,a)=>prefsSave(v,a[0])}
};
const LETTURE = new Set(['iniziale.leggi','materiali.srcUrl','notes.leggi','notes.list','notes.versioni','notes.cartellaVersioni','notes.indexPath','evidenze.leggi','evidenze.identita','album.elenco','album.usi','album.srcUrl','album.heicDisponibile','album.heic','mappe.nodi','prefs.read']);
const whitelist = Object.freeze(Object.fromEntries(Object.entries(metodi).map(([g,m])=>[g,Object.freeze(Object.keys(m))])));
function consentito(g,m) {return typeof g==='string' && typeof m==='string' && Object.hasOwn(metodi,g) && Object.hasOwn(metodi[g],m);}
function scrive(g,m) {return consentito(g,m) && !LETTURE.has(g+'.'+m);}
function errore(g,m,e) {
  const error=e.message||String(e);
  if(m==='srcUrl' || (g==='notes' && ['cartellaVersioni','indexPath'].includes(m))) return '';
  if(g==='notes' && ['list','versioni'].includes(m)) return [];
  if(g==='notes' && m==='reindex') return 0;
  if(g==='album' && m==='heicDisponibile') return false;
  const base={ok:false,error};
  if(g==='notes') return {...base,notes:[]};
  if(g==='evidenze') return {...base,id:'',evidenza:null,evidenze:[],strato:null,strati:[],tolte:0,spostate:0,rinati:[]};
  if(g==='album') return {...base,dati:'',voce:null,voci:[],giaCera:false,appunti:[],mappe:[],illeggibili:[],quanti:0};
  if(g==='mappe') return {...base,mappe:[]};
  return base;
}
function esegui(vault,gruppo,metodo,args=[],opzioni={}) {
  try {
    if(!consentito(gruppo,metodo)) throw new Error('Operazione locale non consentita.');
    if(!Array.isArray(args) || args.length>8) throw new Error('Argomenti locali non validi.');
    const senzaVault=gruppo==='iniziale' || (gruppo==='album' && ['heic','heicDisponibile'].includes(metodo)) || (gruppo==='evidenze' && metodo==='identita');
    if(!senzaVault && !vault) throw new Error('nessuna cartella vault impostata');
    if(['notes','evidenze','album','mappe','materiali'].includes(gruppo) && !senzaVault) {
      const id=args[gruppo==='materiali'?1:0];
      if(!zainoValido(vault,id)) throw new Error('Apri uno zaino valido.');
      percorso(vault,corsi.cartella(vault,id));
    }
    return metodi[gruppo][metodo](vault,args,opzioni);
  } catch(e) {return errore(gruppo,metodo,e);}
}
module.exports={esegui,consentito,scrive,whitelist};
