/* Resa comune di slide e note. Il Markdown passa da un albero di token consentiti. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('marked'),require('katex'),require('./modello'),require('../../../lib/validate').validatePresentazione);else root.PresentaReveal=factory(root.marked,root.katex,root.PresentaModello);})(typeof window==='undefined'?this:window,function(marked,katex,M,valida){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const parser=new marked.Marked({gfm:true,breaks:false});
 parser.use({extensions:[{name:'formulaZaino',level:'inline',start:s=>{const a=['\\(','\\[','$$'].map(x=>s.indexOf(x)).filter(x=>x>=0);return a.length?Math.min(...a):undefined;},tokenizer(s){
  for(const [apri,chiudi,display] of [['\\(','\\)',false],['\\[','\\]',true],['$$','$$',true]])if(s.startsWith(apri)){const fine=s.indexOf(chiudi,apri.length);if(fine>=0)return {type:'formulaZaino',raw:s.slice(0,fine+chiudi.length),latex:s.slice(apri.length,fine),display};}
 }}]});
 function formula(latex,display,errors,contesto){
  try{return katex.renderToString(latex,{displayMode:display,throwOnError:true,trust:false,strict:'error',maxExpand:1000,maxSize:20,output:'htmlAndMathml'});}
  catch(e){errors.push({contesto,error:e.message});return '<span class="presenta-formula-errore" role="status">Formula da correggere: <code>'+esc(latex)+'</code></span>';}
 }
 function markdown(testo,errors=[],contesto='testo',inline=false){
  function tokens(ts){return (ts||[]).map(token).join('');}
  function token(t){
   const inner=()=>t.tokens?tokens(t.tokens):esc(t.text||'');
   switch(t.type){
    case 'space':return '';
    case 'formulaZaino':return formula(t.latex,t.display,errors,contesto);
    case 'paragraph':return inline?inner():'<p>'+inner()+'</p>';
    case 'heading':return inline?inner():'<h'+t.depth+'>'+inner()+'</h'+t.depth+'>';
    case 'text':case 'escape':return inner();
    case 'strong':return '<strong>'+inner()+'</strong>';
    case 'em':return '<em>'+inner()+'</em>';
    case 'del':return '<del>'+inner()+'</del>';
    case 'br':return '<br>';
    case 'hr':return '<hr>';
    case 'blockquote':return '<blockquote>'+inner()+'</blockquote>';
    case 'codespan':return '<code>'+esc(t.text)+'</code>';
    case 'code':return '<pre><code>'+esc(t.text)+'</code></pre>';
    case 'html':return esc(t.raw);
    case 'image':return esc(t.text);
    case 'link':{
     let u;try{u=new URL(t.href);}catch(_){}return u&&['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?'<a href="'+esc(u.href)+'" target="_blank" rel="noopener noreferrer">'+inner()+'</a>':inner();
    }
    case 'list':{const tag=t.ordered?'ol':'ul';return '<'+tag+'>'+t.items.map(i=>'<li>'+tokens(i.tokens)+'</li>').join('')+'</'+tag+'>';}
    case 'table':return '<table><thead><tr>'+t.header.map(c=>'<th>'+tokens(c.tokens)+'</th>').join('')+'</tr></thead><tbody>'+t.rows.map(r=>'<tr>'+r.map(c=>'<td>'+tokens(c.tokens)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
    default:return esc(t.raw||'');
   }
  }
  return tokens(parser.lexer(testo));
 }
 function fragments(contenuto,id,s){
  const azioni=s.animations.filter(a=>a.targetId===id).sort((a,b)=>a.step-b.step);
  for(const a of azioni.reverse())contenuto='<div class="fragment '+a.effect+'" data-fragment-index="'+M.indiceFragment(a.step)+'">'+contenuto+'</div>';
  return contenuto;
 }
 function stile(b){
  const s=b.style||{},out=[];
  if(s.column)out.push('grid-column:'+s.column+' / span '+(s.span||6));else if(s.span)out.push('grid-column:span '+s.span);
  if(s.row)out.push('grid-row:'+s.row+' / span '+(s.rowSpan||1));if(s.fontSize)out.push('font-size:'+s.fontSize+'px');
  if(s.color)out.push('color:'+s.color);if(s.align)out.push('text-align:'+s.align);return out.join(';');
 }
 function compila(documento){
  if(valida){const r=valida(documento);if(!r.ok)throw Error(r.errors.join('; '));}M.esigi(documento);const d=M.pubblica(documento),errors=[];
  function blocco(b,s){
   let contenuto='';
   if(b.type==='title')contenuto='<h2>'+markdown(b.markdown,errors,b.id,true)+'</h2>';
   else if(b.type==='text')contenuto=markdown(b.markdown,errors,b.id);
   else if(b.type==='math')contenuto=formula(b.latex,b.display,errors,b.id);
   else if(b.type==='list')contenuto='<ul>'+b.items.map(i=>'<li>'+fragments(markdown(i.markdown,errors,i.id),i.id,s)+'</li>').join('')+'</ul>';
   else{
    const a=d.assets[b.assetId],src=a.path;
    if(b.type==='image')contenuto='<img src="'+esc(src)+'" alt="'+esc(b.alt||'')+'">';
    else{const fragment=b.start!==undefined?'#t='+b.start+(b.end!==undefined?','+b.end:''):'';contenuto='<'+b.type+' controls preload="none"'+(b.autoplay?' data-autoplay':'')+' src="'+esc(src+fragment)+'"></'+b.type+'>';}
    if(b.caption)contenuto+='<figcaption>'+markdown(b.caption,errors,b.id)+'</figcaption>';
   }
   const identita=b.matchId?' data-id="'+esc(b.matchId)+'"':'';
   if(b.style?.highlight)contenuto='<mark style="background-color:'+b.style.highlight+';color:var(--ink)">'+contenuto+'</mark>';
   contenuto='<div class="presenta-contenuto"'+identita+(b.style?.scale?' style="transform:scale('+b.style.scale+')"':'')+'>'+contenuto+'</div>';
   return '<div class="presenta-blocco" data-slot="'+b.slot+'" data-block-id="'+esc(b.id)+'" style="'+esc(stile(b))+'">'+fragments(contenuto,b.id,s)+'</div>';
  }
  function slide(s){const animate=s.autoAnimate.enabled&&!d.settings.reducedMotion?' data-auto-animate data-auto-animate-id="'+esc(s.autoAnimate.groupId)+'" data-auto-animate-duration="'+s.autoAnimate.duration+'"':'';
   return '<section'+animate+' aria-label="'+esc(s.title)+'"><div class="presenta-slide" data-layout="'+s.layout+'">'+s.blocks.map(b=>blocco(b,s)).join('')+'</div></section>';
  }
  const html=d.stacks.map(p=>p.slides.length>1?'<section>'+p.slides.map(slide).join('')+'</section>':slide(p.slides[0])).join('');
  return {html,errors,settings:d.settings,title:d.title};
 }
 return {compila,markdown,formula,esc};
});
