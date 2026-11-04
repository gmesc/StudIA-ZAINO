/* Tabelle degli appunti: dati leggibili nel Markdown, nessun HTML eseguibile. */
(function(root,f){if(typeof module==='object'&&module.exports)module.exports=f();else root.AppuntiTabelle=f();}(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function valida(t){
  if(!t||t.version!==1||!Array.isArray(t.rows)||!t.rows.length||t.rows.length>50)throw Error('Tabella non valida (massimo 50 righe).');
  const cols=t.rows[0].length;
  if(!cols||cols>20||!t.rows.every(r=>Array.isArray(r)&&r.length===cols&&r.every(c=>typeof c==='string'&&c.length<=10000)))throw Error('Tabella non valida (massimo 20 colonne).');
  const stile={};
  for(const [k,v] of Object.entries(t.style||{})){
   if(['color','background','borderColor','headerBackground','headerColor'].includes(k)&&/^#[\da-f]{6}$/i.test(v))stile[k]=v;
   else if(k==='font'&&typeof v==='string'&&/^[\w ,"'-]{1,150}$/.test(v))stile[k]=v;
   else if(k==='size'&&Number.isFinite(v)&&v>=8&&v<=100)stile[k]=v;
   else if(k==='weight'&&[200,300,400,500,600,700,800,900].includes(v))stile[k]=v;
   else if(k==='lineHeight'&&Number.isFinite(v)&&v>=1&&v<=2)stile[k]=v;
   else if(k==='borderWidth'&&Number.isFinite(v)&&v>=0&&v<=6)stile[k]=v;
   else if(k==='borderMode'&&['rows','grid','none'].includes(v))stile[k]=v;
   else if(k==='borderStyle'&&['solid','dashed','dotted'].includes(v))stile[k]=v;
   else if(k==='verticalAlign'&&['top','middle','bottom'].includes(v))stile[k]=v;
   else if(k==='align'&&['left','center','right'].includes(v))stile[k]=v;
   else if(['bold','italic','underline'].includes(k)&&typeof v==='boolean')stile[k]=v;
   else throw Error('Stile della tabella non supportato: '+k);
  }
  return {version:1,rows:t.rows.map(r=>r.slice()),header:t.header!==false,style:stile};
 }
 function scrivi(t){return '```zaino-tabella\n'+JSON.stringify(valida(t))+'\n```';}
 function leggi(lines,i=0){
  if(lines[i]==='```zaino-tabella'){
   const fine=lines.indexOf('```',i+1);if(fine<0)return null;
   return {tabella:valida(JSON.parse(lines.slice(i+1,fine).join('\n'))),fine};
  }
  const celle=l=>l.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(c=>c.trim().replace(/\\\|/g,'|'));
  if(!lines[i]?.includes('|')||!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i+1]||''))return null;
  const rows=[celle(lines[i])];let fine=i+1;
  while(lines[fine+1]?.includes('|')&&lines[fine+1].trim()){rows.push(celle(lines[++fine]));}
  return {tabella:valida({version:1,rows}),fine};
 }
 function css(s){return Object.entries({color:s.color,'background-color':s.background,'font-family':s.font,'font-size':s.size?s.size+'px':null,'text-align':s.align,'font-weight':s.weight||(s.bold?'700':null),'line-height':s.lineHeight,'font-style':s.italic?'italic':null,'text-decoration':s.underline?'underline':null}).filter(([,v])=>v).map(([k,v])=>k+':'+v).join(';');}
 function daTema(t,tema,font,headerColor){return valida({...t,style:{...t.style,font,color:tema.colore,background:tema.sfondo,headerBackground:tema.accento,headerColor,borderColor:tema.accento,borderMode:'rows',borderWidth:1}});}
 function bordi(s){const valore=(s.borderWidth??1)+'px '+(s.borderStyle||'solid')+' '+(s.borderColor||'#999999');return 'border:0;'+(s.borderMode==='none'?'':(s.borderMode==='grid'?'border:':'border-bottom:')+valore+';');}
 function html(t,inline=esc){
  t=valida(t);const s={size:17,...t.style};
  const righe=t.rows.map((r,i)=>'<tr>'+r.map(c=>{const tag=!i&&t.header?'th':'td';return '<'+tag+' style="'+bordi(s)+'vertical-align:'+(s.verticalAlign||'top')+';text-align:'+(s.align||'left')+';padding:8px;'+(!i&&t.header&&s.headerBackground?'background-color:'+s.headerBackground+';':'')+(!i&&t.header&&s.headerColor?'color:'+s.headerColor+';':'')+'">'+inline(c).replace(/\n/g,'<br>')+'</'+tag+'>';}).join('')+'</tr>');
  return '<table class="note-tabella" style="border-collapse:collapse;width:100%;'+esc(css(s))+'">'+(t.header?'<thead>'+righe.shift()+'</thead>':'')+'<tbody>'+righe.join('')+'</tbody></table>';
 }
 function daPresenta(b,settings={},sfondo='#ffffff',font='Arial'){
  const s=b.style||{};return valida({version:1,rows:b.table,header:true,style:{font,size:s.fontSize||32,color:s.color||(/^#(?:0f|1e)/i.test(sfondo)?'#ffffff':'#111111'),borderColor:/^#(?:0f|1e)/i.test(sfondo)?'#ffffff':'#555555',background:sfondo,align:s.align||'left',bold:s.bold===true||s.fontWeight>=600,italic:!!s.italic,underline:!!s.underline}});
 }
 return {valida,scrivi,leggi,html,daPresenta,daTema,bordi};
}));
