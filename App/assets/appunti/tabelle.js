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
   if(['color','background','borderColor','headerBackground'].includes(k)&&/^#[\da-f]{6}$/i.test(v))stile[k]=v;
   else if(k==='font'&&typeof v==='string'&&/^[\w ,"'-]{1,150}$/.test(v))stile[k]=v;
   else if(k==='size'&&Number.isFinite(v)&&v>=8&&v<=100)stile[k]=v;
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
 function css(s){return Object.entries({color:s.color,'background-color':s.background,'font-family':s.font,'font-size':s.size?s.size+'px':null,'text-align':s.align,'font-weight':s.bold?'700':null,'font-style':s.italic?'italic':null,'text-decoration':s.underline?'underline':null}).filter(([,v])=>v).map(([k,v])=>k+':'+v).join(';');}
 function html(t,inline=esc){
  t=valida(t);const s={size:17,...t.style};
  const righe=t.rows.map((r,i)=>'<tr>'+r.map(c=>{const tag=!i&&t.header?'th':'td';return '<'+tag+' style="border:0;border-bottom:1px solid '+(s.borderColor||'#999999')+';text-align:'+(s.align||'left')+';padding:8px;'+(!i&&t.header&&s.headerBackground?'background-color:'+s.headerBackground+';':'')+'">'+inline(c).replace(/\n/g,'<br>')+'</'+tag+'>';}).join('')+'</tr>');
  return '<table class="note-tabella" style="border-collapse:collapse;width:100%;'+esc(css(s))+'">'+(t.header?'<thead>'+righe.shift()+'</thead>':'')+'<tbody>'+righe.join('')+'</tbody></table>';
 }
 function daPresenta(b,settings={},sfondo='#ffffff',font='Arial'){
  const s=b.style||{};return valida({version:1,rows:b.table,header:true,style:{font,size:s.fontSize||32,color:s.color||(/^#(?:0f|1e)/i.test(sfondo)?'#ffffff':'#111111'),borderColor:/^#(?:0f|1e)/i.test(sfondo)?'#ffffff':'#555555',background:sfondo,align:s.align||'left',bold:s.bold===true||s.fontWeight>=600,italic:!!s.italic,underline:!!s.underline}});
 }
 return {valida,scrivi,leggi,html,daPresenta};
}));
