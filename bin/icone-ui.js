/* Incorpora solo le icone usate: node bin/icone-ui.js /percorso/lucide-static-1.61.0/package */
'use strict';
const fs=require('fs'),path=require('path'),dir=process.argv[2];
const names=["link", "eye", "eye-off", "pencil", "trash-2", "plus", "minus", "x", "chevron-left", "chevron-right", "chevron-up", "chevron-down", "calendar-days", "search", "scissors", "layers", "ruler", "palette", "play", "square", "printer", "file-down", "undo-2", "redo-2", "settings", "maximize", "move-horizontal", "arrow-down", "arrow-right", "network", "list-filter", "scan-text", "panel-top", "panels-top-left", "route", "maximize-2", "list-tree", "pause", "rotate-ccw", "check", "circle-check", "circle-x", "target", "graduation-cap", "lightbulb", "star", "book-open", "brain", "volume-2", "type", "import", "download", "library", "sun", "moon", "message-square", "columns-2", "save", "smile", "quote", "bookmark", "paperclip", "bold", "italic", "heading", "list", "list-ordered", "code", "help-circle", "chevrons-left", "chevrons-right", "music", "video", "image", "file-text", "arrow-up", "copy", "git-branch", "notebook-pen", "notebook-text", "notebook", "lock-keyhole", "unlock-keyhole", "circle-alert", "triangle-alert", "info", "puzzle", "list-todo", "eraser", "highlighter", "underline", "pilcrow", "external-link", "chart-column", "refresh-cw", "panel-left", "panel-left-close", "panel-left-open", "zoom-in", "zoom-out", "chevron-last", "chevron-first"];
const dati=Object.fromEntries(names.map(n=>[n,fs.readFileSync(path.join(dir,'icons',n+'.svg'),'utf8').replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').trim()]));
const helper=`
 function attributo(t){return String(t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function svg(nome,titolo){if(!dati[nome])throw Error('Icona non disponibile: '+nome);return '<svg class="ui-icon" data-icona="'+nome+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(titolo?'<title>'+attributo(titolo)+'</title>':'')+dati[nome]+'</svg>';}
 function imposta(el,nome,titolo){if(!el)return;el.innerHTML=svg(nome);if(titolo)el.title=titolo;if(!el.title)el.title=el.getAttribute('aria-label')||'';if(!el.getAttribute('aria-label')&&el.title)el.setAttribute('aria-label',el.title);}
 function uri(nome){return 'data:image/svg+xml,'+encodeURIComponent(svg(nome).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ').replace('currentColor','#000'));}
 return {svg:svg,imposta:imposta,uri:uri};
`;
fs.writeFileSync('App/assets/interfaccia/icone.js',`/* Lucide 1.61.0, ISC. Generato da bin/icone-ui.js. Licenza in assets/licenze/lucide.txt. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.UiIcone=factory();}(typeof self!=='undefined'?self:this,function(){
 var dati=${JSON.stringify(dati,null,1)};
${helper}}));
`);
