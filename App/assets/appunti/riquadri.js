/* La famiglia è unica per il vault; il simbolo scelto resta indipendente dalla famiglia. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AppuntiRiquadri=factory();})(typeof self!=='undefined'?self:this,function(){
 'use strict';
 const stili=['lucide','openmoji','android'];
 const icone=[['notebook-pen','Nota'],['star','Importante'],['book-open','Definizione'],['puzzle','Esempio'],['help-circle','Dubbio'],['triangle-alert','Attenzione'],['list-todo','Da fare'],['lock-keyhole','Lucchetto'],['unlock-keyhole','Sbloccato'],['lightbulb','Idea'],['brain','Memoria'],['bookmark','Segnalibro'],['target','Obiettivo'],['circle-check','Confermato'],['info','Informazione'],['message-square','Discussione'],['graduation-cap','Studio'],['calendar-days','Data'],['file-text','Documento'],['link','Collegamento']];
 const tipi={nota:'notebook-pen',importante:'star',definizione:'book-open',esempio:'puzzle',dubbio:'help-circle',attenzione:'triangle-alert',dafare:'list-todo'};
 const emoji={'📝':'notebook-pen','⭐':'star','🌟':'star','📖':'book-open','📚':'book-open','🧩':'puzzle','❓':'help-circle','⚠':'triangle-alert','✅':'circle-check','🔐':'lock-keyhole','🔒':'lock-keyhole','🔑':'lock-keyhole','🔓':'unlock-keyhole','💡':'lightbulb','🧠':'brain','🔖':'bookmark','🎯':'target','ℹ':'info','💬':'message-square','🎓':'graduation-cap','📅':'calendar-days','📄':'file-text','🔗':'link'};
 function stile(v){return stili.includes(v)?v:'lucide';}
 function simbolo(d,ovr){
  if(icone.some(([id])=>id===ovr?.icona))return ovr.icona;
  const e=String(ovr?.emoji||'').replace(/[\uFE0E\uFE0F]/g,'');
  return emoji[e]||tipi[d.k]||'notebook-pen';
 }
 return {stili,icone,stile,simbolo};
});
