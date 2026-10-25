/* Incorpora solo le icone usate: node bin/icone-ui.js /percorso/lucide-static-1.61.0/package */
'use strict';
const fs=require('fs'),path=require('path'),dir=process.argv[2];
const names=["eye", "eye-off", "pencil", "trash-2", "plus", "minus", "x", "chevron-left", "chevron-right", "chevron-up", "chevron-down", "calendar-days", "search", "scissors", "layers", "ruler", "palette", "play", "square", "printer", "file-down", "undo-2", "redo-2", "settings", "maximize", "move-horizontal", "arrow-down", "arrow-right", "network", "list-filter", "scan-text", "panel-top", "panels-top-left", "route", "maximize-2", "list-tree"];
const dati=Object.fromEntries(names.map(n=>[n,fs.readFileSync(path.join(dir,'icons',n+'.svg'),'utf8').replace(/^[\s\S]*?<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'').trim()]));
const helper=`
 function svg(nome){if(!dati[nome])throw Error('Icona non disponibile: '+nome);return '<svg class="ui-icon" data-icona="'+nome+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+dati[nome]+'</svg>';}
 function imposta(el,nome){if(!el)return;el.innerHTML=svg(nome);if(!el.getAttribute('aria-label')&&el.title)el.setAttribute('aria-label',el.title);}
 return {svg:svg,imposta:imposta};
`;
fs.writeFileSync('App/assets/interfaccia/icone.js',`/* Lucide 1.61.0, ISC. Generato da bin/icone-ui.js. Licenza in assets/licenze/lucide.txt. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.UiIcone=factory();}(typeof self!=='undefined'?self:this,function(){
 var dati=${JSON.stringify(dati,null,1)};
${helper}}));
`);
