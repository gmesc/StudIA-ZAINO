/* Resa comune di slide e note. Il Markdown passa da un albero di token consentiti. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('marked'),require('katex'),require('./modello'),require('./testo'),require('../../../lib/validate').validatePresentazione);else root.PresentaReveal=factory(root.marked,root.katex,root.PresentaModello,root.PresentaTesto);})(typeof window==='undefined'?this:window,function(marked,katex,M,T,valida){
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
 function testoDaMarkdown(testo){
  const out=[];function inline(ts,style={},link){for(const t of ts||[]){
   if(['strong','em'].includes(t.type))inline(t.tokens,{...style,[t.type==='strong'?'bold':'italic']:true},link);
   else if(t.type==='link'&&T.linkValido(t.href))inline(t.tokens,style,t.href);
   else if(t.type==='formulaZaino')out.push({latex:t.latex,display:t.display});
   else if(t.type==='br')out.push({text:'\n'});
   else if(['text','escape'].includes(t.type)){if(t.tokens)inline(t.tokens,style,link);else out.push({text:t.text,...(Object.keys(style).length?{style}:{}),...(link?{link}:{})});}
   else out.push({markdown:t.raw||t.text||''});
  }}
  for(const t of parser.lexer(testo)){if(t.type==='space')continue;if(out.length)out.push({text:'\n\n'});if(t.type==='paragraph'||t.type==='text')inline(t.tokens||[{type:'text',text:t.text}]);else out.push({markdown:t.raw});}
  return T.normalizza(out);
 }
 function testoHTML(ns,errors=[],contesto='testo'){
  T.esigi(ns);return ns.map(n=>{if(n.latex!==undefined)return formula(n.latex,n.display,errors,contesto);if(n.markdown!==undefined)return markdown(n.markdown,errors,contesto);let s='<span style="'+esc(T.css(n.style,M.CARATTERI))+'">'+esc(n.text).replace(/\n/g,'<br>')+'</span>';if(n.link)s='<a href="'+esc(n.link)+'" target="_blank" rel="noopener noreferrer">'+s+'</a>';return s;}).join('');
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
  if(s.box)out.push('left:'+s.box.x+'%','top:'+s.box.y+'%','width:'+s.box.width+'%','height:'+s.box.height+'%');if(s.verticalAlign)out.push('justify-content:'+({start:'flex-start',center:'center',end:'flex-end'})[s.verticalAlign]);
  if(s.fontFamily)out.push('font-family:'+M.CARATTERI[s.fontFamily].css);
  if(s.fontWeight!==undefined||s.bold!==undefined)out.push('--peso-testo:'+T.peso(s));if(s.italic!==undefined)out.push('font-style:'+(s.italic?'italic':'normal'));
  if(s.underline!==undefined)out.push('--sottolineato-testo:'+(s.underline?'underline':'none'));if(s.lineHeight)out.push('--interlinea:'+s.lineHeight);
  if(s.color)out.push('color:'+s.color);if(s.align)out.push('text-align:'+s.align);return out.join(';');
 }
 function compila(documento){
  if(valida){const r=valida(documento);if(!r.ok)throw Error(r.errors.join('; '));}M.esigi(documento);const d=M.pubblica(documento),errors=[],testi={};
  function testo(b,inline=false){const ns=b.richText||testoDaMarkdown(b.markdown);testi[b.id]={nodes:ns,atomi:ns.map(n=>n.text===undefined?testoHTML([n],[],b.id):null)};return '<span class="presenta-testo" data-ricco="'+!!b.richText+'" data-testo-id="'+esc(b.id)+'">'+(b.richText?testoHTML(ns,errors,b.id):markdown(b.markdown,errors,b.id,inline))+'</span>';}
  function blocco(b,s){
   let contenuto='';
   if(b.type==='title')contenuto='<h2>'+testo(b,true)+'</h2>';
   else if(b.type==='text')contenuto=testo(b);
   else if(b.type==='shape'){const figura={rectangle:'<rect x="2" y="2" width="96" height="96"/>',ellipse:'<ellipse cx="50" cy="50" rx="48" ry="48"/>',arrow:'<path d="M2 35H60V10L98 50L60 90V65H2Z"/>'}[b.shape];contenuto='<svg class="presenta-forma" role="img" aria-label="'+({rectangle:'Rettangolo',ellipse:'Ellisse',arrow:'Freccia'})[b.shape]+'" viewBox="0 0 100 100" preserveAspectRatio="none" fill="currentColor">'+figura+'</svg>';}
   else if(b.type==='table')contenuto='<table>'+b.table.map((r,i)=>'<tr>'+r.map(c=>'<'+(i?'td':'th')+'>'+markdown(c,errors,b.id,true)+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('')+'</table>';
   else if(b.type==='math')contenuto=formula(b.latex,b.display,errors,b.id);
   else if(b.type==='list')contenuto='<ul>'+b.items.map(i=>'<li>'+fragments(testo(i),i.id,s)+'</li>').join('')+'</ul>';
   else{
    const a=d.assets[b.assetId],src=a.path;
    if(b.type==='image'){
     const c=b.crop;contenuto=c?'<svg class="presenta-immagine-ritagliata" role="img" aria-label="'+esc(b.alt||'')+'" viewBox="'+[c.x*c.aspect,c.y,c.width*c.aspect,c.height].join(' ')+'"><image href="'+esc(src)+'" width="'+100*c.aspect+'" height="100" preserveAspectRatio="none" /></svg>':'<img src="'+esc(src)+'" alt="'+esc(b.alt||'')+'">';
    }
    else{const fragment=b.start!==undefined||b.end!==undefined?'#t='+(b.start||0)+(b.end!==undefined?','+b.end:''):'';contenuto='<'+b.type+' controls preload="none"'+(b.autoplay?' data-autoplay':'')+' src="'+esc(src+fragment)+'"></'+b.type+'>';}
    if(b.caption)contenuto+='<figcaption>'+markdown(b.caption,errors,b.id)+'</figcaption>';
   }
   const identita=b.matchId?' data-id="'+esc(b.matchId)+'"':'';
   if(b.style?.highlight)contenuto='<mark style="background-color:'+b.style.highlight+';color:var(--ink)">'+contenuto+'</mark>';
   contenuto='<div class="presenta-contenuto"'+identita+(b.style?.scale?' style="transform:scale('+b.style.scale+')"':'')+'>'+contenuto+'</div>';
   return '<div class="presenta-blocco" data-slot="'+b.slot+'" data-block-id="'+esc(b.id)+'" style="'+esc(stile({...b,style:{...(s.layout==='free'&&b.type==='title'?{fontSize:54}:{}),...b.style,...(s.layout!=='free'?{box:undefined}:{})}}))+'">'+fragments(contenuto,b.id,s)+'</div>';
  }
  function slide(s){const animate=s.autoAnimate.enabled&&!d.settings.reducedMotion?' data-auto-animate data-auto-animate-id="'+esc(s.autoAnimate.groupId)+'" data-auto-animate-duration="'+s.autoAnimate.duration+'"':'';
   return '<section'+animate+' aria-label="'+esc(s.title)+'"><div class="presenta-slide" data-layout="'+s.layout+'" style="'+esc('font-family:'+M.CARATTERI[d.settings.fontFamily||'zaino'].css)+';--slide-height:'+d.settings.height+'px;'+(s.background?'background-color:'+s.background+';--ink:'+M.contrasto(s.background)+';--muted:'+M.contrasto(s.background)+';color:'+M.contrasto(s.background)+';':'')+'">'+s.blocks.map(b=>blocco(b,s)).join('')+'</div></section>';
  }
  const html=d.stacks.map(p=>p.slides.length>1?'<section>'+p.slides.map(slide).join('')+'</section>':slide(p.slides[0])).join('');
  return {html,errors,settings:d.settings,title:d.title,testi};
 }
 return {compila,markdown,formula,esc,testoDaMarkdown,testoHTML};
});
