/* La bolla dei riquadri: si batte «> » e il menu compare al cursore.
 *
 * ⚠️ IL CONTROLLO CHE VALE IL FILE è il terzo: dentro un riquadro l'Invio
 * inserisce «> » DA SOLO (l'addon `continuelist` di CodeMirror), e ⌘' fa lo
 * stesso a comando. Una bolla agganciata a «la riga è `> `» sbucherebbe a ogni
 * Invio dentro ogni riquadro — cioè sarebbe inutilizzabile. Qui si misura che
 * scatti per ciò che è stato BATTUTO e per nient'altro.
 *
 * ⚠️ E si batte davvero, con `Input.dispatchKeyEvent`: `replaceSelection` da
 * codice non emette `inputRead`, quindi una prova scritta con quello direbbe
 * «non compare» sempre, o «compare» mai — a seconda di come è scritto il
 * codice, non di come si comporta.
 *
 * ⚠️ Gira contro il vault della config: puntarlo a una COPIA (trappola ⑧).
 *   ./test/cdp/con-vault-di-prova.sh prova-callout-bolla
 */
const path = require('path');
const fs = require('fs');
const appunti = require('../../lib/appunti');
const S = path.join(__dirname, 'cdp.js');
const { collega, val, pausa, partiPulito, apriStrumento, invia, clicca } = require(S);

let ko = 0;
function ok(n, atteso, avuto) {
  const a = JSON.stringify(atteso), b = JSON.stringify(avuto);
  if (a === b) { console.log('  ok  ' + n); return; }
  ko++; console.log('  KO  ' + n + '\n      atteso ' + a + '\n      avuto  ' + b);
}
async function tasto(key, code, vk) {
  const base = { key, code: code || key, windowsVirtualKeyCode: vk || 0 };
  await invia('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown' }, base));
  await invia('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
  await pausa(60);
}
/* ⚠️ Si batte con `keyDown` PORTANDO il testo, non con `char`: una tastiera
   vera emette tutti e due gli eventi, e il solo `char` non fa scattare nessun
   `keydown` — una prova scritta così misura mezzo percorso e chiama rosso il
   codice che funziona. */
async function scrivi(s) {
  for (const ch of s) {
    await invia('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch, unmodifiedText: ch });
    await invia('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
  }
  await pausa(150);
}
const aperta = () => val(`(()=>{const m=document.querySelector('#calloutMenu');
  return !!(m && m.hasAttribute('open'));})()`);
const testo = () => val(`NOTES.mde.codemirror.getValue()`);
/** Svuota l'editor e ci mette il cursore dentro, come farebbe una mano. */
async function daCapo(iniziale) {
  await val(`(()=>{ clearTimeout(NOTES.timer); NOTES.timer=null; NOTES.dirty=false;
    noteCaricaCorpo(${JSON.stringify(iniziale || '')}, NOTES); const cm=NOTES.mde.codemirror;
    cm.focus(); cm.setCursor({ line:cm.lineCount()-1, ch:cm.getLine(cm.lineCount()-1).length });
    return 1; })()`);
  await pausa(150);
}

(async () => {
  await collega(); await partiPulito();
  // Ogni battuta va in una fixture: una nota lasciata dalla prova prima non è
  // un foglio di scarto, e l'autosalvataggio continua anche dopo questa prova.
  const originale = await val(`(()=>{
    if(!noteFlushStato(NOTES)) throw new Error('L’appunto precedente non si salva');
    const cm=NOTES.mde && NOTES.mde.codemirror;
    const chiavi=[bancoChiave(), bancoZoomChiave(), 'studia.aperto',
      'studia.banco.c.'+corsoAttivo()+'.appunti', 'studia.banco.c.'+corsoAttivo()+'.appunti2'];
    return { corso:corsoAttivo(), vault:window.vault.path,
      file:NOTES.cur && NOTES.cur.file, body:NOTES.mde ? NOTES.mde.value() : '',
      invito:NOTES.invito, preview:!!NOTES.mde?.isPreviewActive(),
      affiancata:!!NOTES.mde?.isSideBySideActive(),
      cursor:cm && cm.getCursor(), scroll:cm && cm.getScrollInfo(),
      banco:JSON.parse(JSON.stringify(bancoStato())), zoom:bancoZoomLeggi(),
      attivo:BANCO.attivo, ultimo:noteStatoAttivo().id, editor:document.documentElement.dataset.editor||'',
      memoria:Object.fromEntries(chiavi.map(k=>[k,localStorage.getItem(k)])) };
  })()`);
  const fileOriginale = originale.file && path.join(appunti.dir(originale.vault, originale.corso), originale.file);
  const testoOriginale = fileOriginale ? fs.readFileSync(fileOriginale, 'utf8') : null;
  let principale = '';
  try {
    principale = await val(`(()=>{
      const r=notesApi().save(${JSON.stringify(originale.corso)},null,
        {title:'Prova callout principale '+Date.now()},'');
      if(!r || r.error) throw new Error((r && r.error)||'Appunto di prova non creato');
      notesReload(); return r.file;
    })()`);
    await val(`(()=>{
      noteSvuota(NOTES); ensureMde(NOTES);
      if(NOTES.mde.isSideBySideActive()) NOTES.mde.toggleSideBySide();
      if(NOTES.mde.isPreviewActive()) NOTES.mde.togglePreview();
      if(!noteOpen(${JSON.stringify(principale)}, NOTES)) throw new Error('Appunto di prova non aperto');
      return 1;
    })()`);
    await apriStrumento('appunti'); await pausa(800);
    await val(`(()=>{ openEditor(NOTES); return 1; })()`); await pausa(500);

  console.log('== Si batte «> » e la bolla compare');
  await daCapo('');
  await scrivi('> ');
  ok('la bolla è aperta', true, await aperta());
  ok('sta al cursore, non in cima alla finestra', true, await val(`(()=>{
    const m=document.querySelector('#calloutMenu').getBoundingClientRect();
    const c=NOTES.mde.codemirror.cursorCoords(true,'window');
    return Math.abs(m.left-c.left) < 40 && m.top > c.top - 8; })()`));
  ok('la prima voce è quella scelta', 'nota',
    await val(`document.querySelector('#calloutMenu button.scelto').dataset.cal`));

  console.log('\n== Le frecce scorrono, Invio sceglie');
  await tasto('ArrowDown', 'ArrowDown', 40);
  await tasto('ArrowDown', 'ArrowDown', 40);
  ok('due giù = la terza voce', 'definizione',
    await val(`document.querySelector('#calloutMenu button.scelto').dataset.cal`));
  await tasto('ArrowUp', 'ArrowUp', 38);
  ok('e una su torna indietro', 'importante',
    await val(`document.querySelector('#calloutMenu button.scelto').dataset.cal`));
  await tasto('Enter', 'Enter', 13);
  await pausa(200);
  ok('la bolla si chiude', false, await aperta());
  /* ⚠️ Il «> » battuto non deve restare: `insertCallout` scrive il suo, e
     sommandosi uscirebbe «> > [!importante]» — un riquadro dentro una
     citazione, che non è quello che si è chiesto. */
  ok('e il riquadro è scritto una volta sola',
    '> [!importante] Importante\n> \n', await testo());
  ok('il cursore è nel corpo, pronto a scrivere', { line:1, ch:2 },
    await val(`(()=>{const p=NOTES.mde.codemirror.getCursor(); return {line:p.line,ch:p.ch};})()`));
  await scrivi('Subito.');
  ok('la prima parola entra nel riquadro senza spostare il cursore',
    '> [!importante] Importante\n> Subito.\n', await testo());

  console.log('\n== La scelta col mouse conserva il fuoco nell’editor');
  await daCapo('');
  await scrivi('> ');
  await clicca('#calloutMenu button[data-cal="nota"]');
  await scrivi('Subito.');
  ok('anche col mouse si scrive subito nella seconda riga',
    '> [!nota] Nota\n> Subito.\n', await testo());

  console.log('\n== ⚠️ Dentro un riquadro l\'Invio NON la sveglia');
  /* L'Invio in fondo a una riga di riquadro fa scrivere «> » a `continuelist`:
     se la bolla si agganciasse alla FORMA della riga, comparirebbe qui. */
  await daCapo('> [!nota] Titolo\n> Prima frase.');
  await tasto('Enter', 'Enter', 13);
  await pausa(200);
  ok('la riga nuova comincia con «> » da sé', true,
    await val(`/^>\\s?$/.test(NOTES.mde.codemirror.getLine(2)||'')`));
  ok('e la bolla non è comparsa', false, await aperta());
  /* E nemmeno battendolo a mano: sotto una riga di riquadro si sta continuando
     quel riquadro. */
  await daCapo('> [!nota] Titolo\n> Prima frase.\n');
  await scrivi('> ');
  ok('nemmeno battuto sotto un riquadro', false, await aperta());

  console.log('\n== È un suggerimento, non un dirottamento');
  await daCapo('');
  await scrivi('> ');
  ok('la bolla c\'è', true, await aperta());
  /* Il battesimo alla quinta parola si verifica separatamente sotto: qui
     conta che continuare la citazione richiuda il suggerimento. */
  await scrivi('Le parole');
  ok('continuando a scrivere se ne va', false, await aperta());
  ok('e resta la citazione che si stava scrivendo',
    '> Le parole', await testo());
  await daCapo('');
  await scrivi('> ');
  await tasto('Escape', 'Escape', 27);
  await pausa(150);
  ok('Esc la manda via', false, await aperta());
  ok('e lascia la riga com\'era', '> ', await testo());

  console.log('\n== Il 📜 della barra apre lo stesso menu, e non è la bolla');
  await daCapo('');
  await val(`(()=>{ openCalloutMenu(document.querySelector('#noteHost .ncb-callout')); return 1; })()`);
  await pausa(200);
  ok('il menu è aperto', true, await aperta());
  /* ⚠️ Il menu è lo stesso, la bolla no: `openCalloutMenu` passa da `popAt`,
     che comincia con `closePops()`, e quello spegne ANCHE lo stato della bolla.
     Senza, resterebbe una bolla invisibile e attiva, e il primo click
     cancellerebbe l'inizio della riga dov'è il cursore. */
  ok('ma la bolla non è attiva', false, await val(`CALBOLLA.attiva`));
  await val(`(()=>{ document.querySelector('#calloutMenu button[data-cal="dubbio"]').click(); return 1; })()`);
  await pausa(200);
  ok('e inserisce senza cancellare niente davanti',
    '> [!dubbio] Dubbio\n> \n', await testo());
  await scrivi('Testo.');
  ok('anche dalla barra si scrive subito nel corpo',
    '> [!dubbio] Dubbio\n> Testo.\n', await testo());

  console.log('\n== Il testo selezionato resta il corpo del riquadro');
  await daCapo('Prima.\nSeconda.');
  await val(`(()=>{ const cm=NOTES.mde.codemirror;
    cm.setSelection({line:0,ch:0},{line:1,ch:8});
    openCalloutMenu(document.querySelector('#noteHost .ncb-callout'));
    document.querySelector('#calloutMenu button[data-cal="nota"]').click();
    return 1; })()`);
  ok('le righe selezionate si conservano, senza testo di esempio',
    '> [!nota] Nota\n> Prima.\n> Seconda.\n', await testo());

  console.log('\n== Il battesimo conta parole, senza farsi anticipare dai segni');
  ok('quattro parole attendono; cinque, anche Unicode, chiedono il titolo',
    [0, 1, 1, 0], await val(`(async()=>{
      const cur=NOTES.cur, invito=NOTES.invito, prima=NOTES.mde.value();
      clearTimeout(NOTES.timer); NOTES.timer=null;
      const chiedi=noteChiediNomeEOrigine, avvisi=toast;
      let chiamate=0; const risultati=[];
      try {
        NOTES.cur=null;
        noteChiediNomeEOrigine=async function(){ chiamate++; return null; };
        toast=function(){};
        for(const testo of ['Una frase di quattro', 'Una frase di cinque parole',
          'È già più così perché', '> [!nota] Nota\\n> Subito.\\n']){
          noteCaricaCorpo(testo, NOTES); NOTES.invito=false; chiamate=0;
          await noteInvito(NOTES); risultati.push(chiamate);
        }
        return risultati;
      } finally {
        noteChiediNomeEOrigine=chiedi; toast=avvisi;
        NOTES.cur=cur; NOTES.invito=invito; noteCaricaCorpo(prima, NOTES);
      }
    })()`));

  console.log('\n== Ogni split inserisce il callout nel proprio appunto');
  const precedente = await val(`(()=>{
    if(!appuntiParalleli.flush()) throw new Error('Il secondo appunto precedente non si salva');
    const corso=corsoAttivo();
    return { banco:JSON.parse(JSON.stringify(bancoStato())), zoom:bancoZoomLeggi(),
      secondo:appuntiParalleli.stato.cur && appuntiParalleli.stato.cur.file,
      memoria:localStorage.getItem('studia.banco.c.'+corso+'.appunti2'),
      primo:NOTES.mde.value(), corso:corso, vault:window.vault.path };
  })()`);
  let fixture = '';
  try {
    fixture = await val(`(()=>{
      const r=notesApi().save(${JSON.stringify(precedente.corso)},null,
        {title:'Prova callout split '+Date.now()},'');
      if(!r || r.error) throw new Error((r && r.error)||'Appunto di prova non creato');
      notesReload(); return r.file;
    })()`);
    await val(`(()=>{
      bancoForma('quattro'); bancoAssegna('A','appunti'); bancoAssegna('B','appunti2');
      if(!appuntiParalleli.open(${JSON.stringify(fixture)})) throw new Error('Secondo appunto non aperto');
      return 1;
    })()`);
    await pausa(250);
    const testo2 = () => val(`appuntiParalleli.stato.mde.codemirror.getValue()`);
    const daCapo2 = async () => {
      await val(`(()=>{ const s=appuntiParalleli.stato;
        clearTimeout(s.timer); s.timer=null; s.dirty=false; noteCaricaCorpo('', s);
        s.mde.codemirror.setCursor({line:0,ch:0}); s.mde.codemirror.focus(); return 1;
      })()`);
      await pausa(100);
    };

    await daCapo2(); await scrivi('> '); await tasto('Enter','Enter',13); await scrivi('Due.');
    ok('tastiera: il callout entra nel secondo appunto',
      '> [!nota] Nota\n> Due.\n', await testo2());
    await daCapo2(); await scrivi('> ');
    await clicca('#calloutMenu button[data-cal="dubbio"]'); await scrivi('Tre.');
    ok('mouse: il corpo resta nel secondo appunto',
      '> [!dubbio] Dubbio\n> Tre.\n', await testo2());
    await daCapo2(); await clicca('#noteHost2 .ncb-callout');
    await clicca('#calloutMenu button[data-cal="nota"]'); await scrivi('Quattro.');
    ok('anche la toolbar usa il proprio editor',
      '> [!nota] Nota\n> Quattro.\n', await testo2());
    ok('il primo appunto non riceve nessuno dei tre inserimenti', precedente.primo, await testo());
  } finally {
    await val(`(()=>{
      closePops(); noteSvuota(appuntiParalleli.stato); apertoScrivi('appunto2','');
      if(${JSON.stringify(precedente.secondo)}) appuntiParalleli.open(${JSON.stringify(precedente.secondo)}, {ripristina:true});
      BANCO.stato=${JSON.stringify(precedente.banco)};
      bancoSalva(); bancoZoomScrivi(${JSON.stringify(precedente.zoom)}); bancoDisegna();
      const chiave='studia.banco.c.'+${JSON.stringify(precedente.corso)}+'.appunti2';
      if(${JSON.stringify(precedente.memoria)}===null) localStorage.removeItem(chiave);
      else localStorage.setItem(chiave,${JSON.stringify(precedente.memoria)});
      NOTES.mde.codemirror.focus(); return 1;
    })()`);
    // La fixture nasce qui, nel vault di prova: la rimozione diretta evita il Cestino vero.
    if(fixture) appunti.remove(precedente.vault, precedente.corso, fixture);
    await val(`(()=>{ notesReload(); refreshNoteUI(); return 1; })()`);
  }

  } finally {
    // Scarta soltanto il contenuto della fixture, poi rimette il documento o
    // la bozza senza nome che c'erano. Nessun setValue vuoto resta da salvare.
    await val(`(()=>{
      closePops(); noteSvuota(NOTES); notesReload();
      if(${JSON.stringify(originale.file)}) {
        if(!noteOpen(${JSON.stringify(originale.file)}, NOTES, {ripristina:true}))
          throw new Error('Appunto precedente non ripristinato');
      } else { noteCaricaCorpo(${JSON.stringify(originale.body)}, NOTES); NOTES.invito=${JSON.stringify(originale.invito)}; }
      BANCO.stato=${JSON.stringify(originale.banco)}; BANCO.attivo=${JSON.stringify(originale.attivo)};
      bancoSalva(); bancoZoomScrivi(${JSON.stringify(originale.zoom)}); bancoDisegna();
      document.documentElement.dataset.editor=${JSON.stringify(originale.editor)};
      noteAttiva(noteStati().find(s=>s.id===${JSON.stringify(originale.ultimo)})||NOTES);
      return 1;
    })()`);
    // Il ripristino normale ha un callback del cursore: prima lo si lascia
    // finire, poi si rimette il punto preciso della prova precedente.
    await pausa(100);
    await val(`(()=>{
      if(NOTES.mde){
        const cm=NOTES.mde.codemirror; NOTES.caricando=true;
        try {
          if(${JSON.stringify(originale.cursor)}) cm.setCursor(${JSON.stringify(originale.cursor)});
          const pos=${JSON.stringify(originale.scroll)}; if(pos) cm.scrollTo(pos.left,pos.top);
        } finally { NOTES.caricando=false; }
        if(${originale.preview} && !NOTES.mde.isPreviewActive()) NOTES.mde.togglePreview();
        if(${originale.affiancata} && !NOTES.mde.isSideBySideActive()) NOTES.mde.toggleSideBySide();
      }
      noteAttiva(noteStati().find(s=>s.id===${JSON.stringify(originale.ultimo)})||NOTES);
      BANCO.attivo=${JSON.stringify(originale.attivo)}; bancoSegnaAttivo();
      Object.entries(${JSON.stringify(originale.memoria)}).forEach(([k,v])=>{
        if(v===null) localStorage.removeItem(k); else localStorage.setItem(k,v);
      });
      return 1;
    })()`);
    if(principale) appunti.remove(originale.vault, originale.corso, principale);
    await val(`(()=>{ notesReload(); refreshNoteUI(); return 1; })()`);
    if(fileOriginale) ok('l’appunto precedente resta identico sul disco', testoOriginale, fs.readFileSync(fileOriginale, 'utf8'));
    ok('nessun autosalvataggio della fixture resta in attesa', false, await val(`!!NOTES.timer || NOTES.dirty`));
  }
  console.log(ko ? '\n✗ ' + ko + ' controlli falliti' : '\n✓ tutti i controlli passati');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
