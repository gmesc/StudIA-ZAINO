// Adattamento di Squig a un albero SVG sicuro: niente React, rete o editor incorporato.
import { ALL_DEFS, getDef } from '../vendor/squig/lib/library/registry';
import { primsToPaths } from '../vendor/squig/lib/sketch/paths';
import { loadIconWeight, ICON_NAME_SET } from '../vendor/squig/lib/sketch/icon-catalog';
import { resolveIconName } from '../vendor/squig/lib/sketch/icons';
import { temi, nomi, configurazioneValida } from './squig-tratti';
export {temi,nomi};
export const icone = [...ICON_NAME_SET];
export const catalogo = ALL_DEFS.map(({render,...d})=>d);
export const prepara = ()=>Promise.all(['thin','light','regular','bold','fill'].map(w=>loadIconWeight(w as any)));
const copia = v=>JSON.parse(JSON.stringify(v));
export function nuova(componente='button') {const d=getDef(componente);if(!d)throw Error('Componente Squig non disponibile.');return {versione:1,componente,tema:'internet-blue',larghezza:d.size.w,altezza:d.size.h,seme:1,proprieta:copia(d.defaults)};}
export function esigi(v) {
 if(!configurazioneValida(v))throw Error('Configurazione Squig non valida.');
 const d=getDef(v.componente);if(!d)throw Error('Componente Squig non disponibile: '+v.componente);
 const chiavi=new Set([...Object.keys(d.defaults),...d.controls.map(c=>c.key)]);
 if(Object.keys(v.proprieta).some(k=>!chiavi.has(k)))throw Error('Proprietà Squig non disponibile.');
 const p={...d.defaults,...v.proprieta};
 for(const c of d.controls){const x=p[c.key];if(x===undefined)continue;
  if(c.type==='toggle'?typeof x!=='boolean':c.type==='number'?typeof x!=='number'||!Number.isFinite(x)||x<(c.min??-10000)||x>(c.max??10000):c.type==='select'?!c.options?.includes(x as string):typeof x!=='string')throw Error('Valore non valido per '+c.label+'.');
  if(c.type==='icon'&&x!=='none'&&!ICON_NAME_SET.has(resolveIconName(x as string)))throw Error('Icona non disponibile: '+x);
 }
 return {...copia(v),proprieta:p};
}
export function disegno(v) {
 const s=esigi(v),def=getDef(s.componente)!,palette=temi[s.tema],prims=def.render(s.proprieta,s.larghezza,s.altezza),{paths,texts,crisp}=primsToPaths(prims,s.seme);
 const colori={'var(--sq-ink)':palette.ink,'var(--sq-muted)':palette.muted,'var(--sq-faint)':palette.faint,'var(--sq-paper)':palette.paper,'var(--sq-shade)':palette.shade,'var(--sq-shade-strong)':palette.shadeStrong};
 const colore=c=>colori[c]||c;
 const nodo=(tag,attrs,text?)=>({tag,attrs:Object.fromEntries(Object.entries(attrs).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)])),...(text!==undefined?{text}:{}),children:[]});
 const nodes=paths.map(p=>nodo('path',{d:p.d,stroke:colore(p.stroke),'stroke-width':p.strokeWidth,fill:colore(p.fill),'stroke-dasharray':p.dash,'stroke-linecap':'round','stroke-linejoin':'round'}));
 for(const p of crisp)for(const d of p.d)nodes.push(nodo('path',{d,transform:p.transform,fill:p.mode==='fill'?colore(p.color):'none',stroke:p.mode==='stroke'?colore(p.color):'none','stroke-width':p.strokeWidth,'stroke-linecap':'round','stroke-linejoin':'round'}));
 for(const t of texts){nodes.push(nodo('text',{x:t.x,y:t.y,'font-size':t.size,'font-family':'Patrick Hand, cursive','font-weight':t.bold?700:400,'font-style':t.italic?'italic':'normal','text-decoration':t.underline?'underline':'none','text-anchor':t.align==='center'?'middle':t.align==='right'?'end':'start',fill:palette[t.color==='accent'?'ink':t.color||'ink']},t.text));}
 // Il margine protegge la penna e le ombre dal ritaglio senza cambiare il rapporto del componente.
 return {viewBox:'-6 -6 '+(s.larghezza+12)+' '+(s.altezza+12),nodes,scene:[],squig:s};
}
