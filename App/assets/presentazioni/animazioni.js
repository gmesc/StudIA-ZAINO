/* Catalogo e tempi condivisi da editor, player ed export. Nessun accesso al DOM. */
(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f();else r.PresentaAnimazioni=f();})(typeof globalThis==='undefined'?this:globalThis,function(){
 'use strict';
 const tutti=['title','text','list','table','shape','image','math','audio','video'],testi=['title','text','list'];
 const catalogo=Object.freeze([
  ['fade-in','Comparsa','Entrata','L’oggetto diventa visibile gradualmente.',tutti,.6],
  ['fade-up','Dal basso','Entrata','L’oggetto sale e diventa visibile.',tutti,.7],
  ['slide-left','Da sinistra','Entrata','L’oggetto entra da sinistra.',tutti,.7],
  ['zoom-in','Zoom leggero','Entrata','L’oggetto compare ingrandendosi fino alla sua misura.',tutti,.7],
  ['fade-down','Dall’alto','Entrata','L’oggetto scende e diventa visibile.',tutti,.7],
  ['slide-right','Da destra','Entrata','L’oggetto entra da destra.',tutti,.7],
  ['bounce-in','Rimbalzo','Entrata','Compare con un piccolo rimbalzo e si ferma.',tutti,.9],
  ['rotate-in','Ruota ed entra','Entrata','Compare ruotando leggermente fino alla posizione corretta.',tutti,.8],
  ['wipe-in','Tendina','Entrata','Rivela l’oggetto da sinistra verso destra.',tutti,.8],
  ['unfold-in','Apri','Entrata','Si apre verticalmente dalla linea centrale.',tutti,.7],
  ['fade-out','Scomparsa','Uscita','L’oggetto scompare gradualmente.',tutti,.6],
  ['slide-out-left','Esci a sinistra','Uscita','Si sposta verso sinistra e scompare.',tutti,.7],
  ['slide-out-right','Esci a destra','Uscita','Si sposta verso destra e scompare.',tutti,.7],
  ['slide-out-up','Esci in alto','Uscita','Sale e scompare.',tutti,.7],
  ['slide-out-down','Esci in basso','Uscita','Scende e scompare.',tutti,.7],
  ['zoom-out','Riduci e scompari','Uscita','Si rimpicciolisce fino a scomparire.',tutti,.7],
  ['grow','Ingrandisci','Evidenza','L’oggetto resta più grande dopo l’effetto.',tutti,.6],
  ['shrink','Riduci','Evidenza','L’oggetto resta più piccolo dopo l’effetto.',tutti,.6],
  ['highlight-red','Evidenzia','Evidenza','Evidenzia in rosso il testo o la forma; contorna immagini e media.',tutti,.6],
  ['pulse','Pulsazione','Evidenza','Un solo ingrandimento, poi torna alla misura iniziale.',tutti,.8],
  ['shake','Scuoti','Evidenza','Un breve movimento laterale, poi torna al suo posto.',tutti,.7],
  ['wobble','Oscilla','Evidenza','Oscilla a destra e a sinistra, poi si ferma.',tutti,1],
  ['spin','Giro completo','Evidenza','Ruota di un giro e torna nella posizione iniziale.',tutti,1.2],
  ['letters','Una lettera alla volta','Sequenza','Le lettere compaiono in ordine, mantenendo accenti ed emoji.',testi,2],
  ['words','Una parola alla volta','Sequenza','Le parole compaiono in ordine durante un unico clic.',testi,1.8],
  ['lines','Una riga alla volta','Sequenza','Le righe del testo compaiono in ordine.',testi,1.8],
  ['list-items','Punti in sequenza','Sequenza','I punti dell’elenco compaiono uno dopo l’altro.',['list'],1.8],
  ['table-rows','Righe in sequenza','Sequenza','Le righe della tabella compaiono una dopo l’altra.',['table'],1.8],
  ['table-columns','Colonne in sequenza','Sequenza','Le colonne della tabella compaiono una dopo l’altra.',['table'],1.8],
  ['draw','Disegna la forma','Disegno','Traccia il contorno della forma, poi mostra il riempimento.',['shape'],1.5],
  ['underline','Sottolinea','Disegno','Disegna una linea sotto il testo.',testi,1],
  ['path-line','Percorso rettilineo','Percorso','Va a destra e torna al punto di partenza.',tutti,2],
  ['path-arc','Percorso ad arco','Percorso','Segue un arco e torna al punto di partenza.',tutti,2],
  ['path-orbit','Orbita','Percorso','Compie un giro completo e torna al punto di partenza.',tutti,3],
  ['path-wave','Onda','Percorso','Segue un’onda e torna al punto di partenza.',tutti,2.5],
  ['path-zigzag','Zig-zag','Percorso','Segue un percorso a zig-zag e torna al punto di partenza.',tutti,2.5]
 ].map(([id,nome,gruppo,descrizione,tipi,durata])=>Object.freeze({id,nome,gruppo,descrizione,tipi,durata,entrata:gruppo==='Entrata'||gruppo==='Sequenza'||id==='draw',uscita:gruppo==='Uscita'})));
 const effetti=Object.freeze(Object.fromEntries(catalogo.map(e=>[e.id,e])));
 const disponibile=(id,tipo,supportati)=>!!effetti[id]?.tipi.includes(tipo)&&(supportati===undefined||Array.isArray(supportati)&&supportati.includes(id));
 const durata=a=>a.duration??effetti[a.effect]?.durata??.6;
 function normalizza(azioni){
  let passo=0,prima=null;
  return azioni.map(a=>{const start=prima?(a.start||(a.step===prima.step?'with':'click')):'click';if(start==='click')passo++;prima=a;return {...a,start,step:passo};});
 }
 function tempi(azioni){
  let prima=null;
  return normalizza(azioni).map(a=>{const inizio=(a.start==='after'?(prima?.fine||0):a.start==='with'?(prima?.inizio||0):0)+(a.delay||0);const r={...a,inizio,fine:inizio+durata(a)};prima=r;return r;});
 }
 // I vecchi documenti possono elencare bersagli in un ordine diverso dai clic.
 function sequenza(azioni){return azioni.map((a,i)=>({...a,indice:i})).sort((a,b)=>a.step-b.step||a.indice-b.indice);}
 function errore(a,tipo){
  if(!disponibile(a.effect,tipo))return 'Effetto non compatibile con questo oggetto.';
  if(a.start!==undefined&&!['click','with','after'].includes(a.start))return 'Avvio non valido.';
  for(const [k,min,max]of [['duration',.1,20],['delay',0,20],['distance',10,300]])if(a[k]!==undefined&&(!Number.isFinite(a[k])||a[k]<min||a[k]>max))return 'Tempo o distanza fuori limite.';
  return null;
 }
 function percorso(id,d=80){if(id==='path-wave')return `M0 0 Q${d/4} ${-d/2} ${d/2} 0 T${d} 0 Q${3*d/4} ${d/2} ${d/2} 0 T0 0`;if(id==='path-zigzag')return `M0 0 L${d/4} ${-d/3} L${d/2} ${d/3} L${3*d/4} ${-d/3} L${d} 0 L${3*d/4} ${-d/3} L${d/2} ${d/3} L${d/4} ${-d/3} L0 0`;return id==='path-orbit'?`M0 0 a${d} ${d/2} 0 1 0 ${2*d} 0 a${d} ${d/2} 0 1 0 ${-2*d} 0`:id==='path-arc'?`M0 0 Q${d/2} ${-d} ${d} 0 Q${d/2} ${-d} 0 0`:`M0 0 L${d} 0 L0 0`;}
 return {catalogo,effetti,disponibile,durata,normalizza,tempi,sequenza,errore,percorso};
});
