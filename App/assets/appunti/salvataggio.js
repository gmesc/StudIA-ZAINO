(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.AppuntiSalvataggio=factory();}(typeof self!=='undefined'?self:this,function(){
 'use strict';
 function inizia(s,body){
  s.salvataggio=(s.salvataggio||0)+1;
  return s.salvataggioInCorso={id:s.salvataggio,versione:s.versione,corso:s.courseId,file:s.cur.file,body};
 }
 function attuale(s,t){return !s.eliminando&&s.salvataggio===t.id&&s.versione===t.versione&&s.courseId===t.corso&&s.cur?.file===t.file;}
 function completa(s,t,nota,testoAttuale){
  if(!attuale(s,t))return false;
  s.cur=Object.assign({},s.cur,nota);if(!nota.errore)delete s.cur.errore;s.dirty=testoAttuale!==t.body;s.salvataggioInCorso=null;
  return true;
 }
 return {inizia,attuale,completa};
}));
