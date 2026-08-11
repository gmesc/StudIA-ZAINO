/* ============================================================================
   appunti/elenco.js — legame appunto↔capitolo, e come si compone l'elenco
   ============================================================================
   La regola che governa tutto il file: **un appunto non deve MAI sparire
   dall'interfaccia**. Né perché stai leggendo un altro capitolo, né perché la
   lezione è stata rigenerata sotto i piedi. Da qui i tre gruppi — qui, altrove,
   orfano — e la catena di ripieghi con cui un appunto ritrova il suo capitolo.

   ⚠️ Era un blocco marcato `@appunti-puro-inizio` dentro `App/StudIA.html`,
   ritagliato a runtime da `lib/reader-parser.js`.
   ============================================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AppuntiElenco = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ⚠️ `lezioneId` è la CARTELLA, quindi due varianti della stessa lezione non si
     scambiano gli appunti: un appunto appartiene alla versione del testo su cui è
     stato preso (decisione del 10 agosto 2026, la stessa di evidenze e mappe).
     Non è un dettaglio da semplificare: il ripiego sul titolo che segue vale solo
     per gli appunti VECCHI, quelli senza `lezioneId`, e siccome le varianti
     condividono il titolo, farlo scattare prima li farebbe comparire in tutte. */
  function noteStessoLezione(n, ctx){
    if(n.lezioneId && ctx.lezioneId) return n.lezioneId===ctx.lezioneId;
    if(n.lezione && ctx.lezione) return n.lezione===ctx.lezione;
    return true;
  }
  /* capitoloId è posizionale (<cartella>-cNN): rigenerare la lezione lo sposta e
     l'appunto resterebbe orfano. Il nome del file .md del capitolo è più stabile,
     il titolo è l'ultima rete. */
  function noteInChapter(n, ctx){
    if(!n || !ctx) return false;
    if(n.capitoloId && ctx.capitoloId && n.capitoloId===ctx.capitoloId) return true;
    if(!noteStessoLezione(n, ctx)) return false;
    if(n.capitoloFile && ctx.capitoloFile && n.capitoloFile===ctx.capitoloFile) return true;
    if(n.capitolo && ctx.capitolo && n.capitolo===ctx.capitolo) return true;
    return false;
  }
  function noteEtichetta(n){
    if(!n) return 'senza titolo';
    return String(n.title || String(n.file||'').replace(/\.md$/,'') || 'senza titolo');
  }
  function noteDove(n){ return [n && n.lezione, n && n.capitolo].filter(Boolean).join(' · '); }
  function noteEtichettaAltrove(n){ var d=noteDove(n); return noteEtichetta(n) + (d ? ' — ' + d : ''); }
  /* qui = appunti di questo capitolo; altrove = tutti gli altri del corso, che
     restano elencati e apribili; orfano = l'appunto aperto ora che non compare in
     nessuno dei due (altro corso, oppure file appena sparito da sotto i piedi). */
  function noteGroups(list, ctx, cur){
    var qui=[], altrove=[], visti={};
    (list||[]).forEach(function(n){
      if(!n || !n.file || visti[n.file]) return;
      visti[n.file]=1;
      if(ctx && noteInChapter(n, ctx)) qui.push(n); else altrove.push(n);
    });
    altrove.sort(function(a,b){
      return String(a.lezione||'').localeCompare(String(b.lezione||'')) ||
             String(a.capitolo||'').localeCompare(String(b.capitolo||'')) ||
             noteEtichetta(a).localeCompare(noteEtichetta(b)); });
    return { qui:qui, altrove:altrove, orfano:(cur && cur.file && !visti[cur.file]) ? cur : null };
  }

  return {
    noteStessoLezione: noteStessoLezione,
    noteInChapter: noteInChapter,
    noteEtichetta: noteEtichetta,
    noteDove: noteDove,
    noteEtichettaAltrove: noteEtichettaAltrove,
    noteGroups: noteGroups
  };
}));
