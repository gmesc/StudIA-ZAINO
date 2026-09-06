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
    var s={ courseId:'', cur:null, mde:null, dirty:false, loading:false, timer:null };
    function el(id){ return root.document.getElementById(id); }
    function key(id){ return 'studia.banco.c.'+id+'.appunti2'; }
    function memoria(id){ try{ return JSON.parse(root.localStorage.getItem(key(id))||'{}'); }catch(e){ return {}; } }
    function scrivi(id, m){ root.localStorage.setItem(key(id), JSON.stringify(m)); }
    function avviso(t){ root.toast(t, false); }
    function occupato(file, corso){ return !!(s.cur && s.cur.file===file && s.courseId===corso); }
    function altro(file, corso){ return !!(root.NOTES.cur && root.NOTES.cur.file===file && root.NOTES.courseId===corso); }
    function ricorda(bozza){
      if(!s.cur || !s.mde || !s.courseId) return;
      var m=memoria(s.courseId), cm=s.mde.codemirror, pos=cm.getScrollInfo();
      m.punti=m.punti||{};
      m.punti[s.cur.file]={ cursor:cm.getCursor(), top:pos.top, left:pos.left };
      if(bozza) m.bozza={ file:s.cur.file, meta:root.noteMeta(s.cur), body:s.mde.value() };
      else if(!s.dirty && m.bozza && m.bozza.file===s.cur.file) delete m.bozza;
      scrivi(s.courseId,m);
    }
    function lista(){
      var api=root.notesApi(), id=root.corsoAttivo();
      if(!api || !id) return [];
      var r=api.leggi(id);
      if(r.error) throw new Error(r.error);
      return r.notes||[];
    }
    function refresh(){
      if(!s.mde) return;
      var sel=el('noteSelect2'); if(!sel) return;
      var ns; try{ ns=lista(); }catch(e){ sel.title='Elenco non leggibile: '+e.message; return; }
      sel.innerHTML='<option value="">Scegli un appunto…</option>';
      ns.forEach(function(n){
        var o=root.document.createElement('option'); o.value=n.file;
        o.textContent=(n.title||n.file)+(altro(n.file,root.corsoAttivo())?' · aperto nell’altro riquadro':'');
        o.disabled=altro(n.file,root.corsoAttivo()); sel.appendChild(o);
      });
      sel.value=s.cur?s.cur.file:'';
      sel.title=s.cur?(s.cur.title||s.cur.file):'Apri un appunto di questo zaino';
      var d=el('noteDirty2'); if(d) d.hidden=!s.dirty;
      ['noteSave2','noteRen2'].forEach(function(id){ if(el(id)) el(id).disabled=!s.cur; });
      root.tendinaViva(sel,{piccola:true});
    }
    function ensure(){
      if(s.mde) return s.mde;
      var host=el('noteHost2'); if(!host || !root.EasyMDE) return null;
      host.innerHTML='<textarea id="noteArea2" aria-label="Secondo appunto"></textarea>';
      s.mde=new root.EasyMDE({ element:el('noteArea2'), autoDownloadFontAwesome:false,
        spellChecker:false,status:false,autofocus:false,forceSync:true,indentWithTabs:false,tabSize:2,
        sideBySideFullscreen:false,placeholder:'Scegli un appunto oppure premi + per crearne uno.',
        toolbar:['bold','italic','heading','|','quote','unordered-list','ordered-list','|','link','code','|','preview','side-by-side'],
        shortcuts:{ toggleFullScreen:null,togglePreview:null,toggleSideBySide:'F9' },
        previewClass:['editor-preview','md-prev'],
        previewRender:function(md){ return root.renderNoteMd(md); }
      });
      var bar=host.querySelector('.editor-toolbar');
      bar.insertAdjacentHTML('afterbegin','<span class="notectl"><select id="noteSelect2" aria-label="Appunto in questo riquadro"></select><span class="dirty" id="noteDirty2" hidden title="Modifiche non salvate">●</span><button class="ncbtn" id="noteNew2" type="button" title="Nuovo appunto" aria-label="Nuovo appunto">+</button><button class="ncbtn" id="noteSave2" type="button" title="Salva appunto (⌘S)" aria-label="Salva appunto">💾</button><button class="ncbtn" id="noteRen2" type="button" title="Rinomina appunto" aria-label="Rinomina appunto">✎</button></span><i class="tbsep"></i>');
      bar.insertAdjacentHTML('beforeend','<span class="tbspazio"></span><button class="ncbtn" id="noteClose2" type="button" title="Chiudi appunto" aria-label="Chiudi appunto">✕</button>');
      s.mde.codemirror.setOption('readOnly',true);
      s.mde.codemirror.setOption('extraKeys', Object.assign({},s.mde.codemirror.getOption('extraKeys')||{}, {
        'Cmd-S':function(){ save(false); },'Ctrl-S':function(){ save(false); }
      }));
      s.mde.codemirror.on('change',function(){
        if(s.loading || !s.cur) return;
        s.dirty=true; el('noteDirty2').hidden=false;
        clearTimeout(s.timer); s.timer=setTimeout(function(){ save(true); },1800);
      });
      el('noteSelect2').addEventListener('change',function(e){ if(e.target.value) open(e.target.value); });
      el('noteNew2').addEventListener('click',nuovo);
      el('noteSave2').addEventListener('click',function(){ save(false); });
      el('noteRen2').addEventListener('click',rinomina);
      el('noteClose2').addEventListener('click',function(){
        if(!flush()) return;
        root.apertoScrivi('appunto2',''); clear(); root.refreshNoteUI(); root.bancoTogli('appunti2');
      });
      root.tastiNelDom(host); refresh();
      return s.mde;
    }
    function carica(body){
      s.loading=true;
      try{ s.mde.value(body||''); }finally{ s.loading=false; }
      s.mde.codemirror.setOption('readOnly',!s.cur);
    }
    function save(silent){
      if(!s.cur || !s.mde) return true;
      clearTimeout(s.timer); s.timer=null;
      var body=s.mde.value(), result;
      try{ result=root.notesApi().save(s.courseId,s.cur.file,root.noteMeta(s.cur),body,{svuota:!silent}); }
      catch(e){ result={error:e.message}; }
      if(!result || result.error){
        try{ ricorda(true); avviso('Appunto non salvato nel vault: '+((result&&result.error)||'errore sconosciuto')+'. La bozza resta conservata in questa app.'); }
        catch(e){ avviso('Salvataggio fallito. Tieni aperto questo riquadro e copia il testo: '+e.message); }
        return false;
      }
      s.cur.file=result.file||s.cur.file; s.cur.body=body; s.dirty=false;
      ricorda(false); root.notesReload(); root.refreshNoteUI(); root.refreshMyNotes(); refresh();
      if(!silent) root.toast('Appunto salvato',true);
      return true;
    }
    function flush(){
      clearTimeout(s.timer); s.timer=null;
      if(s.dirty && !save(true)) return false;
      try{ ricorda(false); }catch(e){ avviso('Posizione dell’appunto non salvata: '+e.message); }
      return true;
    }
    function clear(){
      clearTimeout(s.timer); s.timer=null;
      s.cur=null;s.courseId='';s.dirty=false;
      if(s.mde) carica('');
      refresh();
    }
    function molla(){
      var ok=flush();
      // La bozza su disco locale è il recupero se il vault non è scrivibile.
      if(!ok){ try{ ricorda(true); }catch(e){ return false; } }
      clear(); return true;
    }
    function focus(){ root.bancoMostra('appunti2'); if(s.mde) s.mde.codemirror.focus(); }
    function open(file,opt){
      opt=opt||{};
      var id=root.corsoAttivo(); if(!id || !file) return false;
      if(altro(file,id)){
        avviso('Questo appunto è già aperto nell’altro riquadro. Scegline uno diverso per lavorare in parallelo.');
        refresh(); if(!opt.ripristina) root.openEditor(); return false;
      }
      if(!flush() || !ensure()) return false;
      var ns; try{ ns=lista(); }catch(e){ avviso('Appunti non leggibili: '+e.message); return false; }
      var n=ns.find(function(x){ return x.file===file; });
      if(!n){ avviso('Appunto non trovato: '+file); return false; }
      var m=memoria(id), bozza=m.bozza&&m.bozza.file===file?m.bozza:null;
      s.courseId=id;s.cur=Object.assign({},n,bozza?bozza.meta:{});s.dirty=false;
      carica(bozza?bozza.body:n.body);
      if(bozza){ s.dirty=true; avviso('Recuperata una bozza non salvata nel vault. Premi Salva per riprovare.'); }
      root.apertoScrivi('appunto2',file); refresh(); root.refreshNoteUI();
      if(!opt.ripristina) root.bancoMostra('appunti2');
      var pos=(m.punti||{})[file];
      requestAnimationFrame(function(){
        if(s.courseId!==id || !s.cur || s.cur.file!==file) return;
        var cm=s.mde.codemirror; cm.refresh();
        if(pos){ cm.setCursor(pos.cursor||{line:0,ch:0}); cm.scrollTo(pos.left||0,pos.top||0); }
        if(!opt.ripristina) cm.focus();
      });
      return true;
    }
    async function nuovo(){
      if(!flush()) return;
      var ctx=root.curCtx(); if(!ctx){ avviso('Apri uno zaino per creare un appunto'); return; }
      var nome=await root.noteChiediNomeEOrigine('APPUNTI');
      if(!nome || ctx.courseId!==root.corsoAttivo()) return;
      var meta=root.noteMeta(Object.assign({},ctx,{title:nome.titolo,materiale:nome.materiale,pagina:nome.materiale===ctx.materiale?ctx.pagina:''}));
      var r=root.notesApi().save(ctx.courseId,null,meta,'');
      if(!r || r.error){ avviso('Appunto non creato: '+((r&&r.error)||'errore sconosciuto')); return; }
      root.notesReload(); open(r.file); root.refreshNoteUI();
    }
    async function rinomina(){
      if(!s.cur || !flush()) return;
      var file=s.cur.file,id=s.courseId;
      var titolo=await root.askText('Titolo dell’appunto',s.cur.title||'APPUNTI');
      if(titolo===null || !s.cur || s.cur.file!==file || s.courseId!==id) return;
      var r=root.notesApi().rename(id,file,String(titolo||'').trim()||'APPUNTI');
      if(!r || r.error){ avviso('Appunto non rinominato: '+((r&&r.error)||'errore sconosciuto')); return; }
      s.cur=Object.assign({},s.cur,r.nota||{}, {file:r.file});
      root.apertoScrivi('appunto2',r.file); root.notesReload(); refresh(); root.refreshNoteUI();
    }
    function layout(){
      if(root.bancoVisibile('appunti2')) ensure();
      if(s.mde){ refresh(); s.mde.codemirror.refresh(); }
    }
    root.appuntiParalleli={flush:flush,molla:molla,open:open,save:save,refresh:refresh,layout:layout,
      occupato:occupato,focus:focus,stato:s};
    root.document.addEventListener('DOMContentLoaded',layout);
  }
  return {tipo:tipo,scegli:scegli};
});
