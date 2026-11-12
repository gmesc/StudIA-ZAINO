/* Una raccolta per TUNING e i selettori degli editor. I documenti ricevono copie. */
(function(root,factory){
 const node=typeof module==='object'&&module.exports;
 const R=factory(node?require('./stili'):root.ZainoStili,node?require('../mappa/aspetto'):root.MappaAspetto,node?require('../presentazioni/modello'):root.PresentaModello,node?require('../squig/tratti'):root.ZainoSquigTratti);
 if(node)module.exports=R;
 else{
  function leggiSalvato(){const api=root.vault?.stili;if(!api?.raccoltaLeggi)return localStorage.getItem(R.CHIAVE);const r=api.raccoltaLeggi();if(r.error)throw Error(r.error);return r.testo;}
  function scrivi(s){const raw=JSON.stringify(s),api=root.vault?.stili;if(api?.raccoltaSalva){const r=api.raccoltaSalva(raw);if(!r.ok)throw Error(r.error||'Raccolta non salvata.');}else localStorage.setItem(R.CHIAVE,raw);}
  root.ZainoRaccolta={
   leggi(){const raw=leggiSalvato();if(raw!==null)return R.leggi(raw);
    const precedente=localStorage.getItem(R.CHIAVE),stato=precedente===null?R.iniziale(k=>localStorage.getItem(k)):R.leggi(precedente);scrivi(stato);return stato;},
   cambia(op){const nuovo=R.cambia(this.leggi(),op);scrivi(nuovo);root.dispatchEvent(new Event('zaino-stili-cambiati'));return nuovo;},
   preinstallato:R.preinstallato,
   nuovo:tipo=>R.nuovo(tipo,root.ZainoRaccolta.elenco(null,true)),
   elenco(tipo,nascosti=false){return this.leggi().stili.filter(r=>(!tipo||r.pacchetto.tipo===tipo)&&(nascosti||!r.nascosto));}
  };
 }
})(globalThis,function(S,A,M,Q){
 'use strict';
 const CHIAVE='zaino.tuning.v1',tipi=['mappa','slide','navbar'];
 function pacchetto(tipo,nome,stile){return {formato:'zaino-stile',versione:1,tipo,nome,stile};}
 function riga(id,p){return {id,pacchetto:p,nascosto:false};}
 function parse(s){try{return JSON.parse(s);}catch(_){throw Error('La raccolta degli stili non è leggibile. I dati salvati sono conservati.');}}
 const basePreinstallati=new Set([...Object.keys(A.PRESET).map(id=>'mappa-'+id),...Object.keys(M.STILI).map(id=>'slide-'+id),...Object.keys(M.NAVBAR).map(id=>'navbar-'+id)]);
 const preinstallati=new Set(basePreinstallati);
 function preinstallato(r){return preinstallati.has(r?.id);}
 function stileSquig(tipo,id,precedente=false){
  const p=Q.temi[id],nome=precedente?'Squig · '+Q.nomi[id]:'Squig';
  // Il confronto della migrazione usa il contratto pubblicato con le prime sei palette.
  const baseMappa=precedente?{tratto:'regolare',font:'zaino',fusione:'normal',sfondo:'punti',carta:'',segno:'#d4d7dc',passo:24,nodo:'',testo:'',bordo:'',legame:'',raggio:0,spessore:1,fsNodo:12,fsRel:10,linee:'curva'}:S.mappa(A.PRESET.originale);
  const stili={slide:{font:'patrick-hand',sfondo:p.bg,colore:p.ink,accento:p.ink,titolo:54,testo:32},mappa:{...baseMappa,font:'patrick-hand',tratto:'squig',carta:p.bg,nodo:p.paper,testo:p.ink,bordo:precedente?p.ink:'#9ca3af',legame:p.ink,segno:p.grid,raggio:3,spessore:1.4,fsNodo:16,fsRel:13,...(!precedente?{bordiColorati:1}:{})},navbar:{variant:'tabs',orientation:'horizontal',activeZoom:1,fontFamily:'patrick-hand',fontSize:22,color:p.ink,grafica:{tratto:'squig',gap:12,border:{color:p.ink,width:1.4,opacity:1},background:{color:p.paper,opacity:1},activeBackground:{color:p.shadeStrong,opacity:1},activeTextColor:p.ink,activeGraphicColor:p.ink}}};
  return riga(tipo+'-squig-'+id,{...pacchetto(tipo,nome,stili[tipo]),autore:'Pablo Stanley · adattamento ZAINO',licenza:'MIT'});
 }
 function squig(){return tipi.map(tipo=>stileSquig(tipo,tipo==='mappa'?'graphite':'internet-blue'));}
 function drawably(){
  const comune={font:'patrick-hand',sfondo:'#fffdf8',colore:'#303030',accento:'#2d5ce3',titolo:54,testo:32};
  return [riga('mappa-drawably',{...pacchetto('mappa','Drawably',{...S.mappa(A.PRESET.originale),tratto:'drawably',font:'patrick-hand',carta:'#fffdf8',nodo:'#fffdf8',testo:'#303030',bordo:'#9ca3af',bordiColorati:1,legame:'#6b7280',raggio:12,spessore:2,fsNodo:16,fsRel:13}),autore:'Daniel Belyi · adattamento ZAINO',licenza:'MIT'}),riga('slide-drawably',{...pacchetto('slide','Drawably',comune),autore:'Daniel Belyi · adattamento ZAINO',licenza:'MIT'})];
 }
 for(const r of [...squig(),...drawably()])preinstallati.add(r.id);
 function predefiniti(){
  const stili=[];
  for(const [id,p]of Object.entries(A.PRESET))stili.push(riga('mappa-'+id,pacchetto('mappa',p.nome,S.mappa(p))));
  for(const [id,t]of Object.entries(M.STILI)){const {nome,...s}=t;stili.push(riga('slide-'+id,pacchetto('slide',nome,{...s,titolo:54,testo:32})));}
  for(const [id,nome]of Object.entries(M.NAVBAR))stili.push(riga('navbar-'+id,pacchetto('navbar',nome,S.navbar({...M.modelloComune('navbar'),variant:id}))));
  return stili.concat(squig(),drawably());
 }
 function uguale(a,b){
  const ordina=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(ordina):Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,ordina(v)])):v;
  return JSON.stringify(ordina(a))===JSON.stringify(ordina(b));
 }
 function aggiornaPreset(s){
  if(s.squigUnico!==1){
   const precedenti=new Map(Object.keys(Q.temi).flatMap(id=>tipi.map(tipo=>{const r=stileSquig(tipo,id,true);return [r.id,r];}))),unici=squig(),attuali=new Map(unici.map(r=>[r.id,r]));
   const vecchi=s.stili.filter(r=>precedenti.has(r.id)),ids=new Set(s.stili.map(r=>r.id)),personali=[];
   for(const r of vecchi)if(!uguale(r.pacchetto,precedenti.get(r.id).pacchetto)&&!uguale(r.pacchetto,attuali.get(r.id)?.pacchetto)){
    let id='personale-'+r.id,n=2;while(ids.has(id))id='personale-'+r.id+'-'+n++;ids.add(id);
    // Una correzione fatta dall’utente sopravvive come stile personale, anche sul preset conservato.
    personali.push({...r,id});
   }
   s.stili=s.stili.filter(r=>!precedenti.has(r.id));
   for(const r of unici)s.stili.push({...r,nascosto:vecchi.find(v=>v.id===r.id)?.nascosto||false});
   s.stili.push(...personali);s.squigUnico=1;s.squigPreinstallato=1;
  }
  if(s.drawablyPreinstallato!==1){for(const r of drawably())if(!s.stili.some(v=>v.id===r.id))s.stili.push(r);s.drawablyPreinstallato=1;}
  // Nei dati precedenti bordo era decorativo: ora è il neutro, non il colore di parentela.
  for(const r of s.stili)if(r.pacchetto.tipo==='mappa'&&r.pacchetto.stile.bordiColorati!==1)r.pacchetto.stile={...r.pacchetto.stile,bordo:'#9ca3af',bordiColorati:1};
 }
 function nuovo(tipo,righe=[]){
  const nomeBase={mappa:'Mappa personale',slide:'Slide personale',navbar:'Navbar personale'}[tipo];if(!nomeBase)throw Error('Tipo di stile non valido.');
  const nomi=new Set(righe.map(r=>r.pacchetto.nome.toLocaleLowerCase('it')));let nome=nomeBase,n=2;while(nomi.has(nome.toLocaleLowerCase('it')))nome=nomeBase+' '+n++;
  const base=predefiniti().find(r=>r.pacchetto.tipo===tipo).pacchetto;
  return {...M.copia(base),nome};
 }
 function iniziale(get){
  const stili=predefiniti();
  for(const tipo of tipi){const vecchi=parse(get('zaino.stili.community.v1.'+tipo)||'[]');if(!Array.isArray(vecchi))throw Error('Raccolta precedente non valida: '+tipo);
   vecchi.forEach((p,i)=>stili.push(riga('importato-'+tipo+'-'+i,p)));
  }
  const slot=parse(get('studia.presenta.stili')||'[]');if(!Array.isArray(slot))throw Error('Stili personali precedenti non validi.');
  slot.forEach((v,i)=>{if(v){const t=M.temaPersonale(v);if(!t)throw Error('Stile personale non valido: '+(i+1));const {nome,...s}=t;stili.push(riga('slot-'+i,pacchetto('slide',nome,s)));}});
  return leggi(JSON.stringify({versione:1,presetProtetti:true,squigUnico:1,squigPreinstallato:1,drawablyPreinstallato:1,stili}));
 }
 function leggi(raw){
  const s=parse(raw),ids=new Set();
  if(s?.versione!==1||!Array.isArray(s.stili))throw Error('Formato della raccolta degli stili non supportato.');
  for(const r of s.stili){
   const p=r?.pacchetto;
   if(typeof r?.id!=='string'||!r.id||ids.has(r.id)||typeof r.nascosto!=='boolean'||p?.formato!=='zaino-stile'||p.versione!==1||!tipi.includes(p.tipo)||typeof p.nome!=='string'||!p.nome.trim()||p.nome.length>40||!p.stile||typeof p.stile!=='object'||Array.isArray(p.stile))throw Error('Raccolta degli stili non valida. I dati salvati sono conservati.');
   ids.add(r.id);
  }
  if(!s.presetProtetti){for(const p of predefiniti().filter(p=>basePreinstallati.has(p.id)))if(!ids.has(p.id))s.stili.push({...p,nascosto:true});s.presetProtetti=true;}
  aggiornaPreset(s);
  return s;
 }
 function cambia(stato,o){
  const s=leggi(JSON.stringify(stato)),i=s.stili.findIndex(r=>r.id===o.id);
  if(o.tipo==='salva'){
   if(i>=0){if(s.stili[i].pacchetto.tipo!==o.pacchetto.tipo)throw Error('Il tipo di uno stile non si cambia.');s.stili[i].pacchetto=M.copia(o.pacchetto);}
   else s.stili.push(riga(o.id,M.copia(o.pacchetto)));
  }else{
   if(i<0)throw Error('Stile non più disponibile.');
   if(o.tipo==='elimina'){if(preinstallato(s.stili[i]))throw Error('Gli stili preinstallati si possono solo nascondere.');s.stili.splice(i,1);}
   else if(o.tipo==='visibilita'&&typeof o.nascosto==='boolean')s.stili[i].nascosto=o.nascosto;
   else throw Error('Operazione sugli stili non valida.');
  }return leggi(JSON.stringify(s));
 }
 return {CHIAVE,nuovo,iniziale,leggi,cambia,pacchetto,preinstallato};
});
