/* Testo sul foglio: sequenze validate, formati per intervallo e fallback Markdown senza DOM. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PresentaTesto=factory();})(typeof window==='undefined'?this:window,function(){
 'use strict';
 const FONT=['zaino','arial','verdana','georgia','courier','atkinson','atkinson-next','testme','testme-alt','patrick-hand'];
 const CHIAVI=['bold','italic','underline','fontFamily','fontSize','fontWeight','color'];
 const pesi=f=>f==='atkinson-next'?[200,300,400,500,600,700,800]:[400,700];
 const peso=(s={},base=400)=>s.fontWeight??(s.bold===undefined?base:s.bold?700:400);
 // Il rettangolo di Range include ascendenti/discendenti vuote del font, non solo i glifi.
 function limitiInchiostro(r,m,scala){
  if(![m.fontBoundingBoxDescent,m.actualBoundingBoxAscent,m.actualBoundingBoxDescent].every(Number.isFinite))return r;
  const base=r.bottom-m.fontBoundingBoxDescent*scala;
  return {left:r.left,right:r.right,top:base-m.actualBoundingBoxAscent*scala,bottom:base+m.actualBoundingBoxDescent*scala};
 }
 function aggiornaStile(s={},patch={}){const v={...s,...patch};if(Object.hasOwn(patch,'bold')&&!Object.hasOwn(patch,'fontWeight'))delete v.fontWeight;if(patch.fontWeight!=null)v.bold=patch.fontWeight>=600;if(patch.fontFamily&&!pesi(patch.fontFamily).includes(v.fontWeight))delete v.fontWeight;return v;}
 const copia=x=>JSON.parse(JSON.stringify(x));
 function stileValido(s){return !!s&&typeof s==='object'&&!Array.isArray(s)&&Object.entries(s).every(([k,v])=>CHIAVI.includes(k)&&(k==='fontFamily'?FONT.includes(v):k==='fontWeight'?[200,300,400,500,600,700,800,900].includes(v):k==='fontSize'?Number.isFinite(v)&&v>=12&&v<=160:k==='color'?v===null||/^#[a-fA-F0-9]{6}$/.test(v):typeof v==='boolean'));}
 function linkValido(s){try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&s.length<=2000;}catch(_){return false;}}
 function valida(ns){
  if(!Array.isArray(ns)||ns.length>10000)return false;let quanti=0;
  for(const n of ns){if(!n||typeof n!=='object'||Array.isArray(n))return false;
   if(typeof n.text==='string'){quanti+=n.text.length;if(Object.keys(n).some(k=>!['text','style','link'].includes(k))||n.style!==undefined&&!stileValido(n.style)||n.link!==undefined&&!linkValido(n.link))return false;}
   else if(typeof n.latex==='string'){quanti+=n.latex.length;if(n.latex.length>20000||typeof n.display!=='boolean'||Object.keys(n).some(k=>!['latex','display'].includes(k)))return false;}
   else if(typeof n.markdown==='string'){quanti+=n.markdown.length;if(Object.keys(n).length!==1)return false;}
   else return false;
  }return quanti<=100000;
 }
 function esigi(ns){if(!valida(ns))throw Error('Testo formattato non valido.');return ns;}
 function normalizza(ns){esigi(ns);const out=[];for(const originale of ns){const n=copia(originale);if(n.style&&!Object.keys(n.style).length)delete n.style;if(n.text==='')continue;const p=out.at(-1);if(typeof n.text==='string'&&typeof p?.text==='string'&&JSON.stringify(n.style||{})===JSON.stringify(p.style||{})&&n.link===p.link)p.text+=n.text;else out.push(n);}return out;}
 const lunghezza=ns=>ns.reduce((a,n)=>a+(n.text?.length??1),0);
 const piano=ns=>ns.map(n=>n.text??(n.latex!==undefined?'\\'+(n.display?'[':'(')+n.latex+'\\'+(n.display?']':')'):n.markdown)).join('');
 function formatta(ns,inizio,fine,patch){
  esigi(ns);if(!Number.isInteger(inizio)||!Number.isInteger(fine)||inizio<0||fine<inizio||fine>lunghezza(ns))throw Error('Selezione del testo non valida.');
  if(!patch||Object.keys(patch).some(k=>!CHIAVI.includes(k))||!stileValido(Object.fromEntries(Object.entries(patch).filter(([,v])=>v!==null))))throw Error('Formato del testo non valido.');
  let pos=0;const out=[];for(const n of ns){const len=n.text?.length??1,a=Math.max(0,inizio-pos),b=Math.min(len,fine-pos);pos+=len;
   if(n.text===undefined||a>=b){out.push(n);continue;}if(a)out.push({...n,text:n.text.slice(0,a)});const style=aggiornaStile(n.style,patch);for(const [k,v]of Object.entries(patch)){if(v===null&&k!=='color')delete style[k];}out.push({...n,text:n.text.slice(a,b),style});if(b<len)out.push({...n,text:n.text.slice(b)});
  }return normalizza(out);
 }
 function collega(ns,inizio,fine,link){
  esigi(ns);if(link!==null&&!linkValido(link))throw Error('Usa un collegamento http o https valido.');
  if(!Number.isInteger(inizio)||!Number.isInteger(fine)||inizio<0||fine<=inizio||fine>lunghezza(ns))throw Error('Seleziona le parole del collegamento.');
  let pos=0;const out=[];for(const n of ns){const len=n.text?.length??1,a=Math.max(0,inizio-pos),b=Math.min(len,fine-pos);pos+=len;if(n.text===undefined||a>=b){out.push(n);continue;}if(a)out.push({...n,text:n.text.slice(0,a)});const v={...n,text:n.text.slice(a,b)};if(link)v.link=link;else delete v.link;out.push(v);if(b<len)out.push({...n,text:n.text.slice(b)});}return normalizza(out);
 }
 function riscrivi(ns,testo){
  esigi(ns);if(typeof testo!=='string'||testo.length>100000||ns.some(n=>n.text===undefined))throw Error('Modifica questo contenuto direttamente sul foglio.');
  const prima=piano(ns);let a=0,b=0;while(a<prima.length&&a<testo.length&&prima[a]===testo[a])a++;while(b<prima.length-a&&b<testo.length-a&&prima[prima.length-1-b]===testo[testo.length-1-b])b++;
  let pos=0;const out=[],coda=[];let stile;
  for(const n of ns){const inizio=pos;pos+=n.text.length;if(inizio<=a&&a<=pos)stile=n;
   if(inizio<a)out.push({...n,text:n.text.slice(0,Math.min(n.text.length,a-inizio))});
   if(pos>prima.length-b)coda.push({...n,text:n.text.slice(Math.max(0,prima.length-b-inizio))});}
  const inserito=testo.slice(a,testo.length-b);if(inserito)out.push({...stile,text:inserito});return normalizza([...out,...coda]);
 }
 function comune(ns,k){return normalizza(ns.map(n=>{if(!n.style)return n;const style={...n.style};delete style[k];return {...n,style};}));}
 // Il Markdown rimane una rappresentazione leggibile; richText è autorevole quando presente.
 function markdown(ns){const esc=s=>s.replace(/[\\`*_{}[\]<>#!|]/g,'\\$&');return ns.map(n=>{if(n.markdown!==undefined)return n.markdown;if(n.latex!==undefined)return '\\'+(n.display?'[':'(')+n.latex+'\\'+(n.display?']':')');let s=esc(n.text);if(n.style?.bold)s='**'+s+'**';if(n.style?.italic)s='*'+s+'*';if(n.link)s='['+s+']('+n.link.replace(/[()]/g,c=>encodeURIComponent(c))+')';return s;}).join('');}
 function css(s={},caratteri={}){const out=['text-decoration:var(--sottolineato-testo,none)'];if(s.fontFamily&&caratteri[s.fontFamily])out.push('font-family:'+caratteri[s.fontFamily].css);if(s.fontSize)out.push('font-size:'+s.fontSize+'px');if(s.fontWeight!==undefined||s.bold!==undefined)out.push('font-weight:'+peso(s));if(s.italic!==undefined)out.push('font-style:'+(s.italic?'italic':'normal'));if(s.underline!==undefined)out.push('text-decoration:'+(s.underline?'underline':'none'));if(s.color!==undefined)out.push('color:'+(s.color||'var(--ink)'));return out.join(';');}
 return {pesi,peso,limitiInchiostro,aggiornaStile,collega,riscrivi,FONT,CHIAVI,stileValido,linkValido,valida,esigi,normalizza,lunghezza,piano,formatta,comune,markdown,css};
});
