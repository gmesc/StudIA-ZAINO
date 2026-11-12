// Adattamento statico dei 23 elementi documentati da Drawably: le geometrie usano il suo motore originale.
import {roughRoundedRect,roughLine,roughCircle,roughEllipse,roughArrow,roughCheckmark,scribbleFill,configurazioneValida,palette} from './drawably-tratti';
export {palette};
const definizioni=[
 ['button','Pulsante','Controlli',180,54,'Procedi','',true],['checkbox','Casella di spunta','Controlli',220,48,'Ho capito','',true],['radio','Scelta singola','Controlli',220,48,'La mia scelta','',true],['toggle','Interruttore','Controlli',220,48,'Attivato','',true],['input','Campo di testo','Controlli',280,54,'Scrivi qui','',false],['textarea','Area di testo','Controlli',280,130,'Le mie osservazioni','',false],['select','Menu di scelta','Controlli',260,54,'Scegli un argomento','',false],['divider','Divisore','Controlli',280,32,'','',false],['card','Scheda','Controlli',300,180,'Un nuovo argomento','Osserva, collega e approfondisci.',false],['badge','Etichetta','Controlli',150,44,'Novità','',false],['list','Elenco','Controlli',300,140,'Osserva\nCollega\nRacconta','',false],
 ['underline','Sottolineatura','Decorazioni',280,64,'Un concetto importante','',false],['highlight','Evidenziatore','Decorazioni',280,64,'Da ricordare','',false],['circle','Cerchio sul testo','Decorazioni',280,80,'Guarda qui','',false],['arrow','Freccia','Decorazioni',280,90,'Collega le idee','',false],
 ['chip','Chip','Compositi',200,48,'Scelto','',true],['tabs','Schede di navigazione','Compositi',360,65,'Inizio|Esplora|Ripasso','',true],['tooltip','Suggerimento','Compositi',270,120,'Prova questo percorso','',false],['alert','Avviso','Compositi',320,130,'Un passo alla volta','Puoi tornare qui quando vuoi.',false],['steps','Passaggi','Compositi',300,140,'Raccogli\nOrganizza\nPresenta','',true],['kbd','Tasto','Compositi',100,48,'⌘ K','',false],['quote','Citazione','Compositi',320,145,'Le domande aprono nuove strade.','Il mio taccuino',false],['pager','Paginazione','Compositi',240,60,'1|2|3','',true]
];
export const catalogo=definizioni.map(([kind,name,group,w,h,testo,secondario,attivo])=>({kind,name,group,size:{w,h},defaults:{testo,secondario,attivo,variante:'outline',colore:palette.inchiostro,fondo:palette.inchiostro,carta:palette.carta,spessore:2,ruvidita:1}}));
const copia=v=>JSON.parse(JSON.stringify(v));
export function nuova(componente='button'){const d=catalogo.find(d=>d.kind===componente);if(!d)throw Error('Componente Drawably non disponibile.');return {versione:1,componente,larghezza:d.size.w,altezza:d.size.h,seme:7,proprieta:copia(d.defaults)};}
export function esigi(v){if(!configurazioneValida(v)||!catalogo.some(d=>d.kind===v.componente))throw Error('Configurazione Drawably non valida.');return {...copia(v),proprieta:{...nuova(v.componente).proprieta,...v.proprieta}};}
export function disegno(v){
 const s=esigi(v),p=s.proprieta,def=catalogo.find(d=>d.kind===s.componente),w=Math.max(s.larghezza,def.size.w),h=Math.max(s.altezza,def.size.h),o={seed:s.seme,roughness:p.ruvidita,boil:0},nodes=[];
 const nodo=(tag,attrs,text?)=>({tag,attrs:Object.fromEntries(Object.entries(attrs).map(([k,v])=>[k,String(v)])),...(text!==undefined?{text}:{}),children:[]});
 const path=(d,fill='none',stroke=p.colore,width=p.spessore,opacity=1)=>{if(d)nodes.push(nodo('path',{d,fill,stroke,'stroke-width':width,'stroke-linecap':'round','stroke-linejoin':'round',opacity}));};
 const rect=(x,y,W,H,r=8,fill=p.carta)=>path(roughRoundedRect(x,y,W,H,r,o),fill);
 const line=(x,y,X,Y)=>path(roughLine(x,y,X,Y,o));
 function text(t,x,y,W,H,size=24,align='start',color=p.colore){
  const righe=String(t).split('\n'),fs=Math.min(size,H/Math.max(1,righe.length)/1.3,W/(Math.max(1,...righe.map(t=>[...t].length))*.55));
  righe.forEach((r,i)=>nodes.push(nodo('text',{x,y:y+i*fs*1.3,'font-size':fs,'font-family':'Patrick Hand, cursive','text-anchor':align,fill:color},r)));
 }
 const centrale=(t=p.testo,color=p.colore)=>text(t,w/2,h/2+8,w-24,h-12,24,'middle',color);
 const k=s.componente;
 if(['button','badge','kbd','chip'].includes(k)){
  const solid=p.variante==='solid',scribble=p.variante==='scribble',r=k==='badge'||k==='chip'?Math.min(22,h/2-4):k==='kbd'?5:8;
  rect(3,3,w-6,h-6,r,solid?p.fondo:p.carta);if(scribble)path(scribbleFill(6,6,w-12,h-12,o),'none',p.fondo,1,.3);
  if(k==='chip'){rect(12,h/2-10,20,20,5);if(p.attivo)path(roughCheckmark(15,h/2-5,14,11,o));text(p.testo,43,h/2+8,w-52,h-10,24);}else centrale(p.testo,solid?p.carta:p.colore);
 }else if(['checkbox','radio','toggle'].includes(k)){
  const side=Math.min(34,h-8),y=(h-side)/2;
  if(k==='checkbox'){rect(3,y,side,side,5);if(p.attivo)path(roughCheckmark(3+side*.24,y+side*.2,side*.52,side*.5,o));}
  else if(k==='radio'){path(roughCircle(3+side/2,y+side/2,side/2,o),p.carta);if(p.attivo)path(roughCircle(3+side/2,y+side/2,side*.18,o),p.fondo,p.fondo);}
  else{const W=side*1.65;rect(3,y,W,side,side/2,p.attivo?p.fondo:p.carta);path(roughCircle(3+(p.attivo?W-side/2:side/2),y+side/2,side/2-5,o),p.attivo?p.carta:p.fondo,p.attivo?p.carta:p.fondo);}
  text(p.testo,k==='toggle'?side*1.65+16:side+16,h/2+8,w-(k==='toggle'?side*1.65:side)-24,h-8);
 }else if(['input','textarea','select'].includes(k)){
  rect(3,3,w-6,h-6,6);text(p.testo,15,k==='textarea'?32:h/2+8,w-(k==='select'?48:28),h-14);
  if(k==='select'){line(w-28,h/2-3,w-22,h/2+3);line(w-22,h/2+3,w-16,h/2-3);}
 }else if(k==='divider')line(3,h/2,w-3,h/2);
 else if(k==='card'||k==='alert'){
  rect(3,3,w-6,h-6,10);if(k==='alert'){path(roughCircle(25,28,12,o),p.fondo,p.fondo);text('!',25,36,20,30,23,'middle',p.carta);}
  text(p.testo,k==='alert'?48:18,36,w-(k==='alert'?64:36),36,28);text(p.secondario,18,70,w-36,h-75,22);
 }else if(k==='list'||k==='steps'){
  const righe=String(p.testo).split('\n'),passo=(h-10)/Math.max(1,righe.length);righe.forEach((r,i)=>{const y=10+passo*i+Math.min(24,passo*.65);if(k==='steps')path(roughCheckmark(5,y-15,15,14,{...o,seed:o.seed+i}));else line(5,y-6,19,y-6);text(r,32,y,w-40,passo,Math.min(24,passo*.7));});
 }else if(k==='underline'){centrale();line(12,h*.75,w-12,h*.75);}
 else if(k==='highlight'){path(roughRoundedRect(8,h*.2,w-16,h*.65,4,o),p.fondo,p.fondo,1,.22);centrale();}
 else if(k==='circle'){path(roughEllipse(w/2,h/2,w/2-6,h/2-6,o));centrale();}
 else if(k==='arrow'){path(roughArrow(10,h-15,w-12,14,o));text(p.testo,12,24,w-24,h/2,22);}
 else if(k==='tabs'||k==='pager'){
  const labels=String(p.testo).split('|'),W=(w-8)/Math.max(1,labels.length);labels.forEach((t,i)=>{const x=4+i*W,attivo=i===(p.attivo?Math.min(1,labels.length-1):0);if(k==='pager')rect(x,6,W-8,h-12,8,attivo?p.fondo:p.carta);else if(attivo)line(x+4,h-9,x+W-12,h-9);text(t,x+(W-8)/2,h/2+8,W-14,h-16,24,'middle',k==='pager'&&attivo?p.carta:p.colore);});
 }else if(k==='tooltip'){rect(3,3,w-6,h*.65,10);text(p.testo,w/2,h*.33+8,w-30,h*.55,24,'middle');path(roughArrow(w*.6,h*.7,w*.8,h-5,o));}
 else if(k==='quote'){path(roughRoundedRect(8,6,w-16,h*.56,4,o),p.fondo,p.fondo,1,.18);text(p.testo,16,30,w-32,h*.52,26);line(16,h*.7,w-16,h*.7);text(p.secondario,16,h*.88,w-32,h*.25,20);}
 // Sotto le dimensioni di progetto si scala il disegno intero, evitando campi o caratteri negativi.
 const contenuto=w===s.larghezza&&h===s.altezza?nodes:[{tag:'g',attrs:{transform:'scale('+(s.larghezza/w)+' '+(s.altezza/h)+')'},children:nodes}];
 return {viewBox:'-8 -8 '+(s.larghezza+16)+' '+(s.altezza+16),nodes:contenuto,scene:[],drawably:s};
}
