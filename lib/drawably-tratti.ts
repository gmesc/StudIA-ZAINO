// Le primitive originali Drawably restano separate dal contratto sicuro di ZAINO.
import {roughRoundedRect,sampleLine,ellipsePoints,jitter} from '../vendor/drawably/src/rough';
import {mulberry32} from '../vendor/drawably/src/prng';
export {roughLine,roughCircle,roughEllipse,roughArrow,roughCheckmark,scribbleFill,roughRoundedRect} from '../vendor/drawably/src/rough';
export const palette={inchiostro:'#2724d1',carta:'#fffdf8',testo:'#303030',neutro:'#9ca3af'};
export function seme(id:string){let n=2166136261;for(const c of String(id))n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>1)||1;}
export function contorno(w:number,h:number,{raggio=12,seme:seed=1,spessore=2,immagine=false}={}){
 if(![w,h,raggio,seed,spessore].every(Number.isFinite)||w<=0||h<=0)throw Error('Dimensioni Drawably non valide.');
 const pad=Math.min(Math.max(.5,spessore/2),w/4,h/4),W=w-pad*2,H=h-pad*2,r=Math.max(0,Math.min(raggio,W/2,H/2)),o={seed,roughness:.35,boil:0};
 // Un solo tratto chiuso evita sovrapposizioni al crescere dello spessore del bordo.
 if(!immagine)return roughRoundedRect(pad,pad,W,H,r,o).split(/(?=M)/)[0];
 const l=pad,t=pad,R=w-pad,b=h-pad;
 const punti=[...sampleLine(l,t,R,t),[R,t],[R,t],...sampleLine(R,t,R,b-r),...ellipsePoints(R-r,b-r,r,r,0,Math.PI/2,8),...sampleLine(R-r,b,l+r,b),...ellipsePoints(l+r,b-r,r,r,Math.PI/2,Math.PI,8),...sampleLine(l,b-r,l,t),[l,t],[l,t]];
 const p=jitter(punti as [number,number][],mulberry32(seed),.35);p[0]=[l,t];
 for(let i=0;i<p.length;i++)if(punti[i][0]===R&&punti[i][1]===t||punti[i][0]===l&&punti[i][1]===t)p[i]=punti[i] as [number,number];
 let d='M'+p[0].map(n=>n.toFixed(2)).join(' ');for(let i=1;i<p.length-1;i++)d+='Q'+p[i].map(n=>n.toFixed(2)).join(' ')+' '+((p[i][0]+p[i+1][0])/2).toFixed(2)+' '+((p[i][1]+p[i+1][1])/2).toFixed(2);
 return d+'L'+l+' '+t+'Z';
}
const colori=v=>typeof v==='string'&&/^#[a-f0-9]{6}$/i.test(v);
export function configurazioneValida(s:any){
 if(!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).some(k=>!['versione','componente','larghezza','altezza','seme','proprieta'].includes(k))||s.versione!==1||typeof s.componente!=='string'||!/^[a-z-]{1,30}$/.test(s.componente)||!['larghezza','altezza'].every(k=>Number.isFinite(s[k])&&s[k]>=32&&s[k]<=2000)||!Number.isInteger(s.seme)||s.seme<1||s.seme>2147483647)return false;
 const p=s.proprieta;if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(k=>!['testo','secondario','variante','attivo','colore','fondo','carta','spessore','ruvidita'].includes(k)))return false;
 return Object.entries(p).every(([k,v])=>['testo','secondario'].includes(k)?typeof v==='string'&&v.length<=2000:k==='variante'?['outline','solid','scribble'].includes(v as string):k==='attivo'?typeof v==='boolean':['colore','fondo','carta'].includes(k)?colori(v):k==='spessore'?Number.isFinite(v)&&Number(v)>=.5&&Number(v)<=8:k==='ruvidita'&&Number.isFinite(v)&&Number(v)>=0&&Number(v)<=2);
}
