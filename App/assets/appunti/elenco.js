/* ============================================================================
   appunti/elenco.js — legame appunto↔capitolo, e come si compone l'elenco
   ============================================================================
   La regola che governa tutto il file: **un appunto non deve MAI sparire
   dall'interfaccia**. Né perché stai leggendo un altro capitolo, né perché la
   lezione è stata rigenerata sotto i piedi. Da qui i tre gruppi — qui, altrove,
   orfano — e la catena di ripieghi con cui un appunto ritrova il suo capitolo.

   Due modalità, la stessa grammatica. Nei CORSI un appunto sta in una lezione e
   in un capitolo. Nello ZAINO quei due non esistono, e il loro posto lo tengono
   il DOCUMENTO da cui l'appunto è nato e la sua pagina (`materiale`, `pagina` —
   Z6); un appunto nato da zero, senza niente di aperto davanti, è `PERSONALE`.
   La modalità la porta il contesto (`ctx.modo`), non l'appunto: un ctx senza
   `modo` è un corso, ed è così che il ramo dei corsi resta quello di sempre.

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
  /* L'etichetta di un appunto dello zaino nato da zero, senza niente di aperto
     davanti. Sta in una costante perché la scrivono in tre — questo modulo, il
     chip della barra, la tendina della rinomina — e tre stringhe uguali a mano
     divergono alla prima correzione. */
  var PERSONALE = 'PERSONALE';

  /* capitoloId è posizionale (<cartella>-cNN): rigenerare la lezione lo sposta e
     l'appunto resterebbe orfano. Il nome del file .md del capitolo è più stabile,
     il titolo è l'ultima rete.

     ⚠️ Nello ZAINO non esistono capitoli: senza il ramo qui sotto questa
     funzione era falsa SEMPRE, cioè ogni appunto risultava «altrove» rispetto a
     un capitolo che non c'è — ed è ciò che teneva acceso a vuoto il chip
     «↪ altro capitolo». Il posto che nei corsi tiene il capitolo lo prende il
     DOCUMENTO da cui l'appunto è nato (`materiale`), quindi «stesso posto» vuol
     dire «stesso documento»; e due appunti senza materiale stanno insieme,
     perché sono i PERSONALI. Il ramo dei corsi non cambia di una virgola: lo
     si riconosce da `ctx.modo`, che solo lo zaino valorizza. */
  function noteInChapter(n, ctx){
    if(!n || !ctx) return false;
    if(ctx.modo==='zaino') return String(n.materiale||'')===String(ctx.materiale||'');
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
  /**
   * Il DOCUMENTO da cui è nato un appunto dello zaino, già pronto da leggere.
   * Niente documento — l'appunto è nato da zero, senza un PDF davanti — e
   * l'etichetta è `PERSONALE`: il posto non resta vuoto, perché un posto vuoto
   * nell'interfaccia si legge come «non lo so», e qui invece lo sappiamo.
   *
   * ⚠️ Gli appunti scritti prima di Z6 non hanno `materiale`: in uno zaino sono
   * PERSONALI, ed è la risposta giusta — nessuno di loro sapeva da dove veniva.
   *
   * `nomeDoc` (facoltativa) porta dal nome del file al titolo leggibile: la
   * passa il renderer con `titoloMateriale`, così l'etichetta dell'appunto è la
   * stessa parola che si legge nella barra delle fonti e nella sidebar. Qui non
   * si può richiamare quella funzione — questo modulo gira anche in Node, nei
   * test — e due modi di accorciare lo stesso nome divergerebbero.
   */
  function noteMateriale(n, nomeDoc){
    var f = (n && n.materiale) ? String(n.materiale) : '';
    if(!f) return PERSONALE;
    var t = nomeDoc ? String(nomeDoc(f) || '') : '';
    return t || f;   // il ripiego è il nome del file: meglio lungo che muto
  }
  /**
   * Dove sta un appunto, in una riga. Due grammatiche, una per modalità, e la
   * stessa forma: contenitore · punto. Nei corsi «lezione · capitolo», nello
   * zaino «documento · p. N» (Z6, il posto che il commento di `curCtx`
   * prometteva a `materiale` e `pagina`).
   *
   * ⚠️ La modalità arriva da fuori e non si indovina dall'appunto: un appunto
   * senza lezione, senza capitolo e senza materiale è PERSONALE in uno zaino,
   * ma in un corso è solo un appunto che non dice dove sta — e rispondergli
   * «PERSONALE» cambierebbe ciò che i corsi mostrano da sempre.
   */
  function noteDove(n, modo, nomeDoc){
    if(modo==='zaino'){
      /* ⚠️ La pagina si dice solo se c'è un documento: da sola non indirizza
         niente, e appiccicata a PERSONALE («PERSONALE · p. 3») racconterebbe
         una pagina di un documento che l'appunto non ha. */
      var p = (n && n.materiale) ? n.pagina : '';
      return noteMateriale(n, nomeDoc) + (p ? ' · p. ' + p : '');
    }
    return [n && n.lezione, n && n.capitolo].filter(Boolean).join(' · ');
  }
  function noteEtichettaAltrove(n, modo, nomeDoc){
    var d=noteDove(n, modo, nomeDoc);
    return noteEtichetta(n) + (d ? ' — ' + d : '');
  }
  /* qui = appunti di questo capitolo (nello zaino: di questo documento, o i
     PERSONALI quando non c'è niente di aperto); altrove = tutti gli altri del
     contenitore, che
     restano elencati e apribili; orfano = l'appunto aperto ora che non compare in
     nessuno dei due (altro corso, oppure file appena sparito da sotto i piedi). */
  function noteGroups(list, ctx, cur){
    var qui=[], altrove=[], visti={};
    (list||[]).forEach(function(n){
      if(!n || !n.file || visti[n.file]) return;
      visti[n.file]=1;
      if(ctx && noteInChapter(n, ctx)) qui.push(n); else altrove.push(n);
    });
    /* Si ordina per il posto da cui vengono, che nello zaino è il documento (i
       PERSONALI, che documento non hanno, finiscono in testa).
       ⚠️ La pagina si confronta da NUMERO: come stringa «10» verrebbe prima di
       «2», e l'elenco di un documento lungo risulterebbe mescolato. */
    var zaino = !!(ctx && ctx.modo==='zaino');
    altrove.sort(function(a,b){
      if(zaino) return String(a.materiale||'').localeCompare(String(b.materiale||'')) ||
                       ((Number(a.pagina)||0) - (Number(b.pagina)||0)) ||
                       noteEtichetta(a).localeCompare(noteEtichetta(b));
      return String(a.lezione||'').localeCompare(String(b.lezione||'')) ||
             String(a.capitolo||'').localeCompare(String(b.capitolo||'')) ||
             noteEtichetta(a).localeCompare(noteEtichetta(b)); });
    return { qui:qui, altrove:altrove, orfano:(cur && cur.file && !visti[cur.file]) ? cur : null };
  }

  return {
    PERSONALE: PERSONALE,
    noteStessoLezione: noteStessoLezione,
    noteInChapter: noteInChapter,
    noteEtichetta: noteEtichetta,
    noteMateriale: noteMateriale,
    noteDove: noteDove,
    noteEtichettaAltrove: noteEtichettaAltrove,
    noteGroups: noteGroups
  };
}));
