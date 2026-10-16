/* Due istanze dei materiali, una voce in testata. I pannelli restano vivi nel
   magazzino del banco; scegliere Appunti/Fonti usa quello libero. */
(function(root, factory){
  if(typeof module==='object' && module.exports) module.exports=factory(null);
  else root.BancoMateriali=factory(root);
})(typeof window!=='undefined'?window:this, function(root){
  'use strict';
  var istanze={ fonte:['fonte','fonte2'], appunti:['appunti','appunti2'] };
  function tipo(id){ return id==='fonte2'?'fonte':id==='appunti2'?'appunti':id; }
  function scegli(blocchi, visibili, blocco, richiesta){
    var pool=istanze[richiesta];
    if(!pool) return richiesta;
    var attuale=(blocchi||{})[blocco];
    if(pool.indexOf(attuale)>=0) return attuale;
    return pool.find(function(id){
      return !(visibili||[]).some(function(b){ return b!==blocco && blocchi[b]===id; });
    }) || '';
  }
  if(root){
    function stato(){ return root.noteStati()[1]; }
    root.appuntiParalleli={
      get stato(){ return stato(); },
      flush:function(){ return root.noteFlushStato(stato()); },
      molla:function(){ if(!root.noteFlushStato(stato())) return false; root.noteSvuota(stato()); return true; },
      open:function(file,opt){ return root.noteOpen(file,stato(),opt); },
      save:function(silent){ return root.noteSave(silent,stato()); },
      refresh:function(){ return root.refreshNoteUI(stato()); },
      layout:function(){
        var s=stato(); if(root.bancoVisibile(s.id)) root.ensureMde(s);
        if(s.mde){ root.refreshNoteUI(s); s.mde.codemirror.refresh(); }
      },
      occupato:function(file,corso){ var s=stato(); return !!(s.cur && s.cur.file===file && s.courseId===corso); },
      focus:function(){ var s=stato(); root.openEditor(s); if(s.mde) s.mde.codemirror.focus(); },
      attivo:function(){ return root.noteStatoAttivo()===stato(); }
    };
    root.document.addEventListener('DOMContentLoaded',function(){ root.appuntiParalleli.layout(); });
  }
  return {tipo:tipo,scegli:scegli};
});
