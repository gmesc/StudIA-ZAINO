// Il motore piccolo serve anche a mappe e navbar; il catalogo si carica solo aprendo la libreria.
import rough from 'roughjs';
import { HAND } from '../vendor/squig/lib/sketch/kit';
import { THEMES } from '../vendor/squig/lib/theme';
export const temi = THEMES;
export const nomi = {'internet-blue':'Blu Internet','riso-red':'Rosso riso','terminal-green':'Verde terminale',plum:'Prugna',marigold:'Ocra',graphite:'Grafite'};
const generatore = rough.generator();
export function seme(id: string) { let n=2166136261; for(const c of String(id)) n=Math.imul(n^c.charCodeAt(0),16777619); return (n>>>1)||1; }
export function contorno(w: number,h: number,{forma='rettangolo',raggio=3,seme:seed=1,spessore=HAND.strokeWidth,angoliSuperioriRetti=false}={}) {
 if(![w,h,raggio,seed,spessore].every(Number.isFinite)||w<=0||h<=0)throw Error('Dimensioni Squig non valide.');
 const r=Math.max(0,Math.min(raggio,w/2,h/2)),op={seed,roughness:HAND.roughness,bowing:HAND.bowing,strokeWidth:spessore,disableMultiStroke:true,preserveVertices:true};
 const d=forma==='cerchio'?generatore.ellipse(w/2,h/2,w,h,op):forma==='freccia'?generatore.polygon([[0,0],[w-12,0],[w,h/2],[w-12,h],[0,h],[12,h/2]],op):generatore.path((angoliSuperioriRetti?'M0 0H'+w:'M'+r+' 0H'+(w-r)+'Q'+w+' 0 '+w+' '+r)+'V'+(h-r)+'Q'+w+' '+h+' '+(w-r)+' '+h+'H'+r+'Q0 '+h+' 0 '+(h-r)+(angoliSuperioriRetti?'V0Z':'V'+r+'Q0 0 '+r+' 0Z'),op);
 // Rough separa ogni lato con una mossa: saldarli evita fessure e terminali visibili con penne spesse.
 let primo=true;return generatore.toPaths(d).map(p=>p.d.replace(/M([-+\d.eE]+)[ ,]+([-+\d.eE]+)/g,(_m,x,y)=>{const c=primo?'M':'L';primo=false;return c+x+' '+y;})).join(' ')+'Z';
}
export function configurazioneValida(s:any) {
 return !!s&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).every(k=>['versione','componente','tema','larghezza','altezza','seme','proprieta'].includes(k))&&s.versione===1&&typeof s.componente==='string'&&/^[a-z0-9-]{1,100}$/.test(s.componente)&&Object.hasOwn(temi,s.tema)&&['larghezza','altezza'].every(k=>Number.isFinite(s[k])&&s[k]>=16&&s[k]<=2000)&&Number.isInteger(s.seme)&&s.seme>0&&s.seme<2147483648&&s.proprieta&&typeof s.proprieta==='object'&&!Array.isArray(s.proprieta)&&Object.keys(s.proprieta).length<=80&&Object.entries(s.proprieta).every(([k,v])=>/^[a-zA-Z][a-zA-Z0-9]{0,60}$/.test(k)&&(typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=10000||typeof v==='string'&&v.length<=10000));
}
